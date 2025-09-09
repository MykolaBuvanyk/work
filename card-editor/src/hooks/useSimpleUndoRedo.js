import { useState, useEffect, useRef, useCallback } from "react";
import { useCanvasContext } from "../contexts/CanvasContext";

export const useSimpleUndoRedo = () => {
  const { canvas } = useCanvasContext();
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Refs для контролю стану
  const isRestoringRef = useRef(false);
  const saveTimeoutRef = useRef(null);

  // Конфігурація
  const MAX_HISTORY_SIZE = 50;
  const SAVE_DELAY = 500;

  // Проста функція збереження стану
  const saveState = useCallback(() => {
    if (!canvas || isRestoringRef.current) {
      return;
    }

    try {
      const extraProps = [
        "shapeType", "baseCornerRadius", "displayCornerRadiusMm",
        "cornerRadiusMm", "isCutElement", "cutType", "strokeUniform",
        "strokeLineJoin", "strokeMiterLimit", "isCircle"
      ];

      const currentState = canvas.toJSON(extraProps);
      
      setHistory((prevHistory) => {
        // Якщо відновлюємо стан, не додаємо новий
        if (isRestoringRef.current) {
          return prevHistory;
        }

        const newHistory = [...prevHistory.slice(0, historyIndex + 1), currentState];
        
        // Обмежуємо розмір історії
        if (newHistory.length > MAX_HISTORY_SIZE) {
          newHistory.shift();
          setHistoryIndex(newHistory.length - 1);
        } else {
          setHistoryIndex(newHistory.length - 1);
        }

        console.log(`Simple history updated: ${newHistory.length} states`);
        return newHistory;
      });
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }, [canvas, historyIndex]);

  // Дебаунсована версія
  const debouncedSaveState = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(saveState, SAVE_DELAY);
  }, [saveState]);

  // Проста функція відновлення
  const restoreState = useCallback((state) => {
    if (!canvas || !state || isRestoringRef.current) {
      return;
    }

    isRestoringRef.current = true;

    try {
      canvas.loadFromJSON(state, () => {
        canvas.renderAll();
        
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 100);
      });
    } catch (error) {
      console.error('Error restoring state:', error);
      isRestoringRef.current = false;
    }
  }, [canvas]);

  // Undo функція
  const undo = useCallback(() => {
    if (historyIndex > 0 && history.length > 0) {
      const newIndex = historyIndex - 1;
      const stateToRestore = history[newIndex];
      
      console.log(`Simple undo: ${historyIndex} -> ${newIndex}`);
      
      setHistoryIndex(newIndex);
      restoreState(stateToRestore);
    }
  }, [historyIndex, history, restoreState]);

  // Redo функція
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const stateToRestore = history[newIndex];
      
      console.log(`Simple redo: ${historyIndex} -> ${newIndex}`);
      
      setHistoryIndex(newIndex);
      restoreState(stateToRestore);
    }
  }, [historyIndex, history, restoreState]);

  // Event listeners
  useEffect(() => {
    if (canvas) {
      // Зберігаємо початковий стан
      if (history.length === 0) {
        saveState();
      }

      const handleCanvasChange = () => {
        if (!isRestoringRef.current) {
          debouncedSaveState();
        }
      };

      // Підписуємося на основні події
      const events = ['object:added', 'object:removed', 'object:modified'];
      events.forEach(event => {
        canvas.on(event, handleCanvasChange);
      });

      return () => {
        events.forEach(event => {
          canvas.off(event, handleCanvasChange);
        });
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
      };
    }
  }, [canvas, saveState, debouncedSaveState, history.length]);

  return {
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    historyIndex,
    historyLength: history.length,
    clearHistory: () => {
      setHistory([]);
      setHistoryIndex(-1);
    }
  };
};
