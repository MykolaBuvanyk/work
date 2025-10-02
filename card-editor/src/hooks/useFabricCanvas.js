import { useCallback, useMemo, useState } from "react";
import { useCanvasContext } from "../contexts/CanvasContext";

const scheduleFrame = (fn) => {
  if (typeof window === "undefined") {
    return;
  }

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      try {
        fn();
      } catch (error) {
        console.warn("useFabricCanvas scheduleFrame callback failed", error);
      }
    });
    return;
  }

  setTimeout(() => {
    try {
      fn();
    } catch (error) {
      console.warn("useFabricCanvas scheduleFrame timeout fallback failed", error);
    }
  }, 16);
};

const DEFAULT_DESIGN = { width: 1300, height: 800 };
const CUSTOM_PROPS = [
  "id",
  "name",
  "data",
  "fromIconMenu",
  "isCutElement",
  "cutType",
  "clipPathId",
  "originalWidth",
  "originalHeight",
  "placeholder",
];

export const useFabricCanvas = () => {
  const {
    canvas,
    designs,
    currentDesignId,
    selectDesign,
    updateDesignById,
  } = useCanvasContext();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const currentDesign = useMemo(() => {
    if (!Array.isArray(designs) || !designs.length) return null;
    return designs.find((design) => design?.id === currentDesignId) ?? null;
  }, [designs, currentDesignId]);

  const loadDesign = useCallback(
    async (design) => {
      if (!canvas || !design) return;

      setIsLoading(true);
      setError(null);

      const designWidth = design.width ?? DEFAULT_DESIGN.width;
      const designHeight = design.height ?? DEFAULT_DESIGN.height;

      try {
        canvas.clear?.();
        canvas.setBackgroundColor?.(null);
        canvas.discardActiveObject?.();

        if (typeof canvas.setDimensions === "function") {
          canvas.setDimensions({ width: designWidth, height: designHeight });
        } else {
          canvas.setWidth?.(designWidth);
          canvas.setHeight?.(designHeight);
        }

        canvas.setZoom?.(1);

        if (design.jsonTemplate) {
          await new Promise((resolve, reject) => {
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              resolve();
            };

            try {
              const maybePromise = canvas.loadFromJSON(design.jsonTemplate, finish);
              if (maybePromise && typeof maybePromise.then === "function") {
                maybePromise
                  .then(finish)
                  .catch((err) => {
                    settled = true;
                    reject(err);
                  });
              }
            } catch (loadErr) {
              settled = true;
              reject(loadErr);
            }
          });
        }

        const forceRender = () => {
          canvas.forEachObject?.((obj) => {
            try {
              obj.dirty = true;
              if (obj.group) obj.group.dirty = true;
              obj.setCoords?.();
            } catch (innerErr) {
              console.warn("Failed to refresh canvas object", innerErr);
            }
          });
          canvas.renderAll?.();
          canvas.requestRenderAll?.();
        };

        forceRender();
        scheduleFrame(forceRender);
        scheduleFrame(() => canvas.calcOffset?.());
        canvas.calcOffset?.();
        canvas.requestRenderAll?.();

        const canvasLoadedPayload = {
          designId: design.id,
          toolbarState: design.toolbarState || null,
        };

        canvas.fire?.("canvas:loaded", canvasLoadedPayload);

        if (
          canvasLoadedPayload.toolbarState &&
          typeof window !== "undefined" &&
          typeof window.restoreToolbarState === "function"
        ) {
          scheduleFrame(() => {
            try {
              window.restoreToolbarState(canvasLoadedPayload.toolbarState);
            } catch (restoreError) {
              console.warn("Failed to restore toolbar state", restoreError);
            }
          });
        }
      } catch (err) {
        console.error("Failed to load design", err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [canvas]
  );

  const saveCurrentDesign = useCallback(() => {
    if (!canvas || !currentDesign) return null;

    const serialized = canvas.toJSON?.(CUSTOM_PROPS) ?? null;
    if (!serialized) return null;

    let width = currentDesign.width;
    let height = currentDesign.height;

    try {
      if (typeof canvas.getDesignSize === "function") {
        const size = canvas.getDesignSize() || {};
        width = size.width ?? width;
        height = size.height ?? height;
      } else {
        width = canvas.getWidth?.() ?? width;
        height = canvas.getHeight?.() ?? height;
      }
    } catch (sizeErr) {
      console.warn("Unable to read canvas size during save", sizeErr);
    }

    const toolbarState =
      typeof window !== "undefined" && typeof window.getCurrentToolbarState === "function"
        ? window.getCurrentToolbarState()
        : null;

    const backgroundColor =
      canvas.backgroundColor ||
      canvas.get?.("backgroundColor") ||
      currentDesign.backgroundColor ||
      "#FFFFFF";

    updateDesignById?.(currentDesign.id, {
      jsonTemplate: serialized,
      width,
      height,
      backgroundColor,
      toolbarState,
      updatedAt: Date.now(),
    });

    return serialized;
  }, [canvas, currentDesign, updateDesignById]);

  return {
    canvas,
    designs,
    currentDesign,
    currentDesignId,
    isLoading,
    error,
    loadDesign,
    saveCurrentDesign,
    selectDesign,
  };
};

export default useFabricCanvas;
