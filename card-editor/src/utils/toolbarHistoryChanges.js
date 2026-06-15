const CANVAS_CHANGE_TYPES = ["size", "colors", "shape"];

const normalizeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const stableStringify = (value) => JSON.stringify(value ?? null);

const pickSizeValues = (state) => ({
  width: normalizeNumber(state?.sizeValues?.width),
  height: normalizeNumber(state?.sizeValues?.height),
  cornerRadius: normalizeNumber(state?.sizeValues?.cornerRadius),
});

const pickColorValues = (state) => ({
  globalColors: state?.globalColors || null,
  selectedColorIndex: state?.selectedColorIndex ?? null,
  isAdhesiveTape: !!state?.isAdhesiveTape,
});

const pickShapeValue = (state) => state?.currentShapeType || "rectangle";

export const normalizeToolbarCanvasChangeTypes = (changeTypes) => {
  if (!Array.isArray(changeTypes)) return [];

  const unique = new Set(changeTypes.filter((type) => CANVAS_CHANGE_TYPES.includes(type)));
  return CANVAS_CHANGE_TYPES.filter((type) => unique.has(type));
};

export const getToolbarCanvasChangeTypes = (previousState, nextState) => {
  if (!previousState || !nextState) return [];

  const changeTypes = [];

  if (stableStringify(pickSizeValues(previousState)) !== stableStringify(pickSizeValues(nextState))) {
    changeTypes.push("size");
  }

  if (stableStringify(pickColorValues(previousState)) !== stableStringify(pickColorValues(nextState))) {
    changeTypes.push("colors");
  }

  if (pickShapeValue(previousState) !== pickShapeValue(nextState)) {
    changeTypes.push("shape");
  }

  return changeTypes;
};
