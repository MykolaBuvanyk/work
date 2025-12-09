import { useCallback, useMemo, useState } from "react";
import * as fabric from "fabric";
import "../utils/CircleWithCut";
import { useCanvasContext } from "../contexts/CanvasContext";
import { ensureShapeSvgId } from "../utils/shapeSvgId";

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
      console.warn(
        "useFabricCanvas scheduleFrame timeout fallback failed",
        error
      );
    }
  }, 16);
};

const DEFAULT_DESIGN = { width: 1300, height: 800 };
const CUSTOM_PROPS = [
  "id",
  "name",
  "data",
  "fromIconMenu",
  "fromShapeTab",
  "isCutElement",
  "cutType",
  "clipPathId",
  "originalWidth",
  "originalHeight",
  "placeholder",
  "useThemeColor",
  "initialFillColor",
  "initialStrokeColor",
  "isCircleWithLineCenterLine",
  "isCircleWithLineTopText",
  "isCircleWithLineBottomText",
  "isCircleWithCrossHorizontalLine",
  "isCircleWithCrossVerticalLine",
  "isCircleWithCrossTopText",
  "isCircleWithCrossBottomLeftText",
  "isCircleWithCrossBottomRightText",
  "followThemeStroke",
];

export const useFabricCanvas = () => {
  const {
    canvas,
    designs,
    currentDesignId,
    selectDesign,
    updateDesignById,
    updateGlobalColors,
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
              const maybePromise = canvas.loadFromJSON(
                design.jsonTemplate,
                finish
              );
              if (maybePromise && typeof maybePromise.then === "function") {
                maybePromise.then(finish).catch((err) => {
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

              // ВИПРАВЛЕННЯ: Примушуємо використовувати стандартні Fabric controls
              // щоб уникнути "Cannot read properties of undefined (reading 'x')" при першому кліку
              if (!obj.controls || Object.keys(obj.controls).length === 0) {
                const protoControls = fabric?.Object?.prototype?.controls || {};
                obj.controls = Object.entries(protoControls).reduce(
                  (acc, [key, control]) => {
                    if (control) acc[key] = control;
                    return acc;
                  },
                  {}
                );
              } else {
                // Санітаримо наявні контролли: пропускаємо undefined, щоб Fabric не падав на першому рендері
                Object.keys(obj.controls).forEach((key) => {
                  if (!obj.controls[key]) {
                    delete obj.controls[key];
                  }
                });
              }

              // Додаткова перевірка: у кожного контролу має бути positionHandler та render
              // Якщо їх нема — підміняємо на стандартні або видаляємо контроль
              try {
                const baseControls = fabric?.Object?.prototype?.controls || {};
                Object.keys(obj.controls || {}).forEach((key) => {
                  const ctrl = obj.controls[key];
                  const base = baseControls[key];
                  if (
                    !ctrl ||
                    typeof ctrl.positionHandler !== "function" ||
                    typeof ctrl.render !== "function"
                  ) {
                    if (base) {
                      obj.controls[key] = base;
                    } else {
                      delete obj.controls[key];
                      return;
                    }
                  }
                  // Обгортка positionHandler, щоб завжди повертались валідні {x,y}
                  const originalPos = obj.controls[key].positionHandler;
                  obj.controls[key].positionHandler = function (...args) {
                    try {
                      const res = originalPos?.apply(this, args);
                      if (
                        res &&
                        typeof res.x === "number" &&
                        typeof res.y === "number"
                      )
                        return res;
                    } catch {}
                    const center =
                      typeof obj.getCenterPoint === "function"
                        ? obj.getCenterPoint()
                        : { x: obj.left || 0, y: obj.top || 0 };
                    return { x: center.x, y: center.y };
                  };
                });
                // Базові параметри контролів
                if (
                  typeof obj.cornerSize !== "number" ||
                  !isFinite(obj.cornerSize)
                ) {
                  obj.cornerSize = 13;
                }
              } catch {}

              const fromShapeTab =
                obj.fromShapeTab === true ||
                (obj.data && obj.data.fromShapeTab === true);
              if (fromShapeTab) {
                ensureShapeSvgId(obj, canvas);
                if (obj.useThemeColor === undefined) {
                  obj.useThemeColor = false;
                }
                if (obj.followThemeStroke === undefined) {
                  obj.followThemeStroke = true;
                }
                if (
                  obj.initialFillColor === undefined &&
                  typeof obj.fill === "string" &&
                  obj.fill !== "" &&
                  obj.fill !== "transparent"
                ) {
                  obj.initialFillColor = obj.fill;
                }
                if (
                  obj.initialStrokeColor === undefined &&
                  typeof obj.stroke === "string" &&
                  obj.stroke !== ""
                ) {
                  obj.initialStrokeColor = obj.stroke;
                }
              }
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
          // 1) Відновлюємо стан тулбара
          scheduleFrame(() => {
            try {
              window.restoreToolbarState(canvasLoadedPayload.toolbarState);
            } catch (restoreError) {
              console.warn("Failed to restore toolbar state", restoreError);
            }
          });
          // 2) Примусово відновлюємо форму полотна згідно збереженого shapeType/розмірів
          // Робимо це наступним кадром, щоб updateSize зміг перебудувати clipPath/бордер коректно
          scheduleFrame(() => {
            try {
              if (typeof window.forceRestoreCanvasShape === "function") {
                window.forceRestoreCanvasShape(
                  canvasLoadedPayload.toolbarState
                );
              }
            } catch (shapeErr) {
              console.warn("Failed to force restore canvas shape", shapeErr);
            }
          });
        } else {
          // Нове полотно без збереженого стану тулбара — примусово встановлюємо білу тему за замовчуванням
          // Це не торкається існуючих полотен і гарантує, що новий дизайн не успадковує попередній «карбон»
          try {
            updateGlobalColors?.({
              textColor: "#000000",
              backgroundColor: "#FFFFFF",
              strokeColor: "#000000",
              fillColor: "transparent",
              backgroundType: "solid",
            });
          } catch (e) {
            // no-op
          }
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
      typeof window !== "undefined" &&
      typeof window.getCurrentToolbarState === "function"
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
