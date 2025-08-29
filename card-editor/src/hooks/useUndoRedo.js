import { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../contexts/CanvasContext";

export const useUndoRedo = () => {
  const { canvas } = useCanvasContext();
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isSavingRef = useRef(false);

  // Використовуємо refs для отримання актуальних значень
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);

  // Синхронізуємо refs з state
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Функція збереження стану
  const saveState = () => {
    if (canvas && !isSavingRef.current && !canvas.__suspendUndoRedo) {
      // Зберігаємо стан без некоректних ключів, додаємо лише потрібні властивості об'єктів
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
      ];
      const json = canvas.toJSON(extraProps);
      console.log("Saving state:", json);

      setHistory((prevHistory) => {
        const currentIndex = historyIndexRef.current;
        // Обрізаємо історію до поточного індексу + новий стан
        const newHistory = [...prevHistory.slice(0, currentIndex + 1), json];

        // Обмежуємо історію до 50 елементів
        if (newHistory.length > 50) {
          newHistory.shift();
          setHistoryIndex(newHistory.length - 1);
        } else {
          setHistoryIndex(newHistory.length - 1);
        }

        console.log(
          "Updated history:",
          newHistory,
          "New index:",
          newHistory.length - 1
        );
        return newHistory;
      });
    }
  };

  // Оновлення історії при зміні канвасу
  useEffect(() => {
    if (canvas) {
      // Збереження початкового стану
      saveState();

      const events = [
        "object:modified",
        "object:added",
        "object:removed",
        "path:created", // Додали для малювання
      ];

      // Додаємо затримку для уникнення дублювання
      const debouncedSaveState = (() => {
        let timeout;
        return () => {
          clearTimeout(timeout);
          timeout = setTimeout(saveState, 300);
        };
      })();

      events.forEach((event) => {
        canvas.on(event, debouncedSaveState);
      });

      return () => {
        events.forEach((event) => {
          canvas.off(event, debouncedSaveState);
        });
      };
    }
  }, [canvas]);

  // Undo
  const undo = () => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;

    if (currentIndex > 0 && canvas && currentHistory.length > 0) {
      const newIndex = currentIndex - 1;
      const stateToLoad = currentHistory[newIndex];

      console.log("Undo to index:", newIndex, "State:", stateToLoad);

      // Блокуємо збереження стану
      isSavingRef.current = true;

      // Відключаємо всі event listeners перед загрузкою
      const events = [
        "object:modified",
        "object:added",
        "object:removed",
        "path:created",
      ];

      events.forEach((event) => {
        canvas.off(event);
      });

      canvas.loadFromJSON(stateToLoad, () => {
        canvas.renderAll();
        canvas.discardActiveObject();
        canvas.requestRenderAll();

        setHistoryIndex(newIndex);
        console.log("Undo applied, new index:", newIndex);

        // Відновлюємо event listeners з затримкою
        setTimeout(() => {
          const debouncedSaveState = (() => {
            let timeout;
            return () => {
              clearTimeout(timeout);
              timeout = setTimeout(saveState, 300);
            };
          })();

          events.forEach((event) => {
            canvas.on(event, debouncedSaveState);
          });

          isSavingRef.current = false;
        }, 500);
      });
    }
  };

  // Redo
  const redo = () => {
    const currentIndex = historyIndexRef.current;
    const currentHistory = historyRef.current;

    if (currentIndex < currentHistory.length - 1 && canvas) {
      const newIndex = currentIndex + 1;
      const stateToLoad = currentHistory[newIndex];

      console.log("Redo to index:", newIndex, "State:", stateToLoad);

      // Блокуємо збереження стану
      isSavingRef.current = true;

      // Відключаємо всі event listeners перед загрузкою
      const events = [
        "object:modified",
        "object:added",
        "object:removed",
        "path:created",
      ];

      events.forEach((event) => {
        canvas.off(event);
      });

      canvas.loadFromJSON(stateToLoad, () => {
        canvas.renderAll();
        canvas.discardActiveObject();
        canvas.requestRenderAll();

        setHistoryIndex(newIndex);
        console.log("Redo applied, new index:", newIndex);

        // Відновлюємо event listeners з затримкою
        setTimeout(() => {
          const debouncedSaveState = (() => {
            let timeout;
            return () => {
              clearTimeout(timeout);
              timeout = setTimeout(saveState, 300);
            };
          })();

          events.forEach((event) => {
            canvas.on(event, debouncedSaveState);
          });

          isSavingRef.current = false;
        }, 500);
      });
    }
  };

  // Повертаємо функції та стани
  return {
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    historyIndex,
    historyLength: history.length,
  };
};
