import React, { useState, useEffect } from 'react';
import { useCanvasContext } from '../../contexts/CanvasContext';
import * as fabric from 'fabric';
import UndoRedo from '../UndoRedo/UndoRedo'; // Імпорт компонента
import styles from './Toolbar.module.css';

const Toolbar = () => {
  const { canvas } = useCanvasContext();
  const [activeObject, setActiveObject] = useState(null);
  const [sizeValues, setSizeValues] = useState({ width: 150, height: 150, cornerRadius: 2 });
  const [thickness, setThickness] = useState(1.6);
  const [isAdhesiveTape, setIsAdhesiveTape] = useState(false);

  // Оновлення активного об'єкта та розмірів при зміні
  useEffect(() => {
    if (canvas) {
      canvas.on('selection:created', () => {
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
      canvas.on('selection:updated', () => {
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
      canvas.on('selection:cleared', () => {
        setActiveObject(null);
        setSizeValues({ width: 150, height: 150, cornerRadius: 2 });
      });
      canvas.on('object:modified', () => {
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
        canvas.off('selection:created');
        canvas.off('selection:updated');
        canvas.off('selection:cleared');
        canvas.off('object:modified');
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
        activeObject.set({ stroke: '#888' });
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
      const text = new fabric.IText('Текст', {
        left: 100,
        top: 100,
        fontFamily: 'Arial',
        fill: '#000000',
        fontSize: 20,
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.renderAll();
    }
  };

  // Додавання зображення (placeholder)
  const addImage = () => {
    if (canvas) {
      fabric.Image.fromURL('https://via.placeholder.com/100', (img) => {
        img.set({ left: 100, top: 100 });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      });
    }
  };

  // Upload (placeholder)
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file && canvas) {
      const reader = new FileReader();
      reader.onload = (event) => {
        fabric.Image.fromURL(event.target.result, (img) => {
          img.set({ left: 100, top: 100 });
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Додавання рамки (border)
  const addBorder = () => {
    if (canvas) {
      const rect = new fabric.Rect({
        left: 50,
        top: 50,
        width: 200,
        height: 150,
        fill: 'transparent',
        stroke: '#000',
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
        fill: '#000',
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
        fill: '#000',
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
        fill: '#fff',
        stroke: '#000',
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
        fill: '#A9A9A9',
        stroke: '#000',
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
        fill: '#FFA500',
        stroke: '#000',
        strokeWidth: 1,
      });
      canvas.add(circle);
      canvas.setActiveObject(circle);
      canvas.renderAll();
    }
  };

  const addHalfCircle = () => {
    if (canvas) {
      const halfCircle = new fabric.Path('M 0 0 Q 50 0 50 50 L 0 50 Z', {
        left: 100,
        top: 100,
        fill: '#800000',
        stroke: '#000',
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
          fill: '#DAA520',
          stroke: '#000',
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
        fill: '#A52A2A',
        stroke: '#000',
        strokeWidth: 1,
      });
      canvas.add(triangle);
      canvas.setActiveObject(triangle);
      canvas.renderAll();
    }
  };

  return (
    <div className={styles.toolbar}>
      {/* 1. Shape */}
      <div className={styles.section}>
        <h3>Shape</h3>
        <div className={styles.icons}>
          <span onClick={addRectangle}>□</span>
          <span onClick={addCircle}>○</span>
          <span onClick={addHalfCircle}>∟</span>
          <span onClick={addDiamond}>◇</span>
          <span onClick={addTriangle}>△</span>
        </div>
      </div>

      {/* 2. Size */}
      <div className={styles.section}>
        <h3>Size</h3>
        <div>
          <label>Width: {sizeValues.width} <span>(mm)</span></label>
          <input
            type="range"
            min="0"
            max="300"
            value={sizeValues.width}
            onChange={(e) => {
              setSizeValues({ ...sizeValues, width: parseInt(e.target.value) });
              updateSize();
            }}
          />
          <label>Height: {sizeValues.height} <span>(mm)</span></label>
          <input
            type="range"
            min="0"
            max="300"
            value={sizeValues.height}
            onChange={(e) => {
              setSizeValues({ ...sizeValues, height: parseInt(e.target.value) });
              updateSize();
            }}
          />
          <label>Corner radius: {sizeValues.cornerRadius} <span>(mm)</span></label>
          <input
            type="range"
            min="0"
            max="10"
            value={sizeValues.cornerRadius}
            onChange={(e) => {
              setSizeValues({ ...sizeValues, cornerRadius: parseInt(e.target.value) });
              updateSize();
            }}
          />
        </div>
      </div>

      {/* 3. Thickness */}
      <div className={styles.section}>
        <h3>Thickness</h3>
        <div>
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
      </div>

      {/* 4. Colour */}
      <div className={styles.section}>
        <h3>Colour</h3>
        <div className={styles.colors}>
          <span
            style={{ backgroundColor: '#A9A9A9' }}
            onClick={() => updateColor('#A9A9A9')}
          ></span>
          <span
            style={{ backgroundColor: '#FFA500' }}
            onClick={() => updateColor('#FFA500')}
          ></span>
          <span
            style={{ backgroundColor: '#800000' }}
            onClick={() => updateColor('#800000')}
          ></span>
          <span
            style={{ backgroundColor: '#000000' }}
            onClick={() => updateColor('#000000')}
          ></span>
          <span
            style={{ backgroundColor: '#FFFFFF' }}
            onClick={() => updateColor('#FFFFFF')}
          ></span>
          <span
            style={{ backgroundColor: '#808080' }}
            onClick={() => updateColor('#808080')}
          ></span>
          <span
            style={{ backgroundColor: '#A52A2A' }}
            onClick={() => updateColor('#A52A2A')}
          ></span>
          <span
            style={{ backgroundColor: '#DAA520' }}
            onClick={() => updateColor('#DAA520')}
          ></span>
        </div>
      </div>

      {/* 5. Elements & Tools */}
      <div className={styles.section}>
        <h3>Elements</h3>
        <div className={styles.icons}>
          <span onClick={addText}>A</span>
          <span onClick={addImage}>📷</span>
          <label>
            <span>⬆️</span>
            <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
          </label>
          <span onClick={addRectangle}>□</span>
          <span onClick={addBorder}>┃</span>
          <span onClick={cut}>✂️</span>
          <span onClick={addQRCode}>🔳</span>
          <span onClick={addBarCode}>▱</span>
        </div>
      </div>

      {/* 6. Holes */}
      <div className={styles.section}>
        <h3>Holes</h3>
        <div className={styles.holes}>
          <span onClick={addHole}>●</span>
          <span onClick={addHole}>⬤</span>
          <span onClick={addHole}>⬤</span>
          <span onClick={addHole}>⬤</span>
          <span onClick={addHole}>⬤</span>
        </div>
      </div>

      {/* Undo/Redo */}
      <UndoRedo />
    </div>
  );
};

export default Toolbar;