import { useState, useEffect, useRef, useCallback } from "react";
import { useCanvasContext } from "../contexts/CanvasContext";
import { UndoRedoKeyboardHandler } from "../utils/undoRedoKeyboardHandler";

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
  const keyboardHandlerRef = useRef(null);

  // Конфігурація
  const MAX_HISTORY_SIZE = 100;
  const SAVE_DELAY = 300;

  // Синхронізуємо refs з state
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Функція для глибокого порівняння станів
  const statesAreEqual = (state1, state2) => {
    if (!state1 || !state2) return false;
    try {
      return JSON.stringify(state1) === JSON.stringify(state2);
    } catch (error) {
      console.warn('Error comparing states:', error);
      return false;
    }
  };

  // Покращена функція збереження стану
  const saveState = useCallback(() => {
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

      // Отримуємо поточний стан канвасу з усіма необхідними властивостями
      const extraProps = [
        "shapeType",
        "baseCornerRadius", 
        "displayCornerRadiusMm",
        "cornerRadiusMm",
        "isCutElement",
        "cutType",
        "strokeUniform",
        "strokeLineJoin",
        "strokeMiterLimit",
        "isCircle",
        "selectable",
        "evented",
        "hasControls",
        "hasBorders",
        "lockMovementX",
        "lockMovementY",
        "lockRotation",
        "lockScalingX",
        "lockScalingY",
        "customProperties",
        "id",
        "name",
        "originalSrc",
        "filters"
      ];

      const currentState = canvas.toJSON(extraProps);
      
      // Додаємо розширені метадані для полотна
      const stateWithMetadata = {
        ...currentState,
        timestamp: Date.now(),
        canvasProperties: {
          // Розміри полотна
          width: canvas.width,
          height: canvas.height,
          // Кольори та фон
          backgroundColor: canvas.backgroundColor || canvas.get("backgroundColor") || "#ffffff",
          // Viewport налаштування
          zoom: canvas.getZoom(),
          center: canvas.getCenter(),
          viewportTransform: canvas.viewportTransform ? canvas.viewportTransform.slice() : null,
          // Додаткові властивості полотна
          overlayColor: canvas.overlayColor || null,
          overlayOpacity: canvas.overlayOpacity || null,
          backgroundImage: canvas.backgroundImage ? {
            src: canvas.backgroundImage.src,
            opacity: canvas.backgroundImage.opacity,
            originX: canvas.backgroundImage.originX,
            originY: canvas.backgroundImage.originY,
            scaleX: canvas.backgroundImage.scaleX,
            scaleY: canvas.backgroundImage.scaleY
          } : null,
          // Сітка та направляючі (якщо є)
          gridEnabled: canvas.gridEnabled || false,
          snapToGrid: canvas.snapToGrid || false,
          gridSize: canvas.gridSize || 10,
          // Інші користувацькі властивості
          customCanvasProperties: canvas.customCanvasProperties || {}
        }
      };

      // Перевіряємо, чи відрізняється новий стан від останнього збереженого
      if (lastStateRef.current && statesAreEqual(stateWithMetadata, lastStateRef.current)) {
        console.log('State unchanged, skipping save');
        return;
      }

      lastStateRef.current = stateWithMetadata;

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
    } catch (error) {
      console.error('Error saving canvas state:', error);
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

    console.log('Starting state restoration...', {
      objectsInState: state.objects ? state.objects.length : 0,
      currentObjects: canvas.getObjects().length
    });

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
      canvas.loadFromJSON(state, () => {
        try {
          console.log('JSON loaded successfully, objects:', canvas.getObjects().length);

          // Відновлюємо властивості полотна
          if (state.canvasProperties) {
            const canvasProps = state.canvasProperties;
            
            // Відновлюємо розміри полотна
            if (canvasProps.width && canvasProps.height) {
              canvas.setDimensions({
                width: canvasProps.width,
                height: canvasProps.height
              });
            }
            
            // Відновлюємо фон полотна
            if (canvasProps.backgroundColor) {
              canvas.set("backgroundColor", canvasProps.backgroundColor);
            }
            
            // Відновлюємо overlay колір якщо є
            if (canvasProps.overlayColor) {
              canvas.set("overlayColor", canvasProps.overlayColor);
            }
            if (canvasProps.overlayOpacity !== null && canvasProps.overlayOpacity !== undefined) {
              canvas.set("overlayOpacity", canvasProps.overlayOpacity);
            }
            
            // Відновлюємо фонове зображення якщо є
            if (canvasProps.backgroundImage) {
              const bgImg = canvasProps.backgroundImage;
              fabric.util.loadImage(bgImg.src, (img) => {
                if (img) {
                  const fabricImg = new fabric.Image(img, {
                    opacity: bgImg.opacity || 1,
                    originX: bgImg.originX || 'left',
                    originY: bgImg.originY || 'top',
                    scaleX: bgImg.scaleX || 1,
                    scaleY: bgImg.scaleY || 1
                  });
                  canvas.setBackgroundImage(fabricImg, canvas.renderAll.bind(canvas));
                }
              });
            }
            
            // Відновлюємо viewport налаштування
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
            
            // Відновлюємо налаштування сітки якщо є
            if (canvasProps.gridEnabled !== undefined) {
              canvas.gridEnabled = canvasProps.gridEnabled;
            }
            if (canvasProps.snapToGrid !== undefined) {
              canvas.snapToGrid = canvasProps.snapToGrid;
            }
            if (canvasProps.gridSize !== undefined) {
              canvas.gridSize = canvasProps.gridSize;
            }
            
            // Відновлюємо користувацькі властивості
            if (canvasProps.customCanvasProperties) {
              canvas.customCanvasProperties = canvasProps.customCanvasProperties;
            }
          } else {
            // Backward compatibility - старий формат
            if (state.viewport && state.viewport.zoom) {
              canvas.setZoom(state.viewport.zoom);
            } else if (currentZoom) {
              canvas.setZoom(currentZoom);
            }

            if (currentVpTransform && (!state.viewport || !state.viewport.zoom)) {
              canvas.setViewportTransform(currentVpTransform);
            }
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
          });

          // Очищаємо виділення та рендеримо
          canvas.discardActiveObject();
          canvas.renderAll();
          canvas.requestRenderAll();
          
          console.log('State restoration completed successfully');
          
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
            
            console.log('All restoration flags cleared');
            
            if (callback) callback();
          };

          // Скидаємо блокування з короткою затримкою
          setTimeout(clearAllFlags, 50);

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

      console.log(`Undo: moving from index ${currentIndex} to ${newIndex}`);

      restoreState(stateToRestore, () => {
        setHistoryIndex(newIndex);
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

      console.log(`Redo: moving from index ${currentIndex} to ${newIndex}`);

      restoreState(stateToRestore, () => {
        setHistoryIndex(newIndex);
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
  const saveCanvasPropertiesState = useCallback((description = 'Canvas properties changed') => {
    if (!canvas) return;
    
    console.log('🎨 Saving canvas properties state:', description);
    
    // Блокуємо обробку подій під час збереження
    isRestoringRef.current = true;
    
    try {
      const newState = saveState(description);
      if (newState) {
        console.log('✅ Canvas properties state saved successfully');
        // Генеруємо кастомну подію для повідомлення компонентів
        canvas.fire('canvas:changed', { state: newState });
      }
    } catch (error) {
      console.error('❌ Error saving canvas properties state:', error);
    } finally {
      // Розблоковуємо через короткий час
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 100);
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
      const eventsToSave = [
        'object:added',
        'object:removed', 
        'object:modified',
        'object:skewing',
        'object:scaling',
        'object:rotating',
        'object:moving',
        'path:created',
        'selection:created',
        'selection:updated',
        'selection:cleared',
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
