import React, { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import styles from "./LayoutPlannerModal.module.css";

const PX_PER_MM = 72 / 25.4;

const FORMATS = {
  A5: { label: "A5", width: 148, height: 210 },
  A4: { label: "A4", width: 210, height: 297 },
  A3: { label: "A3", width: 297, height: 420 },
};

const ORIENTATION_LABELS = {
  portrait: "Вертикально",
  landscape: "Горизонтально",
};

const LAYOUT_OUTLINE_COLOR = "#0000FF";
const OUTLINE_STROKE_COLOR = LAYOUT_OUTLINE_COLOR;
const TEXT_STROKE_COLOR = "#008181";
const BLACK_STROKE_VALUES = new Set(["#000", "#000000", "black", "rgb(0,0,0)", "rgba(0,0,0,1)", "#000000ff"]);
const BLACK_STROKE_STYLE_PATTERN = /(stroke\s*:\s*)(#000(?:000)?|black|rgb\(0\s*,\s*0\s*,\s*0\)|rgba\(0\s*,\s*0\s*,\s*0\s*,\s*1\))/gi;

const toMm = (px = 0) => (Number(px) || 0) / PX_PER_MM;

const round1 = (value) => Math.round(Number(value) || 0);

const extractCopies = (design) => {
  const candidates = [
    design?.copiesCount,
    design?.toolbarState?.copiesCount,
    design?.meta?.copiesCount,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.floor(numeric);
    }
  }

  return 1;
};

const normalizeDesigns = (designs = []) =>
  designs
    .map((design, index) => {
      const widthMm = toMm(design?.width);
      const heightMm = toMm(design?.height);

      if (!widthMm || !heightMm) return null;

      const copies = extractCopies(design);
      const svgContent = design?.previewSvg || null;
      
      // Витягуємо strokeColor з toolbarState для відслідковування колірної теми
      const themeStrokeColor = design?.toolbarState?.globalColors?.strokeColor || null;

      return {
        id: design.id ?? `design-${index}`,
        name: design.name || `Полотно ${index + 1}`,
        widthMm,
        heightMm,
        area: widthMm * heightMm,
        meta: design.meta || {},
        copies,
        svg: svgContent,
        preview: design?.preview || null,
        themeStrokeColor, // Додаємо інформацію про колір теми
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const largestSideDiff = Math.max(b.widthMm, b.heightMm) - Math.max(a.widthMm, a.heightMm);
      if (largestSideDiff !== 0) return largestSideDiff;
      return b.area - a.area;
    });

const planSheets = (items, sheetSize, spacingMm) => {
  const sheetInnerWidth = sheetSize.width;
  const sheetInnerHeight = sheetSize.height;

  if (sheetInnerWidth <= 0 || sheetInnerHeight <= 0) {
    return { sheets: [], leftovers: items };
  }

  const sheets = [];
  const leftovers = [];

  const tryPlaceOnRow = (sheet, row, item, orientation) => {
    if (orientation.width > sheetInnerWidth || orientation.height > sheetInnerHeight) {
      return false;
    }

    // Не дозволяємо рядах збільшувати висоту понад первісну
    if (orientation.height - row.height > 0.01) {
      return false;
    }

    const xOffset = row.items.length === 0 ? 0 : row.usedWidth + spacingMm;
    if (xOffset + orientation.width > sheetInnerWidth + 0.001) {
      return false;
    }

    const placement = {
      id: item.id,
      name: item.label || item.name,
      width: orientation.width,
      height: orientation.height,
      x: xOffset,
      y: row.y,
      rotated: orientation.rotated,
      meta: item.meta,
      sourceWidth: item.widthMm,
      sourceHeight: item.heightMm,
      baseId: item.baseId ?? item.id,
      copyIndex: item.copyIndex ?? 1,
      copies: item.copies ?? 1,
      svg: item.svg || null,
      preview: item.preview || null,
      themeStrokeColor: item.themeStrokeColor || null, // Передаємо колір теми
    };

    row.items.push(placement);
    row.usedWidth = xOffset + orientation.width;
    sheet.placements.push(placement);
    sheet.usedArea += item.area;

    return true;
  };

  const tryPlaceOnNewRow = (sheet, item, orientation) => {
    if (orientation.width > sheetInnerWidth || orientation.height > sheetInnerHeight) {
      return false;
    }

    const rowY = sheet.nextRowY;
    if (rowY + orientation.height > sheetInnerHeight + 0.001) {
      return false;
    }

    const placement = {
      id: item.id,
      name: item.label || item.name,
      width: orientation.width,
      height: orientation.height,
      x: 0,
      y: rowY,
      rotated: orientation.rotated,
      meta: item.meta,
      sourceWidth: item.widthMm,
      sourceHeight: item.heightMm,
      baseId: item.baseId ?? item.id,
      copyIndex: item.copyIndex ?? 1,
      copies: item.copies ?? 1,
      svg: item.svg || null,
      preview: item.preview || null,
      themeStrokeColor: item.themeStrokeColor || null, // Передаємо колір теми
    };

    const row = {
      y: rowY,
      height: orientation.height,
      usedWidth: orientation.width,
      items: [placement],
    };

    sheet.rows.push(row);
    sheet.nextRowY = rowY + orientation.height + spacingMm;
    sheet.placements.push(placement);
    sheet.usedArea += item.area;

    return true;
  };

  const orientationsFor = (item) => {
    const variants = [
      { width: item.widthMm, height: item.heightMm, rotated: false },
    ];

    if (Math.abs(item.widthMm - item.heightMm) > 0.01) {
      variants.push({ width: item.heightMm, height: item.widthMm, rotated: true });
    }

    return variants;
  };

  const queue = [];

  items.forEach((item) => {
    const totalCopies = Math.max(1, Math.floor(item.copies || 1));
    for (let idx = 0; idx < totalCopies; idx += 1) {
      queue.push({
        ...item,
        id: `${item.id}::${idx + 1}`,
        baseId: item.id,
        label: totalCopies > 1 ? `${item.name} #${idx + 1}` : item.name,
        copyIndex: idx + 1,
        copies: totalCopies,
        svg: item.svg || null,
        preview: item.preview || null,
        themeStrokeColor: item.themeStrokeColor || null, // Зберігаємо колір теми
      });
    }
  });

  queue.forEach((item) => {
    const orientations = orientationsFor(item);
    let placed = false;

    for (const sheet of sheets) {
      for (const orientation of orientations) {
        let rowPlaced = false;
        for (const row of sheet.rows) {
          if (tryPlaceOnRow(sheet, row, item, orientation)) {
            rowPlaced = true;
            placed = true;
            break;
          }
        }
        if (rowPlaced) break;

        if (tryPlaceOnNewRow(sheet, item, orientation)) {
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) {
      const newSheet = {
        width: sheetSize.width,
        height: sheetSize.height,
        rows: [],
        placements: [],
        nextRowY: 0,
        usedArea: 0,
      };

      let placedOnFresh = false;
      for (const orientation of orientations) {
        if (tryPlaceOnNewRow(newSheet, item, orientation)) {
          placedOnFresh = true;
          break;
        }
      }

      if (placedOnFresh) {
        sheets.push(newSheet);
      } else {
        leftovers.push(item);
      }
    }
  });

  return { sheets, leftovers };
};

const PERCENT_ATTR_HANDLERS = {
  width: (value, totals) => (value / 100) * totals.width,
  height: (value, totals) => (value / 100) * totals.height,
  x: (value, totals) => (value / 100) * totals.width,
  y: (value, totals) => (value / 100) * totals.height,
  cx: (value, totals) => (value / 100) * totals.width,
  cy: (value, totals) => (value / 100) * totals.height,
  rx: (value, totals) => (value / 100) * totals.width,
  ry: (value, totals) => (value / 100) * totals.height,
  r: (value, totals) => (value / 100) * Math.min(totals.width, totals.height),
};

const convertPercentAttributeValue = (attributeValue, totals, attributeName) => {
  if (!attributeValue || typeof attributeValue !== "string") return null;
  const trimmed = attributeValue.trim();
  if (!trimmed.endsWith("%")) return null;

  const numericPart = parseFloat(trimmed.slice(0, -1));
  if (!Number.isFinite(numericPart)) return null;

  const handler = PERCENT_ATTR_HANDLERS[attributeName];
  if (!handler) return null;

  return handler(numericPart, totals);
};

const convertPercentagesToAbsolute = (node, totals) => {
  if (!node || node.nodeType !== 1) return;

  Array.from(node.attributes || []).forEach((attribute) => {
    const converted = convertPercentAttributeValue(attribute.value, totals, attribute.name);
    if (converted !== null) {
      node.setAttribute(attribute.name, String(converted));
    }
  });

  Array.from(node.childNodes || []).forEach((child) => {
    convertPercentagesToAbsolute(child, totals);
  });
};

const normalizeStrokeValue = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("rgb")) {
    const numbers = trimmed
      .replace(/rgba?\(/, "")
      .replace(/\)/, "")
      .split(",")
      .map((part) => part.trim());
    if (numbers.length >= 3) {
      const [r, g, b, a = "1"] = numbers;
      if (Number(r) === 0 && Number(g) === 0 && Number(b) === 0 && Number(a) !== 0) {
        return "rgb(0,0,0)";
      }
    }
  }
  return trimmed;
};

const shouldRecolorStroke = (strokeValue) => {
  const normalized = normalizeStrokeValue(strokeValue);
  if (!normalized) return false;
  return BLACK_STROKE_VALUES.has(normalized);
};

const normalizeColorValue = (color) => {
  if (typeof color !== "string") return "";
  const trimmed = color.trim().toLowerCase();
  
  // Нормалізуємо rgb/rgba формати
  if (trimmed.startsWith("rgb")) {
    const numbers = trimmed
      .replace(/rgba?\(/, "")
      .replace(/\)/, "")
      .split(",")
      .map((part) => part.trim());
    
    if (numbers.length >= 3) {
      const [r, g, b] = numbers.map(n => parseInt(n));
      // Конвертуємо в hex для порівняння
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }
  }
  
  // Для hex кольорів - нормалізуємо до 6 символів
  if (trimmed.startsWith("#")) {
    if (trimmed.length === 4) {
      // Розширюємо короткий формат #RGB -> #RRGGBB
      const [, r, g, b] = trimmed;
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return trimmed.slice(0, 7); // #RRGGBB
  }
  
  return trimmed;
};

const colorsMatch = (color1, color2) => {
  if (!color1 || !color2) return false;
  const norm1 = normalizeColorValue(color1);
  const norm2 = normalizeColorValue(color2);
  return norm1 === norm2;
};

const convertThemeColorElementsToStroke = (rootElement, themeStrokeColor) => {
  if (!rootElement?.querySelectorAll || !themeStrokeColor) return;

  const elements = rootElement.querySelectorAll("*");
  elements.forEach((node) => {
    // Перевіряємо stroke атрибут
    const strokeAttr = node.getAttribute("stroke");
    if (strokeAttr && colorsMatch(strokeAttr, themeStrokeColor)) {
      // Замінюємо на бірюзовий колір
      node.setAttribute("stroke", TEXT_STROKE_COLOR);
      
      // Видаляємо fill, залишаємо тільки контур
      node.setAttribute("fill", "none");
      
      // Додаємо властивості для кращого відображення
      if (!node.getAttribute("stroke-width")) {
        node.setAttribute("stroke-width", "1");
      }
      node.setAttribute("stroke-linejoin", "round");
      node.setAttribute("stroke-linecap", "round");
    }
    
    // Перевіряємо fill атрибут
    const fillAttr = node.getAttribute("fill");
    if (fillAttr && colorsMatch(fillAttr, themeStrokeColor)) {
      // Конвертуємо fill в stroke
      node.setAttribute("stroke", TEXT_STROKE_COLOR);
      node.setAttribute("fill", "none");
      
      if (!node.getAttribute("stroke-width")) {
        node.setAttribute("stroke-width", "1");
      }
      node.setAttribute("stroke-linejoin", "round");
      node.setAttribute("stroke-linecap", "round");
    }
    
    // Перевіряємо style атрибут
    const styleAttr = node.getAttribute("style");
    if (styleAttr) {
      let updated = styleAttr;
      let hasThemeColor = false;
      
      // Шукаємо stroke або fill з кольором теми в style
      const strokeMatch = styleAttr.match(/stroke\s*:\s*([^;]+)/i);
      if (strokeMatch && colorsMatch(strokeMatch[1], themeStrokeColor)) {
        updated = updated.replace(/stroke\s*:\s*[^;]+/gi, `stroke: ${TEXT_STROKE_COLOR}`);
        hasThemeColor = true;
      }
      
      const fillMatch = styleAttr.match(/fill\s*:\s*([^;]+)/i);
      if (fillMatch && colorsMatch(fillMatch[1], themeStrokeColor)) {
        updated = updated.replace(/fill\s*:\s*[^;]+/gi, `fill: none`);
        if (!updated.includes("stroke:")) {
          updated += `; stroke: ${TEXT_STROKE_COLOR}`;
        }
        hasThemeColor = true;
      }
      
      if (hasThemeColor) {
        if (!updated.includes("stroke-width:")) {
          updated += `; stroke-width: 1`;
        }
        updated += `; stroke-linejoin: round; stroke-linecap: round`;
        node.setAttribute("style", updated);
      }
    }
  });
};

const recolorStrokeAttributes = (rootElement) => {
  if (!rootElement?.querySelectorAll) return;

  const elements = rootElement.querySelectorAll("*");
  elements.forEach((node) => {
    const strokeAttr = node.getAttribute("stroke");
    if (strokeAttr && shouldRecolorStroke(strokeAttr)) {
      node.setAttribute("stroke", OUTLINE_STROKE_COLOR);
    }

    const styleAttr = node.getAttribute("style");
    if (styleAttr) {
      const updated = styleAttr.replace(
        BLACK_STROKE_STYLE_PATTERN,
        `$1${OUTLINE_STROKE_COLOR}`
      );
      if (updated !== styleAttr) {
        node.setAttribute("style", updated);
      }
    }
  });
};

const convertTextToStrokeOnly = (rootElement) => {
  if (!rootElement?.querySelectorAll) return;

  const textElements = rootElement.querySelectorAll("text, tspan");
  textElements.forEach((textNode) => {
    // Зберігаємо оригінальний fill або встановлюємо чорний за замовчуванням
    const currentFill = textNode.getAttribute("fill");
    if (!currentFill || currentFill === "none") {
      textNode.setAttribute("fill", "#000000");
    }
    
    // Встановлюємо stroke (обводку) з кольором #008181
    textNode.setAttribute("stroke", TEXT_STROKE_COLOR);
    
    // Встановлюємо ширину обводки
    textNode.setAttribute("stroke-width", "1.5");
    
    // Додаємо додаткові властивості для кращого відображення
    textNode.setAttribute("stroke-linejoin", "round");
    textNode.setAttribute("stroke-linecap", "round");
  });
};const buildPlacementPreview = (placement) => {
  const { svg, preview } = placement || {};

  if (svg && typeof window !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, "image/svg+xml");
      const svgElement = doc.documentElement.cloneNode(true);

      const rawWidth = parseFloat(svgElement.getAttribute("width"));
      const rawHeight = parseFloat(svgElement.getAttribute("height"));
      const hasViewBox = !!svgElement.getAttribute("viewBox");

      if (hasViewBox) {
        const viewBoxParts = svgElement
          .getAttribute("viewBox")
          .split(/[\s,]+/)
          .map((value) => parseFloat(value))
          .filter((value) => Number.isFinite(value));

        if (viewBoxParts.length === 4) {
          const [minX, minY, vbWidth, vbHeight] = viewBoxParts;
          if ((minX !== 0 || minY !== 0) && Number.isFinite(minX) && Number.isFinite(minY)) {
            const ns = svgElement.namespaceURI || "http://www.w3.org/2000/svg";
            const wrapper = doc.createElementNS(ns, "g");

            const nodesToWrap = Array.from(svgElement.childNodes).filter((node) => {
              if (node.nodeType !== 1) return false;
              const tag = node.nodeName.toLowerCase();
              return tag !== "defs" && tag !== "style" && tag !== "title" && tag !== "desc" && tag !== "metadata";
            });

            nodesToWrap.forEach((node) => {
              wrapper.appendChild(node);
            });

            if (nodesToWrap.length > 0) {
              wrapper.setAttribute("transform", `translate(${-minX},${-minY})`);
              svgElement.appendChild(wrapper);
            }

            svgElement.setAttribute("viewBox", `0 0 ${vbWidth} ${vbHeight}`);
          }
        }
      }

      if (!hasViewBox) {
        const intrinsicWidth = Number.isFinite(rawWidth)
          ? rawWidth
          : placement.sourceWidth || placement.width;
        const intrinsicHeight = Number.isFinite(rawHeight)
          ? rawHeight
          : placement.sourceHeight || placement.height;
        svgElement.setAttribute("viewBox", `0 0 ${intrinsicWidth} ${intrinsicHeight}`);
      }

      if (!svgElement.getAttribute("preserveAspectRatio")) {
        svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
      }

      const exportElement = svgElement.cloneNode(true);

      const viewBoxParts = exportElement
        .getAttribute("viewBox")
        ?.split(/[\s,]+/)
        .map((value) => parseFloat(value))
        .filter((value) => Number.isFinite(value));

      if (viewBoxParts && viewBoxParts.length === 4) {
        const [, , vbWidth, vbHeight] = viewBoxParts;
        convertPercentagesToAbsolute(exportElement, {
          width: vbWidth,
          height: vbHeight,
        });
      }

      // Конвертуємо елементи з кольором теми в бірюзовий stroke
      if (placement.themeStrokeColor) {
        convertThemeColorElementsToStroke(exportElement, placement.themeStrokeColor);
      }
      
      recolorStrokeAttributes(exportElement);
      convertTextToStrokeOnly(exportElement);

      const previewElement = svgElement.cloneNode(true);
      previewElement.setAttribute("width", "100%");
      previewElement.setAttribute("height", "100%");
      
      // Конвертуємо елементи з кольором теми для preview також
      if (placement.themeStrokeColor) {
        convertThemeColorElementsToStroke(previewElement, placement.themeStrokeColor);
      }
      
      recolorStrokeAttributes(previewElement);
      convertTextToStrokeOnly(previewElement);

      const serializer = new XMLSerializer();
      const exportMarkup = serializer.serializeToString(exportElement);
      const previewMarkup = serializer.serializeToString(previewElement);
      const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewMarkup)}`;

      return {
        type: "svg",
        url: dataUri,
        exportMarkup,
        fileName: `${placement.baseId || placement.id}.svg`,
      };
    } catch (error) {
      console.error("Не вдалося підготувати SVG для попереднього перегляду", error);
    }
  }

  if (preview) {
    return { type: "png", url: preview };
  }

  return null;
};

const LayoutPlannerModal = ({ isOpen, onClose, designs = [], spacingMm = 5 }) => {
  const [formatKey, setFormatKey] = useState("A4");
  const [orientation, setOrientation] = useState("portrait");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setOrientation("portrait");
      setFormatKey("A4");
    }
  }, [isOpen]);

  const sheetSize = useMemo(() => {
    const base = FORMATS[formatKey] || FORMATS.A4;
    if (orientation === "landscape") {
      return { width: base.height, height: base.width };
    }
    return base;
  }, [formatKey, orientation]);

  const normalizedItems = useMemo(() => normalizeDesigns(designs), [designs]);

  const { sheets, leftovers } = useMemo(
    () => planSheets(normalizedItems, sheetSize, spacingMm),
    [normalizedItems, sheetSize, spacingMm]
  );

  const sheetArea = sheetSize.width * sheetSize.height;
  const totalUsedArea = sheets.reduce((acc, sheet) => acc + sheet.usedArea, 0);
  const sheetsCount = sheets.length;
  const coverage = sheetsCount > 0 ? Math.round((totalUsedArea / (sheetArea * sheetsCount)) * 100) : 0;
  const totalRequestedCopies = useMemo(
    () => normalizedItems.reduce((acc, item) => acc + Math.max(1, item.copies || 0), 0),
    [normalizedItems]
  );
  const placedCopies = sheets.reduce((acc, sheet) => acc + sheet.placements.length, 0);
  const leftoverCopies = leftovers.length;
  const nothingToPlace = totalRequestedCopies === 0;

  const handleExportPdf = useCallback(async () => {
    if (!sheets.length || isExporting) return;

    if (typeof fetch !== "function") {
      console.error("Експорт PDF потребує підтримки fetch у браузері.");
      return;
    }

    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
      const sheetLabel = FORMATS[formatKey]?.label || "sheet";
      const zip = new JSZip();

      const preparedSheets = sheets.map((sheet, sheetIndex) => {
        const placements = sheet.placements.map((placement) => {
          const previewData = buildPlacementPreview(placement);

          if (previewData?.type === "svg" && previewData.exportMarkup) {
            try {
              const fileName = previewData.fileName || `${placement.baseId || placement.id}.svg`;
              zip.file(fileName, previewData.exportMarkup);
            } catch (zipError) {
              console.error("Не вдалося додати SVG у ZIP", zipError);
            }
          }

          return {
            id: placement.id,
            baseId: placement.baseId,
            name: placement.name,
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            copyIndex: placement.copyIndex ?? 1,
            copies: placement.copies ?? 1,
            svgMarkup: previewData?.type === "svg" ? previewData.exportMarkup : null,
          };
        });

        return {
          index: sheetIndex,
          width: sheet.width,
          height: sheet.height,
          placements,
        };
      });

      const exportEndpoint = import.meta.env.VITE_LAYOUT_EXPORT_URL || "/api/layout-pdf";
      const response = await fetch(exportEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sheetLabel,
          timestamp,
          formatKey,
          spacingMm,
          sheets: preparedSheets,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `Export server error: ${response.status}`);
      }

      const pdfBlob = await response.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `layout-${sheetLabel}-${timestamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);

      const hasSvgExports = Object.keys(zip.files || {}).length > 0;
      if (hasSvgExports) {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipUrl = URL.createObjectURL(zipBlob);

        const svgLink = document.createElement("a");
        svgLink.href = zipUrl;
        svgLink.download = `layout-${sheetLabel}-${timestamp}-svg.zip`;
        document.body.appendChild(svgLink);
        svgLink.click();
        document.body.removeChild(svgLink);

        setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
      }
    } catch (error) {
      console.error("Failed to export PDF", error);
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert("Не вдалося зберегти PDF. Переконайтеся, що сервер експорту запущено та доступний.");
      }
    } finally {
      setIsExporting(false);
    }
  }, [formatKey, isExporting, sheets, spacingMm]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2>План друку полотен</h2>
            <p className={styles.subtitle}>
              Формат {FORMATS[formatKey]?.label} · проміжок між полотнами {spacingMm} мм · {ORIENTATION_LABELS[orientation]}
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Закрити">
            ×
          </button>
        </div>

        <div className={styles.controls}>
          <label className={styles.controlGroup}>
            <span>Формат аркуша</span>
            <select value={formatKey} onChange={(event) => setFormatKey(event.target.value)}>
              {Object.entries(FORMATS).map(([key, format]) => (
                <option key={key} value={key}>
                  {format.label} · {format.width}×{format.height} мм
                </option>
              ))}
            </select>
          </label>

          <div className={styles.controlGroup}>
            <span>Орієнтація</span>
            <div className={styles.orientationToggle}>
              {(["portrait", "landscape"]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value === orientation ? styles.orientationActive : ""}
                  onClick={() => setOrientation(value)}
                >
                  {ORIENTATION_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.summary}>
            <strong>{sheetsCount || 0}</strong> арк.
            <span>
              · розміщено <strong>{placedCopies}</strong>
              {totalRequestedCopies ? ` / ${totalRequestedCopies}` : ""}
            </span>
            <span>
              · залишок <strong>{leftoverCopies}</strong>
            </span>
            <span>
              · заповнення ≈ <strong>{coverage || 0}%</strong>
            </span>
          </div>

          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExportPdf}
            disabled={!sheetsCount || isExporting}
          >
            {isExporting ? "Готуємо PDF…" : "Завантажити PDF"}
          </button>
        </div>

        <div className={styles.body}>
          {sheetsCount === 0 ? (
            <div className={styles.emptyState}>
              {nothingToPlace
                ? "Немає полотен для розміщення."
                : "Жодна копія не вмістилася у вибраний формат. Спробуйте більший аркуш або зменште відступи."}
            </div>
          ) : (
            <div className={styles.sheetList}>
              {sheets.map((sheet, sheetIndex) => {
                const scale = Math.min(1, 340 / Math.max(sheet.width, sheet.height));
                return (
                  <div key={`sheet-${sheetIndex}`} className={styles.sheetCard}>
                    <div className={styles.sheetHeader}>
                      <h3>Аркуш {sheetIndex + 1}</h3>
                      <span>
                        {sheet.width}×{sheet.height} мм · заповнення {Math.round((sheet.usedArea / sheetArea) * 100)}%
                      </span>
                    </div>
                    <div
                      className={styles.sheetPreview}
                      style={{
                        width: `${sheet.width * scale}px`,
                        height: `${sheet.height * scale}px`,
                      }}
                    >
                      {sheet.placements.map((placement) => {
                        const previewData = buildPlacementPreview(placement);
                        const hasPreview = !!previewData;

                        return (
                          <div
                            key={`${placement.id}-${placement.x}-${placement.y}`}
                            className={styles.placement}
                            style={{
                              width: `${placement.width * scale}px`,
                              height: `${placement.height * scale}px`,
                              left: `${placement.x * scale}px`,
                              top: `${placement.y * scale}px`,
                            }}
                          >
                            <div className={styles.placementPreview}>
                              {hasPreview ? (
                                <img
                                  src={previewData?.url}
                                  alt={placement.name || "Полотно"}
                                />
                              ) : (
                                <span className={styles.placementPlaceholder}>SVG відсутній</span>
                              )}
                            </div>
                            <div className={styles.placementMeta}>
                              <span className={styles.placementName}>{placement.name}</span>
                              <span className={styles.placementSize}>
                                {round1(placement.width)}×{round1(placement.height)} мм
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {leftovers.length > 0 ? (
          <div className={styles.leftovers}>
            <h4>Не помістилося ({leftovers.length})</h4>
            <ul>
              {leftovers.map((item) => (
                <li key={item.id}>
                  {item.label || item.name}
                  {item.copies > 1
                    ? ` (копія ${item.copyIndex ?? 1}/${item.copies})`
                    : ""}
                  : {round1(item.widthMm)}×{round1(item.heightMm)} мм
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LayoutPlannerModal;
