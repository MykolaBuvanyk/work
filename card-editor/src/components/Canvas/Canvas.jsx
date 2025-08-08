import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useCanvasContext } from '../../contexts/CanvasContext';
import styles from './Canvas.module.css';

// Відступи всередині viewport
const MARGIN = 60;

const DEFAULT_DESIGN = { width: 1200, height: 800 };

const Canvas = () => {
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const designRef = useRef(DEFAULT_DESIGN); // логічний розмір макету без урахування масштабу/DPR
  const { setCanvas, setActiveObject, setShapePropertiesOpen, globalColors, canvas } = useCanvasContext();
  const resizingRef = useRef(false);

  // Для лейблів показуємо фактичний відображуваний (CSS) розмір полотна
  const [displayWidth, setDisplayWidth] = useState(DEFAULT_DESIGN.width); // логічний розмір (текст)
  const [displayHeight, setDisplayHeight] = useState(DEFAULT_DESIGN.height); // логічний розмір (текст)
  const [cssHeight, setCssHeight] = useState(DEFAULT_DESIGN.height); // візуальна висота для лінійки
  const [scale, setScale] = useState(1);

  useEffect(() => {
    // Уникаємо подвійної ініціалізації (React StrictMode)
    if (canvasRef.current && canvasRef.current.__fabricCanvas) {
      try {
        canvasRef.current.__fabricCanvas.dispose();
      } catch {}
      canvasRef.current.__fabricCanvas = undefined;
    }

    const fCanvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#f5f5f5',
      selection: true,
      enableRetinaScaling: true,
    });

    // Зберігаємо посилання на DOM-вузлі для подальших перевірок
    if (canvasRef.current) {
      canvasRef.current.__fabricCanvas = fCanvas;
    }

    setCanvas(fCanvas);

    // Події вибору
    fCanvas.on('selection:created', (e) => {
      const selectedObject = e.selected?.[0];
      if (selectedObject && selectedObject.type === 'path') {
        setActiveObject(selectedObject);
        setShapePropertiesOpen(true);
      }
    });

    fCanvas.on('selection:updated', (e) => {
      const selectedObject = e.selected?.[0];
      if (selectedObject && selectedObject.type === 'path') {
        setActiveObject(selectedObject);
        setShapePropertiesOpen(true);
      }
    });

    fCanvas.on('selection:cleared', () => {
      setActiveObject(null);
      setShapePropertiesOpen(false);
    });

    // Клік по об'єкту
    fCanvas.on('mouse:down', (e) => {
      if (e.target && e.target.type === 'path') {
        setActiveObject(e.target);
        setShapePropertiesOpen(true);
      }
    });

    // Відстеження змін об'єктів
    const mirrorIfPath = (e) => {
      if (e.target && e.target.type === 'path') {
        setActiveObject({ ...e.target });
      }
    };
    fCanvas.on('object:modified', mirrorIfPath);
    fCanvas.on('object:scaling', mirrorIfPath);
    fCanvas.on('object:rotating', mirrorIfPath);
    fCanvas.on('object:moving', mirrorIfPath);

    // Функція масштабування без втрати якості (DPR-aware) з збереженням пропорцій
  const resizeToViewport = () => {
      if (!viewportRef.current) return;

      const { width: baseW, height: baseH } = designRef.current;
  const dpr = window.devicePixelRatio || 1; // базовий DPR

      // Фактичний розмір контейнера (viewport)
      const availW = Math.max(0, viewportRef.current.clientWidth - 2 * MARGIN);
      const availH = Math.max(0, viewportRef.current.clientHeight - 2 * MARGIN);

      // Масштаб по меншій стороні
      const scaleToFit = Math.min(availW / baseW, availH / baseH) || 1;

      // Розмір відображення (CSS px)
      const cssW = Math.max(1, Math.round(baseW * scaleToFit));
      const cssH = Math.max(1, Math.round(baseH * scaleToFit));

  // Підвищуємо ретина-скейл при апскейлі, щоб уникнути розмиття на малих полотнах
  const maxBoost = 4; // ліміт захисту від надмірного споживання пам'яті
  const boost = Math.min(Math.max(1, scaleToFit), maxBoost);
  const effectiveRetina = dpr * boost;
  fCanvas.getRetinaScaling = () => effectiveRetina;

  // Встановлюємо логічний розмір. Fabric з enableRetinaScaling використає наш getRetinaScaling
  resizingRef.current = true;
  originalSetDimensions({ width: baseW, height: baseH });
  resizingRef.current = false;

  // Не масштабуємо через zoom, зберігаємо логіку в 1:1
  fCanvas.setZoom(1);

  // Встановлюємо CSS-розміри одночасно для wrapper/lower/upper
  fCanvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });

  // Експонуємо допоміжні методи для інших компонентів
  fCanvas.getDesignSize = () => ({ width: baseW, height: baseH });
  fCanvas.getCssSize = () => ({ width: cssW, height: cssH });

  setDisplayWidth(baseW);
      setDisplayHeight(baseH);
      setCssHeight(cssH);
      setScale(scaleToFit);

      // Центруємо в межах viewport (wrapper вже по центру, але перерахунок корисний)
      fCanvas.calcOffset();
      fCanvas.renderAll();
    };

    // Перехоплюємо зміну логічних розмірів через setDimensions
    const originalSetDimensions = fCanvas.setDimensions.bind(fCanvas);
    fCanvas.setDimensions = (dimensions, options) => {
      const result = originalSetDimensions(dimensions, options);
      const cssOnly = options && options.cssOnly;
      if (cssOnly) {
        // CSS-only оновлення не змінює логічний розмір
        return result;
      }
      const nextW = dimensions?.width ?? designRef.current.width;
      const nextH = dimensions?.height ?? designRef.current.height;
      if (!resizingRef.current && typeof nextW === 'number' && typeof nextH === 'number') {
        designRef.current = { width: nextW, height: nextH };
        // Після зміни логічного розміру — підженемо під viewport асинхронно, щоб уникнути каскадів
        resizingRef.current = true;
        requestAnimationFrame(() => {
          try {
            resizeToViewport();
          } finally {
            resizingRef.current = false;
          }
        });
      }
      return result;
    };

    // Початковий розрахунок та підписка на ресайз
    resizeToViewport();
    window.addEventListener('resize', resizeToViewport);

    return () => {
      window.removeEventListener('resize', resizeToViewport);
      fCanvas.dispose();
      if (canvasRef.current) {
        canvasRef.current.__fabricCanvas = undefined;
      }
    };
  }, [setCanvas, setActiveObject, setShapePropertiesOpen]);

  // Оновлюємо фон canvas відповідно до глобальних налаштувань
  useEffect(() => {
    if (!canvas) return;
    const bg = globalColors?.backgroundColor || '#FFFFFF';
    canvas.set('backgroundColor', bg);
    canvas.renderAll();
  }, [canvas, globalColors?.backgroundColor]);

  return (
    <div className={styles.viewport} ref={viewportRef}>
      <div className={styles.canvasWrapper}>
        <canvas ref={canvasRef} className={styles.canvas} />
  <div className={styles.widthLabel}><span>{displayWidth}px</span></div>
  <div className={styles.heightLabel} style={{ height: `${cssHeight}px` }}><span>{displayHeight}px</span></div>
      </div>
    </div>
  );
};

export default Canvas;
