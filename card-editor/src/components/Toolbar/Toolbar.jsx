import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import UndoRedo from "../UndoRedo/UndoRedo"; // Імпорт компонента
import styles from "./Toolbar.module.css";
import {
  Icon0,
  Icon1,
  Icon2,
  Icon3,
  Icon4,
  Icon5,
  Icon6,
  Icon7,
  Icon8,
  Icon9,
  Icon10,
  Icon11,
  Icon12,
  Icon13,
  Icon14,
  A1,
  A2,
  A3,
  A4,
  A5,
  A6,
  A7,
  A8,
  A9,
  A10,
  A11,
  A12,
  A13,
  A14,
  Image,
  Upload,
  Shape,
  Border,
  Cut,
  QrCode,
  BarCode,
  Hole1, 
  Hole2, 
  Hole3,
  Hole4, 
  Hole5,
  Hole6,
  Hole7
} from "../../assets/Icons";

const Toolbar = () => {
  const { canvas } = useCanvasContext();
  const [activeObject, setActiveObject] = useState(null);
  const [sizeValues, setSizeValues] = useState({
    width: 150,
    height: 150,
    cornerRadius: 2,
  });
  const [thickness, setThickness] = useState(1.6);
  const [isAdhesiveTape, setIsAdhesiveTape] = useState(false);
  const fileInputRef = useRef(null);

  // Оновлення активного об'єкта та розмірів при зміні
  useEffect(() => {
    if (canvas) {
      canvas.on("selection:created", () => {
        const obj = canvas.getActiveObject();
        setActiveObject(obj);
        if (obj) {
          setSizeValues({
            width: Math.round(obj.width * obj.scaleX),
            height: Math.round(obj.height * obj.scaleY),
            cornerRadius: obj.rx || 0,
          });
        }
      });
      canvas.on("selection:updated", () => {
        const obj = canvas.getActiveObject();
        setActiveObject(obj);
        if (obj) {
          setSizeValues({
            width: Math.round(obj.width * obj.scaleX),
            height: Math.round(obj.height * obj.scaleY),
            cornerRadius: obj.rx || 0,
          });
        }
      });
      canvas.on("selection:cleared", () => {
        setActiveObject(null);
        setSizeValues({ width: 150, height: 150, cornerRadius: 2 });
      });
      canvas.on("object:modified", () => {
        const obj = canvas.getActiveObject();
        if (obj) {
          setSizeValues({
            width: Math.round(obj.width * obj.scaleX),
            height: Math.round(obj.height * obj.scaleY),
            cornerRadius: obj.rx || 0,
          });
        }
      });
    }
    return () => {
      if (canvas) {
        canvas.off("selection:created");
        canvas.off("selection:updated");
        canvas.off("selection:cleared");
        canvas.off("object:modified");
      }
    };
  }, [canvas]);

  // Оновлення розмірів активного об'єкта
  const updateSize = () => {
    if (activeObject) {
      activeObject.set({
        width: sizeValues.width,
        height: sizeValues.height,
        rx: sizeValues.cornerRadius,
        ry: sizeValues.cornerRadius,
      });
      activeObject.scaleToWidth(sizeValues.width);
      activeObject.scaleToHeight(sizeValues.height);
      canvas.renderAll();
    }
  };

  // Оновлення товщини обводки
  const updateThickness = (value) => {
    if (activeObject) {
      activeObject.set({ strokeWidth: value });
      if (isAdhesiveTape) {
        activeObject.set({ stroke: "#888" });
      }
      canvas.renderAll();
    }
  };

  // Зміна кольору
  const updateColor = (color) => {
    if (activeObject) {
      activeObject.set({ fill: color });
      canvas.renderAll();
    }
  };

  // Додавання тексту
  const addText = () => {
    if (canvas) {
      const text = new fabric.IText("Текст", {
        left: 100,
        top: 100,
        fontFamily: "Arial",
        fill: "#000000",
        fontSize: 20,
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.renderAll();
    }
  };

  // Додавання зображення через файловий діалог
  const addImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Покращена функція завантаження зображень
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file && canvas) {
      // Перевіряємо тип файлу
      if (!file.type.startsWith("image/")) {
        alert("Будь ласка, виберіть файл зображення");
        return;
      }

      // Перевіряємо розмір файлу (максимум 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Файл занадто великий. Максимальний розмір: 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          // Використовуємо новий API для fabric.js v6+
          const img = await fabric.FabricImage.fromURL(event.target.result, {
            crossOrigin: "anonymous",
          });

          // Масштабуємо зображення, якщо воно занадто велике
          const maxWidth = 300;
          const maxHeight = 300;

          if (img.width > maxWidth || img.height > maxHeight) {
            const scale = Math.min(
              maxWidth / img.width,
              maxHeight / img.height
            );
            img.scale(scale);
          }

          img.set({
            left: 100,
            top: 100,
            selectable: true,
            hasControls: true,
            hasBorders: true,
          });

          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
        } catch (error) {
          console.error("Помилка завантаження зображення:", error);
          alert("Помилка завантаження зображення");
        }
      };
      reader.onerror = () => {
        alert("Помилка завантаження файлу");
      };
      reader.readAsDataURL(file);
    }

    // Очищаємо input після завантаження
    e.target.value = "";
  };

  // Додавання рамки (border)
  const addBorder = () => {
    if (canvas) {
      const rect = new fabric.Rect({
        left: 50,
        top: 50,
        width: 200,
        height: 150,
        fill: "transparent",
        stroke: "#000",
        strokeWidth: 2,
      });
      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.renderAll();
    }
  };

  // Cut (видалення активного об'єкта)
  const cut = () => {
    if (activeObject) {
      canvas.remove(activeObject);
      setActiveObject(null);
      canvas.renderAll();
    }
  };

  // Додавання QR-коду (placeholder)
  const addQRCode = () => {
    if (canvas) {
      const qr = new fabric.Rect({
        left: 100,
        top: 100,
        width: 80,
        height: 80,
        fill: "#000",
      });
      canvas.add(qr);
      canvas.setActiveObject(qr);
      canvas.renderAll();
    }
  };

  // Додавання бар-коду (placeholder)
  const addBarCode = () => {
    if (canvas) {
      const bar = new fabric.Rect({
        left: 100,
        top: 100,
        width: 100,
        height: 40,
        fill: "#000",
      });
      canvas.add(bar);
      canvas.setActiveObject(bar);
      canvas.renderAll();
    }
  };

  // Додавання отвору
  const addHole = () => {
    if (canvas) {
      const hole = new fabric.Circle({
        left: 100,
        top: 100,
        radius: 5,
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
      });
      canvas.add(hole);
      canvas.setActiveObject(hole);
      canvas.renderAll();
    }
  };

  // Фігури
  const addRectangle = () => {
    if (canvas) {
      const rect = new fabric.Rect({
        left: 100,
        top: 100,
        width: 100,
        height: 100,
        fill: "#A9A9A9",
        stroke: "#000",
        strokeWidth: 1,
      });
      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.renderAll();
    }
  };

  const addCircle = () => {
    if (canvas) {
      const circle = new fabric.Circle({
        left: 100,
        top: 100,
        radius: 50,
        fill: "#FFA500",
        stroke: "#000",
        strokeWidth: 1,
      });
      canvas.add(circle);
      canvas.setActiveObject(circle);
      canvas.renderAll();
    }
  };

  const addHalfCircle = () => {
    if (canvas) {
      const halfCircle = new fabric.Path("M 0 0 Q 50 0 50 50 L 0 50 Z", {
        left: 100,
        top: 100,
        fill: "#800000",
        stroke: "#000",
        strokeWidth: 1,
        scaleX: 1,
        scaleY: 0.5,
      });
      canvas.add(halfCircle);
      canvas.setActiveObject(halfCircle);
      canvas.renderAll();
    }
  };

  const addDiamond = () => {
    if (canvas) {
      const diamond = new fabric.Polygon(
        [
          { x: 0, y: 50 },
          { x: 50, y: 0 },
          { x: 100, y: 50 },
          { x: 50, y: 100 },
        ],
        {
          left: 100,
          top: 100,
          fill: "#DAA520",
          stroke: "#000",
          strokeWidth: 1,
        }
      );
      canvas.add(diamond);
      canvas.setActiveObject(diamond);
      canvas.renderAll();
    }
  };

  const addTriangle = () => {
    if (canvas) {
      const triangle = new fabric.Triangle({
        left: 100,
        top: 100,
        width: 100,
        height: 100,
        fill: "#A52A2A",
        stroke: "#000",
        strokeWidth: 1,
      });
      canvas.add(triangle);
      canvas.setActiveObject(triangle);
      canvas.renderAll();
    }
  };
  const handleInputChange = (key, max, rawValue) => {
    const parsed = parseInt(rawValue);
    const value = Math.max(0, Math.min(max, isNaN(parsed) ? 0 : parsed));
    setSizeValues((prev) => ({ ...prev, [key]: value }));
    updateSize();
  };

  const changeValue = (key, delta, max) => {
    setSizeValues((prev) => {
      const newValue = Math.max(0, Math.min(max, prev[key] + delta));
      const updated = { ...prev, [key]: newValue };
      updateSize();
      return updated;
    });
  };

  return (
    <div className={styles.toolbar}>
      {/* 1. Shape */}
      <div className={styles.section}>
        <div className={styles.numbering}>
          <p>1</p>
        </div>
        <div className={styles.icons}>
          <h3>Shape</h3>
          <span onClick={addRectangle}>{Icon0}</span>
          <span onClick={addCircle}>{Icon1}</span>
          <span onClick={addHalfCircle}>{Icon2}</span>
          <span onClick={addDiamond}>{Icon3}</span>
          <span onClick={addTriangle}>{Icon4}</span>
          <span>{Icon5}</span>
          <span>{Icon6}</span>
          <span>{Icon7}</span>
          <span>{Icon8}</span>
          <span>{Icon9}</span>
          <span>{Icon10}</span>
          <span>{Icon11}</span>
          <span>{Icon12}</span>
          <span>{Icon13}</span>
          <span>{Icon14}</span>
        </div>
      </div>

      {/* 2. Size */}
      <div className={styles.section}>
        <div className={styles.numbering}>
          <p>2</p>
        </div>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>Width</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                value={sizeValues.width}
                onChange={(e) =>
                  handleInputChange("width", 300, e.target.value)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => changeValue("width", 1, 300)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => changeValue("width", -1, 300)}
                />
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label>Corner radius</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                value={sizeValues.cornerRadius}
                onChange={(e) =>
                  handleInputChange("cornerRadius", 10, e.target.value)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => changeValue("cornerRadius", 1, 10)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => changeValue("cornerRadius", -1, 10)}
                />
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label>Height</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                value={sizeValues.height}
                onChange={(e) =>
                  handleInputChange("height", 300, e.target.value)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => changeValue("height", 1, 300)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => changeValue("height", -1, 300)}
                />
              </div>
            </div>
          </div>

          <div className={styles.unitLabel}>* (mm)</div>
        </div>
      </div>

      {/* 3. Thickness */}
      <div className={styles.section}>
        <div className={styles.numbering}>
          <p>3</p>
        </div>
        <div className={styles.thicknessWrapper}>
          <div className={styles.field}>
            <h3>Thickness:</h3>
            <label>1.6</label>
            <input
              type="radio"
              name="thickness"
              value="1.6"
              checked={thickness === 1.6}
              onChange={() => {
                setThickness(1.6);
                updateThickness(1.6);
              }}
            />
          </div>
          <div className={styles.field}>
            <label>0.8</label>
            <input
              type="radio"
              name="thickness"
              value="0.8"
              checked={thickness === 0.8}
              onChange={() => {
                setThickness(0.8);
                updateThickness(0.8);
              }}
            />
          </div>
          <div className="">
            <label>3.2</label>
            <input
              type="radio"
              name="thickness"
              value="3.2"
              checked={thickness === 3.2}
              onChange={() => {
                setThickness(3.2);
                updateThickness(3.2);
              }}
            />
          </div>
          <div className="">
            <label>Adhesive Tape</label>
            <input
              type="checkbox"
              checked={isAdhesiveTape}
              onChange={(e) => {
                setIsAdhesiveTape(e.target.checked);
                updateThickness(thickness);
              }}
            />
          </div>
          <div></div>
          <div className={styles.unitLabel}>* (mm)</div>
        </div>
      </div>

      {/* 4. Colour */}
      <div className={`${styles.section} ${styles.colorSection}`}>
        <div className={styles.colorTitleWrapper}>
          <div className={styles.numbering}>
            <p>4</p>
          </div>
          <h3>Colour</h3>
        </div>
        <div className={styles.colors}>
          <span>{A1}</span>
          <span>{A2}</span>
          <span>{A3}</span>
          <span>{A4}</span>
          <span>{A5}</span>
          <span>{A6}</span>
          <span>{A7}</span>
          <span>{A8}</span>
          <span>{A9}</span>
          <span>{A10}</span>
          <span>{A11}</span>
          <span>{A12}</span>
          <span>{A13}</span>
          <span>{A14}</span>
        </div>
      </div>

      {/* 5. Elements & Tools */}
      <div className={`${styles.section} ${styles.colorSection}`}>
        <div className={styles.numbering}>
          <p>5</p>
        </div>
        <ul className={styles.elementsList}>
          <li className={styles.elementsEl}>
            <span className={styles.elementsSpanWrapper}>
              <span style={{ fontWeight: "bold" }}>A</span>
              <span>Text</span>
            </span>
          </li>
          <li className={styles.elementsEl}>
            <span className={styles.elementsSpanWrapper}>
              {Image}
              <span>Image</span>
            </span>
          </li>
          <li className={styles.elementsEl}>
            <span className={styles.elementsSpanWrapper}>
              {Upload}
              <span>Upload</span>
            </span>
          </li>
          <li className={styles.elementsEl}>
            <span className={styles.elementsSpanWrapper}>
              {Shape}
              <span>Shape</span>
            </span>
          </li>
          <li className={styles.elementsEl}>
            <span className={styles.elementsSpanWrapper}>
              {Border}
              <span>Border</span>
            </span>
          </li>
          <li className={styles.elementsEl}>
            <span className={styles.elementsSpanWrapper}>
              {Cut}
              <span>Cut</span>
            </span>
          </li>
          <li className={styles.elementsEl}>
            <span className={styles.elementsSpanWrapper}>
              {QrCode}
              <span>QR Code</span>
            </span>
          </li>
          <li className={styles.elementsEl}>
            <span className={styles.elementsSpanWrapper}>
              {BarCode}
              <span>Bar Code</span>
            </span>
          </li>
        </ul>
      </div>

      {/* 6. Holes */}
      <div className={`${styles.section} ${styles.colorSection}`}>
        <div className={styles.colorTitleWrapper}>
          <div className={styles.numbering}>
            <p>6</p>
          </div>
          <h3>Holes</h3>
        </div>
        <div className={styles.holes}>
          <span onClick={addHole}>{Hole1}</span>
          <span onClick={addHole}>{Hole2}</span>
          <span onClick={addHole}>{Hole3}</span>
          <span onClick={addHole}>{Hole4}</span>
          <span onClick={addHole}>{Hole5}</span>
          <span onClick={addHole}>{Hole6}</span>
          <span onClick={addHole}>{Hole7}</span>
        </div>
      </div>

      {/* Undo/Redo */}
      <UndoRedo />

      {/* Прихований input для завантаження файлів через іконку камери */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        style={{ display: "none" }}
      />
    </div>
  );
};

export default Toolbar;
