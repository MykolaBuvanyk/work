const LIGHT_TO_TRANSPARENT_LUMA = 160;
const LIGHT_TO_WHITE_LUMA = 200;

const NAMED_COLORS = {
  black: [0, 0, 0],
  white: [255, 255, 255],
};

const WHITE_VALS = new Set(["white", "#ffffff", "#fff", "rgb(255,255,255)", "rgba(255,255,255,1)"]);
const NONE_VALS = new Set(["none", "transparent", "rgba(0,0,0,0)"]);

const normalizeColor = color => {
  if (!color) return "";
  return String(color).toLowerCase().replace(/\s+/g, "");
};

const isWhite = color => {
  const normalized = normalizeColor(color);
  return Boolean(normalized) && WHITE_VALS.has(normalized);
};

const isTransparent = color => {
  const normalized = normalizeColor(color);
  return Boolean(normalized) && NONE_VALS.has(normalized);
};

const isInherit = color => String(color || "").trim().toLowerCase() === "inherit";

const isTransparentValue = (value = "") => {
  const v = String(value).trim().toLowerCase();
  return v === "none" || v === "transparent";
};

const DEFAULT_FILL_TAGS = new Set([
  "path",
  "rect",
  "circle",
  "ellipse",
  "polygon",
  "text",
  "tspan",
]);

const DEFAULT_STROKE_TAGS = new Set(["line", "polyline"]);

const PAINT_FALLBACK_SKIP_TAGS = new Set([
  "defs",
  "clippath",
  "mask",
  "pattern",
  "marker",
  "symbol",
  "lineargradient",
  "radialgradient",
  "filter",
]);

const THEME_REWRITE_ATTRS = ["fill", "stroke", "stop-color", "color"];

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

const toThemeColorPreserveAlphaValue = (rawValue, themeColor) => {
  if (!rawValue) return rawValue;
  if (isTransparentValue(rawValue)) return "transparent";

  const color = parseSvgColor(rawValue);
  if (!color) return rawValue;
  if (color.a <= 0.001) return "transparent";

  // Keep light/white artwork white so uploaded SVGs preserve internal contrast
  // after theme conversion, e.g. white text inside a dark filled shape.
  if (luminance(color) >= LIGHT_TO_WHITE_LUMA) {
    return "#ffffff";
  }

  return themeColor;
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

const parseSvgStyles = svgEl => {
  const styleMap = {};
  const styleEls = svgEl.querySelectorAll("style");
  styleEls.forEach(styleEl => {
    const text = String(styleEl.textContent || "");
    const ruleRe = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
    let rule;
    while ((rule = ruleRe.exec(text)) !== null) {
      const cls = rule[1];
      const props = {};
      const propRe = /([\w-]+)\s*:\s*([^;]+)/g;
      let prop;
      while ((prop = propRe.exec(rule[2])) !== null) {
        props[String(prop[1] || "").trim()] = String(prop[2] || "").trim();
      }
      styleMap[cls] = props;
    }
  });
  return styleMap;
};

const getEffectiveProp = (el, prop, styleMap) => {
  if (el.style && el.style[prop] && el.style[prop] !== "") return el.style[prop];

  const styleAttr = el.getAttribute("style");
  if (styleAttr) {
    const re = new RegExp(`${prop}\\s*:\\s*([^;]+)`, "i");
    const match = re.exec(styleAttr);
    if (match) return String(match[1] || "").trim();
  }

  const classes = String(el.getAttribute("class") || "")
    .split(/\s+/)
    .filter(Boolean);
  for (const cls of classes) {
    if (styleMap[cls] && styleMap[cls][prop] !== undefined) {
      return styleMap[cls][prop];
    }
  }

  const attrVal = el.getAttribute(prop);
  return attrVal || null;
};

const removeStylePropFromStyleAttr = (node, prop) => {
  const styleAttr = node.getAttribute("style");
  if (!styleAttr) return;
  const cleaned = styleAttr.replace(new RegExp(`${prop}\\s*:[^;]+;?`, "gi"), "").trim();
  if (cleaned) node.setAttribute("style", cleaned);
  else node.removeAttribute("style");
};

const setStyleProp = (node, prop, value) => {
  if (!node || !prop || value == null) return;

  const styleAttr = String(node.getAttribute("style") || "").trim();
  const cleaned = styleAttr
    ? styleAttr.replace(new RegExp(`${prop}\\s*:[^;]+;?`, "gi"), "").trim()
    : "";
  const normalizedBase = cleaned.replace(/;+\s*$/, "").trim();
  const next = normalizedBase ? `${normalizedBase}; ${prop}: ${value}` : `${prop}: ${value}`;
  node.setAttribute("style", next);
};

const readStyleProp = (styleAttr, prop) => {
  if (!styleAttr) return null;
  const re = new RegExp(`${prop}\\s*:\\s*([^;]+)`, "i");
  const match = re.exec(String(styleAttr));
  return match ? String(match[1] || "").trim() : null;
};

const getPropFromClassStyles = (node, prop, styleMap) => {
  const classNames = String(node?.getAttribute?.("class") || "")
    .split(/\s+/)
    .filter(Boolean);
  for (const className of classNames) {
    if (styleMap[className] && styleMap[className][prop] !== undefined) {
      return String(styleMap[className][prop] || "").trim();
    }
  }
  return null;
};

const getInheritedPaintValue = (node, prop, styleMap) => {
  let current = node;
  while (current && current.nodeType === 1) {
    const attrVal = current.getAttribute?.(prop);
    if (attrVal != null && String(attrVal).trim() !== "") {
      return String(attrVal).trim();
    }

    const styleVal = readStyleProp(current.getAttribute?.("style"), prop);
    if (styleVal != null && styleVal !== "") {
      return styleVal;
    }

    const classStyleVal = getPropFromClassStyles(current, prop, styleMap);
    if (classStyleVal != null && classStyleVal !== "") {
      return classStyleVal;
    }

    const tag = String(current.tagName || "").toLowerCase();
    if (tag === "svg") break;
    current = current.parentElement;
  }

  return null;
};

const isInsidePaintFallbackSkipContainer = node => {
  let current = node?.parentElement || null;
  while (current) {
    const tag = String(current.tagName || "").toLowerCase();
    if (PAINT_FALLBACK_SKIP_TAGS.has(tag)) {
      return true;
    }
    if (tag === "svg") return false;
    current = current.parentElement;
  }
  return false;
};

const shouldSkipThemeRewriteForNode = node => {
  if (!node || node.nodeType !== 1) return true;

  const tag = String(node.tagName || "").toLowerCase();
  if (tag === "style") return true;
  if (PAINT_FALLBACK_SKIP_TAGS.has(tag)) return true;

  return isInsidePaintFallbackSkipContainer(node);
};

const applyDefaultThemePaintForUnspecified = (svgEl, themeColor) => {
  if (!svgEl) return;

  const styleMap = parseSvgStyles(svgEl);
  svgEl
    .querySelectorAll("path,rect,circle,ellipse,polygon,polyline,line,text,tspan")
    .forEach(node => {
      if (!node || isInsidePaintFallbackSkipContainer(node)) return;

      const tag = String(node.tagName || "").toLowerCase();
      if (!DEFAULT_FILL_TAGS.has(tag) && !DEFAULT_STROKE_TAGS.has(tag)) {
        return;
      }

      const inheritedFill = getInheritedPaintValue(node, "fill", styleMap);
      const inheritedStroke = getInheritedPaintValue(node, "stroke", styleMap);
      const hasFillDefined = inheritedFill != null && inheritedFill !== "";
      const hasStrokeDefined = inheritedStroke != null && inheritedStroke !== "";
      if (hasFillDefined || hasStrokeDefined) return;

      if (DEFAULT_STROKE_TAGS.has(tag)) {
        node.setAttribute("stroke", themeColor);
      } else {
        node.setAttribute("fill", themeColor);
      }
    });
};

export const convertSvgToThemeMonochrome = (svgString, themeColor = "#000") => {
  try {
    const doc = new DOMParser().parseFromString(String(svgString || ""), "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgString;

    doc.querySelectorAll("*").forEach(el => {
      if (shouldSkipThemeRewriteForNode(el)) return;

      rewriteStyleAttribute(el, themeColor);

      THEME_REWRITE_ATTRS.forEach(attr => {
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

export const convertSvgToThemeColorPreserveAlpha = (svgString, themeColor = "#000") => {
  try {
    const doc = new DOMParser().parseFromString(String(svgString || ""), "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgString;

    const styleMap = parseSvgStyles(svg);

    doc.querySelectorAll("*").forEach(el => {
      if (shouldSkipThemeRewriteForNode(el)) return;

      const styleValue = el.getAttribute("style");
      if (styleValue) {
        const pieces = styleValue
          .split(";")
          .map(x => x.trim())
          .filter(Boolean)
          .map(chunk => {
            const idx = chunk.indexOf(":");
            if (idx === -1) return chunk;
            const key = chunk.slice(0, idx).trim().toLowerCase();
            const value = chunk.slice(idx + 1).trim();
            if (!THEME_REWRITE_ATTRS.includes(key)) return chunk;
            return `${key}: ${toThemeColorPreserveAlphaValue(value, themeColor)}`;
          });

        el.setAttribute("style", pieces.join("; "));
      }

      THEME_REWRITE_ATTRS.forEach(attr => {
        if (!el.hasAttribute(attr)) return;
        const next = toThemeColorPreserveAlphaValue(el.getAttribute(attr), themeColor);
        if (next != null) el.setAttribute(attr, next);
      });

      THEME_REWRITE_ATTRS.forEach(attr => {
        if (el.hasAttribute(attr)) return;

        const styleDefined = readStyleProp(el.getAttribute("style"), attr);
        if (styleDefined != null && styleDefined !== "") return;

        const classValue = getPropFromClassStyles(el, attr, styleMap);
        if (classValue == null || classValue === "") return;

        const next = toThemeColorPreserveAlphaValue(classValue, themeColor);
        if (next != null) setStyleProp(el, attr, next);
      });
    });

    // Fallback: if a drawable node has no explicit/inherited paint definition,
    // assign theme color so default-black SVG shapes can follow canvas recolor.
    applyDefaultThemePaintForUnspecified(svg, themeColor);

    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svgString;
  }
};

export const convertSvgToBlackAlphaMask = (svgString, themeColor = "#000") => {
  try {
    const raw = String(svgString || "").trim();
    if (!raw) return svgString;

    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "image/svg+xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) return svgString;

    const svg = doc.documentElement;
    if (!svg || String(svg.nodeName || "").toLowerCase() !== "svg") return svgString;

    const styleMap = parseSvgStyles(svg);

    svg.querySelectorAll("rect").forEach(rect => {
      const fill = getEffectiveProp(rect, "fill", styleMap);
      const width = parseFloat(rect.getAttribute("width"));
      const vbw = svg.viewBox?.baseVal?.width || 0;
      if (isWhite(fill) && (Number.isNaN(width) || vbw === 0 || width >= vbw * 0.9)) {
        rect.setAttribute("fill", "none");
        rect.removeAttribute("class");
        if (rect.style) rect.style.fill = "";
      }
    });

    const maskId = `m_${Math.random().toString(36).slice(2, 8)}`;
    const ns = "http://www.w3.org/2000/svg";

    const defs = doc.createElementNS(ns, "defs");
    const mask = doc.createElementNS(ns, "mask");
    mask.setAttribute("id", maskId);

    const maskBg = doc.createElementNS(ns, "rect");
    maskBg.setAttribute("width", "100%");
    maskBg.setAttribute("height", "100%");
    maskBg.setAttribute("fill", "white");
    mask.appendChild(maskBg);

    const ignoredTags = new Set(["defs", "style", "sodipodi:namedview", "metadata", "title", "desc"]);
    const toMove = Array.from(svg.childNodes).filter(node => {
      return node.nodeType === 1 && !ignoredTags.has(String(node.nodeName || "").toLowerCase());
    });

    const contentGroup = doc.createElementNS(ns, "g");
    contentGroup.setAttribute("mask", `url(#${maskId})`);
    toMove.forEach(node => contentGroup.appendChild(node));

    const maskGroup = contentGroup.cloneNode(true);
    maskGroup.removeAttribute("mask");

    const traverse = (node, inMask) => {
      if (!node || node.nodeType !== 1) return;

      ["fill", "stroke"].forEach(prop => {
        const val = getEffectiveProp(node, prop, styleMap);
        if (!val || isInherit(val)) return;

        let newVal = null;
        if (isWhite(val)) {
          newVal = inMask ? "#000000" : "none";
        } else if (!isTransparent(val)) {
          newVal = inMask ? "none" : themeColor;
        }

        if (newVal !== null) {
          node.removeAttribute("class");
          node.setAttribute(prop, newVal);
          if (node.style) node.style[prop] = "";
          removeStylePropFromStyleAttr(node, prop);
        }
      });

      Array.from(node.childNodes).forEach(child => traverse(child, inMask));
    };

    traverse(contentGroup, false);
    traverse(maskGroup, true);

    mask.appendChild(maskGroup);
    defs.appendChild(mask);
    svg.appendChild(defs);
    svg.appendChild(contentGroup);

    return new XMLSerializer().serializeToString(svg);
  } catch {
    return svgString;
  }
};

export const applyStrokeOnlyToSVG = (svgString, themeColor = "#000") => {
  try {
    const doc = new DOMParser().parseFromString(String(svgString || ""), "image/svg+xml");
    doc.querySelectorAll("path,polygon,polyline,rect,circle,ellipse,line").forEach(el => {
      if (shouldSkipThemeRewriteForNode(el)) return;
      el.setAttribute("fill", "transparent");
      el.setAttribute("stroke", themeColor);
      if (!el.getAttribute("stroke-width")) el.setAttribute("stroke-width", "1");
    });
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svgString;
  }
};

export const cleanSvgWithResvg = async svgString => {
  // Browser-side fallback: return as-is.
  // Server-side resvg-js cleanup is applied before fabric.loadSVGFromString.
  return svgString;
};
