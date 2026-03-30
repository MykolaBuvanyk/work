const LIGHT_TO_TRANSPARENT_LUMA = 160;

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

export const convertSvgToThemeColorPreserveAlpha = (svgString, themeColor = "#000") => {
  try {
    const doc = new DOMParser().parseFromString(String(svgString || ""), "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgString;

    // Rewrite class-based style declarations used by Illustrator exports (.st0, .st1, ...).
    doc.querySelectorAll("style").forEach(styleEl => {
      const cssText = String(styleEl.textContent || "");
      if (!cssText) return;
      const rewritten = cssText.replace(
        /(fill|stroke|stop-color|color)\s*:\s*([^;}{]+)/gi,
        (_match, prop, rawVal) => `${prop}: ${toThemeColorPreserveAlphaValue(String(rawVal || "").trim(), themeColor)}`
      );
      styleEl.textContent = rewritten;
    });

    doc.querySelectorAll("*").forEach(el => {
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
            if (!["fill", "stroke", "stop-color", "color"].includes(key)) return chunk;
            return `${key}: ${toThemeColorPreserveAlphaValue(value, themeColor)}`;
          });

        el.setAttribute("style", pieces.join("; "));
      }

      ["fill", "stroke", "stop-color", "color"].forEach(attr => {
        if (!el.hasAttribute(attr)) return;
        const next = toThemeColorPreserveAlphaValue(el.getAttribute(attr), themeColor);
        if (next != null) el.setAttribute(attr, next);
      });
    });

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
