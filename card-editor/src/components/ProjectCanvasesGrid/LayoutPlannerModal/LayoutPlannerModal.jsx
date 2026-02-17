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
  MJ_295x600: { label: "MJ 295×600", width: 295, height: 600 },
};

const MJ_FRAME_STRIP_WIDTH_MM = 9.5;
const MJ_FRAME_HOLE_DIAMETER_MM = 5.5;
const MJ_FRAME_HOLE_SPACING_MM = 80;
const MJ_FRAME_SECOND_HOLE_MIN_HEIGHT_MM = 135;
const MJ_FRAME_STRIP_COLOR = "#8B4513";
const MJ_FRAME_CORNER_RADIUS_MM = 5;

const normalizeProjectIdForLabel = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const uuidMatch = trimmed.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    return uuidMatch ? uuidMatch[0] : trimmed;
  }
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "object") {
    const candidate =
      value._id ??
      value.id ??
      value.oid ??
      value.$oid ??
      (value._id && (value._id.$oid ?? value._id.oid)) ??
      null;
    if (candidate && typeof candidate === "string") {
      const trimmed = candidate.trim();
      return trimmed ? trimmed : null;
    }
    try {
      const asString = String(value);
      if (asString && asString !== "[object Object]") return asString;
    } catch {}
  }
  return null;
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
  // Keep hole strokes visually present but geometrically negligible for CAD/CAM measurement.
  // Using a tiny value avoids LightBurn reading offsets from the inner stroke edge.
  node.setAttribute("stroke-width", "0.01");
  node.setAttribute("vector-effect", "non-scaling-stroke");
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

const normalizeHexColor = (value) => {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return null;
  const noSpaces = raw.replace(/\s+/g, "");
  const shortHex = /^#([0-9a-f]{3})$/i;
  const shortHexWithAlpha = /^#([0-9a-f]{4})$/i;
  const match3 = noSpaces.match(shortHex);
  if (match3) {
    const [r, g, b] = match3[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const match4 = noSpaces.match(shortHexWithAlpha);
  if (match4) {
    const [r, g, b, a] = match4[1].split("");
    return `#${r}${r}${g}${g}${b}${b}${a}${a}`;
  }
  return noSpaces;
};

const normalizeThicknessMm = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  // Round to 2 decimals to avoid float noise
  return Math.round(numeric * 100) / 100;
};

const normalizeTapeFlag = (value) => {
  if (value === true) return true;
  if (value === false) return false;
  if (value === 1) return true;
  if (value === 0) return false;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no") return false;
  }
  return null;
};

const COLOR_LABEL_BY_INDEX = {
  0: "White / Black",
  1: "White / Blue",
  2: "White / Red",
  3: "Black / White",
  4: "Blue / White",
  5: "Red / White",
  6: "Green / White",
  7: "Yellow / Black",
  8: "Silver / Black",
  9: "Brown / White",
  10: "Orange / White",
  11: "Gray / White",
  12: "“Wood” / Black",
  13: "Carbon / White",
};

const normalizeSlashLabel = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;

  // Normalize spaces around slash but keep original words/case.
  if (raw.includes("/")) {
    const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]} / ${parts[1]}`;
    }
  }
  return raw;
};

const resolveMaterialColorLabel = ({ selectedColorIndex, backgroundColor, strokeColor }) => {
  const idx = Number(selectedColorIndex);
  if (Number.isFinite(idx) && COLOR_LABEL_BY_INDEX[idx] != null) {
    return COLOR_LABEL_BY_INDEX[idx];
  }

  const bgRaw = typeof backgroundColor === "string" ? backgroundColor.trim() : "";
  const strokeRaw = typeof strokeColor === "string" ? strokeColor.trim() : "";

  // If already stored as "White / Black" etc.
  const combined = normalizeSlashLabel(bgRaw);
  if (combined && combined.includes(" / ")) return combined;

  const normalizeName = (color) => {
    const c = normalizeHexColor(color);
    if (!c) return null;
    if (c === "#ffffff" || c === "#ffffffff") return "White";
    if (c === "#000000" || c === "#000000ff") return "Black";
    if (c === "#0000ff" || c === "#0000ffff") return "Blue";
    if (c === "#ff0000" || c === "#ff0000ff") return "Red";
    if (c === "#018001" || c === "#018001ff") return "Green";
    if (c === "#ffff00" || c === "#ffff00ff") return "Yellow";
    if (c === "#808080" || c === "#808080ff") return "Gray";
    if (c === "#8b4513" || c === "#8b4513ff") return "Brown";
    if (c === "#ffa500" || c === "#ffa500ff") return "Orange";
    if (c === "#f0f0f0" || c === "#f0f0f0ff") return "Silver";
    return null;
  };

  const textureLabel = (() => {
    const lowerBg = bgRaw.toLowerCase();
    if (lowerBg.includes("wood")) return "“Wood”";
    if (lowerBg.includes("carbon")) return "Carbon";
    return null;
  })();

  const bgName = textureLabel || normalizeName(bgRaw);
  const strokeName = normalizeName(strokeRaw);

  if (bgName && strokeName) {
    return `${bgName} / ${strokeName}`;
  }

  // Fallback: keep something stable for grouping.
  return normalizeSlashLabel(bgRaw) || normalizeHexColor(bgRaw) || "unknown";
};

const getMaterialKey = (item) => {
  // Primary: canvas/background color + material thickness
  // Fallbacks remain for older data so export doesn't regress.
  const colorRaw =
    item?.materialColor ??
    item?.customBorder?.exportStrokeColor ??
    item?.customBorder?.displayStrokeColor ??
    item?.themeStrokeColor ??
    null;
  const thicknessMm =
    normalizeThicknessMm(item?.materialThicknessMm) ??
    normalizeThicknessMm(
      item?.customBorder?.thicknessPx
        ? item?.customBorder?.thicknessPx / PX_PER_MM
        : null
    );
  const color = normalizeHexColor(colorRaw) || "unknown";
  const thickness = thicknessMm !== null ? String(thicknessMm) : "unknown";

  const tapeRaw =
    item?.isAdhesiveTape ??
    item?.meta?.isAdhesiveTape ??
    item?.toolbarState?.isAdhesiveTape ??
    null;
  const tape = normalizeTapeFlag(tapeRaw);
  const tapeKey = tape === true ? "tape" : tape === false ? "no-tape" : "unknown-tape";

  return `${color}::${thickness}::${tapeKey}`;
};

const formatMaterialLabel = ({ color, thickness, tape }) => {
  const colorLabel = (() => {
    const raw = typeof color === "string" ? color.trim() : "";
    const withSlash = normalizeSlashLabel(raw);
    if (withSlash && withSlash.includes(" / ")) return withSlash;
    // Fall back to previous behavior for hex-only cases.
    const normalizedColor = normalizeHexColor(color) || "unknown";
    if (normalizedColor === "#ffffff" || normalizedColor === "#ffffffff") return "White";
    if (normalizedColor === "#000000" || normalizedColor === "#000000ff") return "Black";
    return normalizedColor;
  })();

  const thicknessLabel =
    thickness === "unknown" || thickness === null || thickness === undefined
      ? "unknown"
      : (() => {
          const numeric = Number(thickness);
          if (!Number.isFinite(numeric)) return String(thickness);
          // Ukrainian comma decimal separator.
          return numeric.toLocaleString("uk-UA", {
            minimumFractionDigits: numeric % 1 === 0 ? 0 : 1,
            maximumFractionDigits: 2,
          });
        })();

  const tapeLabel = tape === "tape" ? "Tape" : tape === "no-tape" ? "No tape" : "Tape?";
  return `${colorLabel} ${thicknessLabel} mm · ${tapeLabel}`;
};

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

      // Матеріальні параметри (для групування сторінок PDF):
      // - color: backgroundColor (колір/текстура основи)
      // - thickness: toolbarState.thickness (мм)
      const backgroundColor =
        design?.toolbarState?.globalColors?.backgroundColor ??
        design?.backgroundColor ??
        design?.meta?.backgroundColor ??
        null;
      const strokeColor =
        design?.toolbarState?.globalColors?.strokeColor ??
        design?.toolbarState?.globalColors?.textColor ??
        design?.toolbarState?.globalColors?.fillColor ??
        null;
      const materialColor = resolveMaterialColorLabel({
        selectedColorIndex: design?.toolbarState?.selectedColorIndex,
        backgroundColor,
        strokeColor,
      });
      const materialThicknessMm = (() => {
        const candidates = [
          design?.toolbarState?.thickness,
          design?.thickness,
          design?.meta?.thickness,
        ];
        for (const candidate of candidates) {
          const numeric = Number(candidate);
          if (Number.isFinite(numeric) && numeric > 0) return numeric;
        }
        return null;
      })();

      const isAdhesiveTape = (() => {
        const candidates = [
          design?.toolbarState?.isAdhesiveTape,
          design?.isAdhesiveTape,
          design?.meta?.isAdhesiveTape,
        ];
        for (const candidate of candidates) {
          const parsed = normalizeTapeFlag(candidate);
          if (parsed !== null) return parsed;
        }
        return false;
      })();

      // Legacy: theme stroke color (used for export SVG tweaks)
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
        materialColor,
        materialThicknessMm,
        isAdhesiveTape,
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

const planSheets = (
  items,
  sheetSize,
  spacingMm,
  pageMarginMm = 0,
  frameSpacingMm = 0,
  layoutOptions = {}
) => {
  const {
    leftStripWidthMm = 0,
    disableLeftFrameSpacing = false,
    optimizeToContent = false,
    maxSheetWidthMm = null,
    maxSheetHeightMm = null,
  } = layoutOptions || {};

  const safePageMargin = Math.max(0, Number(pageMarginMm) || 0);
  const safeFrameSpacing = Math.max(0, Number(frameSpacingMm) || 0);

  const stripWidthMm = Math.max(0, Number(leftStripWidthMm) || 0);
  const leftInset = safePageMargin + stripWidthMm + (disableLeftFrameSpacing ? 0 : safeFrameSpacing);
  const topInset = safePageMargin + safeFrameSpacing;
  const rightInset = safePageMargin + safeFrameSpacing;
  const bottomInset = safePageMargin + safeFrameSpacing;

  const sheetInnerWidth = sheetSize.width - leftInset - rightInset;
  const sheetInnerHeight = sheetSize.height - topInset - bottomInset;

  if (sheetInnerWidth <= 0 || sheetInnerHeight <= 0) {
    return { sheets: [], leftovers: items };
  }

  const sheets = [];
  const leftovers = [];

  const EPS = 0.001;

  const intersects = (a, b) => {
    return (
      a.x < b.x + b.width - EPS &&
      a.x + a.width > b.x + EPS &&
      a.y < b.y + b.height - EPS &&
      a.y + a.height > b.y + EPS
    );
  };

  const getInnerRect = (placement) => ({
    x: placement.x - leftInset,
    y: placement.y - topInset,
    width: placement.width,
    height: placement.height,
  });

  const canPlaceAt = (sheet, candidate) => {
    if (candidate.x < 0 || candidate.y < 0) return false;
    if (candidate.x + candidate.width > sheetInnerWidth + EPS) return false;
    if (candidate.y + candidate.height > sheetInnerHeight + EPS) return false;

    const inflatedExisting = (p) => {
      const r = getInnerRect(p);
      const pad = Math.max(0, Number(spacingMm) || 0);
      return {
        x: r.x - pad,
        y: r.y - pad,
        width: r.width + pad * 2,
        height: r.height + pad * 2,
      };
    };

    for (const existing of sheet.placements) {
      if (intersects(candidate, inflatedExisting(existing))) {
        return false;
      }
    }

    return true;
  };

  const findTopLeftPosition = (sheet, width, height) => {
    const xs = new Set([0]);
    const ys = new Set([0]);

    sheet.placements.forEach((p) => {
      const r = getInnerRect(p);
      xs.add(r.x);
      xs.add(r.x + r.width + spacingMm);
      ys.add(r.y);
      ys.add(r.y + r.height + spacingMm);
    });

    const xCandidates = Array.from(xs).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    const yCandidates = Array.from(ys).filter((y) => Number.isFinite(y)).sort((a, b) => a - b);

    for (const y of yCandidates) {
      for (const x of xCandidates) {
        const candidate = { x, y, width, height };
        if (canPlaceAt(sheet, candidate)) {
          return { x, y };
        }
      }
    }

    return null;
  };

  const orientationsFor = (item) => {
    const normal = { width: item.widthMm, height: item.heightMm, rotated: false };

    if (Math.abs(item.widthMm - item.heightMm) <= 0.01) {
      return [normal];
    }

    const rotated = { width: item.heightMm, height: item.widthMm, rotated: true };

    const fits = (candidate) =>
      candidate.width <= sheetInnerWidth + 0.001 &&
      candidate.height <= sheetInnerHeight + 0.001;

    // If it doesn't fit by width in the default orientation but fits when rotated,
    // try rotated first (auto-rotate to ensure it can be placed).
    if (!fits(normal) && fits(rotated)) {
      return [rotated, normal];
    }

    return [normal, rotated];
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
        materialColor: item.materialColor ?? null,
        materialThicknessMm: item.materialThicknessMm ?? null,
        isAdhesiveTape: item.isAdhesiveTape ?? false,
        themeStrokeColor: item.themeStrokeColor || null, // Зберігаємо колір теми
        customBorder: item.customBorder || null,
      });
    }
  });

  const packQueueIntoSheets = (queueItems, sortOrder = "high-first") => {
    const groupSheets = [];
    const groupLeftovers = [];

    const orderedItems = [...queueItems].sort((a, b) => {
      const areaA = Number(a?.area) || 0;
      const areaB = Number(b?.area) || 0;
      if (areaA === areaB) return String(a?.id || "").localeCompare(String(b?.id || ""));
      return sortOrder === "low-first" ? areaA - areaB : areaB - areaA;
    });

    orderedItems.forEach((item) => {
      const orientations = orientationsFor(item);
      let placed = false;

      for (const sheet of groupSheets) {
        for (const orientation of orientations) {
          const pos = findTopLeftPosition(sheet, orientation.width, orientation.height);
          if (!pos) continue;

          const placement = {
            id: item.id,
            name: item.label || item.name,
            width: orientation.width,
            height: orientation.height,
            x: leftInset + pos.x,
            y: topInset + pos.y,
            rotated: orientation.rotated,
            meta: item.meta,
            sourceWidth: item.widthMm,
            sourceHeight: item.heightMm,
            baseId: item.baseId ?? item.id,
            copyIndex: item.copyIndex ?? 1,
            copies: item.copies ?? 1,
            svg: item.svg || null,
            preview: item.preview || null,
            materialColor: item.materialColor ?? null,
            materialThicknessMm: item.materialThicknessMm ?? null,
            isAdhesiveTape: item.isAdhesiveTape ?? false,
            themeStrokeColor: item.themeStrokeColor || null,
            customBorder: item.customBorder || null,
          };

          sheet.placements.push(placement);
          sheet.usedArea += item.area;
          placed = true;
          break;
        }
        if (placed) break;
      }

      if (!placed) {
        const newSheet = {
          width: sheetSize.width,
          height: sheetSize.height,
          pageMarginMm: safePageMargin,
          frameSpacingMm: safeFrameSpacing,
          leftInset,
          topInset,
          rightInset,
          bottomInset,
          leftStripWidthMm: stripWidthMm,
          placements: [],
          usedArea: 0,
        };

        for (const orientation of orientations) {
          const pos = findTopLeftPosition(newSheet, orientation.width, orientation.height);
          if (!pos) continue;

          const placement = {
            id: item.id,
            name: item.label || item.name,
            width: orientation.width,
            height: orientation.height,
            x: leftInset + pos.x,
            y: topInset + pos.y,
            rotated: orientation.rotated,
            meta: item.meta,
            sourceWidth: item.widthMm,
            sourceHeight: item.heightMm,
            baseId: item.baseId ?? item.id,
            copyIndex: item.copyIndex ?? 1,
            copies: item.copies ?? 1,
            svg: item.svg || null,
            preview: item.preview || null,
            materialColor: item.materialColor ?? null,
            materialThicknessMm: item.materialThicknessMm ?? null,
            isAdhesiveTape: item.isAdhesiveTape ?? false,
            themeStrokeColor: item.themeStrokeColor || null,
            customBorder: item.customBorder || null,
          };

          newSheet.placements.push(placement);
          newSheet.usedArea += item.area;
          groupSheets.push(newSheet);
          placed = true;
          break;
        }

        if (!placed) groupLeftovers.push(item);
      }
    });

    if (optimizeToContent) {
      groupSheets.forEach((sheet) => {
        const placements = Array.isArray(sheet?.placements) ? sheet.placements : [];
        if (placements.length === 0) return;

        const maxRight = placements.reduce(
          (acc, p) => Math.max(acc, (Number(p?.x) || 0) + (Number(p?.width) || 0)),
          0
        );
        const maxBottom = placements.reduce(
          (acc, p) => Math.max(acc, (Number(p?.y) || 0) + (Number(p?.height) || 0)),
          0
        );

        let desiredWidth = maxRight + rightInset;
        let desiredHeight = maxBottom + bottomInset;

        desiredWidth = Math.max(desiredWidth, stripWidthMm);

        if (Number.isFinite(maxSheetWidthMm) && maxSheetWidthMm > 0) {
          desiredWidth = Math.min(desiredWidth, maxSheetWidthMm);
        }
        if (Number.isFinite(maxSheetHeightMm) && maxSheetHeightMm > 0) {
          desiredHeight = Math.min(desiredHeight, maxSheetHeightMm);
        }

        sheet.width = Math.min(sheet.width, desiredWidth);
        sheet.height = Math.min(sheet.height, desiredHeight);
      });
    }

    return { sheets: groupSheets, leftovers: groupLeftovers };
  };

  // PDF requirement: a single sheet/page must contain items of ONLY one border color and one thickness.
  // If color OR thickness differs, items must be placed on separate pages.
  const groups = new Map();
  const groupOrder = [];
  queue.forEach((item) => {
    const key = getMaterialKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
      groupOrder.push(key);
    }
    groups.get(key).push(item);
  });

  groupOrder.forEach((key) => {
    const { sheets: groupSheets, leftovers: groupLeftovers } = packQueueIntoSheets(
      groups.get(key) || [],
      sheetSize.sortOrder || "high-first"
    );
    sheets.push(...groupSheets);
    leftovers.push(...groupLeftovers);
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
      // Ensure the circle line uses the standard accent color and is above frame elements
      el.setAttribute("stroke", "#008181");
      el.setAttribute("fill", "none");
      el.setAttribute("pointer-events", "none");
      const style = el.getAttribute("style") || "";
      const newStyle =
        style
          .replace(/stroke\s*:[^;]+;?/gi, "")
          .replace(/fill\s*:[^;]+;?/gi, "") + ";stroke:#008181;fill:none;pointer-events:none;";
      el.setAttribute("style", newStyle);

      // Move LineFromCircle element to the end of the SVG so it renders on top of the frame.
      // This hides the overlapping right-side frame segment and visually places the
      // line above the border (appearing to push the left border "behind" the circle).
      try {
        const parent = el.parentNode || svgElement;
        parent.appendChild(el);
      } catch (e) {
        // ignore DOM reorder failures
      }
    });
  });
};

const buildPlacementPreview = (placement, options = {}) => {
  const { enableGaps = true, hideFrames = false } = options;
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

      const applyRotationIfNeeded = (rootElement, width, height) => {
        if (!placement?.rotated) return;
        if (!rootElement) return;
        if (!Number.isFinite(width) || !Number.isFinite(height)) return;
        if (width <= 0 || height <= 0) return;

        const ns = rootElement.namespaceURI || "http://www.w3.org/2000/svg";
        const wrapper = doc.createElementNS(ns, "g");
        wrapper.setAttribute("data-layout-rotated", "true");
        wrapper.setAttribute("transform", `translate(${height},0) rotate(90)`);

        const nodesToWrap = Array.from(rootElement.childNodes || []).filter(
          (node) => {
            if (node.nodeType !== 1) return true; // keep non-elements (text/comments) wrapped too
            const tag = node.nodeName.toLowerCase();
            return tag !== "defs";
          }
        );

        nodesToWrap.forEach((node) => {
          wrapper.appendChild(node);
        });

        rootElement.appendChild(wrapper);

        // Swap viewBox to match rotated coordinate system.
        rootElement.setAttribute("viewBox", `0 0 ${height} ${width}`);

        // If explicit numeric width/height are present, swap them as well.
        const rawW = parseFloat(rootElement.getAttribute("width"));
        const rawH = parseFloat(rootElement.getAttribute("height"));
        if (Number.isFinite(rawW) && Number.isFinite(rawH)) {
          rootElement.setAttribute("width", String(rawH));
          rootElement.setAttribute("height", String(rawW));
        }
      };

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

      applyRotationIfNeeded(exportElement, viewBoxWidth, viewBoxHeight);

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

      const stripPreviewFrames = (rootElement) => {
        if (!rootElement?.querySelectorAll) return;

        const nodes = Array.from(
          rootElement.querySelectorAll(
            '[id="canvaShape"], [data-canvas-outline="true"], [id="canvaShapeCustom"], [id^="border"], [data-export-border], [data-export-border-blue="true"]'
          )
        );

        nodes.forEach((node) => {
          const parent = node?.parentNode;
          if (parent) parent.removeChild(node);
        });
      };

      if (!hideFrames) {
        recolorStrokeAttributes(previewElement, PREVIEW_OUTLINE_COLOR);
      }
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

      applyRotationIfNeeded(previewElement, viewBoxWidth, viewBoxHeight);

      if (hideFrames) {
        stripPreviewFrames(previewElement);
      }

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
  projectId = null,
}) => {
  const [formatKey, setFormatKey] = useState("MJ_295x600");
  const [orientation, setOrientation] = useState("portrait");
  const [enableGaps, setEnableGaps] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedMaterialKey, setSelectedMaterialKey] = useState("all");
  const [exportMode, setExportMode] = useState("Normal");

  const [frameSpacingMm, setFrameSpacingMm] = useState(3);

  const exportModePresets = useMemo(
    () => ({
      Normal: { enableGaps: false, formatKey: "MJ_295x600", orientation: "portrait" },
      "Normal (MJ) Frame": { enableGaps: true, formatKey: "MJ_295x600", orientation: "portrait" },
      "Sheet optimized (MJ) Fr.": { enableGaps: true, formatKey: "A4", orientation: "portrait" },
      "Sheet A4 portrait": { formatKey: "A4", orientation: "portrait" },
      "Sheet A5 portrait": { formatKey: "A5", orientation: "portrait" },
      "Sheet A4 landscape": { formatKey: "A4", orientation: "landscape" },
    }),
    []
  );

  // PDF settings UI (visual-only for now)
  const [pdfMinPageWidth, setPdfMinPageWidth] = useState(0);
  const [pdfMinPageHeight, setPdfMinPageHeight] = useState(0);
  const [pdfMaxPageWidth, setPdfMaxPageWidth] = useState(0);
  const [pdfMaxPageHeight, setPdfMaxPageHeight] = useState(0);
  const [pdfPageMargin, setPdfPageMargin] = useState(0);
  const [pdfSignSpacing, setPdfSignSpacing] = useState(2);
  const [pdfSortOrder, setPdfSortOrder] = useState("high-first");
  const [pdfAddSheetInfo, setPdfAddSheetInfo] = useState(true);

  // Applied page size constraints (debounced from the inputs).
  const [appliedMinPageWidth, setAppliedMinPageWidth] = useState(0);
  const [appliedMinPageHeight, setAppliedMinPageHeight] = useState(0);
  const [appliedMaxPageWidth, setAppliedMaxPageWidth] = useState(0);
  const [appliedMaxPageHeight, setAppliedMaxPageHeight] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = setTimeout(() => {
      setAppliedMinPageWidth(pdfMinPageWidth);
      setAppliedMinPageHeight(pdfMinPageHeight);
      setAppliedMaxPageWidth(pdfMaxPageWidth);
      setAppliedMaxPageHeight(pdfMaxPageHeight);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [
    isOpen,
    pdfMinPageWidth,
    pdfMinPageHeight,
    pdfMaxPageWidth,
    pdfMaxPageHeight,
  ]);

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
      setFormatKey("MJ_295x600");
      setSelectedMaterialKey("all");
      setExportMode("Normal");
      setEnableGaps(false);
      setFrameSpacingMm(3);

      setPdfMinPageWidth(0);
      setPdfMinPageHeight(0);
      setPdfMaxPageWidth(0);
      setPdfMaxPageHeight(0);

      setAppliedMinPageWidth(0);
      setAppliedMinPageHeight(0);
      setAppliedMaxPageWidth(0);
      setAppliedMaxPageHeight(0);

      setPdfPageMargin(0);
      setPdfSignSpacing(2);
      setPdfSortOrder("high-first");
      setPdfAddSheetInfo(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const preset = exportModePresets?.[exportMode];
    if (!preset) return;
    if (typeof preset.enableGaps === "boolean") {
      setEnableGaps(preset.enableGaps);
    }
    if (typeof preset.formatKey === "string" && preset.formatKey) {
      setFormatKey(preset.formatKey);
    }
    if (preset.orientation === "portrait" || preset.orientation === "landscape") {
      setOrientation(preset.orientation);
    }
  }, [exportMode, exportModePresets, isOpen]);

  const sheetSize = useMemo(() => {
    const isMjFrameMode = exportMode === "Sheet optimized (MJ) Fr.";
    const a4 = FORMATS.A4;

    const base = FORMATS[formatKey] || FORMATS.A4;
    const oriented = isMjFrameMode
      ? { width: a4.width, height: a4.height }
      : orientation === "landscape"
        ? { width: base.height, height: base.width }
        : { width: base.width, height: base.height };

    const minW = Math.max(0, Number(appliedMinPageWidth) || 0);
    const minH = Math.max(0, Number(appliedMinPageHeight) || 0);

    let maxW = Math.max(0, Number(appliedMaxPageWidth) || 0);
    let maxH = Math.max(0, Number(appliedMaxPageHeight) || 0);

    // Normalize inconsistent inputs.
    if (minW > 0 && maxW > 0 && maxW < minW) maxW = minW;
    if (minH > 0 && maxH > 0 && maxH < minH) maxH = minH;

    // Min values define the minimum allowed page size (only increase if the base is smaller).
    let width = oriented.width;
    let height = oriented.height;

    if (minW > 0) width = Math.max(width, minW);
    if (minH > 0) height = Math.max(height, minH);

    if (maxW > 0) width = Math.min(width, maxW);
    if (maxH > 0) height = Math.min(height, maxH);

    if (isMjFrameMode) {
      // Hard constraint: must not exceed A4.
      width = Math.min(width, a4.width);
      height = Math.min(height, a4.height);
    }

    return {
      width,
      height,
      label: isMjFrameMode ? a4.label : base.label,
    };
  }, [
    formatKey,
    orientation,
    exportMode,
    appliedMinPageWidth,
    appliedMinPageHeight,
    appliedMaxPageWidth,
    appliedMaxPageHeight,
  ]);

  const normalizedItems = useMemo(() => normalizeDesigns(designs), [designs]);

  const effectiveSignSpacingMm = (() => {
    const parsed = Number(pdfSignSpacing);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return spacingMm;
  })();

  const materialGroups = useMemo(() => {
    const groups = new Map();
    normalizedItems.forEach((item) => {
      const key = getMaterialKey(item);
      const existing = groups.get(key);
      const countToAdd = Math.max(1, Number(item?.copies) || 1);

      if (!existing) {
        const [colorPart, thicknessPart, tapePart] = String(key).split("::");
        groups.set(key, {
          key,
          color: colorPart || "unknown",
          thickness: thicknessPart || "unknown",
          tape: tapePart || "unknown-tape",
          count: countToAdd,
        });
      } else {
        existing.count += countToAdd;
      }
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.key.localeCompare(b.key);
    });
  }, [normalizedItems]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectedMaterialKey === "all") return;
    const exists = materialGroups.some((g) => g.key === selectedMaterialKey);
    if (!exists) {
      setSelectedMaterialKey("all");
    }
  }, [isOpen, materialGroups, selectedMaterialKey]);

  const isMjFrameMode = exportMode === "Sheet optimized (MJ) Fr.";
  const hasBrownFrame =
    exportMode === "Normal (MJ) Frame" || exportMode === "Sheet optimized (MJ) Fr.";

  const getSheetUsableArea = useCallback(
    (sheet) => {
      const w = Math.max(0, Number(sheet?.width) || 0);
      const h = Math.max(0, Number(sheet?.height) || 0);
      const leftInset = Math.max(0, Number(sheet?.leftInset) || 0);
      const rightInset = Math.max(0, Number(sheet?.rightInset) || 0);
      const topInset = Math.max(0, Number(sheet?.topInset) || 0);
      const bottomInset = Math.max(0, Number(sheet?.bottomInset) || 0);
      return Math.max(0, w - leftInset - rightInset) * Math.max(0, h - topInset - bottomInset);
    },
    []
  );

  const { sheets, leftovers } = useMemo(() => {
    const a4 = FORMATS.A4;
    const layoutOptions = isMjFrameMode
      ? {
          leftStripWidthMm: MJ_FRAME_STRIP_WIDTH_MM,
          disableLeftFrameSpacing: true,
          optimizeToContent: true,
          maxSheetWidthMm: a4.width,
          maxSheetHeightMm: a4.height,
        }
      : {};

    const safePageMarginMm = Math.max(0, Number(pdfPageMargin) || 0);
    const safeFrameSpacingMm = Math.max(0, Number(frameSpacingMm) || 0);

    // If there's no frame, treat frameSpacing as a sheet-edge inset.
    const pageInsetMm = hasBrownFrame ? safePageMarginMm : safePageMarginMm + safeFrameSpacingMm;
    const frameInsetMm = hasBrownFrame ? safeFrameSpacingMm : 0;

    const planned = planSheets(
      normalizedItems,
      { ...sheetSize, sortOrder: pdfSortOrder },
      effectiveSignSpacingMm,
      isMjFrameMode ? 0 : pageInsetMm,
      frameInsetMm,
      layoutOptions
    );

    const sheetCount = Array.isArray(planned?.sheets) ? planned.sheets.length : 0;
    const sheetsWithIndex = (planned?.sheets || []).map((s, idx) => ({
      ...s,
      globalSheetIndex: idx + 1,
      globalSheetCount: sheetCount,
    }));

    return { sheets: sheetsWithIndex, leftovers: planned?.leftovers || [] };
  }, [normalizedItems, sheetSize, pdfSortOrder, effectiveSignSpacingMm, pdfPageMargin, frameSpacingMm, isMjFrameMode, hasBrownFrame]);

  const { visibleSheets, visibleLeftovers } = useMemo(() => {
    if (selectedMaterialKey === "all") {
      return { visibleSheets: sheets, visibleLeftovers: leftovers };
    }

    const matchSheet = (sheet) => {
      const first = sheet?.placements?.[0] || null;
      if (!first) return false;
      return getMaterialKey(first) === selectedMaterialKey;
    };

    return {
      visibleSheets: (sheets || []).filter(matchSheet),
      visibleLeftovers: (leftovers || []).filter(
        (item) => getMaterialKey(item) === selectedMaterialKey
      ),
    };
  }, [leftovers, selectedMaterialKey, sheets]);

  const totalUsedArea = visibleSheets.reduce(
    (acc, sheet) => acc + sheet.usedArea,
    0
  );
  const sheetsCount = visibleSheets.length;
  const totalUsableArea = visibleSheets.reduce(
    (acc, sheet) => acc + getSheetUsableArea(sheet),
    0
  );
  const coverage =
    sheetsCount > 0
      ? Math.round((totalUsedArea / Math.max(1, totalUsableArea)) * 100)
      : 0;
  const totalRequestedCopies = useMemo(
    () =>
      normalizedItems.reduce(
        (acc, item) => acc + Math.max(1, item.copies || 0),
        0
      ),
    [normalizedItems]
  );
  const placedCopies = visibleSheets.reduce(
    (acc, sheet) => acc + sheet.placements.length,
    0
  );
  const leftoverCopies = visibleLeftovers.length;
  const nothingToPlace = totalRequestedCopies === 0;

  const handleExportPdf = useCallback(async () => {
    // Export always uses ALL groups to keep PDF rules intact.
    if (!sheets.length || isExporting) return;

    const totalSheets = sheets.length;
    if (totalSheets > 10) {
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert(
          `Максимальна кількість аркушів для PDF — 10. Зараз: ${totalSheets}. Зменш кількість аркушів або оптимізуй розкладку.`
        );
      }
      return;
    }

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
      const svgAssets = {};
      const markupToAssetKey = new Map();
      let svgAssetCounter = 0;

      const computeFrameRect = (sheet) => {
        if (!hasBrownFrame) return null;
        const placements = Array.isArray(sheet?.placements) ? sheet.placements : [];
        if (!placements.length) return null;

        const safeFrameSpacing = Math.max(0, Number(frameSpacingMm) || 0);
        const safePageMargin = Math.max(0, Number(pdfPageMargin) || 0);

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        placements.forEach((p) => {
          const x = Number(p?.x) || 0;
          const y = Number(p?.y) || 0;
          const w = Math.max(0, Number(p?.width) || 0);
          const h = Math.max(0, Number(p?.height) || 0);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + w);
          maxY = Math.max(maxY, y + h);
        });

        if (
          !Number.isFinite(minX) ||
          !Number.isFinite(minY) ||
          !Number.isFinite(maxX) ||
          !Number.isFinite(maxY)
        ) {
          return null;
        }

        // Normal frame: spacing on all sides.
        let x = minX - safeFrameSpacing;
        let y = minY - safeFrameSpacing;
        let width = maxX - minX + safeFrameSpacing * 2;
        let height = maxY - minY + safeFrameSpacing * 2;

        // MJ optimized: the left frame edge must pass on the LEFT side of binder holes
        // (tangent to hole outer edge), so no brown line appears on the right side of holes.
        const stripWidthMm = exportMode === "Sheet optimized (MJ) Fr." ? MJ_FRAME_STRIP_WIDTH_MM : 0;
        if (exportMode === "Sheet optimized (MJ) Fr.") {
          const holeRadiusMm = MJ_FRAME_HOLE_DIAMETER_MM / 2;
          // Keep the same side gap to hole as the previous right-side layout.
          const legacyHoleSideGapMm = Math.max(
            0,
            stripWidthMm - (stripWidthMm / 2 + holeRadiusMm)
          );
          x = Math.max(0, stripWidthMm / 2 - holeRadiusMm - legacyHoleSideGapMm);
          y = minY - safeFrameSpacing;
          width = maxX - x + safeFrameSpacing;
          height = maxY - minY + safeFrameSpacing * 2;
        }

        // Clamp the frame to stay within the page margins.
        const leftLimit =
          exportMode === "Sheet optimized (MJ) Fr."
            ? 0
            : Math.max(safePageMargin, stripWidthMm);
        const topLimit = safePageMargin;
        const rightLimit = Math.max(
          leftLimit,
          (Number(sheet?.width) || 0) - safePageMargin
        );
        const bottomLimit = Math.max(
          topLimit,
          (Number(sheet?.height) || 0) - safePageMargin
        );

        x = Math.max(leftLimit, x);
        y = Math.max(topLimit, y);
        width = Math.max(0, Math.min(width, rightLimit - x));
        height = Math.max(0, Math.min(height, bottomLimit - y));

        if (width <= 0 || height <= 0) return null;
        return { x, y, width, height };
      };

      const computePlacementsBounds = (sheet) => {
        const placements = Array.isArray(sheet?.placements) ? sheet.placements : [];
        if (!placements.length) return null;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        placements.forEach((p) => {
          const x = Number(p?.x) || 0;
          const y = Number(p?.y) || 0;
          const w = Math.max(0, Number(p?.width) || 0);
          const h = Math.max(0, Number(p?.height) || 0);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + w);
          maxY = Math.max(maxY, y + h);
        });

        if (
          !Number.isFinite(minX) ||
          !Number.isFinite(minY) ||
          !Number.isFinite(maxX) ||
          !Number.isFinite(maxY)
        ) {
          return null;
        }

        return { minX, minY, maxX, maxY };
      };

      const preparedSheets = sheets.map((sheet, sheetIndex) => {
        const placements = sheet.placements.map((placement) => {
          const previewData = buildPlacementPreview(placement, { enableGaps });
          let svgAssetKey = null;

          if (previewData?.type === "svg" && previewData.exportMarkup) {
            try {
              const fileName =
                previewData.fileName ||
                `${placement.baseId || placement.id}.svg`;
              zip.file(fileName, previewData.exportMarkup);
            } catch (zipError) {
              console.error("Не вдалося додати SVG у ZIP", zipError);
            }

            const markup = previewData.exportMarkup;
            const existingAssetKey = markupToAssetKey.get(markup);
            if (existingAssetKey) {
              svgAssetKey = existingAssetKey;
            } else {
              svgAssetCounter += 1;
              svgAssetKey = `svg-${svgAssetCounter}`;
              markupToAssetKey.set(markup, svgAssetKey);
              svgAssets[svgAssetKey] = markup;
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
            rotated: !!placement.rotated,
            copyIndex: placement.copyIndex ?? 1,
            copies: placement.copies ?? 1,
            svgAssetKey,
            svgMarkup: null,
            sourceWidth: placement.sourceWidth || placement.width,
            sourceHeight: placement.sourceHeight || placement.height,
            customBorder: placement.customBorder || null,
            materialColor: placement.materialColor ?? null,
            materialThicknessMm: placement.materialThicknessMm ?? null,
            isAdhesiveTape: placement.isAdhesiveTape ?? false,
            themeStrokeColor: placement.themeStrokeColor ?? null,
          };
        });

        const frameRect = computeFrameRect(sheet);
        const placementsBounds = computePlacementsBounds(sheet);

        const resolvedProjectId =
          normalizeProjectIdForLabel(projectId) ||
          (() => {
            try {
              return normalizeProjectIdForLabel(localStorage.getItem("currentProjectId"));
            } catch {
              return null;
            }
          })();

        const sheetInfoEnabled = !!pdfAddSheetInfo;

        const safePageMarginMm = Math.max(0, Number(pdfPageMargin) || 0);
        const safeFrameSpacingMm = Math.max(0, Number(frameSpacingMm) || 0);
        const stripWidthMm = Math.max(0, Number(sheet?.leftStripWidthMm) || 0);

        const holeCentersY = (() => {
          const h = Math.max(0, Number(sheet?.height) || 0);
          if (h >= MJ_FRAME_SECOND_HOLE_MIN_HEIGHT_MM) {
            return [
              h / 2 - MJ_FRAME_HOLE_SPACING_MM / 2,
              h / 2 + MJ_FRAME_HOLE_SPACING_MM / 2,
            ];
          }
          return [h / 2];
        })();

        const sheetInfoPlacement = (() => {
          if (!sheetInfoEnabled) return null;
          if (exportMode === "Sheet optimized (MJ) Fr.") {
            if (stripWidthMm <= 0) return null;
            const centerYmm = holeCentersY.length
              ? holeCentersY.reduce((a, b) => a + b, 0) / holeCentersY.length
              : (Number(sheet?.height) || 0) / 2;
            return {
              xCenterMm: stripWidthMm / 2,
              yCenterMm: centerYmm,
              areaWidthMm: stripWidthMm,
            };
          }

          // Other modes: center inside the left frameSpacing band.
          if (safeFrameSpacingMm <= 0) return null;

          const contentLeftMm = (() => {
            if (placementsBounds && Number.isFinite(placementsBounds.minX)) {
              return placementsBounds.minX;
            }
            if (frameRect) return frameRect.x + safeFrameSpacingMm;
            return safePageMarginMm + safeFrameSpacingMm;
          })();

          const fallbackYCenterMm = (() => {
            if (frameRect) return frameRect.y + frameRect.height / 2;
            if (placementsBounds) {
              return (placementsBounds.minY + placementsBounds.maxY) / 2;
            }
            return (Number(sheet?.height) || 0) / 2;
          })();

          return {
            xCenterMm: Math.max(
              safePageMarginMm + safeFrameSpacingMm / 2,
              contentLeftMm - safeFrameSpacingMm / 2
            ),
            yCenterMm: fallbackYCenterMm,
            areaWidthMm: safeFrameSpacingMm,
          };
        })();

        const sheetInfo = sheetInfoPlacement
          ? {
              projectId: resolvedProjectId,
              sheetIndex: sheet?.globalSheetIndex ?? sheetIndex + 1,
              sheetCount: sheet?.globalSheetCount ?? sheets.length,
              ...sheetInfoPlacement,
            }
          : null;

        return {
          index: sheetIndex,
          width: sheet.width,
          height: sheet.height,
          frameRect,
          exportMode,
          leftStripWidthMm: sheet.leftStripWidthMm ?? 0,
          leftInset: sheet.leftInset ?? null,
          topInset: sheet.topInset ?? null,
          rightInset: sheet.rightInset ?? null,
          bottomInset: sheet.bottomInset ?? null,
          sheetInfo,
          placements,
        };
      });

      const exportEndpoint =
        import.meta.env.VITE_LAYOUT_EXPORT_URL || "/api/layout-pdf";

      const payload = {
        sheetLabel,
        timestamp,
        formatKey,
        exportMode,
        spacingMm: effectiveSignSpacingMm,
        svgAssets,
        sheets: preparedSheets,
      };

      const payloadJson = JSON.stringify(payload);
      const requestHeaders = {
        "Content-Type": "application/json",
      };

      let requestBody = payloadJson;
      if (typeof CompressionStream !== "undefined") {
        try {
          const encoder = new TextEncoder();
          const input = encoder.encode(payloadJson);
          const compressionStream = new CompressionStream("gzip");
          const writer = compressionStream.writable.getWriter();
          await writer.write(input);
          await writer.close();

          const compressedBuffer = await new Response(
            compressionStream.readable
          ).arrayBuffer();

          if (
            compressedBuffer &&
            compressedBuffer.byteLength > 0 &&
            compressedBuffer.byteLength < input.byteLength
          ) {
            requestBody = compressedBuffer;
            requestHeaders["Content-Encoding"] = "gzip";
          }
        } catch (compressionError) {
          console.warn("PDF payload compression failed, using plain JSON", compressionError);
        }
      }

      const response = await fetch(exportEndpoint, {
        method: "POST",
        headers: requestHeaders,
        body: requestBody,
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
  }, [
    formatKey,
    exportMode,
    isExporting,
    sheets,
    spacingMm,
    effectiveSignSpacingMm,
    enableGaps,
    pdfPageMargin,
    frameSpacingMm,
    pdfAddSheetInfo,
    projectId,
  ]);

  if (!isOpen) return null;

  const selectedMaterialLabel =
    selectedMaterialKey === "all"
      ? "Всі"
      : (() => {
          const group = materialGroups.find((g) => g.key === selectedMaterialKey);
          if (!group) return "Всі";
          return formatMaterialLabel(group);
        })();

  const exportModeOptions = [
    "Normal",
    "Normal (MJ) Frame",
    "Sheet optimized (MJ) Fr.",
    "Sheet A4 portrait",
    "Sheet A5 portrait",
    "Sheet A4 landscape",
    "Production optimized",
  ];

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2>План друку полотен</h2>
            <p className={styles.subtitle}>
              Формат {sheetSize.label} · {sheetSize.width}×{sheetSize.height} мм · проміжок між полотнами{" "}
              {effectiveSignSpacingMm} мм · {ORIENTATION_LABELS[orientation]} · матеріал: {selectedMaterialLabel}
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
              disabled={isMjFrameMode}
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
                  disabled={isMjFrameMode}
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

          <label className={styles.controlGroup}>
            <span>Група (колір/товщина)</span>
            <select
              value={selectedMaterialKey}
              onChange={(event) => setSelectedMaterialKey(event.target.value)}
            >
              <option value="all">Всі матеріали ({totalRequestedCopies} шт)</option>
              {materialGroups.map((group) => (
                <option key={group.key} value={group.key}>
                  {formatMaterialLabel(group)} — {group.count} шт
                </option>
              ))}
            </select>
          </label>

          <label className={styles.controlGroup}>
            <span>Режим (PDF)</span>
            <select
              value={exportMode}
              onChange={(event) => setExportMode(event.target.value)}
            >
              {exportModeOptions.map((modeLabel) => (
                <option key={modeLabel} value={modeLabel}>
                  {modeLabel}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.controlGroup}>
            <span>Min page width</span>
            <div className={styles.controlInline}>
              <input
                type="number"
                value={pdfMinPageWidth}
                onChange={(e) => setPdfMinPageWidth(Number(e.target.value) || 0)}
              />
              <span className={styles.hint}>0 = defaults</span>
            </div>
          </label>

          <label className={styles.controlGroup}>
            <span>Min page height</span>
            <div className={styles.controlInline}>
              <input
                type="number"
                value={pdfMinPageHeight}
                onChange={(e) => setPdfMinPageHeight(Number(e.target.value) || 0)}
              />
              <span className={styles.hint}>0 = defaults</span>
            </div>
          </label>

          <label className={styles.controlGroup}>
            <span>Max page width</span>
            <div className={styles.controlInline}>
              <input
                type="number"
                value={pdfMaxPageWidth}
                onChange={(e) => setPdfMaxPageWidth(Number(e.target.value) || 0)}
              />
              <span className={styles.hint}>0 = defaults</span>
            </div>
          </label>

          <label className={styles.controlGroup}>
            <span>Max page height</span>
            <div className={styles.controlInline}>
              <input
                type="number"
                value={pdfMaxPageHeight}
                onChange={(e) => setPdfMaxPageHeight(Number(e.target.value) || 0)}
              />
              <span className={styles.hint}>0 = defaults</span>
            </div>
          </label>

          <label className={styles.controlGroup}>
            <span>Page margin (to frame)</span>
            <div className={styles.controlInline}>
              <input
                type="number"
                value={pdfPageMargin}
                onChange={(e) => setPdfPageMargin(Number(e.target.value) || 0)}
                disabled={isMjFrameMode}
              />
              <span className={styles.hint}>
                {isMjFrameMode ? "ignored for MJ mode" : ""}
              </span>
            </div>
          </label>

          <label className={styles.controlGroup}>
            <span>Frame spacing</span>
            <div className={styles.controlInline}>
              <input
                type="number"
                value={frameSpacingMm}
                onChange={(e) => setFrameSpacingMm(Number(e.target.value) || 0)}
              />
              <span className={styles.hint}>
                {isMjFrameMode ? "MJ mode: top/right/bottom only" : "applies on all sides"}
              </span>
            </div>
          </label>

          <label className={styles.controlGroup}>
            <span>Sign spacing</span>
            <div className={styles.controlInline}>
              <input
                type="number"
                value={pdfSignSpacing}
                onChange={(e) => setPdfSignSpacing(Number(e.target.value) || 0)}
              />
              <span className={styles.hint}>2 = defaults</span>
            </div>
          </label>

          <label className={styles.controlGroup}>
            <span>Sort order</span>
            <select
              value={pdfSortOrder}
              onChange={(e) => setPdfSortOrder(e.target.value)}
            >
              <option value="high-first">High first</option>
              <option value="low-first">Low first</option>
            </select>
          </label>

          <label className={styles.controlGroup}>
            <span>Add sheet info</span>
            <div className={styles.controlInline}>
              <input
                type="checkbox"
                checked={pdfAddSheetInfo}
                onChange={(e) => setPdfAddSheetInfo(e.target.checked)}
              />
              <span className={styles.hint}>Only if sheets are used</span>
            </div>
          </label>

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
              {visibleSheets.map((sheet, sheetIndex) => {
                const scale = Math.min(
                  1,
                  340 / Math.max(sheet.width, sheet.height)
                );

                const stripWidthMm = Math.max(0, Number(sheet?.leftStripWidthMm) || 0);
                const shouldRenderMjStrip = stripWidthMm > 0;
                const placementsBounds = (() => {
                  const placements = Array.isArray(sheet?.placements) ? sheet.placements : [];
                  if (!placements.length) return null;
                  let minX = Infinity;
                  let maxX = -Infinity;
                  let minY = Infinity;
                  let maxY = -Infinity;
                  placements.forEach((p) => {
                    const x = Number(p?.x) || 0;
                    const y = Number(p?.y) || 0;
                    const w = Math.max(0, Number(p?.width) || 0);
                    const h = Math.max(0, Number(p?.height) || 0);
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x + w);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y + h);
                  });
                  if (
                    !Number.isFinite(minX) ||
                    !Number.isFinite(maxX) ||
                    !Number.isFinite(minY) ||
                    !Number.isFinite(maxY)
                  ) {
                    return null;
                  }
                  return { minX, maxX, minY, maxY };
                })();
                const holeCentersY = (() => {
                  const h = Math.max(0, Number(sheet?.height) || 0);
                  if (h >= MJ_FRAME_SECOND_HOLE_MIN_HEIGHT_MM) {
                    return [
                      h / 2 - MJ_FRAME_HOLE_SPACING_MM / 2,
                      h / 2 + MJ_FRAME_HOLE_SPACING_MM / 2,
                    ];
                  }
                  return [h / 2];
                })();

                const sheetUsableArea = getSheetUsableArea(sheet);

                const showSheetInfo = !!pdfAddSheetInfo;
                const safePageMarginMm = Math.max(0, Number(pdfPageMargin) || 0);
                const safeFrameSpacingMm = Math.max(0, Number(frameSpacingMm) || 0);
                const sheetInfoPlacement = (() => {
                  if (!showSheetInfo) return null;
                  if (exportMode === "Sheet optimized (MJ) Fr.") {
                    if (stripWidthMm <= 0) return null;
                    const centerYmm = holeCentersY.length
                      ? holeCentersY.reduce((a, b) => a + b, 0) / holeCentersY.length
                      : (Number(sheet?.height) || 0) / 2;
                    return {
                      xLeftMm: 0,
                      areaWidthMm: stripWidthMm,
                      yCenterMm: centerYmm,
                    };
                  }

                  if (safeFrameSpacingMm <= 0) return null;

                  const contentLeftMm = (() => {
                    if (placementsBounds && Number.isFinite(placementsBounds.minX)) {
                      return placementsBounds.minX;
                    }
                    if (hasBrownFrame && frameRect) return frameRect.x + safeFrameSpacingMm;
                    return safePageMarginMm + safeFrameSpacingMm;
                  })();

                  const fallbackYCenterMm = (() => {
                    if (hasBrownFrame && frameRect) return frameRect.y + frameRect.height / 2;
                    if (placementsBounds) return (placementsBounds.minY + placementsBounds.maxY) / 2;
                    return (Number(sheet?.height) || 0) / 2;
                  })();

                  return {
                    xLeftMm: Math.max(
                      safePageMarginMm,
                      contentLeftMm - safeFrameSpacingMm
                    ),
                    areaWidthMm: safeFrameSpacingMm,
                    yCenterMm: fallbackYCenterMm,
                  };
                })();

                const resolvedProjectId =
                  normalizeProjectIdForLabel(projectId) ||
                  (() => {
                    try {
                      return normalizeProjectIdForLabel(localStorage.getItem("currentProjectId"));
                    } catch {
                      return null;
                    }
                  })();

                const sheetInfoLine1 = resolvedProjectId ? `${resolvedProjectId}` : "";
                const sheetInfoLine2 = `Sh ${sheet?.globalSheetIndex ?? sheetIndex + 1} / ${sheet?.globalSheetCount ?? sheets.length}`;

                const sheetInfoFontPx = (() => {
                  const bandPx = Math.max(0, (sheetInfoPlacement?.areaWidthMm || 0) * scale);
                  if (bandPx <= 0) return 0;
                  return Math.max(3, Math.min(9, bandPx * 0.9));
                })();

                const frameRect = (() => {
                  const placements = Array.isArray(sheet?.placements)
                    ? sheet.placements
                    : [];
                  if (!placements.length) return null;

                  const safeFrameSpacing = Math.max(
                    0,
                    Number(frameSpacingMm) || 0
                  );
                  const safePageMargin = Math.max(0, Number(pdfPageMargin) || 0);

                  let minX = Infinity;
                  let minY = Infinity;
                  let maxX = -Infinity;
                  let maxY = -Infinity;

                  placements.forEach((p) => {
                    const x = Number(p?.x) || 0;
                    const y = Number(p?.y) || 0;
                    const w = Math.max(0, Number(p?.width) || 0);
                    const h = Math.max(0, Number(p?.height) || 0);
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x + w);
                    maxY = Math.max(maxY, y + h);
                  });

                  if (
                    !Number.isFinite(minX) ||
                    !Number.isFinite(minY) ||
                    !Number.isFinite(maxX) ||
                    !Number.isFinite(maxY)
                  ) {
                    return null;
                  }

                  let x = minX - safeFrameSpacing;
                  let y = minY - safeFrameSpacing;
                  let width = maxX - minX + safeFrameSpacing * 2;
                  let height = maxY - minY + safeFrameSpacing * 2;

                  const stripWidthMm =
                    exportMode === "Sheet optimized (MJ) Fr."
                      ? Math.max(0, Number(sheet?.leftStripWidthMm) || MJ_FRAME_STRIP_WIDTH_MM)
                      : 0;
                  if (exportMode === "Sheet optimized (MJ) Fr.") {
                    const holeRadiusMm = MJ_FRAME_HOLE_DIAMETER_MM / 2;
                    const legacyHoleSideGapMm = Math.max(
                      0,
                      stripWidthMm - (stripWidthMm / 2 + holeRadiusMm)
                    );
                    x = Math.max(0, stripWidthMm / 2 - holeRadiusMm - legacyHoleSideGapMm);
                    y = minY - safeFrameSpacing;
                    width = maxX - x + safeFrameSpacing;
                    height = maxY - minY + safeFrameSpacing * 2;
                  }

                  const leftLimit =
                    exportMode === "Sheet optimized (MJ) Fr."
                      ? 0
                      : safePageMargin;
                  const topLimit = safePageMargin;
                  const rightLimit = Math.max(
                    leftLimit,
                    (Number(sheet?.width) || 0) - safePageMargin
                  );
                  const bottomLimit = Math.max(
                    topLimit,
                    (Number(sheet?.height) || 0) - safePageMargin
                  );

                  x = Math.max(leftLimit, x);
                  y = Math.max(topLimit, y);
                  width = Math.max(0, Math.min(width, rightLimit - x));
                  height = Math.max(0, Math.min(height, bottomLimit - y));

                  if (width <= 0 || height <= 0) return null;
                  return { x, y, width, height };
                })();

                return (
                  <div key={`sheet-${sheetIndex}`} className={styles.sheetCard}>
                    <div className={styles.sheetHeader}>
                      <h3>Аркуш {sheetIndex + 1}</h3>
                      <span>
                        {sheet.width}×{sheet.height} мм · заповнення{" "}
                        {Math.round((sheet.usedArea / Math.max(1, sheetUsableArea)) * 100)}%
                      </span>
                    </div>
                    <div
                      className={styles.sheetPreview}
                      style={{
                        width: `${sheet.width * scale}px`,
                        height: `${sheet.height * scale}px`,
                      }}
                    >
                      {showSheetInfo && sheetInfoPlacement?.areaWidthMm > 0 ? (
                        <div
                          className={styles.sheetInfo}
                          style={{
                            left: `${(sheetInfoPlacement.xLeftMm || 0) * scale}px`,
                            width: `${(sheetInfoPlacement.areaWidthMm || 0) * scale}px`,
                          }}
                        >
                          <div
                            className={styles.sheetInfoInner}
                            style={{
                              top: `${(sheetInfoPlacement.yCenterMm || 0) * scale}px`,
                              fontSize: sheetInfoFontPx ? `${sheetInfoFontPx}px` : undefined,
                            }}
                          >
                            {sheetInfoLine1 ? (
                              <div className={styles.sheetInfoLine}>{sheetInfoLine1}</div>
                            ) : null}
                            <div className={styles.sheetInfoLine}>{sheetInfoLine2}</div>
                          </div>
                        </div>
                      ) : null}
                      {shouldRenderMjStrip ? (
                        <div
                          className={styles.mjStrip}
                          style={{
                            width: `${stripWidthMm * scale}px`,
                          }}
                        >
                          <svg
                            className={styles.mjStripSvg}
                            viewBox={`0 0 ${stripWidthMm} ${Math.max(
                              0,
                              Number(sheet?.height) || 0
                            )}`}
                            preserveAspectRatio="none"
                          >
                            {holeCentersY.map((cy, idx) => (
                              <circle
                                key={`mj-hole-${sheetIndex}-${idx}`}
                                cx={stripWidthMm / 2}
                                cy={cy}
                                r={MJ_FRAME_HOLE_DIAMETER_MM / 2}
                                fill="#FFFFFF"
                                stroke={MJ_FRAME_STRIP_COLOR}
                                strokeWidth="1"
                              />
                            ))}
                          </svg>
                        </div>
                      ) : null}
                      {hasBrownFrame && frameRect ? (
                        <div
                          className={styles.frameRect}
                          style={{
                            left: `${frameRect.x * scale}px`,
                            top: `${frameRect.y * scale}px`,
                            width: `${frameRect.width * scale}px`,
                            height: `${frameRect.height * scale}px`,
                            borderTopLeftRadius: `${MJ_FRAME_CORNER_RADIUS_MM * scale}px`,
                            borderBottomLeftRadius: `${MJ_FRAME_CORNER_RADIUS_MM * scale}px`,
                            borderTopRightRadius: `${MJ_FRAME_CORNER_RADIUS_MM * scale}px`,
                            borderBottomRightRadius: `${MJ_FRAME_CORNER_RADIUS_MM * scale}px`,
                          }}
                        />
                      ) : null}
                      {sheet.placements.map((placement) => {
                        const previewData = buildPlacementPreview(placement, {
                          enableGaps,
                          hideFrames: true,
                        });
                        const hasPreview = !!previewData;
                        const rotatedPreviewStyle = placement?.rotated
                          ? {
                              width: `${placement.height * scale}px`,
                              height: `${placement.width * scale}px`,
                              transform: "rotate(90deg)",
                              transformOrigin: "center center",
                              objectFit: "contain",
                              flex: "0 0 auto",
                            }
                          : undefined;

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
                                  style={rotatedPreviewStyle}
                                  dangerouslySetInnerHTML={{
                                    __html: previewData.previewMarkup,
                                  }}
                                />
                              ) : hasPreview ? (
                                <img
                                  src={previewData?.url}
                                  alt={placement.name || "Полотно"}
                                  style={rotatedPreviewStyle}
                                />
                              ) : null}
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

        {visibleLeftovers.length > 0 ? (
          <div className={styles.leftovers}>
            <h4>Не помістилося ({visibleLeftovers.length})</h4>
            <ul>
              {visibleLeftovers.map((item) => (
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

export {
  buildPlacementPreview,
  planSheets,
  normalizeDesigns,
  FORMATS,
  getMaterialKey,
  formatMaterialLabel,
};
export default LayoutPlannerModal;
