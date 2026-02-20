let shapeIdCounter = 0;
const SHAPE_ID_PREFIX = "shape";

const DEFAULT_ATTRS = Object.freeze({
  doubleContour: "data-shape-double-contour",
  thickness: "data-shape-thickness-px",
  thicknessMm: "data-shape-thickness-mm",
  width: "data-shape-bbox-width",
  height: "data-shape-bbox-height",
  shapeType: "data-shape-type",
  fillEnabled: "data-shape-has-fill",
  cutFlag: "data-shape-cut",
  cutType: "data-shape-cut-type",
});

const PX_PER_MM = 72 / 25.4;

const toFixedNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(4));
};

const patchShapeSvgSerialization = (object) => {
  if (!object || object.__shapeSvgPatched) return;

  const originalToSVG =
    typeof object.toSVG === "function" ? object.toSVG.bind(object) : null;

  if (originalToSVG) {
    object.toSVG = function patchedShapeToSVG(reviver) {
      let markup = originalToSVG(reviver);
      if (typeof markup !== "string" || !markup.startsWith("<")) {
        return markup;
      }

      const scaledWidth =
        typeof this.getScaledWidth === "function"
          ? this.getScaledWidth()
          : (this.width || 0) * (Math.abs(this.scaleX || 1));
      const scaledHeight =
        typeof this.getScaledHeight === "function"
          ? this.getScaledHeight()
          : (this.height || 0) * (Math.abs(this.scaleY || 1));

      let thicknessPx = Number(this.strokeWidth) || 0;
      if (!this.strokeUniform) {
        const scaleX = Math.abs(this.scaleX || 1);
        const scaleY = Math.abs(this.scaleY || 1);
        thicknessPx *= Math.max(scaleX, scaleY);
      }

      const attrParts = [];
      if (!markup.includes(`${DEFAULT_ATTRS.doubleContour}=`)) {
        attrParts.push(`${DEFAULT_ATTRS.doubleContour}="true"`);
      }

      const safeThickness = toFixedNumber(thicknessPx);
      const thicknessMmSource = (() => {
        const fromObject = Number(this.shapeThicknessMm);
        if (Number.isFinite(fromObject) && fromObject > 0) {
          return fromObject;
        }
        const fromData = Number(this?.data?.shapeThicknessMm);
        if (Number.isFinite(fromData) && fromData > 0) {
          return fromData;
        }
        const fromStroke = Number(thicknessPx);
        if (Number.isFinite(fromStroke) && fromStroke > 0) {
          return fromStroke / PX_PER_MM;
        }
        return null;
      })();
      const safeThicknessMm = toFixedNumber(thicknessMmSource);
      if (
        safeThickness !== null &&
        safeThickness > 0 &&
        !markup.includes(`${DEFAULT_ATTRS.thickness}=`)
      ) {
        attrParts.push(
          `${DEFAULT_ATTRS.thickness}="${safeThickness}"`
        );
      }

      if (
        safeThicknessMm !== null &&
        safeThicknessMm > 0 &&
        !markup.includes(`${DEFAULT_ATTRS.thicknessMm}=`)
      ) {
        attrParts.push(
          `${DEFAULT_ATTRS.thicknessMm}="${safeThicknessMm}"`
        );
      }

      const safeWidth = toFixedNumber(scaledWidth);
      if (
        safeWidth !== null &&
        safeWidth > 0 &&
        !markup.includes(`${DEFAULT_ATTRS.width}=`)
      ) {
        attrParts.push(`${DEFAULT_ATTRS.width}="${safeWidth}"`);
      }

      const safeHeight = toFixedNumber(scaledHeight);
      if (
        safeHeight !== null &&
        safeHeight > 0 &&
        !markup.includes(`${DEFAULT_ATTRS.height}=`)
      ) {
        attrParts.push(`${DEFAULT_ATTRS.height}="${safeHeight}"`);
      }

      const alreadyHasId = /\sid\s*=/.test(markup);
      if (!alreadyHasId && this.id) {
        attrParts.push(`id="${this.id}"`);
      }

      const shapeType =
        typeof this.shapeType === "string" && this.shapeType.trim()
          ? this.shapeType.trim()
          : null;
      if (shapeType && !markup.includes(`${DEFAULT_ATTRS.shapeType}=`)) {
        attrParts.push(`${DEFAULT_ATTRS.shapeType}="${shapeType}"`);
      }

      const hasFillEnabled = (() => {
        if (typeof this.hasFillEnabled === "boolean") {
          return this.hasFillEnabled;
        }
        if (this.data && typeof this.data === "object") {
          const candidate = this.data.hasFillEnabled;
          if (typeof candidate === "boolean") {
            return candidate;
          }
        }
        return false;
      })();

      if (hasFillEnabled && !markup.includes(`${DEFAULT_ATTRS.fillEnabled}=`)) {
        attrParts.push(`${DEFAULT_ATTRS.fillEnabled}="true"`);
      }

      const isCutElement = this.isCutElement === true || Boolean(this.cutType);
      if (isCutElement && !markup.includes(`${DEFAULT_ATTRS.cutFlag}=`)) {
        attrParts.push(`${DEFAULT_ATTRS.cutFlag}="true"`);
      }

      if (this.cutType && !markup.includes(`${DEFAULT_ATTRS.cutType}=`)) {
        attrParts.push(`${DEFAULT_ATTRS.cutType}="${String(this.cutType)}"`);
      }

      if (attrParts.length > 0) {
        const attrString = attrParts.join(" ");
        const firstSpace = markup.indexOf(" ");
        const firstClose = markup.indexOf(">");
        const insertIndex =
          firstSpace !== -1 && firstSpace < firstClose ? firstSpace : firstClose;
        if (insertIndex !== -1) {
          markup =
            markup.slice(0, insertIndex) +
            " " +
            attrString +
            " " +
            markup.slice(insertIndex);
        }
      }

      return markup;
    };
  }

  if (!object.__shapeSvgPatchedToObject && typeof object.toObject === "function") {
    const originalToObject = object.toObject.bind(object);
    object.toObject = (additionalProps = []) =>
      originalToObject([...additionalProps, "shapeSvgId"]);
    object.__shapeSvgPatchedToObject = true;
  }

  object.__shapeSvgPatched = true;
};

const isShapeId = (value, prefix = SHAPE_ID_PREFIX) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.startsWith(`${prefix}-`);
};

const isIdTaken = (canvas, candidate, self) => {
  if (!canvas || typeof canvas.getObjects !== "function") return false;
  return canvas.getObjects().some((obj) => obj !== self && obj?.id === candidate);
};

const buildRandomSegment = () => {
  const now = Date.now().toString(36);
  const entropy = Math.floor(Math.random() * 1e6)
    .toString(36)
    .padStart(4, "0");
  const counter = (shapeIdCounter += 1).toString(36).padStart(2, "0");
  return `${now}${counter}${entropy}`;
};

export const generateShapeSvgId = (prefix = SHAPE_ID_PREFIX) => {
  return `${prefix}-${buildRandomSegment()}`;
};

export const ensureShapeSvgId = (object, canvas, options = {}) => {
  if (!object) return null;

  const prefix = typeof options.prefix === "string" && options.prefix
    ? options.prefix
    : SHAPE_ID_PREFIX;

  const candidates = [
    object.id,
    object.svgTagId,
    object.shapeSvgId,
    object?.data?.shapeSvgId,
  ];

  let resolved = candidates.find((candidate) => isShapeId(candidate, prefix)) || null;

  if (!resolved || isIdTaken(canvas, resolved, object)) {
    let attempts = 0;
    do {
      resolved = generateShapeSvgId(prefix);
      attempts += 1;
    } while (isIdTaken(canvas, resolved, object) && attempts < 5);
  }

  if (typeof object.set === "function") {
    object.set("id", resolved);
  } else {
    object.id = resolved;
  }

  object.shapeSvgId = resolved;
  object.svgTagId = resolved;

  if (object.data && typeof object.data === "object") {
    object.data.shapeSvgId = resolved;
  } else if (!object.data) {
    object.data = { shapeSvgId: resolved };
  }

  patchShapeSvgSerialization(object);

  return resolved;
};

export const SHAPE_ID_SHARED_PREFIX = SHAPE_ID_PREFIX;
