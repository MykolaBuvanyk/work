import React, { useState, useEffect, useRef } from 'react';
import { useCanvasContext } from '../../contexts/CanvasContext';
import * as fabric from 'fabric';
import styles from './TextList.module.css';

const TextList = () => {
  const { canvas } = useCanvasContext();
  const [texts, setTexts] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const isUpdatingRef = useRef(false);

  // Синхронізація текстів з canvas
  useEffect(() => {
    if (canvas) {
      const updateTextList = () => {
        if (isUpdatingRef.current) return;
        
        const allObjects = canvas.getObjects();
        const textObjects = allObjects.filter(obj => 
          obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox'
        );
        
        const textList = textObjects.map(obj => ({
          id: obj.id || `text_${Date.now()}_${Math.random()}`,
          content: obj.text || 'Без тексту',
          object: obj,
          fontSize: obj.fontSize || 20,
          fontFamily: obj.fontFamily || 'Arial',
          fontWeight: obj.fontWeight || 'normal',
          textAlign: obj.textAlign || 'left',
          fill: obj.fill || '#000000'
        }));
        
        // Присвоюємо id об'єктам, якщо їх немає
        textObjects.forEach((obj, index) => {
          if (!obj.id) {
            obj.id = textList[index].id;
          }
        });
        
        setTexts(textList);
      };

      // Початкове оновлення
      updateTextList();

      // Слухачі подій
      const events = [
        'object:added',
        'object:removed',
        'object:modified',
        'text:changed',
        'selection:created',
        'selection:updated'
      ];

      events.forEach(event => {
        canvas.on(event, updateTextList);
      });

      return () => {
        events.forEach(event => {
          canvas.off(event, updateTextList);
        });
      };
    }
  }, [canvas]);

  // Додавання нового тексту
  const addText = () => {
    if (canvas) {
      isUpdatingRef.current = true;
      
      const text = new fabric.IText('Новий текст', {
        left: 100,
        top: 100 + texts.length * 30,
        fontSize: 20,
        fontFamily: 'Arial',
        fontWeight: 'normal',
        textAlign: 'left',
        selectable: true,
        fill: '#000000',
        id: `text_${Date.now()}_${Math.random()}`
      });
      
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.renderAll();
      
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 100);
    }
  };

  // Функція для отримання активного тексту
  const getActiveText = () => {
    if (!canvas) return null;
    const activeObj = canvas.getActiveObject();
    if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'text' || activeObj.type === 'textbox')) {
      return activeObj;
    }
    return null;
  };

  // Зміна розміру шрифту
  const changeFontSize = (size) => {
    const activeText = getActiveText();
    if (activeText) {
      activeText.set('fontSize', size);
      canvas.renderAll();
    }
  };

  // Зміна шрифту
  const changeFontFamily = (family) => {
    const activeText = getActiveText();
    if (activeText) {
      activeText.set('fontFamily', family);
      canvas.renderAll();
    }
  };

  // Перемикання жирного тексту
  const toggleBold = () => {
    const activeText = getActiveText();
    if (activeText) {
      const currentWeight = activeText.fontWeight;
      const newWeight = currentWeight === 'bold' ? 'normal' : 'bold';
      activeText.set('fontWeight', newWeight);
      canvas.renderAll();
    }
  };

  // Перемикання курсиву
  const toggleItalic = () => {
    const activeText = getActiveText();
    if (activeText) {
      const currentStyle = activeText.fontStyle;
      const newStyle = currentStyle === 'italic' ? 'normal' : 'italic';
      activeText.set('fontStyle', newStyle);
      canvas.renderAll();
    }
  };

  // Перемикання підкреслення
  const toggleUnderline = () => {
    const activeText = getActiveText();
    if (activeText) {
      const currentUnderline = activeText.underline;
      activeText.set('underline', !currentUnderline);
      canvas.renderAll();
    }
  };

  // Зміна вирівнювання тексту
  const changeTextAlign = (align) => {
    const activeText = getActiveText();
    if (activeText) {
      activeText.set('textAlign', align);
      canvas.renderAll();
    }
  };

  // Зміна кольору тексту
  const changeTextColor = (color) => {
    const activeText = getActiveText();
    if (activeText) {
      activeText.set('fill', color);
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
    { symbol: '∞', name: 'Безкінечність' },
    { symbol: '→', name: 'Стрілка вправо' },
    { symbol: '←', name: 'Стрілка вліво' },
    { symbol: '↑', name: 'Стрілка вгору' },
    { symbol: '↓', name: 'Стрілка вниз' },
    { symbol: '↔', name: 'Стрілка в обидва боки' },
    { symbol: '⇒', name: 'Подвійна стрілка вправо' },
    { symbol: '⇐', name: 'Подвійна стрілка вліво' },
    { symbol: '⇔', name: 'Подвійна стрілка в обидва боки' },
    { symbol: '≠', name: 'Не дорівнює' },
    { symbol: '≤', name: 'Менше або дорівнює' },
    { symbol: '≥', name: 'Більше або дорівнює' },
    { symbol: '±', name: 'Плюс мінус' },
    { symbol: '×', name: 'Множення' },
    { symbol: '÷', name: 'Ділення' },
    { symbol: '√', name: 'Квадратний корінь' },
    { symbol: '∑', name: 'Сума' },
    { symbol: '∏', name: 'Добуток' },
    { symbol: '∫', name: 'Інтеграл' },
    { symbol: '∂', name: 'Частинна похідна' },
    { symbol: '∇', name: 'Набла' },
    { symbol: 'α', name: 'Альфа' },
    { symbol: 'β', name: 'Бета' },
    { symbol: 'γ', name: 'Гамма' },
    { symbol: 'δ', name: 'Дельта' },
    { symbol: 'ε', name: 'Епсилон' },
    { symbol: 'θ', name: 'Тета' },
    { symbol: 'λ', name: 'Лямбда' },
    { symbol: 'μ', name: 'Мю' },
    { symbol: 'π', name: 'Пі' },
    { symbol: 'σ', name: 'Сигма' },
    { symbol: 'φ', name: 'Фі' },
    { symbol: 'ψ', name: 'Псі' },
    { symbol: 'ω', name: 'Омега мала' },
    { symbol: 'Α', name: 'Альфа велика' },
    { symbol: 'Β', name: 'Бета велика' },
    { symbol: 'Γ', name: 'Гамма велика' },
    { symbol: 'Δ', name: 'Дельта велика' },
    { symbol: 'Θ', name: 'Тета велика' },
    { symbol: 'Λ', name: 'Лямбда велика' },
    { symbol: 'Π', name: 'Пі велика' },
    { symbol: 'Σ', name: 'Сигма велика' },
    { symbol: 'Φ', name: 'Фі велика' },
    { symbol: 'Ψ', name: 'Псі велика' },
    { symbol: 'Ω', name: 'Омега велика' },
    { symbol: '♠', name: 'Піки' },
    { symbol: '♣', name: 'Хрести' },
    { symbol: '♥', name: 'Червоні' },
    { symbol: '♦', name: 'Буби' },
    { symbol: '★', name: 'Зірка' },
    { symbol: '☆', name: 'Зірка порожня' },
    { symbol: '♪', name: 'Нота' },
    { symbol: '♫', name: 'Ноти' },
    { symbol: '©', name: 'Копірайт' },
    { symbol: '®', name: 'Зареєстровано' },
    { symbol: '™', name: 'Торгова марка' },
    { symbol: '°', name: 'Градус' },
    { symbol: '§', name: 'Параграф' },
    { symbol: '¶', name: 'Абзац' },
    { symbol: '•', name: 'Маркер' },
    { symbol: '◦', name: 'Білий маркер' },
    { symbol: '▪', name: 'Чорний квадрат' },
    { symbol: '▫', name: 'Білий квадрат' },
    { symbol: '▲', name: 'Чорний трикутник' },
    { symbol: '△', name: 'Білий трикутник' },
    { symbol: '▼', name: 'Чорний трикутник вниз' },
    { symbol: '▽', name: 'Білий трикутник вниз' },
    { symbol: '◆', name: 'Чорний ромб' },
    { symbol: '◇', name: 'Білий ромб' },
    { symbol: '●', name: 'Чорне коло' },
    { symbol: '○', name: 'Біле коло' },
    { symbol: '■', name: 'Чорний квадрат великий' },
    { symbol: '□', name: 'Білий квадрат великий' }
  ];

  // Додавання спеціального символу до тексту
  const addSpecialSymbol = (textObj, symbol) => {
    if (textObj) {
      const currentText = textObj.text || '';
      const cursorPosition = textObj.selectionStart || currentText.length;
      const newText = currentText.slice(0, cursorPosition) + symbol + currentText.slice(cursorPosition);
      textObj.set('text', newText);
      textObj.selectionStart = cursorPosition + symbol.length;
      textObj.selectionEnd = cursorPosition + symbol.length;
      canvas.renderAll();
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
  const currentFontSize = activeText?.fontSize || 20;
  const currentFontFamily = activeText?.fontFamily || 'Arial';
  const currentFontWeight = activeText?.fontWeight || 'normal';
  const currentFontStyle = activeText?.fontStyle || 'normal';
  const currentUnderline = activeText?.underline || false;
  const currentTextAlign = activeText?.textAlign || 'left';
  const currentColor = activeText?.fill || '#000000';

  return (
    <div className={styles.textListContainer}>
      <div className={styles.addTextSection}>
        <button onClick={addText} className={styles.addTextButton}>
          <span className={styles.addIcon}>+</span>
          Add Text
        </button>
      </div>
      
      <div className={styles.textList}>
        {texts.map((text, index) => (
          <div
            key={text.id}
            className={`${styles.textItem} ${activeText?.id === text.id ? styles.selected : ''}`}
            onClick={() => handleTextSelect(text)}
          >
            <div className={styles.textNumber}>{index + 1}.</div>
            <div className={styles.textContent}>
              <input
                type="text"
                value={text.content}
                onChange={(e) => {
                  if (text.object) {
                    text.object.set('text', e.target.value);
                    canvas.renderAll();
                  }
                }}
                className={styles.textInput}
              />
            </div>
            <div className={styles.textControls}>
              <select
                value={text.object?.fontSize || 20}
                onChange={(e) => {
                  if (text.object) {
                    text.object.set('fontSize', parseInt(e.target.value));
                    canvas.renderAll();
                  }
                }}
                className={styles.fontSizeSelect}
              >
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={12}>12</option>
                <option value={14}>14</option>
                <option value={16}>16</option>
                <option value={18}>18</option>
                <option value={20}>20</option>
                <option value={24}>24</option>
                <option value={28}>28</option>
                <option value={32}>32</option>
                <option value={36}>36</option>
                <option value={48}>48</option>
              </select>
              
              <select
                value={text.object?.fontFamily || 'Arial'}
                onChange={(e) => {
                  if (text.object) {
                    text.object.set('fontFamily', e.target.value);
                    canvas.renderAll();
                  }
                }}
                className={styles.fontFamilySelect}
              >
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
              </select>
              
              <div className={styles.formatButtons}>
                <button
                  onClick={() => {
                    if (text.object) {
                      const currentWeight = text.object.fontWeight;
                      const newWeight = currentWeight === 'bold' ? 'normal' : 'bold';
                      text.object.set('fontWeight', newWeight);
                      canvas.renderAll();
                    }
                  }}
                  className={`${styles.formatButton} ${text.object?.fontWeight === 'bold' ? styles.active : ''}`}
                >
                  B
                </button>
                
                <button
                  onClick={() => {
                    if (text.object) {
                      const currentStyle = text.object.fontStyle;
                      const newStyle = currentStyle === 'italic' ? 'normal' : 'italic';
                      text.object.set('fontStyle', newStyle);
                      canvas.renderAll();
                    }
                  }}
                  className={`${styles.formatButton} ${text.object?.fontStyle === 'italic' ? styles.active : ''}`}
                >
                  I
                </button>
                
                <button
                  onClick={() => {
                    if (text.object) {
                      const currentUnderline = text.object.underline;
                      text.object.set('underline', !currentUnderline);
                      canvas.renderAll();
                    }
                  }}
                  className={`${styles.formatButton} ${text.object?.underline ? styles.active : ''}`}
                >
                  U
                </button>
              </div>
              
              <div className={styles.alignButtons}>
                <button
                  onClick={() => {
                    if (text.object) {
                      text.object.set('textAlign', 'left');
                      canvas.renderAll();
                    }
                  }}
                  className={`${styles.alignButton} ${text.object?.textAlign === 'left' ? styles.active : ''}`}
                >
                  ≡
                </button>
                
                <button
                  onClick={() => {
                    if (text.object) {
                      text.object.set('textAlign', 'center');
                      canvas.renderAll();
                    }
                  }}
                  className={`${styles.alignButton} ${text.object?.textAlign === 'center' ? styles.active : ''}`}
                >
                  ≋
                </button>
                
                <button
                  onClick={() => {
                    if (text.object) {
                      text.object.set('textAlign', 'right');
                      canvas.renderAll();
                    }
                  }}
                  className={`${styles.alignButton} ${text.object?.textAlign === 'right' ? styles.active : ''}`}
                >
                  ≡
                </button>
              </div>
              
              <input
                type="color"
                value={text.object?.fill || '#000000'}
                onChange={(e) => {
                  if (text.object) {
                    text.object.set('fill', e.target.value);
                    canvas.renderAll();
                  }
                }}
                className={styles.colorPicker}
              />
              
              <button
                onClick={() => {
                  setCurrentTextForSymbol(text.object);
                  setShowSymbolModal(true);
                }}
                className={styles.symbolButton}
                title="Додати спеціальний символ"
              >
                Ω
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
                🗑
              </button>
            </div>
          </div>
        ))}
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