import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import { CUSTOM_FONT_FILES } from "../../constants/fonts";
import styles from "./TextList.module.css";

const TextList = () => {
  const { canvas, globalColors } = useCanvasContext();
  const [texts, setTexts] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [newTextValue, setNewTextValue] = useState("");
  const [availableFonts, setAvailableFonts] = useState([]);
  const isUpdatingRef = useRef(false);

  // Units: show/edit in millimeters; convert to pixels for Fabric
  const PX_PER_MM = 72 / 25.4;
  const mmToPx = (mm) => (typeof mm === "number" ? mm * PX_PER_MM : 0);
  const pxToMm = (px) => (typeof px === "number" ? px / PX_PER_MM : 0);
  const MIN_FONT_MM = 3;
  const MAX_FONT_MM = pxToMm(256); // preserve previous 256px cap (~67.7 mm)

  // Функція для завантаження списку доступних шрифтів
  const loadAvailableFonts = async () => {
    try {
      // Список файлів шрифтів з папки fonts
      const fontFiles = CUSTOM_FONT_FILES;

      // Базові системні шрифти
      const systemFonts = [
        { name: "Arial", value: "Arial" },
        { name: "Helvetica", value: "Helvetica" },
        { name: "Georgia", value: "Georgia" },
        { name: "Verdana", value: "Verdana" },
        { name: "Courier New", value: "Courier New" },
      ];

      // Завантажуємо кастомні шрифти
      const loadedFonts = [];

      for (const font of fontFiles) {
        try {
          // Використовуємо шлях до public
          const path = `/fonts/${font.file}`;

          const fontFace = new FontFace(font.name, `url(${path})`);
          await fontFace.load();
          document.fonts.add(fontFace);
          loadedFonts.push({
            name: font.name,
            value: font.name,
            loaded: true,
          });
        } catch (error) {
          console.warn(`Помилка завантаження шрифту ${font.name}:`, error);
        }
      }

      // Об'єднуємо системні та завантажені шрифти, видаляючи дублікати
      const allFonts = [...systemFonts, ...loadedFonts];

      // Видаляємо дублікати за значенням value (назвою шрифту)
      const uniqueFonts = allFonts.reduce((acc, font) => {
        if (!acc.find((f) => f.value === font.value)) {
          acc.push(font);
        }
        return acc;
      }, []);

      setAvailableFonts(uniqueFonts);
      console.log(
        `Завантажено ${loadedFonts.length} кастомних шрифтів, всього унікальних: ${uniqueFonts.length}`
      );
    } catch (error) {
      console.error("Помилка завантаження шрифтів:", error);
      // Fallback до базових шрифтів
      setAvailableFonts([
        { name: "Arial", value: "Arial" },
        { name: "Times New Roman", value: "Times New Roman" },
        { name: "Courier New", value: "Courier New" },
        { name: "Helvetica", value: "Helvetica" },
        { name: "Georgia", value: "Georgia" },
        { name: "Verdana", value: "Verdana" },
      ]);
    }
  };

  // Завантажуємо шрифти при ініціалізації компонента
  useEffect(() => {
    loadAvailableFonts();
  }, []);

  // Функція для примусового оновлення списку
  const forceUpdate = () => {
    if (canvas && !isUpdatingRef.current) {
      const allObjects = canvas.getObjects();
      const textObjects = allObjects.filter(
        (obj) =>
          obj.type === "i-text" || obj.type === "text" || obj.type === "textbox"
      );

      const textList = textObjects.map((obj) => ({
        id: obj.id || `text_${Date.now()}_${Math.random()}`,
        content: obj.text || "Без тексту",
        object: obj,
        fontSize: obj.fontSize || 20,
        fontFamily: obj.fontFamily || "Arial",
        fontWeight: obj.fontWeight || "normal",
        textAlign: obj.textAlign || "left",
        fill: obj.fill || "#000000",
      }));

      // Присвоюємо id об'єктам, якщо їх немає
      textObjects.forEach((obj, index) => {
        if (!obj.id) {
          obj.id = textList[index].id;
        }
      });

      setTexts(textList);
    }
  };

  // Синхронізація текстів з canvas
  useEffect(() => {
    if (canvas) {
      const updateTextList = () => {
        if (isUpdatingRef.current) return;
        forceUpdate();
      };

      // Початкове оновлення
      updateTextList();

      // Слухачі подій
      const events = [
        "object:added",
        "object:removed",
        "object:modified",
        "text:changed",
        "selection:created",
        "selection:updated",
      ];

      events.forEach((event) => {
        canvas.on(event, updateTextList);
      });

      return () => {
        events.forEach((event) => {
          canvas.off(event, updateTextList);
        });
      };
    }
  }, [canvas]);

  // Додавання нового тексту
  const addText = () => {
    if (canvas) {
      isUpdatingRef.current = true;

      // Розраховуємо центр полотна
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      const text = new fabric.IText(newTextValue || "Новий текст", {
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        originX: "center",
        originY: "center",
        // default ~5 mm
        fontSize: mmToPx(5),
        fontFamily: "Arial",
        fontWeight: "normal",
        textAlign: "left",
        selectable: true,
        fill: globalColors.textColor,
        id: `text_${Date.now()}_${Math.random()}`,
      });

      canvas.add(text);
      // Гарантуємо валідність координат після додавання
      if (typeof text.setCoords === "function") text.setCoords();
      canvas.setActiveObject(text);
      canvas.requestRenderAll();
      if (typeof text.setCoords === "function") text.setCoords();
      requestAnimationFrame(() => {
        try {
          if (typeof text.setCoords === "function") text.setCoords();
        } catch {}
      });

      // Викликаємо copyHandler з Canvas для повної імітації кліку по кнопці редагування
      try {
        if (
          window.__canvasCopyHandler &&
          typeof window.__canvasCopyHandler === "function"
        ) {
          window.__canvasCopyHandler(null, { target: text });
          // Двойная синхронизация selection
          const len = (text.text || "").length;
          if (typeof text.setSelectionStart === "function")
            text.setSelectionStart(len);
          if (typeof text.setSelectionEnd === "function")
            text.setSelectionEnd(len);
          if (text.hiddenTextarea) {
            text.hiddenTextarea.selectionStart = len;
            text.hiddenTextarea.selectionEnd = len;
          }
          setTimeout(() => {
            if (typeof text.setSelectionStart === "function")
              text.setSelectionStart(len);
            if (typeof text.setSelectionEnd === "function")
              text.setSelectionEnd(len);
            if (text.hiddenTextarea) {
              text.hiddenTextarea.selectionStart = len;
              text.hiddenTextarea.selectionEnd = len;
            }
          }, 50);
        } else if (
          window.cardEditorCopyHandler &&
          typeof window.cardEditorCopyHandler === "function"
        ) {
          window.cardEditorCopyHandler(null, { target: text });
          const len = (text.text || "").length;
          if (typeof text.setSelectionStart === "function")
            text.setSelectionStart(len);
          if (typeof text.setSelectionEnd === "function")
            text.setSelectionEnd(len);
          if (text.hiddenTextarea) {
            text.hiddenTextarea.selectionStart = len;
            text.hiddenTextarea.selectionEnd = len;
          }
          setTimeout(() => {
            if (typeof text.setSelectionStart === "function")
              text.setSelectionStart(len);
            if (typeof text.setSelectionEnd === "function")
              text.setSelectionEnd(len);
            if (text.hiddenTextarea) {
              text.hiddenTextarea.selectionStart = len;
              text.hiddenTextarea.selectionEnd = len;
            }
          }, 50);
        } else {
          // Фолбек: ручний виклик логіки
          text.__allowNextEditing = true;
          text.enterEditing && text.enterEditing();
          const txt = typeof text.text === "string" ? text.text : "";
          try {
            text.selectionStart = txt.length;
            text.selectionEnd = txt.length;
            if (typeof text.setSelectionStart === "function")
              text.setSelectionStart(txt.length);
            if (typeof text.setSelectionEnd === "function")
              text.setSelectionEnd(txt.length);
            if (text.hiddenTextarea) {
              text.hiddenTextarea.selectionStart = txt.length;
              text.hiddenTextarea.selectionEnd = txt.length;
            }
            setTimeout(() => {
              if (typeof text.setSelectionStart === "function")
                text.setSelectionStart(txt.length);
              if (typeof text.setSelectionEnd === "function")
                text.setSelectionEnd(txt.length);
              if (text.hiddenTextarea) {
                text.hiddenTextarea.selectionStart = txt.length;
                text.hiddenTextarea.selectionEnd = txt.length;
              }
            }, 50);
          } catch {}
          try {
            if (
              text.hiddenTextarea &&
              typeof text.hiddenTextarea.focus === "function"
            ) {
              text.hiddenTextarea.focus();
            }
          } catch {}
          if (canvas && typeof canvas.requestRenderAll === "function") {
            canvas.requestRenderAll();
          }
        }
      } catch {}

      // Очищуємо поле після додавання
      setNewTextValue("Add text");

      setTimeout(() => {
        isUpdatingRef.current = false;
        forceUpdate();
      }, 100);
    }
  };

  // Функція для отримання активного тексту
  const getActiveText = () => {
    if (!canvas) return null;
    const activeObj = canvas.getActiveObject();
    if (
      activeObj &&
      (activeObj.type === "i-text" ||
        activeObj.type === "text" ||
        activeObj.type === "textbox")
    ) {
      return activeObj;
    }
    return null;
  };

  // Зміна розміру шрифту
  // Size in mm
  const changeFontSize = (sizeMm) => {
    const activeText = getActiveText();
    if (activeText) {
      const clamped = Math.max(
        MIN_FONT_MM,
        Math.min(MAX_FONT_MM, parseFloat(sizeMm) || MIN_FONT_MM)
      );
      activeText.set("fontSize", mmToPx(clamped));
      canvas.renderAll();
    }
  };

  // Зміна шрифту
  const changeFontFamily = (family) => {
    const activeText = getActiveText();
    if (activeText) {
      activeText.set("fontFamily", family);
      canvas.renderAll();
    }
  };

  // Перемикання жирного тексту
  const toggleBold = () => {
    const activeText = getActiveText();
    if (activeText) {
      const currentWeight = activeText.fontWeight;
      const newWeight = currentWeight === "bold" ? "normal" : "bold";
      activeText.set("fontWeight", newWeight);
      canvas.renderAll();
    }
  };

  // Перемикання курсиву
  const toggleItalic = () => {
    const activeText = getActiveText();
    if (activeText) {
      const currentStyle = activeText.fontStyle;
      const newStyle = currentStyle === "italic" ? "normal" : "italic";
      activeText.set("fontStyle", newStyle);
      canvas.renderAll();
    }
  };

  // Перемикання підкреслення
  const toggleUnderline = () => {
    const activeText = getActiveText();
    if (activeText) {
      const currentUnderline = activeText.underline;
      activeText.set("underline", !currentUnderline);
      canvas.renderAll();
    }
  };

  // Зміна вирівнювання тексту
  const changeTextAlign = (align) => {
    const activeText = getActiveText();
    if (activeText) {
      activeText.set("textAlign", align);
      canvas.renderAll();
    }
  };

  // Зміна кольору тексту
  const changeTextColor = (color) => {
    const activeText = getActiveText();
    if (activeText) {
      activeText.set("fill", color);
      canvas.renderAll();
    }
  };

  // Видалення тексту
  const deleteText = () => {
    const activeText = getActiveText();
    if (activeText) {
      canvas.remove(activeText);
      canvas.renderAll();
    }
  };

  // Спеціальні символи
  const specialSymbols = [
    { symbol: "∞", name: "Безкінечність" },
    { symbol: "→", name: "Стрілка вправо" },
    { symbol: "←", name: "Стрілка вліво" },
    { symbol: "↑", name: "Стрілка вгору" },
    { symbol: "↓", name: "Стрілка вниз" },
    { symbol: "↔", name: "Стрілка в обидва боки" },
    { symbol: "⇒", name: "Подвійна стрілка вправо" },
    { symbol: "⇐", name: "Подвійна стрілка вліво" },
    { symbol: "⇔", name: "Подвійна стрілка в обидва боки" },
    { symbol: "≠", name: "Не дорівнює" },
    { symbol: "≤", name: "Менше або дорівнює" },
    { symbol: "≥", name: "Більше або дорівнює" },
    { symbol: "±", name: "Плюс мінус" },
    { symbol: "×", name: "Множення" },
    { symbol: "÷", name: "Ділення" },
    { symbol: "√", name: "Квадратний корінь" },
    { symbol: "∑", name: "Сума" },
    { symbol: "∏", name: "Добуток" },
    { symbol: "∫", name: "Інтеграл" },
    { symbol: "∂", name: "Частинна похідна" },
    { symbol: "∇", name: "Набла" },
    { symbol: "α", name: "Альфа" },
    { symbol: "β", name: "Бета" },
    { symbol: "γ", name: "Гамма" },
    { symbol: "δ", name: "Дельта" },
    { symbol: "ε", name: "Епсилон" },
    { symbol: "θ", name: "Тета" },
    { symbol: "λ", name: "Лямбда" },
    { symbol: "μ", name: "Мю" },
    { symbol: "π", name: "Пі" },
    { symbol: "σ", name: "Сигма" },
    { symbol: "φ", name: "Фі" },
    { symbol: "ψ", name: "Псі" },
    { symbol: "ω", name: "Омега мала" },
    { symbol: "Α", name: "Альфа велика" },
    { symbol: "Β", name: "Бета велика" },
    { symbol: "Γ", name: "Гамма велика" },
    { symbol: "Δ", name: "Дельта велика" },
    { symbol: "Θ", name: "Тета велика" },
    { symbol: "Λ", name: "Лямбда велика" },
    { symbol: "Π", name: "Пі велика" },
    { symbol: "Σ", name: "Сигма велика" },
    { symbol: "Φ", name: "Фі велика" },
    { symbol: "Ψ", name: "Псі велика" },
    { symbol: "Ω", name: "Омега велика" },
    { symbol: "♠", name: "Піки" },
    { symbol: "♣", name: "Хрести" },
    { symbol: "♥", name: "Червоні" },
    { symbol: "♦", name: "Буби" },
    { symbol: "★", name: "Зірка" },
    { symbol: "☆", name: "Зірка порожня" },
    { symbol: "♪", name: "Нота" },
    { symbol: "♫", name: "Ноти" },
    { symbol: "©", name: "Копірайт" },
    { symbol: "®", name: "Зареєстровано" },
    { symbol: "™", name: "Торгова марка" },
    { symbol: "°", name: "Градус" },
    { symbol: "§", name: "Параграф" },
    { symbol: "¶", name: "Абзац" },
    { symbol: "•", name: "Маркер" },
    { symbol: "◦", name: "Білий маркер" },
    { symbol: "▪", name: "Чорний квадрат" },
    { symbol: "▫", name: "Білий квадрат" },
    { symbol: "▲", name: "Чорний трикутник" },
    { symbol: "△", name: "Білий трикутник" },
    { symbol: "▼", name: "Чорний трикутник вниз" },
    { symbol: "▽", name: "Білий трикутник вниз" },
    { symbol: "◆", name: "Чорний ромб" },
    { symbol: "◇", name: "Білий ромб" },
    { symbol: "●", name: "Чорне коло" },
    { symbol: "○", name: "Біле коло" },
    { symbol: "■", name: "Чорний квадрат великий" },
    { symbol: "□", name: "Білий квадрат великий" },
  ];

  // Додавання спеціального символу до тексту
  const addSpecialSymbol = (textObj, symbol) => {
    if (textObj) {
      const currentText = textObj.text || "";
      const cursorPosition = textObj.selectionStart || currentText.length;
      const newText =
        currentText.slice(0, cursorPosition) +
        symbol +
        currentText.slice(cursorPosition);
      textObj.set("text", newText);
      textObj.selectionStart = cursorPosition + symbol.length;
      textObj.selectionEnd = cursorPosition + symbol.length;
      canvas.renderAll();
      forceUpdate();
    }
  };

  // Стан для модального вікна спеціальних символів
  const [showSymbolModal, setShowSymbolModal] = useState(false);
  const [currentTextForSymbol, setCurrentTextForSymbol] = useState(null);

  // Обробка вибору тексту зі списку
  const handleTextSelect = (textObj) => {
    if (canvas && textObj.object) {
      canvas.setActiveObject(textObj.object);
      canvas.renderAll();
      setSelectedTextId(textObj.id);
    }
  };

  // Отримання активного тексту для відображення його параметрів
  const activeText = getActiveText();
  // Display current font size in mm
  const currentFontSize = activeText
    ? pxToMm(activeText.fontSize || 20)
    : pxToMm(20);
  const currentFontFamily = activeText?.fontFamily || "Arial";
  const currentFontWeight = activeText?.fontWeight || "normal";
  const currentFontStyle = activeText?.fontStyle || "normal";
  const currentUnderline = activeText?.underline || false;
  const currentTextAlign = activeText?.textAlign || "left";
  const currentColor = activeText?.fill || "#000000";

  return (
    <div className={styles.textListContainer}>
      <div className={styles.textList}>
        {texts.map((text, index) => (
          <div
            key={text.id}
            className={`${styles.textItem} ${
              activeText?.id === text.id ? styles.selected : ""
            }`}
            onClick={() => handleTextSelect(text)}
          >
            <div className={styles.textNumber}>{index + 1}.</div>
            <div className={styles.textItemWrap}>
              <div className={styles.textContent}>
                <input
                  type="text"
                  value={text.content}
                  onChange={(e) => {
                    if (text.object) {
                      text.object.set("text", e.target.value);
                      canvas.renderAll();
                      forceUpdate();
                    }
                  }}
                  className={styles.textInput}
                />
              </div>
              <div className={styles.textControls}>
                <div className={styles.fontSizeControl}>
                  <button
                    onClick={() => {
                      const currentText = texts.find((t) => t.id === text.id);
                      if (
                        currentText?.object &&
                        pxToMm(currentText.object.fontSize) > MIN_FONT_MM
                      ) {
                        const nextMm = Math.max(
                          MIN_FONT_MM,
                          pxToMm(currentText.object.fontSize) - 1
                        );
                        currentText.object.set("fontSize", mmToPx(nextMm));
                        canvas.renderAll();
                        forceUpdate();
                      }
                    }}
                    className={styles.sizeButton}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={
                      text.object
                        ? Number(pxToMm(text.object.fontSize || 20).toFixed(1))
                        : Number(pxToMm(20).toFixed(1))
                    }
                    onChange={(e) => {
                      const mm = parseFloat(e.target.value);
                      const newSize = Math.max(
                        MIN_FONT_MM,
                        Math.min(MAX_FONT_MM, isNaN(mm) ? MIN_FONT_MM : mm)
                      );
                      if (text.object) {
                        text.object.set("fontSize", mmToPx(newSize));
                        canvas.renderAll();
                        forceUpdate();
                      }
                    }}
                    min={MIN_FONT_MM}
                    max={Number(MAX_FONT_MM.toFixed(1))}
                    className={styles.fontSizeInput}
                    onWheel={(e) =>
                      e.target.blur()
                    } /* Додатково блокує зміну через колесо миші */
                  />
                  <button
                    onClick={() => {
                      const currentText = texts.find((t) => t.id === text.id);
                      if (
                        currentText?.object &&
                        pxToMm(currentText.object.fontSize) < MAX_FONT_MM
                      ) {
                        const nextMm = Math.min(
                          MAX_FONT_MM,
                          pxToMm(currentText.object.fontSize) + 1
                        );
                        currentText.object.set("fontSize", mmToPx(nextMm));
                        canvas.renderAll();
                        forceUpdate();
                      }
                    }}
                    className={styles.sizeButton}
                  >
                    +
                  </button>
                </div>
                <select
                  value={text.object?.fontFamily || "Arial"}
                  onChange={(e) => {
                    if (text.object) {
                      text.object.set("fontFamily", e.target.value);
                      canvas.renderAll();
                      forceUpdate();
                    }
                  }}
                  className={styles.fontFamilySelect}
                  style={{ fontFamily: text.object?.fontFamily || "Arial" }}
                >
                  {availableFonts.map((font) => (
                    <option
                      key={font.value}
                      value={font.value}
                      style={{ fontFamily: font.value }}
                    >
                      {font.name}
                    </option>
                  ))}
                </select>
                <div className={styles.formatButtons}>
                  <button
                    onClick={() => {
                      if (text.object) {
                        const currentWeight = text.object.fontWeight;
                        const newWeight =
                          currentWeight === "bold" ? "normal" : "bold";
                        text.object.set("fontWeight", newWeight);
                        canvas.renderAll();
                        forceUpdate();
                      }
                    }}
                    className={`${styles.formatButton} ${
                      text.object?.fontWeight === "bold" ? styles.active : ""
                    }`}
                  >
                    <svg
                      width="14"
                      height="16"
                      viewBox="0 0 14 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M0.839355 16V-4.76837e-07H7.24561C8.42269 -4.76837e-07 9.40446 0.174479 10.1909 0.523437C10.9774 0.872396 11.5685 1.35677 11.9644 1.97656C12.3602 2.59115 12.5581 3.29948 12.5581 4.10156C12.5581 4.72656 12.4331 5.27604 12.1831 5.75C11.9331 6.21875 11.5894 6.60417 11.1519 6.90625C10.7196 7.20312 10.2248 7.41406 9.66748 7.53906V7.69531C10.2769 7.72135 10.8472 7.89323 11.3784 8.21094C11.9149 8.52865 12.3498 8.97396 12.6831 9.54687C13.0164 10.1146 13.1831 10.7917 13.1831 11.5781C13.1831 12.4271 12.9722 13.1849 12.5503 13.8516C12.1336 14.513 11.5164 15.0365 10.6987 15.4219C9.88102 15.8073 8.87321 16 7.67529 16H0.839355ZM4.22217 13.2344H6.97998C7.92269 13.2344 8.61019 13.0547 9.04248 12.6953C9.47477 12.3307 9.69092 11.8464 9.69092 11.2422C9.69092 10.7995 9.58415 10.4089 9.37061 10.0703C9.15706 9.73177 8.85238 9.46615 8.45654 9.27344C8.06592 9.08073 7.59977 8.98437 7.05811 8.98437H4.22217V13.2344ZM4.22217 6.69531H6.72998C7.19352 6.69531 7.60498 6.61458 7.96436 6.45312C8.32894 6.28646 8.6154 6.05208 8.82373 5.75C9.03727 5.44792 9.14404 5.08594 9.14404 4.66406C9.14404 4.08594 8.93831 3.61979 8.52686 3.26562C8.12061 2.91146 7.54248 2.73437 6.79248 2.73437H4.22217V6.69531Z"
                        fill="black"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (text.object) {
                        const currentStyle = text.object.fontStyle;
                        const newStyle =
                          currentStyle === "italic" ? "normal" : "italic";
                        text.object.set("fontStyle", newStyle);
                        canvas.renderAll();
                        forceUpdate();
                      }
                    }}
                    className={`${styles.formatButton} ${
                      text.object?.fontStyle === "italic" ? styles.active : ""
                    }`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3.42843 1.3332C3.42843 0.780915 3.85787 0.3332 4.38761 0.3332H9.48348C9.49595 0.332944 9.50846 0.332943 9.521 0.3332H14.6189C15.1486 0.3332 15.5781 0.780915 15.5781 1.3332C15.5781 1.88549 15.1486 2.3332 14.6189 2.3332H10.2896L8.11545 13.6665H12.0611C12.5908 13.6665 13.0203 14.1142 13.0203 14.6665C13.0203 15.2188 12.5908 15.6665 12.0611 15.6665H6.96524C6.95275 15.6668 6.94023 15.6668 6.92767 15.6665H1.82979C1.30005 15.6665 0.870605 15.2188 0.870605 14.6665C0.870605 14.1142 1.30005 13.6665 1.82979 13.6665H6.15909L8.33324 2.3332H4.38761C3.85787 2.3332 3.42843 1.88549 3.42843 1.3332Z"
                        fill="black"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (text.object) {
                        const currentUnderline = text.object.underline;
                        text.object.set("underline", !currentUnderline);
                        canvas.renderAll();
                        forceUpdate();
                      }
                    }}
                    className={`${styles.formatButton} ${
                      text.object?.underline ? styles.active : ""
                    }`}
                  >
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 19 19"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M5.16846 2.375V7.91667C5.16846 9.17645 5.64848 10.3846 6.50291 11.2754C7.35735 12.1662 8.51622 12.6667 9.72458 12.6667C10.9329 12.6667 12.0918 12.1662 12.9462 11.2754C13.8007 10.3846 14.2807 9.17645 14.2807 7.91667V2.375"
                        stroke="black"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <path
                        d="M3.6499 16.625H15.7996"
                        stroke="black"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                </div>
                <div className={styles.alignButtons}>
                  <button
                    onClick={() => {
                      if (text.object) {
                        text.object.set("textAlign", "left");
                        canvas.renderAll();
                        forceUpdate();
                      }
                    }}
                    className={`${styles.alignButton} ${
                      text.object?.textAlign === "left" ? styles.active : ""
                    }`}
                  >
                    <svg
                      width="16"
                      height="14"
                      viewBox="0 0 16 14"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1.14273 0.25C0.745421 0.25 0.42334 0.585786 0.42334 1C0.42334 1.41421 0.745421 1.75 1.14273 1.75H14.5713C14.9686 1.75 15.2907 1.41421 15.2907 1C15.2907 0.585786 14.9686 0.25 14.5713 0.25H1.14273Z"
                        fill="#2D264B"
                      />
                      <path
                        d="M1.14273 4.25C0.745421 4.25 0.42334 4.58579 0.42334 5C0.42334 5.41421 0.745421 5.75 1.14273 5.75H6.89783C7.29514 5.75 7.61722 5.41421 7.61722 5C7.61722 4.58579 7.29514 4.25 6.89783 4.25H1.14273Z"
                        fill="#2D264B"
                      />
                      <path
                        d="M1.14273 8.25C0.745421 8.25 0.42334 8.58579 0.42334 9C0.42334 9.41421 0.745421 9.75 1.14273 9.75H14.5713C14.9686 9.75 15.2907 9.41421 15.2907 9C15.2907 8.58579 14.9686 8.25 14.5713 8.25H1.14273Z"
                        fill="#2D264B"
                      />
                      <path
                        d="M1.14273 12.25C0.745421 12.25 0.42334 12.5858 0.42334 13C0.42334 13.4142 0.745421 13.75 1.14273 13.75H6.89783C7.29514 13.75 7.61722 13.4142 7.61722 13C7.61722 12.5858 7.29514 12.25 6.89783 12.25H1.14273Z"
                        fill="#2D264B"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (text.object) {
                        text.object.set("textAlign", "center");
                        canvas.renderAll();
                        forceUpdate();
                      }
                    }}
                    className={`${styles.alignButton} ${
                      text.object?.textAlign === "center" ? styles.active : ""
                    }`}
                  >
                    <svg
                      width="16"
                      height="14"
                      viewBox="0 0 16 14"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1.12271 0.25C0.725401 0.25 0.40332 0.585786 0.40332 1C0.40332 1.41421 0.725401 1.75 1.12271 1.75H14.5513C14.9486 1.75 15.2707 1.41421 15.2707 1C15.2707 0.585786 14.9486 0.25 14.5513 0.25H1.12271Z"
                        fill="#2D264B"
                      />
                      <path
                        d="M4.95944 4.25C4.56214 4.25 4.24005 4.58579 4.24005 5C4.24005 5.41421 4.56214 5.75 4.95944 5.75H10.7145C11.1119 5.75 11.4339 5.41421 11.4339 5C11.4339 4.58579 11.1119 4.25 10.7145 4.25H4.95944Z"
                        fill="#2D264B"
                      />
                      <path
                        d="M1.12271 8.25C0.725401 8.25 0.40332 8.58579 0.40332 9C0.40332 9.41421 0.725401 9.75 1.12271 9.75H14.5513C14.9486 9.75 15.2707 9.41421 15.2707 9C15.2707 8.58579 14.9486 8.25 14.5513 8.25H1.12271Z"
                        fill="#2D264B"
                      />
                      <path
                        d="M4.95944 12.25C4.56214 12.25 4.24005 12.5858 4.24005 13C4.24005 13.4142 4.56214 13.75 4.95944 13.75H10.7145C11.1119 13.75 11.4339 13.4142 11.4339 13C11.4339 12.5858 11.1119 12.25 10.7145 12.25H4.95944Z"
                        fill="#2D264B"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (text.object) {
                        text.object.set("textAlign", "right");
                        canvas.renderAll();
                        forceUpdate();
                      }
                    }}
                    className={`${styles.alignButton} ${
                      text.object?.textAlign === "right" ? styles.active : ""
                    }`}
                  >
                    <svg
                      width="16"
                      height="14"
                      viewBox="0 0 16 14"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1.1022 1.75L14.5308 1.75C14.9281 1.75 15.2502 1.41421 15.2502 1C15.2502 0.585786 14.9281 0.25 14.5308 0.25H1.1022C0.704893 0.25 0.382812 0.585788 0.382812 1C0.382812 1.41421 0.704893 1.75 1.1022 1.75Z"
                        fill="#2D264B"
                      />
                      <path
                        d="M8.77567 5.75L14.5308 5.75C14.9281 5.75 15.2502 5.41421 15.2502 5C15.2502 4.58579 14.9281 4.25 14.5308 4.25L8.77567 4.25C8.37836 4.25 8.05628 4.58579 8.05628 5C8.05628 5.41422 8.37836 5.75 8.77567 5.75Z"
                        fill="#2D264B"
                      />
                      <path
                        d="M1.1022 8.25C0.704893 8.25 0.382812 8.58579 0.382812 9C0.382812 9.41421 0.704893 9.75 1.1022 9.75L14.5308 9.75C14.9281 9.75 15.2502 9.41421 15.2502 9C15.2502 8.58579 14.9281 8.25 14.5308 8.25L1.1022 8.25Z"
                        fill="#2D264B"
                      />
                      <path
                        d="M8.77567 13.75L14.5308 13.75C14.9281 13.75 15.2502 13.4142 15.2502 13C15.2502 12.5858 14.9281 12.25 14.5308 12.25L8.77567 12.25C8.37836 12.25 8.05628 12.5858 8.05628 13C8.05628 13.4142 8.37836 13.75 8.77567 13.75Z"
                        fill="#2D264B"
                      />
                    </svg>
                  </button>
                </div>
                {/* TODO: буваник перестарався */}
                {/* <input
                  type="color"
                  value={text.object?.fill || "#000000"}
                  onChange={(e) => {
                    if (text.object) {
                      text.object.set("fill", e.target.value);
                      canvas.renderAll();
                    }
                  }}
                  className={styles.colorPicker}
                /> */}
                <button
                  onClick={() => {
                    setCurrentTextForSymbol(text.object);
                    setShowSymbolModal(true);
                  }}
                  className={styles.symbolButton}
                  title="Додати спеціальний символ"
                >
                  <svg
                    width="15"
                    height="14"
                    viewBox="0 0 15 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8.60118 14V11.892C10.5042 11.388 11.9593 9.416 11.9593 7.01C11.9593 4.213 9.99391 2.003 7.64295 2.003C5.29295 2.003 3.32663 4.213 3.32663 7.01C3.32663 9.415 4.78075 11.386 6.68281 11.891V14H1.88689C1.63212 14 1.38778 13.8945 1.20763 13.7067C1.02748 13.5189 0.92627 13.2641 0.92627 12.9985C0.92627 12.7329 1.02748 12.4782 1.20763 12.2903C1.38778 12.1025 1.63212 11.997 1.88689 11.997H3.26236C2.11806 10.727 1.40826 8.961 1.40826 7.01C1.40826 3.138 4.19948 0 7.64295 0C11.0864 0 13.8776 3.138 13.8776 7.01C13.8776 8.961 13.1678 10.726 12.0235 11.997H13.3971C13.6519 11.997 13.8962 12.1025 14.0764 12.2903C14.2565 12.4782 14.3577 12.7329 14.3577 12.9985C14.3577 13.2641 14.2565 13.5189 14.0764 13.7067C13.8962 13.8945 13.6519 14 13.3971 14H8.60118Z"
                      fill="#0F172A"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (text.object) {
                      canvas.remove(text.object);
                      canvas.renderAll();
                    }
                  }}
                  className={styles.deleteButton}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12.0008 12.0001L14.8292 14.8285M9.17236 14.8285L12.0008 12.0001L9.17236 14.8285ZM14.8292 9.17163L12.0008 12.0001L14.8292 9.17163ZM12.0008 12.0001L9.17236 9.17163L12.0008 12.0001Z"
                      stroke="#FF0000"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                      stroke="#FF0000"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
        <div className={styles.addTextSection}>
          <button onClick={addText} className={styles.addTextButton}>
            <svg
              width="34"
              height="34"
              viewBox="0 0 34 34"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clip-path="url(#clip0_4_570)">
                <path
                  d="M16.6244 17.3167L20.5427 17.3984M16.706 21.2351L16.6244 17.3167L16.706 21.2351ZM16.5428 13.3984L16.6244 17.3167L16.5428 13.3984ZM16.6244 17.3167L12.7061 17.2351L16.6244 17.3167Z"
                  stroke="#017F01"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M23.6951 24.388C27.4409 20.6422 27.3117 14.4397 23.4065 10.5345C19.5012 6.62924 13.2988 6.50005 9.55296 10.2459C5.80711 13.9917 5.93633 20.1941 9.84158 24.0994C13.7468 28.0046 19.9492 28.1338 23.6951 24.388Z"
                  stroke="#009951"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </g>
              <defs>
                <clipPath id="clip0_4_570">
                  <rect
                    width="23.0204"
                    height="24"
                    fill="white"
                    transform="translate(0 16.9707) rotate(-45)"
                  />
                </clipPath>
              </defs>
            </svg>
          </button>
          <input
            type="text"
            value={newTextValue}
            onChange={(e) => setNewTextValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                addText();
              }
            }}
            className={styles.addTextInput}
            placeholder="Add text"
          />
        </div>
      </div>
      {/* Модальне вікно для спеціальних символів */}
      {showSymbolModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Спеціальні символи</h3>
              <button
                onClick={() => setShowSymbolModal(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>
            <div className={styles.symbolGrid}>
              {specialSymbols.map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    addSpecialSymbol(currentTextForSymbol, item.symbol);
                    setShowSymbolModal(false);
                  }}
                  className={styles.symbolItem}
                  title={item.name}
                >
                  {item.symbol}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextList;
