const getCanvasDimensions = (canvas) => {
  if (!canvas) return { width: 0, height: 0 };
  const width =
    typeof canvas.getWidth === "function" ? canvas.getWidth() : canvas.width;
  const height =
    typeof canvas.getHeight === "function" ? canvas.getHeight() : canvas.height;
  return { width: Number(width) || 0, height: Number(height) || 0 };
};

const PX_PER_MM = 72 / 25.4;
const BASE_CANVAS_WIDTH_MM = 120;
const BASE_CANVAS_HEIGHT_MM = 80;
const BASE_CANVAS_WIDTH_PX = BASE_CANVAS_WIDTH_MM * PX_PER_MM;
const BASE_CANVAS_HEIGHT_PX = BASE_CANVAS_HEIGHT_MM * PX_PER_MM;
const BASE_MIN_SIDE_PX = Math.min(BASE_CANVAS_WIDTH_PX, BASE_CANVAS_HEIGHT_PX);

const getObjectBounds = (obj) => {
  if (!obj) return { width: 0, height: 0 };
  try {
    if (typeof obj.getBoundingRect === "function") {
      const r = obj.getBoundingRect(true, true);
      return { width: Number(r?.width) || 0, height: Number(r?.height) || 0 };
    }
  } catch {}

  const width =
    typeof obj.getScaledWidth === "function"
      ? obj.getScaledWidth()
      : (obj.width || 0) * Math.abs(obj.scaleX || 1);
  const height =
    typeof obj.getScaledHeight === "function"
      ? obj.getScaledHeight()
      : (obj.height || 0) * Math.abs(obj.scaleY || 1);
  return { width: Number(width) || 0, height: Number(height) || 0 };
};

export const fitObjectToCanvas = (canvas, obj, options = {}) => {
  if (!canvas || !obj) return { scaled: false, factor: 1 };

  const maxRatio =
    typeof options.maxRatio === "number" ? options.maxRatio : 0.6;
  const paddingPx =
    typeof options.paddingPx === "number" ? options.paddingPx : 0;

  const { width: canvasW, height: canvasH } = getCanvasDimensions(canvas);
  if (canvasW <= 0 || canvasH <= 0) return { scaled: false, factor: 1 };

  const maxW = Math.max(0, canvasW * maxRatio - paddingPx * 2);
  const maxH = Math.max(0, canvasH * maxRatio - paddingPx * 2);

  const { width: objW, height: objH } = getObjectBounds(obj);
  if (objW <= 0 || objH <= 0) return { scaled: false, factor: 1 };

  const factor = Math.min(1, maxW / objW, maxH / objH);
  if (!Number.isFinite(factor) || factor >= 1) {
    return { scaled: false, factor: 1 };
  }

  try {
    const center =
      typeof obj.getCenterPoint === "function"
        ? obj.getCenterPoint()
        : { x: obj.left || 0, y: obj.top || 0 };

    const nextScaleX = (obj.scaleX || 1) * factor;
    const nextScaleY = (obj.scaleY || 1) * factor;

    obj.set({ scaleX: nextScaleX, scaleY: nextScaleY });

    if (typeof obj.setPositionByOrigin === "function") {
      obj.setPositionByOrigin(center, "center", "center");
    } else {
      obj.set({ left: center.x, top: center.y, originX: "center", originY: "center" });
    }

    try {
      obj.setCoords?.();
    } catch {}
  } catch {
    return { scaled: false, factor: 1 };
  }

  return { scaled: true, factor };
};

export const getCreationScaleByCanvas = (canvas) => {
  const { width: canvasW, height: canvasH } = getCanvasDimensions(canvas);
  if (canvasW <= 0 || canvasH <= 0) return 1;

  const minSidePx = Math.max(0, Math.min(canvasW, canvasH));
  if (!Number.isFinite(minSidePx) || minSidePx <= 0) return 1;

  const scale = minSidePx / (BASE_MIN_SIDE_PX || 1);
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return scale;
};

export const applyCreationScaleByCanvas = (canvas, obj) => {
  if (!canvas || !obj) return 1;
  const factor = getCreationScaleByCanvas(canvas);
  if (!Number.isFinite(factor) || Math.abs(factor - 1) < 1e-6) return 1;

  try {
    const signX = (Number(obj.scaleX) || 1) >= 0 ? 1 : -1;
    const signY = (Number(obj.scaleY) || 1) >= 0 ? 1 : -1;
    const nextScaleX = signX * Math.max(1e-6, Math.abs(Number(obj.scaleX) || 1) * factor);
    const nextScaleY = signY * Math.max(1e-6, Math.abs(Number(obj.scaleY) || 1) * factor);
    obj.set?.({ scaleX: nextScaleX, scaleY: nextScaleY });
    obj.setCoords?.();
  } catch {
    return 1;
  }

  return factor;
};

export const fitObjectsToCanvas = (canvas, objects, options = {}) => {
  if (!canvas || !Array.isArray(objects)) return;
  objects.forEach((obj) => {
    try {
      fitObjectToCanvas(canvas, obj, options);
    } catch {}
  });
};
