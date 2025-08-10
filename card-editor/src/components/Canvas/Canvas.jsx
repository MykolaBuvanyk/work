// (Corrupted duplicate block removed above – clean implementation below)
import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useCanvasContext } from '../../contexts/CanvasContext';
import styles from './Canvas.module.css';

// Відступи в межах viewport
const MARGIN = 60;
const DEFAULT_DESIGN = { width: 1200, height: 800 };

// Параметри панелі керування
const TOP_PANEL_GAP = 50;           // від рамки до центру кнопок (CSS px)
const BOTTOM_ROTATE_GAP = 54;       // від рамки до центру кнопки обертання
const PANEL_BUTTON_DIAMETER = 24;   // діаметр кнопки
const PANEL_BUTTON_GAP = 8;         // проміжок між кнопками

// Стиль рамки
const OUTLINE_COLOR = 'rgba(21, 157, 255, 1)';
const OUTLINE_WIDTH_CSS = 2;

const Canvas = () => {
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const designRef = useRef(DEFAULT_DESIGN);
  const { setCanvas, setActiveObject, setShapePropertiesOpen, globalColors, canvas } = useCanvasContext();
  const resizingRef = useRef(false);
  const scaleRef = useRef(1);

  const [displayWidth, setDisplayWidth] = useState(DEFAULT_DESIGN.width);
  const [displayHeight, setDisplayHeight] = useState(DEFAULT_DESIGN.height);
  const [cssHeight, setCssHeight] = useState(DEFAULT_DESIGN.height);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    // Guard від подвійної ініціалізації
    if (canvasRef.current && canvasRef.current.__fabricCanvas) {
      try { canvasRef.current.__fabricCanvas.dispose(); } catch {}
      canvasRef.current.__fabricCanvas = undefined;
    }

    const fCanvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#f5f5f5',
      selection: true,
      enableRetinaScaling: true,
    });
    if (canvasRef.current) canvasRef.current.__fabricCanvas = fCanvas;
    setCanvas(fCanvas);

    // Події вибору
    const handleSelection = (e) => {
      const obj = e.selected?.[0];
      if (obj && obj.type === 'path') {
        setActiveObject(obj);
        setShapePropertiesOpen(true);
      }
    };
    fCanvas.on('selection:created', handleSelection);
    fCanvas.on('selection:updated', handleSelection);
    fCanvas.on('selection:cleared', () => { setActiveObject(null); setShapePropertiesOpen(false); });

    fCanvas.on('mouse:down', (e) => {
      if (e.target && e.target.type === 'path') {
        setActiveObject(e.target);
        setShapePropertiesOpen(true);
      }
    });

    const mirrorIfPath = (e) => { if (e.target && e.target.type === 'path') setActiveObject({ ...e.target }); };
    ['object:modified','object:scaling','object:rotating','object:moving'].forEach(evt => fCanvas.on(evt, mirrorIfPath));

    const originalSetDimensions = fCanvas.setDimensions.bind(fCanvas);
    const resizeToViewport = () => {
      if (!viewportRef.current) return;
      const { width: baseW, height: baseH } = designRef.current;
      const dpr = window.devicePixelRatio || 1;
      const availW = Math.max(0, viewportRef.current.clientWidth - 2 * MARGIN);
      const availH = Math.max(0, viewportRef.current.clientHeight - 2 * MARGIN);
      const scaleToFit = Math.min(availW / baseW, availH / baseH) || 1;
      const cssW = Math.max(1, Math.round(baseW * scaleToFit));
      const cssH = Math.max(1, Math.round(baseH * scaleToFit));
      const maxBoost = 4;
      const boost = Math.min(Math.max(1, scaleToFit), maxBoost);
      const effectiveRetina = dpr * boost;
      fCanvas.getRetinaScaling = () => effectiveRetina;
      resizingRef.current = true;
      originalSetDimensions({ width: baseW, height: baseH });
      resizingRef.current = false;
      fCanvas.setZoom(1);
      fCanvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });
      fCanvas.getDesignSize = () => ({ width: baseW, height: baseH });
      fCanvas.getCssSize = () => ({ width: cssW, height: cssH });
      setDisplayWidth(baseW);
      setDisplayHeight(baseH);
      setCssHeight(cssH);
      setScale(scaleToFit);
      scaleRef.current = scaleToFit;
      fCanvas.calcOffset();
      fCanvas.renderAll();
    };

    fCanvas.setDimensions = (dimensions, options) => {
      const result = originalSetDimensions(dimensions, options);
      if (options && options.cssOnly) return result;
      const nextW = dimensions?.width ?? designRef.current.width;
      const nextH = dimensions?.height ?? designRef.current.height;
      if (!resizingRef.current && typeof nextW === 'number' && typeof nextH === 'number') {
        designRef.current = { width: nextW, height: nextH };
        resizingRef.current = true;
        requestAnimationFrame(() => { try { resizeToViewport(); } finally { resizingRef.current = false; } });
      }
      return result;
    };

    resizeToViewport();
    window.addEventListener('resize', resizeToViewport);

    // Рендерери контролів
    const makeIconRenderer = (symbol) => (ctx, left, top) => {
      ctx.save();
      const s = scaleRef.current || 1;
      const r = 12 / s;
      ctx.beginPath();
      ctx.arc(left, top, r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1 / s;
      ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.font = `${16 / s}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, left, top + (1 / s));
      ctx.restore();
    };

    const rotateIconCache = { img: null, loaded: false };
    const renderRotateIcon = (ctx, left, top) => {
      const s = scaleRef.current || 1;
      const size = 37 / s;
      if (!rotateIconCache.img) {
        const svg = `<?xml version="1.0" encoding="UTF-8"?><svg width="37" height="37" viewBox="0 0 37 37" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18.5" cy="18.5" r="18.5" fill="#159DFF"/><path d="M7 17C7 17 10.6963 23 18.4061 23C26.116 23 30 17 30 17M7 17L12.7497 18.875M7 17L8.64279 22.625M30 17L24.2492 18.875M30 17L27.9455 22.625" stroke="white" stroke-width="2"/></svg>`;
        const img = new Image();
        img.onload = () => { rotateIconCache.loaded = true; try { fCanvas.requestRenderAll(); } catch {} };
        img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
        rotateIconCache.img = img;
      }
      const img = rotateIconCache.img;
      if (img && (img.complete || rotateIconCache.loaded)) {
        ctx.save();
        ctx.drawImage(img, left - size / 2, top - size / 2, size, size);
        ctx.restore();
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.arc(left, top, (18.5 / s), 0, Math.PI * 2);
        ctx.fillStyle = '#159DFF';
        ctx.fill();
        ctx.restore();
      }
    };

    const makeDotControl = (actionHandler, cursorStyle) => new fabric.Control({
      cursorStyle,
      actionHandler,
      render: (ctx, left, top) => {
        const s = scaleRef.current || 1;
        const r = 4 / s;
        ctx.save();
        ctx.beginPath();
        ctx.arc(left, top, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(21,157,255,1)';
        ctx.fill();
        ctx.lineWidth = 1 / s;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.restore();
      },
      get sizeX() { return 16 / (scaleRef.current || 1); },
      get sizeY() { return 16 / (scaleRef.current || 1); },
      get touchSizeX() { return 28 / (scaleRef.current || 1); },
      get touchSizeY() { return 28 / (scaleRef.current || 1); },
    });

    const duplicateHandler = (evt, transform) => {
      const target = transform.target; if (!target) return true;
      target.clone((cloned) => { cloned.set({ left: target.left + 10, top: target.top + 10 }); fCanvas.add(cloned); fCanvas.setActiveObject(cloned); fCanvas.requestRenderAll(); });
      return true;
    };
    const deleteHandler = (evt, transform) => { const t = transform.target; if (!t) return true; fCanvas.remove(t); fCanvas.discardActiveObject(); fCanvas.requestRenderAll(); return true; };

    const ensureActionControls = (obj) => {
      if (!obj || !obj.controls) return;
      obj.hasBorders = false;
      if (obj.setControlsVisibility) obj.setControlsVisibility({ tl:false,tr:false,bl:false,br:false,ml:false,mr:false,mt:false,mb:false,mtr:false });
      const cu = fabric.controlsUtils;

      // Axis-aligned bounding box helpers
      const getAABB = (o) => {
        const ac = o.aCoords; if (!ac) return null;
        const xs = [ac.tl.x, ac.tr.x, ac.br.x, ac.bl.x];
        const ys = [ac.tl.y, ac.tr.y, ac.br.y, ac.bl.y];
        return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
      };
      const corner = (which) => (dim, m, o) => { const b = getAABB(o); if (!b) return new fabric.Point(0,0); return new fabric.Point(which.includes('l')?b.minX:b.maxX, which.includes('t')?b.minY:b.maxY); };
      const mid = (axis) => (dim,m,o) => { const b=getAABB(o); if(!b) return new fabric.Point(0,0); if(axis==='x') return new fabric.Point((b.minX+b.maxX)/2,b.minY); if(axis==='x2') return new fabric.Point((b.minX+b.maxX)/2,b.maxY); if(axis==='y') return new fabric.Point(b.minX,(b.minY+b.maxY)/2); return new fabric.Point(b.maxX,(b.minY+b.maxY)/2); };
      const topCenterPos = (dim,m,o) => { const b=getAABB(o); if(!b) return new fabric.Point(0,0); const s=scaleRef.current||1; return new fabric.Point((b.minX+b.maxX)/2, b.minY - TOP_PANEL_GAP / s); };
      const bottomCenterPos = (dim,m,o) => { const b=getAABB(o); if(!b) return new fabric.Point(0,0); const s=scaleRef.current||1; return new fabric.Point((b.minX+b.maxX)/2, b.maxY + BOTTOM_ROTATE_GAP / s); };

      // 4 кути
      obj.controls.tlc = makeDotControl(cu.scalingEqually, 'nwse-resize'); obj.controls.tlc.positionHandler = corner('lt');
      obj.controls.trc = makeDotControl(cu.scalingEqually, 'nesw-resize'); obj.controls.trc.positionHandler = corner('rt');
      obj.controls.blc = makeDotControl(cu.scalingEqually, 'nesw-resize'); obj.controls.blc.positionHandler = corner('lb');
      obj.controls.brc = makeDotControl(cu.scalingEqually, 'nwse-resize'); obj.controls.brc.positionHandler = corner('rb');
      // 4 середини
      obj.controls.mtc = makeDotControl(cu.scalingY, 'ns-resize'); obj.controls.mtc.positionHandler = mid('x');
      obj.controls.mbc = makeDotControl(cu.scalingY, 'ns-resize'); obj.controls.mbc.positionHandler = mid('x2');
      obj.controls.mlc = makeDotControl(cu.scalingX, 'ew-resize'); obj.controls.mlc.positionHandler = mid('y');
      obj.controls.mrc = makeDotControl(cu.scalingX, 'ew-resize'); obj.controls.mrc.positionHandler = mid('y2');

      // Панель з 5 кнопок
      const BUTTONS = [
        { key:'delete', icon:'🗑', handler: deleteHandler, cursor:'pointer' },
        { key:'duplicate', icon:'⧉', handler: duplicateHandler, cursor:'copy' },
        { key:'stub1', icon:'A', handler: () => {}, cursor:'default' },
        { key:'stub2', icon:'B', handler: () => {}, cursor:'default' },
        { key:'stub3', icon:'C', handler: () => {}, cursor:'default' },
      ];
      const count = BUTTONS.length;
      const step = PANEL_BUTTON_DIAMETER + PANEL_BUTTON_GAP;
      const centerIndex = (count - 1) / 2;
      BUTTONS.forEach((btn, idx) => {
        const cssOffsetX = (idx - centerIndex) * step; // desired CSS px offset from center
        const positionHandler = (dim, m, o) => {
          const base = topCenterPos(dim, m, o); // center point of the panel line
          const s = scaleRef.current || 1;
          return new fabric.Point(base.x + cssOffsetX / s, base.y);
        };
        obj.controls['panel_'+btn.key] = new fabric.Control({
          positionHandler,
          cursorStyle: btn.cursor,
          mouseUpHandler: (evt, transform) => { btn.handler(evt, transform); return true; },
          render: makeIconRenderer(btn.icon),
          // Static size at creation time; could be turned into getters if dynamic resizing after viewport change is needed
          sizeX: PANEL_BUTTON_DIAMETER / (scaleRef.current || 1),
          sizeY: PANEL_BUTTON_DIAMETER / (scaleRef.current || 1),
        });
      });

      // Кнопка обертання
      obj.controls.rotatec = new fabric.Control({
        positionHandler: bottomCenterPos,
        cursorStyle: 'crosshair',
        actionName: 'rotate',
        actionHandler: fabric.controlsUtils.rotationWithSnapping,
        render: renderRotateIcon,
        sizeX: 36 / (scaleRef.current || 1),
        sizeY: 36 / (scaleRef.current || 1),
      });
    };

    fCanvas.on('selection:created', e => { const o=e.selected?.[0]; if(o){ ensureActionControls(o); fCanvas.requestRenderAll(); }});
    fCanvas.on('selection:updated', e => { const o=e.selected?.[0]; if(o){ ensureActionControls(o); fCanvas.requestRenderAll(); }});

    // Top overlay: рамка та фон панелі
    const clearTop = () => {
      const ctx = fCanvas.getTopContext ? fCanvas.getTopContext() : fCanvas.contextTop; if(!ctx) return;
      ctx.clearRect(0,0,fCanvas.getWidth(), fCanvas.getHeight());
      // Малюємо фон панелі ДО того, як Fabric намалює контролы (щоб кнопки були поверх)
      const active = fCanvas.getActiveObject(); if(!active) return;
      const ac = active.aCoords; if(!ac) return;
      const xs=[ac.tl.x,ac.tr.x,ac.br.x,ac.bl.x]; const ys=[ac.tl.y,ac.tr.y,ac.br.y,ac.bl.y];
      const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
      const rect={ left:minX, top: minY, width:maxX-minX, height:maxY-minY };
      const s = scaleRef.current || 1;
      const panelWidthCss = 163; // задано користувачем
      const panelHeightCss = 33; // задано користувачем
      const panelWidth = panelWidthCss / s;
      const panelHeight = panelHeightCss / s;
      const panelCenterX = rect.left + rect.width/2;
      const panelCenterY = rect.top - (TOP_PANEL_GAP / s);
      const panelLeft = panelCenterX - panelWidth/2;
      const panelTop = panelCenterY - panelHeight/2;
      const r = 4 / s; // border-radius 4px
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = 1 / s; // border-width 1px
      ctx.beginPath();
      ctx.moveTo(panelLeft + r, panelTop);
      ctx.lineTo(panelLeft + panelWidth - r, panelTop);
      ctx.quadraticCurveTo(panelLeft + panelWidth, panelTop, panelLeft + panelWidth, panelTop + r);
      ctx.lineTo(panelLeft + panelWidth, panelTop + panelHeight - r);
      ctx.quadraticCurveTo(panelLeft + panelWidth, panelTop + panelHeight, panelLeft + panelWidth - r, panelTop + panelHeight);
      ctx.lineTo(panelLeft + r, panelTop + panelHeight);
      ctx.quadraticCurveTo(panelLeft, panelTop + panelHeight, panelLeft, panelTop + panelHeight - r);
      ctx.lineTo(panelLeft, panelTop + r);
      ctx.quadraticCurveTo(panelLeft, panelTop, panelLeft + r, panelTop);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    const drawFrameOverlay = () => {
      const active = fCanvas.getActiveObject();
      const ctx = fCanvas.getTopContext ? fCanvas.getTopContext() : fCanvas.contextTop; if(!ctx || !active) return;
      const ac = active.aCoords; if(!ac) return;
      const xs=[ac.tl.x,ac.tr.x,ac.br.x,ac.bl.x]; const ys=[ac.tl.y,ac.tr.y,ac.br.y,ac.bl.y];
      const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
      const s = scaleRef.current || 1;
      ctx.save();
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = OUTLINE_WIDTH_CSS / s;
      ctx.setLineDash([]);
      ctx.strokeRect(minX, minY, maxX-minX, maxY-minY);
      ctx.restore();
    };
    fCanvas.on('before:render', clearTop);
    fCanvas.on('after:render', drawFrameOverlay);

    return () => {
      window.removeEventListener('resize', resizeToViewport);
  fCanvas.off('before:render', clearTop);
  fCanvas.off('after:render', drawFrameOverlay);
      fCanvas.dispose();
      if (canvasRef.current) canvasRef.current.__fabricCanvas = undefined;
    };
  }, [setCanvas, setActiveObject, setShapePropertiesOpen]);

  useEffect(() => {
    if (!canvas) return;
    canvas.set('backgroundColor', globalColors?.backgroundColor || '#FFFFFF');
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
