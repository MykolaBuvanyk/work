import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useCanvasContext } from '../../contexts/CanvasContext';
import styles from './Canvas.module.css';

const VIEWPORT_WIDTH = 860;
const VIEWPORT_HEIGHT = 590;
const MARGIN = 60; // відступ від краю viewport

const Canvas = () => {
  const canvasRef = useRef(null);
  const { setCanvas, setActiveObject, setShapePropertiesOpen } = useCanvasContext();

  const [canvasWidth, setCanvasWidth] = useState(1200); // Початковий розмір полотна
  const [canvasHeight, setCanvasHeight] = useState(800);
  
  // Окремі стейти для відображення фактичного розміру полотна в лейблах
  const [displayWidth, setDisplayWidth] = useState(1200);
  const [displayHeight, setDisplayHeight] = useState(800);

  const [scale, setScale] = useState(1);

  useEffect(() => {
    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#f5f5f5',
      selection: true,
    });

    setCanvas(canvas);

    // Додаємо обробники подій
    canvas.on('selection:created', (e) => {
      const selectedObject = e.selected[0];
      if (selectedObject && selectedObject.type === 'path') {
        setActiveObject(selectedObject);
        setShapePropertiesOpen(true);
      }
    });

    canvas.on('selection:updated', (e) => {
      const selectedObject = e.selected[0];
      if (selectedObject && selectedObject.type === 'path') {
        setActiveObject(selectedObject);
        setShapePropertiesOpen(true);
      }
    });

    canvas.on('selection:cleared', () => {
      setActiveObject(null);
      setShapePropertiesOpen(false);
    });

    // Обробник для кліку по об'єкту
    canvas.on('mouse:down', (e) => {
      if (e.target && e.target.type === 'path') {
        setActiveObject(e.target);
        setShapePropertiesOpen(true);
      }
    });

    // Відстежуємо зміни об'єктів (розмір, поворот, позиція)
    canvas.on('object:modified', (e) => {
      if (e.target && e.target.type === 'path') {
        setActiveObject(e.target);
        // Форсуємо оновлення, створюючи новий об'єкт з тими ж властивостями
        setActiveObject({ ...e.target });
      }
    });

    canvas.on('object:scaling', (e) => {
      if (e.target && e.target.type === 'path') {
        setActiveObject({ ...e.target });
      }
    });

    canvas.on('object:rotating', (e) => {
      if (e.target && e.target.type === 'path') {
        setActiveObject({ ...e.target });
      }
    });

    canvas.on('object:moving', (e) => {
      if (e.target && e.target.type === 'path') {
        setActiveObject({ ...e.target });
      }
    });

    const updateCanvasSize = () => {
      setCanvasWidth(canvas.getWidth());
      setCanvasHeight(canvas.getHeight());
      
      // Оновлюємо відображувані розміри (фактичний розмір без урахування масштабу)
      const actualWidth = canvas.getWidth() / canvas.getZoom();
      const actualHeight = canvas.getHeight() / canvas.getZoom();
      setDisplayWidth(Math.round(actualWidth));
      setDisplayHeight(Math.round(actualHeight));
    };

    // Перевизначаємо методи setWidth та setHeight для оновлення стану
    const originalSetWidth = canvas.setWidth.bind(canvas);
    const originalSetHeight = canvas.setHeight.bind(canvas);

    canvas.setWidth = (width) => {
      originalSetWidth(width);
      updateCanvasSize();
    };

    canvas.setHeight = (height) => {
      originalSetHeight(height);
      updateCanvasSize();
    };

    // Додаємо обробники для різних подій, що можуть змінити розмір
    canvas.on('canvas:cleared', updateCanvasSize);
    canvas.on('path:created', updateCanvasSize);
    
    // Початкове оновлення після налаштування canvas
    setTimeout(() => {
      updateCanvasSize();
    }, 100);

    // Розрахунок масштабу
    const scaleX = (VIEWPORT_WIDTH - 2 * MARGIN) / canvasWidth;
    const scaleY = (VIEWPORT_HEIGHT - 2 * MARGIN) / canvasHeight;
    const newScale = Math.min(scaleX, scaleY);

    // Масштабуємо
    canvas.setZoom(newScale);
    canvas.setWidth(canvasWidth * newScale);
    canvas.setHeight(canvasHeight * newScale);

    setScale(newScale);

    // Оновлюємо розміри після встановлення масштабу
    setTimeout(() => {
      updateCanvasSize();
    }, 150);

    // Центруємо канвас вручну всередині viewport
    canvas.calcOffset();

    return () => {
      canvas.dispose();
    };
  }, [canvasWidth, canvasHeight, setCanvas, setActiveObject, setShapePropertiesOpen]);

  // Додатковий useEffect для регулярного оновлення розмірів
  const { canvas } = useCanvasContext();
  
  useEffect(() => {
    if (!canvas) return;
    
    const updateSizes = () => {
      const actualWidth = canvas.getWidth() ;
      const actualHeight = canvas.getHeight();
      setDisplayWidth(Math.round(actualWidth));
      setDisplayHeight(Math.round(actualHeight));
    };

    // Початкове оновлення
    updateSizes();

    // Створюємо інтервал для регулярного оновлення
    const interval = setInterval(updateSizes, 500);

    return () => clearInterval(interval);
  }, [canvas]);

  return (
    <div className={styles.viewport}>
      <div className={styles.canvasWrapper}>
        <canvas ref={canvasRef} className={styles.canvas}/>
        <div className={styles.widthLabel}><span>{displayWidth}px</span></div>
        <div className={styles.heightLabel} style={{ height: `${displayHeight}px`}}><span>{displayHeight}px</span></div>
      </div>
    </div>
  );
};

export default Canvas;
