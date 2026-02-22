import { useState, useEffect, useRef, useCallback } from "react";
import { useCanvasContext } from "../contexts/CanvasContext";
import { UndoRedoKeyboardHandler } from "../utils/undoRedoKeyboardHandler";
import { exportCanvas, restoreElementProperties } from "../utils/projectStorage";
import * as fabric from "fabric";
import LZString from "lz-string";
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

// ============================================================================
// ОПТИМІЗОВАНА СИСТЕМА UNDO/REDO v2.0
// ============================================================================
// Ключові оптимізації:
// 1. LZ-String стиснення для зменшення використання пам'яті на 70-90%
// 2. Batch mode - групування швидких послідовних змін в одну операцію
// 3. Видалення preview з історії (не потрібен для undo/redo)
// 4. Smart diffing - не зберігаємо стан якщо він ідентичний попередньому
// 5. Throttling та debouncing для зменшення навантаження
// ============================================================================

// Конфігурація системи
const CONFIG = {
  // Максимальна кількість станів в історії (тепер можна набагато більше завдяки стисненню)
  MAX_HISTORY_SIZE: 20,
  
  // Затримка перед збереженням (дебаунс) - мс
  SAVE_DELAY: 100,
  
  // Batch window - час протягом якого зміни групуються в одну операцію
  // ЗМЕНШЕНО з 1600 до 300мс щоб уникнути пропускання кроків
  BATCH_WINDOW: 300,
  
  // Мінімальний інтервал між автозбереженнями
  MIN_SAVE_INTERVAL: 100,
  
  // Час ігнорування saves після restore (зменшено для швидшої реакції)
  IGNORE_SAVES_AFTER_RESTORE: 500,
  
  // Timeout для автоматичного розблокування (захист від deadlock)
  AUTO_UNLOCK_TIMEOUT: 5000,
  
  // Використовувати стиснення
  USE_COMPRESSION: true,
};

// ============================================================================
// УТИЛІТИ ДЛЯ СТИСНЕННЯ
// ============================================================================

/**
 * Стискає стан канвасу для зменшення використання пам'яті
 * @param {Object} state - Стан канвасу
 * @returns {Object} - Стиснутий стан
 */
const compressState = (state) => {
  if (!CONFIG.USE_COMPRESSION || !state) return state;
  
  try {
    const jsonStr = JSON.stringify(state);
    const compressed = LZString.compressToUTF16(jsonStr);
    
    // Логуємо ефективність стиснення (тільки в dev)
    if (process.env.NODE_ENV === 'development') {
      const originalSize = jsonStr.length * 2;
      const compressedSize = compressed.length * 2;
      const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
      console.log(`📦 Compression: ${(originalSize/1024).toFixed(1)}KB → ${(compressedSize/1024).toFixed(1)}KB (${ratio}% saved)`);
    }
    
    return {
      _compressed: true,
      data: compressed,
      timestamp: state.timestamp || Date.now(),
      // Зберігаємо легку метаінформацію для UI
      _meta: {
        objectCount: state.json?.objects?.length || 0,
        width: state.width,
        height: state.height,
      }
    };
  } catch (error) {
    console.warn("Compression failed, using uncompressed state:", error);
    return state;
  }
};

/**
 * Розпаковує стиснутий стан
 * @param {Object} compressedState - Стиснутий стан
 * @returns {Object|null} - Розпакований стан
 */
const decompressState = (compressedState) => {
  if (!compressedState) return null;
  
  // Якщо це не стиснутий стан - повертаємо як є
  if (!compressedState._compressed) {
    return compressedState;
  }
  
  try {
    const jsonStr = LZString.decompressFromUTF16(compressedState.data);
    if (!jsonStr) {
      console.error("Decompression returned empty result");
      return null;
    }
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Decompression failed:", error);
    return null;
  }
};

// ============================================================================
// УТИЛІТИ ДЛЯ НОРМАЛІЗАЦІЇ ТА ПОРІВНЯННЯ СТАНІВ
// ============================================================================

/**
 * Видаляє волатильні поля зі стану для коректного порівняння
 * @param {Object} state - Стан для нормалізації
 * @returns {Object|null} - Нормалізований стан
 */
const normalizeForComparison = (state) => {
  if (!state || typeof state !== "object") return null;
  
  try {
    // Якщо це стиснутий стан - розпаковуємо спочатку
    const actualState = state._compressed ? decompressState(state) : state;
    if (!actualState) return null;
    
    // Створюємо копію без волатильних полів
    const normalized = { ...actualState };
    
    // Видаляємо поля які змінюються без реальних змін canvas
    const volatileFields = [
      'preview', 'previewSvg', 'previewPng',
      'toolbarState', 'timestamp', 'lastSaved',
      'updatedAt', 'createdAt', '_meta', '_compressed', 'data'
    ];
    
    volatileFields.forEach(field => {
      delete normalized[field];
    });
    
    // Нормалізуємо json об'єкти
    if (normalized.json && typeof normalized.json === "object") {
      const json = { ...normalized.json };
      volatileFields.forEach(field => delete json[field]);
      
      // Видаляємо toolbarSnapshot з об'єктів
      if (Array.isArray(json.objects)) {
        json.objects = json.objects.map(obj => {
          if (!obj || typeof obj !== "object") return obj;
          const clean = { ...obj };
          delete clean.toolbarSnapshot;
          return clean;
        });
      }
      
      normalized.json = json;
    }
    
    return normalized;
  } catch (error) {
    console.warn("Normalization failed:", error);
    return null;
  }
};

/**
 * Порівнює два стани на ідентичність
 * @param {Object} state1 - Перший стан
 * @param {Object} state2 - Другий стан
 * @returns {boolean} - true якщо стани ідентичні
 */
const statesAreEqual = (state1, state2) => {
  const norm1 = normalizeForComparison(state1);
  const norm2 = normalizeForComparison(state2);
  
  if (!norm1 || !norm2) return false;
  
  try {
    return JSON.stringify(norm1) === JSON.stringify(norm2);
  } catch {
    return false;
  }
};

/**
 * Створює легку версію стану без preview для undo/redo
 * @param {Object} canvas - Fabric canvas
 * @param {Object} toolbarState - Стан тулбара
 * @returns {Promise<Object|null>} - Легкий стан
 */
const createLightweightState = async (canvas, toolbarState) => {
  if (!canvas) return null;
  
  try {
    // Експортуємо canvas БЕЗ генерації preview (це найважча частина)
    const state = await exportCanvas(canvas, toolbarState, { 
      keepClipPath: true,
      skipPreview: true
    });
    
    if (!state) return null;
    
    // Видаляємо preview якщо він все одно був згенерований
    delete state.preview;
    delete state.previewSvg;
    delete state.previewPng;
    
    // Додаємо timestamp
    state.timestamp = Date.now();
    
    return state;
  } catch (error) {
    console.error("Failed to create lightweight state:", error);
    return null;
  }
};

// ============================================================================
// ГОЛОВНИЙ ХУК
// ============================================================================

export const useUndoRedo = () => {
  const { canvas } = useCanvasContext();
  
  // Стани
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Refs для контролю стану
  const isSavingRef = useRef(false);
  const isRestoringRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const batchTimeoutRef = useRef(null);
  const lastSaveTimeRef = useRef(0);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const lastStateHashRef = useRef(null);
  const keyboardHandlerRef = useRef(null);
  const ignoreSavesUntilRef = useRef(0);
  const pendingChangesRef = useRef(false);
  const batchStartTimeRef = useRef(null);

  // Синхронізуємо refs зі state
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // ============================================================================
  // POST-PROCESSING ПІСЛЯ ЗАВАНТАЖЕННЯ
  // ============================================================================
  
  const postProcessLoadedObjects = useCallback(() => {
    if (!canvas || typeof canvas.getObjects !== "function") return;

    try {
      canvas.getObjects().forEach((obj) => {
        if (!obj) return;
        try {
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

  // ============================================================================
  // ЗБЕРЕЖЕННЯ СТАНУ
  // ============================================================================

  /**
   * Основна функція збереження стану
   */
  const saveState = useCallback(async (description = 'State saved') => {
    const now = Date.now();
    
    // Перевірка на період ігнорування saves
    if (now < (ignoreSavesUntilRef.current || 0)) {
      return null;
    }
    
    // Перевірка блокувань
    if (!canvas || isSavingRef.current || isRestoringRef.current || canvas.__suspendUndoRedo) {
      return null;
    }
    
    // Throttling - не зберігаємо занадто часто
    if (now - lastSaveTimeRef.current < CONFIG.MIN_SAVE_INTERVAL) {
      pendingChangesRef.current = true;
      return null;
    }

    try {
      isSavingRef.current = true;
      console.log(`💾 Saving state: ${description}`);

      // Отримуємо toolbarState
      let toolbarState = {};
      if (window.getCurrentToolbarState) {
        toolbarState = window.getCurrentToolbarState() || {};
      }

      // Створюємо легкий стан (без preview)
      const newState = await createLightweightState(canvas, toolbarState);
      
      if (!newState) {
        console.error('❌ Failed to create state');
        return null;
      }

      // Перевіряємо чи стан дійсно змінився
      const newHash = JSON.stringify(normalizeForComparison(newState));
      if (lastStateHashRef.current && newHash === lastStateHashRef.current) {
        return newState;
      }
      
      lastStateHashRef.current = newHash;
      lastSaveTimeRef.current = now;
      pendingChangesRef.current = false;

      // Стискаємо стан
      const compressedState = compressState(newState);

      // Оновлюємо історію
      setHistory(prevHistory => {
        const currentIndex = historyIndexRef.current;
        
        // Обрізаємо історію після поточного індексу
        let newHistory = [...prevHistory.slice(0, currentIndex + 1), compressedState];
        
        // Обмежуємо розмір історії
        if (newHistory.length > CONFIG.MAX_HISTORY_SIZE) {
          const removeCount = newHistory.length - CONFIG.MAX_HISTORY_SIZE;
          newHistory = newHistory.slice(removeCount);
        }
        
        console.log(`📚 History: ${newHistory.length} states, index: ${newHistory.length - 1}`);
        return newHistory;
      });

      setHistoryIndex(prev => {
        const currentHistory = historyRef.current;
        const currentIndex = historyIndexRef.current;
        let newHistoryLength = currentHistory.slice(0, currentIndex + 1).length + 1;
        
        if (newHistoryLength > CONFIG.MAX_HISTORY_SIZE) {
          newHistoryLength = CONFIG.MAX_HISTORY_SIZE;
        }
        
        return newHistoryLength - 1;
      });

      return newState;
    } catch (error) {
      console.error('❌ Error saving state:', error);
      return null;
    } finally {
      setTimeout(() => {
        isSavingRef.current = false;
      }, 50);
    }
  }, [canvas]);

  /**
   * Дебаунсоване збереження
   */
  const debouncedSaveState = useCallback((description) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveState(description);
    }, CONFIG.SAVE_DELAY);
  }, [saveState]);

  /**
   * Batch збереження - групує швидкі послідовні зміни в одну операцію
   * Оптимізовано для швидшого збереження кроків
   */
  const batchSaveState = useCallback((description) => {
    const now = Date.now();
    
    // Скасовуємо попередній таймаут
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    // Якщо це перша зміна в batch АБО batch window вичерпано - записуємо час
    if (!batchStartTimeRef.current || (now - batchStartTimeRef.current > CONFIG.BATCH_WINDOW)) {
      batchStartTimeRef.current = now;
      // Для нового batch - зберігаємо після короткої затримки
      batchTimeoutRef.current = setTimeout(() => {
        batchStartTimeRef.current = null;
        saveState(description);
      }, CONFIG.SAVE_DELAY);
      return;
    }
    
    // Всередині batch window - просто оновлюємо таймер
    batchTimeoutRef.current = setTimeout(() => {
      batchStartTimeRef.current = null;
      saveState(description);
    }, CONFIG.SAVE_DELAY);
  }, [saveState]);

  /**
   * Негайне збереження - для критичних операцій без затримки
   */
  const immediateSaveState = useCallback((description) => {
    // Скасовуємо всі таймери
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    batchStartTimeRef.current = null;
    
    // Зберігаємо негайно
    saveState(description);
  }, [saveState]);

  // ============================================================================
  // ВІДНОВЛЕННЯ СТАНУ
  // ============================================================================

  const restoreState = useCallback((compressedState, callback) => {
    if (!canvas || !compressedState) {
      console.error('❌ Cannot restore: missing canvas or state');
      return;
    }

    // Розпаковуємо стан
    const state = decompressState(compressedState);
    if (!state) {
      console.error('❌ Failed to decompress state');
      return;
    }

    const jsonState = state.json || state;
    const canvasProps = state.canvasProperties || state;

    // QR codes потребують спеціальної обробки
    let qrToRecreate = [];
    let jsonToLoad = jsonState;

    try {
      if (jsonState && typeof jsonState === "object") {
        jsonToLoad = { ...jsonState };
        
        // Видаляємо background поля - відновимо окремо
        delete jsonToLoad.backgroundColor;
        delete jsonToLoad.backgroundImage;
        delete jsonToLoad.overlayColor;
        delete jsonToLoad.overlayImage;
        delete jsonToLoad.overlay;

        // Витягуємо QR об'єкти для перегенерації
        const objects = Array.isArray(jsonToLoad.objects) ? jsonToLoad.objects : null;
        if (objects && objects.length) {
          const isUsableColor = (c) => {
            if (typeof c !== "string") return false;
            const v = c.trim().toLowerCase();
            return v && v !== "none" && v !== "transparent";
          };
          
          const looksLikeQrGroup = (obj) => {
            if (!obj || typeof obj !== "object") return false;
            if (obj.isQRCode === true) return true;
            const qrText = obj.qrText?.trim() || obj.data?.qrText?.trim();
            if (!qrText) return false;
            const children = Array.isArray(obj.objects) ? obj.objects : null;
            if (!children || children.length === 0) return false;
            return children.some(c => c && (c.id === QR_DISPLAY_LAYER_ID || c.id === QR_EXPORT_LAYER_ID));
          };

          const kept = [];
          for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            if (!looksLikeQrGroup(obj)) {
              kept.push(obj);
              continue;
            }
            
            const qrText = obj.qrText?.trim() || obj.data?.qrText?.trim();
            if (!qrText) {
              kept.push(obj);
              continue;
            }

            const rawColor = obj.qrColor ?? obj.data?.qrColor;
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
      }
    } catch (e) {
      console.warn("Failed to extract QR objects:", e);
      qrToRecreate = [];
    }

    // Встановлюємо всі блокування
    isRestoringRef.current = true;
    isSavingRef.current = true;
    canvas.__suspendUndoRedo = true;

    try {
      // Зберігаємо viewport
      const currentZoom = canvas.getZoom();
      const currentVpTransform = canvas.viewportTransform?.slice();

      // НЕ відключаємо event listeners - просто блокуємо їх через прапорці
      // Це запобігає накопиченню listeners при багаторазових undo/redo

      // Очищаємо та завантажуємо
      canvas.clear();

      canvas.loadFromJSON(jsonToLoad, () => {
        try {
          postProcessLoadedObjects();

          // Відновлюємо розміри
          if (state.width && state.height) {
            canvas.setDimensions({ width: state.width, height: state.height });
          } else if (canvasProps.width && canvasProps.height) {
            canvas.setDimensions({ width: canvasProps.width, height: canvasProps.height });
          }

          // Відновлюємо фон
          const toolbarBgType = state?.toolbarState?.globalColors?.backgroundType ||
            canvasProps?.toolbarState?.globalColors?.backgroundType;
          const bgType = state.backgroundType || canvasProps.backgroundType || toolbarBgType || "solid";

          const toolbarBgColor = state?.toolbarState?.globalColors?.backgroundColor ||
            canvasProps?.toolbarState?.globalColors?.backgroundColor;
          const bgColor = state.backgroundColor || canvasProps.backgroundColor || toolbarBgColor;

          const toolbarTextColor = state?.toolbarState?.globalColors?.textColor ||
            canvasProps?.toolbarState?.globalColors?.textColor;
          const themeTextColor = toolbarTextColor || "#000000";

          const bgTextureUrl = state.backgroundTextureUrl || canvasProps.backgroundTextureUrl ||
            (bgType === "texture" && typeof bgColor === "string" ? bgColor : null);

          canvas.set?.("backgroundType", bgType);
          canvas.set?.("backgroundTextureUrl", bgType === "texture" ? bgTextureUrl : null);

          // Promise для фону
          let bgTexturePromise = Promise.resolve();
          
          if (bgType === "texture" && bgTextureUrl && fabric?.Pattern) {
            bgTexturePromise = new Promise((resolve) => {
              const img = document.createElement("img");
              img.crossOrigin = "anonymous";
              img.onload = () => {
                try {
                  const canvasWidth = canvas.getWidth?.() || canvas.width || 0;
                  const canvasHeight = canvas.getHeight?.() || canvas.height || 0;
                  const scaleX = canvasWidth && img.width ? canvasWidth / img.width : 1;
                  const scaleY = canvasHeight && img.height ? canvasHeight / img.height : 1;

                  const patternCanvas = document.createElement("canvas");
                  patternCanvas.width = img.width * scaleX;
                  patternCanvas.height = img.height * scaleY;
                  const ctx = patternCanvas.getContext("2d");
                  
                  if (ctx) {
                    ctx.drawImage(img, 0, 0, patternCanvas.width, patternCanvas.height);
                    const pattern = new fabric.Pattern({
                      source: patternCanvas,
                      repeat: "no-repeat",
                      id: "canvasBackgroundTexture",
                    });
                    canvas.set?.("backgroundColor", pattern);
                    canvas.set?.("backgroundTextureUrl", bgTextureUrl);
                    canvas.set?.("backgroundType", "texture");
                  }
                } catch (e) {
                  console.warn("Failed to restore texture:", e);
                  canvas.set?.("backgroundColor", "#FFFFFF");
                }
                resolve();
              };
              img.onerror = () => {
                canvas.set?.("backgroundColor", "#FFFFFF");
                resolve();
              };
              img.src = bgTextureUrl;
            });
          } else if (bgType === "gradient") {
            canvas.set?.("backgroundColor", bgColor || "#FFFFFF");
            canvas.set?.("backgroundType", "gradient");
          } else {
            canvas.set?.("backgroundColor", bgColor || "#FFFFFF");
            canvas.set?.("backgroundType", "solid");
          }

          // Відновлюємо overlay
          if (canvasProps.overlayColor) {
            canvas.set("overlayColor", canvasProps.overlayColor);
          }
          if (canvasProps.overlayOpacity !== undefined) {
            canvas.set("overlayOpacity", canvasProps.overlayOpacity);
          }

          // Background image
          const bgImgData = state.backgroundImage || canvasProps.backgroundImage;
          let bgImagePromise = Promise.resolve();
          
          if (bgImgData?.src && fabric?.util?.loadImage) {
            bgImagePromise = new Promise((resolve) => {
              fabric.util.loadImage(bgImgData.src, (img) => {
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
                resolve();
              });
            });
          }

          // Відновлюємо toolbar state
          try {
            if (state?.toolbarState && typeof window?.restoreToolbarState === "function") {
              window.restoreToolbarState(state.toolbarState);
            }
          } catch (e) {
            console.warn("restoreToolbarState failed:", e);
          }

          // Відновлюємо форму канвасу
          try {
            if (state?.toolbarState && typeof window?.forceRestoreCanvasShape === "function") {
              window.forceRestoreCanvasShape(state.toolbarState);
            }
          } catch (e) {
            console.warn("forceRestoreCanvasShape failed:", e);
          }

          // Viewport
          if (canvasProps.zoom) {
            canvas.setZoom(canvasProps.zoom);
          } else if (currentZoom) {
            canvas.setZoom(currentZoom);
          }

          if (canvasProps.viewportTransform) {
            canvas.setViewportTransform(canvasProps.viewportTransform);
          } else if (currentVpTransform && !canvasProps.zoom) {
            canvas.setViewportTransform(currentVpTransform);
          }

          // Grid
          if (canvasProps.gridEnabled !== undefined) canvas.gridEnabled = canvasProps.gridEnabled;
          if (canvasProps.snapToGrid !== undefined) canvas.snapToGrid = canvasProps.snapToGrid;
          if (canvasProps.gridSize !== undefined) canvas.gridSize = canvasProps.gridSize;

          // Custom props
          if (canvasProps.customCanvasProperties) {
            canvas.customCanvasProperties = canvasProps.customCanvasProperties;
          }

          // Фіксимо об'єкти
          canvas.getObjects().forEach((obj) => {
            if (obj && typeof obj.setCoords === 'function') {
              obj.setCoords();
            }
            if (obj && obj.visible === undefined) {
              obj.visible = true;
            }

            // Cut elements
            if (obj.isCutElement && obj.cutType === "shape") {
              obj.set({
                hasControls: false,
                lockScalingX: true,
                lockScalingY: true,
                lockUniScaling: true,
                hasBorders: true,
                perPixelTargetFind: true
              });
            }

            // Border shapes
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
                perPixelTargetFind: false
              });
            }
          });

          // Відновлюємо element properties
          const restoreElementsPromise = Promise.resolve()
            .then(() => restoreElementProperties(canvas, state?.toolbarState || canvasProps?.toolbarState || null))
            .catch(() => {});

          // Перегенеровуємо QR коди
          const recreateQrPromise = Promise.resolve().then(async () => {
            if (!qrToRecreate?.length) return;

            const fabricLib = fabric?.fabric || fabric?.default || fabric;
            if (!fabricLib?.loadSVGFromString) return;

            let qrGenerator;
            try {
              qrGenerator = (await import("qrcode-generator")).default;
            } catch (e) {
              console.warn("Failed to import qrcode-generator:", e);
              return;
            }

            for (const q of qrToRecreate) {
              try {
                const qr = qrGenerator(0, "M");
                qr.addData(q.qrText);
                qr.make();

                const { optimizedPath, displayPath, size } = computeQrVectorData(qr, DEFAULT_QR_CELL_SIZE);
                const color = q.qrColor || themeTextColor;
                const svgText = buildQrSvgMarkup({ size, displayPath, optimizedPath, strokeColor: color });

                const res = await fabricLib.loadSVGFromString(svgText);
                const obj = res?.objects?.length === 1
                  ? res.objects[0]
                  : fabricLib.util.groupSVGElements(res.objects || [], res.options || {});

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

                // Before adding, remove any existing QR object with same qrText
                try {
                  const existing = (canvas.getObjects && canvas.getObjects()) || [];
                  for (const ex of existing.slice()) {
                    if (!ex) continue;
                    const exText = (ex.qrText?.toString().trim()) || (ex.data?.qrText?.toString().trim()) || null;
                    if (exText && q.qrText && exText === q.qrText) {
                      try { canvas.remove(ex); } catch (e) {}
                      break;
                    }
                    const exChildren = Array.isArray(ex.objects) ? ex.objects : null;
                    if (exChildren && exChildren.length) {
                      const hasQrLayer = exChildren.some(c => c && (c.id === QR_DISPLAY_LAYER_ID || c.id === QR_EXPORT_LAYER_ID));
                      if (hasQrLayer) {
                        const innerText = (ex.qrText?.toString().trim()) || (ex.data?.qrText?.toString().trim()) || null;
                        if (!innerText || innerText === q.qrText) {
                          try { canvas.remove(ex); } catch (e) {}
                          break;
                        }
                      }
                    }
                  }
                } catch (e) {}

                canvas.add(obj);
                obj.setCoords?.();
                
                const maxIndex = Math.max(0, (canvas.getObjects()?.length || 1) - 1);
                canvas.moveTo?.(obj, Math.min(q.zIndex ?? maxIndex, maxIndex));
              } catch (e) {
                console.warn("Failed to rebuild QR:", e);
              }
            }
          });

          // Чекаємо всі promises
          Promise.allSettled([bgImagePromise, bgTexturePromise, restoreElementsPromise, recreateQrPromise])
            .finally(() => {
              canvas.discardActiveObject();
              canvas.renderAll();
              canvas.requestRenderAll();

              // Синхронізуємо toolbar
              try {
                if (typeof window?.syncToolbarSizeFromCanvas === "function") {
                  window.syncToolbarSizeFromCanvas();
                }
              } catch {}

              // Скидаємо блокування
              const clearAllFlags = () => {
                isRestoringRef.current = false;
                isSavingRef.current = false;
                canvas.__suspendUndoRedo = false;
                
                // Ігноруємо saves після restore (збільшено час для стабільності)
                ignoreSavesUntilRef.current = Date.now() + CONFIG.IGNORE_SAVES_AFTER_RESTORE;
                
                // Скидаємо hash щоб наступне збереження було можливим
                lastStateHashRef.current = null;
                
                console.log('✅ State restored successfully');
                if (callback) callback();
              };

              setTimeout(clearAllFlags, 50);
            });

        } catch (renderError) {
          console.error('Error during canvas render:', renderError);
          setTimeout(() => {
            isRestoringRef.current = false;
            isSavingRef.current = false;
            canvas.__suspendUndoRedo = false;
          }, 50);
        }
      });

    } catch (error) {
      console.error('Critical error restoring state:', error);
      setTimeout(() => {
        isRestoringRef.current = false;
        isSavingRef.current = false;
        canvas.__suspendUndoRedo = false;
      }, 50);
    }
  }, [canvas, postProcessLoadedObjects]);

  // ============================================================================
  // UNDO / REDO ФУНКЦІЇ
  // ============================================================================

  const undo = useCallback(() => {
    // Захист від виклику під час відновлення
    if (isRestoringRef.current) {
      console.log('⚠️ Undo blocked - restore in progress');
      return;
    }
    
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;

    if (currentIndex > 0 && canvas && currentHistory.length > 0) {
      const newIndex = currentIndex - 1;
      const stateToRestore = currentHistory[newIndex];

      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);

      console.log(`⬅️ Undo: ${currentIndex} → ${newIndex} (${currentHistory.length} total)`);
      restoreState(stateToRestore);
    }
  }, [canvas, restoreState]);

  const redo = useCallback(() => {
    // Захист від виклику під час відновлення
    if (isRestoringRef.current) {
      console.log('⚠️ Redo blocked - restore in progress');
      return;
    }
    
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;

    if (currentIndex < currentHistory.length - 1 && canvas) {
      const newIndex = currentIndex + 1;
      const stateToRestore = currentHistory[newIndex];

      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);

      console.log(`➡️ Redo: ${currentIndex} → ${newIndex} (${currentHistory.length} total)`);
      restoreState(stateToRestore);
    }
  }, [canvas, restoreState]);

  // ============================================================================
  // ДОПОМІЖНІ ФУНКЦІЇ
  // ============================================================================

  const forceUnlockUndoRedo = useCallback(() => {
    console.log('🔓 Force unlocking undo/redo');
    isRestoringRef.current = false;
    isSavingRef.current = false;
    if (canvas) {
      canvas.__suspendUndoRedo = false;
    }
  }, [canvas]);

  const saveCanvasPropertiesState = useCallback(async (description = 'Canvas properties changed') => {
    if (!canvas) return;
    console.log('🎨 Saving canvas properties:', description);
    
    try {
      const newState = await saveState(description);
      if (newState) {
        canvas.fire('canvas:changed', { state: newState });
      }
    } catch (error) {
      console.error('Error saving canvas properties:', error);
    }
  }, [canvas, saveState]);

  const goToHistoryState = useCallback((targetIndex) => {
    const currentHistory = historyRef.current;
    
    if (targetIndex >= 0 && targetIndex < currentHistory.length) {
      const stateToRestore = currentHistory[targetIndex];
      console.log(`🎯 Going to history state ${targetIndex}`);
      
      historyIndexRef.current = targetIndex;
      setHistoryIndex(targetIndex);
      restoreState(stateToRestore);
    }
  }, [restoreState]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
    lastStateHashRef.current = null;
    console.log('🗑️ History cleared');
  }, []);

  const saveCurrentState = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    if (!isRestoringRef.current && !isSavingRef.current) {
      saveState('Manual save');
    }
  }, [saveState]);

  const exportHistory = useCallback(() => ({
    history: historyRef.current,
    currentIndex: historyIndexRef.current,
    timestamp: Date.now()
  }), []);

  const importHistory = useCallback((historyData) => {
    if (historyData?.history && Array.isArray(historyData.history)) {
      setHistory(historyData.history);
      setHistoryIndex(historyData.currentIndex || historyData.history.length - 1);
      console.log(`📥 Imported history with ${historyData.history.length} states`);
    }
  }, []);

  /**
   * Отримати метрики історії (для UI/debugging)
   */
  const getHistoryMetrics = useCallback(() => {
    const hist = historyRef.current;
    let totalSize = 0;
    
    hist.forEach(state => {
      if (state._compressed) {
        totalSize += state.data.length * 2; // UTF-16
      } else {
        totalSize += JSON.stringify(state).length * 2;
      }
    });
    
    return {
      stateCount: hist.length,
      currentIndex: historyIndexRef.current,
      totalSizeKB: (totalSize / 1024).toFixed(1),
      averageStateSizeKB: hist.length > 0 ? ((totalSize / hist.length) / 1024).toFixed(1) : 0,
      compressionEnabled: CONFIG.USE_COMPRESSION,
      maxHistorySize: CONFIG.MAX_HISTORY_SIZE
    };
  }, []);

  // ============================================================================
  // AUTO-UNLOCK TIMEOUT (захист від зависання)
  // ============================================================================

  useEffect(() => {
    let unlockTimeoutId = null;
    
    const interval = setInterval(() => {
      if ((isRestoringRef.current || isSavingRef.current) && !unlockTimeoutId) {
        unlockTimeoutId = setTimeout(() => {
          if (isRestoringRef.current || isSavingRef.current) {
            console.warn('🚨 Force unlock after timeout');
            forceUnlockUndoRedo();
          }
          unlockTimeoutId = null;
        }, CONFIG.AUTO_UNLOCK_TIMEOUT);
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      if (unlockTimeoutId) clearTimeout(unlockTimeoutId);
    };
  }, [forceUnlockUndoRedo]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

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

  // ============================================================================
  // CANVAS EVENT LISTENERS
  // ============================================================================

  // Зберігаємо референс на обробник щоб уникнути повторних підписок
  const handleCanvasEventRef = useRef(null);
  const toolbarChangeHandlerRef = useRef(null);

  useEffect(() => {
    if (!canvas) return;
    
    // Ініціалізуємо історію тільки один раз
    if (historyRef.current.length === 0) {
      console.log('🎬 Initializing history');
      saveState('Initial state');
    }

    // Події що потребують збереження - розширений список
    const eventsToSave = [
      'object:added',
      'object:removed',
      'object:modified',
      'object:moving',       // Відстежуємо переміщення
      'object:scaling',      // Відстежуємо масштабування
      'object:rotating',     // Відстежуємо обертання
      'object:skewing',      // Відстежуємо нахил
      'path:created',
      'text:changed',
      'text:editing:exited', // Збереження після закінчення редагування тексту
      'canvas:changed',
      'background:changed',
      'canvas:resized',
      'erasing:end',         // Після стирання
    ];

    // Критичні події - негайне збереження (кожна як окремий крок)
    const criticalEvents = new Set([
      'object:added',
      'object:removed',
      'path:created',
      'canvas:changed',
      'background:changed',
      'canvas:resized',
      'text:editing:exited',
      'erasing:end',
    ]);

    // Події завершення дії - зберігаємо тільки коли дія завершена
    const actionEndEvents = new Set([
      'object:modified',  // Це вже подія завершення
    ]);

    // Ігнорувати "проміжні" події поки активна дія
    const inProgressEvents = new Set([
      'object:moving',
      'object:scaling', 
      'object:rotating',
      'object:skewing',
    ]);

    // Видаляємо попередній обробник якщо є
    if (handleCanvasEventRef.current) {
      eventsToSave.forEach(eventType => {
        canvas.off(eventType, handleCanvasEventRef.current);
      });
    }

    // Створюємо новий обробник
    const handleCanvasEvent = (event) => {
      // Fabric.js може передавати тип події різними способами
      const eventType = event?.type || event?.e?.type || event?.action || 'unknown';
      
      // Строга перевірка блокувань
      if (isRestoringRef.current || isSavingRef.current || canvas.__suspendUndoRedo) {
        return;
      }

      // Ігноруємо selection події (вони не змінюють стан канвасу)
      if (eventType.startsWith('selection:')) {
        return;
      }

      // Ігноруємо проміжні події (moving, scaling, rotating) - 
      // чекаємо на object:modified
      if (inProgressEvents.has(eventType)) {
        return;
      }

      // Отримуємо інформацію про об'єкт для кращого логування
      const target = event?.target;
      const objectInfo = target ? (target.type || target.shapeType || 'object') : '';
      
      console.log(`📅 Event: ${eventType}${objectInfo ? ` (${objectInfo})` : ''}`);
      
      // Критичні події - негайно (окремий крок історії)
      if (criticalEvents.has(eventType)) {
        // Скидаємо batch timer для критичних подій
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current);
          batchTimeoutRef.current = null;
        }
        batchStartTimeRef.current = null;
        
        // Додаємо маленьку затримку для критичних подій щоб об'єкт повністю ініціалізувався
        setTimeout(() => {
          if (!isRestoringRef.current && !canvas.__suspendUndoRedo) {
            saveState(`${eventType}: ${objectInfo || 'canvas'}`);
          }
        }, 50);
      } 
      // События завершения действия - сохраняем как отдельный шаг
      else if (actionEndEvents.has(eventType)) {
        // Для object:modified - зберігаємо одразу
        batchSaveState(`Modified: ${objectInfo}`);
      }
      else {
        debouncedSaveState(`Event: ${eventType}`);
      }
    };

    // Зберігаємо референс
    handleCanvasEventRef.current = handleCanvasEvent;

    // Підписуємося на події
    eventsToSave.forEach(eventType => {
      canvas.on(eventType, handleCanvasEvent);
    });

    return () => {
      // Відписуємося при демонтажі
      eventsToSave.forEach(eventType => {
        canvas.off(eventType, handleCanvasEvent);
      });
      handleCanvasEventRef.current = null;
      
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    };
  }, [canvas, saveState, debouncedSaveState, batchSaveState]);

  // ============================================================================
  // TOOLBAR CHANGE LISTENER - відстеження змін розміру та кольорів
  // ============================================================================
  
  useEffect(() => {
    if (!canvas) return;

    // Обробник зміни тулбара (розмір, колір тощо)
    const handleToolbarChange = (event) => {
      // Перевіряємо блокування
      if (isRestoringRef.current || isSavingRef.current || canvas.__suspendUndoRedo) {
        return;
      }

      const detail = event?.detail || {};
      const changeType = [];
      
      // Визначаємо тип зміни
      if (detail.sizeValues) {
        changeType.push('size');
      }
      if (detail.globalColors) {
        changeType.push('colors');
      }
      if (detail.currentShapeType) {
        changeType.push('shape');
      }

      if (changeType.length > 0) {
        console.log(`🎨 Toolbar changed: ${changeType.join(', ')}`);
        // Використовуємо batch save щоб групувати швидкі зміни
        batchSaveState(`Toolbar: ${changeType.join(', ')}`);
      }
    };

    // Зберігаємо референс
    toolbarChangeHandlerRef.current = handleToolbarChange;

    // Підписуємося на custom event
    window.addEventListener('toolbar:changed', handleToolbarChange);

    return () => {
      window.removeEventListener('toolbar:changed', handleToolbarChange);
      toolbarChangeHandlerRef.current = null;
    };
  }, [canvas, batchSaveState]);

  // Cleanup при демонтажі
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    };
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    historyIndex,
    historyLength: history.length,
    clearHistory,
    saveCurrentState,
    saveCanvasPropertiesState,
    immediateSaveState,
    goToHistoryState,
    exportHistory,
    importHistory,
    forceUnlockUndoRedo,
    getHistoryMetrics,
    history
  };
};
