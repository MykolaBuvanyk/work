import React, { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import * as paperNamespace from "paper";
import * as ClipperLibNamespace from "clipper-lib";
import paper from "paper";
import Shape from "clipper-js";
import styles from "./LayoutPlannerModal.module.css";

const PX_PER_MM = 72 / 25.4;

const CUSTOM_BORDER_DEFAULT_EXPORT_COLOR = "#008181";
const CUSTOM_BORDER_DEFAULT_FILL = "none";

const extractCustomBorderMetadata = (design = {}) => {
  if (design?.customBorder && typeof design.customBorder === "object") {
    return design.customBorder;
  }

  const jsonTemplate =
    design?.jsonTemplate || design?.json || design?.meta?.jsonTemplate || null;

  if (!jsonTemplate || !Array.isArray(jsonTemplate?.objects)) {
    return null;
  }

  const borderObject =
    jsonTemplate.objects.find(
      (obj) => obj?.isBorderShape && obj?.cardBorderMode === "custom"
    ) || jsonTemplate.objects.find((obj) => obj?.isBorderShape);

  if (!borderObject) {
    return null;
  }

  const exportStrokeColor =
    typeof borderObject.cardBorderExportStrokeColor === "string" &&
    borderObject.cardBorderExportStrokeColor
      ? borderObject.cardBorderExportStrokeColor
      : borderObject.cardBorderMode === "custom"
      ? CUSTOM_BORDER_DEFAULT_EXPORT_COLOR
      : borderObject.stroke || null;

  const displayStrokeColor =
    typeof borderObject.cardBorderDisplayStrokeColor === "string" &&
    borderObject.cardBorderDisplayStrokeColor
      ? borderObject.cardBorderDisplayStrokeColor
      : borderObject.stroke || null;

  const exportFillRaw =
    borderObject.cardBorderExportFill !== undefined
      ? borderObject.cardBorderExportFill
      : borderObject.cardBorderMode === "custom"
      ? CUSTOM_BORDER_DEFAULT_FILL
      : borderObject.fill ?? null;

  const exportFill =
    typeof exportFillRaw === "string" && exportFillRaw.trim() !== ""
      ? exportFillRaw
      : borderObject.cardBorderMode === "custom"
      ? CUSTOM_BORDER_DEFAULT_FILL
      : exportFillRaw;

  const thicknessPx = Number(borderObject.cardBorderThicknessPx);

  return {
    mode: borderObject.cardBorderMode || "default",
    exportStrokeColor,
    displayStrokeColor,
    exportFill,
    elementId:
      typeof borderObject.id === "string" && borderObject.id
        ? borderObject.id
        : null,
    thicknessPx: Number.isFinite(thicknessPx) ? thicknessPx : null,
  };
};

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
const PREVIEW_OUTLINE_COLOR = "#0000FF";
const OUTLINE_STROKE_COLOR = LAYOUT_OUTLINE_COLOR;
const TEXT_STROKE_COLOR = "#008181";
// const BLACK_STROKE_VALUES = new Set(["#000", "#000000", "black", "rgb(0,0,0)", "rgba(0,0,0,1)", "#000000ff"]);
// const BLACK_STROKE_STYLE_PATTERN = /(stroke\s*:\s*)(#000(?:000)?|black|rgb\(0\s*,\s*0\s*,\s*0\)|rgba\(0\s*,\s*0\s*,\s*0\s*,\s*1\))/gi;
const CUT_FLAG_ATTRIBUTE = "data-shape-cut";
const CUT_TYPE_ATTRIBUTE = "data-shape-cut-type";
const CUT_FLAG_SELECTOR = `[${CUT_FLAG_ATTRIBUTE}="true"]`;
const HOLE_CUT_TYPE = "hole";
const HOLE_ID_PREFIX = "hole-";
const HOLE_STROKE_COLOR = "#FD7714";
const HOLE_FILL_COLOR = "#FFFFFF";
const HOLE_SHAPE_TAGS = [
  "path",
  "rect",
  "circle",
  "ellipse",
  "polygon",
  "polyline",
  "line",
];
const HOLE_DATA_SELECTOR = `[${CUT_TYPE_ATTRIBUTE}="${HOLE_CUT_TYPE}"]`;
const HOLE_ID_SELECTOR = `[id^="${HOLE_ID_PREFIX}"]`;
const HOLE_NODE_SELECTOR = `${HOLE_DATA_SELECTOR}, ${HOLE_ID_SELECTOR}`;
const HOLE_SHAPE_QUERY = HOLE_SHAPE_TAGS.join(", ");
const BACKGROUND_ATTR = "data-layout-background";

const paperLib = paperNamespace?.default ?? paperNamespace;
const ClipperLib = ClipperLibNamespace?.default ?? ClipperLibNamespace;

const CLIPPER_SCALE = 100;
const CONTOUR_STROKE_WIDTH_PX = 1;
const GEOMETRY_ATTRIBUTES_TO_SKIP = new Set([
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "rx",
  "ry",
  "r",
  "cx",
  "cy",
  "points",
  "d",
  "transform",
  "pathLength",
]);

let cachedPaperScope = null;

const ensurePaperScope = () => {
  if (
    !paperLib ||
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return null;
  }
  if (cachedPaperScope) {
    return cachedPaperScope;
  }
  try {
    const scope = new paperLib.PaperScope();
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    scope.setup(canvas);
    cachedPaperScope = scope;
    return scope;
  } catch (error) {
    console.warn("Paper.js scope init failed", error);
    cachedPaperScope = null;
    return null;
  }
};

const gatherPathItems = (scope, item, acc = []) => {
  if (!item) return acc;
  if (item instanceof scope.Path) {
    acc.push(item);
    return acc;
  }
  if (item instanceof scope.CompoundPath) {
    item.children.forEach((child) => gatherPathItems(scope, child, acc));
    return acc;
  }
  if (item.children && item.children.length) {
    item.children.forEach((child) => gatherPathItems(scope, child, acc));
  }
  return acc;
};

const pathItemToClipperInput = (scope, pathItem) => {
  if (!pathItem || !ClipperLib) return null;
  const clone = pathItem.clone({ insert: false });
  clone.closed = true;
  if (clone.clockwise === false) {
    clone.reverse();
  }
  const hasCurves =
    Array.isArray(pathItem.curves) &&
    pathItem.curves.some((curve) => !curve.isStraight());
  const flattenTolerance = hasCurves ? 0.05 : 0.2;
  clone.flatten(flattenTolerance);
  const clipperPath = clone.segments.map((segment) => ({
    X: Math.round(segment.point.x * CLIPPER_SCALE),
    Y: Math.round(segment.point.y * CLIPPER_SCALE),
  }));
  clone.remove();
  if (clipperPath.length < 3) {
    return null;
  }
  const first = clipperPath[0];
  const last = clipperPath[clipperPath.length - 1];
  if (first && last && first.X === last.X && first.Y === last.Y) {
    clipperPath.pop();
  }
  return {
    clipperPath,
    hasCurves,
    joinType: hasCurves
      ? ClipperLib.JoinType.jtRound
      : ClipperLib.JoinType.jtMiter,
  };
};

const buildInnerContourPathData = (scope, shapeNode, offsetDistancePx) => {
  if (!scope || !ClipperLib || !ClipperLib.ClipperOffset) return null;
  if (!Number.isFinite(offsetDistancePx) || offsetDistancePx <= 0) return null;

  try {
    scope.project.clear();
    const clone = shapeNode.cloneNode(true);
    const imported = scope.project.importSVG(clone, {
      applyMatrix: true,
      expandShapes: true,
      insert: true,
    });

    if (!imported) {
      scope.project.clear();
      return null;
    }

    const pathItems = gatherPathItems(scope, imported);
    if (!pathItems.length) {
      scope.project.clear();
      return null;
    }

    const clipperInputs = pathItems
      .map((pathItem) => pathItemToClipperInput(scope, pathItem))
      .filter(Boolean);

    if (!clipperInputs.length) {
      scope.project.clear();
      return null;
    }

    const arcTolerance = clipperInputs.some((entry) => entry.hasCurves)
      ? 0.05
      : 0.25;
    const offsetter = new ClipperLib.ClipperOffset(2, arcTolerance);

    clipperInputs.forEach((entry) => {
      offsetter.AddPath(
        entry.clipperPath,
        entry.joinType,
        ClipperLib.EndType.etClosedPolygon
      );
    });

    const offsetAmount = -offsetDistancePx * CLIPPER_SCALE;
    const solution = ClipperLib.Paths ? new ClipperLib.Paths() : [];
    offsetter.Execute(solution, offsetAmount);

    if (!solution.length) {
      scope.project.clear();
      return null;
    }

    const children = solution
      .map((poly) => {
        if (!poly?.length) return null;
        const points = poly.map(
          (point) =>
            new scope.Point(point.X / CLIPPER_SCALE, point.Y / CLIPPER_SCALE)
        );
        if (points.length < 3) return null;
        return new scope.Path({
          segments: points,
          closed: true,
          insert: true,
        });
      })
      .filter(Boolean);

    if (!children.length) {
      scope.project.clear();
      return null;
    }

    let offsetItem = null;
    if (children.length === 1) {
      offsetItem = children[0];
    } else {
      offsetItem = new scope.CompoundPath();
      children.forEach((child) => offsetItem.addChild(child));
    }

    const exported = offsetItem.exportSVG({ asString: false, precision: 6 });
    const pathData = exported?.getAttribute?.("d") || null;

    scope.project.clear();
    return pathData;
  } catch (error) {
    console.warn("Clipper offset failed", error);
    try {
      scope.project.clear();
    } catch {}
    return null;
  }
};

const sanitizeInnerContourStyle = (node) => {
  if (!node) return;
  const styleAttr = node.getAttribute("style");
  if (!styleAttr) return;

  const filtered = styleAttr
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      if (/^fill\s*:/i.test(part)) return false;
      if (/^stroke-width\s*:/i.test(part)) return false;
      if (/^transform\s*:/i.test(part)) return false;
      if (/^stroke\s*:\s*none/i.test(part)) return false;
      if (/^stroke-opacity\s*:/i.test(part)) return false;
      return true;
    });

  if (filtered.length) {
    node.setAttribute("style", filtered.join("; "));
  } else {
    node.removeAttribute("style");
  }
};

const applyContourStrokeWidth = (node, recursive = false) => {
  if (!node) return;

  const setWidth = (target) => {
    if (!target) return;
    target.setAttribute("stroke-width", CONTOUR_STROKE_WIDTH_PX.toString());
    target.setAttribute("vector-effect", "non-scaling-stroke");
    const styleAttr = target.getAttribute("style");
    if (!styleAttr) return;
    const filtered = styleAttr
      .split(";")
      .map((part) => part.trim())
      .filter((part) => part && !/^stroke-width\s*:/i.test(part));
    if (filtered.length) {
      target.setAttribute("style", filtered.join("; "));
    } else {
      target.removeAttribute("style");
    }
  };

  setWidth(node);

  if (!recursive) {
    return;
  }

  const shapeTags = new Set([
    "path",
    "rect",
    "circle",
    "ellipse",
    "polygon",
    "polyline",
    "line",
  ]);
  Array.from(node.children || []).forEach((child) => {
    if (!child || child.nodeType !== 1) return;
    const tag = child.nodeName?.toLowerCase?.();
    if (tag === "g") {
      applyContourStrokeWidth(child, true);
      return;
    }
    if (shapeTags.has(tag)) {
      setWidth(child);
    }
  });
};

const extractStyleColor = (styleAttr, property) => {
  if (!styleAttr || !property) return null;
  const lowerProp = property.toLowerCase();
  const parts = styleAttr.split(";");
  for (const part of parts) {
    if (!part) continue;
    const [prop, value] = part.split(":");
    if (!prop || !value) continue;
    if (prop.trim().toLowerCase() === lowerProp) {
      return value.trim();
    }
  }
  return null;
};

const isVisiblePaint = (value) => {
  if (!value) return false;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed === "none") return false;
  if (trimmed === "transparent") return false;
  if (trimmed === "rgba(0,0,0,0)") return false;
  if (trimmed === "hsla(0,0%,0%,0)") return false;
  return true;
};

const hasVisibleFillPaint = (node, styleAttr) => {
  if (!node || typeof node.getAttribute !== "function") return false;
  const directFill = node.getAttribute("fill");
  if (isVisiblePaint(directFill)) {
    return true;
  }
  const styleFill = extractStyleColor(
    styleAttr || node.getAttribute("style"),
    "fill"
  );
  return isVisiblePaint(styleFill);
};

const isNodeInsideCutShape = (node) => {
  if (!node) return false;

  if (
    typeof node.getAttribute === "function" &&
    node.getAttribute(CUT_FLAG_ATTRIBUTE) === "true"
  ) {
    return true;
  }

  if (typeof node.closest === "function") {
    const closest = node.closest(CUT_FLAG_SELECTOR);
    if (closest) {
      return true;
    }
  }

  let parent = node.parentNode;
  while (parent) {
    if (
      typeof parent.getAttribute === "function" &&
      parent.getAttribute(CUT_FLAG_ATTRIBUTE) === "true"
    ) {
      return true;
    }
    parent = parent.parentNode;
  }

  return false;
};

const stripHoleStyleOverrides = (node) => {
  if (!node || typeof node.getAttribute !== "function") return;
  const styleAttr = node.getAttribute("style");
  if (!styleAttr) return;
  const filtered = styleAttr
    .split(";")
    .map((part) => part.trim())
    .filter(
      (part) =>
        part &&
        !/^stroke\s*:/i.test(part) &&
        !/^fill\s*:/i.test(part) &&
        !/^stroke-width\s*:/i.test(part) &&
        !/^stroke-opacity\s*:/i.test(part) &&
        !/^fill-opacity\s*:/i.test(part)
    );

  if (filtered.length) {
    node.setAttribute("style", filtered.join("; "));
  } else {
    node.removeAttribute("style");
  }
};

const applyHoleAppearance = (node) => {
  if (!node || typeof node.setAttribute !== "function") return;
  stripHoleStyleOverrides(node);
  node.setAttribute("stroke", HOLE_STROKE_COLOR);
  node.setAttribute("fill", HOLE_FILL_COLOR);
  if (!node.getAttribute("stroke-width")) {
    node.setAttribute("stroke-width", "1");
  }
  node.setAttribute(
    "stroke-linejoin",
    node.getAttribute("stroke-linejoin") || "round"
  );
  node.setAttribute(
    "stroke-linecap",
    node.getAttribute("stroke-linecap") || "round"
  );
  node.setAttribute("fill-opacity", "1");
  node.setAttribute("stroke-opacity", "1");
};

const normalizeHoleShapes = (rootElement) => {
  if (!rootElement?.querySelectorAll) return;
  const nodes = rootElement.querySelectorAll(HOLE_NODE_SELECTOR);
  nodes.forEach((node) => {
    if (!node) return;
    const tagName = node.nodeName?.toLowerCase?.();
    if (tagName === "g" && typeof node.querySelectorAll === "function") {
      const targets = node.querySelectorAll(HOLE_SHAPE_QUERY);
      if (targets?.length) {
        targets.forEach((child) => applyHoleAppearance(child));
        return;
      }
    }
    applyHoleAppearance(node);
  });
};

const createInnerContourElement = (shapeNode, innerPathData) => {
  if (!shapeNode || !innerPathData) return null;
  if (typeof document === "undefined") return null;

  const ns = shapeNode.namespaceURI || "http://www.w3.org/2000/svg";
  const innerNode = document.createElementNS(ns, "path");

  Array.from(shapeNode.attributes || []).forEach(({ name, value }) => {
    if (name === "id") return;
    if (GEOMETRY_ATTRIBUTES_TO_SKIP.has(name)) return;
    innerNode.setAttribute(name, value);
  });

  const baseId = shapeNode.getAttribute("id");
  if (baseId) {
    innerNode.setAttribute("id", `${baseId}-inner`);
  }

  innerNode.setAttribute("d", innerPathData);
  innerNode.setAttribute("data-inner-contour", "true");
  innerNode.removeAttribute("data-inner-contour-added");
  innerNode.setAttribute("fill", "none");
  innerNode.removeAttribute("transform");

  sanitizeInnerContourStyle(innerNode);
  applyContourStrokeWidth(innerNode);

  innerNode.setAttribute("stroke", TEXT_STROKE_COLOR);
  innerNode.setAttribute("stroke-opacity", "1");
  if (!innerNode.getAttribute("stroke-linejoin")) {
    innerNode.setAttribute("stroke-linejoin", "round");
  }
  if (!innerNode.getAttribute("stroke-linecap")) {
    innerNode.setAttribute("stroke-linecap", "round");
  }

  return innerNode;
};
const TEXT_OUTLINE_WIDTH = 0.5; // Зменшено для тонших ліній
const TEXT_OUTLINE_HALF_WIDTH = TEXT_OUTLINE_WIDTH / 2;
const TEXT_OUTLINE_SCALE = 256;
const TEXT_OUTLINE_ROUND_PRECISION = 0.25;
const TEXT_OUTLINE_FLATTEN_TOLERANCE = 0.25;
const TEXT_OUTLINE_COORD_EPS = 1e-4;
const SVG_NS = "http://www.w3.org/2000/svg";
const BLACK_STROKE_VALUES = new Set([
  "#000",
  "#000000",
  "black",
  "rgb(0,0,0)",
  "rgba(0,0,0,1)",
  "#000000ff",
]);
const BLACK_STROKE_STYLE_PATTERN =
  /(stroke\s*:\s*)(#000(?:000)?|black|rgb\(0\s*,\s*0\s*,\s*0\)|rgba\(0\s*,\s*0\s*,\s*0\s*,\s*1\))/gi;

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

      const customBorder = extractCustomBorderMetadata(design);

      // Витягуємо strokeColor з toolbarState для відслідковування колірної теми
      const themeStrokeColor =
        design?.toolbarState?.globalColors?.strokeColor || null;

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
        customBorder,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const largestSideDiff =
        Math.max(b.widthMm, b.heightMm) - Math.max(a.widthMm, a.heightMm);
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
    if (
      orientation.width > sheetInnerWidth ||
      orientation.height > sheetInnerHeight
    ) {
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
      customBorder: item.customBorder || null,
    };

    row.items.push(placement);
    row.usedWidth = xOffset + orientation.width;
    sheet.placements.push(placement);
    sheet.usedArea += item.area;

    return true;
  };

  const tryPlaceOnNewRow = (sheet, item, orientation) => {
    if (
      orientation.width > sheetInnerWidth ||
      orientation.height > sheetInnerHeight
    ) {
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
      customBorder: item.customBorder || null,
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
      variants.push({
        width: item.heightMm,
        height: item.widthMm,
        rotated: true,
      });
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
        customBorder: item.customBorder || null,
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

const convertPercentAttributeValue = (
  attributeValue,
  totals,
  attributeName
) => {
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
    const converted = convertPercentAttributeValue(
      attribute.value,
      totals,
      attribute.name
    );
    if (converted !== null) {
      node.setAttribute(attribute.name, String(converted));
    }
  });

  Array.from(node.childNodes || []).forEach((child) => {
    convertPercentagesToAbsolute(child, totals);
  });
};

const addInnerContoursForShapes = (rootElement) => {
  if (!rootElement?.querySelectorAll) return;

  const scope = ensurePaperScope();
  if (!scope || !ClipperLib || !ClipperLib.ClipperOffset) {
    return;
  }

  const shapeNodes = rootElement.querySelectorAll('[id^="shape-"]');

  shapeNodes.forEach((shapeNode) => {
    try {
      if (
        !shapeNode ||
        shapeNode.getAttribute("data-inner-contour-added") === "true"
      ) {
        return;
      }

      const nodeId = shapeNode.getAttribute("id") || "";
      if (!nodeId || nodeId.endsWith("-inner")) {
        return;
      }

      const thicknessMmAttr = shapeNode.getAttribute("data-shape-thickness-mm");
      const thicknessData =
        shapeNode.getAttribute("data-shape-thickness-px") ||
        shapeNode.getAttribute("data-thickness-px") ||
        shapeNode.getAttribute("stroke-width");
      const styleAttr = shapeNode.getAttribute("style") || "";

      if (isNodeInsideCutShape(shapeNode)) {
        shapeNode.setAttribute("data-inner-contour-added", "true");
        return;
      }

      const hasFillAttr =
        shapeNode.getAttribute("data-shape-has-fill") === "true";
      const hasVisibleFill = hasVisibleFillPaint(shapeNode, styleAttr);

      if (hasFillAttr || hasVisibleFill) {
        shapeNode.setAttribute("data-inner-contour-added", "true");
        applyContourStrokeWidth(shapeNode, true);
        return;
      }

      const thicknessMmValue = thicknessMmAttr
        ? parseFloat(thicknessMmAttr)
        : NaN;
      let thicknessPx = Number.isFinite(thicknessMmValue)
        ? thicknessMmValue * PX_PER_MM
        : NaN;

      if (!Number.isFinite(thicknessPx) || thicknessPx <= 0) {
        thicknessPx = thicknessData ? parseFloat(thicknessData) : NaN;

        if (!Number.isFinite(thicknessPx) || thicknessPx <= 0) {
          const styleMatch = styleAttr.match(
            /stroke-width\s*:\s*([0-9.+-eE]+)\s*(px)?/i
          );
          if (styleMatch) {
            thicknessPx = parseFloat(styleMatch[1]);
          }
        }
      }

      if (!Number.isFinite(thicknessPx) || thicknessPx <= 0) {
        return;
      }

      // Відстань між контурами = точно thickness (без додавання товщини stroke)
      // LaserBurn працює з центром лінії, тому offset = thickness
      const offsetDistancePx = thicknessPx;
      const innerPathData = buildInnerContourPathData(scope, shapeNode, offsetDistancePx);
      if (!innerPathData) {
        return;
      }

      const innerNode = createInnerContourElement(shapeNode, innerPathData);
      if (!innerNode) {
        return;
      }

      shapeNode.setAttribute("data-inner-contour-added", "true");
      applyContourStrokeWidth(shapeNode, true);

      const parent = shapeNode.parentNode;
      if (parent) {
        parent.insertBefore(innerNode, shapeNode.nextSibling);
      }
    } catch (error) {
      console.warn("Не вдалося додати внутрішній контур для фігури", error);
    }
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
      if (
        Number(r) === 0 &&
        Number(g) === 0 &&
        Number(b) === 0 &&
        Number(a) !== 0
      ) {
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
      const [r, g, b] = numbers.map((n) => parseInt(n));
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
    if (isNodeInsideCutShape(node)) {
      return;
    }
    if (node.getAttribute("data-shape-has-fill") === "true") {
      return;
    }
    if (node.getAttribute(BACKGROUND_ATTR) === "true") {
      return;
    }
    const tagName = node?.tagName ? node.tagName.toLowerCase() : "";
    if (tagName === "text" || tagName === "tspan") {
      return;
    }

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
    const isPatternFill =
      typeof fillAttr === "string" &&
      fillAttr.trim().toLowerCase().startsWith("url(");
    if (fillAttr && !isPatternFill && colorsMatch(fillAttr, themeStrokeColor)) {
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
      if (
        strokeMatch &&
        strokeMatch[1] &&
        !strokeMatch[1].trim().toLowerCase().startsWith("url(") &&
        colorsMatch(strokeMatch[1], themeStrokeColor)
      ) {
        updated = updated.replace(
          /stroke\s*:\s*[^;]+/gi,
          `stroke: ${TEXT_STROKE_COLOR}`
        );
        hasThemeColor = true;
      }

      const fillMatch = styleAttr.match(/fill\s*:\s*([^;]+)/i);
      if (
        fillMatch &&
        fillMatch[1] &&
        !fillMatch[1].trim().toLowerCase().startsWith("url(") &&
        colorsMatch(fillMatch[1], themeStrokeColor)
      ) {
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

const GEOMETRY_TAG_SET = new Set(
  HOLE_SHAPE_TAGS.map((tag) => tag.toLowerCase())
);

const escapeCssIdentifier = (value = "") => {
  if (typeof value !== "string" || value === "") {
    return "";
  }
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
};

const normalizeFillForExport = (value) => {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return "none";
  }
  const lower = trimmed.toLowerCase();
  if (lower === "transparent") {
    return "none";
  }
  return trimmed;
};

const applyStrokeFillAttributes = (node, stroke, fill) => {
  if (!node || node.nodeType !== 1) return;

  const sanitizedFill = normalizeFillForExport(fill);

  if (stroke) {
    node.setAttribute("stroke", stroke);
  }

  if (sanitizedFill !== null) {
    node.setAttribute("fill", sanitizedFill);
  }

  const styleAttr = node.getAttribute("style");
  if (!styleAttr) {
    return;
  }

  const filtered = styleAttr
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((declaration) => {
      const lower = declaration.toLowerCase();
      if (stroke && lower.startsWith("stroke:")) {
        return false;
      }
      if (sanitizedFill !== null && lower.startsWith("fill:")) {
        return false;
      }
      return true;
    });

  if (filtered.length) {
    node.setAttribute("style", filtered.join("; "));
  } else {
    node.removeAttribute("style");
  }
};

const applyStrokeFillRecursive = (node, stroke, fill) => {
  if (!node || node.nodeType !== 1) return;

  const tag = node.nodeName?.toLowerCase?.() || "";
  if (GEOMETRY_TAG_SET.has(tag)) {
    applyStrokeFillAttributes(node, stroke, fill);
    if (!node.getAttribute("stroke-width")) {
      node.setAttribute("stroke-width", "1");
    }
    if (!node.getAttribute("stroke-linejoin")) {
      node.setAttribute("stroke-linejoin", "round");
    }
    if (!node.getAttribute("stroke-linecap")) {
      node.setAttribute("stroke-linecap", "round");
    }
    node.setAttribute("vector-effect", "non-scaling-stroke");
  }

  Array.from(node.children || []).forEach((child) =>
    applyStrokeFillRecursive(child, stroke, fill)
  );
};

const collectBorderCandidateNodes = (rootElement, metadata) => {
  if (!rootElement?.querySelectorAll) return [];
  const selectors = new Set();

  const appendSelector = (id) => {
    if (!id) return;
    const escaped = escapeCssIdentifier(id);
    if (escaped) {
      selectors.add(`[id="${escaped}"]`);
    }
  };

  appendSelector(metadata?.elementId);
  appendSelector("canvaShapeCustom");
  appendSelector("canvaShape");

  const nodes = [];
  selectors.forEach((selector) => {
    try {
      nodes.push(...rootElement.querySelectorAll(selector));
    } catch {
      // ignore selector issues silently
    }
  });

  return nodes;
};

const applyCustomBorderOverrides = (rootElement, metadata) => {
  if (!rootElement || !metadata) return;
  if (metadata.mode && metadata.mode !== "custom") return;

  const stroke = metadata.exportStrokeColor || TEXT_STROKE_COLOR;
  const fill =
    metadata.exportFill !== undefined && metadata.exportFill !== null
      ? metadata.exportFill
      : "none";

  const processed = new Set();
  const processNode = (node) => {
    if (!node || processed.has(node)) return;
    processed.add(node);
    applyStrokeFillRecursive(node, stroke, fill);
    node.setAttribute("data-export-border", metadata.mode || "custom");
  };

  const directMatches = collectBorderCandidateNodes(rootElement, metadata);
  directMatches.forEach(processNode);

  if (processed.size) {
    return;
  }

  const candidates = rootElement.querySelectorAll(HOLE_SHAPE_TAGS.join(", "));

  Array.from(candidates).forEach((node) => {
    const strokeAttr = node.getAttribute("stroke");
    const styleAttr = node.getAttribute("style");
    const styleStroke = extractStyleColor(styleAttr, "stroke");

    const matchesStroke =
      (strokeAttr && colorsMatch(strokeAttr, metadata.displayStrokeColor)) ||
      (styleStroke && colorsMatch(styleStroke, metadata.displayStrokeColor));

    if (matchesStroke) {
      processNode(node);
    }
  });
};

const recolorStrokeAttributes = (
  rootElement,
  outlineColor = OUTLINE_STROKE_COLOR
) => {
  if (!rootElement?.querySelectorAll) return;

  const elements = rootElement.querySelectorAll("*");
  elements.forEach((node) => {
    if (isNodeInsideCutShape(node)) {
      return;
    }
    if (node.getAttribute("data-shape-has-fill") === "true") {
      return;
    }
    if (node.getAttribute(BACKGROUND_ATTR) === "true") {
      return;
    }
    const strokeAttr = node.getAttribute("stroke");
    if (strokeAttr && shouldRecolorStroke(strokeAttr)) {
      node.setAttribute("stroke", outlineColor);
    }

    const styleAttr = node.getAttribute("style");
    if (styleAttr) {
      const updated = styleAttr.replace(
        BLACK_STROKE_STYLE_PATTERN,
        `$1${outlineColor}`
      );
      if (updated !== styleAttr) {
        node.setAttribute("style", updated);
      }
    }
  });
};

const normalizeColorString = (value = "") =>
  String(value).trim().toLowerCase().replace(/\s+/g, "");

const isWhiteColorString = (value = "") => {
  const normalized = normalizeColorString(value);
  if (!normalized) return false;
  return (
    normalized === "#fff" ||
    normalized === "#ffffff" ||
    normalized === "white" ||
    normalized === "rgb(255,255,255)" ||
    normalized === "rgba(255,255,255,1)"
  );
};

const nodeHasWhiteFill = (node) => {
  if (!node || typeof node.getAttribute !== "function") return false;
  const fillAttr = node.getAttribute("fill");
  if (fillAttr && isWhiteColorString(fillAttr)) return true;
  const styleAttr = node.getAttribute("style") || "";
  const match = styleAttr.match(/fill\s*:\s*([^;]+)/i);
  if (match && isWhiteColorString(match[1])) return true;
  return false;
};

const stripStyleProperties = (styleAttr = "", properties = []) => {
  if (!styleAttr) return "";
  const props = properties.map((prop) => prop.toLowerCase());
  return styleAttr
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .filter((declaration) => {
      const [prop] = declaration.split(":");
      if (!prop) return false;
      return !props.includes(prop.trim().toLowerCase());
    })
    .join("; ");
};

const appendStyleDeclarations = (baseStyle = "", declarations = []) => {
  const filtered = declarations.filter((declaration) => Boolean(declaration));
  if (!baseStyle && !filtered.length) {
    return "";
  }
  if (!filtered.length) {
    return baseStyle;
  }
  return baseStyle
    ? `${baseStyle}; ${filtered.join("; ")}`
    : filtered.join("; ");
};

const approxEqual = (value, target, relative = 0.01, absolute = 0.5) => {
  if (!Number.isFinite(value) || !Number.isFinite(target)) return false;
  const tolerance = Math.max(absolute, Math.abs(target) * relative);
  return Math.abs(value - target) <= tolerance;
};

const approxZero = (value, reference) => {
  if (!Number.isFinite(value)) return false;
  const tolerance = Math.max(0.5, Math.abs(reference || 0) * 0.01);
  return Math.abs(value) <= tolerance;
};

const markCanvasBackgrounds = (rootElement, dims = {}) => {
  if (!rootElement?.querySelectorAll) return;
  const { width, height } = dims;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return;
  }

  const rects = Array.from(rootElement.querySelectorAll("rect"));
  rects.forEach((rect) => {
    const rectWidth = parseFloat(rect.getAttribute("width"));
    const rectHeight = parseFloat(rect.getAttribute("height"));
    if (!approxEqual(rectWidth, width) || !approxEqual(rectHeight, height)) {
      return;
    }

    const rawX = rect.getAttribute("x") ?? rect.getAttribute("left") ?? "0";
    const rawY = rect.getAttribute("y") ?? rect.getAttribute("top") ?? "0";
    const x = parseFloat(rawX);
    const y = parseFloat(rawY);

    if (
      !approxZero(Number.isFinite(x) ? x : 0, width) ||
      !approxZero(Number.isFinite(y) ? y : 0, height)
    ) {
      return;
    }

    rect.setAttribute(BACKGROUND_ATTR, "true");
    rect.setAttribute("stroke", "none");
    rect.removeAttribute("stroke-width");
  });
};

/**
 * Видаляє всі фонові елементи (rect з data-layout-background="true") з SVG для експорту PDF
 * @param {Element} rootElement - кореневий SVG елемент
 */
const removeBackgroundsForExport = (rootElement) => {
  if (!rootElement?.querySelectorAll) return;
  
  // Видаляємо елементи з атрибутом data-layout-background="true"
  const backgrounds = Array.from(rootElement.querySelectorAll(`[${BACKGROUND_ATTR}="true"]`));
  backgrounds.forEach((bg) => {
    bg.parentNode?.removeChild(bg);
  });
  
  // Також видаляємо всі rect які мають білий fill і покривають весь canvas
  // (можуть бути фони які не були помічені)
  const rects = Array.from(rootElement.querySelectorAll("rect"));
  rects.forEach((rect) => {
    const fill = rect.getAttribute("fill") || "";
    const fillLower = fill.toLowerCase().trim();
    
    // Перевіряємо чи це білий або прозорий фон
    const isWhiteFill = 
      fillLower === "#fff" || 
      fillLower === "#ffffff" || 
      fillLower === "white" ||
      fillLower === "rgb(255,255,255)" ||
      fillLower === "rgba(255,255,255,1)";
    
    // Якщо немає stroke і fill білий - ймовірно це фон
    const stroke = rect.getAttribute("stroke");
    const hasNoStroke = !stroke || stroke === "none" || stroke === "transparent";
    
    if (isWhiteFill && hasNoStroke) {
      rect.parentNode?.removeChild(rect);
    }
  });
};

const filterBarcodeRects = (rects) => {
  if (!Array.isArray(rects) || rects.length === 0) {
    return [];
  }
  const widths = rects
    .map((rect) => parseFloat(rect.getAttribute("width") || "0"))
    .filter((value) => Number.isFinite(value) && value > 0);
  const minWidth = widths.length ? Math.min(...widths) : null;
  const widthThreshold = Number.isFinite(minWidth) ? minWidth * 4 : Infinity;
  return rects.filter((rect) => {
    if (rect?.getAttribute && rect.getAttribute(BACKGROUND_ATTR) === "true") {
      return false;
    }
    const width = parseFloat(rect.getAttribute("width") || "0");
    if (!Number.isFinite(width) || width <= 0) return false;
    if (widthThreshold !== Infinity && width > widthThreshold) return false;
    return true;
  });
};

const collectBarcodeRectDescendants = (node) => {
  if (!node || node.nodeType !== 1) return [];
  if (typeof node.querySelectorAll === "function") {
    return Array.from(node.querySelectorAll("rect"));
  }
  const stack = Array.from(node.childNodes || []);
  const result = [];
  while (stack.length) {
    const current = stack.pop();
    if (!current || current.nodeType !== 1) continue;
    if ((current.nodeName || "").toLowerCase() === "rect") {
      result.push(current);
      continue;
    }
    if (current.childNodes && current.childNodes.length) {
      stack.push(...current.childNodes);
    }
  }
  return result;
};

// Heuristic: detect JsBarcode-like groups and convert their rects to stroke-only
const isLikelyBarcodeGroupPreview = (node) => {
  if (!node || node.nodeType !== 1) return false;
  const tag = (node.nodeName || "").toLowerCase();
  if (tag !== "g" && tag !== "svg") return false;
  const rects = collectBarcodeRectDescendants(node);
  if (rects.length < 12) return false;
  const heights = [];
  const widths = [];
  for (const r of rects) {
    const w = parseFloat(r.getAttribute("width"));
    const h = parseFloat(r.getAttribute("height"));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0)
      return false;
    widths.push(w);
    heights.push(h);
  }
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  if (maxH === 0) return false;
  if ((maxH - minH) / maxH > 0.05) return false;
  const avgW = widths.reduce((a, b) => a + b, 0) / widths.length;
  if (maxH / avgW < 2) return false;
  return true;
};

const BARCODE_STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
];

const BARCODE_OUTLINE_COLOR = TEXT_STROKE_COLOR;
const BARCODE_OUTLINE_WIDTH = 1;
const BARCODE_OUTLINE_MIN_WIDTH = 0.3;

const outlineBarcodeRects = (rootElement) => {
  if (!rootElement) return;

  let outlinedGroups = 0;

  const walk = (node) => {
    if (!node || node.nodeType !== 1) return;

    if (isLikelyBarcodeGroupPreview(node)) {
      const rects = filterBarcodeRects(collectBarcodeRectDescendants(node));
      if (rects.length) {
        outlinedGroups += 1;
        rects.forEach((rect) => {
          const rectWidth = parseFloat(rect.getAttribute("width") || "0");
          const maxByRectWidth =
            Number.isFinite(rectWidth) && rectWidth > 0
              ? rectWidth * 0.5
              : BARCODE_OUTLINE_WIDTH;

          let outlineWidth = BARCODE_OUTLINE_WIDTH;
          if (Number.isFinite(maxByRectWidth) && maxByRectWidth > 0) {
            outlineWidth = Math.min(outlineWidth, maxByRectWidth);
          }
          if (!Number.isFinite(outlineWidth) || outlineWidth <= 0) {
            outlineWidth = BARCODE_OUTLINE_WIDTH;
          }
          outlineWidth = Math.max(outlineWidth, BARCODE_OUTLINE_MIN_WIDTH);
          if (
            Number.isFinite(maxByRectWidth) &&
            maxByRectWidth > BARCODE_OUTLINE_MIN_WIDTH
          ) {
            outlineWidth = Math.min(outlineWidth, maxByRectWidth);
          }

          rect.setAttribute("fill", "none");
          rect.setAttribute("fill-opacity", "0");
          rect.removeAttribute("fill-rule");
          rect.setAttribute("stroke", BARCODE_OUTLINE_COLOR);
          rect.setAttribute("stroke-width", String(outlineWidth));
          rect.setAttribute("stroke-linejoin", "round");
          rect.setAttribute("stroke-linecap", "round");
          rect.setAttribute("stroke-opacity", "1");

          const baseStyle = stripStyleProperties(
            rect.getAttribute("style") || "",
            BARCODE_STYLE_PROPS
          );
          const style = appendStyleDeclarations(baseStyle, [
            "fill: none",
            "fill-opacity: 0",
            `stroke: ${BARCODE_OUTLINE_COLOR}`,
            `stroke-width: ${outlineWidth}`,
            "stroke-linejoin: round",
            "stroke-linecap: round",
            "stroke-opacity: 1",
          ]);
          if (style) {
            rect.setAttribute("style", style);
          } else if (rect.hasAttribute("style")) {
            rect.removeAttribute("style");
          }
        });
      }
    }

    const children = node.childNodes || [];
    for (let i = 0; i < children.length; i += 1) {
      walk(children[i]);
    }
  };

  walk(rootElement);
  return outlinedGroups;
};

let textOutlineScope = null;

const ensureTextOutlineScope = () => {
  if (textOutlineScope) {
    return textOutlineScope;
  }
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const scope = new paper.PaperScope();
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    scope.setup(canvas);
    textOutlineScope = scope;
    return textOutlineScope;
  } catch (error) {
    console.error("Failed to setup Paper.js scope for text outlines", error);
    return null;
  }
};

const parseStyleString = (styleAttr) => {
  if (!styleAttr) return {};
  return styleAttr
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((acc, declaration) => {
      const parts = declaration.split(":");
      if (parts.length < 2) return acc;
      const property = parts[0].trim();
      const value = parts.slice(1).join(":").trim();
      if (!property || !value) return acc;
      acc[property] = value;
      return acc;
    }, {});
};

const collectStyleFromNode = (node) => {
  if (!node) return {};
  const style = parseStyleString(node.getAttribute("style") || "");
  const trackedAttributes = [
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "text-anchor",
    "letter-spacing",
    "line-height",
    "baseline-shift",
    "fill",
    "fill-opacity",
    "opacity",
  ];
  trackedAttributes.forEach((attr) => {
    const value = node.getAttribute(attr);
    if (value != null) {
      style[attr] = value;
    }
  });
  return style;
};

const formatSvgNumber = (value) => {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  let str = rounded.toFixed(3);
  str = str.replace(/\.?0+$/, "");
  if (str === "-0") str = "0";
  return str;
};

const sanitizePointsSequence = (points) => {
  if (!Array.isArray(points)) return [];
  const sanitized = [];
  for (let idx = 0; idx < points.length; idx += 1) {
    const pt = points[idx];
    if (!pt) continue;
    const prev = sanitized[sanitized.length - 1];
    if (
      prev &&
      Math.abs(prev.X - pt.X) <= TEXT_OUTLINE_COORD_EPS &&
      Math.abs(prev.Y - pt.Y) <= TEXT_OUTLINE_COORD_EPS
    ) {
      continue;
    }
    sanitized.push({ X: pt.X, Y: pt.Y });
  }
  if (sanitized.length > 1) {
    const first = sanitized[0];
    const last = sanitized[sanitized.length - 1];
    if (
      Math.abs(first.X - last.X) <= TEXT_OUTLINE_COORD_EPS &&
      Math.abs(first.Y - last.Y) <= TEXT_OUTLINE_COORD_EPS
    ) {
      sanitized.pop();
    }
  }
  return sanitized;
};

const ensureClosedPolygon = (points) => {
  const sanitized = sanitizePointsSequence(points);
  if (!sanitized.length) return [];
  const closed = sanitized.map((pt) => ({ X: pt.X, Y: pt.Y }));
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (
    Math.abs(first.X - last.X) > TEXT_OUTLINE_COORD_EPS ||
    Math.abs(first.Y - last.Y) > TEXT_OUTLINE_COORD_EPS
  ) {
    closed.push({ X: first.X, Y: first.Y });
  }
  return closed;
};

const pointsToPathData = (points, closePath = false) => {
  const sanitized = sanitizePointsSequence(points);
  if (sanitized.length < 2) return "";
  const move = `M${formatSvgNumber(sanitized[0].X)} ${formatSvgNumber(
    sanitized[0].Y
  )}`;
  const draw = sanitized
    .slice(1)
    .map((pt) => `L${formatSvgNumber(pt.X)} ${formatSvgNumber(pt.Y)}`)
    .join(" ");
  const base = draw ? `${move} ${draw}` : move;
  return closePath ? `${base} Z` : base;
};

const extractPolygonsFromPathItem = (scope, pathItem) => {
  const polygons = [];
  const traverse = (item) => {
    if (!item) return;
    const className =
      typeof item.getClassName === "function"
        ? item.getClassName()
        : item.className;
    if (className === "CompoundPath") {
      (item.children || []).forEach(traverse);
      return;
    }
    if (className !== "Path") {
      return;
    }
    try {
      item.flatten?.(TEXT_OUTLINE_FLATTEN_TOLERANCE);
    } catch {}
    const segments = item.segments || [];
    if (segments.length >= 2) {
      const points = segments.map((seg) => ({
        X: seg.point.x,
        Y: seg.point.y,
      }));
      const openPoints = sanitizePointsSequence(points);
      const clipperPoints = ensureClosedPolygon(points);
      if (openPoints.length >= 2 && clipperPoints.length >= 3) {
        polygons.push({ openPoints, clipperPoints });
      }
    }
  };
  traverse(pathItem);
  return polygons;
};

const offsetPolygonPaths = (clipperPoints, delta) => {
  if (!clipperPoints.length || delta === 0) {
    return [];
  }
  const shape = new Shape([clipperPoints.map((pt) => ({ X: pt.X, Y: pt.Y }))]);
  shape.scaleUp(TEXT_OUTLINE_SCALE);
  const offsetShape = shape.offset(delta * TEXT_OUTLINE_SCALE, {
    jointType: "jtRound",
    endType: "etClosedPolygon",
    roundPrecision: TEXT_OUTLINE_ROUND_PRECISION,
  });
  offsetShape.scaleDown(TEXT_OUTLINE_SCALE);
  return offsetShape.paths || [];
};

const buildOutlineElementsFromPathItem = (scope, doc, pathItem) => {
  const polygons = extractPolygonsFromPathItem(scope, pathItem);
  const elements = [];

  polygons.forEach(({ openPoints, clipperPoints }) => {
    // Замість складних контурів просто малюємо stroke - svg-to-pdfkit краще підтримує прості stroke
    const strokePathData = pointsToPathData(openPoints, true);
    if (strokePathData) {
      const strokePath = doc.createElementNS(SVG_NS, "path");
      strokePath.setAttribute("d", strokePathData);
      strokePath.setAttribute("fill", "none");
      strokePath.setAttribute("stroke", TEXT_STROKE_COLOR);
      strokePath.setAttribute("stroke-width", `${TEXT_OUTLINE_WIDTH}`);
      strokePath.setAttribute("stroke-linejoin", "round");
      strokePath.setAttribute("stroke-linecap", "round");
      elements.push(strokePath);
    }
  });

  try {
    pathItem.remove();
  } catch {}

  return elements;
};

const applyStrokeStyleRecursive = (node, color) => {
  if (!node || node.nodeType !== 1) return;
  const tagName = node.nodeName ? node.nodeName.toLowerCase() : "";
  if (tagName === "text" || tagName === "tspan") {
    node.setAttribute("fill", "none");
    node.setAttribute("stroke", color);
    node.setAttribute("stroke-width", `${TEXT_OUTLINE_WIDTH}`);
    node.setAttribute("stroke-linejoin", "round");
    node.setAttribute("stroke-linecap", "round");
    // Видалили vector-effect, бо svg-to-pdfkit не підтримує
  }
  const children = node.childNodes || [];
  for (let idx = 0; idx < children.length; idx += 1) {
    applyStrokeStyleRecursive(children[idx], color);
  }
};

const convertTextNodeWithPaper = (scope, doc, textNode) => {
  const clone = textNode.cloneNode(true);
  let imported;
  try {
    imported = scope.project.importSVG(clone, {
      insert: true,
      expandShapes: true,
      applyMatrix: true,
    });
  } catch (error) {
    console.error("Failed to import text node into Paper.js", error);
    return [];
  }

  if (!imported) {
    return [];
  }

  const itemsToExport = [];
  const collectOutlines = (item) => {
    if (!item) return;
    const className =
      typeof item.getClassName === "function"
        ? item.getClassName()
        : item.className;
    const isPointText =
      (scope.PointText && item instanceof scope.PointText) ||
      className === "PointText";
    const isPathLike =
      (scope.PathItem && item instanceof scope.PathItem) ||
      className === "CompoundPath" ||
      className === "Path";

    if (isPointText) {
      try {
        const outline = item.toPath(true);
        if (outline) {
          if (Array.isArray(outline)) {
            outline.forEach(collectOutlines);
          } else {
            collectOutlines(outline);
          }
        }
      } catch (error) {
        console.error("Paper.js failed to convert PointText to path", error);
      }
      item.remove();
      return;
    }

    if (isPathLike) {
      itemsToExport.push(item);
      return;
    }

    if (item.children && item.children.length) {
      const children = Array.from(item.children);
      children.forEach(collectOutlines);
      item.remove();
      return;
    }

    item.remove();
  };

  collectOutlines(imported);

  if (typeof imported.remove === "function") {
    imported.remove();
  }

  const nodes = [];
  itemsToExport.forEach((pathItem) => {
    try {
      const outlineNodes =
        buildOutlineElementsFromPathItem(scope, doc, pathItem) || [];
      if (outlineNodes.length) {
        nodes.push(...outlineNodes);
      }
    } catch (error) {
      console.error("Failed to build outline for text path", error);
    }
  });

  return nodes;
};

const convertTextToOutlinedPaths = (rootElement) => {
  if (!rootElement?.querySelectorAll) return;

  const scope = ensureTextOutlineScope();
  if (!scope) return;

  try {
    scope.activate();
  } catch (error) {
    console.error("Failed to activate Paper.js scope", error);
  }

  if (scope.project && scope.project.activeLayer) {
    scope.project.activeLayer.removeChildren();
  }

  const textNodes = Array.from(rootElement.querySelectorAll("text"));
  const svgNamespace = "http://www.w3.org/2000/svg";

  textNodes.forEach((textNode) => {
    try {
      const parent = textNode.parentNode;
      if (!parent) return;

      const doc = textNode.ownerDocument;
      const baseStyle = collectStyleFromNode(textNode);
      const transformAttr = textNode.getAttribute("transform") || "";
      const opacityAttr = textNode.getAttribute("opacity") || baseStyle.opacity;
      const fillOpacityAttr =
        textNode.getAttribute("fill-opacity") || baseStyle["fill-opacity"];

      const outlinedElements = convertTextNodeWithPaper(scope, doc, textNode);

      if (!outlinedElements.length) {
        applyStrokeStyleRecursive(textNode, TEXT_STROKE_COLOR);
        return;
      }

      const needsGroup = Boolean(
        transformAttr || opacityAttr || fillOpacityAttr
      );
      if (needsGroup) {
        const group = doc.createElementNS(svgNamespace, "g");
        if (transformAttr) {
          group.setAttribute("transform", transformAttr);
        }
        if (opacityAttr != null) {
          group.setAttribute("opacity", opacityAttr);
        }
        if (fillOpacityAttr != null) {
          group.setAttribute("fill-opacity", fillOpacityAttr);
        }
        outlinedElements.forEach((element) => {
          group.appendChild(element);
        });
        parent.insertBefore(group, textNode);
      } else {
        outlinedElements.forEach((element) => {
          parent.insertBefore(element, textNode);
        });
      }

      parent.removeChild(textNode);
    } catch (error) {
      console.error("Failed to convert text node to outline", error);
      applyStrokeStyleRecursive(textNode, TEXT_STROKE_COLOR);
    }
  });

  if (scope.project && scope.project.activeLayer) {
    scope.project.activeLayer.removeChildren();
  }
};

const styleLineFromCircleElements = (svgElement) => {
  const ids = [
    "LineFromCircle",
  ];
  ids.forEach((id) => {
    const elements = svgElement.querySelectorAll(`[id="${id}"]`);
    elements.forEach((el) => {
      el.setAttribute("stroke", "#008181");
      el.setAttribute("fill", "none");
      const style = el.getAttribute("style") || "";
      const newStyle =
        style
          .replace(/stroke\s*:[^;]+;?/gi, "")
          .replace(/fill\s*:[^;]+;?/gi, "") + ";stroke:#008181;fill:none;";
      el.setAttribute("style", newStyle);
    });
  });
};

const buildPlacementPreview = (placement) => {
  const { svg, preview, customBorder } = placement || {};

  if (svg && typeof window !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, "image/svg+xml");
      const svgElement = doc.documentElement.cloneNode(true);

      const rawWidth = parseFloat(svgElement.getAttribute("width"));
      const rawHeight = parseFloat(svgElement.getAttribute("height"));
      const hasViewBox = !!svgElement.getAttribute("viewBox");
      // Фарбуємо елементи з id="canvaShape" в синій колір (#0000FF)
      const canvaShapes = svgElement.querySelectorAll('[id="canvaShape"]');
      canvaShapes.forEach((shape) => {
        const BLUE_COLOR = "#0000FF";
        
        // Встановлюємо stroke на самому елементі
        shape.setAttribute("stroke", BLUE_COLOR);
        
        // Очищаємо style від старого stroke і додаємо новий
        const style = shape.getAttribute("style") || "";
        const newStyle = style.replace(/stroke\s*:[^;]+;?/gi, "") + `;stroke:${BLUE_COLOR};`;
        shape.setAttribute("style", newStyle);
        
        // Також застосовуємо до всіх вкладених елементів (якщо це група)
        const children = shape.querySelectorAll('*');
        children.forEach(child => {
             child.setAttribute("stroke", BLUE_COLOR);
             const childStyle = child.getAttribute("style") || "";
             const childNewStyle = childStyle.replace(/stroke\s*:[^;]+;?/gi, "") + `;stroke:${BLUE_COLOR};`;
             child.setAttribute("style", childNewStyle);
        });
      });
      if (hasViewBox) {
        const viewBoxParts = svgElement
          .getAttribute("viewBox")
          .split(/[\s,]+/)
          .map((value) => parseFloat(value))
          .filter((value) => Number.isFinite(value));

        if (viewBoxParts.length === 4) {
          const [minX, minY, vbWidth, vbHeight] = viewBoxParts;
          if (
            (minX !== 0 || minY !== 0) &&
            Number.isFinite(minX) &&
            Number.isFinite(minY)
          ) {
            const ns = svgElement.namespaceURI || "http://www.w3.org/2000/svg";
            const wrapper = doc.createElementNS(ns, "g");

            const nodesToWrap = Array.from(svgElement.childNodes).filter(
              (node) => {
                if (node.nodeType !== 1) return false;
                const tag = node.nodeName.toLowerCase();
                return (
                  tag !== "defs" &&
                  tag !== "style" &&
                  tag !== "title" &&
                  tag !== "desc" &&
                  tag !== "metadata"
                );
              }
            );

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
        svgElement.setAttribute(
          "viewBox",
          `0 0 ${intrinsicWidth} ${intrinsicHeight}`
        );
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

      const mmValueToPx = (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric * PX_PER_MM : null;
      };

      let viewBoxWidth = Number.isFinite(rawWidth)
        ? rawWidth
        : mmValueToPx(placement.sourceWidth) ?? mmValueToPx(placement.width);
      let viewBoxHeight = Number.isFinite(rawHeight)
        ? rawHeight
        : mmValueToPx(placement.sourceHeight) ?? mmValueToPx(placement.height);

      if (viewBoxParts && viewBoxParts.length === 4) {
        const [, , vbWidth, vbHeight] = viewBoxParts;
        if (Number.isFinite(vbWidth)) viewBoxWidth = vbWidth;
        if (Number.isFinite(vbHeight)) viewBoxHeight = vbHeight;
        convertPercentagesToAbsolute(exportElement, {
          width: vbWidth,
          height: vbHeight,
        });
      }

      markCanvasBackgrounds(exportElement, {
        width: viewBoxWidth,
        height: viewBoxHeight,
      });

      // Видаляємо фони для експорту PDF
      // removeBackgroundsForExport(exportElement);

      // Конвертуємо елементи з кольором теми в бірюзовий stroke
      if (placement.themeStrokeColor) {
        convertThemeColorElementsToStroke(
          exportElement,
          placement.themeStrokeColor
        );
      }

      normalizeHoleShapes(exportElement);
      recolorStrokeAttributes(exportElement, OUTLINE_STROKE_COLOR);
      // convertTextToStrokeOnly(exportElement);
      addInnerContoursForShapes(exportElement);
      // recolorStrokeAttributes(exportElement);

      // Конвертуємо текст у контури, щоб шрифт збігався з оригіналом
      convertTextToOutlinedPaths(exportElement);

      // Якщо якісь <text> залишились (помилка конвертації) — застосовуємо stroke як fallback
      const textNodes = Array.from(exportElement.querySelectorAll("text"));
      textNodes.forEach((textNode) => {
        applyStrokeStyleRecursive(textNode, TEXT_STROKE_COLOR);
      });

      applyCustomBorderOverrides(exportElement, customBorder);
      styleLineFromCircleElements(exportElement);

      const previewElement = svgElement.cloneNode(true);
      previewElement.setAttribute("width", "100%");
      previewElement.setAttribute("height", "100%");

      markCanvasBackgrounds(previewElement, {
        width: viewBoxWidth,
        height: viewBoxHeight,
      });

      // Конвертуємо елементи з кольором теми для preview також
      if (placement.themeStrokeColor) {
        convertThemeColorElementsToStroke(
          previewElement,
          placement.themeStrokeColor
        );
      }

      normalizeHoleShapes(previewElement);
      recolorStrokeAttributes(previewElement, PREVIEW_OUTLINE_COLOR);
      // convertTextToStrokeOnly(previewElement);
      addInnerContoursForShapes(previewElement);
      // recolorStrokeAttributes(previewElement);

      convertTextToOutlinedPaths(previewElement);

      const previewTextNodes = Array.from(
        previewElement.querySelectorAll("text")
      );
      previewTextNodes.forEach((textNode) => {
        applyStrokeStyleRecursive(textNode, TEXT_STROKE_COLOR);
      });

      applyCustomBorderOverrides(previewElement, customBorder);
      styleLineFromCircleElements(previewElement);

      try {
        outlineBarcodeRects(exportElement);
      } catch (barcodeExportError) {
        console.warn(
          "Barcode outline (export) failed:",
          barcodeExportError?.message || barcodeExportError
        );
      }

      try {
        outlineBarcodeRects(previewElement);
      } catch (barcodePreviewError) {
        console.warn(
          "Barcode outline (preview) failed:",
          barcodePreviewError?.message || barcodePreviewError
        );
      }

      const serializer = new XMLSerializer();
      const exportMarkup = serializer.serializeToString(exportElement);
      const previewMarkup = serializer.serializeToString(previewElement);
      const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        previewMarkup
      )}`;

      return {
        type: "svg",
        url: dataUri,
        previewMarkup,
        exportMarkup,
        fileName: `${placement.baseId || placement.id}.svg`,
      };
    } catch (error) {
      console.error(
        "Не вдалося підготувати SVG для попереднього перегляду",
        error
      );
    }
  }

  if (preview) {
    return { type: "png", url: preview };
  }

  return null;
};

const LayoutPlannerModal = ({
  isOpen,
  onClose,
  designs = [],
  spacingMm = 5,
}) => {
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
  const coverage =
    sheetsCount > 0
      ? Math.round((totalUsedArea / (sheetArea * sheetsCount)) * 100)
      : 0;
  const totalRequestedCopies = useMemo(
    () =>
      normalizedItems.reduce(
        (acc, item) => acc + Math.max(1, item.copies || 0),
        0
      ),
    [normalizedItems]
  );
  const placedCopies = sheets.reduce(
    (acc, sheet) => acc + sheet.placements.length,
    0
  );
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
      const timestamp = new Date()
        .toISOString()
        .replace(/[:T]/g, "-")
        .slice(0, 19);
      const sheetLabel = FORMATS[formatKey]?.label || "sheet";
      const zip = new JSZip();

      const preparedSheets = sheets.map((sheet, sheetIndex) => {
        const placements = sheet.placements.map((placement) => {
          const previewData = buildPlacementPreview(placement);

          if (previewData?.type === "svg" && previewData.exportMarkup) {
            try {
              const fileName =
                previewData.fileName ||
                `${placement.baseId || placement.id}.svg`;
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
            svgMarkup:
              previewData?.type === "svg" ? previewData.exportMarkup : null,
            sourceWidth: placement.sourceWidth || placement.width,
            sourceHeight: placement.sourceHeight || placement.height,
            customBorder: placement.customBorder || null,
          };
        });

        return {
          index: sheetIndex,
          width: sheet.width,
          height: sheet.height,
          placements,
        };
      });

      const exportEndpoint =
        import.meta.env.VITE_LAYOUT_EXPORT_URL || "/api/layout-pdf";
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
        window.alert(
          "Не вдалося зберегти PDF. Переконайтеся, що сервер експорту запущено та доступний."
        );
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
              Формат {FORMATS[formatKey]?.label} · проміжок між полотнами{" "}
              {spacingMm} мм · {ORIENTATION_LABELS[orientation]}
            </p>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Закрити"
          >
            ×
          </button>
        </div>

        <div className={styles.controls}>
          <label className={styles.controlGroup}>
            <span>Формат аркуша</span>
            <select
              value={formatKey}
              onChange={(event) => setFormatKey(event.target.value)}
            >
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
              {["portrait", "landscape"].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={
                    value === orientation ? styles.orientationActive : ""
                  }
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
                const scale = Math.min(
                  1,
                  340 / Math.max(sheet.width, sheet.height)
                );
                return (
                  <div key={`sheet-${sheetIndex}`} className={styles.sheetCard}>
                    <div className={styles.sheetHeader}>
                      <h3>Аркуш {sheetIndex + 1}</h3>
                      <span>
                        {sheet.width}×{sheet.height} мм · заповнення{" "}
                        {Math.round((sheet.usedArea / sheetArea) * 100)}%
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
                              {previewData?.previewMarkup ? (
                                <div
                                  className={styles.inlineSvgWrapper}
                                  dangerouslySetInnerHTML={{
                                    __html: previewData.previewMarkup,
                                  }}
                                />
                              ) : hasPreview ? (
                                <img
                                  src={previewData?.url}
                                  alt={placement.name || "Полотно"}
                                />
                              ) : (
                                <span className={styles.placementPlaceholder}>
                                  SVG відсутній
                                </span>
                              )}
                            </div>
                            <div className={styles.placementMeta}>
                              <span className={styles.placementName}>
                                {placement.name}
                              </span>
                              <span className={styles.placementSize}>
                                {round1(placement.width)}×
                                {round1(placement.height)} мм
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

export { buildPlacementPreview };
export default LayoutPlannerModal;
