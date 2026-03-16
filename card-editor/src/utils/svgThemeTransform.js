const LIGHT_TO_TRANSPARENT_LUMA = 160;

const NAMED_COLORS = {
  black: [0, 0, 0],
  white: [255, 255, 255],
};

const isTransparentValue = (value = "") => {
  const v = String(value).trim().toLowerCase();
  return v === "none" || v === "transparent";
};

const parseHex = value => {
  const hex = value.trim().replace("#", "");
  if (![3, 4, 6, 8].includes(hex.length)) return null;

  const expand = token => (token.length === 1 ? token + token : token);
  const read = token => parseInt(token, 16);

  if (hex.length === 3 || hex.length === 4) {
    const r = read(expand(hex[0]));
    const g = read(expand(hex[1]));
    const b = read(expand(hex[2]));
    const a = hex.length === 4 ? read(expand(hex[3])) / 255 : 1;
    return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) || Number.isNaN(a)
      ? null
      : { r, g, b, a };
  }

  const r = read(hex.slice(0, 2));
  const g = read(hex.slice(2, 4));
  const b = read(hex.slice(4, 6));
  const a = hex.length === 8 ? read(hex.slice(6, 8)) / 255 : 1;
  return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) || Number.isNaN(a)
    ? null
    : { r, g, b, a };
};

const parseRgbLike = value => {
  const match = value
    .trim()
    .match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (!match) return null;

  const r = Math.max(0, Math.min(255, Number(match[1])));
  const g = Math.max(0, Math.min(255, Number(match[2])));
  const b = Math.max(0, Math.min(255, Number(match[3])));
  const a = match[4] == null ? 1 : Math.max(0, Math.min(1, Number(match[4])));
  return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) || Number.isNaN(a)
    ? null
    : { r, g, b, a };
};

const parseSvgColor = rawValue => {
  if (!rawValue) return null;
  const value = String(rawValue).trim().toLowerCase();
  if (!value || value === "currentcolor" || value.startsWith("url(")) return null;

  if (value.startsWith("#")) return parseHex(value);
  if (value.startsWith("rgb")) return parseRgbLike(value);
  if (NAMED_COLORS[value]) {
    const [r, g, b] = NAMED_COLORS[value];
    return { r, g, b, a: 1 };
  }
  return null;
};

const luminance = ({ r, g, b }) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const toMonochromeValue = (rawValue, themeColor) => {
  if (!rawValue) return rawValue;
  if (isTransparentValue(rawValue)) return "transparent";

  const color = parseSvgColor(rawValue);
  if (!color) return rawValue;
  if (color.a <= 0.001) return "transparent";

  return luminance(color) >= LIGHT_TO_TRANSPARENT_LUMA ? "transparent" : themeColor;
};

const rewriteStyleAttribute = (el, themeColor) => {
  const styleValue = el.getAttribute("style");
  if (!styleValue) return;

  const pieces = styleValue
    .split(";")
    .map(x => x.trim())
    .filter(Boolean)
    .map(chunk => {
      const idx = chunk.indexOf(":");
      if (idx === -1) return chunk;
      const key = chunk.slice(0, idx).trim().toLowerCase();
      const value = chunk.slice(idx + 1).trim();
      if (!["fill", "stroke", "stop-color", "color"].includes(key)) return chunk;
      return `${key}: ${toMonochromeValue(value, themeColor)}`;
    });

  el.setAttribute("style", pieces.join("; "));
};

export const convertSvgToThemeMonochrome = (svgString, themeColor = "#000") => {
  try {
    const doc = new DOMParser().parseFromString(String(svgString || ""), "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgString;

    doc.querySelectorAll("*").forEach(el => {
      rewriteStyleAttribute(el, themeColor);

      ["fill", "stroke", "stop-color", "color"].forEach(attr => {
        if (!el.hasAttribute(attr)) return;
        const next = toMonochromeValue(el.getAttribute(attr), themeColor);
        if (next != null) el.setAttribute(attr, next);
      });
    });

    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svgString;
  }
};

export const applyStrokeOnlyToSVG = (svgString, themeColor = "#000") => {
  try {
    const doc = new DOMParser().parseFromString(String(svgString || ""), "image/svg+xml");
    doc.querySelectorAll("path,polygon,polyline,rect,circle,ellipse,line").forEach(el => {
      el.setAttribute("fill", "transparent");
      el.setAttribute("stroke", themeColor);
      if (!el.getAttribute("stroke-width")) el.setAttribute("stroke-width", "1");
    });
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svgString;
  }
};