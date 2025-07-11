import { useEffect, useRef } from 'react';
import * as fabric from 'fabric'; // Змінено імпорт
import { useCanvasContext } from '../../contexts/CanvasContext';
import styles from './Canvas.module.css';

const Canvas = () => {
  const canvasRef = useRef(null);
  const { setCanvas } = useCanvasContext();

  useEffect(() => {
    // Ініціалізація Fabric.js канвасу
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#f5f5f5',
    });

    // Зберігаємо канвас у контексті
    setCanvas(canvas);

    // Очищення при демонтажі компонента
    return () => {
      canvas.dispose();
    };
  }, [setCanvas]);

  return <canvas ref={canvasRef} className={styles.canvas} />;
};

export default Canvas;