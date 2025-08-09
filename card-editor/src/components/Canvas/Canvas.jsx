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
  const scaleRef = useRef(1); // для конвертації CSS px у логічні px
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
  scaleRef.current = scaleToFit;

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

  // Кнопки Duplicate/Delete над виділеним об'єктом як кастомні контролли
    const makeIconRenderer = (symbol) => (ctx, left, top) => {
      ctx.save();
      const scale = scaleRef.current || 1;
      const r = 12 / scale; // фіксований розмір у CSS px
      ctx.beginPath();
      ctx.arc(left, top, r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.font = `${16 / scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, left, top + (1 / scale));
      ctx.restore();
    };

    // Рендер іконки обертання (використовуємо наданий SVG, кешуємо Image)
    const rotateIconCache = { img: null, loaded: false };
    const renderRotateIcon = (ctx, left, top) => {
      const scale = scaleRef.current || 1;
      const size = 37 / scale;
      if (!rotateIconCache.img) {
        const svg = `<?xml version="1.0" encoding="UTF-8"?><svg width="37" height="37" viewBox="0 0 37 37" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18.5" cy="18.5" r="18.5" fill="#159DFF"/><path d="M7 17C7 17 10.6963 23 18.4061 23C26.116 23 30 17 30 17M7 17L12.7497 18.875M7 17L8.64279 22.625M30 17L24.2492 18.875M30 17L27.9455 22.625" stroke="white" stroke-width="2"/></svg>`;
        const img = new Image();
        img.onload = () => {
          rotateIconCache.loaded = true;
          try { fCanvas.requestRenderAll(); } catch {}
        };
        img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
        rotateIconCache.img = img;
      }
      const img = rotateIconCache.img;
      if (img && (img.complete || rotateIconCache.loaded)) {
        ctx.save();
        ctx.drawImage(img, left - size / 2, top - size / 2, size, size);
        ctx.restore();
      } else {
        // запасний варіант - синє коло
        ctx.save();
        ctx.beginPath();
        ctx.arc(left, top, (18.5 / scale), 0, Math.PI * 2);
        ctx.fillStyle = '#159DFF';
        ctx.fill();
        ctx.restore();
      }
    };

    // Круглі точки-ручки для розтягування
    const makeDotControl = (x, y, actionHandler, cursorStyle = 'nwse-resize') => {
      return new fabric.Control({
  x, y,
        cursorStyle,
        actionHandler,
        render: (ctx, left, top) => {
          const scale = scaleRef.current || 1;
          const r = 4 / scale; // радіус точки у CSS px
          ctx.save();
          ctx.beginPath();
          ctx.arc(left, top, r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(21, 157, 255, 1)';
          ctx.fill();
          ctx.lineWidth = 1 / scale;
          ctx.strokeStyle = '#fff';
          ctx.stroke();
          ctx.restore();
        },
        sizeX: 16, sizeY: 16,
        get sizeX() { return 16 / (scaleRef.current || 1); },
        get sizeY() { return 16 / (scaleRef.current || 1); },
        get touchSizeX() { return 28 / (scaleRef.current || 1); },
        get touchSizeY() { return 28 / (scaleRef.current || 1); },
      });
    };

    const duplicateHandler = (evt, transform) => {
      const target = transform.target;
      if (!target) return true;
      target.clone((cloned) => {
        cloned.set({ left: target.left + 10, top: target.top + 10 });
        fCanvas.add(cloned);
        fCanvas.setActiveObject(cloned);
        fCanvas.requestRenderAll();
      });
      return true;
    };

    const deleteHandler = (evt, transform) => {
      const target = transform.target;
      if (!target) return true;
      fCanvas.remove(target);
      fCanvas.discardActiveObject();
      fCanvas.requestRenderAll();
      return true;
    };

    const ensureActionControls = (obj) => {
      if (!obj || !obj.controls) return;
      // Прибираємо рамку і ховаємо стандартні контролли, але не ламаємо їхню карту
      obj.hasBorders = false;
      if (typeof obj.setControlsVisibility === 'function') {
        obj.setControlsVisibility({ tl:false, tr:false, bl:false, br:false, ml:false, mr:false, mt:false, mb:false, mtr:false });
      }
      const scale = scaleRef.current || 1;

      // Позиції кутів синьої рамки (AABB за aCoords)
      const getAABB = (o) => {
        const ac = o.aCoords;
        const xs = [ac.tl.x, ac.tr.x, ac.br.x, ac.bl.x];
        const ys = [ac.tl.y, ac.tr.y, ac.br.y, ac.bl.y];
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        return { minX, minY, maxX, maxY };
      };
      const posTL = (dim, finalMatrix, o, control) => {
        const { minX, minY } = getAABB(o); return new fabric.Point(minX, minY);
      };
      const posTR = (dim, finalMatrix, o, control) => {
        const { maxX, minY } = getAABB(o); return new fabric.Point(maxX, minY);
      };
      const posBL = (dim, finalMatrix, o, control) => {
        const { minX, maxY } = getAABB(o); return new fabric.Point(minX, maxY);
      };
      const posBR = (dim, finalMatrix, o, control) => {
        const { maxX, maxY } = getAABB(o); return new fabric.Point(maxX, maxY);
      };
      const cu = fabric.controlsUtils;
      // Кути синьої рамки (4 точки)
      obj.controls.tlc = makeDotControl(undefined, undefined, cu.scalingEqually, 'nwse-resize');
      obj.controls.tlc.positionHandler = posTL;
      obj.controls.trc = makeDotControl(undefined, undefined, cu.scalingEqually, 'nesw-resize');
      obj.controls.trc.positionHandler = posTR;
      obj.controls.blc = makeDotControl(undefined, undefined, cu.scalingEqually, 'nesw-resize');
      obj.controls.blc.positionHandler = posBL;
      obj.controls.brc = makeDotControl(undefined, undefined, cu.scalingEqually, 'nwse-resize');
      obj.controls.brc.positionHandler = posBR;

      // Кнопки панелі над синьою рамкою (завжди зверху від AABB)
      const topCenterPos = (dim, finalMatrix, o, control) => {
        const { minX, maxX, minY } = getAABB(o);
        return new fabric.Point((minX + maxX) / 2, minY);
      };
      obj.controls.duplicate = new fabric.Control({
        positionHandler: topCenterPos,
        offsetY: -24 / scale,
        offsetX: -18 / scale,
        cursorStyle: 'copy',
        mouseUpHandler: duplicateHandler,
        render: makeIconRenderer('⧉'),
        sizeX: 24 / scale,
        sizeY: 24 / scale,
      });
      obj.controls.remove = new fabric.Control({
        positionHandler: topCenterPos,
        offsetY: -24 / scale,
        offsetX: 18 / scale,
        cursorStyle: 'pointer',
        mouseUpHandler: deleteHandler,
        render: makeIconRenderer('🗑'),
        sizeX: 24 / scale,
        sizeY: 24 / scale,
      });

      // Кнопка обертання під синьою рамкою (завжди знизу від AABB)
      const bottomCenterPos = (dim, finalMatrix, o, control) => {
        const { minX, maxX, maxY } = getAABB(o);
        return new fabric.Point((minX + maxX) / 2, maxY);
      };
      obj.controls.rotatec = new fabric.Control({
        positionHandler: bottomCenterPos,
        offsetY: 28 / scale,
        cursorStyle: 'crosshair',
        actionName: 'rotate',
        actionHandler: fabric.controlsUtils.rotationWithSnapping,
        render: renderRotateIcon,
        sizeX: 36 / scale,
        sizeY: 36 / scale,
      });
    };

    fCanvas.on('selection:created', (e) => {
      const obj = e.selected?.[0];
      if (obj) {
        ensureActionControls(obj);
        fCanvas.requestRenderAll();
      }
    });
    fCanvas.on('selection:updated', (e) => {
      const obj = e.selected?.[0];
      if (obj) {
        ensureActionControls(obj);
        fCanvas.requestRenderAll();
      }
    });

    // Кастомна рамка виділення з постійною товщиною в CSS px
  const OUTLINE_COLOR = 'rgba(21, 157, 255, 1)';
  const OUTLINE_WIDTH_CSS = 2; // px суцільна лінія
    const clearTop = () => {
      const ctx = (typeof fCanvas.getTopContext === 'function') ? fCanvas.getTopContext() : fCanvas.contextTop;
      if (!ctx) return;
      const w = fCanvas.getWidth();
      const h = fCanvas.getHeight();
      ctx.clearRect(0, 0, w, h);
    };
  const drawSelectionOutline = () => {
      const active = fCanvas.getActiveObject();
      const ctx = (typeof fCanvas.getTopContext === 'function') ? fCanvas.getTopContext() : fCanvas.contextTop;
      if (!ctx) return;
      // Топ-контекст очищаємо окремо, щоб не лишався слід
      // (це безпечно, бо ми малюємо тільки свою рамку й іконки рендеряться іншою гілкою)
      // Примітка: якщо у майбутньому додасте інші малюнки на top, координуйте порядок подій.
      // clearTop(); // якщо треба повне очищення саме тут
      if (!active) return;
      // Відімкнути обертання рамки: беремо axis-aligned bounds у світових координатах
      const aCoords = active.aCoords; // TL, TR, BR, BL в світових координатах
      let rect;
      if (aCoords) {
        const xs = [aCoords.tl.x, aCoords.tr.x, aCoords.br.x, aCoords.bl.x];
        const ys = [aCoords.tl.y, aCoords.tr.y, aCoords.br.y, aCoords.bl.y];
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        rect = { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
      } else {
        rect = active.getBoundingRect(true, true);
      }
      if (!rect) return;
      const scale = scaleRef.current || 1;
      const lw = OUTLINE_WIDTH_CSS / scale;
      ctx.save();
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = lw;
  ctx.setLineDash([]);
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
      ctx.restore();
    };
    fCanvas.on('before:render', clearTop);
    fCanvas.on('after:render', drawSelectionOutline);

    return () => {
      window.removeEventListener('resize', resizeToViewport);
  fCanvas.off('before:render', clearTop);
  fCanvas.off('after:render', drawSelectionOutline);
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
