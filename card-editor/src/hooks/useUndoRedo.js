import { useState, useEffect, useRef, useCallback } from "react";
import { useCanvasContext } from "../contexts/CanvasContext";
import { UndoRedoKeyboardHandler } from "../utils/undoRedoKeyboardHandler";
import { exportCanvas, restoreElementProperties } from "../utils/projectStorage";
import * as fabric from "fabric";
import "../utils/CircleWithCut";
import { ensureShapeSvgId } from "../utils/shapeSvgId";
import {
  buildQrSvgMarkup,
  computeQrVectorData,
  decorateQrGroup,
  DEFAULT_QR_CELL_SIZE,
  QR_DISPLAY_LAYER_ID,
  QR_EXPORT_LAYER_ID,
} from "../utils/qrFabricUtils";

export const useUndoRedo = () => {
  const { canvas } = useCanvasContext();
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Refs для контролю стану
  const isSavingRef = useRef(false);
  const isRestoringRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const lastStateRef = useRef(null);
  const lastComparableStateRef = useRef(null);
  const keyboardHandlerRef = useRef(null);
  const ignoreSavesUntilRef = useRef(0);

  // Конфігурація
  const MAX_HISTORY_SIZE = 3;
  const SAVE_DELAY = 300;

  const postProcessLoadedObjects = useCallback(() => {
    if (!canvas || typeof canvas.getObjects !== "function") return;

    try {
      canvas.getObjects().forEach((obj) => {
        if (!obj) return;
        try {
          // Як в useFabricCanvas: для фігур з Shape tab гарантуємо shapeSvgId + theme-follow пропи.
          const fromShapeTab =
            obj.fromShapeTab === true || (obj.data && obj.data.fromShapeTab === true);

          if (fromShapeTab) {
            try {
              ensureShapeSvgId(obj, canvas);
            } catch {}

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

          obj.dirty = true;
          obj.setCoords?.();
          if (obj.group) {
            obj.group.dirty = true;
          }
        } catch {}
      });

      canvas.renderAll?.();
      canvas.requestRenderAll?.();
    } catch {}
  }, [canvas]);

  // Синхронізуємо refs з state
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Порівняння станів: exportCanvas додає багато волатильних полів (preview/toolbarState/timestamp),
  // через які історія створюється навіть без реальних змін полотна.
  const normalizeSnapshotForCompare = (snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return snapshot;

    const normalized = {
      ...snapshot,
      preview: undefined,
      previewSvg: undefined,
      toolbarState: undefined,
      timestamp: undefined,
      lastSaved: undefined,
      updatedAt: undefined,
      createdAt: undefined,
    };

    if (normalized.json && typeof normalized.json === "object") {
      const json = { ...normalized.json };
      json.preview = undefined;
      json.previewSvg = undefined;
      json.timestamp = undefined;
      json.lastSaved = undefined;
      json.updatedAt = undefined;
      json.createdAt = undefined;

      if (Array.isArray(json.objects)) {
        json.objects = json.objects.map((obj) => {
          if (!obj || typeof obj !== "object") return obj;
          const clean = { ...obj };
          // toolbarSnapshot переприсвоюється під час export і може змінюватися від selection/toolbar
          delete clean.toolbarSnapshot;
          return clean;
        });
      }

      normalized.json = json;
    }

    return normalized;
  };

  const statesAreEqual = (state1, state2) => {
    if (!state1 || !state2) return false;
    try {
      return (
        JSON.stringify(normalizeSnapshotForCompare(state1)) ===
        JSON.stringify(normalizeSnapshotForCompare(state2))
      );
    } catch (error) {
      console.warn("Error comparing states:", error);
      return false;
    }
  };

  // Покращена функція збереження стану
  const saveState = useCallback(async (description) => {
    if (Date.now() < (ignoreSavesUntilRef.current || 0)) {
      return;
    }

    // МНОЖИННІ ПЕРЕВІРКИ для запобігання збереженню під час undo/redo
    if (!canvas || 
        isSavingRef.current || 
        isRestoringRef.current || 
        canvas.__suspendUndoRedo) {
      console.log('Saving blocked - canvas operations in progress');
      return;
    }

    try {
      console.log('Saving canvas state...');
      isSavingRef.current = true;

      // Використовуємо exportCanvas з projectStorage для повної сумісності
      // Отримуємо toolbarState так само як в projectStorage
      let toolbarState = {};
      if (window.getCurrentToolbarState) {
        toolbarState = window.getCurrentToolbarState() || {};
      }

      // Експортуємо стан використовуючи стандартну функцію
      // keepClipPath: true - важливо для збереження подвійних контурів та масок при undo/redo
      const stateWithMetadata = await exportCanvas(canvas, toolbarState, { keepClipPath: true });
      
      if (!stateWithMetadata) {
        console.error('Failed to export canvas state');
        return null;
      }

      // Додаємо timestamp якщо його немає (хоча exportCanvas додає lastSaved)
      if (!stateWithMetadata.timestamp) {
        stateWithMetadata.timestamp = Date.now();
      }

      // Перевіряємо, чи відрізняється новий стан від останнього збереженого
      const comparable = normalizeSnapshotForCompare(stateWithMetadata);
      if (lastComparableStateRef.current && statesAreEqual(comparable, lastComparableStateRef.current)) {
        console.log('State unchanged, skipping save');
        return stateWithMetadata;
      }

      lastStateRef.current = stateWithMetadata;
      lastComparableStateRef.current = comparable;

      setHistory((prevHistory) => {
        const currentIndex = historyIndexRef.current;
        // Обрізаємо історію після поточного індексу та додаємо новий стан
        const newHistory = [...prevHistory.slice(0, currentIndex + 1), stateWithMetadata];

        // Обмежуємо розмір історії
        if (newHistory.length > MAX_HISTORY_SIZE) {
          const removeCount = newHistory.length - MAX_HISTORY_SIZE;
          newHistory.splice(0, removeCount);
          setHistoryIndex(newHistory.length - 1);
        } else {
          setHistoryIndex(newHistory.length - 1);
        }

        console.log(`History updated: ${newHistory.length} states, current index: ${newHistory.length - 1}`);
        return newHistory;
      });

      return stateWithMetadata;
    } catch (error) {
      console.error('Error saving canvas state:', error);
      return null;
    } finally {
      // КРИТИЧНО: скидаємо прапорець збереження
      setTimeout(() => {
        isSavingRef.current = false;
      }, 50);
    }
  }, [canvas, MAX_HISTORY_SIZE]);

  // Дебаунсована версія збереження стану
  const debouncedSaveState = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveState();
    }, SAVE_DELAY);
  }, [saveState, SAVE_DELAY]);

  // Функція для ініціалізації історії
  const initializeHistory = useCallback(() => {
    if (canvas && historyRef.current.length === 0) {
      console.log('Initializing history with current canvas state');
      saveState();
    }
  }, [canvas, saveState]);

  // Покращена функція відновлення стану
  const restoreState = useCallback((state, callback) => {
    if (!canvas || !state) {
      console.error('Canvas or state is missing');
      return;
    }

    // Визначаємо структуру стану (старий формат або новий від exportCanvas)
    const jsonState = state.json || state;
    const canvasProps = state.canvasProperties || state; // Fallback для старого формату

    // ВАЖЛИВО: exportCanvas може мати backgroundColor як Pattern (texture/gradient),
    // який не є стабільно серіалізованим у JSON. Якщо він потрапляє в loadFromJSON,
    // Fabric інколи абортить відновлення і на канвасі залишаються лише базові елементи.
    // Ми відновлюємо фон окремо (нижче), тому прибираємо background* поля з json перед loadFromJSON.
    let jsonToLoad = jsonState;
    // QR-specific undo/redo fix:
    // При loadFromJSON інколи QR (SVG group) відновлюється з битими fill/stroke і стає прозорим.
    // Для QR ми не довіряємо десеріалізації: видаляємо QR з JSON і перегенеровуємо його заново
    // з тих самих параметрів (як при натисканні кнопки створення QR).
    let qrToRecreate = [];
    try {
      if (jsonState && typeof jsonState === "object") {
        jsonToLoad = { ...jsonState };
        delete jsonToLoad.backgroundColor;
        delete jsonToLoad.backgroundImage;
        delete jsonToLoad.overlayColor;
        delete jsonToLoad.overlayImage;
        delete jsonToLoad.overlay;

        // Extract QR objects from snapshot JSON
        try {
          const objects = Array.isArray(jsonToLoad.objects) ? jsonToLoad.objects : null;
          if (objects && objects.length) {
            const isUsableColor = (c) => {
              if (typeof c !== "string") return false;
              const v = c.trim().toLowerCase();
              if (!v) return false;
              if (v === "none") return false;
              if (v === "transparent") return false;
              return true;
            };
            const looksLikeQrGroup = (obj) => {
              if (!obj || typeof obj !== "object") return false;
              if (obj.isQRCode === true) return true;
              const qrText =
                (typeof obj.qrText === "string" && obj.qrText.trim())
                  ? obj.qrText.trim()
                  : (typeof obj?.data?.qrText === "string" && obj.data.qrText.trim())
                    ? obj.data.qrText.trim()
                    : null;
              if (!qrText) return false;
              const children = Array.isArray(obj.objects) ? obj.objects : null;
              if (!children || children.length === 0) return false;
              return children.some(
                (c) => c && (c.id === QR_DISPLAY_LAYER_ID || c.id === QR_EXPORT_LAYER_ID)
              );
            };

            const kept = [];
            qrToRecreate = [];
            for (let i = 0; i < objects.length; i++) {
              const obj = objects[i];
              if (!looksLikeQrGroup(obj)) {
                kept.push(obj);
                continue;
              }
              const qrText =
                (typeof obj.qrText === "string" && obj.qrText.trim())
                  ? obj.qrText.trim()
                  : (typeof obj?.data?.qrText === "string" && obj.data.qrText.trim())
                    ? obj.data.qrText.trim()
                    : null;
              if (!qrText) {
                kept.push(obj);
                continue;
              }

              const rawColor = obj.qrColor ?? obj?.data?.qrColor;
              const qrColor = isUsableColor(rawColor) ? rawColor : null;

              qrToRecreate.push({
                zIndex: i,
                qrText,
                qrColor,
                left: obj.left,
                top: obj.top,
                scaleX: obj.scaleX,
                scaleY: obj.scaleY,
                angle: obj.angle,
                originX: obj.originX,
                originY: obj.originY,
              });
            }

            if (qrToRecreate.length) {
              jsonToLoad.objects = kept;
            }
          }
        } catch (e) {
          console.warn("Failed to extract QR objects from snapshot JSON:", e);
          qrToRecreate = [];
        }
      }
    } catch {
      jsonToLoad = jsonState;
      qrToRecreate = [];
    }

    // Встановлюємо всі блокування
    isRestoringRef.current = true;
    isSavingRef.current = true;
    canvas.__suspendUndoRedo = true;

    try {
      // Зберігаємо поточні налаштування viewport
      const currentZoom = canvas.getZoom();
      const currentVpTransform = canvas.viewportTransform ? canvas.viewportTransform.slice() : null;

      // Відключаємо всі event listeners тимчасово
      const eventListeners = {};
      const eventsToDisable = [
        'object:added', 'object:removed', 'object:modified',
        'object:moving', 'object:scaling', 'object:rotating',
        'path:created', 'selection:created', 'selection:updated'
      ];

      // Зберігаємо та відключаємо event listeners
      eventsToDisable.forEach(eventName => {
        if (canvas.__eventListeners && canvas.__eventListeners[eventName]) {
          eventListeners[eventName] = canvas.__eventListeners[eventName].slice();
          canvas.off(eventName);
        }
      });

      // Очищаємо канвас
      canvas.clear();

      // Завантажуємо новий стан
      canvas.loadFromJSON(jsonToLoad, () => {
        try {
          // Вирівнюємо стан об'єктів так само, як при завантаженні з projectStorage (useFabricCanvas).
          postProcessLoadedObjects();

          // Відновлюємо властивості полотна
          // Підтримка обох форматів (старого і нового від exportCanvas)
          
          // 1. Розміри
          if (state.width && state.height) {
             canvas.setDimensions({ width: state.width, height: state.height });
          } else if (canvasProps.width && canvasProps.height) {
             canvas.setDimensions({ width: canvasProps.width, height: canvasProps.height });
          }

          // 2. Фон
          const toolbarBgType =
            state?.toolbarState?.globalColors?.backgroundType ||
            canvasProps?.toolbarState?.globalColors?.backgroundType;
          const bgType =
            state.backgroundType ||
            canvasProps.backgroundType ||
            toolbarBgType ||
            canvas.get?.("backgroundType") ||
            "solid";

          const toolbarBgColor =
            state?.toolbarState?.globalColors?.backgroundColor ||
            canvasProps?.toolbarState?.globalColors?.backgroundColor;
          const bgColor = state.backgroundColor || canvasProps.backgroundColor || toolbarBgColor;

          const toolbarTextColor =
            state?.toolbarState?.globalColors?.textColor ||
            canvasProps?.toolbarState?.globalColors?.textColor;
          const themeTextColor = toolbarTextColor || "#000000";

          // Для texture режиму в snapshot backgroundColor зберігається як URL.
          const bgTextureUrl =
            state.backgroundTextureUrl ||
            canvasProps.backgroundTextureUrl ||
            (bgType === "texture" && typeof bgColor === "string" ? bgColor : null);


          // Завжди виставляємо backgroundType/URL на canvas, щоб Canvas.jsx ефекти не вважали globalColors “stale”.
          try {
            canvas.set?.("backgroundType", bgType);
            canvas.set?.("backgroundTextureUrl", bgType === "texture" ? bgTextureUrl : null);
          } catch {}

          // Відновлюємо фон залежно від типу
          let bgTexturePromise = Promise.resolve();
          if (bgType === "texture" && bgTextureUrl && fabric?.Pattern) {
            bgTexturePromise = new Promise((resolve) => {
              try {
                const img = document.createElement("img");
                img.crossOrigin = "anonymous";
                img.onload = () => {
                  try {
                    const canvasWidth =
                      typeof canvas.getWidth === "function"
                        ? canvas.getWidth()
                        : canvas.width || 0;
                    const canvasHeight =
                      typeof canvas.getHeight === "function"
                        ? canvas.getHeight()
                        : canvas.height || 0;

                    const scaleX = canvasWidth && img.width ? canvasWidth / img.width : 1;
                    const scaleY =
                      canvasHeight && img.height ? canvasHeight / img.height : 1;

                    const patternCanvas = document.createElement("canvas");
                    patternCanvas.width = img.width * scaleX;
                    patternCanvas.height = img.height * scaleY;
                    const ctx = patternCanvas.getContext("2d");
                    if (!ctx) {
                      // fallback
                      canvas.set?.("backgroundColor", "#FFFFFF");
                      resolve();
                      return;
                    }
                    ctx.drawImage(img, 0, 0, patternCanvas.width, patternCanvas.height);

                    const pattern = new fabric.Pattern({
                      source: patternCanvas,
                      repeat: "no-repeat",
                      id: "canvasBackgroundTexture",
                    });
                    canvas.set?.("backgroundColor", pattern);
                    canvas.set?.("backgroundTextureUrl", bgTextureUrl);
                    canvas.set?.("backgroundType", "texture");
                  } catch (e) {
                    console.warn("Failed to restore texture background:", e);
                    try {
                      canvas.set?.("backgroundColor", "#FFFFFF");
                      canvas.set?.("backgroundTextureUrl", null);
                      canvas.set?.("backgroundType", "solid");
                    } catch {}
                  } finally {
                    resolve();
                  }
                };
                img.onerror = () => {
                  try {
                    canvas.set?.("backgroundColor", "#FFFFFF");
                    canvas.set?.("backgroundTextureUrl", null);
                    canvas.set?.("backgroundType", "solid");
                  } catch {}
                  resolve();
                };
                img.src = bgTextureUrl;
              } catch (err) {
                console.warn("Failed to init texture restore:", err);
                resolve();
              }
            });
          } else if (bgType === "gradient") {
            // Градієнт зберігаємо як backgroundType=gradient; сам pattern перегенерується в Canvas.jsx,
            // але виставимо хоч якийсь color як fallback.
            if (typeof bgColor === "string" && bgColor) {
              canvas.set?.("backgroundColor", bgColor);
            } else {
              canvas.set?.("backgroundColor", "#FFFFFF");
            }
            canvas.set?.("backgroundTextureUrl", null);
            canvas.set?.("backgroundType", "gradient");
          } else {
            if (typeof bgColor === "string" && bgColor) {
              canvas.set?.("backgroundColor", bgColor);
            } else {
              canvas.set?.("backgroundColor", "#FFFFFF");
            }
            canvas.set?.("backgroundTextureUrl", null);
            canvas.set?.("backgroundType", "solid");
          }
          
          // 3. Overlay
          if (canvasProps.overlayColor) {
            canvas.set("overlayColor", canvasProps.overlayColor);
          }
          if (canvasProps.overlayOpacity !== null && canvasProps.overlayOpacity !== undefined) {
            canvas.set("overlayOpacity", canvasProps.overlayOpacity);
          }
          
          // 4. Background Image
          const bgImgData = state.backgroundImage || canvasProps.backgroundImage;
          let bgImagePromise = Promise.resolve();
          if (bgImgData && bgImgData.src && fabric?.util?.loadImage) {
            bgImagePromise = new Promise((resolve) => {
              try {
                fabric.util.loadImage(bgImgData.src, (img) => {
                  try {
                    if (img) {
                      const fabricImg = new fabric.Image(img, {
                        opacity: bgImgData.opacity ?? 1,
                        originX: bgImgData.originX ?? 'left',
                        originY: bgImgData.originY ?? 'top',
                        scaleX: bgImgData.scaleX ?? 1,
                        scaleY: bgImgData.scaleY ?? 1,
                        left: bgImgData.left ?? 0,
                        top: bgImgData.top ?? 0,
                        angle: bgImgData.angle ?? 0
                      });
                      canvas.setBackgroundImage(fabricImg, canvas.renderAll.bind(canvas));
                    }
                  } finally {
                    resolve();
                  }
                });
              } catch (e) {
                console.warn('Failed to restore background image:', e);
                resolve();
              }
            });
          }

          // Відновлюємо стан тулбара (в т.ч. globalColors/backgroundType), щоб після redo UI/ефекти
          // не перетирали фон і властивості “старим” станом.
          try {
            if (state?.toolbarState && typeof window !== "undefined" && typeof window.restoreToolbarState === "function") {
              window.restoreToolbarState(state.toolbarState);
            }
          } catch (e) {
            console.warn("restoreToolbarState failed during undo/redo:", e);
          }

          // Примусово відновлюємо форму полотна (triangle/hex/etc) за збереженим shapeType/size.
          try {
            if (state?.toolbarState && typeof window !== "undefined" && typeof window.forceRestoreCanvasShape === "function") {
              window.forceRestoreCanvasShape(state.toolbarState);
            }
          } catch (e) {
            console.warn("forceRestoreCanvasShape failed during undo/redo:", e);
          }
          
          // 5. Viewport (Zoom/Pan)
          // exportCanvas не зберігає viewport явно, тому ми намагаємося зберегти поточний
          // або відновити зі старого формату якщо є
          if (canvasProps.zoom) {
            canvas.setZoom(canvasProps.zoom);
          } else if (currentZoom) {
            canvas.setZoom(currentZoom);
          }

          if (canvasProps.viewportTransform) {
            canvas.setViewportTransform(canvasProps.viewportTransform);
          } else if (currentVpTransform && (!canvasProps.zoom)) {
            canvas.setViewportTransform(currentVpTransform);
          }
          
          // 6. Grid
          if (canvasProps.gridEnabled !== undefined) {
            canvas.gridEnabled = canvasProps.gridEnabled;
          }
          if (canvasProps.snapToGrid !== undefined) {
            canvas.snapToGrid = canvasProps.snapToGrid;
          }
          if (canvasProps.gridSize !== undefined) {
            canvas.gridSize = canvasProps.gridSize;
          }
          
          // 7. Custom Props
          if (canvasProps.customCanvasProperties) {
            canvas.customCanvasProperties = canvasProps.customCanvasProperties;
          }

          // Переконуємось що всі об'єкти правильно налаштовані
          canvas.getObjects().forEach((obj) => {
            if (obj && typeof obj.setCoords === 'function') {
              obj.setCoords();
            }
            // Переконуємося що об'єкт видимий
            if (obj && obj.visible === undefined) {
              obj.visible = true;
            }

            // FIX: Відновлюємо властивості для cut elements (контурів та вирізів)
            // Це виправляє проблему, коли після undo контур стає звичайним елементом
            if (obj.isCutElement) {
              // Для основного контуру (shape)
              if (obj.cutType === "shape") {
                obj.set({
                  hasControls: false,     // Забороняємо зміну розміру
                  lockScalingX: true,
                  lockScalingY: true,
                  lockUniScaling: true,
                  hasBorders: true,       // Рамка виділення має бути
                  perPixelTargetFind: true // Щоб клік всередині порожнього контуру не виділяв його
                });
              }
            }

            // FIX: Відновлюємо властивості для canvaShape (обводка/контур полотна)
            // Користувач повідомив, що ці елементи стають звичайними після undo
            if ((obj.id === "canvaShape" || obj.id === "canvaShapeCustom") && obj.isBorderShape) {
              obj.set({
                selectable: false,
                evented: false,
                hasControls: false,
                lockMovementX: true,
                lockMovementY: true,
                lockScalingX: true,
                lockScalingY: true,
                lockRotation: true,
                perPixelTargetFind: false // Для обводки це зазвичай false
              });
            }
          });

          // Важливо: дочекаємося відновлення backgroundImage/texture,
          // інакше після undo/redo може зберегтися “новий” state і redo перестане працювати.
          // Також відновлюємо element-specific проперті як при звичайному project load
          // (зокрема QR коди перегенеровуються, щоб не лишатися “невидимими але хіттестабельними”).
          const restoreElementsPromise = Promise.resolve()
            .then(() =>
              restoreElementProperties(
                canvas,
                state?.toolbarState || canvasProps?.toolbarState || null
              )
            )
            .catch(() => {
              // ignore
            });

          // QR-only: recreate QR codes from extracted snapshot params
          const recreateQrPromise = Promise.resolve().then(async () => {
            if (!qrToRecreate || qrToRecreate.length === 0) return;
            const fabricLib = fabric?.fabric || fabric?.default || fabric;
            if (!fabricLib || typeof fabricLib.loadSVGFromString !== "function") {
              console.warn("[undo/redo][qr] Fabric loadSVGFromString not available; skipping QR rebuild");
              return;
            }

            let qrGenerator;
            try {
              qrGenerator = (await import("qrcode-generator")).default;
            } catch (e) {
              console.warn("[undo/redo][qr] Failed to import qrcode-generator:", e);
              return;
            }

            const isUsableColor = (c) => {
              if (typeof c !== "string") return false;
              const v = c.trim().toLowerCase();
              if (!v) return false;
              if (v === "none") return false;
              if (v === "transparent") return false;
              return true;
            };

            for (const q of qrToRecreate) {
              try {
                const qr = qrGenerator(0, "M");
                qr.addData(q.qrText);
                qr.make();

                const { optimizedPath, displayPath, size } = computeQrVectorData(
                  qr,
                  DEFAULT_QR_CELL_SIZE
                );

                const color = isUsableColor(q.qrColor) ? q.qrColor : themeTextColor;
                const svgText = buildQrSvgMarkup({
                  size,
                  displayPath,
                  optimizedPath,
                  strokeColor: color,
                });

                const res = await fabricLib.loadSVGFromString(svgText);
                const obj =
                  res?.objects?.length === 1
                    ? res.objects[0]
                    : fabricLib.util.groupSVGElements(
                        res.objects || [],
                        res.options || {}
                      );

                decorateQrGroup(obj);
                obj.set({
                  left: q.left,
                  top: q.top,
                  scaleX: q.scaleX ?? 1,
                  scaleY: q.scaleY ?? 1,
                  angle: q.angle ?? 0,
                  originX: q.originX || "center",
                  originY: q.originY || "center",
                  selectable: true,
                  hasControls: true,
                  hasBorders: true,
                  isQRCode: true,
                  qrText: q.qrText,
                  qrSize: size || obj.width || 0,
                  qrColor: color,
                  backgroundColor: "transparent",
                });

                canvas.add(obj);
                try {
                  if (typeof obj.setCoords === "function") obj.setCoords();
                } catch {}
                try {
                  if (typeof canvas.moveTo === "function") {
                    const maxIndex = Math.max(0, (canvas.getObjects()?.length || 1) - 1);
                    canvas.moveTo(obj, Math.min(q.zIndex ?? maxIndex, maxIndex));
                  }
                } catch {}
              } catch (e) {
                console.warn("[undo/redo][qr] Failed to rebuild QR:", e);
              }
            }
          });

          Promise.allSettled([
            bgImagePromise,
            bgTexturePromise,
            restoreElementsPromise,
            recreateQrPromise,
          ]).finally(() => {
            // Очищаємо виділення та рендеримо
            canvas.discardActiveObject();
            canvas.renderAll();
            canvas.requestRenderAll();

            // Синхронізуємо інпути тулбара з фактичними значеннями canvas після відновлення
            try {
              if (typeof window !== "undefined" && typeof window.syncToolbarSizeFromCanvas === "function") {
                window.syncToolbarSizeFromCanvas();
              }
            } catch {}

            // Відновлюємо event listeners та скидаємо блокування
            const clearAllFlags = () => {
              eventsToDisable.forEach(eventName => {
                if (eventListeners[eventName]) {
                  eventListeners[eventName].forEach(listener => {
                    canvas.on(eventName, listener);
                  });
                }
              });

              // Скидаємо всі блокування
              isRestoringRef.current = false;
              isSavingRef.current = false;
              canvas.__suspendUndoRedo = false;

              // Після restore часто відпрацьовують відкладені ефекти (toolbar/canvas trackers),
              // які можуть викликати saveState і тим самим обрізати redo-стек.
              // Даємо коротке вікно, в якому ігноруємо saveState.
              ignoreSavesUntilRef.current = Date.now() + 1400;

              console.log('All restoration flags cleared');

              if (callback) callback();
            };

            // Скидаємо блокування з короткою затримкою
            setTimeout(clearAllFlags, 50);
          });

        } catch (renderError) {
          console.error('Error during canvas render after state restore:', renderError);
          
          // Завжди скидаємо блокування навіть при помилці
          setTimeout(() => {
            isRestoringRef.current = false;
            isSavingRef.current = false;
            canvas.__suspendUndoRedo = false;
            console.log('Restoration flags cleared after error');
          }, 50);
        }
      });

    } catch (error) {
      console.error('Critical error restoring canvas state:', error);
      
      // Скидаємо блокування при критичній помилці
      setTimeout(() => {
        isRestoringRef.current = false;
        isSavingRef.current = false;
        canvas.__suspendUndoRedo = false;
        console.log('Restoration flags cleared after critical error');
      }, 50);
    }
  }, [canvas]);

  // Функція undo
  const undo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;

    if (currentIndex > 0 && canvas && currentHistory.length > 0) {
      const newIndex = currentIndex - 1;
      const stateToRestore = currentHistory[newIndex];

      // Синхронізуємо індекс одразу (UI + refs)
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);

      console.log(`Undo: moving from index ${currentIndex} to ${newIndex}`);

      restoreState(stateToRestore, () => {
        console.log(`Undo completed: restored state at index ${newIndex}`);
      });
    } else {
      console.log('Cannot undo: at beginning of history');
    }
  }, [canvas, restoreState]);

  // Функція redo
  const redo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;

    if (currentIndex < currentHistory.length - 1 && canvas) {
      const newIndex = currentIndex + 1;
      const stateToRestore = currentHistory[newIndex];

      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);

      console.log(`Redo: moving from index ${currentIndex} to ${newIndex}`);

      restoreState(stateToRestore, () => {
        console.log(`Redo completed: restored state at index ${newIndex}`);
      });
    } else {
      console.log('Cannot redo: at end of history');
    }
  }, [canvas, restoreState]);

  // Функція для принудового скидання всіх блокувань
  const forceUnlockUndoRedo = useCallback(() => {
    console.log('🔓 Force unlocking undo/redo system');
    isRestoringRef.current = false;
    isSavingRef.current = false;
    if (canvas) {
      canvas.__suspendUndoRedo = false;
    }
  }, [canvas]);

  // Автоматичне скидання блокувань через певний час (запобіжник)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRestoringRef.current || isSavingRef.current) {
        console.log('⚠️ Long-running operation detected, checking if unlock needed');
        
        // Якщо блокування тривають більше 5 секунд - скидаємо примусово
        setTimeout(() => {
          if (isRestoringRef.current || isSavingRef.current) {
            console.log('🚨 Force unlocking after timeout');
            forceUnlockUndoRedo();
          }
        }, 5000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [forceUnlockUndoRedo]);

  // Функція для ручного збереження стану (коли полотно змінює властивості)
  const saveCanvasPropertiesState = useCallback(async (description = 'Canvas properties changed') => {
    if (!canvas) return;
    
    console.log('🎨 Saving canvas properties state:', description);
    
    try {
      const newState = await saveState(description);
      if (newState) {
        console.log('✅ Canvas properties state saved successfully');
        // Генеруємо кастомну подію для повідомлення компонентів
        canvas.fire('canvas:changed', { state: newState });
      }
    } catch (error) {
      console.error('❌ Error saving canvas properties state:', error);
    } finally {
      // saveState сам керує прапорцями блокування
    }
  }, [canvas, saveState]);

  // Функція для переходу до конкретного стану в історії
  const goToHistoryState = useCallback((targetIndex) => {
    const currentHistory = historyRef.current;
    
    if (targetIndex >= 0 && targetIndex < currentHistory.length) {
      const stateToRestore = currentHistory[targetIndex];
      
      console.log(`Going to history state at index ${targetIndex}`);
      
      restoreState(stateToRestore, () => {
        setHistoryIndex(targetIndex);
        console.log(`Moved to history state at index ${targetIndex}`);
      });
    }
  }, [restoreState]);

  // Функція для очищення історії
  const clearHistory = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
    lastStateRef.current = null;
    lastComparableStateRef.current = null;
    console.log('History cleared');
  }, []);

  // Функція для ручного збереження поточного стану
  const saveCurrentState = useCallback(() => {
    // Скасовуємо будь-які відкладені збереження
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Зберігаємо тільки якщо не відновлюємо стан
    if (!isRestoringRef.current && !isSavingRef.current) {
      saveState();
    }
  }, [saveState]);

  // Функція для експорту історії
  const exportHistory = useCallback(() => {
    return {
      history: historyRef.current,
      currentIndex: historyIndexRef.current,
      timestamp: Date.now()
    };
  }, []);

  // Функція для імпорту історії
  const importHistory = useCallback((historyData) => {
    if (historyData && Array.isArray(historyData.history)) {
      setHistory(historyData.history);
      setHistoryIndex(historyData.currentIndex || historyData.history.length - 1);
      console.log(`Imported history with ${historyData.history.length} states`);
    }
  }, []);

  // Ініціалізація клавіатурних скорочень
  useEffect(() => {
    if (!keyboardHandlerRef.current) {
      keyboardHandlerRef.current = new UndoRedoKeyboardHandler({
        undo,
        redo,
        save: saveCurrentState,
        enabled: true
      });
      keyboardHandlerRef.current.enable();
    }

    // Оновлюємо callbacks при їх зміні
    keyboardHandlerRef.current.updateCallbacks({
      undo,
      redo,
      save: saveCurrentState
    });

    return () => {
      if (keyboardHandlerRef.current) {
        keyboardHandlerRef.current.destroy();
        keyboardHandlerRef.current = null;
      }
    };
  }, [undo, redo, saveCurrentState]);

  // Налаштування event listeners для канвасу
  useEffect(() => {
    if (canvas) {
      // Ініціалізуємо історію з поточним станом
      initializeHistory();

      // Розширений список подій для відстеження
      // Важливо: selection:* події не є “дією” на полотні, але можуть міняти toolbarState,
      // що створює фейкові записи в історії та ламає очікування “undo = 1 крок”.
      const eventsToSave = [
        'object:added',
        'object:removed',
        'object:modified',
        'path:created',
        'text:changed',
        // Додаємо події для властивостей полотна
        'canvas:changed',
        'background:changed',
        'canvas:resized'
      ];

      // Події, які потребують негайного збереження
      const immediateEvents = [
        'object:added',
        'object:removed',
        'object:modified',
        'path:created',
        'canvas:changed',
        'background:changed',
        'canvas:resized'
      ];

      // Покращений обробник подій з строгими перевірками
      const handleCanvasEvent = (event) => {
        const eventType = event.type;
        
        // СТРОГА перевірка - не зберігаємо під час відновлення
        if (isRestoringRef.current || 
            isSavingRef.current || 
            canvas.__suspendUndoRedo) {
          console.log(`🚫 Event ${eventType} ignored during restoration/saving:`, {
            isRestoring: isRestoringRef.current,
            isSaving: isSavingRef.current,
            suspended: canvas.__suspendUndoRedo
          });
          return;
        }

        console.log('📅 Canvas event detected:', eventType, {
          isRestoring: isRestoringRef.current,
          isSaving: isSavingRef.current,
          suspended: canvas.__suspendUndoRedo
        });
        
        if (immediateEvents.includes(eventType)) {
          // Для критичних подій зберігаємо з мінімальною затримкою
          console.log('⚡ Immediate save triggered for:', eventType);
          setTimeout(() => {
            if (!isRestoringRef.current && !isSavingRef.current && !canvas.__suspendUndoRedo) {
              console.log('✅ Executing immediate save for:', eventType);
              saveCurrentState();
            } else {
              console.log('❌ Immediate save blocked for:', eventType, {
                isRestoring: isRestoringRef.current,
                isSaving: isSavingRef.current,
                suspended: canvas.__suspendUndoRedo
              });
            }
          }, 10); // Зменшили затримку для швидшого збереження
        } else {
          // Для інших подій використовуємо дебаунс
          console.log('⏰ Debounced save triggered for:', eventType);
          debouncedSaveState();
        }
      };

      // Підписуємося на події
      eventsToSave.forEach(eventType => {
        canvas.on(eventType, handleCanvasEvent);
      });

      // Очищення при демонтажі
      return () => {
        eventsToSave.forEach(eventType => {
          canvas.off(eventType, handleCanvasEvent);
        });
        
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
      };
    }
  }, [canvas, initializeHistory, debouncedSaveState, saveCurrentState]);

  // Очищення при демонтажі компонента
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    historyIndex,
    historyLength: history.length,
    clearHistory,
    saveCurrentState,
    saveCanvasPropertiesState, // Додаємо функцію для збереження стану полотна
    goToHistoryState,
    exportHistory,
    importHistory,
    forceUnlockUndoRedo, // Додаємо функцію для принудового розблокування
    history: history // Додаємо доступ до повної історії для дебагу
  };
};
