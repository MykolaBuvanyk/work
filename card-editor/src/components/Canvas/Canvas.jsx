import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useCanvasContext } from '../../contexts/CanvasContext';
import styles from './Canvas.module.css';

const VIEWPORT_WIDTH = 860;
const VIEWPORT_HEIGHT = 590;
const MARGIN = 60; // відступ від краю viewport

const Canvas = () => {
  const canvasRef = useRef(null);
  const { setCanvas } = useCanvasContext();

  const [canvasWidth, setCanvasWidth] = useState(1200); // Початковий розмір полотна
  const [canvasHeight, setCanvasHeight] = useState(800);

  const [scale, setScale] = useState(1);

  useEffect(() => {
    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#f5f5f5',
      selection: true,
    });

    setCanvas(canvas);

    const updateCanvasSize = () => {
      setCanvasWidth(canvas.getWidth());
      setCanvasHeight(canvas.getHeight());
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

    // Розрахунок масштабу
    const scaleX = (VIEWPORT_WIDTH - 2 * MARGIN) / canvasWidth;
    const scaleY = (VIEWPORT_HEIGHT - 2 * MARGIN) / canvasHeight;
    const newScale = Math.min(scaleX, scaleY);

    // Масштабуємо
    canvas.setZoom(newScale);
    canvas.setWidth(canvasWidth * newScale);
    canvas.setHeight(canvasHeight * newScale);

    setScale(newScale);

    // Центруємо канвас вручну всередині viewport
    canvas.calcOffset();

    return () => {
      canvas.dispose();
    };
  }, [canvasWidth, canvasHeight, setCanvas]);

  return (
    <div className={styles.viewport}>
      <div className={styles.canvasWrapper}>
        <canvas ref={canvasRef} />
        <div className={styles.widthLabel}>{canvasWidth}px</div>
        <div className={styles.heightLabel}>{canvasHeight}px</div>
      </div>
    </div>
  );
};

export default Canvas;
