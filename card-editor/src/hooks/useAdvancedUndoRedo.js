// import { useState, useEffect, useRef, useCallback } from "react";
// import { useCanvasContext } from "../contexts/CanvasContext";
// import { CanvasHistoryManager } from "../utils/canvasHistoryManager";

// export const useAdvancedUndoRedo = () => {
//   const { canvas } = useCanvasContext();
//   const [history, setHistory] = useState([]);
//   const [historyIndex, setHistoryIndex] = useState(-1);
//   const [isProcessing, setIsProcessing] = useState(false);
  
//   // Refs для контролю стану
//   const isSavingRef = useRef(false);
//   const isRestoringRef = useRef(false);
//   const saveTimeoutRef = useRef(null);
//   const historyRef = useRef([]);
//   const historyIndexRef = useRef(-1);
//   const lastStateRef = useRef(null);
//   const historyManagerRef = useRef(null);

//   // Конфігурація
//   const MAX_HISTORY_SIZE = 50;
//   const SAVE_DELAY = 150;
//   const COMPRESSION_THRESHOLD = 30;

//   // Ініціалізація історії менеджера
//   useEffect(() => {
//     historyManagerRef.current = new CanvasHistoryManager({
//       maxHistorySize: MAX_HISTORY_SIZE,
//       compressionThreshold: COMPRESSION_THRESHOLD,
//       enableCompression: true,
//       enableMetrics: true
//     });
//   }, []);

//   // Синхронізуємо refs з state
//   useEffect(() => {
//     historyRef.current = history;
//   }, [history]);

//   useEffect(() => {
//     historyIndexRef.current = historyIndex;
//   }, [historyIndex]);

//   // Функція для порівняння станів
//   const statesAreEqual = useCallback((state1, state2) => {
//     if (!state1 || !state2) return false;
//     if (!historyManagerRef.current) return false;
    
//     const comparison = historyManagerRef.current.compareStates(state1, state2);
//     return !comparison.different;
//   }, []);

//   // Покращена функція збереження стану
//   const saveState = useCallback(async () => {
//     if (!canvas || isSavingRef.current || isRestoringRef.current || canvas.__suspendUndoRedo) {
//       return;
//     }

//     if (!historyManagerRef.current) return;

//     try {
//       isSavingRef.current = true;
//       setIsProcessing(true);

//       // Створюємо снапшот з менеджером історії
//       const snapshot = historyManagerRef.current.createSnapshot(canvas, {
//         includeViewport: true,
//         extraProps: ["customData", "layerId", "groupId"]
//       });

//       // Перевіряємо валідність стану
//       if (!historyManagerRef.current.validateState(snapshot)) {
//         console.warn('Invalid state detected, skipping save');
//         return;
//       }

//       // Перевіряємо, чи відрізняється новий стан від останнього
//       if (lastStateRef.current && statesAreEqual(snapshot, lastStateRef.current)) {
//         return;
//       }

//       lastStateRef.current = snapshot;

//       setHistory((prevHistory) => {
//         const currentIndex = historyIndexRef.current;
//         // Обрізаємо історію після поточного індексу та додаємо новий стан
//         let newHistory = [...prevHistory.slice(0, currentIndex + 1), snapshot];

//         // Застосовуємо компресію якщо потрібно
//         if (newHistory.length > COMPRESSION_THRESHOLD) {
//           newHistory = historyManagerRef.current.compressHistory(newHistory);
//         }

//         // Обмежуємо розмір історії
//         if (newHistory.length > MAX_HISTORY_SIZE) {
//           const removeCount = newHistory.length - MAX_HISTORY_SIZE;
//           newHistory.splice(0, removeCount);
//           setHistoryIndex(newHistory.length - 1);
//         } else {
//           setHistoryIndex(newHistory.length - 1);
//         }

//         console.log(`History updated: ${newHistory.length} states, current index: ${newHistory.length - 1}`);
//         return newHistory;
//       });
//     } catch (error) {
//       console.error('Error saving canvas state:', error);
//     } finally {
//       isSavingRef.current = false;
//       setIsProcessing(false);
//     }
//   }, [canvas, statesAreEqual, MAX_HISTORY_SIZE, COMPRESSION_THRESHOLD]);

//   // Дебаунсована версія збереження стану
//   const debouncedSaveState = useCallback(() => {
//     if (saveTimeoutRef.current) {
//       clearTimeout(saveTimeoutRef.current);
//     }
    
//     saveTimeoutRef.current = setTimeout(() => {
//       saveState();
//     }, SAVE_DELAY);
//   }, [saveState, SAVE_DELAY]);

//   // Функція для ініціалізації історії
//   const initializeHistory = useCallback(() => {
//     if (canvas && historyRef.current.length === 0) {
//       console.log('Initializing history with current canvas state');
//       saveState();
//     }
//   }, [canvas, saveState]);

//   // Функція відновлення стану
//   const restoreState = useCallback(async (state, callback) => {
//     if (!canvas || !state || !historyManagerRef.current) return;

//     try {
//       isRestoringRef.current = true;
//       isSavingRef.current = true;
//       setIsProcessing(true);

//       await historyManagerRef.current.restoreSnapshot(canvas, state, {
//         preserveViewport: false,
//         preserveSelection: false
//       });

//       if (callback) callback();
//     } catch (error) {
//       console.error('Error restoring canvas state:', error);
//     } finally {
//       // Відновлюємо прапорці з невеликою затримкою
//       setTimeout(() => {
//         isRestoringRef.current = false;
//         isSavingRef.current = false;
//         setIsProcessing(false);
//       }, 50);
//     }
//   }, [canvas]);

//   // Функція undo з покращеною обробкою
//   const undo = useCallback(async () => {
//     const currentIndex = historyIndexRef.current;
//     const currentHistory = historyRef.current;

//     if (currentIndex > 0 && canvas && currentHistory.length > 0 && !isProcessing) {
//       const newIndex = currentIndex - 1;
//       const stateToRestore = currentHistory[newIndex];

//       console.log(`Undo: moving from index ${currentIndex} to ${newIndex}`);

//       await restoreState(stateToRestore, () => {
//         setHistoryIndex(newIndex);
//         console.log(`Undo completed: restored state at index ${newIndex}`);
//       });
//     }
//   }, [canvas, restoreState, isProcessing]);

//   // Функція redo з покращеною обробкою
//   const redo = useCallback(async () => {
//     const currentIndex = historyIndexRef.current;
//     const currentHistory = historyRef.current;

//     if (currentIndex < currentHistory.length - 1 && canvas && !isProcessing) {
//       const newIndex = currentIndex + 1;
//       const stateToRestore = currentHistory[newIndex];

//       console.log(`Redo: moving from index ${currentIndex} to ${newIndex}`);

//       await restoreState(stateToRestore, () => {
//         setHistoryIndex(newIndex);
//         console.log(`Redo completed: restored state at index ${newIndex}`);
//       });
//     }
//   }, [canvas, restoreState, isProcessing]);

//   // Функція для переходу до конкретного стану в історії
//   const goToHistoryState = useCallback(async (targetIndex) => {
//     const currentHistory = historyRef.current;
    
//     if (targetIndex >= 0 && targetIndex < currentHistory.length && !isProcessing) {
//       const stateToRestore = currentHistory[targetIndex];
      
//       console.log(`Going to history state at index ${targetIndex}`);
      
//       await restoreState(stateToRestore, () => {
//         setHistoryIndex(targetIndex);
//         console.log(`Moved to history state at index ${targetIndex}`);
//       });
//     }
//   }, [restoreState, isProcessing]);

//   // Функція для очищення історії
//   const clearHistory = useCallback(() => {
//     setHistory([]);
//     setHistoryIndex(-1);
//     lastStateRef.current = null;
//     if (historyManagerRef.current) {
//       historyManagerRef.current.resetMetrics();
//     }
//     console.log('History cleared');
//   }, []);

//   // Функція для ручного збереження поточного стану
//   const saveCurrentState = useCallback(async () => {
//     if (saveTimeoutRef.current) {
//       clearTimeout(saveTimeoutRef.current);
//     }
//     await saveState();
//   }, [saveState]);

//   // Функція для отримання метрик
//   const getHistoryMetrics = useCallback(() => {
//     return historyManagerRef.current ? historyManagerRef.current.getMetrics() : null;
//   }, []);

//   // Функція для експорту історії
//   const exportHistory = useCallback(() => {
//     return {
//       history: historyRef.current,
//       currentIndex: historyIndexRef.current,
//       metrics: getHistoryMetrics(),
//       timestamp: Date.now()
//     };
//   }, [getHistoryMetrics]);

//   // Функція для імпорту історії
//   const importHistory = useCallback((historyData) => {
//     if (historyData && Array.isArray(historyData.history)) {
//       setHistory(historyData.history);
//       setHistoryIndex(historyData.currentIndex || historyData.history.length - 1);
//       console.log(`Imported history with ${historyData.history.length} states`);
//     }
//   }, []);

//   // Налаштування event listeners для канвасу
//   useEffect(() => {
//     if (canvas) {
//       // Ініціалізуємо історію з поточним станом
//       initializeHistory();

//       // Розширений список подій для відстеження
//       const eventsToSave = [
//         'object:added',
//         'object:removed', 
//         'object:modified',
//         'object:skewing',
//         'object:scaling',
//         'object:rotating',
//         'object:moving',
//         'path:created',
//         'selection:created',
//         'selection:updated',
//         'selection:cleared',
//         'text:changed',
//         'text:editing:entered',
//         'text:editing:exited',
//         'group:created',
//         'group:removed'
//       ];

//       // Події, які потребують негайного збереження
//       const immediateEvents = [
//         'object:added',
//         'object:removed',
//         'path:created',
//         'group:created',
//         'group:removed'
//       ];

//       // Обробник подій з умовним дебаунсом
//       const handleCanvasEvent = (event) => {
//         if (isRestoringRef.current || isSavingRef.current) {
//           return;
//         }

//         const eventType = event.type;
        
//         if (immediateEvents.includes(eventType)) {
//           // Для критичних подій зберігаємо з мінімальною затримкою
//           setTimeout(() => saveCurrentState(), 10);
//         } else {
//           // Для інших подій використовуємо дебаунс
//           debouncedSaveState();
//         }
//       };

//       // Підписуємося на події
//       eventsToSave.forEach(eventType => {
//         canvas.on(eventType, handleCanvasEvent);
//       });

//       // Очищення при демонтажі
//       return () => {
//         eventsToSave.forEach(eventType => {
//           canvas.off(eventType, handleCanvasEvent);
//         });
        
//         if (saveTimeoutRef.current) {
//           clearTimeout(saveTimeoutRef.current);
//         }
//       };
//     }
//   }, [canvas, initializeHistory, debouncedSaveState, saveCurrentState]);

//   // Очищення при демонтажі компонента
//   useEffect(() => {
//     return () => {
//       if (saveTimeoutRef.current) {
//         clearTimeout(saveTimeoutRef.current);
//       }
//     };
//   }, []);

//   return {
//     undo,
//     redo,
//     canUndo: historyIndex > 0 && !isProcessing,
//     canRedo: historyIndex < history.length - 1 && !isProcessing,
//     historyIndex,
//     historyLength: history.length,
//     isProcessing,
//     clearHistory,
//     saveCurrentState,
//     goToHistoryState,
//     getHistoryMetrics,
//     exportHistory,
//     importHistory,
//     history: history // Для дебагу
//   };
// };
