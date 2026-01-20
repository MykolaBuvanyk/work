import React, { useCallback, useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import * as paperNamespace from "paper";
import * as ClipperLibNamespace from "clipper-lib";
import paper from "paper";
import Shape from "clipper-js";
import styles from "./LayoutPlannerModal.module.css";

const PX_PER_MM = 72 / 25.4;

// Requirement: gap between the outer and inner custom border contours must be exactly 2mm.
const CUSTOM_BORDER_CONTOUR_GAP_MM = 2;
const CUSTOM_BORDER_CONTOUR_GAP_PX = CUSTOM_BORDER_CONTOUR_GAP_MM * PX_PER_MM;
const OUTLINE_CENTER_GAP_MM = 0.33;
const OUTLINE_CENTER_GAP_PX = OUTLINE_CENTER_GAP_MM * PX_PER_MM;

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
  // Positive = inward offset, Negative = outward offset.
  if (!Number.isFinite(offsetDistancePx) || offsetDistancePx === 0) return null;

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

const createOffsetContourElement = (shapeNode, pathData, { id, isInner }) => {
  if (!shapeNode || !pathData) return null;
  if (typeof document === "undefined") return null;

  const ns = shapeNode.namespaceURI || "http://www.w3.org/2000/svg";
  const node = document.createElementNS(ns, "path");

  Array.from(shapeNode.attributes || []).forEach(({ name, value }) => {
    if (name === "id") return;
    if (GEOMETRY_ATTRIBUTES_TO_SKIP.has(name)) return;
    node.setAttribute(name, value);
  });

  if (id) {
    node.setAttribute("id", id);
  }

  node.setAttribute("d", pathData);
  node.setAttribute("fill", "none");
  node.removeAttribute("transform");

  sanitizeInnerContourStyle(node);
  applyContourStrokeWidth(node);

  if (isInner) {
    node.setAttribute("data-inner-contour", "true");
    node.removeAttribute("data-inner-contour-added");
  } else {
    node.setAttribute("data-outer-contour", "true");
    node.removeAttribute("data-inner-contour");
  }

  node.setAttribute("stroke", TEXT_STROKE_COLOR);
  node.setAttribute("stroke-opacity", "1");
  if (!node.getAttribute("stroke-linejoin")) {
    node.setAttribute("stroke-linejoin", "round");
  }
  if (!node.getAttribute("stroke-linecap")) {
    node.setAttribute("stroke-linecap", "round");
  }

  return node;
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
  const baseId = shapeNode?.getAttribute?.("id") || "";
  return createOffsetContourElement(shapeNode, innerPathData, {
    id: baseId ? `${baseId}-inner` : null,
    isInner: true,
  });
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

const addInnerContoursForShapes = (rootElement, { enableBorderContours = false, borderThicknessPx = null } = {}) => {
  if (!rootElement?.querySelectorAll) return;

  const scope = ensurePaperScope();
  if (!scope || !ClipperLib || !ClipperLib.ClipperOffset) {
    return;
  }

  const shapeNodes = Array.from(
    rootElement.querySelectorAll('[id^="shape-"]')
  );
  const borderNodes = [];
  if (enableBorderContours) {
    // NOTE: `#canvaShape` is the main blue outline and must NOT be duplicated.
    // We only add inner contours for dedicated border nodes.
    // IMPORTANT: Some templates may contain multiple `border-*` nodes (duplicates).
    // We keep ONLY ONE border node to avoid creating multiple green contours.
    const preferredBorderNode = rootElement.querySelector?.('#canvaShapeCustom') || null;
    const borderCandidates = preferredBorderNode
      ? [preferredBorderNode]
      : Array.from(rootElement.querySelectorAll('[id^="border"]'));

    // Choose the last one (usually the newest/topmost in exported SVG).
    let primaryBorderNode = borderCandidates.length
      ? borderCandidates[borderCandidates.length - 1]
      : null;

    // PDF/Laser requirement:
    // In LightBurn the path centerlines matter, not the visual stroke thickness.
    // Our Fabric custom border node can be geometrically inset to keep a thick stroke inside the canvas,
    // which makes its centerline differ from the standard blue outline (`#canvaShape`).
    // For export we want the OUTER custom-border path to match the blue outline exactly.
    if (primaryBorderNode) {
      const mainOutline = rootElement.querySelector?.('#canvaShape') || null;
      const baseId = primaryBorderNode.getAttribute?.('id') || '';
      if (mainOutline && baseId && mainOutline !== primaryBorderNode) {
        try {
          const synced = mainOutline.cloneNode(true);
          if (synced && typeof synced.setAttribute === 'function') {
            synced.setAttribute('id', baseId);

            // Preserve non-geometry attributes from the original border node.
            const geometryAttrs = new Set([
              'x',
              'y',
              'x1',
              'y1',
              'x2',
              'y2',
              'width',
              'height',
              'rx',
              'ry',
              'r',
              'cx',
              'cy',
              'points',
              'd',
              'transform',
              'pathLength',
            ]);

            Array.from(primaryBorderNode.attributes || []).forEach((attr) => {
              if (!attr || !attr.name) return;
              if (attr.name === 'id') return;
              if (geometryAttrs.has(attr.name)) return;
              try {
                synced.setAttribute(attr.name, attr.value);
              } catch {
                // ignore
              }
            });

            primaryBorderNode.parentNode?.replaceChild(synced, primaryBorderNode);
            primaryBorderNode = synced;
          }
        } catch {
          // ignore
        }
      }
    }

    // Remove other duplicate border nodes (and their existing inner contours) so they can't render as extra green contours.
    if (!preferredBorderNode && borderCandidates.length > 1 && primaryBorderNode) {
      borderCandidates.forEach((candidate) => {
        if (!candidate || candidate === primaryBorderNode) return;
        const candidateId = candidate.getAttribute?.('id') || '';
        try {
          candidate.parentNode?.removeChild(candidate);
        } catch {
          // ignore
        }
        if (candidateId && rootElement?.querySelector) {
          const innerId = `${candidateId}-inner`;
          const escapedInnerId = escapeCssIdentifier(innerId);
          const existingInner = escapedInnerId
            ? rootElement.querySelector(`[id="${escapedInnerId}"]`)
            : null;
          if (existingInner) {
            try {
              existingInner.parentNode?.removeChild(existingInner);
            } catch {
              // ignore
            }
          }
        }
      });
    }

    if (primaryBorderNode) {
      borderNodes.push(primaryBorderNode);
    }
  }

  const processNodeWithInnerContour = (
    shapeNode,
    {
      doubleInnerContour = false,
      overrideThicknessPx = null,
      applyStrokeCenterCompensation = true,
    } = {}
  ) => {
    try {
      if (
        !shapeNode ||
        shapeNode.getAttribute("data-inner-contour-added") === "true"
      ) {
        return;
      }

      const nodeId = shapeNode.getAttribute("id") || "";
      // Prevent re-processing generated inner contours (e.g. "-inner" or "-inner-2")
      if (!nodeId || nodeId.includes("-inner")) {
        return;
      }

      // Avoid creating duplicate inner contours if they already exist in the markup.
      if (rootElement?.querySelector) {
        const innerId = `${nodeId}-inner`;
        const escapedInnerId = escapeCssIdentifier(innerId);
        if (escapedInnerId) {
          const existingInner = rootElement.querySelector(`[id="${escapedInnerId}"]`);
          if (existingInner) {
            shapeNode.setAttribute("data-inner-contour-added", "true");
            return;
          }
        }
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

      // If overrideThicknessPx is provided (for border nodes), use it directly.
      let thicknessPx = Number.isFinite(overrideThicknessPx) && overrideThicknessPx > 0
        ? overrideThicknessPx
        : NaN;

      // Otherwise, read from element attributes (for shape nodes).
      if (!Number.isFinite(thicknessPx) || thicknessPx <= 0) {
        const thicknessMmValue = thicknessMmAttr
          ? parseFloat(thicknessMmAttr)
          : NaN;
        thicknessPx = Number.isFinite(thicknessMmValue)
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
      }

      if (!Number.isFinite(thicknessPx) || thicknessPx <= 0) {
        return;
      }

      const parent = shapeNode.parentNode;
      let workingNode = shapeNode;

      // IMPORTANT:
      // - For ShapeSelector shapes, we compensate for SVG/PDF stroke being centered on the path.
      //   We treat original geometry as the stroke centerline and replace it with the outer edge.
      // - For other nodes (e.g. border), DO NOT replace geometry; only add inner contour.
      if (applyStrokeCenterCompensation) {
        const halfThicknessPx = thicknessPx / 2;
        if (!Number.isFinite(halfThicknessPx) || halfThicknessPx <= 0) return;

        const outerPathData = buildInnerContourPathData(
          scope,
          workingNode,
          -halfThicknessPx
        );

        if (outerPathData && parent) {
          const outerNode = createOffsetContourElement(workingNode, outerPathData, {
            id: nodeId || null,
            isInner: false,
          });
          if (outerNode) {
            parent.replaceChild(outerNode, workingNode);
            workingNode = outerNode;
          }
        }
      }

      // Gap between contours must equal thickness.
      // If we replaced the node with its outer edge, the inner offset is full thickness.
      // If we kept original geometry, we still offset inward by thickness (legacy border behavior).
      const offsetDistancePx = thicknessPx;
      const innerPathData = buildInnerContourPathData(
        scope,
        workingNode,
        offsetDistancePx
      );
      if (!innerPathData) return;

      const innerNode = createInnerContourElement(workingNode, innerPathData);
      if (!innerNode) return;

      let secondInnerNode = null;
      if (doubleInnerContour) {
        const innerPathData2 = buildInnerContourPathData(
          scope,
          workingNode,
          offsetDistancePx * 2
        );
        if (innerPathData2) {
          secondInnerNode = createInnerContourElement(workingNode, innerPathData2);
          if (secondInnerNode) {
            const baseId = workingNode.getAttribute("id");
            if (baseId) {
              secondInnerNode.setAttribute("id", `${baseId}-inner-2`);
            }
            secondInnerNode.setAttribute("data-inner-contour-level", "2");
          }
        }
      }

      workingNode.setAttribute("data-inner-contour-added", "true");
      applyContourStrokeWidth(workingNode, true);

      if (parent) {
        parent.insertBefore(innerNode, workingNode.nextSibling);
        if (secondInnerNode) {
          parent.insertBefore(secondInnerNode, innerNode.nextSibling);
        }
      }
    } catch (error) {
      console.warn("Не вдалося додати внутрішній контур для фігури", error);
    }
  };

  shapeNodes.forEach((shapeNode) =>
    processNodeWithInnerContour(shapeNode, {
      doubleInnerContour: false,
      applyStrokeCenterCompensation: true,
    })
  );
  // For border: keep green overlay on the same geometry as blue,
  // PLUS add exactly one inner green contour with an inward offset equal to border thickness.
  borderNodes.forEach((borderNode) =>
    processNodeWithInnerContour(borderNode, {
      doubleInnerContour: false,
      overrideThicknessPx: borderThicknessPx,
      applyStrokeCenterCompensation: false,
    })
  );
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

    // If the template does not contain an explicit blue outline node (usually `#canvaShape`),
    // we must keep a blue contour AND a green contour on the same geometry.
    // In that case, create a blue copy of this border node before recoloring it to green.
    const hasBlueMainOutline = Boolean(rootElement.querySelector?.('[id="canvaShape"]'));
    const baseId = node.getAttribute("id") || "";
    if (!hasBlueMainOutline || baseId === "canvaShape") {
      try {
        const blueCopy = node.cloneNode(true);
        if (blueCopy && typeof blueCopy.setAttribute === "function") {
          if (baseId) {
            blueCopy.setAttribute("id", `${baseId}-blue`);
          }
          applyStrokeFillRecursive(blueCopy, OUTLINE_STROKE_COLOR, "none");
          blueCopy.setAttribute("data-export-border-blue", "true");
          if (!blueCopy.getAttribute("stroke-width")) {
            blueCopy.setAttribute("stroke-width", "1");
          }
          blueCopy.setAttribute(
            "stroke-linejoin",
            blueCopy.getAttribute("stroke-linejoin") || "round"
          );
          blueCopy.setAttribute(
            "stroke-linecap",
            blueCopy.getAttribute("stroke-linecap") || "round"
          );
          blueCopy.setAttribute("vector-effect", "non-scaling-stroke");
          node.parentNode?.insertBefore(blueCopy, node);
        }
      } catch {
        // ignore
      }
    }

    // Requirement: keep exactly ONE green contour that sits on the same geometry as the blue contour.
    // So we recolor the custom border node itself and DO NOT create/keep any extra inner contour.
    applyStrokeFillRecursive(node, stroke, fill);
    node.setAttribute("data-export-border", metadata.mode || "custom");

    // Ensure the inward offset contour (generated as `-inner`) is also green.
    if (baseId && rootElement?.querySelector) {
      const innerId = `${baseId}-inner`;
      const escapedInnerId = escapeCssIdentifier(innerId);
      const inner = escapedInnerId
        ? rootElement.querySelector(`[id="${escapedInnerId}"]`)
        : null;
      if (inner && typeof inner.setAttribute === "function") {
        inner.setAttribute("stroke", stroke);
        inner.setAttribute("fill", fill);
        inner.setAttribute("stroke-opacity", "1");
        inner.setAttribute("fill-opacity", "1");
        if (!inner.getAttribute("stroke-width")) {
          inner.setAttribute("stroke-width", "1");
        }
        inner.setAttribute("vector-effect", "non-scaling-stroke");
        inner.setAttribute("data-export-border", metadata.mode || "custom");
      }
    }
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

  const isOutlineNode = (node) => {
    if (!node || typeof node.getAttribute !== "function") return false;
    const id = node.getAttribute("id") || "";
    if (id === "canvaShape") return true;
    if (node.getAttribute("data-export-border-blue") === "true") return true;
    if (id.endsWith("-blue")) return true;
    return false;
  };

  const elements = rootElement.querySelectorAll("*");
  elements.forEach((node) => {
    // Only recolor the canvas outer outline. Do not touch regular artwork strokes.
    if (!isOutlineNode(node)) {
      return;
    }
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

  // Позначаємо pattern та image елементи, які є фоновими текстурами
  const defs = rootElement.querySelector("defs");
  if (defs) {
    const patterns = Array.from(defs.querySelectorAll("pattern"));
    patterns.forEach((pattern) => {
      pattern.setAttribute(BACKGROUND_ATTR, "true");
      // Також позначаємо всі image всередині pattern
      const images = Array.from(pattern.querySelectorAll("image"));
      images.forEach((img) => {
        img.setAttribute(BACKGROUND_ATTR, "true");
      });
    });
  }
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
  
  // Видаляємо rect які посилаються на pattern (текстурні фони)
  const rectsWithPattern = Array.from(rootElement.querySelectorAll("rect"));
  rectsWithPattern.forEach((rect) => {
    const fill = rect.getAttribute("fill") || "";
    // Якщо fill посилається на url(#...) - це може бути pattern
    if (fill.startsWith("url(#")) {
      rect.parentNode?.removeChild(rect);
    }
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

const BARCODE_EXPORT_ATTR = "data-layout-barcode";
const BARCODE_BAR_ATTR = "data-layout-barcode-bar";

const BARCODE_OUTLINE_COLOR = TEXT_STROKE_COLOR;
const BARCODE_OUTLINE_WIDTH = 1;
const BARCODE_OUTLINE_MIN_WIDTH = 0.3;

const outlineBarcodeRects = (rootElement) => {
  if (!rootElement) return;

  let outlinedGroups = 0;

  const walk = (node) => {
    if (!node || node.nodeType !== 1) return;

    if (isLikelyBarcodeGroupPreview(node)) {
      // Mark the container so the server can reliably strip/render barcode bars.
      // This is safe because the server strips only the narrow bar rects (not the whole group).
      try {
        node.setAttribute(BARCODE_EXPORT_ATTR, "true");
      } catch {}

      const rects = filterBarcodeRects(collectBarcodeRectDescendants(node));
      if (rects.length) {
        outlinedGroups += 1;
        rects.forEach((rect) => {
          try {
            rect.setAttribute(BARCODE_BAR_ATTR, "true");
          } catch {}

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
let warnedPointTextOutlineUnsupported = false;

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

const addCurveToCommands = (curve, commands) => {
  if (!curve || !commands) return;
  const p2 = curve.point2;
  if (curve.isStraight()) {
    commands.push(`L${formatSvgNumber(p2.x)} ${formatSvgNumber(p2.y)}`);
  } else {
    const p1 = curve.point1;
    const h1 = curve.handle1;
    const h2 = curve.handle2;
    const cp1 = p1.add(h1);
    const cp2 = p2.add(h2);
    commands.push(
      `C${formatSvgNumber(cp1.x)} ${formatSvgNumber(cp1.y)} ${formatSvgNumber(
        cp2.x
      )} ${formatSvgNumber(cp2.y)} ${formatSvgNumber(p2.x)} ${formatSvgNumber(
        p2.y
      )}`
    );
  }
};

const generateGappedPathData = (scope, node, gapPx) => {
  if (!scope || !node) return null;

  try {
    scope.project.clear();
    const imported = scope.project.importSVG(node.cloneNode(true), {
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

    // Composite outlines (e.g. lock = body + shackle) sometimes import as multiple path items,
    // but sometimes come as a single compound path. We detect lock-like geometry later too.
    const isCompositeOutline = pathItems.length > 1;

    const commands = [];

    const angleDistance = (a, b) => {
      if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
      let d = a - b;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return Math.abs(d);
    };

    const isHorizontalAngle = (angle, toleranceRad) => {
      if (!Number.isFinite(angle)) return false;
      const d0 = angleDistance(angle, 0);
      const dPi = angleDistance(angle, Math.PI);
      return Math.min(d0, dPi) <= toleranceRad;
    };

    const median = (values) => {
      if (!Array.isArray(values) || values.length === 0) return 0;
      const sorted = values.slice().sort((x, y) => x - y);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const buildTwoGapIntervals = (totalLen) => {
      if (!Number.isFinite(totalLen) || totalLen <= 0) return [];
      const gap = Number.isFinite(gapPx) && gapPx > 0 ? gapPx : 0;
      if (!gap) return [];
      const effectiveGap = Math.min(gap, totalLen * 0.9);
      if (totalLen <= effectiveGap + 0.01) {
        // Too short: fall back to a single center gap
        const start = Math.max(0, totalLen / 2 - effectiveGap / 2);
        const end = Math.min(totalLen, totalLen / 2 + effectiveGap / 2);
        return end > start + 1e-6 ? [{ start, end }] : [];
      }

      const make = (center) => {
        const start = Math.max(0, center - effectiveGap / 2);
        const end = Math.min(totalLen, center + effectiveGap / 2);
        return end > start + 1e-6 ? { start, end } : null;
      };

      const i1 = make(totalLen / 3);
      const i2 = make((2 * totalLen) / 3);
      if (!i1 || !i2) {
        const i = make(totalLen / 2);
        return i ? [i] : [];
      }
      if (i1.end >= i2.start - 1e-3) {
        const i = make(totalLen / 2);
        return i ? [i] : [];
      }
      return [i1, i2];
    };

    const appendCurveWithIntervalList = (curve, meta, intervals, offsetInGroup) => {
      if (!curve) return;
      if (!meta || !Number.isFinite(meta.length) || meta.length <= 0) {
        addCurveToCommands(curve, commands);
        return;
      }
      if (!Array.isArray(intervals) || intervals.length === 0) {
        addCurveToCommands(curve, commands);
        return;
      }

      const localIntervals = intervals
        .map((it) => {
          const start = Math.max(0, it.start - offsetInGroup);
          const end = Math.min(meta.length, it.end - offsetInGroup);
          return end > start + 1e-6 ? { start, end } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.start - b.start);

      if (!localIntervals.length) {
        addCurveToCommands(curve, commands);
        return;
      }

      let cursorT = 0;
      for (const it of localIntervals) {
        const tStart = curve.getTimeAt(it.start);
        const tEnd = curve.getTimeAt(it.end);
        if (!Number.isFinite(tStart) || !Number.isFinite(tEnd) || tEnd <= tStart) {
          continue;
        }

        if (tStart > cursorT + 1e-6) {
          const before = curve.getPart(cursorT, tStart);
          if (before) addCurveToCommands(before, commands);
        }

        const resumePoint = typeof curve.getPointAt === "function" ? curve.getPointAt(it.end) : null;
        if (resumePoint && Number.isFinite(resumePoint.x) && Number.isFinite(resumePoint.y)) {
          commands.push(`M${formatSvgNumber(resumePoint.x)} ${formatSvgNumber(resumePoint.y)}`);
        }

        cursorT = tEnd;
      }

      if (cursorT < 1 - 1e-6) {
        const after = curve.getPart(cursorT, 1);
        if (after) addCurveToCommands(after, commands);
      }
    };

    pathItems.forEach((path) => {
      const curves = path.curves;
      if (!curves || curves.length === 0) return;

      const gap = Number.isFinite(gapPx) && gapPx > 0 ? gapPx : 0;

      // Start point
      const startPoint = curves[0].point1;
      commands.push(
        `M${formatSvgNumber(startPoint.x)} ${formatSvgNumber(startPoint.y)}`
      );

      if (!gap) {
        curves.forEach((curve) => addCurveToCommands(curve, commands));
        return;
      }

      const curveMeta = curves.map((curve) => {
        const isStraight = typeof curve?.isStraight === "function" ? curve.isStraight() : false;
        const p1 = curve?.point1;
        const p2 = curve?.point2;
        const dx = Number(p2?.x) - Number(p1?.x);
        const dy = Number(p2?.y) - Number(p1?.y);
        const angle = Number.isFinite(dx) && Number.isFinite(dy) ? Math.atan2(dy, dx) : NaN;
        const length = Number.isFinite(curve?.length) ? curve.length : 0;
        return { curve, isStraight, angle, length };
      });

      const hasStraight = curveMeta.some((m) => m.isStraight);
      const hasCurved = curveMeta.some((m) => m.curve && !m.isStraight);

      // For composite outlines (lock body + shackle): never gap the shackle/arc item.
      if (isCompositeOutline && !hasStraight) {
        curveMeta.forEach((m) => addCurveToCommands(m.curve, commands));
        return;
      }

      // Helper: gap a single curve (used for pure curved shapes like circle/ellipse)
      const gapSingleCurve = (curve) => {
        if (!curve) return;
        const length = curve.length;
        if (!Number.isFinite(length) || length <= 0) return;
        const effectiveGap = Math.min(gap, length * 0.9);
        if (length <= effectiveGap + 0.01) {
          addCurveToCommands(curve, commands);
          return;
        }
        const offset1 = length / 2 - effectiveGap / 2;
        const offset2 = length / 2 + effectiveGap / 2;
        const t1 = curve.getTimeAt(offset1);
        const t2 = curve.getTimeAt(offset2);
        if (!Number.isFinite(t1) || !Number.isFinite(t2)) {
          addCurveToCommands(curve, commands);
          return;
        }
        const part1 = curve.getPart(0, t1);
        const part2 = curve.getPart(t2, 1);
        if (!part1 || !part2) {
          addCurveToCommands(curve, commands);
          return;
        }
        addCurveToCommands(part1, commands);
        const resume = part2.point1;
        commands.push(`M${formatSvgNumber(resume.x)} ${formatSvgNumber(resume.y)}`);
        addCurveToCommands(part2, commands);
      };

      // Pure curved shape (circle/ellipse/half-circle built from arcs): gap each arc curve.
      if (!hasStraight) {
        curveMeta.forEach((m) => gapSingleCurve(m.curve));
        return;
      }

      // Mixed shapes (e.g. lock):
      // - do NOT gap true curved segments
      // - and also avoid creating many tiny gaps on polyline-approximated arcs.
      // We insert ONE gap per *selected straight run* (normally 1 per side),
      // with a special case for lock top near the shackle: 2 gaps.
      const ANGLE_DRIFT_TOLERANCE_RAD = (3 * Math.PI) / 180; // 3 degrees

      const runs = [];
      let currentRun = null;
      let currentOffset = 0;
      const runIdByCurveIndex = new Array(curves.length).fill(null);
      const offsetBeforeCurveInRun = new Array(curves.length).fill(0);

      for (let i = 0; i < curveMeta.length; i += 1) {
        const meta = curveMeta[i];
        const isStraight = meta.isStraight;
        const angle = meta.angle;

        if (!isStraight || !Number.isFinite(meta.length) || meta.length <= 0) {
          if (currentRun) {
            currentRun.end = i - 1;
            runs.push(currentRun);
            currentRun = null;
          }
          continue;
        }

        if (!currentRun) {
          currentRun = {
            start: i,
            end: i,
            baseAngle: angle,
            length: 0,
          };
          currentOffset = 0;
        } else {
          const drift = angleDistance(angle, currentRun.baseAngle);
          if (!Number.isFinite(drift) || drift > ANGLE_DRIFT_TOLERANCE_RAD) {
            currentRun.end = i - 1;
            runs.push(currentRun);
            currentRun = {
              start: i,
              end: i,
              baseAngle: angle,
              length: 0,
            };
            currentOffset = 0;
          }
        }

        runIdByCurveIndex[i] = runs.length; // tentative id (finalized later)
        offsetBeforeCurveInRun[i] = currentOffset;
        currentOffset += meta.length;
        currentRun.length = currentOffset;
      }

      if (currentRun) {
        runs.push(currentRun);
      }

      // Fix run ids now that we pushed runs.
      // Rebuild runIdByCurveIndex based on runs ranges.
      runIdByCurveIndex.fill(null);
      offsetBeforeCurveInRun.fill(0);
      runs.forEach((run, runId) => {
        let off = 0;
        for (let i = run.start; i <= run.end; i += 1) {
          runIdByCurveIndex[i] = runId;
          offsetBeforeCurveInRun[i] = off;
          off += curveMeta[i]?.length || 0;
        }
        run.length = off;
      });

      const runLengths = runs.map((r) => r.length).filter((v) => Number.isFinite(v) && v > 0);
      const maxRun = runLengths.length ? Math.max(...runLengths) : 0;
      const medRun = median(runLengths);
      const isMixedWithPolylineArc = maxRun > 0 && medRun > 0 && maxRun / medRun >= 3;

      // RECTANGLE rule (with or without rounded corners):
      // Find exactly 4 straight sides and apply 1 centered gap per side.
      // Corner arcs (from corner radius) get no gaps.
      const straightCurveIndices = [];
      const straightCurveLengths = [];
      curveMeta.forEach((m, i) => {
        if (m.isStraight && Number.isFinite(m.length) && m.length > 0) {
          straightCurveIndices.push(i);
          straightCurveLengths.push(m.length);
        }
      });

      // Check: exactly 4 straight sides (typical rectangle/rounded rectangle)
      if (straightCurveIndices.length === 4) {
        const minLen = Math.min(...straightCurveLengths);
        const maxLen = Math.max(...straightCurveLengths);
        // Check if this looks like a rectangle (4 straight sides, reasonable proportions)
        const isRectangle = minLen > 0 && maxLen / minLen <= 5 && straightCurveLengths.every((len) => len >= gap * 2);

        if (isRectangle) {
          const straightSet = new Set(straightCurveIndices);

          // Apply one centered gap per straight side, pass through arcs unchanged
          curves.forEach((curve, i) => {
            const meta = curveMeta[i];
            if (!curve || !meta) return;

            // If not a straight side, just draw it (corner arc)
            if (!straightSet.has(i)) {
              addCurveToCommands(curve, commands);
              return;
            }

            const curveLen = meta.length;
            if (!Number.isFinite(curveLen) || curveLen <= 0) {
              addCurveToCommands(curve, commands);
              return;
            }

            // One centered gap on THIS straight side
            const gapCenter = curveLen / 2;
            const effectiveGap = Math.min(gap, curveLen * 0.8);
            const gapStart = Math.max(0, gapCenter - effectiveGap / 2);
            const gapEnd = Math.min(curveLen, gapCenter + effectiveGap / 2);

            if (gapEnd <= gapStart + 1e-6) {
              addCurveToCommands(curve, commands);
              return;
            }

            const tStart = curve.getTimeAt(gapStart);
            const tEnd = curve.getTimeAt(gapEnd);

            if (!Number.isFinite(tStart) || !Number.isFinite(tEnd) || tEnd <= tStart) {
              addCurveToCommands(curve, commands);
              return;
            }

            // Draw before gap
            if (tStart > 1e-6) {
              const before = curve.getPart(0, tStart);
              if (before) addCurveToCommands(before, commands);
            }

            // Move to resume point (after gap)
            const resumePoint = curve.getPointAt(gapEnd);
            if (resumePoint && Number.isFinite(resumePoint.x) && Number.isFinite(resumePoint.y)) {
              commands.push(`M${formatSvgNumber(resumePoint.x)} ${formatSvgNumber(resumePoint.y)}`);
            }

            // Draw after gap
            if (tEnd < 1 - 1e-6) {
              const after = curve.getPart(tEnd, 1);
              if (after) addCurveToCommands(after, commands);
            }
          });
          return;
        }
      }

      // HALF-CIRCLE / EXTENDED-HALF-CIRCLE rule (canvas shapes):
      // If the outline has ONE dominant bottom horizontal base line and the rest is arc,
      // then we want:
      // - base (bottom straight): TWO gaps
      // - arc (the rest of the outline): TWO gaps
      // This avoids per-segment gaps on the arc polyline.
      {
        const HORIZONTAL_TOLERANCE_RAD = (12 * Math.PI) / 180; // 12 degrees

        // Compute runStats here (avgY/avgX/baseAngle) for base detection.
        const runStatsLocal = runs.map(() => ({ avgY: 0, count: 0, baseAngle: NaN }));
        runs.forEach((run, runId) => {
          if (!run) return;
          let sumY = 0;
          let count = 0;
          let angleSum = 0;
          let angleCount = 0;
          for (let i = run.start; i <= run.end; i += 1) {
            const meta = curveMeta[i];
            const c = meta?.curve;
            if (!c) continue;
            const p1 = c.point1;
            const p2 = c.point2;
            if (Number.isFinite(p1?.y)) {
              sumY += p1.y;
              count += 1;
            }
            if (Number.isFinite(p2?.y)) {
              sumY += p2.y;
              count += 1;
            }
            if (Number.isFinite(meta?.angle)) {
              angleSum += meta.angle;
              angleCount += 1;
            }
          }
          runStatsLocal[runId].avgY = count ? sumY / count : 0;
          runStatsLocal[runId].count = count;
          runStatsLocal[runId].baseAngle = angleCount ? angleSum / angleCount : run.baseAngle;
        });

        const sortedRuns = runs
          .map((run, runId) => ({ runId, run }))
          .filter(({ run }) => run && Number.isFinite(run.length) && run.length > 0)
          .sort((a, b) => b.run.length - a.run.length);

        const longest = sortedRuns[0] || null;
        const second = sortedRuns[1] || null;

        const longestLen = longest?.run?.length || 0;
        const secondLen = second?.run?.length || 0;

        // Require one clearly dominant run (the base) to avoid matching lock/rectangles.
        const isDominantBase =
          Number.isFinite(longestLen) &&
          longestLen > 0 &&
          (secondLen <= longestLen * 0.45 || secondLen <= (Number.isFinite(medRun) ? medRun * 1.5 : longestLen * 0.45));

        const longestStat = longest ? runStatsLocal[longest.runId] : null;
        const isHorizontalBase =
          Boolean(longestStat?.count) && isHorizontalAngle(longestStat.baseAngle, HORIZONTAL_TOLERANCE_RAD);

        // "Bottom" base: in SVG coords, bottom has larger Y.
        let baseRunId = null;
        if (isDominantBase && isHorizontalBase) {
          baseRunId = longest.runId;
        }

        if (baseRunId != null) {
          const baseRun = runs[baseRunId];
          const baseLen = baseRun?.length || 0;

          // Arc group = everything not in the base run.
          const arcIndexList = [];
          const arcOffsetBefore = new Array(curveMeta.length).fill(0);
          let arcCum = 0;

          for (let i = 0; i < curveMeta.length; i += 1) {
            const rid = runIdByCurveIndex[i];
            const isBaseMember = rid === baseRunId;
            if (isBaseMember) continue;
            const len = curveMeta[i]?.length || 0;
            if (!Number.isFinite(len) || len <= 0) continue;
            arcOffsetBefore[i] = arcCum;
            arcIndexList.push(i);
            arcCum += len;
          }

          const arcLen = arcCum;
          const baseIntervals = buildTwoGapIntervals(baseLen);
          const arcIntervals = buildTwoGapIntervals(arcLen);

          // Only apply if we have both base+arc to gap.
          if (baseIntervals.length && arcIntervals.length) {
            // Draw curves in order, applying group intervals.
            curves.forEach((curve, i) => {
              const meta = curveMeta[i];
              if (!curve || !meta) return;

              const rid = runIdByCurveIndex[i];
              if (rid === baseRunId && meta.isStraight) {
                const off0 = offsetBeforeCurveInRun[i] || 0;
                appendCurveWithIntervalList(curve, meta, baseIntervals, off0);
                return;
              }

              // Arc (includes curved segments and polyline approximations)
              if (arcIndexList.includes(i)) {
                const offA = arcOffsetBefore[i] || 0;
                appendCurveWithIntervalList(curve, meta, arcIntervals, offA);
                return;
              }

              addCurveToCommands(curve, commands);
            });

            return;
          }
        }
      }

      const selectedRunIds = new Set();
      runs.forEach((run, runId) => {
        if (!Number.isFinite(run.length) || run.length <= 0) return;

        // For lock/rounded/mixed outlines: only gap the long straight sides.
        if (hasCurved || isMixedWithPolylineArc) {
          if (run.length >= Math.max(maxRun * 0.6, gap * 4)) {
            selectedRunIds.add(runId);
          }
          return;
        }

        // For normal polygons (few straight runs): gap every side/run.
        if (run.length >= gap * 2) {
          selectedRunIds.add(runId);
        }
      });

      // Determine which straight run is the TOP edge (horizontal + smallest Y),
      // so we can add TWO gaps near the shackle (lock requirement).
      const HORIZONTAL_TOLERANCE_RAD = (12 * Math.PI) / 180; // 12 degrees
      const runStats = runs.map(() => ({ avgY: 0, avgX: 0, count: 0, baseAngle: NaN }));
      runs.forEach((run, runId) => {
        if (!run) return;
        let sumY = 0;
        let sumX = 0;
        let count = 0;
        let angleSum = 0;
        let angleCount = 0;
        for (let i = run.start; i <= run.end; i += 1) {
          const meta = curveMeta[i];
          const c = meta?.curve;
          if (!c) continue;
          const p1 = c.point1;
          const p2 = c.point2;
          if (Number.isFinite(p1?.x)) {
            sumX += p1.x;
          }
          if (Number.isFinite(p1?.y)) {
            sumY += p1.y;
            count += 1;
          }
          if (Number.isFinite(p2?.x)) {
            sumX += p2.x;
          }
          if (Number.isFinite(p2?.y)) {
            sumY += p2.y;
            count += 1;
          }
          if (Number.isFinite(meta?.angle)) {
            angleSum += meta.angle;
            angleCount += 1;
          }
        }
        runStats[runId].avgY = count ? sumY / count : 0;
        runStats[runId].avgX = count ? sumX / count : 0;
        runStats[runId].count = count;
        runStats[runId].baseAngle = angleCount ? angleSum / angleCount : run.baseAngle;
      });

      // Enable the special "two gaps on the top side" for lock-like outlines.
      // - composite (multiple items) => very likely lock
      // - or polyline-arc heuristic (many tiny straight segments) => likely lock shackle approximation
      const enableTwoTopGaps = isCompositeOutline || isMixedWithPolylineArc;

      // LOCK requirement:
      // "two gaps above the shackle" usually means the TOP edge is split into 2 horizontal runs
      // (left and right of the shackle opening). We add ONE gap per each of those two runs.
      // We never put two gaps on the bottom edge.
      const specialOneGapTopRunIds = new Set();
      if (enableTwoTopGaps) {
        const collectY = (point, acc) => {
          if (!point) return;
          const y = point.y;
          if (Number.isFinite(y)) acc.push(y);
        };

        const collectX = (point, acc) => {
          if (!point) return;
          const x = point.x;
          if (Number.isFinite(x)) acc.push(x);
        };

        const shackleYs = [];
        const shackleXs = [];

        if (hasCurved) {
          // True curves: use their Y as the shackle reference.
          curveMeta.forEach((m) => {
            if (!m?.curve || m.isStraight) return;
            collectY(m.curve.point1, shackleYs);
            collectY(m.curve.point2, shackleYs);
            collectX(m.curve.point1, shackleXs);
            collectX(m.curve.point2, shackleXs);
          });
        } else if (isMixedWithPolylineArc) {
          // Polyline-arc approximation: use short straight segments that are NOT part of selected long runs.
          curveMeta.forEach((m, idx) => {
            if (!m?.curve || !m.isStraight) return;
            const runId = runIdByCurveIndex[idx];
            if (runId != null && selectedRunIds.has(runId)) return;
            // Prefer tiny segments (typical for arc polylines)
            if (Number.isFinite(m.length) && m.length <= medRun * 1.2) {
              collectY(m.curve.point1, shackleYs);
              collectY(m.curve.point2, shackleYs);
              collectX(m.curve.point1, shackleXs);
              collectX(m.curve.point2, shackleXs);
            }
          });
        }

        const shackleY = shackleYs.length
          ? shackleYs.reduce((a, b) => a + b, 0) / shackleYs.length
          : NaN;
        const shackleX = shackleXs.length
          ? shackleXs.reduce((a, b) => a + b, 0) / shackleXs.length
          : NaN;

        // Candidate horizontal runs: include even if they were not selected as "longest".
        const minRunLenForTop = Math.max(gap * 3, medRun * 1.5);
        const horizontalCandidates = runs
          .map((run, runId) => ({ run, runId }))
          .filter(({ run }) => run && Number.isFinite(run.length) && run.length >= minRunLenForTop)
          .filter(({ runId }) => {
            const stat = runStats[runId];
            if (!stat || !stat.count) return false;
            return isHorizontalAngle(stat.baseAngle, HORIZONTAL_TOLERANCE_RAD);
          })
          .map(({ runId, run }) => ({
            runId,
            length: run.length,
            avgY: runStats[runId].avgY,
            avgX: runStats[runId].avgX,
          }));

        if (horizontalCandidates.length) {
          // In SVG coordinates, "top" is the smallest Y.
          const minY = Math.min(...horizontalCandidates.map((c) => c.avgY));
          const topBand = horizontalCandidates.filter((c) => Math.abs(c.avgY - minY) <= 2);

          // Pick two runs: left and right of shackleX if known, else two longest from the top band.
          let picked = [];
          if (Number.isFinite(shackleX)) {
            const left = topBand
              .filter((c) => Number.isFinite(c.avgX) && c.avgX < shackleX)
              .sort((a, b) => Math.abs(a.avgX - shackleX) - Math.abs(b.avgX - shackleX))[0];
            const right = topBand
              .filter((c) => Number.isFinite(c.avgX) && c.avgX > shackleX)
              .sort((a, b) => Math.abs(a.avgX - shackleX) - Math.abs(b.avgX - shackleX))[0];

            if (left) picked.push(left);
            if (right) picked.push(right);
          }

          if (picked.length < 2) {
            const byLen = topBand.slice().sort((a, b) => b.length - a.length);
            byLen.forEach((c) => {
              if (picked.length >= 2) return;
              if (!picked.some((p) => p.runId === c.runId)) picked.push(c);
            });
          }

          // If still only one top run exists, we'll still gap it once (better than nothing).
          picked.slice(0, 2).forEach((c) => specialOneGapTopRunIds.add(c.runId));
        }

        // As a fallback, if we couldn't detect the shackle and no top runs were found,
        // pick the top-most selected horizontal run.
        if (!specialOneGapTopRunIds.size) {
          let bestRunId = null;
          let bestScore = Infinity;
          selectedRunIds.forEach((runId) => {
            const stat = runStats[runId];
            if (!stat || !stat.count) return;
            const angle = stat.baseAngle;
            if (!isHorizontalAngle(angle, HORIZONTAL_TOLERANCE_RAD)) return;
            const score = Number.isFinite(shackleY)
              ? Math.abs(stat.avgY - shackleY)
              : stat.avgY;
            if (score < bestScore) {
              bestScore = score;
              bestRunId = runId;
            }
          });
          if (bestRunId != null) specialOneGapTopRunIds.add(bestRunId);
        }
      }

      const buildIntervalsForRun = (runLen, twoGaps) => {
        if (!Number.isFinite(runLen) || runLen <= 0) return [];
        const effectiveGap = Math.min(gap, runLen * 0.9);
        if (runLen <= effectiveGap + 0.01) return [];

        const makeInterval = (center) => {
          const start = Math.max(0, center - effectiveGap / 2);
          const end = Math.min(runLen, center + effectiveGap / 2);
          return end > start + 1e-6 ? { start, end } : null;
        };

        if (twoGaps) {
          // Two gaps on the top edge near the shackle: slightly closer to center than 1/3 & 2/3.
          // This tends to match the shackle legs position better across templates.
          const i1 = makeInterval(runLen * (0.5 - 0.18));
          const i2 = makeInterval(runLen * (0.5 + 0.18));
          if (!i1 || !i2) {
            const i = makeInterval(runLen / 2);
            return i ? [i] : [];
          }
          // If gaps overlap (too short run), fall back to a single center gap.
          if (i1.end >= i2.start - 1e-3) {
            const i = makeInterval(runLen / 2);
            return i ? [i] : [];
          }
          return [i1, i2];
        }

        const i = makeInterval(runLen / 2);
        return i ? [i] : [];
      };

      const intervalsByRunId = new Map();
      const forcedRunIds = new Set([...specialOneGapTopRunIds]);
      const runIdsToProcess = new Set([...selectedRunIds, ...forcedRunIds]);

      runIdsToProcess.forEach((runId) => {
        const run = runs[runId];
        const runLen = run?.length || 0;
        const twoGaps = false;

        // Lock-top runs: always single gap per run (two runs => two gaps).
        const intervals = buildIntervalsForRun(runLen, twoGaps);
        if (intervals.length) {
          intervalsByRunId.set(runId, intervals);
        }
      });

      const appendCurveWithIntervals = (curve, meta, runId, off0) => {
        if (!curve || !meta || !Number.isFinite(meta.length) || meta.length <= 0) {
          addCurveToCommands(curve, commands);
          return;
        }
        const intervals = intervalsByRunId.get(runId);
        if (!intervals || intervals.length === 0) {
          addCurveToCommands(curve, commands);
          return;
        }

        const localIntervals = intervals
          .map((it) => {
            const start = Math.max(0, it.start - off0);
            const end = Math.min(meta.length, it.end - off0);
            return end > start + 1e-6 ? { start, end } : null;
          })
          .filter(Boolean)
          .sort((a, b) => a.start - b.start);

        if (!localIntervals.length) {
          addCurveToCommands(curve, commands);
          return;
        }

        let cursorT = 0;
        for (const it of localIntervals) {
          const tStart = curve.getTimeAt(it.start);
          const tEnd = curve.getTimeAt(it.end);
          if (!Number.isFinite(tStart) || !Number.isFinite(tEnd) || tEnd <= tStart) {
            continue;
          }

          if (tStart > cursorT + 1e-6) {
            const before = curve.getPart(cursorT, tStart);
            if (before) {
              addCurveToCommands(before, commands);
            }
          }

          // Move to the point right after the gap.
          const resumePoint =
            typeof curve.getPointAt === "function" ? curve.getPointAt(it.end) : null;
          if (resumePoint && Number.isFinite(resumePoint.x) && Number.isFinite(resumePoint.y)) {
            commands.push(
              `M${formatSvgNumber(resumePoint.x)} ${formatSvgNumber(resumePoint.y)}`
            );
          }

          cursorT = tEnd;
        }

        if (cursorT < 1 - 1e-6) {
          const after = curve.getPart(cursorT, 1);
          if (after) {
            addCurveToCommands(after, commands);
          }
        }
      };

      curves.forEach((curve, i) => {
        const meta = curveMeta[i];
        if (!curve || !meta) return;

        // Never gap true curved segments when we also have straight runs.
        if (hasCurved && !meta.isStraight) {
          addCurveToCommands(curve, commands);
          return;
        }

        const runId = runIdByCurveIndex[i];
        if (runId == null || !meta.isStraight || !intervalsByRunId.has(runId)) {
          addCurveToCommands(curve, commands);
          return;
        }

        const off0 = offsetBeforeCurveInRun[i] || 0;
        appendCurveWithIntervals(curve, meta, runId, off0);
      });
    });

    scope.project.clear();
    return commands.join(" ");
  } catch (error) {
    console.warn("Error generating gapped path", error);
    try {
      scope.project.clear();
    } catch {}
    return null;
  }
};

const replaceNodeWithPathData = (node, pathData) => {
  if (!node || !pathData) return null;
  const parent = node.parentNode;
  if (!parent || typeof document === "undefined") return null;

  const ns = node.namespaceURI || "http://www.w3.org/2000/svg";
  const path = document.createElementNS(ns, "path");

  Array.from(node.attributes || []).forEach(({ name, value }) => {
    if (!name) return;
    if (GEOMETRY_ATTRIBUTES_TO_SKIP.has(name)) return;
    if (name === "points" || name === "d") return;
    path.setAttribute(name, value);
  });

  path.setAttribute("d", pathData);
  path.setAttribute("fill", "none");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  path.setAttribute("stroke", node.getAttribute("stroke") || OUTLINE_STROKE_COLOR);
  path.setAttribute(
    "stroke-linejoin",
    node.getAttribute("stroke-linejoin") || "round"
  );
  path.setAttribute(
    "stroke-linecap",
    node.getAttribute("stroke-linecap") || "round"
  );

  parent.replaceChild(path, node);
  return path;
};

const applyCenteredGapsToCanvasOutline = (rootElement, gapPx = OUTLINE_CENTER_GAP_PX) => {
  if (!rootElement?.querySelectorAll) return;
  if (!Number.isFinite(gapPx) || gapPx <= 0) return;

  const scope = ensurePaperScope();
  if (!scope) return;

  const selectors = [
    '[id="canvaShape"]',
    '[data-canvas-outline="true"]',
    '[data-export-border-blue="true"]',
  ];

  const nodes = [];
  selectors.forEach((selector) => {
    try {
      nodes.push(...rootElement.querySelectorAll(selector));
    } catch {
      // ignore selector issues silently
    }
  });

  const uniqueNodes = Array.from(new Set(nodes));

  uniqueNodes.forEach((node) => {
    if (!node || node.getAttribute?.("data-inner-contour") === "true") return;
    if (node.getAttribute?.("data-export-border")) return;
    const nodeId = node.getAttribute?.("id") || "";
    if (nodeId.startsWith(HOLE_ID_PREFIX)) return;
    if (node.getAttribute?.(CUT_TYPE_ATTRIBUTE) === HOLE_CUT_TYPE) return;

    const pathData = generateGappedPathData(scope, node, gapPx);
    if (!pathData) return;

    replaceNodeWithPathData(node, pathData);
  });
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
        const toPathFn = typeof item.toPath === "function" ? item.toPath : null;
        const createPathFn =
          typeof item.createPath === "function" ? item.createPath : null;

        const outline = toPathFn
          ? toPathFn.call(item, true)
          : createPathFn
          ? createPathFn.call(item)
          : null;

        if (!outline && !warnedPointTextOutlineUnsupported) {
          warnedPointTextOutlineUnsupported = true;
          console.warn(
            "Paper.js cannot outline PointText in this build; falling back to stroked <text> elements during PDF export."
          );
        }

        if (outline) {
          if (Array.isArray(outline)) outline.forEach(collectOutlines);
          else collectOutlines(outline);
        }
      } catch (error) {
        // This is a non-fatal best-effort conversion step.
        console.warn("Paper.js failed to convert PointText to path", error);
      }
      try {
        item.remove();
      } catch {}
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

const buildPlacementPreview = (placement, options = {}) => {
  const { enableGaps = true } = options;
  const { svg, preview, customBorder } = placement || {};

  if (svg && typeof window !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg, "image/svg+xml");
      const svgElement = doc.documentElement.cloneNode(true);

      // Ensure there is always an explicit outer-canvas outline element (`#canvaShape`).
      // Some templates only provide border nodes (e.g. `#canvaShapeCustom` / `border-*`).
      // We create a dedicated blue outline from those nodes so the canvas outline never disappears.
      const ensureCanvaShapeOutline = () => {
        if (!svgElement?.querySelector) return;
        if (svgElement.querySelector('[id="canvaShape"]')) {
          return;
        }

        // Do NOT pick hole elements as the canvas outline candidate.
        const findValidCandidate = (selector) => {
          const nodes = svgElement.querySelectorAll(selector);
          return Array.from(nodes).find((node) => {
            const nodeId = node.getAttribute("id") || "";
            if (nodeId.startsWith("hole-")) return false;
            if (node.getAttribute(CUT_TYPE_ATTRIBUTE) === HOLE_CUT_TYPE) return false;
            return true;
          }) || null;
        };

        const candidate =
          findValidCandidate('[id="canvaShapeCustom"]') ||
          findValidCandidate('[id^="border"]');
        if (!candidate) {
          return;
        }

        try {
          const BLUE_COLOR = "#0000FF";
          const clone = candidate.cloneNode(true);
          if (!clone || typeof clone.setAttribute !== "function") return;

          clone.setAttribute("id", "canvaShape");
          clone.setAttribute("data-canvas-outline", "true");

          // Apply blue stroke to any geometry within the cloned outline.
          const applyBlueToGeometry = (node) => {
            if (!node || node.nodeType !== 1) return;
            const tag = node.tagName ? node.tagName.toLowerCase() : "";
            if (GEOMETRY_TAG_SET.has(tag)) {
              node.setAttribute("stroke", BLUE_COLOR);
              node.setAttribute("fill", "none");
              node.setAttribute(
                "stroke-linejoin",
                node.getAttribute("stroke-linejoin") || "round"
              );
              node.setAttribute(
                "stroke-linecap",
                node.getAttribute("stroke-linecap") || "round"
              );
              node.setAttribute("vector-effect", "non-scaling-stroke");
              const style = node.getAttribute("style") || "";
              const cleaned = style
                .replace(/stroke\s*:[^;]+;?/gi, "")
                .replace(/fill\s*:[^;]+;?/gi, "");
              node.setAttribute(
                "style",
                `${cleaned};stroke:${BLUE_COLOR};fill:none;`
              );
            }
            Array.from(node.children || []).forEach(applyBlueToGeometry);
          };
          applyBlueToGeometry(clone);

          // Put the outline early in the tree so it renders underneath the green border.
          svgElement.insertBefore(clone, svgElement.firstChild);
        } catch {
          // ignore
        }
      };

      ensureCanvaShapeOutline();

      const rawWidth = parseFloat(svgElement.getAttribute("width"));
      const rawHeight = parseFloat(svgElement.getAttribute("height"));
      const hasViewBox = !!svgElement.getAttribute("viewBox");
      // Ensure the outer canvas outline stays blue, without recoloring the whole artwork.
      const canvaShapes = svgElement.querySelectorAll('[id="canvaShape"]');
      canvaShapes.forEach((shape) => {
        const BLUE_COLOR = "#0000FF";
        const tag = shape?.tagName ? shape.tagName.toLowerCase() : "";

        const setBlueStroke = (node) => {
          if (!node || typeof node.setAttribute !== "function") return;
          node.setAttribute("data-canvas-outline", "true");
          node.setAttribute("stroke", BLUE_COLOR);
          const style = node.getAttribute("style") || "";
          const cleaned = style
            .replace(/stroke\s*:[^;]+;?/gi, "")
            .replace(/fill\s*:[^;]+;?/gi, "");
          node.setAttribute("style", `${cleaned};stroke:${BLUE_COLOR};fill:none;`);
          node.setAttribute("fill", "none");
          node.setAttribute("vector-effect", "non-scaling-stroke");
        };

        // Skip if this node is a hole element – holes should NOT become the blue outline.
        const shapeId = shape.getAttribute("id") || "";
        const isHole =
          shapeId.startsWith("hole-") ||
          shape.getAttribute(CUT_TYPE_ATTRIBUTE) === HOLE_CUT_TYPE;
        if (isHole) {
          return;
        }

        if (GEOMETRY_TAG_SET.has(tag)) {
          setBlueStroke(shape);
          return;
        }

        // If it's a group, recolor only ONE geometry descendant that is NOT a hole.
        const geometries = shape.querySelectorAll?.(
          "path,rect,circle,ellipse,polygon,polyline,line"
        );
        const geometry = Array.from(geometries || []).find((el) => {
          const elId = el.getAttribute("id") || "";
          if (elId.startsWith("hole-")) return false;
          if (el.getAttribute(CUT_TYPE_ATTRIBUTE) === HOLE_CUT_TYPE) return false;
          // Also skip elements that are nested inside a hole group.
          const holeParent = el.closest?.(HOLE_NODE_SELECTOR);
          if (holeParent) return false;
          return true;
        });
        if (geometry) {
          setBlueStroke(geometry);
        }
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

      // If border is disabled, remove border nodes so only the single blue canvas outline remains.
      // Important: do not remove anything inside `#canvaShape` (it may be a clone of border nodes).
      const stripBorderNodesWhenDisabled = (rootElement) => {
        if (!rootElement?.querySelectorAll) return;
        if (customBorder?.mode === "custom") return;

        const canvaShape = rootElement.querySelector?.('#canvaShape') || null;
        const candidates = Array.from(
          rootElement.querySelectorAll(
            '[id="canvaShapeCustom"], [id^="border"], [data-export-border], [data-export-border-blue="true"]'
          )
        );

        candidates.forEach((node) => {
          if (!node || node.nodeType !== 1) return;
          if (node === canvaShape) return;
          if (canvaShape && canvaShape.contains(node)) return;

          const parent = node.parentNode;
          if (parent) parent.removeChild(node);
        });
      };

      const exportElement = svgElement.cloneNode(true);

      stripBorderNodesWhenDisabled(exportElement);

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
      removeBackgroundsForExport(exportElement);

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
      addInnerContoursForShapes(exportElement, {
        enableBorderContours: customBorder?.mode === "custom",
        borderThicknessPx:
          customBorder?.mode === "custom" ? CUSTOM_BORDER_CONTOUR_GAP_PX : null,
      });
      // recolorStrokeAttributes(exportElement);

      // Конвертуємо текст у контури, щоб шрифт збігався з оригіналом
      convertTextToOutlinedPaths(exportElement);

      // Якщо якісь <text> залишились (помилка конвертації) — застосовуємо stroke як fallback
      const textNodes = Array.from(exportElement.querySelectorAll("text"));
      textNodes.forEach((textNode) => {
        applyStrokeStyleRecursive(textNode, TEXT_STROKE_COLOR);
      });

      applyCustomBorderOverrides(exportElement, customBorder);
      if (enableGaps) {
        applyCenteredGapsToCanvasOutline(exportElement, OUTLINE_CENTER_GAP_PX);
      }
      styleLineFromCircleElements(exportElement);

      const previewElement = svgElement.cloneNode(true);
      previewElement.setAttribute("width", "100%");
      previewElement.setAttribute("height", "100%");

      stripBorderNodesWhenDisabled(previewElement);

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
      addInnerContoursForShapes(previewElement, {
        enableBorderContours: customBorder?.mode === "custom",
        borderThicknessPx:
          customBorder?.mode === "custom" ? CUSTOM_BORDER_CONTOUR_GAP_PX : null,
      });
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
  const [enableGaps, setEnableGaps] = useState(true);
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
          const previewData = buildPlacementPreview(placement, { enableGaps });

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
  }, [formatKey, isExporting, sheets, spacingMm, enableGaps]);

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

          <div className={styles.controlGroup}>
            <span>Розриви контуру</span>
            <button
              type="button"
              className={enableGaps ? styles.orientationActive : ""}
              onClick={() => setEnableGaps(!enableGaps)}
              style={{
                padding: "6px 12px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                background: enableGaps ? "#e6f7ff" : "#fff",
                cursor: "pointer",
                marginLeft: "10px"
              }}
            >
              {enableGaps ? "Увімкнено" : "Вимкнено"}
            </button>
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
                        const previewData = buildPlacementPreview(placement, {
                          enableGaps,
                        });
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
