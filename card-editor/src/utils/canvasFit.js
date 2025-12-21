const getCanvasDimensions = (canvas) => {
  if (!canvas) return { width: 0, height: 0 };
  const width =
    typeof canvas.getWidth === "function" ? canvas.getWidth() : canvas.width;
  const height =
    typeof canvas.getHeight === "function" ? canvas.getHeight() : canvas.height;
  return { width: Number(width) || 0, height: Number(height) || 0 };
};

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

export const fitObjectsToCanvas = (canvas, objects, options = {}) => {
  if (!canvas || !Array.isArray(objects)) return;
  objects.forEach((obj) => {
    try {
      fitObjectToCanvas(canvas, obj, options);
    } catch {}
  });
};
