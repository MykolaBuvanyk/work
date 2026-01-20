// (Corrupted duplicate block removed above – clean implementation below)
import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import JsBarcode from 'jsbarcode';
import { useCanvasContext } from '../../contexts/CanvasContext';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useCanvasPropertiesTracker } from '../../hooks/useCanvasPropertiesTracker';
import styles from './Canvas.module.css';
import {
  buildQrSvgMarkup,
  computeQrVectorData,
  decorateQrGroup,
  DEFAULT_QR_CELL_SIZE,
} from '../../utils/qrFabricUtils';
import { ensureShapeSvgId } from '../../utils/shapeSvgId';

// Відступи в межах viewport
const MARGIN = 40;
const DEFAULT_DESIGN = { width: 340.5, height: 227 };
// Unit conversion (96 DPI)
const PX_PER_MM = 72 / 25.4;
const pxToMm = px => (typeof px === 'number' ? px / PX_PER_MM : 0);
const LOCK_ARCH_HEIGHT_MM = 8;

// Параметри панелі керування
const TOP_PANEL_GAP = 25; // від рамки до центру кнопок (CSS px)
const BOTTOM_ROTATE_GAP = 25; // від рамки до центру кнопки обертання
const PANEL_BUTTON_DIAMETER = 24; // діаметр кнопки
const PANEL_BUTTON_GAP = 8; // проміжок між кнопками

// Стиль рамки: використовуємо акцентний синій як в інших компонентах
const OUTLINE_COLOR = 'rgba(0, 108, 164, 1)'; // #006CA4
const OUTLINE_WIDTH_CSS = 2;

const Canvas = ({ className }) => {
  const canvasRef = useRef(null);
  const shadowHostRef = useRef(null);
  const outlineHostRef = useRef(null);
  const viewportRef = useRef(null);
  const designRef = useRef(DEFAULT_DESIGN);
  const {
    setCanvas,
    setActiveObject,
    setShapePropertiesOpen,
    isCustomShapeMode,
    globalColors,
    canvas,
    canvasShapeType,
  } = useCanvasContext();

  // Undo/Redo функціонал
  const { saveCanvasPropertiesState } = useUndoRedo(canvas);

  // Відстеження змін властивостей полотна
  const { trackCanvasResize, trackViewportChange } = useCanvasPropertiesTracker(
    canvas,
    globalColors,
    saveCanvasPropertiesState
  );

  // Local UI state for labels and CSS box
  const [displayWidth, setDisplayWidth] = useState(DEFAULT_DESIGN.width);
  const [displayHeight, setDisplayHeight] = useState(DEFAULT_DESIGN.height);
  const [cssHeight, setCssHeight] = useState(DEFAULT_DESIGN.height);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const resizingRef = useRef(false);
  const outlineColorRef = useRef(OUTLINE_COLOR);

  // Main Fabric canvas lifecycle
  useEffect(() => {
    // Guard від подвійної ініціалізації
    if (canvasRef.current && canvasRef.current.__fabricCanvas) {
      try {
        canvasRef.current.__fabricCanvas.dispose();
      } catch {}
    }

    const fCanvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#f5f5f5',
      selection: true,
    });
    // Утилиты: скрыть/показать hiddenTextarea Fabric, чтобы не мигал нативный курсор
    const applyHiddenTextareaStyle = ta => {
      try {
        ta.style.caretColor = 'transparent';
        ta.style.color = 'transparent';
        ta.style.background = 'transparent';
        ta.style.border = '0';
        ta.style.outline = 'none';
        ta.style.position = 'fixed'; // вне потока, чтобы не мелькала
        ta.style.top = '-10000px';
        ta.style.left = '-10000px';
        ta.style.width = '0';
        ta.style.height = '0';
        ta.style.opacity = '0';
        ta.style.pointerEvents = 'none';
      } catch {}
    };
    const clearHiddenTextareaStyle = ta => {
      try {
        ta.removeAttribute('style');
      } catch {}
    };
    const enforceHideCaretIfEditing = () => {
      try {
        const obj = fCanvas.getActiveObject && fCanvas.getActiveObject();
        if (
          obj &&
          (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') &&
          obj.isEditing &&
          obj.hiddenTextarea
        ) {
          try {
            obj.hiddenTextarea.setAttribute('data-fabric-hidden-textarea', '1');
          } catch {}
          applyHiddenTextareaStyle(obj.hiddenTextarea);
        }
      } catch {}
    };
    if (canvasRef.current) canvasRef.current.__fabricCanvas = fCanvas;
    setCanvas(fCanvas);

    // Події вибору
    const isHole = o => !!o && o.isCutElement && o.cutType === 'hole';
    const isCut = o => !!o && o.isCutElement === true;
    const isShapeWithProps = o =>
      !!o && ['path', 'rect', 'circle', 'ellipse'].includes(o.type) && !isHole(o);

    const isTextObj = o => !!o && ['i-text', 'text', 'textbox'].includes(o.type);

    const isFromIconMenu = o =>
      !!o && (o.fromIconMenu === true || (o.data && o.data.fromIconMenu === true));

    const bringCanvasObjectToFront = target => {
      if (!target) return;
      if (typeof fCanvas.bringToFront === 'function') {
        fCanvas.bringToFront(target);
      } else if (typeof fCanvas.bringObjectToFront === 'function') {
        fCanvas.bringObjectToFront(target);
      } else if (typeof target.bringToFront === 'function') {
        target.bringToFront();
      }
    };

    const bringAllTextsToFront = () => {
      try {
        const texts = (fCanvas.getObjects?.() || []).filter(isTextObj);
        texts.forEach(t => bringCanvasObjectToFront(t));
      } catch {}
    };

    // Snapping (auto-alignment) while dragging: snap to other objects' edges/centers + show blue guide lines
    // Smaller threshold + soft pull to make snapping less aggressive
    const SNAP_THRESHOLD_CSS_PX = 6; // perceived threshold in screen px
    const SNAP_HARD_THRESHOLD_CSS_PX = 3; // within this: snap exactly
    const SNAP_SOFT_STRENGTH = 0.6; // outside hard threshold: apply part of delta
    const getSnapThreshold = () => {
      const s = scaleRef.current || 1;
      return SNAP_THRESHOLD_CSS_PX / Math.max(1e-6, s);
    };
    const getSnapHardThreshold = () => {
      const s = scaleRef.current || 1;
      return SNAP_HARD_THRESHOLD_CSS_PX / Math.max(1e-6, s);
    };
    const applySnapDelta = delta => {
      const d = Number(delta) || 0;
      if (!d) return 0;
      const hard = getSnapHardThreshold();
      if (Math.abs(d) <= hard) return d;
      return d * SNAP_SOFT_STRENGTH;
    };
    const isSnappingCandidate = o => {
      if (!o) return false;
      if (o.isBorderShape || o.isBorderMask || o.isCanvasOutline) return false;
      if (isHole(o)) return false;
      // Skip non-interactive service objects (fabric uses `evented=false` often)
      if (o.evented === false && o.selectable === false) return false;
      return true;
    };
    const getAABB = o => {
      if (!o) return null;
      try {
        if (typeof o.setCoords === 'function') o.setCoords();
      } catch {}
      try {
        if (typeof o.getBoundingRect === 'function') {
          const b = o.getBoundingRect(true, true);
          if (!b) return null;
          const minX = Number(b.left) || 0;
          const minY = Number(b.top) || 0;
          const maxX = minX + (Number(b.width) || 0);
          const maxY = minY + (Number(b.height) || 0);
          return {
            minX,
            minY,
            maxX,
            maxY,
            midX: (minX + maxX) / 2,
            midY: (minY + maxY) / 2,
          };
        }
      } catch {}
      const ac = o.aCoords;
      if (!ac || !ac.tl || !ac.tr || !ac.br || !ac.bl) return null;
      const xs = [ac.tl.x, ac.tr.x, ac.br.x, ac.bl.x];
      const ys = [ac.tl.y, ac.tr.y, ac.br.y, ac.bl.y];
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        minX,
        minY,
        maxX,
        maxY,
        midX: (minX + maxX) / 2,
        midY: (minY + maxY) / 2,
      };
    };
    const computeDragSnap = target => {
      if (!target) return { dx: 0, dy: 0, guides: null };
      if (!isSnappingCandidate(target)) return { dx: 0, dy: 0, guides: null };
      if (target.lockMovementX && target.lockMovementY) return { dx: 0, dy: 0, guides: null };

      const thr = getSnapThreshold();
      const tb = getAABB(target);
      if (!tb) return { dx: 0, dy: 0, guides: null };

      const tX = [tb.minX, tb.midX, tb.maxX];
      const tY = [tb.minY, tb.midY, tb.maxY];

      let bestDx = 0;
      let bestDy = 0;
      let bestAbsDx = Infinity;
      let bestAbsDy = Infinity;
      let guideX = null;
      let guideY = null;

      const objs = (fCanvas.getObjects?.() || []).filter(
        o => o && o !== target && isSnappingCandidate(o)
      );

      for (const o of objs) {
        const ob = getAABB(o);
        if (!ob) continue;
        const oX = [ob.minX, ob.midX, ob.maxX];
        const oY = [ob.minY, ob.midY, ob.maxY];

        for (const tx of tX) {
          for (const ox of oX) {
            const dx = ox - tx;
            const adx = Math.abs(dx);
            if (adx <= thr && adx < bestAbsDx) {
              bestAbsDx = adx;
              bestDx = dx;
              guideX = ox;
            }
          }
        }

        for (const ty of tY) {
          for (const oy of oY) {
            const dy = oy - ty;
            const ady = Math.abs(dy);
            if (ady <= thr && ady < bestAbsDy) {
              bestAbsDy = ady;
              bestDy = dy;
              guideY = oy;
            }
          }
        }
      }

      const guides =
        guideX != null || guideY != null
          ? {
              x: guideX,
              y: guideY,
            }
          : null;

      return {
        dx: Number.isFinite(bestDx) && bestAbsDx !== Infinity ? bestDx : 0,
        dy: Number.isFinite(bestDy) && bestAbsDy !== Infinity ? bestDy : 0,
        guides,
      };
    };

    const isNearRightAngle = (ang, tolDeg = 2) => {
      const a = normalizeDeg(ang || 0);
      const candidates = [0, 90, 180, 270];
      return candidates.some(c => Math.abs(a - c) <= tolDeg);
    };
    const computeScaleSnap = (target, corner) => {
      if (!target) return { dxEdge: 0, dyEdge: 0, guides: null };
      if (!isSnappingCandidate(target)) return { dxEdge: 0, dyEdge: 0, guides: null };
      // Keep it predictable: only snap resizing when angle is close to 0/90/180/270
      if (!isNearRightAngle(target.angle, 2)) return { dxEdge: 0, dyEdge: 0, guides: null };

      const c = String(corner || '');
      const affectsX = c.includes('l') || c.includes('r');
      const affectsY = c.includes('t') || c.includes('b');
      if (!affectsX && !affectsY) return { dxEdge: 0, dyEdge: 0, guides: null };

      const thr = getSnapThreshold();
      const tb = getAABB(target);
      if (!tb) return { dxEdge: 0, dyEdge: 0, guides: null };

      const movingX = c.includes('r') ? 'max' : c.includes('l') ? 'min' : null;
      const movingY = c.includes('b') ? 'max' : c.includes('t') ? 'min' : null;

      let bestDx = 0;
      let bestDy = 0;
      let bestAbsDx = Infinity;
      let bestAbsDy = Infinity;
      let guideX = null;
      let guideY = null;

      const objs = (fCanvas.getObjects?.() || []).filter(
        o => o && o !== target && isSnappingCandidate(o)
      );

      if (affectsX && movingX) {
        const tx = movingX === 'max' ? tb.maxX : tb.minX;
        for (const o of objs) {
          const ob = getAABB(o);
          if (!ob) continue;
          const oX = [ob.minX, ob.midX, ob.maxX];
          for (const ox of oX) {
            const dx = ox - tx;
            const adx = Math.abs(dx);
            if (adx <= thr && adx < bestAbsDx) {
              bestAbsDx = adx;
              bestDx = dx;
              guideX = ox;
            }
          }
        }
      }

      if (affectsY && movingY) {
        const ty = movingY === 'max' ? tb.maxY : tb.minY;
        for (const o of objs) {
          const ob = getAABB(o);
          if (!ob) continue;
          const oY = [ob.minY, ob.midY, ob.maxY];
          for (const oy of oY) {
            const dy = oy - ty;
            const ady = Math.abs(dy);
            if (ady <= thr && ady < bestAbsDy) {
              bestAbsDy = ady;
              bestDy = dy;
              guideY = oy;
            }
          }
        }
      }

      const guides =
        guideX != null || guideY != null
          ? {
              x: guideX,
              y: guideY,
            }
          : null;

      return {
        dxEdge: Number.isFinite(bestDx) && bestAbsDx !== Infinity ? bestDx : 0,
        dyEdge: Number.isFinite(bestDy) && bestAbsDy !== Infinity ? bestDy : 0,
        guides,
      };
    };

    const handleSelection = e => {
      const obj = e.selected?.[0];
      if (isHole(obj)) {
        // Забороняємо вибір отворів і закриваємо пропертіс
        try {
          fCanvas.discardActiveObject();
        } catch {}
        setActiveObject(null);
        setShapePropertiesOpen(false);
        return;
      }
      // QR-код: активировать режим редактирования, но не открывать ShapeProperties
      if (obj && (obj.isQRCode === true || (obj.data && obj.data.isQRCode === true))) {
        setActiveObject(obj);
        // Включить синюю рамку, controls и т.д. (editable)
        try {
          obj.set({
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            lockScalingX: false,
            lockScalingY: false,
            lockUniScaling: false,
            lockMovementX: false,
            lockMovementY: false,
          });
          obj.canvas && obj.setCoords && obj.setCoords();
          obj.canvas && obj.canvas.requestRenderAll && obj.canvas.requestRenderAll();
        } catch {}
        setShapePropertiesOpen(false);
        return;
      }
      // Тримати тексти поверх при кожному виборі
      bringAllTextsToFront();
      // Cut elements: якщо додані з Shape Selector (fromShapeTab), завжди відкриваємо Shape Properties
      if (obj && isCut(obj)) {
        if (obj.fromShapeTab === true || (obj.data && obj.data.fromShapeTab === true)) {
          setActiveObject(obj);
          setShapePropertiesOpen(true);
          return;
        }
        // Звичайний cut-елемент (з Cut Selector) — не відкриваємо Shape Properties
        setActiveObject(obj);
        setShapePropertiesOpen(false);
        return;
      }
      // Якщо фігура має fromShapeTab=true, завжди відкриваємо Shape Properties
      if (obj && (obj.fromShapeTab === true || (obj.data && obj.data.fromShapeTab === true))) {
        setActiveObject(obj);
        setShapePropertiesOpen(true);
        return;
      }
      // IconMenu elements: never open Shape Properties
      if (obj && isFromIconMenu(obj)) {
        setActiveObject(obj);
        setShapePropertiesOpen(false);
        return;
      }
      if (isShapeWithProps(obj)) {
        setActiveObject(obj);
        // Не відкривати модалку Shape Properties в режимі кастомної фігури та для іконок з IconMenu
        if (!isCustomShapeMode && !isFromIconMenu(obj)) setShapePropertiesOpen(true);
      }
    };
    fCanvas.on('selection:created', handleSelection);
    fCanvas.on('selection:updated', handleSelection);
    fCanvas.on('selection:cleared', () => {
      setActiveObject(null);
      setShapePropertiesOpen(false);
    });

    fCanvas.on('mouse:down', e => {
      // Если активен IText в режиме редактирования, перехватываем клики по оверлей-панели
      try {
        const active = fCanvas.getActiveObject();
        const isTextEditing =
          active && ['i-text', 'text', 'textbox'].includes(active.type) && active.isEditing;
        if (isTextEditing) {
          const pt = fCanvas.getPointer?.(e.e);
          if (pt) {
            const ac = active.aCoords;
            if (ac && ac.tl && ac.tr && ac.br && ac.bl) {
              const xs = [ac.tl.x, ac.tr.x, ac.br.x, ac.bl.x];
              const ys = [ac.tl.y, ac.tr.y, ac.br.y, ac.bl.y];
              const minX = Math.min(...xs),
                maxX = Math.max(...xs),
                minY = Math.min(...ys),
                maxY = Math.max(...ys);
              const s = scaleRef.current || 1;
              const panelCx = (minX + maxX) / 2;
              const panelCy = minY - TOP_PANEL_GAP / s;
              const step = PANEL_BUTTON_DIAMETER + PANEL_BUTTON_GAP; // CSS px
              const centerIndex = (5 - 1) / 2; // 5 кнопок
              const buttonCenter = index => {
                const cssOffsetX = (index - centerIndex) * step;
                return {
                  x: panelCx + cssOffsetX / s,
                  y: panelCy,
                };
              };
              const hitRadius = PANEL_BUTTON_DIAMETER / 2 / s;
              const hit = pos => {
                const dx = (pt.x || 0) - pos.x;
                const dy = (pt.y || 0) - pos.y;
                return dx * dx + dy * dy <= hitRadius * hitRadius;
              };
              const posA = buttonCenter(0);
              const posB = buttonCenter(1);
              const posC = buttonCenter(2);
              const posDup = buttonCenter(3);
              const posDel = buttonCenter(4);

              // Если попали по одной из иконок — исполняем соответствующее действие и предотвращаем дальнейшую обработку
              if (hit(posA)) {
                // A: already in editing — ставим курсор в конец
                try {
                  const len = (active.text || '').length;
                  if (typeof active.setSelectionStart === 'function') active.setSelectionStart(len);
                  if (typeof active.setSelectionEnd === 'function') active.setSelectionEnd(len);
                  if (active.hiddenTextarea && typeof active.hiddenTextarea.focus === 'function')
                    active.hiddenTextarea.focus();
                } catch {}
                fCanvas.requestRenderAll();
                return; // прервали обработку клика
              }
              if (hit(posB)) {
                try {
                  // Для действий вне текста завершаем редактирование, применяем команду, затем возвращаем фокус
                  active.exitEditing && active.exitEditing();
                } catch {}
                centerHorizontallyHandler(e, { target: active });
                return;
              }
              if (hit(posC)) {
                try {
                  active.exitEditing && active.exitEditing();
                } catch {}
                centerVerticallyHandler(e, { target: active });
                return;
              }
              if (hit(posDup)) {
                try {
                  active.exitEditing && active.exitEditing();
                } catch {}
                duplicateHandler(e, { target: active });
                return;
              }
              if (hit(posDel)) {
                try {
                  active.exitEditing && active.exitEditing();
                } catch {}
                deleteHandler(e, { target: active });
                return;
              }
            }
          }
        }
      } catch {}
      const t = e.target;
      // Якщо під курсором є текст — віддати йому пріоритет вибору
      try {
        const pt = fCanvas.getPointer?.(e.e);
        if (pt) {
          const textsUnder = (fCanvas.getObjects?.() || []).filter(isTextObj).filter(o => {
            try {
              return typeof o.containsPoint === 'function' ? o.containsPoint(pt) : false;
            } catch {
              return false;
            }
          });
          if (textsUnder.length > 0) {
            // Обираємо верхній текст (вони вже зверху завдяки bringAllTextsToFront)
            const topText = textsUnder[textsUnder.length - 1];
            fCanvas.setActiveObject(topText);
            ensureActionControls(topText);
            setShapePropertiesOpen(false);
            fCanvas.requestRenderAll();
            return; // зупиняємо обробку — не чіпаємо фігуру під текстом
          }
        }
      } catch {}
      if (isHole(t)) return; // ігноруємо кліки по отворах
      // Якщо фігура має fromShapeTab=true, завжди відкриваємо Shape Properties
      if (t && (t.fromShapeTab === true || (t.data && t.data.fromShapeTab === true))) {
        setActiveObject(t);
        setShapePropertiesOpen(true);
        return;
      }
      // Cut elements: активуємо без відкриття Shape Properties
      if (t && isCut(t)) {
        setActiveObject(t);
        setShapePropertiesOpen(false);
        return;
      }
      // IconMenu elements: активуємо без відкриття Shape Properties
      if (t && isFromIconMenu(t)) {
        setActiveObject(t);
        setShapePropertiesOpen(false);
        return;
      }
      if (isShapeWithProps(t)) {
        setActiveObject(t);
        if (!isCustomShapeMode && !isFromIconMenu(t)) setShapePropertiesOpen(true);
        return;
      }
      // По кліку на текст: лише активуємо (панель намалюється в selection:created/updated)
      if (t && (t.type === 'i-text' || t.type === 'text' || t.type === 'textbox')) {
        try {
          // Заборонити автоперехід у редагування на одинарному кліку
          t.__allowNextEditing = false;
          setActiveObject(t);
          fCanvas.setActiveObject(t);
          // panel appears on selection events; avoid forcing controls here to prevent flicker
        } catch {}
      }
    });

    // Подвійний клік по тексту — увімкнути редагування
    fCanvas.on('mouse:dblclick', e => {
      const t = e.target;
      if (t && (t.type === 'i-text' || t.type === 'text' || t.type === 'textbox')) {
        try {
          t.__allowNextEditing = true;
          if (typeof t.enterEditing === 'function') t.enterEditing();
          const len = (t.text || '').length;
          if (typeof t.setSelectionStart === 'function') t.setSelectionStart(len);
          if (typeof t.setSelectionEnd === 'function') t.setSelectionEnd(len);
          if (t.hiddenTextarea && typeof t.hiddenTextarea.focus === 'function')
            t.hiddenTextarea.focus();
          fCanvas.requestRenderAll();
        } catch {}
      }
    });

    // Заборона авто-редагування, якщо не дозволено (щоб панель не зникала після одинарного кліку)
    fCanvas.on('text:editing:entered', e => {
      const t = e?.target;
      if (t && (t.type === 'i-text' || t.type === 'text' || t.type === 'textbox')) {
        if (!t.__allowNextEditing) {
          try {
            if (typeof t.exitEditing === 'function') t.exitEditing();
          } catch {}
          try {
            fCanvas.setActiveObject(t);
            ensureActionControls(t);
            fCanvas.requestRenderAll();
          } catch {}
          return;
        }
        // спожити дозвіл тільки для цього входу
        t.__allowNextEditing = false;
        // Скрываем нативный caret у hiddenTextarea и включаем периодическую подстраховку
        try {
          if (t.__caretHideTimer) clearInterval(t.__caretHideTimer);
        } catch {}
        try {
          t.__caretHideTimer = setInterval(() => {
            try {
              if (t.hiddenTextarea) {
                try {
                  t.hiddenTextarea.setAttribute('data-fabric-hidden-textarea', '1');
                } catch {}
                applyHiddenTextareaStyle(t.hiddenTextarea);
              }
            } catch {}
          }, 100);
        } catch {}
        try {
          if (t.hiddenTextarea) {
            try {
              t.hiddenTextarea.setAttribute('data-fabric-hidden-textarea', '1');
            } catch {}
            applyHiddenTextareaStyle(t.hiddenTextarea);
          }
        } catch {}
      }
    });
    // На каждом кадре после рендера убеждаемся, что hiddenTextarea остаётся скрытой
    fCanvas.on('after:render', enforceHideCaretIfEditing);
    // При выходе из редактирования: очищаем интервал и ещё раз убеждаемся, что hiddenTextarea скрыта
    fCanvas.on('text:editing:exited', e => {
      const t = e?.target;
      try {
        if (t && t.__caretHideTimer) clearInterval(t.__caretHideTimer);
      } catch {}
      try {
        if (t) t.__caretHideTimer = null;
      } catch {}
      try {
        if (t && t.hiddenTextarea) applyHiddenTextareaStyle(t.hiddenTextarea);
      } catch {}
    });

    const mirrorIfPath = e => {
      if (e.target && isShapeWithProps(e.target)) setActiveObject({ ...e.target });
    };
    ['object:modified', 'object:scaling', 'object:rotating', 'object:moving'].forEach(evt =>
      fCanvas.on(evt, mirrorIfPath)
    );

    // Утиліта: зробити отвір статичним (неклікабельним і нерухомим)
    const hardenHole = o => {
      if (!o) return;
      try {
        o.set({
          selectable: false,
          evented: false,
          hasControls: false,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          lockMovementX: true,
          lockMovementY: true,
        });
      } catch {}
    };

    // Автодоведення при обертанні: якщо кут майже горизонтальний або вертикальний — фіксуємо точно
    const SNAP_THRESHOLD_DEG = 6; // збільшений поріг, щоб "липнути" виразніше
    const normalizeDeg = ang => ((ang % 360) + 360) % 360;
    const snapAngleHorizontal = ang => {
      const a = normalizeDeg(ang || 0);
      if (a < SNAP_THRESHOLD_DEG || 360 - a < SNAP_THRESHOLD_DEG) return 0;
      if (Math.abs(a - 180) < SNAP_THRESHOLD_DEG) return 180;
      return null;
    };
    const snapAngleVertical = ang => {
      const a = normalizeDeg(ang || 0);
      if (Math.abs(a - 90) < SNAP_THRESHOLD_DEG) return 90;
      if (Math.abs(a - 270) < SNAP_THRESHOLD_DEG) return 270;
      return null;
    };
    const onRotatingSnap = e => {
      const t = e?.target;
      if (!t) return;
      const h = snapAngleHorizontal(t.angle);
      const v = snapAngleVertical(t.angle);
      let targetAngle = null;
      let snappedH = false;
      let snappedV = false;
      if (h !== null && v !== null) {
        const a = normalizeDeg(t.angle || 0);
        const dh = Math.min(Math.abs(a - h), 360 - Math.abs(a - h));
        const dv = Math.min(Math.abs(a - v), 360 - Math.abs(a - v));
        if (dv < dh) {
          targetAngle = v;
          snappedV = true;
        } else {
          targetAngle = h;
          snappedH = true;
        }
      } else if (v !== null) {
        targetAngle = v;
        snappedV = true;
      } else if (h !== null) {
        targetAngle = h;
        snappedH = true;
      }

      if (targetAngle !== null) {
        t.set('angle', targetAngle);
        // Позначимо, що зараз зафіксовано — для візуального індикатора
        t.__snappedHorizontal = snappedH;
        t.__snappedVertical = snappedV;
        try {
          fCanvas.requestRenderAll();
        } catch {}
      } else {
        // Скидаємо прапорці, якщо вийшли з зони автодоведення
        if (t.__snappedHorizontal) t.__snappedHorizontal = false;
        if (t.__snappedVertical) t.__snappedVertical = false;
      }
    };
    fCanvas.on('object:rotating', onRotatingSnap);

    const originalSetDimensions = fCanvas.setDimensions.bind(fCanvas);
    // Перегенерація фону-текстури під поточні розміри canvasa
    const rebuildBackgroundTexture = () => {
      try {
        const type = fCanvas.get && fCanvas.get('backgroundType');
        const url = fCanvas.get && fCanvas.get('backgroundTextureUrl');
        if (type !== 'texture' || !url) return;

        // Зберігаємо URL для перевірки при onload
        const requestedUrl = url;

        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            // ВИПРАВЛЕННЯ: Перевіряємо чи canvas все ще очікує цю текстуру
            // Якщо backgroundType змінився або URL інший - не застосовуємо
            const currentType = fCanvas.get && fCanvas.get('backgroundType');
            const currentUrl = fCanvas.get && fCanvas.get('backgroundTextureUrl');

            if (currentType !== 'texture' || currentUrl !== requestedUrl) {
              console.log('[Canvas] Skipping stale texture rebuild:', {
                requestedUrl,
                currentType,
                currentUrl,
              });
              return;
            }

            // Також перевіряємо чи canvas не в процесі перемикання
            if (fCanvas.__switching || fCanvas.__suspendUndoRedo) {
              console.log('[Canvas] Skipping texture rebuild - canvas switching');
              return;
            }

            const scaleX = (fCanvas.width || 0) / (img.width || 1);
            const scaleY = (fCanvas.height || 0) / (img.height || 1);
            const patternCanvas = document.createElement('canvas');
            const ctx = patternCanvas.getContext('2d');
            patternCanvas.width = Math.max(1, img.width * scaleX);
            patternCanvas.height = Math.max(1, img.height * scaleY);
            ctx.drawImage(img, 0, 0, patternCanvas.width, patternCanvas.height);
            const pattern = new fabric.Pattern({
              source: patternCanvas,
              repeat: 'no-repeat',
            });
            fCanvas.set('backgroundColor', pattern);
            fCanvas.requestRenderAll && fCanvas.requestRenderAll();
          } catch {}
        };
        img.onerror = () => {};
        img.src = url;
      } catch {}
    };

    // Перегенерація фону-градієнта під поточні розміри canvasa
    // (інакше при збільшенні полотна можуть зʼявлятися білі ділянки, бо Pattern має repeat: 'no-repeat')
    const rebuildBackgroundGradient = () => {
      try {
        const type = fCanvas.get && fCanvas.get('backgroundType');
        if (type !== 'gradient') return;

        if (fCanvas.__switching || fCanvas.__suspendUndoRedo) return;

        const W = typeof fCanvas.getWidth === 'function' ? fCanvas.getWidth() : fCanvas.width || 0;
        const H =
          typeof fCanvas.getHeight === 'function' ? fCanvas.getHeight() : fCanvas.height || 0;

        const off = document.createElement('canvas');
        off.width = Math.max(1, W);
        off.height = Math.max(1, H);
        const ctx = off.getContext('2d');
        if (!ctx) return;

        const cssDeg = 152.22;
        const rad = (cssDeg * Math.PI) / 180;
        const dirX = Math.sin(rad);
        const dirY = -Math.cos(rad);
        const cx = W / 2;
        const cy = H / 2;
        const L = Math.abs(W * dirX) + Math.abs(H * dirY);
        const x0 = cx - (dirX * L) / 2;
        const y0 = cy - (dirY * L) / 2;
        const x1 = cx + (dirX * L) / 2;
        const y1 = cy + (dirY * L) / 2;

        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        grad.addColorStop(0.2828, '#B5B5B5');
        grad.addColorStop(0.5241, '#F5F5F5');
        grad.addColorStop(0.7414, '#979797');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        const pattern = new fabric.Pattern({
          source: off,
          repeat: 'no-repeat',
        });

        fCanvas.set('backgroundColor', pattern);
        fCanvas.requestRenderAll && fCanvas.requestRenderAll();
      } catch {}
    };
    const resizeToViewport = () => {
      if (!viewportRef.current) return;
      const { width: baseW, height: baseH } = designRef.current;
      const dpr = window.devicePixelRatio || 1;
      const availW = Math.max(0, viewportRef.current.clientWidth - 2 * MARGIN);
      const availH = Math.max(0, viewportRef.current.clientHeight - 2 * MARGIN);
      const scaleToFit = Math.min(availW / baseW, availH / baseH) || 1;
      const cssW = Math.max(1, baseW * scaleToFit);
      const cssH = Math.max(1, baseH * scaleToFit);
      // Make backing store match CSS scale so it stays crisp at any size.
      // Desired backing pixel ratio should be dpr * scaleToFit.
      // Add a safety cap to avoid extremely large canvases.
      const MAX_BACKING_PX = 8192; // per side safety cap
      const desiredRetina = dpr * scaleToFit;
      const maxRetinaByW = baseW > 0 ? MAX_BACKING_PX / baseW : desiredRetina;
      const maxRetinaByH = baseH > 0 ? MAX_BACKING_PX / baseH : desiredRetina;
      const boosted = Math.min(desiredRetina, maxRetinaByW, maxRetinaByH);
      const effectiveRetina = Math.max(dpr, boosted);
      fCanvas.getRetinaScaling = () => effectiveRetina;
      resizingRef.current = true;
      originalSetDimensions({ width: baseW, height: baseH });
      resizingRef.current = false;
      fCanvas.setZoom(1);
      fCanvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });
      fCanvas.getDesignSize = () => ({ width: baseW, height: baseH });
      fCanvas.getCssSize = () => ({ width: cssW, height: cssH });

      // Для lock віднімаємо висоту дужки (8mm) при відображенні
      const heightMmToDisplay = canvasShapeType === 'lock' ? baseH - PX_PER_MM * 8 : baseH;

      setDisplayWidth(baseW);
      setDisplayHeight(heightMmToDisplay);
      setCssHeight(cssH);
      setScale(scaleToFit);
      scaleRef.current = scaleToFit;
      fCanvas.calcOffset();
      fCanvas.renderAll();

      // Відстежуємо зміну viewport
      if (trackViewportChange) {
        trackViewportChange(`Canvas resized to viewport (scale: ${Math.round(scaleToFit * 100)}%)`);
      }

      try {
        fCanvas.fire('display:scale', { scale: scaleToFit });
      } catch {}
      try {
        syncShadowHost();
      } catch {}
    };

    // Helper: compute max display scale percent allowed so canvas fits inside viewport - 10px
    fCanvas.getMaxDisplayScalePercent = () => {
      try {
        const vp = viewportRef.current;
        const { width: baseW, height: baseH } = designRef.current || {};
        if (!vp || !baseW || !baseH) return 500;
        const vw = Math.max(0, vp.clientWidth - 30);
        const vh = Math.max(0, vp.clientHeight - 30);
        const maxFactor = Math.max(0.01, Math.min(vw / baseW, vh / baseH));
        return Math.max(1, Math.floor(maxFactor * 100));
      } catch {
        return 500;
      }
    };

    // Public API: set display scale (percent) by resizing CSS box, not fabric zoom
    // Clamps to [30%, dynamicMax%]; preserves design pixels and resets fabric zoom to 1
    fCanvas.setDisplayScale = percent => {
      const { width: baseW, height: baseH } = designRef.current;
      const requested = Math.round(Number(percent) || 0);
      const vp = viewportRef.current;
      // Compute strict viewport-based max factor
      let vw = 0,
        vh = 0;
      if (vp) {
        vw = Math.max(0, vp.clientWidth - 30);
        vh = Math.max(0, vp.clientHeight - 30);
      }
      const maxFactorView = baseW && baseH ? Math.min(vw / baseW, vh / baseH) : 5;
      const minFactor = 0.3; // 30%
      const reqFactor = (requested || 0) / 100;
      const factor = Math.max(minFactor, Math.min(maxFactorView, reqFactor || 0));
      const clamped = Math.round(factor * 100);
      const cssW = Math.max(1, baseW * factor);
      const cssH = Math.max(1, baseH * factor);

      // Make backing store match CSS scale so it stays crisp at any size.
      // Desired backing pixel ratio should be dpr * factor.
      // Add a safety cap to avoid extremely large canvases.
      const dpr = window.devicePixelRatio || 1;
      const MAX_BACKING_PX = 8192; // per side safety cap
      const desiredRetina = dpr * factor;
      const maxRetinaByW = baseW > 0 ? MAX_BACKING_PX / baseW : desiredRetina;
      const maxRetinaByH = baseH > 0 ? MAX_BACKING_PX / baseH : desiredRetina;
      const boosted = Math.min(desiredRetina, maxRetinaByW, maxRetinaByH);
      const effectiveRetina = Math.max(dpr, boosted);
      fCanvas.getRetinaScaling = () => effectiveRetina;

      // Keep internal canvas size at design pixels; scale visually via CSS box
      resizingRef.current = true;
      originalSetDimensions({ width: baseW, height: baseH });
      resizingRef.current = false;
      fCanvas.setZoom(1);
      fCanvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });

      // Update state + notify listeners
      // Для lock віднімаємо висоту дужки (8mm) при відображенні
      const heightMmToDisplay = canvasShapeType === 'lock' ? baseH - PX_PER_MM * 8 : baseH;

      setDisplayWidth(baseW);
      setDisplayHeight(heightMmToDisplay);
      setCssHeight(cssH);
      setScale(factor);
      scaleRef.current = factor;
      fCanvas.calcOffset();
      fCanvas.renderAll();

      // Відстежуємо зміну viewport
      if (trackViewportChange) {
        trackViewportChange(`Display scale changed to ${clamped}%`);
      }

      try {
        fCanvas.fire('display:scale', { scale: factor });
      } catch {}
      try {
        syncShadowHost();
      } catch {}
      return clamped;
    };

    fCanvas.setDimensions = (dimensions, options) => {
      const result = originalSetDimensions(dimensions, options);
      if (options && options.cssOnly) return result;
      const nextW = dimensions?.width ?? designRef.current.width;
      const nextH = dimensions?.height ?? designRef.current.height;
      if (!resizingRef.current && typeof nextW === 'number' && typeof nextH === 'number') {
        const prevW = designRef.current.width;
        const prevH = designRef.current.height;

        designRef.current = { width: nextW, height: nextH };
        resizingRef.current = true;
        try {
          // Run synchronously so labels (width/height) reflect new size immediately
          resizeToViewport();

          // Відстежуємо зміну розміру полотна
          if (trackCanvasResize && (nextW !== prevW || nextH !== prevH)) {
            trackCanvasResize(nextW, nextH);
          }
          // Якщо фон є текстурою — регенеруємо під новий розмір, щоб не дублювався
          try {
            rebuildBackgroundTexture();
          } catch {}
          // Якщо фон є градієнтом — регенеруємо під новий розмір, щоб не лишались білі ділянки
          try {
            rebuildBackgroundGradient();
          } catch {}
        } finally {
          resizingRef.current = false;
        }
      }
      return result;
    };

    resizeToViewport();
    window.addEventListener('resize', resizeToViewport);
    try {
      syncShadowHost();
    } catch {}

    // Рендерери контролів
    const makeTextBadgeRenderer = symbol => (ctx, left, top) => {
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
      ctx.fillText(symbol, left, top + 1 / s);
      ctx.restore();
    };

    const makeSvgIconRenderer = (svg, targetW = 24, targetH = 24) => {
      const cache = { img: null, loaded: false };
      return (ctx, left, top) => {
        const s = scaleRef.current || 1;
        if (!cache.img) {
          const img = new Image();
          img.onload = () => {
            cache.loaded = true;
            try {
              fCanvas.requestRenderAll();
            } catch {}
          };
          img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
          cache.img = img;
        }
        const w = targetW / s;
        const h = targetH / s;
        ctx.save();
        if (cache.img && (cache.img.complete || cache.loaded)) {
          ctx.drawImage(cache.img, left - w / 2, top - h / 2, w, h);
        } else {
          // fallback placeholder box
          ctx.fillStyle = '#eee';
          ctx.strokeStyle = '#999';
          ctx.lineWidth = 1 / s;
          ctx.fillRect(left - w / 2, top - h / 2, w, h);
          ctx.strokeRect(left - w / 2, top - h / 2, w, h);
        }
        ctx.restore();
      };
    };

    const DELETE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="22" fill="none"><path fill="#FF3B30" d="m15.517 11.78.743.103-.743-.103Zm-.262 1.885.743.103-.743-.104Zm-12.51 0 .743-.104-.743.104Zm-.262-1.885-.743.103.743-.103Zm3.7 8.957-.29.69.29-.69ZM3.476 17.56l.704-.258-.704.258Zm11.05 0 .704.259-.704-.259Zm-2.709 3.177-.291-.691.291.69ZM2.746 7.929a.75.75 0 1 0-1.493.142L2 8l.747-.07Zm14 .142a.75.75 0 1 0-1.493-.142L16 8l.747.07ZM17 6.75a.75.75 0 0 0 0-1.5v1.5ZM1 5.25a.75.75 0 0 0 0 1.5v-1.5ZM6.25 17a.75.75 0 0 0 1.5 0h-1.5Zm1.5-8a.75.75 0 0 0-1.5 0h1.5Zm2.5 8a.75.75 0 0 0 1.5 0h-1.5Zm1.5-8a.75.75 0 0 0-1.5 0h1.5ZM13 6v.75h.75V6H13ZM5 6h-.75v.75H5V6Zm10.517 5.78-.743-.104-.262 1.885.743.104.743.103.262-1.885-.743-.103ZM2.745 13.665l.743-.104-.262-1.885-.743.104-.743.103.262 1.885.743-.104ZM9 21v-.75c-1.53 0-2.075-.014-2.525-.204l-.291.69-.292.692c.797.336 1.714.322 3.108.322V21Zm-6.255-7.335-.743.103c.28 2.01.432 3.134.77 4.051l.703-.259.704-.258c-.267-.728-.4-1.653-.691-3.74l-.743.103Zm3.439 7.072.291-.691c-.922-.39-1.78-1.34-2.296-2.744l-.704.258-.704.259c.615 1.673 1.711 3.014 3.121 3.609l.292-.691Zm9.07-7.072-.742-.104c-.29 2.088-.424 3.013-.691 3.74l.704.26.704.258c.337-.917.489-2.041.769-4.051l-.743-.104ZM9 21v.75c1.394 0 2.31.014 3.108-.322l-.292-.691-.291-.691c-.45.19-.996.204-2.525.204V21Zm5.525-3.44-.704-.258c-.516 1.404-1.374 2.355-2.296 2.744l.291.69.292.692c1.41-.595 2.506-1.936 3.12-3.609l-.703-.259ZM2.483 11.78l.743-.104c-.222-1.596-.388-2.789-.48-3.747L2 8l-.747.07c.095.999.267 2.23.487 3.813l.743-.103Zm13.034 0 .743.103c.22-1.583.392-2.814.487-3.812L16 8l-.747-.07c-.09.957-.257 2.15-.479 3.746l.743.104ZM17 6v-.75H1v1.5h16V6ZM7 17h.75V9h-1.5v8H7Zm4 0h.75V9h-1.5v8H11Zm2-12h-.75v1h1.5V5H13Zm0 1v-.75H5v1.5h8V6ZM5 6h.75V5h-1.5v1H5Zm4-5v.75A3.25 3.25 0 0 1 12.25 5h1.5A4.75 4.75 0 0 0 9 .25V1Zm0 0V.25A4.75 4.75 0 0 0 4.25 5h1.5A3.25 3.25 0 0 1 9 1.75V1Z"/></svg>`;
    const DUPLICATE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"><g stroke="#000" stroke-width="2" clip-path="url(#a)"><path stroke-linecap="round" stroke-linejoin="round" d="M5 21h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/><path d="M10 10v8M6 14h8"/></g><defs><clipPath id="a"><path fill="#fff" d="M24 24H0V0h24z"/></clipPath></defs></svg>`;
    // New SVGs for A, B, C buttons (order requested: A, B, C, duplicate, delete)
    const A_SVG = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"none\"><g stroke=\"#000\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" clip-path=\"url(#a)\"><path d=\"M7 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1\"/><path d=\"M20.385 6.585a2.1 2.1 0 0 0-2.97-2.97L9 12v3h3l8.385-8.415v0ZM16 5l3 3\"/></g><defs><clipPath id=\"a\"><path fill=\"#fff\" d=\"M0 0h24v24H0z\"/></clipPath></defs></svg>`;
    const B_SVG = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" fill=\"none\"><path fill=\"#000\" d=\"M12 22.5a.75.75 0 0 1-.75-.75V2.25a.75.75 0 1 1 1.5 0v19.5a.75.75 0 0 1-.75.75ZM0 12a.75.75 0 0 1 .75-.75h5.69L4.718 9.531a.751.751 0 1 1 1.062-1.062l3 3a.75.75 0 0 1 0 1.062l-3 3A.752.752 0 0 1 4.499 15a.751.751 0 0 1 .22-.531l1.72-1.719H.75A.75.75 0 0 1 0 12Zm17.56.75 1.721 1.719a.75.75 0 0 1-1.062 1.062l-3-3a.75.75 0 0 1 0-1.062l3-3a.75.75 0 1 1 1.062 1.062l-1.72 1.719h5.689a.75.75 0 1 1 0 1.5h-5.69Z\"/></svg>`;
    const C_SVG = `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"21\" height=\"24\" fill=\"none\"><path fill=\"#000\" fill-rule=\"evenodd\" d=\"M0 12a.75.75 0 0 1 .75-.75h19.5a.75.75 0 1 1 0 1.5H.75A.75.75 0 0 1 0 12ZM10.5 0a.75.75 0 0 1 .75.75v5.69l1.719-1.721a.75.75 0 1 1 1.062 1.062l-3 3a.75.75 0 0 1-1.062 0l-3-3a.751.751 0 1 1 1.062-1.062l1.719 1.72V.75A.75.75 0 0 1 10.5 0Zm-.75 17.56-1.719 1.721a.751.751 0 0 1-1.062-1.062l3-3a.751.751 0 0 1 1.062 0l3 3a.75.75 0 0 1-1.062 1.062l-1.719-1.72v5.689a.75.75 0 1 1-1.5 0v-5.69Z\" clip-rule=\"evenodd\"/></svg>`;
    const aIconRenderer = makeSvgIconRenderer(A_SVG, 24, 24);
    const bIconRenderer = makeSvgIconRenderer(B_SVG, 24, 24);
    const cIconRenderer = makeSvgIconRenderer(C_SVG, 21, 24);
    const deleteIconRenderer = makeSvgIconRenderer(DELETE_SVG, 18, 22);
    const duplicateIconRenderer = makeSvgIconRenderer(DUPLICATE_SVG, 24, 24);

    const rotateIconCache = { img: null, loaded: false };
    const renderRotateIcon = (ctx, left, top) => {
      const s = scaleRef.current || 1;
      const size = 37 / s;
      if (!rotateIconCache.img) {
        const svg = `<?xml version="1.0" encoding="UTF-8"?><svg width="37" height="37" viewBox="0 0 37 37" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18.5" cy="18.5" r="18.5" fill="#159DFF"/><path d="M7 17C7 17 10.6963 23 18.4061 23C26.116 23 30 17 30 17M7 17L12.7497 18.875M7 17L8.64279 22.625M30 17L24.2492 18.875M30 17L27.9455 22.625" stroke="white" stroke-width="2"/></svg>`;
        const img = new Image();
        img.onload = () => {
          rotateIconCache.loaded = true;
          try {
            fCanvas.requestRenderAll();
          } catch {}
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
        ctx.save();
        ctx.beginPath();
        ctx.arc(left, top, 18.5 / s, 0, Math.PI * 2);
        ctx.fillStyle = '#159DFF';
        ctx.fill();
        ctx.restore();
      }
    };

    const makeDotControl = (actionHandler, cursorStyle) =>
      new fabric.Control({
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
        get sizeX() {
          return 16 / (scaleRef.current || 1);
        },
        get sizeY() {
          return 16 / (scaleRef.current || 1);
        },
        get touchSizeX() {
          return 28 / (scaleRef.current || 1);
        },
        get touchSizeY() {
          return 28 / (scaleRef.current || 1);
        },
      });

    const duplicateHandler = async (evt, transform) => {
      const target = transform?.target;
      if (!target) return true;
      try {
        // QR codes: do NOT clone. Cloning can copy internal locked fill descriptors
        // and produce a transparent duplicate. Regenerate a fresh QR with identical params.
        const isQr = target.isQRCode === true || (target.data && target.data.isQRCode === true);
        const qrText = target.qrText || (target.data && target.data.qrText);
        if (isQr && qrText) {
          const nextLeft = (target.left || 0) + 10;
          const nextTop = (target.top || 0) + 10;
          const scaleX = target.scaleX ?? 1;
          const scaleY = target.scaleY ?? 1;
          const angle = target.angle ?? 0;
          const originX = target.originX || 'center';
          const originY = target.originY || 'center';
          const qrColor =
            target.qrColor ||
            (target.data && target.data.qrColor) ||
            globalColors?.textColor ||
            '#000000';

          try {
            const qrGenerator = (await import('qrcode-generator')).default;
            const qr = qrGenerator(0, 'M');
            qr.addData(qrText);
            qr.make();

            const cellSize = DEFAULT_QR_CELL_SIZE;
            const { optimizedPath, displayPath, size } = computeQrVectorData(qr, cellSize);
            const svgText = buildQrSvgMarkup({
              size,
              displayPath,
              optimizedPath,
              strokeColor: qrColor,
            });

            const res = await fabric.loadSVGFromString(svgText);
            const obj =
              res?.objects?.length === 1
                ? res.objects[0]
                : fabric.util.groupSVGElements(res.objects || [], res.options || {});
            decorateQrGroup(obj);
            obj.set({
              left: nextLeft,
              top: nextTop,
              scaleX,
              scaleY,
              angle,
              originX,
              originY,
              selectable: true,
              hasControls: true,
              hasBorders: true,
              isQRCode: true,
              qrText,
              qrSize: size || target.qrSize || obj.width || 0,
              qrColor,
              backgroundColor: 'transparent',
            });

            try {
              if (typeof obj.setCoords === 'function') obj.setCoords();
            } catch {}
            fCanvas.add(obj);
            fCanvas.setActiveObject(obj);
            try {
              ensureActionControls(obj);
            } catch {}
            try {
              setShapePropertiesOpen(false);
            } catch {}
            fCanvas.requestRenderAll();
            return true;
          } catch {
            // Fall through to generic clone as a safety net.
          }
        }

        const cloned = await target.clone();
        // preserve halfCircle base bbox for stable scaling via inputs
        try {
          if (target.shapeType === 'halfCircle') {
            cloned.__baseBBoxW = target.__baseBBoxW || target.width;
            cloned.__baseBBoxH = target.__baseBBoxH || target.height;
          }
        } catch {}

        // IMPORTANT for PDF export: duplicated shapes must have unique ids.
        // PDF pipeline adds inner contours to nodes selected by id prefix (e.g. [id^="shape-"]).
        // If a clone keeps the same id (or loses it), the contour pass may skip it and the
        // element renders as a single line.
        try {
          const sourceId =
            target.id || target.svgTagId || target.shapeSvgId || target?.data?.shapeSvgId || '';
          if (typeof sourceId === 'string' && sourceId.startsWith('border-')) {
            ensureShapeSvgId(cloned, fCanvas, { prefix: 'border' });
          } else if (
            typeof sourceId === 'string' &&
            (sourceId.startsWith('shape-') ||
              target.fromShapeTab === true ||
              (target.data && target.data.fromShapeTab === true))
          ) {
            ensureShapeSvgId(cloned, fCanvas);
          }
        } catch {}

        // Preserve IconMenu flag so modal stays closed for clones
        try {
          const isFromIcon =
            target.fromIconMenu === true || (target.data && target.data.fromIconMenu === true);
          if (isFromIcon) {
            cloned.fromIconMenu = true;
            if (!cloned.data) cloned.data = {};
            cloned.data.fromIconMenu = true;
          }
        } catch {}
        const nextLeft = (target.left || 0) + 10;
        const nextTop = (target.top || 0) + 10;
        cloned.set({ left: nextLeft, top: nextTop });
        if (typeof cloned.setCoords === 'function') {
          try {
            cloned.setCoords();
          } catch {}
        }
        fCanvas.add(cloned);
        fCanvas.setActiveObject(cloned);
        try {
          ensureActionControls(cloned);
        } catch {}
        try {
          if (cloned.fromIconMenu === true || (cloned.data && cloned.data.fromIconMenu === true)) {
            setShapePropertiesOpen(false);
          }
        } catch {}
        fCanvas.requestRenderAll();
      } catch {}
      return true;
    };
    // Режим редагування: якщо ціль — текст, входимо в редагування і ставимо курсор в кінець; інакше — нічого
    const copyHandler = async (evt, transform) => {
      const target = transform?.target;
      if (!target) return true;
      // Определяем, можно ли редактировать текст напрямую
      const canEditText = typeof target.enterEditing === 'function';
      if (!canEditText) {
        // Ничего не делаем для не-текста
        return true;
      }
      try {
        // Явно разрешаем вход в редактирование, минуя запрет одиночного клика
        target.__allowNextEditing = true;
        target.enterEditing && target.enterEditing();
        const txt = typeof target.text === 'string' ? target.text : '';
        try {
          target.selectionStart = txt.length;
          target.selectionEnd = txt.length;
        } catch {}
        try {
          // Фокус на скрытую textarea, если доступна
          if (target.hiddenTextarea && typeof target.hiddenTextarea.focus === 'function') {
            target.hiddenTextarea.focus();
          }
        } catch {}
        if (typeof target.canvas?.requestRenderAll === 'function') {
          target.canvas.requestRenderAll();
        }
      } catch {}
      return true;
    };
    const deleteHandler = (evt, transform) => {
      const t = transform.target;
      if (!t) return true;
      fCanvas.remove(t);
      fCanvas.discardActiveObject();
      fCanvas.requestRenderAll();
      return true;
    };
    // Центрування: по вертикалі (Y) та по горизонталі (X) відносно зовнішньої фігури (дизайн-області)
    const centerVerticallyHandler = (evt, transform) => {
      const t = transform?.target;
      if (!t) return true;
      try {
        const { height: H } = designRef.current || {};
        const currentCenter = t.getCenterPoint();
        const newCenter = new fabric.Point(currentCenter.x, (H || fCanvas.getHeight()) / 2);
        t.setPositionByOrigin(newCenter, 'center', 'center');
        t.setCoords();
        // Flash horizontal dashed guide for 1s (centering along Y)
        try {
          t.__centerFlashHExpireAt = Date.now() + 1000;
          if (t.__centerFlashHTimer) {
            clearTimeout(t.__centerFlashHTimer);
          }
          t.__centerFlashHTimer = setTimeout(() => {
            try {
              t.__centerFlashHExpireAt = null;
            } catch {}
            try {
              fCanvas.requestRenderAll();
            } catch {}
          }, 1000);
        } catch {}
        fCanvas.requestRenderAll();
      } catch {}
      return true;
    };
    const centerHorizontallyHandler = (evt, transform) => {
      const t = transform?.target;
      if (!t) return true;
      try {
        const { width: W } = designRef.current || {};
        const currentCenter = t.getCenterPoint();
        const newCenter = new fabric.Point((W || fCanvas.getWidth()) / 2, currentCenter.y);
        t.setPositionByOrigin(newCenter, 'center', 'center');
        t.setCoords();
        // Flash vertical dashed guide for 1s (centering along X)
        try {
          t.__centerFlashVExpireAt = Date.now() + 1000;
          if (t.__centerFlashVTimer) {
            clearTimeout(t.__centerFlashVTimer);
          }
          t.__centerFlashVTimer = setTimeout(() => {
            try {
              t.__centerFlashVExpireAt = null;
            } catch {}
            try {
              fCanvas.requestRenderAll();
            } catch {}
          }, 1000);
        } catch {}
        fCanvas.requestRenderAll();
      } catch {}
      return true;
    };
    const ensureActionControls = obj => {
      if (!obj || !obj.controls) return;
      // Ensure coordinates exist (text objects can lack aCoords right after creation)
      if (typeof obj.setCoords === 'function') {
        try {
          obj.setCoords();
        } catch {}
      }
      // If aCoords are still not available, postpone applying controls to avoid Fabric reading undefined positions
      const ac = obj.aCoords;
      if (!ac || !ac.tl || !ac.tr || !ac.br || !ac.bl) {
        // Hide controls just in case and try again next frame
        obj.hasControls = false;
        try {
          requestAnimationFrame(() => ensureActionControls(obj));
        } catch {}
        return;
      }
      // Ensure per-instance controls object so changes don't leak to other objects
      if (!Object.prototype.hasOwnProperty.call(obj, 'controls')) {
        obj.controls = { ...obj.controls };
      }
      // Always allow drawing controls (we will hide resize handles below as needed)
      obj.hasControls = true;
      obj.hasBorders = false;
      if (obj.setControlsVisibility)
        obj.setControlsVisibility({
          tl: true,
          tr: true,
          bl: true,
          br: true,
          ml: true,
          mr: true,
          mt: true,
          mb: true,
          mtr: false,
        });
      const cu = fabric.controlsUtils;

      // Axis-aligned bounding box helpers
      const getAABB = o => {
        const ac = o.aCoords;
        if (!ac || !ac.tl || !ac.tr || !ac.br || !ac.bl) return null;
        const xs = [ac.tl.x, ac.tr.x, ac.br.x, ac.bl.x];
        const ys = [ac.tl.y, ac.tr.y, ac.br.y, ac.bl.y];
        return {
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
        };
      };
      const topCenterPos = (dim, m, o) => {
        const b = getAABB(o);
        if (!b) return new fabric.Point(0, 0);
        const s = scaleRef.current || 1;
        return new fabric.Point((b.minX + b.maxX) / 2, b.minY - TOP_PANEL_GAP / s);
      };
      const bottomCenterPos = (dim, m, o) => {
        const b = getAABB(o);
        if (!b) return new fabric.Point(0, 0);
        const s = scaleRef.current || 1;
        return new fabric.Point((b.minX + b.maxX) / 2, b.maxY + BOTTOM_ROTATE_GAP / s);
      };

      // Helper: detect circle-like objects (must keep 1:1 aspect)
      const isCircleLike = o =>
        !!o &&
        (o.isCircle === true ||
          o.type === 'circle' ||
          o.shapeType === 'round' ||
          o.shapeType === 'halfCircle');

      const applyDotVisualToControl = key => {
        try {
          const base =
            (obj.controls && obj.controls[key]) ||
            (fabric?.Object?.prototype?.controls ? fabric.Object.prototype.controls[key] : null);
          if (!base) return;

          const control = new fabric.Control({
            ...base,
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
          });

          Object.defineProperties(control, {
            sizeX: {
              get() {
                return 16 / (scaleRef.current || 1);
              },
            },
            sizeY: {
              get() {
                return 16 / (scaleRef.current || 1);
              },
            },
            touchSizeX: {
              get() {
                return 28 / (scaleRef.current || 1);
              },
            },
            touchSizeY: {
              get() {
                return 28 / (scaleRef.current || 1);
              },
            },
          });

          obj.controls[key] = control;
        } catch {}
      };

      // Resize handles: skip for Cut elements (only show action panel + rotate)
      if (!obj.isCutElement) {
        const circleLock = isCircleLike(obj);
        if (circleLock) {
          try {
            obj.lockUniScaling = true; // preserve 1:1 via Fabric constraint
          } catch {}
        }
        // Use standard Fabric controls so scaling math stays consistent for any rotation.
        // We only override visuals to keep our blue dot handles.
        ['tl', 'tr', 'bl', 'br', 'ml', 'mr', 'mt', 'mb'].forEach(applyDotVisualToControl);
      } else {
        // Cut elements: hide all resize handles
        if (obj.setControlsVisibility)
          obj.setControlsVisibility({
            tl: false,
            tr: false,
            bl: false,
            br: false,
            ml: false,
            mr: false,
            mt: false,
            mb: false,
            mtr: false,
          });
      }

      // Декоративний фон панелі як окремий control під іншими
      const panelBgKey = 'panel___bg';
      obj.controls[panelBgKey] = new fabric.Control({
        positionHandler: topCenterPos,
        render: (ctx, left, top) => {
          const s = scaleRef.current || 1;
          const wCss = 163,
            hCss = 33;
          const w = wCss / s,
            h = hCss / s;
          const x = left - w / 2,
            y = top - h / 2;
          const r = 4 / s;
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.lineWidth = 1 / s;
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        },
        cursorStyle: 'default',
        sizeX: 1,
        sizeY: 1,
        touchSizeX: 1,
        touchSizeY: 1,
        actionHandler: () => false,
      });

      // Панель з 5 кнопок (іконки поверх фону)
      const BUTTONS = [
        {
          key: 'a',
          render: aIconRenderer,
          handler: copyHandler, // теперь: режим редактирования текста / no-op
          // курсор зададим динамічно нижче через cursorStyleHandler
          w: 24,
          h: 24,
        },
        {
          key: 'b',
          render: bIconRenderer,
          handler: centerHorizontallyHandler,
          cursor: 'pointer',
          w: 24,
          h: 24,
        },
        {
          key: 'c',
          render: cIconRenderer,
          handler: centerVerticallyHandler,
          cursor: 'pointer',
          w: 24,
          h: 24,
        },
        {
          key: 'duplicate',
          render: duplicateIconRenderer,
          handler: duplicateHandler,
          cursor: 'pointer',
          w: 24,
          h: 24,
        },
        {
          key: 'delete',
          render: deleteIconRenderer,
          handler: deleteHandler,
          cursor: 'pointer',
          w: 24,
          h: 24,
        },
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
        const control = new fabric.Control({
          positionHandler,
          cursorStyle: btn.cursor || 'pointer',
          mouseUpHandler: (evt, transform) => {
            btn.handler(evt, transform);
            return true;
          },
          render: btn.render,
          sizeX: (btn.w || PANEL_BUTTON_DIAMETER) / (scaleRef.current || 1),
          sizeY: (btn.h || PANEL_BUTTON_DIAMETER) / (scaleRef.current || 1),
        });
        if (btn.key === 'a') {
          // Динамический курсор: 'text' для редактируемого текста, иначе 'default'
          control.cursorStyleHandler = (_e, t) => {
            const target = t?.target || obj;
            const canEdit = target && typeof target.enterEditing === 'function';
            return canEdit ? 'text' : 'default';
          };
        }
        obj.controls['panel_' + btn.key] = control;
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

    fCanvas.on('selection:created', e => {
      const o = e.selected?.[0];
      if (o) {
        if (isHole(o)) {
          try {
            fCanvas.discardActiveObject();
          } catch {}
          setActiveObject(null);
          setShapePropertiesOpen(false);
          return;
        }
        ensureActionControls(o);
        fCanvas.requestRenderAll();
      }
    });
    fCanvas.on('selection:updated', e => {
      const o = e.selected?.[0];
      if (o) {
        if (isHole(o)) {
          try {
            fCanvas.discardActiveObject();
          } catch {}
          setActiveObject(null);
          setShapePropertiesOpen(false);
          return;
        }
        ensureActionControls(o);
        fCanvas.requestRenderAll();
      }
    });

    // Прапор масштабування для показу підказки + фіксація 1:1 для кіл
    fCanvas.on('object:scaling', e => {
      const t = e?.target;
      if (!t) return;
      try {
        const isCircleLike =
          t.isCircle === true ||
          t.type === 'circle' ||
          t.shapeType === 'round' ||
          t.shapeType === 'halfCircle';
        if (isCircleLike) {
          const sx = Math.abs(t.scaleX || 1);
          const sy = Math.abs(t.scaleY || 1);
          // Вибираємо домінуючу вісь за натиснутою ручкою, щоб уникнути "стрибка" з боковими ручками
          const corner = (e && e.transform && e.transform.corner) || '';
          let s;
          if (corner === 'ml' || corner === 'mr' || corner === 'mlc' || corner === 'mrc') {
            s = sx; // тягнемо горизонтальну середину
          } else if (corner === 'mt' || corner === 'mb' || corner === 'mtc' || corner === 'mbc') {
            s = sy; // тягнемо вертикальну середину
          } else {
            s = Math.max(sx, sy); // для кутів — як було
          }
          t.scaleX = s;
          t.scaleY = s;
        }
      } catch {}

      // Keep rounded-rect corners circular under non-uniform scaling.
      // The canvas rounding (clipPath) is defined in canvas coordinates, so we emulate that
      // by adjusting local rx/ry against the current scale.
      try {
        const isRoundedRect =
          t.type === 'rect' &&
          (t.shapeType === 'roundedCorners' ||
            typeof t.rx === 'number' ||
            typeof t.ry === 'number');
        if (isRoundedRect) {
          const rMmRaw =
            t.displayCornerRadiusMm !== undefined
              ? Number(t.displayCornerRadiusMm)
              : Number(t.cornerRadiusMm);
          const rMm = Number.isFinite(rMmRaw) ? Math.max(0, rMmRaw) : 0;
          if (rMm > 0) {
            const rPx = Math.round(rMm * PX_PER_MM);
            const sx = Math.max(1e-6, Math.abs(Number(t.scaleX) || 1));
            const sy = Math.max(1e-6, Math.abs(Number(t.scaleY) || 1));
            const maxRx = Math.max(0, (Number(t.width) || 0) / 2 - 0.001);
            const maxRy = Math.max(0, (Number(t.height) || 0) / 2 - 0.001);
            const nextRx = Math.max(0, Math.min(rPx / sx, maxRx));
            const nextRy = Math.max(0, Math.min(rPx / sy, maxRy));
            t.set?.({ rx: nextRx, ry: nextRy });
          }
        }
      } catch {}

      // Snapping while resizing (scaling)
      try {
        if (!isHole(t)) {
          const corner = (e && e.transform && e.transform.corner) || '';
          const { dxEdge, dyEdge, guides } = computeScaleSnap(t, corner);
          const applyDx = applySnapDelta(dxEdge);
          const applyDy = applySnapDelta(dyEdge);
          if (applyDx || applyDy) {
            const b = getAABB(t);
            if (b) {
              const w = Math.max(1e-6, b.maxX - b.minX);
              const h = Math.max(1e-6, b.maxY - b.minY);
              const cx = (b.minX + b.maxX) / 2;
              const cy = (b.minY + b.maxY) / 2;
              let nextCx = cx;
              let nextCy = cy;
              let factorX = 1;
              let factorY = 1;

              if (applyDx && (corner.includes('r') || corner.includes('l'))) {
                if (corner.includes('r')) {
                  // move right edge; left edge anchored
                  const desiredW = Math.max(1e-6, w + applyDx);
                  factorX = desiredW / w;
                  nextCx = cx + applyDx / 2;
                } else if (corner.includes('l')) {
                  // move left edge; right edge anchored
                  const desiredW = Math.max(1e-6, w - applyDx);
                  factorX = desiredW / w;
                  nextCx = cx + applyDx / 2;
                }
              }
              if (applyDy && (corner.includes('b') || corner.includes('t'))) {
                if (corner.includes('b')) {
                  // move bottom edge; top edge anchored
                  const desiredH = Math.max(1e-6, h + applyDy);
                  factorY = desiredH / h;
                  nextCy = cy + applyDy / 2;
                } else if (corner.includes('t')) {
                  // move top edge; bottom edge anchored
                  const desiredH = Math.max(1e-6, h - applyDy);
                  factorY = desiredH / h;
                  nextCy = cy + applyDy / 2;
                }
              }

              // Apply factors to scale while preserving sign
              try {
                const sx = Number(t.scaleX) || 1;
                const sy = Number(t.scaleY) || 1;
                const signX = sx >= 0 ? 1 : -1;
                const signY = sy >= 0 ? 1 : -1;
                t.scaleX = signX * Math.abs(sx) * factorX;
                t.scaleY = signY * Math.abs(sy) * factorY;
              } catch {}

              // Reposition via center point so originX/Y don't matter
              try {
                const newCenter = new fabric.Point(nextCx, nextCy);
                t.setPositionByOrigin(newCenter, 'center', 'center');
              } catch {}
              try {
                t.setCoords && t.setCoords();
              } catch {}
            }
          }
          t.__snapGuides = guides;
        }
      } catch {}

      t.__isScaling = true;
      t.__wasScaling = true;
      if (t.__scaleExpireTimer) {
        try {
          clearTimeout(t.__scaleExpireTimer);
        } catch {}
        t.__scaleExpireTimer = null;
      }
      t.__scaleLabelExpireAt = null;
      try {
        fCanvas.requestRenderAll();
      } catch {}
    });
    const clearScalingFlag = e => {
      const t = e?.target;
      if (!t) return;
      if (t.__isScaling) t.__isScaling = false;
      // Тримати підказку ще 1 секунду після завершення тягнення
      if (t.__wasScaling) {
        t.__wasScaling = false;
        t.__scaleLabelExpireAt = Date.now() + 1000;
        if (t.__scaleExpireTimer) {
          try {
            clearTimeout(t.__scaleExpireTimer);
          } catch {}
        }
        t.__scaleExpireTimer = setTimeout(() => {
          try {
            t.__scaleLabelExpireAt = null;
          } catch {}
          try {
            fCanvas.requestRenderAll();
          } catch {}
        }, 1000);
        try {
          fCanvas.requestRenderAll();
        } catch {}
      }
    };
    fCanvas.on('mouse:up', clearScalingFlag);
    fCanvas.on('object:modified', clearScalingFlag);

    // Top overlay: тільки рамка (фон панелі малюється як окремий control)
    const clearTop = () => {
      const ctx = fCanvas.getTopContext ? fCanvas.getTopContext() : fCanvas.contextTop;
      if (!ctx) return;
      ctx.clearRect(0, 0, fCanvas.getWidth(), fCanvas.getHeight());
    };
    // Draw a drop shadow outside the artboard (clipPath) on the top canvas so it isn't clipped
    const drawArtboardShadow = () => {
      const cp = fCanvas.clipPath;
      const ctx = fCanvas.getTopContext ? fCanvas.getTopContext() : fCanvas.contextTop;
      if (!ctx || !cp) return;

      const s = scaleRef.current || 1; // CSS scale factor
      const blurCss = 24; // desired blur in CSS px
      const offsetCssX = 0;
      const offsetCssY = 8;
      const blur = Math.max(0, blurCss / s);
      const offX = offsetCssX / s;
      const offY = offsetCssY / s;

      // Helper to draw rounded rect path
      const drawRoundedRect = (x, y, w, h, rx = 0, ry = 0) => {
        const rr = Math.max(0, Math.min(rx || 0, w / 2));
        const ry2 = Math.max(0, Math.min(ry || rr, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + w - rr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + ry2);
        ctx.lineTo(x + w, y + h - ry2);
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        ctx.lineTo(x + rr, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - ry2);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };

      // First pass: draw shape with shadow, then punch out fill so only the halo remains
      ctx.save();
      try {
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = blur;
        ctx.shadowOffsetX = offX;
        ctx.shadowOffsetY = offY;
        ctx.fillStyle = 'rgba(0,0,0,1)'; // temporary

        let drew = false;
        if (cp.type === 'rect') {
          const sx = cp.scaleX || 1,
            sy = cp.scaleY || 1;
          const x = cp.left || 0;
          const y = cp.top || 0;
          const w = (cp.width || 0) * sx;
          const h = (cp.height || 0) * sy;
          const rx = cp.rx || 0,
            ry = cp.ry != null ? cp.ry : cp.rx || 0;
          drawRoundedRect(x, y, w, h, rx, ry);
          ctx.fill();
          drew = true;
        } else if (cp.type === 'circle') {
          const sx = cp.scaleX || 1,
            sy = cp.scaleY || 1;
          const r = cp.radius || 0;
          const w = r * 2 * sx;
          const h = r * 2 * sy;
          const cx = (cp.left || 0) + w / 2;
          const cy = (cp.top || 0) + h / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.max(0.01, w / 2), Math.max(0.01, h / 2), 0, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fill();
          drew = true;
        } else if (cp.type === 'ellipse') {
          const sx = cp.scaleX || 1,
            sy = cp.scaleY || 1;
          const rx = (cp.rx || 0) * sx;
          const ry = (cp.ry || 0) * sy;
          const cx = (cp.left || 0) + rx;
          const cy = (cp.top || 0) + ry;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fill();
          drew = true;
        } else if (cp.type === 'polygon' && Array.isArray(cp.points)) {
          const sx = cp.scaleX || 1,
            sy = cp.scaleY || 1;
          const pts = cp.points;
          if (pts.length > 0) {
            ctx.beginPath();
            ctx.moveTo((cp.left || 0) + pts[0].x * sx, (cp.top || 0) + pts[0].y * sy);
            for (let i = 1; i < pts.length; i++) {
              ctx.lineTo((cp.left || 0) + pts[i].x * sx, (cp.top || 0) + pts[i].y * sy);
            }
            ctx.closePath();
            ctx.fill();
            drew = true;
          }
        } else if (cp.type === 'path') {
          try {
            const svg = typeof cp.toSVG === 'function' ? cp.toSVG() : '';
            const match = svg && svg.match(/ d=\"([^\"]+)\"/);
            if (match && match[1]) {
              const p2 = new Path2D(match[1]);
              ctx.fill(p2);
              drew = true;
            }
          } catch {}
        }
        if (!drew) {
          const baseW = (designRef.current && designRef.current.width) || fCanvas.getWidth();
          const baseH = (designRef.current && designRef.current.height) || fCanvas.getHeight();
          drawRoundedRect(0, 0, baseW, baseH, 0, 0);
          ctx.fill();
        }

        // Punch out inner fill: keep only the halo
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,1)';

        if (cp.type === 'rect') {
          const sx = cp.scaleX || 1,
            sy = cp.scaleY || 1;
          const x = cp.left || 0;
          const y = cp.top || 0;
          const w = (cp.width || 0) * sx;
          const h = (cp.height || 0) * sy;
          const rx = cp.rx || 0,
            ry = cp.ry != null ? cp.ry : cp.rx || 0;
          drawRoundedRect(x, y, w, h, rx, ry);
          ctx.fill();
        } else if (cp.type === 'circle') {
          const sx = cp.scaleX || 1,
            sy = cp.scaleY || 1;
          const r = cp.radius || 0;
          const w = r * 2 * sx;
          const h = r * 2 * sy;
          const cx = (cp.left || 0) + w / 2;
          const cy = (cp.top || 0) + h / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.max(0.01, w / 2), Math.max(0.01, h / 2), 0, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fill();
        } else if (cp.type === 'ellipse') {
          const sx = cp.scaleX || 1,
            sy = cp.scaleY || 1;
          const rx = (cp.rx || 0) * sx;
          const ry = (cp.ry || 0) * sy;
          const cx = (cp.left || 0) + rx;
          const cy = (cp.top || 0) + ry;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fill();
        } else if (cp.type === 'polygon' && Array.isArray(cp.points)) {
          const sx = cp.scaleX || 1,
            sy = cp.scaleY || 1;
          const pts = cp.points;
          if (pts.length > 0) {
            ctx.beginPath();
            ctx.moveTo((cp.left || 0) + pts[0].x * sx, (cp.top || 0) + pts[0].y * sy);
            for (let i = 1; i < pts.length; i++) {
              ctx.lineTo((cp.left || 0) + pts[i].x * sx, (cp.top || 0) + pts[i].y * sy);
            }
            ctx.closePath();
            ctx.fill();
          }
        } else if (cp.type === 'path') {
          try {
            const svg2 = typeof cp.toSVG === 'function' ? cp.toSVG() : '';
            const match2 = svg2 && svg2.match(/ d=\"([^\"]+)\"/);
            if (match2 && match2[1]) {
              const p22 = new Path2D(match2[1]);
              ctx.fill(p22);
            }
          } catch {}
        } else {
          const baseW = (designRef.current && designRef.current.width) || fCanvas.getWidth();
          const baseH = (designRef.current && designRef.current.height) || fCanvas.getHeight();
          drawRoundedRect(0, 0, baseW, baseH, 0, 0);
          ctx.fill();
        }
      } finally {
        ctx.restore();
        // Reset comp op to default for following overlays
        ctx.globalCompositeOperation = 'source-over';
      }
    };
    // DOM shadow host sync: keep same size/pos as Fabric CSS box and render an SVG shadow for clipPath
    const syncShadowHost = () => {
      const shadowHost = shadowHostRef.current;
      const outlineHost = outlineHostRef.current;
      const el = canvasRef.current;
      if (!el) return;
      try {
        // CSS-computed sizes/position
        const wrapper = (shadowHost || outlineHost)?.parentElement;
        const canvasRect = el.getBoundingClientRect();
        const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : { left: 0, top: 0 };
        const cssWpx = Math.max(0, canvasRect.width);
        const cssHpx = Math.max(0, canvasRect.height);
        const cp = fCanvas.clipPath;
        const ds = typeof fCanvas.getDesignSize === 'function' ? fCanvas.getDesignSize() : null;
        const baseW = (ds && ds.width) || fCanvas.getWidth();
        const baseH = (ds && ds.height) || fCanvas.getHeight();
        const s = baseW ? cssWpx / baseW : 1;

        // Shadow style in CSS pixels
        const blurCss = 24;
        const offsetCssY = 8;
        const shadowColor = 'rgba(0,0,0,0.25)';

        // Host size/position: match canvas box exactly and follow its position
        const hostLeft = canvasRect.left - (wrapperRect.left || 0);
        const hostTop = canvasRect.top - (wrapperRect.top || 0);
        if (shadowHost) {
          shadowHost.style.width = `${cssWpx}px`;
          shadowHost.style.height = `${cssHpx}px`;
          shadowHost.style.left = `${hostLeft}px`;
          shadowHost.style.top = `${hostTop}px`;
        }
        if (outlineHost) {
          // Fixed visible outline thickness (2 CSS px)
          const strokeCss = 2;
          const pad = strokeCss / 2;
          outlineHost.style.width = `${cssWpx + strokeCss}px`;
          outlineHost.style.height = `${cssHpx + strokeCss}px`;
          outlineHost.style.left = `${hostLeft - pad}px`;
          outlineHost.style.top = `${hostTop - pad}px`;
        }

        // Render shadow SVG matching clipPath geometry in CSS pixels
        // Keep SVG the same size as canvas but allow overflow so the halo can extend out.
        const svgW = cssWpx;
        const svgH = cssHpx;
        const svgHeader = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="overflow: visible; shape-rendering: geometricPrecision;">`;
        let shapePath = '';
        if (cp && cp.type === 'rect') {
          // Build rect to exactly match the CSS canvas box; compute corner radii by ratio so they scale correctly
          const designW = (cp.width || 0) * (cp.scaleX || 1) || baseW || 1;
          const designH = (cp.height || 0) * (cp.scaleY || 1) || baseH || 1;
          const rxRatio = (cp.rx || 0) / Math.max(1, cp.width || 0);
          const rySrc = cp.ry != null ? cp.ry : cp.rx || 0;
          const ryRatio = rySrc / Math.max(1, cp.height || 0);
          const rxCss = Math.max(0, rxRatio) * cssWpx;
          const ryCss = Math.max(0, ryRatio) * cssHpx;
          shapePath = `<rect x="0" y="0" width="${cssWpx}" height="${cssHpx}" rx="${rxCss}" ry="${ryCss}"/>`;
        } else if (cp && (cp.type === 'circle' || cp.type === 'ellipse')) {
          const b = typeof cp.getBoundingRect === 'function' ? cp.getBoundingRect(true) : null;
          if (b) {
            const cx = b.left * s + (b.width * s) / 2;
            const cy = b.top * s + (b.height * s) / 2;
            const rx = (b.width * s) / 2;
            const ry = (b.height * s) / 2;
            shapePath = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
          }
        } else if (cp && cp.type === 'polygon' && Array.isArray(cp.points)) {
          // Без змін координат: масштабуємо тільки канву в CSS (s)
          const pts = cp.points.map(p => `${p.x * s},${p.y * s}`).join(' ');
          shapePath = `<polygon points="${pts}"/>`;
        } else if (cp && typeof cp.toSVG === 'function') {
          // Без змін координат: лише масштаб по осях, без переносу
          try {
            const svg = cp.toSVG();
            const m = svg && svg.match(/ d=\"([^\"]+)\"/);
            if (m && m[1]) {
              const scaleX = (cp.scaleX || 1) * s;
              const scaleY = (cp.scaleY || 1) * s;
              shapePath = `<path d="${m[1]}" transform="matrix(${scaleX} 0 0 ${scaleY} 0 0)"/>`;
            }
          } catch {}
        }
        if (!shapePath) {
          // fallback to full artboard rect (with padding offset)
          shapePath = `<rect x="0" y="0" width="${cssWpx}" height="${cssHpx}"/>`;
        }

        // Build SVGs: one for shadow (under canvas), one for outline (above canvas)
        const id = 'abShadowFilter';
        const filter = `
          <defs>
            <filter id="${id}" x="-100%" y="-100%" width="300%" height="300%" color-interpolation-filters="sRGB" primitiveUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="${offsetCssY}" stdDeviation="${
                blurCss / 2
              }" flood-color="${shadowColor}" flood-opacity="1"/>
            </filter>
            <mask id="cutout" maskUnits="userSpaceOnUse">
              <rect x="-10000" y="-10000" width="20000" height="20000" fill="white"/>
              ${shapePath.replace(/\/>$/, ' fill="black"/>')}
            </mask>
          </defs>`;
        if (shadowHost) {
          const shadowBody = `
            <g filter="url(#${id})" mask="url(#cutout)">
              ${shapePath}
            </g>`;
          shadowHost.innerHTML = svgHeader + filter + shadowBody + '</svg>';
        }
        if (outlineHost) {
          // Use constant 2 CSS px stroke like rectangle branch for uniform visual thickness
          const strokeLocal = 2;
          const strokeColor = '#000000';
          const pad = strokeLocal / 2;
          const outW = cssWpx + strokeLocal;
          const outH = cssHpx + strokeLocal;
          const outlineSvgHeader = `<svg width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}" xmlns="http://www.w3.org/2000/svg" style="overflow: visible; shape-rendering: geometricPrecision;">`;
          // Apply vector-effect directly on shape (important for <path> with transform)
          const shapePathVE = shapePath.replace(/\/>$/, ' vector-effect="non-scaling-stroke"/>');
          const outlineBody = `
            <g fill="none" stroke="${strokeColor}" stroke-width="${strokeLocal}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" transform="translate(${pad}, ${pad})">
              ${shapePathVE}
            </g>`;
          outlineHost.innerHTML = outlineSvgHeader + outlineBody + '</svg>';
        }
      } catch {}
    };

    const drawFrame = () => {
      const active = fCanvas.getActiveObject();
      const ctx = fCanvas.getTopContext ? fCanvas.getTopContext() : fCanvas.contextTop;
      if (!ctx || !active) return;
      const ac = active.aCoords;
      if (!ac || !ac.tl || !ac.tr || !ac.br || !ac.bl) return;
      const xs = [ac.tl.x, ac.tr.x, ac.br.x, ac.bl.x];
      const ys = [ac.tl.y, ac.tr.y, ac.br.y, ac.bl.y];
      const minX = Math.min(...xs),
        maxX = Math.max(...xs),
        minY = Math.min(...ys),
        maxY = Math.max(...ys);
      const s = scaleRef.current || 1;
      ctx.save();
      ctx.strokeStyle = outlineColorRef.current || OUTLINE_COLOR;
      ctx.lineWidth = OUTLINE_WIDTH_CSS / s;
      ctx.setLineDash([]);
      // Draw oriented frame along the object's corners (not AABB).
      ctx.beginPath();
      ctx.moveTo(ac.tl.x, ac.tl.y);
      ctx.lineTo(ac.tr.x, ac.tr.y);
      ctx.lineTo(ac.br.x, ac.br.y);
      ctx.lineTo(ac.bl.x, ac.bl.y);
      ctx.closePath();
      ctx.stroke();

      // Blue snap guides (drag snapping) — across whole artboard
      try {
        const guides = active.__snapGuides;
        if (guides && (guides.x != null || guides.y != null)) {
          const W = (designRef.current && designRef.current.width) || fCanvas.getWidth();
          const H = (designRef.current && designRef.current.height) || fCanvas.getHeight();
          ctx.save();
          ctx.setLineDash([6 / s, 4 / s]);
          ctx.strokeStyle = 'rgba(0, 108, 164, 1)';
          ctx.lineWidth = 2 / s;
          if (guides.x != null) {
            ctx.beginPath();
            ctx.moveTo(guides.x, 0);
            ctx.lineTo(guides.x, H);
            ctx.stroke();
          }
          if (guides.y != null) {
            ctx.beginPath();
            ctx.moveTo(0, guides.y);
            ctx.lineTo(W, guides.y);
            ctx.stroke();
          }
          ctx.restore();
        }
      } catch {}
      // Якщо об'єкт зафіксовано по горизонталі — малюємо синю пунктирну лінію по центру
      if (active.__snappedHorizontal) {
        const midY = (minY + maxY) / 2;
        ctx.setLineDash([6 / s, 4 / s]);
        ctx.strokeStyle = 'rgba(0, 108, 164, 1)'; // синій індикатор
        ctx.lineWidth = 2 / s;
        ctx.beginPath();
        ctx.moveTo(minX - 20 / s, midY);
        ctx.lineTo(maxX + 20 / s, midY);
        ctx.stroke();
      }
      // Якщо об'єкт зафіксовано по вертикалі — малюємо синю пунктирну лінію по центру
      if (active.__snappedVertical) {
        const midX = (minX + maxX) / 2;
        ctx.setLineDash([6 / s, 4 / s]);
        ctx.strokeStyle = 'rgba(0, 108, 164, 1)'; // синій індикатор
        ctx.lineWidth = 2 / s;
        ctx.beginPath();
        ctx.moveTo(midX, minY - 20 / s);
        ctx.lineTo(midX, maxY + 20 / s);
        ctx.stroke();
      }

      // Пунктирні лінії на 1 секунду після центровання — через ВСЕ полотно (дизайн-область)
      const nowTs2 = Date.now();
      const W = (designRef.current && designRef.current.width) || fCanvas.getWidth();
      const H = (designRef.current && designRef.current.height) || fCanvas.getHeight();
      // Горизонтальна лінія по центру полотна (Y): якщо центрували по вертикалі/Y
      if (
        typeof active.__centerFlashHExpireAt === 'number' &&
        nowTs2 < active.__centerFlashHExpireAt
      ) {
        const midY = H / 2;
        ctx.setLineDash([6 / s, 4 / s]);
        ctx.strokeStyle = 'rgba(0, 108, 164, 1)';
        ctx.lineWidth = 2 / s;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(W, midY);
        ctx.stroke();
      }
      if (
        typeof active.__centerFlashVExpireAt === 'number' &&
        nowTs2 < active.__centerFlashVExpireAt
      ) {
        const midX = W / 2;
        ctx.setLineDash([6 / s, 4 / s]);
        ctx.strokeStyle = 'rgba(0, 108, 164, 1)';
        ctx.lineWidth = 2 / s;
        ctx.beginPath();
        ctx.moveTo(midX, 0);
        ctx.lineTo(midX, H);
        ctx.stroke();
      }

      // Підказка розміру під час розтягування та 1 секунду після
      const nowTs = Date.now();
      const showSizeHint =
        active.__isScaling ||
        (typeof active.__scaleLabelExpireAt === 'number' && nowTs < active.__scaleLabelExpireAt);
      if (showSizeHint) {
        const wPx = Math.max(
          0,
          typeof active.getScaledWidth === 'function' ? active.getScaledWidth() : maxX - minX
        );
        const hPx = Math.max(
          0,
          typeof active.getScaledHeight === 'function' ? active.getScaledHeight() : maxY - minY
        );
        const wMm = pxToMm(wPx).toFixed(1);
        const hMm = pxToMm(hPx).toFixed(1);
        const label = `${wMm} × ${hMm} mm`;

        // Внутрішня бейджка у верхньому лівому куті рамки
        const padX = 8 / s;
        const padY = 5 / s;
        const r = 4 / s;
        ctx.font = `${14 / s}px sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        const textW = ctx.measureText(label).width;
        const textH = 16 / s; // приблизна висота рядка
        const boxW = textW + padX * 2;
        const boxH = textH + padY * 2;
        const x = minX + 8 / s;
        const y = minY + 8 / s;

        // скруглений прямокутник
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + boxW - r, y);
        ctx.quadraticCurveTo(x + boxW, y, x + boxW, y + r);
        ctx.lineTo(x + boxW, y + boxH - r);
        ctx.quadraticCurveTo(x + boxW, y + boxH, x + boxW - r, y + boxH);
        ctx.lineTo(x + r, y + boxH);
        ctx.quadraticCurveTo(x, y + boxH, x, y + boxH - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fill();
        ctx.lineWidth = 1 / s;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();

        // текст
        ctx.fillStyle = '#fff';
        // трохи обвідки для контрасту на будь-якому фоні
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineWidth = 2 / s;
        ctx.strokeText(label, x + padX, y + padY);
        ctx.fillText(label, x + padX, y + padY);
      }

      // Если активен режим редактирования текста, рисуем панель действий поверх (для видимости во время редактирования)
      try {
        const isText = active && ['i-text', 'text', 'textbox'].includes(active.type);
        const isEditing = !!active.isEditing; // fabric.IText флаг редактирования
        if (isText && isEditing) {
          // Фон панели
          const panelWcss = 163,
            panelHcss = 33;
          const panelW = panelWcss / s,
            panelH = panelHcss / s;
          const panelCx = (minX + maxX) / 2;
          const panelCy = minY - TOP_PANEL_GAP / s;
          const px = panelCx - panelW / 2;
          const py = panelCy - panelH / 2;
          const pr = 4 / s;
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.lineWidth = 1 / s;
          ctx.beginPath();
          ctx.moveTo(px + pr, py);
          ctx.lineTo(px + panelW - pr, py);
          ctx.quadraticCurveTo(px + panelW, py, px + panelW, py + pr);
          ctx.lineTo(px + panelW, py + panelH - pr);
          ctx.quadraticCurveTo(px + panelW, py + panelH, px + panelW - pr, py + panelH);
          ctx.lineTo(px + pr, py + panelH);
          ctx.quadraticCurveTo(px, py + panelH, px, py + panelH - pr);
          ctx.lineTo(px, py + pr);
          ctx.quadraticCurveTo(px, py, px + pr, py);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // Иконки A, B, C, duplicate, delete (не интерактивны в overlay, чисто визуально)
          const buttonsCount = 5;
          const step = PANEL_BUTTON_DIAMETER + PANEL_BUTTON_GAP; // CSS px
          const centerIndex = (buttonsCount - 1) / 2;
          const baseX = panelCx;
          const baseY = panelCy;
          const iconAt = index => {
            const cssOffsetX = (index - centerIndex) * step;
            return {
              x: baseX + cssOffsetX / s,
              y: baseY,
            };
          };
          // Порядок: A, B, C, duplicate, delete
          const posA = iconAt(0);
          const posB = iconAt(1);
          const posC = iconAt(2);
          const posDup = iconAt(3);
          const posDel = iconAt(4);

          // Рендерим SVG-иконки повторно через те же рендеры, что и в controls
          try {
            // A
            if (typeof aIconRenderer === 'function') aIconRenderer(ctx, posA.x, posA.y);
            // B
            if (typeof bIconRenderer === 'function') bIconRenderer(ctx, posB.x, posB.y);
            // C
            if (typeof cIconRenderer === 'function') cIconRenderer(ctx, posC.x, posC.y);
            // Duplicate
            if (typeof duplicateIconRenderer === 'function')
              duplicateIconRenderer(ctx, posDup.x, posDup.y);
            // Delete
            if (typeof deleteIconRenderer === 'function')
              deleteIconRenderer(ctx, posDel.x, posDel.y);
          } catch {}
        }
      } catch {}
      ctx.restore();
    };
    fCanvas.on('before:render', clearTop);
    fCanvas.on('after:render', () => {
      try {
        syncShadowHost();
      } catch {}
    });
    fCanvas.on('after:render', drawFrame);
    // Also refresh shadow when display scale changes (CSS zoom of the canvas box)
    const onDisplayScale = () => {
      try {
        syncShadowHost();
      } catch {}
    };
    fCanvas.on('display:scale', onDisplayScale);

    // Забезпечити появу контролів одразу при додаванні і автоматичному виборі
    fCanvas.on('object:added', e => {
      const target = e.target;
      if (!target) return;
      if (isHole(target)) {
        hardenHole(target);
        return; // не робимо активним
      }
      try {
        const fromShapeTab =
          target.fromShapeTab === true || (target.data && target.data.fromShapeTab === true);
        if (fromShapeTab) {
          ensureShapeSvgId(target, fCanvas);
        }
      } catch {}
      // Правило шарів: текст завжди поверх усіх інших фігур
      try {
        if (isTextObj(target)) {
          bringCanvasObjectToFront(target);
        } else {
          const texts = (fCanvas.getObjects?.() || []).filter(isTextObj);
          texts.forEach(t => bringCanvasObjectToFront(t));
        }
      } catch {}
      // Якщо додано Cut-форму (з блоку Cut) — одразу активуємо і малюємо панель/рамку
      try {
        if (target.isCutElement === true && target.cutType === 'shape') {
          // Фіксовані розміри для фігур з Cut-модалки: забороняємо масштабування
          try {
            target.set({
              lockScalingX: true,
              lockScalingY: true,
              lockUniScaling: true,
            });
          } catch {}
          fCanvas.setActiveObject(target);
          ensureActionControls(target);
          setShapePropertiesOpen(false);
          fCanvas.requestRenderAll();
          return;
        }
      } catch {}
      // Якщо додано з IconMenu — одразу робимо активним та показуємо панель
      try {
        if (target.fromIconMenu === true || (target.data && target.data.fromIconMenu === true)) {
          fCanvas.setActiveObject(target);
          ensureActionControls(target);
          setShapePropertiesOpen(false);
          fCanvas.requestRenderAll();
          return;
        }
      } catch {}
      // Для halfCircle зберігаємо базові розміри bbox при першому додаванні
      try {
        if (target.shapeType === 'halfCircle') {
          if (!target.__baseBBoxW) target.__baseBBoxW = target.width;
          if (!target.__baseBBoxH) target.__baseBBoxH = target.height;
        }
      } catch {}
      // Ensure text objects compute aCoords before applying controls
      if (typeof target.setCoords === 'function') {
        try {
          target.setCoords();
        } catch {}
      }
      const active = fCanvas.getActiveObject();
      if (active && active === target) {
        ensureActionControls(active);
        fCanvas.requestRenderAll();
      }
    });

    // Блокуємо переміщення отворів навіть якщо вони якось стали активними
    fCanvas.on('object:moving', e => {
      const t = e.target;
      if (isHole(t)) {
        try {
          t.set({ left: t._lastLeft ?? t.left, top: t._lastTop ?? t.top });
        } catch {}
        return false;
      } else if (t) {
        t._lastLeft = t.left;
        t._lastTop = t.top;
      }

      // Drag snapping for regular objects
      if (!t) return;
      try {
        const { dx, dy, guides } = computeDragSnap(t);
        const applyDx = applySnapDelta(dx);
        const applyDy = applySnapDelta(dy);
        if (applyDx || applyDy) {
          try {
            t.set({
              left: (Number(t.left) || 0) + applyDx,
              top: (Number(t.top) || 0) + applyDy,
            });
          } catch {}
          try {
            t.setCoords && t.setCoords();
          } catch {}
        }
        t.__snapGuides = guides;
      } catch {}
    });

    const clearSnapGuides = e => {
      try {
        const t = e?.target || (fCanvas.getActiveObject && fCanvas.getActiveObject());
        if (t && t.__snapGuides) t.__snapGuides = null;
      } catch {}
      try {
        fCanvas.requestRenderAll();
      } catch {}
    };
    fCanvas.on('mouse:up', clearSnapGuides);
    fCanvas.on('object:modified', clearSnapGuides);

    // Додатковий запобіжник: не дозволяти масштабування Cut-формам з модалки
    fCanvas.on('object:scaling', e => {
      const t = e?.target;
      if (t && t.isCutElement === true && t.cutType === 'shape') {
        try {
          // Відкочуємо спробу масштабування
          t.set({
            scaleX: t._lastScaleX ?? t.scaleX,
            scaleY: t._lastScaleY ?? t.scaleY,
          });
          t.setCoords && t.setCoords();
        } catch {}
        return false;
      } else if (t) {
        t._lastScaleX = t.scaleX;
        t._lastScaleY = t.scaleY;
      }
    });

    return () => {
      window.removeEventListener('resize', resizeToViewport);
      fCanvas.off('before:render', clearTop);
      fCanvas.off('after:render', drawFrame);
      fCanvas.off('display:scale', onDisplayScale);
      fCanvas.off('object:rotating', onRotatingSnap);
      fCanvas.off('object:scaling');
      fCanvas.off('mouse:up');
      fCanvas.off('object:modified');
      fCanvas.off('object:added');
      fCanvas.dispose();
      if (canvasRef.current) canvasRef.current.__fabricCanvas = undefined;
    };
  }, [setCanvas, setActiveObject, setShapePropertiesOpen]);

  // Оновлення кольору рамки: фіксований акцентний синій, не залежить від теми
  useEffect(() => {
    outlineColorRef.current = OUTLINE_COLOR;
    try {
      canvas && canvas.requestRenderAll();
    } catch {}
  }, [canvas]);

  useEffect(() => {
    if (!canvas) return;

    // НЕ застосовуємо фон під час перемикання canvas
    // Фон буде відновлено з збереженого стану в ProjectCanvasesGrid
    if (canvas.__switching || canvas.__ignoreNextBackgroundUpdate || canvas.__suspendUndoRedo) {
      console.log('[Canvas] Skipping background apply:', {
        switching: canvas.__switching,
        ignoreFlag: canvas.__ignoreNextBackgroundUpdate,
        suspended: canvas.__suspendUndoRedo,
        requestedBg: globalColors?.backgroundColor,
        requestedType: globalColors?.backgroundType,
      });
      return;
    }

    let disposed = false;

    const refreshActiveObject = () => {
      if (disposed) return;
      try {
        const active = canvas.getActiveObject?.();
        if (active && typeof active.setCoords === 'function') {
          active.setCoords();
        }
      } catch {}
      canvas.renderAll();
    };

    const applySolid = color => {
      const nextColor = color || '#FFFFFF';
      const currentType = canvas.get('backgroundType');
      const currentTexture = canvas.get('backgroundTextureUrl');
      const currentColor =
        typeof canvas.backgroundColor === 'string' ? canvas.backgroundColor : null;

      if (currentType === 'solid' && currentTexture == null && currentColor === nextColor) {
        refreshActiveObject();
        return;
      }

      canvas.set('backgroundColor', nextColor);
      canvas.set('backgroundType', 'solid');
      canvas.set('backgroundTextureUrl', null);
      refreshActiveObject();
    };

    const applyGradient = () => {
      try {
        const W = typeof canvas.getWidth === 'function' ? canvas.getWidth() : canvas.width || 0;
        const H = typeof canvas.getHeight === 'function' ? canvas.getHeight() : canvas.height || 0;
        const off = document.createElement('canvas');
        off.width = Math.max(1, W);
        off.height = Math.max(1, H);
        const ctx = off.getContext('2d');
        const cssDeg = 152.22;
        const rad = (cssDeg * Math.PI) / 180;
        const dirX = Math.sin(rad);
        const dirY = -Math.cos(rad);
        const cx = W / 2;
        const cy = H / 2;
        const L = Math.abs(W * dirX) + Math.abs(H * dirY);
        const x0 = cx - (dirX * L) / 2;
        const y0 = cy - (dirY * L) / 2;
        const x1 = cx + (dirX * L) / 2;
        const y1 = cy + (dirY * L) / 2;
        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        grad.addColorStop(0.2828, '#B5B5B5');
        grad.addColorStop(0.5241, '#F5F5F5');
        grad.addColorStop(0.7414, '#979797');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        const pattern = new fabric.Pattern({
          source: off,
          repeat: 'no-repeat',
        });
        canvas.set('backgroundColor', pattern);
        canvas.set('backgroundType', 'gradient');
        canvas.set('backgroundTextureUrl', null);
        refreshActiveObject();
      } catch {
        applySolid(globalColors?.backgroundColor);
      }
    };

    const applyTexture = url => {
      if (!url) {
        applySolid(undefined);
        return;
      }

      const currentType = canvas.get('backgroundType');
      const currentTexture = canvas.get('backgroundTextureUrl');
      const currentIsPattern = canvas.backgroundColor && typeof canvas.backgroundColor === 'object';

      if (currentType === 'texture' && currentTexture === url && currentIsPattern) {
        refreshActiveObject();
        return;
      }

      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';

      // ВИПРАВЛЕННЯ: Зберігаємо URL для перевірки при onload
      const requestedUrl = url;

      img.onload = () => {
        if (disposed) return;

        // ВИПРАВЛЕННЯ: Перевіряємо чи canvas все ще очікує цю текстуру
        if (canvas.__switching || canvas.__suspendUndoRedo) {
          console.log('[Canvas] applyTexture.onload - skipping, canvas switching');
          return;
        }

        // Перевіряємо чи URL все ще актуальний
        const currentType = canvas.get('backgroundType');
        const currentUrl = canvas.get('backgroundTextureUrl');
        if (currentType === 'texture' && currentUrl && currentUrl !== requestedUrl) {
          console.log('[Canvas] applyTexture.onload - skipping stale texture:', {
            requestedUrl,
            currentUrl,
          });
          return;
        }

        try {
          const canvasWidth =
            typeof canvas.getWidth === 'function' ? canvas.getWidth() : canvas.width || 0;
          const canvasHeight =
            typeof canvas.getHeight === 'function' ? canvas.getHeight() : canvas.height || 0;

          const scaleX = canvasWidth && img.width ? canvasWidth / img.width : 1;
          const scaleY = canvasHeight && img.height ? canvasHeight / img.height : 1;

          const patternCanvas = document.createElement('canvas');
          patternCanvas.width = img.width * scaleX;
          patternCanvas.height = img.height * scaleY;
          const patternCtx = patternCanvas.getContext('2d');
          if (!patternCtx) {
            applySolid(undefined);
            return;
          }
          patternCtx.drawImage(img, 0, 0, patternCanvas.width, patternCanvas.height);

          const pattern = new fabric.Pattern({
            source: patternCanvas,
            repeat: 'no-repeat',
          });

          canvas.set('backgroundColor', pattern);
          canvas.set('backgroundTextureUrl', url);
          canvas.set('backgroundType', 'texture');
          refreshActiveObject();
        } catch (error) {
          console.error('Failed to apply texture background:', error);
          applySolid(undefined);
        }
      };
      img.onerror = () => {
        if (disposed) return;
        console.error('Failed to load texture background:', url);
        applySolid(undefined);
      };
      img.src = url;
    };

    const type = globalColors?.backgroundType;
    const color = globalColors?.backgroundColor;

    // ВИПРАВЛЕННЯ: Перевіряємо чи globalColors відповідають поточному стану canvas
    // Якщо canvas вже має правильний фон - не застосовуємо повторно
    const currentCanvasBgType = canvas.get('backgroundType') || 'solid';
    const currentCanvasBgUrl = canvas.get('backgroundTextureUrl');
    const currentCanvasBgColor =
      typeof canvas.backgroundColor === 'string'
        ? canvas.backgroundColor
        : currentCanvasBgUrl || null;

    // Якщо globalColors намагаються застосувати текстуру, а canvas вже має solid фон
    // і це НЕ та сама текстура - пропускаємо (це може бути старий globalColors від іншого canvas)
    if (type === 'texture' && currentCanvasBgType === 'solid') {
      console.log(
        '[Canvas] Skipping texture apply - canvas has solid background, might be stale globalColors'
      );
      return;
    }

    // Якщо globalColors намагаються застосувати іншу текстуру ніж поточна
    if (
      type === 'texture' &&
      currentCanvasBgType === 'texture' &&
      currentCanvasBgUrl &&
      currentCanvasBgUrl !== color
    ) {
      console.log('[Canvas] Skipping texture apply - canvas already has different texture');
      return;
    }

    if (type === 'gradient') {
      applyGradient();
    } else if (type === 'texture') {
      applyTexture(color);
    } else {
      applySolid(color);
    }

    return () => {
      disposed = true;
    };
  }, [canvas, globalColors?.backgroundColor, globalColors?.backgroundType]);

  // Авто-синхронізація кольорів QR/BarCode при зміні теми
  useEffect(() => {
    if (!canvas) return;

    // НЕ перегенеровуємо QR коди під час завантаження canvas з бази даних
    // Це робиться в restoreElementProperties
    if (canvas.__switching || canvas.__suspendUndoRedo) {
      console.log('[Canvas] Skipping QR/BarCode sync - canvas switching or suspended');
      return;
    }

    const textColor = globalColors?.textColor || '#000000';
    const backgroundType = globalColors?.backgroundType || 'solid';
    const barcodeBackground =
      backgroundType === 'texture' || backgroundType === 'gradient'
        ? 'transparent'
        : globalColors?.backgroundColor || '#FFFFFF';
    const objs = canvas.getObjects?.() || [];
    // Перефарбовуємо усі об'єкти, що позначені як залежні від кольору теми
    try {
      const applyThemeColor = obj => {
        if (!obj) return;
        if (obj.type === 'group' && typeof obj.forEachObject === 'function') {
          obj.forEachObject(applyThemeColor);
        }
        if (obj.useThemeColor) {
          try {
            obj.set({ fill: textColor, stroke: textColor });
          } catch {}
        }
      };
      objs.forEach(applyThemeColor);
      canvas.requestRenderAll?.();
    } catch {}
    const qrs = objs.filter(o => o.isQRCode && o.qrText);
    const bars = objs.filter(o => o.isBarCode && o.barCodeText && o.barCodeType);
    if (qrs.length === 0 && bars.length === 0) return;

    let disposed = false;
    const run = async () => {
      canvas.__suspendUndoRedo = true;
      try {
        // Перегенерація QR
        for (const o of qrs) {
          const { left, top, scaleX, scaleY, angle, originX, originY } = o;
          let svgText;
          let qrSizePx = 0;
          try {
            // Використовуємо qrcode-generator для повного контролю
            const qrGenerator = (await import('qrcode-generator')).default;
            const qr = qrGenerator(0, 'M');
            qr.addData(o.qrText);
            qr.make();

            const cellSize = DEFAULT_QR_CELL_SIZE;
            const { optimizedPath, displayPath, size } = computeQrVectorData(qr, cellSize);

            svgText = buildQrSvgMarkup({
              size,
              displayPath,
              optimizedPath,
              strokeColor: textColor,
            });
            qrSizePx = size;
          } catch {
            continue;
          }
          if (disposed) return;
          try {
            const res = await fabric.loadSVGFromString(svgText);
            const obj =
              res?.objects?.length === 1
                ? res.objects[0]
                : fabric.util.groupSVGElements(res.objects || [], res.options || {});
            decorateQrGroup(obj);
            obj.set({
              left,
              top,
              scaleX,
              scaleY,
              angle,
              originX: originX || 'center',
              originY: originY || 'center',
              selectable: true,
              hasControls: true,
              hasBorders: true,
              isQRCode: true,
              qrText: o.qrText,
              qrSize: qrSizePx || o.qrSize || obj.width || 0,
              qrColor: textColor,
              backgroundColor: 'transparent',
            });
            const arr = canvas.getObjects();
            const idx = arr.indexOf(o);
            const wasActive = canvas.getActiveObject() === o;
            canvas.add(obj);
            try {
              if (typeof obj.setCoords === 'function') obj.setCoords();
            } catch {}
            if (typeof canvas.moveTo === 'function') canvas.moveTo(obj, idx);
            if (wasActive) {
              try {
                canvas.setActiveObject(obj);
              } catch {}
            }
            canvas.remove(o);
            // Доп. оновлення у наступному кадрі — для коректних aCoords перед малюванням контролів
            try {
              requestAnimationFrame(() => {
                try {
                  if (!canvas || !obj) return;
                  if (wasActive) canvas.setActiveObject(obj);
                  if (typeof obj.setCoords === 'function') obj.setCoords();
                  canvas.requestRenderAll();
                } catch {}
              });
            } catch {}
          } catch {}
        }

        // Перегенерація BarCode
        for (const o of bars) {
          const { left, top, scaleX, scaleY, angle, originX, originY } = o;
          const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          try {
            JsBarcode(svgEl, o.barCodeText, {
              format: o.barCodeType,
              width: 2,
              height: 100,
              displayValue: false,
              fontSize: 14,
              textMargin: 5,
              margin: 0, // removed outer padding
              background: barcodeBackground,
              lineColor: textColor,
            });
            const serializer = new XMLSerializer();
            const svgText = serializer.serializeToString(svgEl);
            const res = await fabric.loadSVGFromString(svgText);
            const obj =
              res?.objects?.length === 1
                ? res.objects[0]
                : fabric.util.groupSVGElements(res.objects || [], res.options || {});
            obj.set({
              left,
              top,
              scaleX,
              scaleY,
              angle,
              originX: originX || 'center',
              originY: originY || 'center',
              selectable: true,
              hasControls: true,
              hasBorders: true,
              isBarCode: true,
              barCodeText: o.barCodeText,
              barCodeType: o.barCodeType,
              fill: textColor,
              barCodeColor: textColor,
            });
            const arr = canvas.getObjects();
            const idx = arr.indexOf(o);
            const wasActive = canvas.getActiveObject() === o;
            canvas.add(obj);
            try {
              if (typeof obj.setCoords === 'function') obj.setCoords();
            } catch {}
            if (typeof canvas.moveTo === 'function') canvas.moveTo(obj, idx);
            if (wasActive) {
              try {
                canvas.setActiveObject(obj);
              } catch {}
            }
            canvas.remove(o);
            try {
              requestAnimationFrame(() => {
                try {
                  if (!canvas || !obj) return;
                  if (wasActive) canvas.setActiveObject(obj);
                  if (typeof obj.setCoords === 'function') obj.setCoords();
                  canvas.requestRenderAll();
                } catch {}
              });
            } catch {}
          } catch {}
        }
      } finally {
        canvas.__suspendUndoRedo = false;
        canvas.requestRenderAll();
      }
    };

    run();
    return () => {
      disposed = true;
    };
  }, [
    canvas,
    globalColors?.textColor,
    globalColors?.backgroundColor,
    globalColors?.backgroundType,
  ]);

  const isLockShape = canvasShapeType === 'lock';
  const scaleFactor = scaleRef.current || scale || 1;
  const lockArchDesignPx = isLockShape ? LOCK_ARCH_HEIGHT_MM * PX_PER_MM : 0;
  const lockArchCss = isLockShape ? lockArchDesignPx * scaleFactor : 0;
  const heightLabelHeightPx = isLockShape ? Math.max(0, cssHeight - lockArchCss) : cssHeight;
  const heightLabelMarginTopPx = isLockShape ? lockArchCss : 0;
  const heightLabelMm = (() => {
    const rawMm = pxToMm(displayHeight);
    const adjusted = isLockShape ? rawMm - LOCK_ARCH_HEIGHT_MM : rawMm;
    return Math.max(0, adjusted);
  })();

  return (
    <div className={`${styles.viewport} ${className || ''}`} ref={viewportRef}>
      <div className={styles.canvasWrapper}>
        <div ref={shadowHostRef} className={styles.shadowHost} />
        <canvas ref={canvasRef} className={styles.canvas} />
        {/* <div ref={outlineHostRef} className={styles.outlineHost} /> */}
        <div className={styles.widthLabel}>
          <span>{pxToMm(displayWidth).toFixed(0)} mm</span>
        </div>
        <div
          className={styles.heightLabel}
          style={{
            height: `${heightLabelHeightPx}px`,
            marginTop: isLockShape ? `${heightLabelMarginTopPx}px` : undefined,
          }}
        >
          <span>{heightLabelMm.toFixed(0)} mm</span>
        </div>
      </div>
    </div>
  );
};

export default Canvas;
// Экспортируем copyHandler для использования в других компонентах
export const copyHandler = async (evt, transform) => {
  const target = transform?.target;
  if (!target) return true;
  // Определяем, можно ли редактировать текст напрямую
  const canEditText = typeof target.enterEditing === 'function';
  if (!canEditText) {
    // Ничего не делаем для не-текста
    return true;
  }
  try {
    // Явно разрешаем вход в редактирование, минуя запрет одиночного клика
    target.__allowNextEditing = true;
    target.enterEditing && target.enterEditing();
    const txt = typeof target.text === 'string' ? target.text : '';
    // Устанавливаем selectionStart/End через hiddenTextarea, если доступно
    try {
      // Фокус на скрытую textarea, если доступна
      if (target.hiddenTextarea && typeof target.hiddenTextarea.focus === 'function') {
        const ta = target.hiddenTextarea;
        // Немедленно применим стили, чтобы нативная каретка не мигала
        try {
          ta.setAttribute('data-fabric-hidden-textarea', '1');
          ta.style.caretColor = 'transparent';
          ta.style.color = 'transparent';
          ta.style.background = 'transparent';
          ta.style.border = '0';
          ta.style.outline = 'none';
          ta.style.position = 'fixed';
          ta.style.top = '-10000px';
          ta.style.left = '-10000px';
          ta.style.width = '0';
          ta.style.height = '0';
          ta.style.opacity = '0';
          ta.style.pointerEvents = 'none';
        } catch {}
        ta.focus();
        // После фокусировки явно ставим курсор в конец через fabric методы
        setTimeout(() => {
          try {
            const len = txt.length;
            if (typeof target.setSelectionStart === 'function') {
              target.setSelectionStart(len);
            }
            if (typeof target.setSelectionEnd === 'function') {
              target.setSelectionEnd(len);
            }
          } catch {}
        }, 0);
      }
    } catch {}
    if (typeof target.canvas?.requestRenderAll === 'function') {
      target.canvas.requestRenderAll();
    }
  } catch {}
  return true;
};
