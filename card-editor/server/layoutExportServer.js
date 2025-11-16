import express from "express";
import cors from "cors";
import PDFDocument from "pdfkit";
import svgToPdf from "svg-to-pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import * as fontkitModule from "fontkit";
import TextToSVG from "text-to-svg";

const MM_TO_PT = 72 / 25.4;
const DEFAULT_PORT = Number(process.env.LAYOUT_EXPORT_PORT || 4177);
const ALLOWED_ORIGINS = process.env.LAYOUT_EXPORT_ORIGINS
  ? process.env.LAYOUT_EXPORT_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : null;
const OUTLINE_STROKE_COLOR = "#0000FF";
const TEXT_OUTLINE_COLOR = "#008181";
const TEXT_STROKE_WIDTH_PT = 0.5;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FONT_DIR = path.resolve(__dirname, "../src/assets/fonts");

const FONT_DEFINITIONS = [
  {
    id: "AbrilFatface-Regular",
    file: "AbrilFatface-Regular.ttf",
    aliases: ["abril fatface", "abril-fatface"],
  },
  {
    id: "AlfaSlabOne-Regular",
    file: "AlfaSlabOne-Regular.ttf",
    aliases: ["alfa slab one", "alfa-slab-one"],
  },
  {
    id: "ArialMT",
    file: "ArialMT.ttf",
    aliases: ["arial", "arialmt", "arial, sans-serif"],
  },
  {
    id: "Arial-BoldMT",
    file: "Arial-BoldMT.ttf",
    aliases: ["arial bold", "arial-bold", "arial bold mt", "arial boldmt"],
  },
  {
    id: "Arial-ItalicMT",
    file: "Arial-ItalicMT.ttf",
    aliases: ["arial italic", "arial-italic", "arial italic mt"],
  },
  {
    id: "Arial-BoldItalicMT",
    file: "Arial-BoldItalicMT.ttf",
    aliases: ["arial bold italic", "arial-bold-italic", "arial bolditalic"],
  },
  {
    id: "ArialNarrow",
    file: "ArialNarrow.ttf",
    aliases: ["arial narrow", "arial-narrow"],
  },
  {
    id: "ArialNarrow-Bold",
    file: "ArialNarrow-Bold.ttf",
    aliases: ["arial narrow bold", "arial-narrow bold", "arial narrow-bold"],
  },
  {
    id: "Audiowide-Regular",
    file: "Audiowide-Regular.ttf",
    aliases: ["audiowide"],
  },
  { id: "Baloo-Regular", file: "Baloo-Regular.ttf", aliases: ["baloo"] },
  {
    id: "Baloo2-Regular",
    file: "Baloo2-Regular.ttf",
    aliases: ["baloo 2", "baloo2"],
  },
  {
    id: "Baloo2-Medium",
    file: "Baloo2-Medium.ttf",
    aliases: ["baloo 2 medium", "baloo2 medium", "baloo 2-medium"],
  },
  {
    id: "Baloo2-Bold",
    file: "Baloo2-Bold.ttf",
    aliases: ["baloo 2 bold", "baloo2 bold", "baloo 2-bold"],
  },
  {
    id: "BreeSerif-Regular",
    file: "BreeSerif-Regular.ttf",
    aliases: ["bree serif", "bree-serif"],
  },
  {
    id: "ComicSansMS",
    file: "ComicSansMS.ttf",
    aliases: ["comic sans ms", "comic-sans-ms"],
  },
  {
    id: "ComicSansMS-Bold",
    file: "ComicSansMS-Bold.ttf",
    aliases: ["comic sans ms bold", "comic-sans-ms bold"],
  },
  {
    id: "ComicSansMS-BoldItalic",
    file: "ComicSansMS-BoldItalic.ttf",
    aliases: ["comic sans ms bold italic", "comic-sans-ms bold italic"],
  },
  {
    id: "Courgette-Regular",
    file: "Courgette-Regular.ttf",
    aliases: ["courgette"],
  },
  {
    id: "DancingScript-Bold",
    file: "DancingScript-Bold.ttf",
    aliases: [
      "dancing script",
      "dancing-script",
      "dancing script bold",
      "dancing-script bold",
    ],
  },
  {
    id: "Daniel-Bold",
    file: "Daniel-Bold.ttf",
    aliases: ["daniel", "daniel bold"],
  },
  {
    id: "DIN1451Engschrift",
    file: "DIN1451Engschrift.ttf",
    aliases: ["din 1451 engschrift", "din1451 engschrift"],
  },
  {
    id: "DIN1451Mittelschrift",
    file: "DIN1451Mittelschrift.ttf",
    aliases: ["din 1451 mittelschrift", "din1451 mittelschrift"],
  },
  {
    id: "Exmouth",
    file: "exmouth_.ttf",
    aliases: ["exmouth", "exmouth script"],
  },
  { id: "Exo2-Regular", file: "Exo2-Regular.ttf", aliases: ["exo 2", "exo2"] },
  {
    id: "Exo2-Medium",
    file: "Exo2-Medium.ttf",
    aliases: ["exo 2 medium", "exo2 medium"],
  },
  {
    id: "Exo2-Bold",
    file: "Exo2-Bold.ttf",
    aliases: ["exo 2 bold", "exo2 bold"],
  },
  {
    id: "Exo2-MediumItalic",
    file: "Exo2-MediumItalic.ttf",
    aliases: ["exo 2 medium italic", "exo2 medium italic"],
  },
  {
    id: "Exo2-BoldItalic",
    file: "Exo2-BoldItalic.ttf",
    aliases: ["exo 2 bold italic", "exo2 bold italic"],
  },
  {
    id: "Gotham-Medium",
    file: "Gotham-Medium.ttf",
    aliases: ["gotham", "gotham medium"],
  },
  { id: "Gotham-Bold", file: "Gotham-Bold.ttf", aliases: ["gotham bold"] },
  {
    id: "Gotham-MediumItalic",
    file: "Gotham-MediumItalic.ttf",
    aliases: ["gotham medium italic"],
  },
  {
    id: "Gotham-BoldItalic",
    file: "Gotham-BoldItalic.ttf",
    aliases: ["gotham bold italic"],
  },
  {
    id: "GreatVibes-Regular",
    file: "GreatVibes-Regular.ttf",
    aliases: ["great vibes", "great-vibes"],
  },
  { id: "Handlee-Regular", file: "Handlee-Regular.ttf", aliases: ["handlee"] },
  {
    id: "ImpactLTStd",
    file: "ImpactLTStd.ttf",
    aliases: ["impact", "impact lt std", "impactltstd"],
  },
  { id: "Inter-Regular", file: "Inter-Regular.ttf", aliases: ["inter"] },
  { id: "Inter-Bold", file: "Inter-Bold.ttf", aliases: ["inter bold"] },
  { id: "Inter-Italic", file: "Inter-Italic.ttf", aliases: ["inter italic"] },
  {
    id: "Inter-ExtraBoldItalic",
    file: "Inter-ExtraBoldItalic.ttf",
    aliases: ["inter extra bold italic", "inter extrabold italic"],
  },
  { id: "Kalam-Regular", file: "Kalam-Regular.ttf", aliases: ["kalam"] },
  { id: "Kalam-Bold", file: "Kalam-Bold.ttf", aliases: ["kalam bold"] },
  {
    id: "KeaniaOne-Regular",
    file: "KeaniaOne-Regular.ttf",
    aliases: ["keania one", "keania-one"],
  },
  { id: "Lobster-Regular", file: "Lobster-Regular.ttf", aliases: ["lobster"] },
  {
    id: "Merriweather-Regular",
    file: "Merriweather-Regular.ttf",
    aliases: ["merriweather"],
  },
  {
    id: "Merriweather-BoldItalic",
    file: "Merriweather-BoldItalic.ttf",
    aliases: ["merriweather bold italic", "merriweather bolditalic"],
  },
  {
    id: "Merriweather-BlackItalic",
    file: "Merriweather-BlackItalic.ttf",
    aliases: ["merriweather black italic", "merriweather blackitalic"],
  },
  { id: "Oswald-Regular", file: "Oswald-Regular.ttf", aliases: ["oswald"] },
  { id: "Oswald-Bold", file: "Oswald-Bold.ttf", aliases: ["oswald bold"] },
  {
    id: "Pacifico-Regular",
    file: "Pacifico-Regular.ttf",
    aliases: ["pacifico"],
  },
  {
    id: "PatuaOne-Regular",
    file: "PatuaOne-Regular.ttf",
    aliases: ["patua one", "patua-one"],
  },
  { id: "Roboto-Regular", file: "Roboto-Regular.ttf", aliases: ["roboto"] },
  { id: "Roboto-Bold", file: "Roboto-Bold.ttf", aliases: ["roboto bold"] },
  {
    id: "Roboto-Italic",
    file: "Roboto-Italic.ttf",
    aliases: ["roboto italic"],
  },
  {
    id: "Roboto-BoldItalic",
    file: "Roboto-BoldItalic.ttf",
    aliases: ["roboto bold italic", "roboto bolditalic"],
  },
  { id: "Rubik-Regular", file: "Rubik-Regular.ttf", aliases: ["rubik"] },
  { id: "Rubik-Bold", file: "Rubik-Bold.ttf", aliases: ["rubik bold"] },
  {
    id: "Rubik-BoldItalic",
    file: "Rubik-BoldItalic.ttf",
    aliases: ["rubik bold italic", "rubik bolditalic"],
  },
  {
    id: "Sacramento-Regular",
    file: "Sacramento-Regular.ttf",
    aliases: ["sacramento"],
  },
  { id: "Satisfy-Regular", file: "Satisfy-Regular.ttf", aliases: ["satisfy"] },
  {
    id: "StardosStencil-Regular",
    file: "StardosStencil-Regular.ttf",
    aliases: ["stardos stencil", "stardos-stencil"],
  },
  {
    id: "StardosStencil-Bold",
    file: "StardosStencil-Bold.ttf",
    aliases: ["stardos stencil bold", "stardos-stencil bold"],
  },
  { id: "Teko-Regular", file: "Teko-Regular.ttf", aliases: ["teko"] },
  {
    id: "Teko-SemiBold",
    file: "Teko-SemiBold.ttf",
    aliases: ["teko semibold", "teko semi bold"],
  },
  { id: "Teko-Bold", file: "Teko-Bold.ttf", aliases: ["teko bold"] },
  {
    id: "TimesNewRomanMTStd",
    file: "TimesNewRomanMTStd.ttf",
    aliases: ["times", "times new roman", "timesnewroman"],
  },
  {
    id: "TimesNewRomanMTStd-Bold",
    file: "TimesNewRomanMTStd-Bold.ttf",
    aliases: ["times new roman bold", "timesnewroman bold"],
  },
  {
    id: "TimesNewRomanMTStd-Italic",
    file: "TimesNewRomanMTStd-Italic.ttf",
    aliases: ["times new roman italic", "timesnewroman italic"],
  },
  {
    id: "TimesNewRomanMTStd-BoldIt",
    file: "TimesNewRomanMTStd-BoldIt.ttf",
    aliases: ["times new roman bold italic", "timesnewroman bold italic"],
  },
  {
    id: "VT323-Regular",
    file: "VT323-Regular.ttf",
    aliases: ["vt323", "vt 323"],
  },
];

const fontkit = fontkitModule?.default || fontkitModule;
const FONT_DEFINITION_MAP = new Map(
  FONT_DEFINITIONS.map((def) => [def.id, def])
);
const FONTKIT_CACHE = new Map();
const TEXT_TO_SVG_CACHE = new Map();
const TEXT_TO_SVG_ANCHOR = "left top";

const DEFAULT_FONT_ID = "ArialMT";

const FONT_ALIAS_LOOKUP = FONT_DEFINITIONS.reduce((map, def) => {
  def.aliases.forEach((alias) => {
    map.set(alias.toLowerCase(), def.id);
  });
  map.set(def.id.toLowerCase(), def.id);
  return map;
}, new Map());

const getFontDefinition = (fontId) => FONT_DEFINITION_MAP.get(fontId);

const resolveFontPath = (fontId) => {
  const def = getFontDefinition(fontId);
  if (!def) {
    return null;
  }
  return path.resolve(FONT_DIR, def.file);
};

const getFontkitFont = (fontId) => {
  if (!fontkit || typeof fontkit.openSync !== "function") {
    return null;
  }

  if (FONTKIT_CACHE.has(fontId)) {
    return FONTKIT_CACHE.get(fontId);
  }

  const fontPath = resolveFontPath(fontId);
  if (!fontPath) {
    FONTKIT_CACHE.set(fontId, null);
    return null;
  }

  try {
    const fontInstance = fontkit.openSync(fontPath);
    FONTKIT_CACHE.set(fontId, fontInstance);
    return fontInstance;
  } catch (error) {
    console.warn(
      `Не вдалося завантажити шрифт ${fontId} через fontkit:`,
      error.message
    );
    FONTKIT_CACHE.set(fontId, null);
    return null;
  }
};

const getTextToSvgInstance = (fontId) => {
  if (TEXT_TO_SVG_CACHE.has(fontId)) {
    return TEXT_TO_SVG_CACHE.get(fontId);
  }

  const fontPath = resolveFontPath(fontId);
  if (!fontPath) {
    TEXT_TO_SVG_CACHE.set(fontId, null);
    return null;
  }

  try {
    const instance = TextToSVG.loadSync(fontPath);
    TEXT_TO_SVG_CACHE.set(fontId, instance);
    return instance;
  } catch (error) {
    console.warn(
      `Не вдалося підготувати TextToSVG для ${fontId}:`,
      error.message
    );
    TEXT_TO_SVG_CACHE.set(fontId, null);
    return null;
  }
};

const fontSupportsCodePoint = (fontInstance, codePoint) => {
  if (!fontInstance || typeof codePoint !== "number") return false;
  try {
    if (typeof fontInstance.hasGlyphForCodePoint === "function") {
      return fontInstance.hasGlyphForCodePoint(codePoint);
    }
    if (typeof fontInstance.glyphForCodePoint === "function") {
      const glyph = fontInstance.glyphForCodePoint(codePoint);
      return Boolean(glyph && glyph.id !== 0);
    }
  } catch (error) {
    return false;
  }
  return false;
};

const splitTextIntoFontRuns = (
  text = "",
  preferredFontId = DEFAULT_FONT_ID
) => {
  if (!text) {
    return [];
  }

  const fallbackFontId = DEFAULT_FONT_ID;
  const preferredFont =
    preferredFontId === fallbackFontId
      ? getFontkitFont(fallbackFontId)
      : getFontkitFont(preferredFontId);
  const fallbackFont = getFontkitFont(fallbackFontId);

  const runs = [];
  let buffer = "";
  let currentFontId = preferredFont ? preferredFontId : fallbackFontId;

  const flushBuffer = () => {
    if (buffer) {
      runs.push({ fontId: currentFontId, text: buffer });
      buffer = "";
    }
  };

  for (const char of text) {
    const codePoint = char.codePointAt(0);
    const preferredSupports = preferredFont
      ? fontSupportsCodePoint(preferredFont, codePoint)
      : false;
    const fallbackSupports = fallbackFont
      ? fontSupportsCodePoint(fallbackFont, codePoint)
      : false;

    let targetFontId = preferredSupports ? preferredFontId : fallbackFontId;

    if (!preferredSupports && !fallbackSupports) {
      // Немає підтримки ні в основному, ні у fallback — залишаємо основний, щоб не губити символ.
      targetFontId = preferredFont ? preferredFontId : fallbackFontId;
    }

    if (targetFontId !== currentFontId) {
      flushBuffer();
      currentFontId = targetFontId;
    }

    buffer += char;
  }

  flushBuffer();

  return runs;
};

const registerDocumentFonts = (doc) => {
  FONT_DEFINITIONS.forEach((def) => {
    try {
      const fontPath = resolveFontPath(def.id);
      if (fontPath) {
        doc.registerFont(def.id, fontPath);
      }
    } catch (error) {
      console.warn(`Не вдалося зареєструвати шрифт ${def.id}:`, error.message);
    }
  });
};

const normalizeFontFamily = (value) => {
  if (!value) return "";
  return value.replace(/"|'/g, "").trim().toLowerCase();
};

const resolveFontId = (fontFamily, fontWeight = "", fontStyle = "") => {
  const normalizedFamily = normalizeFontFamily(fontFamily);
  const baseId = FONT_ALIAS_LOOKUP.get(normalizedFamily) || DEFAULT_FONT_ID;

  const weight =
    typeof fontWeight === "string"
      ? fontWeight.toLowerCase()
      : String(fontWeight || "");
  const weightIsBold = weight.includes("bold") || Number(weight) >= 600;
  const style = (fontStyle || "").toLowerCase();
  const isItalic = style.includes("italic") || style.includes("oblique");

  if (baseId.startsWith("Arial")) {
    if (weightIsBold && isItalic) return "Arial-BoldItalicMT";
    if (weightIsBold) return "Arial-BoldMT";
    if (isItalic) return "Arial-ItalicMT";
  }

  return baseId;
};

const decodeHtmlEntities = (input = "") =>
  input
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

const parseStyleStringValue = (styleAttr = "", property) => {
  if (!styleAttr) return null;
  const regex = new RegExp(`${property}\\s*:\\s*([^;]+)`, "i");
  const match = styleAttr.match(regex);
  return match ? match[1].trim() : null;
};

const parseNumericListValue = (value, fallback = 0) => {
  if (typeof value !== "string") return fallback;
  const tokens = value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const token of tokens) {
    const numeric = parseFloat(token);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return fallback;
};

const extractSvgContentDimensions = (
  svgElement,
  fallbackWidth,
  fallbackHeight
) => {
  let width = Number(fallbackWidth) || 0;
  let height = Number(fallbackHeight) || 0;

  if (svgElement && typeof svgElement.getAttribute === "function") {
    const viewBoxAttr = svgElement.getAttribute("viewBox");
    if (viewBoxAttr) {
      const parts = viewBoxAttr
        .split(/[,\s]+/)
        .map((part) => parseFloat(part))
        .filter(Number.isFinite);
      if (parts.length >= 4) {
        width = parts[2];
        height = parts[3];
      }
    }

    if (!width) {
      width = parseNumericListValue(svgElement.getAttribute("width"), width);
    }
    if (!height) {
      height = parseNumericListValue(svgElement.getAttribute("height"), height);
    }
  }

  if (!width) width = 1;
  if (!height) height = 1;

  return { width, height };
};

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

const multiplyMatrices = (m1 = IDENTITY_MATRIX, m2 = IDENTITY_MATRIX) => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];

const degreesToRadians = (degrees) => (Number(degrees) || 0) * (Math.PI / 180);

const parseTransformOperation = (operation) => {
  if (!operation) return IDENTITY_MATRIX;
  const match = operation.match(/([a-z]+)\(([^)]+)\)/i);
  if (!match) return IDENTITY_MATRIX;

  const [, typeRaw, paramsRaw] = match;
  const type = typeRaw.toLowerCase();
  const params = paramsRaw
    .split(/[,\s]+/)
    .map((value) => parseFloat(value))
    .filter(Number.isFinite);

  switch (type) {
    case "matrix": {
      if (params.length >= 6) {
        return [
          params[0],
          params[1],
          params[2],
          params[3],
          params[4],
          params[5],
        ];
      }
      break;
    }
    case "translate": {
      const tx = params[0] ?? 0;
      const ty = params[1] ?? 0;
      return [1, 0, 0, 1, tx, ty];
    }
    case "scale": {
      const sx = params[0] ?? 1;
      const sy = params.length >= 2 ? params[1] : sx;
      return [sx, 0, 0, sy, 0, 0];
    }
    case "rotate": {
      const angle = degreesToRadians(params[0] ?? 0);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      if (params.length >= 3) {
        const cx = params[1];
        const cy = params[2];
        const translateToOrigin = [1, 0, 0, 1, -cx, -cy];
        const rotation = [cos, sin, -sin, cos, 0, 0];
        const translateBack = [1, 0, 0, 1, cx, cy];
        return multiplyMatrices(
          translateBack,
          multiplyMatrices(rotation, translateToOrigin)
        );
      }
      return [cos, sin, -sin, cos, 0, 0];
    }
    case "skewx": {
      const angle = degreesToRadians(params[0] ?? 0);
      return [1, 0, Math.tan(angle), 1, 0, 0];
    }
    case "skewy": {
      const angle = degreesToRadians(params[0] ?? 0);
      return [1, Math.tan(angle), 0, 1, 0, 0];
    }
    default:
      break;
  }

  return IDENTITY_MATRIX;
};

const parseTransformToMatrix = (transformString = "") => {
  if (!transformString) return IDENTITY_MATRIX;
  const operations = transformString.match(/[a-z]+\([^)]*\)/gi);
  if (!operations || operations.length === 0) return IDENTITY_MATRIX;

  return operations.reduce((acc, operation) => {
    const opMatrix = parseTransformOperation(operation);
    return multiplyMatrices(acc, opMatrix);
  }, IDENTITY_MATRIX);
};

const computeCumulativeMatrix = (node) => {
  let matrix = IDENTITY_MATRIX;
  let current = node;

  while (current && current.nodeType === 1) {
    if (typeof current.getAttribute === "function") {
      const transform = current.getAttribute("transform");
      if (transform) {
        const transformMatrix = parseTransformToMatrix(transform);
        matrix = multiplyMatrices(transformMatrix, matrix);
      }
    }
    current = current.parentNode;
  }

  return matrix;
};

const applyMatrixToPoint = (matrix = IDENTITY_MATRIX, x = 0, y = 0) => ({
  x: matrix[0] * x + matrix[2] * y + matrix[4],
  y: matrix[1] * x + matrix[3] * y + matrix[5],
});

const extractScaleFromMatrix = (matrix = IDENTITY_MATRIX) => {
  const scaleX = Math.hypot(matrix[0], matrix[1]) || 1;
  const scaleY = Math.hypot(matrix[2], matrix[3]) || 1;
  return { scaleX, scaleY };
};

// Heuristic detection of JsBarcode-like groups: a <g> containing many <rect>
// with same height and narrow varying widths. Keeps it conservative to avoid
// touching arbitrary artwork.
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

const rectHasWhiteFill = (rect) => {
  if (!rect || typeof rect.getAttribute !== "function") return false;
  const fillAttr = rect.getAttribute("fill");
  if (fillAttr && isWhiteColorString(fillAttr)) {
    return true;
  }
  const styleAttr = rect.getAttribute("style") || "";
  const match = styleAttr.match(/fill\s*:\s*([^;]+)/i);
  if (match && isWhiteColorString(match[1])) {
    return true;
  }
  return false;
};

const isLikelyBarcodeGroup = (node) => {
  if (!node || node.nodeType !== 1) return false;
  const tag = (node.nodeName || "").toLowerCase();
  if (tag !== "g" && tag !== "svg") return false;
  const rects = gatherBarcodeRects(node);
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
  // Heights should be almost equal
  if ((maxH - minH) / maxH > 0.05) return false;
  const avgW = widths.reduce((a, b) => a + b, 0) / widths.length;
  // Bars are vertically tall vs width
  if (maxH / avgW < 2) return false;
  return true;
};

const collectBarcodeGroups = (root, { suppressLogs = false } = {}) => {
  const results = [];
  const walk = (n) => {
    if (!n || n.nodeType !== 1) return;
    if (isLikelyBarcodeGroup(n)) {
      if (!suppressLogs) {
        console.log(
          `[layoutExportServer] Found barcode group:`,
          n.nodeName,
          "rects:",
          Array.from(n.childNodes || []).filter(
            (c) =>
              c?.nodeType === 1 && (c.nodeName || "").toLowerCase() === "rect"
          ).length
        );
      }
      results.push(n);
    }
    const children = Array.from(n.childNodes || []);
    children.forEach(walk);
  };
  walk(root);
  if (!suppressLogs) {
    console.log(
      `[layoutExportServer] Total barcodes collected: ${results.length}`
    );
  }
  return results;
};

const rectToTransformedQuad = (matrix, x, y, w, h) => {
  const p1 = applyMatrixToPoint(matrix, x, y);
  const p2 = applyMatrixToPoint(matrix, x + w, y);
  const p3 = applyMatrixToPoint(matrix, x + w, y + h);
  const p4 = applyMatrixToPoint(matrix, x, y + h);
  return [p1, p2, p3, p4];
};

const gatherBarcodeRects = (node) => {
  if (!node) return [];
  if (typeof node.getElementsByTagName === "function") {
    return Array.from(node.getElementsByTagName("rect"));
  }
  const rects = [];
  const stack = Array.from(node.childNodes || []);
  while (stack.length) {
    const current = stack.pop();
    if (!current || current.nodeType !== 1) continue;
    if ((current.nodeName || "").toLowerCase() === "rect") {
      rects.push(current);
    }
    if (current.childNodes && current.childNodes.length) {
      stack.push(...current.childNodes);
    }
  }
  return rects;
};

const drawBarcodePaths = (
  doc,
  barcodeGroups,
  { xPt, yTopPt, widthPt, heightPt, contentWidth, contentHeight }
) => {
  if (!doc || !Array.isArray(barcodeGroups) || barcodeGroups.length === 0) {
    return;
  }

  const svgScaleX = widthPt / contentWidth;
  const svgScaleY = heightPt / contentHeight;
  const svgScale = Math.min(svgScaleX, svgScaleY) || 1;
  const offsetXPt = xPt + (widthPt - contentWidth * svgScale) / 2;
  const offsetYPt = yTopPt + (heightPt - contentHeight * svgScale) / 2;

  doc.save();
  doc.fillColor(TEXT_OUTLINE_COLOR);

  barcodeGroups.forEach((group) => {
    const rects = gatherBarcodeRects(group);
    if (!rects.length) return;

    const widths = rects
      .map((rect) => parseFloat(rect.getAttribute("width") || "0"))
      .filter((value) => Number.isFinite(value) && value > 0);
    const minWidth = widths.length ? Math.min(...widths) : null;
    const widthThreshold = Number.isFinite(minWidth) ? minWidth * 4 : Infinity;

    const barRects = rects.filter((rect) => {
      if (rectHasWhiteFill(rect)) {
        return false;
      }
      const width = parseFloat(rect.getAttribute("width") || "0");
      if (!Number.isFinite(width) || width <= 0) return false;
      if (widthThreshold !== Infinity && width > widthThreshold) {
        return false;
      }
      return true;
    });

    if (!barRects.length) return;

    const pathSegments = [];
    const formatPoint = (point) =>
      `${point.x.toFixed(3)} ${point.y.toFixed(3)}`;

    barRects.forEach((rect) => {
      const x = parseFloat(rect.getAttribute("x") || "0");
      const y = parseFloat(rect.getAttribute("y") || "0");
      const w = parseFloat(rect.getAttribute("width") || "0");
      const h = parseFloat(rect.getAttribute("height") || "0");
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        return;
      }

      const matrix = computeCumulativeMatrix(rect);
      const quad = rectToTransformedQuad(matrix, x, y, w, h).map((point) => ({
        x: offsetXPt + point.x * svgScale,
        y: offsetYPt + point.y * svgScale,
      }));

      const segment = [
        `M ${formatPoint(quad[0])}`,
        `L ${formatPoint(quad[1])}`,
        `L ${formatPoint(quad[2])}`,
        `L ${formatPoint(quad[3])}`,
        "Z",
      ].join(" ");
      pathSegments.push(segment);
    });

    if (pathSegments.length) {
      doc.path(pathSegments.join(" ")).fill();
    }
  });

  doc.restore();
};

const app = express();

app.use(
  cors(
    ALLOWED_ORIGINS
      ? { origin: ALLOWED_ORIGINS, credentials: true }
      : { origin: true, credentials: true }
  )
);

app.use(express.json({ limit: "50mb" }));

const mmToPoints = (valueMm = 0) => (Number(valueMm) || 0) * MM_TO_PT;

const escapeForSvg = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildFallbackSvgMarkup = (placement, message) => {
  const width = Math.max(Number(placement?.width) || 0, 0);
  const height = Math.max(Number(placement?.height) || 0, 0);
  const label = escapeForSvg(message || "SVG недоступний");

  if (width <= 0 || height <= 0) {
    return null;
  }

  const inset = Math.min(width, height) > 2 ? 0.6 : 0.2;
  const fontSize = Math.min(Math.max(height * 0.18, 2), 6);
  const textY = height - Math.max(fontSize * 0.4, 1.5);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect x="${inset}" y="${inset}" width="${Math.max(
    width - inset * 2,
    0
  )}" height="${Math.max(
    height - inset * 2,
    0
  )}" fill="none" stroke="${OUTLINE_STROKE_COLOR}" stroke-width="${Math.min(
    inset * 2,
    1
  )}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
  <text x="${
    inset * 2
  }" y="${textY}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#404040">${label}</text>
</svg>`;
};

app.post("/api/layout-pdf", async (req, res) => {
  try {
    const { sheets, sheetLabel = "sheet", timestamp } = req.body || {};

    if (!Array.isArray(sheets) || sheets.length === 0) {
      return res
        .status(400)
        .json({ error: "Очікуємо принаймні один аркуш для експорту." });
    }

    const safeSheetLabel = String(sheetLabel || "sheet").replace(
      /[^a-z0-9-_]+/gi,
      "-"
    );
    const fileNameParts = [safeSheetLabel || "sheet"];
    if (timestamp) {
      fileNameParts.push(String(timestamp).replace(/[^0-9-]+/g, ""));
    }
    const fileName = `${fileNameParts.join("-") || "layout"}.pdf`;

    const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
    registerDocumentFonts(doc);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);

    sheets.forEach((sheet, sheetIndex) => {
      const pageWidthPt = mmToPoints(sheet?.width);
      const pageHeightPt = mmToPoints(sheet?.height);

      if (
        !Number.isFinite(pageWidthPt) ||
        !Number.isFinite(pageHeightPt) ||
        pageWidthPt <= 0 ||
        pageHeightPt <= 0
      ) {
        console.warn(
          `Пропускаємо аркуш ${sheetIndex} через некоректні розміри.`
        );
        return;
      }

      doc.addPage({ size: [pageWidthPt, pageHeightPt], margin: 0 });

      (sheet.placements || []).forEach((placement, placementIndex) => {
        const widthPt = mmToPoints(placement?.width);
        const heightPt = mmToPoints(placement?.height);
        const xPt = mmToPoints(placement?.x);
        const yTopPt = mmToPoints(placement?.y || 0);

        if (
          !Number.isFinite(widthPt) ||
          !Number.isFinite(heightPt) ||
          widthPt <= 0 ||
          heightPt <= 0
        ) {
          console.warn(
            `Пропускаємо елемент ${placementIndex} на аркуші ${sheetIndex} через некоректні розміри.`
          );
          return;
        }

        if (!Number.isFinite(xPt) || !Number.isFinite(yTopPt)) {
          console.warn(
            `Пропускаємо елемент ${placementIndex} на аркуші ${sheetIndex} через некоректні координати.`
          );
          return;
        }

        if (placement?.svgMarkup) {
          try {
            const parser = new DOMParser();
            const svgDocument = parser.parseFromString(
              placement.svgMarkup,
              "image/svg+xml"
            );
            const svgElement = svgDocument.documentElement;

            if (!svgElement) {
              throw new Error("SVG markup не містить кореневого елемента");
            }

            const { width: contentWidth, height: contentHeight } =
              extractSvgContentDimensions(
                svgElement,
                placement.sourceWidth || placement.width,
                placement.sourceHeight || placement.height
              );

            // Render background: clone SVG, remove text nodes and barcode groups, serialize
            const backgroundSvg = svgElement.cloneNode(true);
            const backgroundTextNodes =
              backgroundSvg.getElementsByTagName("text");
            // HTMLCollection is live; remove iteratively
            while (backgroundTextNodes.length > 0) {
              const node = backgroundTextNodes[0];
              node.parentNode?.removeChild(node);
            }

            const backgroundBarcodeGroups = collectBarcodeGroups(
              backgroundSvg,
              {
                suppressLogs: true,
              }
            );
            backgroundBarcodeGroups.forEach((group) => {
              group.parentNode?.removeChild(group);
            });

            const serializer = new XMLSerializer();
            const backgroundMarkup =
              serializer.serializeToString(backgroundSvg);

            if (backgroundMarkup) {
              try {
                svgToPdf(doc, backgroundMarkup, xPt, yTopPt, {
                  assumePt: false,
                  width: widthPt,
                  height: heightPt,
                  preserveAspectRatio: "xMidYMid meet",
                });
              } catch (backgroundError) {
                console.warn(
                  "Не вдалося відрендерити фон SVG:",
                  backgroundError.message
                );
              }
            }

            // Collect barcode groups from original SVG for later outline rendering
            const barcodeGroups = collectBarcodeGroups(svgElement);

            const textNodes = svgElement.getElementsByTagName("text");
            if (!textNodes || textNodes.length === 0) {
              if (barcodeGroups && barcodeGroups.length) {
                try {
                  drawBarcodePaths(doc, barcodeGroups, {
                    xPt,
                    yTopPt,
                    widthPt,
                    heightPt,
                    contentWidth,
                    contentHeight,
                  });
                } catch (barcodeDrawError) {
                  console.warn(
                    "Не вдалося намалювати каркас штрихкоду:",
                    barcodeDrawError.message
                  );
                }
              }

              return;
            }

            for (let idx = 0; idx < textNodes.length; idx += 1) {
              const textNode = textNodes[idx];
              try {
                const styleAttr = textNode.getAttribute("style") || "";
                const fontFamilyAttr =
                  textNode.getAttribute("font-family") ||
                  parseStyleStringValue(styleAttr, "font-family") ||
                  "";
                const fontWeightAttr =
                  textNode.getAttribute("font-weight") ||
                  parseStyleStringValue(styleAttr, "font-weight") ||
                  "";
                const fontStyleAttr =
                  textNode.getAttribute("font-style") ||
                  parseStyleStringValue(styleAttr, "font-style") ||
                  "";
                const anchorAttr =
                  textNode.getAttribute("text-anchor") ||
                  parseStyleStringValue(styleAttr, "text-anchor") ||
                  "start";
                let fontSizeValue =
                  textNode.getAttribute("font-size") ||
                  parseStyleStringValue(styleAttr, "font-size");

                let fontSize = parseFloat(fontSizeValue || "");
                if (!Number.isFinite(fontSize)) {
                  fontSize = 16;
                }

                const xAttr = textNode.getAttribute("x");
                const yAttr = textNode.getAttribute("y");
                const baseX = parseNumericListValue(xAttr, 0);
                const baseY = parseNumericListValue(yAttr, 0);

                const cumulativeMatrix = computeCumulativeMatrix(textNode);
                const point = applyMatrixToPoint(
                  cumulativeMatrix,
                  baseX,
                  baseY
                );
                const { scaleX: matrixScaleX, scaleY: matrixScaleY } =
                  extractScaleFromMatrix(cumulativeMatrix);

                const fontId = resolveFontId(
                  fontFamilyAttr,
                  fontWeightAttr,
                  fontStyleAttr
                );

                let textContent = textNode.textContent || "";
                textContent = decodeHtmlEntities(textContent.trim());
                if (!textContent) continue;

                const svgScaleX = widthPt / contentWidth;
                const svgScaleY = heightPt / contentHeight;
                const svgScale = Math.min(svgScaleX, svgScaleY) || 1;
                const offsetXPt = xPt + (widthPt - contentWidth * svgScale) / 2;
                const offsetYPt =
                  yTopPt + (heightPt - contentHeight * svgScale) / 2;
                const normalizedX = offsetXPt + point.x * svgScale;
                const normalizedY = offsetYPt + point.y * svgScale;

                const combinedScaleX = svgScale * matrixScaleX;
                const combinedScaleY = svgScale * matrixScaleY;
                const fontScaleX = combinedScaleX || svgScale;
                const fontScaleY = combinedScaleY || svgScale;
                const averageScale = (fontScaleX + fontScaleY) / 2 || svgScale;
                const scaledFontSize = fontSize * fontScaleY;
                const strokeWidthPt = Math.max(
                  TEXT_STROKE_WIDTH_PT * averageScale,
                  0.01
                );
                const anchorMode = (anchorAttr || "").trim().toLowerCase();

                const fontRuns = splitTextIntoFontRuns(textContent, fontId);
                if (!fontRuns.length) {
                  continue;
                }

                doc.save();

                const measureWithPdfkit = (requestedFontId, text) => {
                  let resolvedFontId = requestedFontId;
                  try {
                    doc.font(resolvedFontId);
                  } catch (fontError) {
                    console.warn(
                      `Шрифт ${resolvedFontId} недоступний, використаємо ${DEFAULT_FONT_ID}:`,
                      fontError.message
                    );
                    resolvedFontId = DEFAULT_FONT_ID;
                    doc.font(DEFAULT_FONT_ID);
                  }
                  doc.fontSize(scaledFontSize);
                  const width = doc.widthOfString(text);
                  const lineHeight = doc.currentLineHeight(true);
                  return {
                    width,
                    lineHeight,
                    fontId: resolvedFontId,
                    textToSvg: null,
                  };
                };

                const segmentMetrics = fontRuns.map((run) => {
                  const requestedFontId = run.fontId;
                  let textToSvgInstance = getTextToSvgInstance(requestedFontId);
                  let activeFontId = requestedFontId;

                  if (!textToSvgInstance) {
                    textToSvgInstance = getTextToSvgInstance(DEFAULT_FONT_ID);
                    if (textToSvgInstance) {
                      activeFontId = DEFAULT_FONT_ID;
                    }
                  }

                  if (!textToSvgInstance) {
                    const fallback = measureWithPdfkit(activeFontId, run.text);
                    return {
                      ...run,
                      fontId: fallback.fontId,
                      width: fallback.width,
                      lineHeight: fallback.lineHeight,
                      textToSvg: null,
                    };
                  }

                  try {
                    const metrics = textToSvgInstance.getMetrics(
                      run.text || "",
                      {
                        fontSize: scaledFontSize,
                        anchor: TEXT_TO_SVG_ANCHOR,
                      }
                    );
                    const width = metrics?.width ?? 0;
                    const height = metrics?.height ?? scaledFontSize;
                    return {
                      ...run,
                      fontId: activeFontId,
                      width,
                      lineHeight: height,
                      textToSvg: textToSvgInstance,
                    };
                  } catch (metricsError) {
                    console.warn(
                      `TextToSVG metrics failed для ${activeFontId}:`,
                      metricsError.message
                    );
                    TEXT_TO_SVG_CACHE.set(activeFontId, null);
                    const fallback = measureWithPdfkit(activeFontId, run.text);
                    return {
                      ...run,
                      fontId: fallback.fontId,
                      width: fallback.width,
                      lineHeight: fallback.lineHeight,
                      textToSvg: null,
                    };
                  }
                });

                const textWidth = segmentMetrics.reduce(
                  (acc, segment) => acc + segment.width,
                  0
                );
                const maxLineHeight =
                  segmentMetrics.reduce(
                    (max, segment) => Math.max(max, segment.lineHeight),
                    0
                  ) || scaledFontSize;
                const halfLineHeight = maxLineHeight / 2;

                console.log(
                  `Text #${idx}: fontSize=${fontSize.toFixed(
                    2
                  )}, scaled=${scaledFontSize.toFixed(2)}, ` +
                    `contentWidth=${contentWidth.toFixed(
                      2
                    )}, contentHeight=${contentHeight.toFixed(2)}, ` +
                    `matrixScale=(${matrixScaleX.toFixed(
                      3
                    )}, ${matrixScaleY.toFixed(
                      3
                    )}), svgScale=${svgScale.toFixed(3)}, ` +
                    `effectiveScale=(${fontScaleX.toFixed(
                      3
                    )}, ${fontScaleY.toFixed(3)}), point=(${point.x.toFixed(
                      2
                    )}, ${point.y.toFixed(2)}), ` +
                    `anchor=${
                      anchorMode || "(fallback-center)"
                    }, runs=${segmentMetrics
                      .map((run) => run.fontId)
                      .join(" -> ")}`
                );

                let drawX = normalizedX;
                if (anchorMode === "end" || anchorMode === "right") {
                  drawX -= textWidth;
                } else if (anchorMode === "middle" || anchorMode === "center") {
                  drawX -= textWidth / 2;
                } else {
                  // Fabric text usually stores anchor via styles; if not provided we assume centered placement.
                  drawX -= textWidth / 2;
                }

                let drawY = normalizedY - halfLineHeight;

                const outOfBounds =
                  drawX < xPt - widthPt * 0.25 ||
                  drawX > xPt + widthPt * 1.25 ||
                  drawY < yTopPt - heightPt * 0.5 ||
                  drawY > yTopPt + heightPt * 1.5;

                if (outOfBounds) {
                  drawX = xPt + widthPt / 2 - textWidth / 2;
                  const centerY = yTopPt + heightPt / 2;
                  drawY = centerY - halfLineHeight;
                }

                doc.strokeColor(TEXT_OUTLINE_COLOR);
                doc.lineWidth(strokeWidthPt);
                doc.lineJoin("round");
                doc.lineCap("round");

                let segmentX = drawX;
                segmentMetrics.forEach((segment) => {
                  if (!segment.text) {
                    return;
                  }

                  const renderWithPdfkit = () => {
                    try {
                      doc.font(segment.fontId);
                    } catch (segmentFontError) {
                      doc.font(DEFAULT_FONT_ID);
                    }
                    doc.fontSize(scaledFontSize);
                    doc.text(segment.text, segmentX, drawY, {
                      lineBreak: false,
                      stroke: true,
                      fill: false,
                    });
                  };

                  if (segment.textToSvg) {
                    try {
                      const pathData = segment.textToSvg.getD(segment.text, {
                        fontSize: scaledFontSize,
                        anchor: TEXT_TO_SVG_ANCHOR,
                      });
                      doc.save();
                      doc.translate(segmentX, drawY);
                      doc.path(pathData);
                      doc.stroke();
                      doc.restore();
                    } catch (pathError) {
                      console.warn(
                        `TextToSVG path failed для ${segment.fontId}:`,
                        pathError.message
                      );
                      TEXT_TO_SVG_CACHE.set(segment.fontId, null);
                      renderWithPdfkit();
                    }
                  } else {
                    renderWithPdfkit();
                  }

                  segmentX += segment.width;
                });

                doc.restore();
              } catch (textError) {
                console.error(
                  "Не вдалося намалювати текстовий елемент:",
                  textError.message
                );
              }
            }

            // After drawing text, draw barcode outlines if present
            if (barcodeGroups && barcodeGroups.length) {
              try {
                drawBarcodePaths(doc, barcodeGroups, {
                  xPt,
                  yTopPt,
                  widthPt,
                  heightPt,
                  contentWidth,
                  contentHeight,
                });
              } catch (barcodeDrawError) {
                console.warn(
                  "Не вдалося намалювати каркас штрихкоду:",
                  barcodeDrawError.message
                );
              }
            }

            return;
          } catch (error) {
            console.error(
              `Не вдалося відрендерити SVG для ${
                placement?.id || placementIndex
              }`,
              error
            );
          }
        }

        const fallbackMarkup = buildFallbackSvgMarkup(
          placement,
          placement?.svgMarkup ? "SVG недоступний" : "SVG відсутній"
        );
        if (fallbackMarkup) {
          try {
            svgToPdf(doc, fallbackMarkup, xPt, yTopPt, {
              assumePt: false,
              width: widthPt,
              height: heightPt,
              preserveAspectRatio: "xMidYMid meet",
            });
            return;
          } catch (error) {
            console.error(
              `Не вдалося відрендерити fallback SVG для ${
                placement?.id || placementIndex
              }`,
              error
            );
          }
        }

        // Якщо fallback SVG теж не вдався, малюємо мінімальний прямокутник у класичній системі координат.
        const yBottomPt =
          pageHeightPt -
          mmToPoints((placement?.y || 0) + (placement?.height || 0));
        doc.save();
        doc.lineWidth(1);
        doc.strokeColor(OUTLINE_STROKE_COLOR);
        doc.rect(xPt, yBottomPt, widthPt, heightPt).stroke();
        doc.restore();
      });
    });

    doc.end();
  } catch (error) {
    console.error("Помилка експорту PDF", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Не вдалося створити PDF." });
    } else {
      res.end();
    }
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(DEFAULT_PORT, () => {
  console.log(`Layout export server запущено на порту ${DEFAULT_PORT}`);
  if (ALLOWED_ORIGINS) {
    console.log(`Дозволені домени: ${ALLOWED_ORIGINS.join(", ")}`);
  }
});
