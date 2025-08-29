// (Corrupted duplicate block removed above – clean implementation below)
import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import JsBarcode from "jsbarcode";
import { useCanvasContext } from "../../contexts/CanvasContext";
import styles from "./Canvas.module.css";

// Відступи в межах viewport
const MARGIN = 40;
const DEFAULT_DESIGN = { width: 1200, height: 800 };
// Unit conversion (96 DPI)
const PX_PER_MM = 96 / 25.4;
const pxToMm = (px) => (typeof px === "number" ? px / PX_PER_MM : 0);

// Параметри панелі керування
const TOP_PANEL_GAP = 25; // від рамки до центру кнопок (CSS px)
const BOTTOM_ROTATE_GAP = 25; // від рамки до центру кнопки обертання
const PANEL_BUTTON_DIAMETER = 24; // діаметр кнопки
const PANEL_BUTTON_GAP = 8; // проміжок між кнопками

// Стиль рамки
const OUTLINE_COLOR = "rgba(21, 157, 255, 1)";
const OUTLINE_WIDTH_CSS = 2;

const Canvas = () => {
  const canvasRef = useRef(null);
  const viewportRef = useRef(null);
  const designRef = useRef(DEFAULT_DESIGN);
  const {
    setCanvas,
    setActiveObject,
    setShapePropertiesOpen,
    isCustomShapeMode,
    globalColors,
    canvas,
  } = useCanvasContext();
  const resizingRef = useRef(false);
  const scaleRef = useRef(1);

  const [displayWidth, setDisplayWidth] = useState(DEFAULT_DESIGN.width);
  const [displayHeight, setDisplayHeight] = useState(DEFAULT_DESIGN.height);
  const [cssHeight, setCssHeight] = useState(DEFAULT_DESIGN.height);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    // Guard від подвійної ініціалізації
    if (canvasRef.current && canvasRef.current.__fabricCanvas) {
      try {
        canvasRef.current.__fabricCanvas.dispose();
      } catch {}
      canvasRef.current.__fabricCanvas = undefined;
    }

    const fCanvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: "#f5f5f5",
      selection: true,
      enableRetinaScaling: true,
    });
    if (canvasRef.current) canvasRef.current.__fabricCanvas = fCanvas;
    setCanvas(fCanvas);

    // Події вибору
    const isHole = (o) => !!o && o.isCutElement && o.cutType === "hole";
    const isShapeWithProps = (o) =>
      !!o &&
      ["path", "rect", "circle", "ellipse"].includes(o.type) &&
      !isHole(o);

    const isFromIconMenu = (o) =>
      !!o &&
      (o.fromIconMenu === true || (o.data && o.data.fromIconMenu === true));
    const handleSelection = (e) => {
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
      // IconMenu elements: never open Shape Properties
      if (obj && isFromIconMenu(obj)) {
        setActiveObject(obj);
        setShapePropertiesOpen(false);
        return;
      }
      if (isShapeWithProps(obj)) {
        setActiveObject(obj);
        // Не відкривати модалку Shape Properties в режимі кастомної фігури та для іконок з IconMenu
        if (!isCustomShapeMode && !isFromIconMenu(obj))
          setShapePropertiesOpen(true);
      }
    };
    fCanvas.on("selection:created", handleSelection);
    fCanvas.on("selection:updated", handleSelection);
    fCanvas.on("selection:cleared", () => {
      setActiveObject(null);
      setShapePropertiesOpen(false);
    });

    fCanvas.on("mouse:down", (e) => {
      const t = e.target;
      if (isHole(t)) return; // ігноруємо кліки по отворах
      // IconMenu elements: активуємо без відкриття Shape Properties
      if (t && isFromIconMenu(t)) {
        setActiveObject(t);
        setShapePropertiesOpen(false);
        return;
      }
      if (isShapeWithProps(t)) {
        setActiveObject(t);
        if (!isCustomShapeMode && !isFromIconMenu(t))
          setShapePropertiesOpen(true);
        return;
      }
      // По кліку на текст: лише активуємо (панель намалюється в selection:created/updated)
      if (
        t &&
        (t.type === "i-text" || t.type === "text" || t.type === "textbox")
      ) {
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
    fCanvas.on("mouse:dblclick", (e) => {
      const t = e.target;
      if (
        t &&
        (t.type === "i-text" || t.type === "text" || t.type === "textbox")
      ) {
        try {
          t.__allowNextEditing = true;
          if (typeof t.enterEditing === "function") t.enterEditing();
          const len = (t.text || "").length;
          if (typeof t.setSelectionStart === "function")
            t.setSelectionStart(len);
          if (typeof t.setSelectionEnd === "function") t.setSelectionEnd(len);
          if (t.hiddenTextarea && typeof t.hiddenTextarea.focus === "function")
            t.hiddenTextarea.focus();
          fCanvas.requestRenderAll();
        } catch {}
      }
    });

    // Заборона авто-редагування, якщо не дозволено (щоб панель не зникала після одинарного кліку)
    fCanvas.on("text:editing:entered", (e) => {
      const t = e?.target;
      if (
        t &&
        (t.type === "i-text" || t.type === "text" || t.type === "textbox")
      ) {
        if (!t.__allowNextEditing) {
          try {
            if (typeof t.exitEditing === "function") t.exitEditing();
          } catch {}
          try {
            fCanvas.setActiveObject(t);
            ensureActionControls(t);
            fCanvas.requestRenderAll();
          } catch {}
        } else {
          // спожити дозвіл тільки для цього входу
          t.__allowNextEditing = false;
        }
      }
    });

    const mirrorIfPath = (e) => {
      if (e.target && isShapeWithProps(e.target))
        setActiveObject({ ...e.target });
    };
    [
      "object:modified",
      "object:scaling",
      "object:rotating",
      "object:moving",
    ].forEach((evt) => fCanvas.on(evt, mirrorIfPath));

    // Утиліта: зробити отвір статичним (неклікабельним і нерухомим)
    const hardenHole = (o) => {
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
    const normalizeDeg = (ang) => ((ang % 360) + 360) % 360;
    const snapAngleHorizontal = (ang) => {
      const a = normalizeDeg(ang || 0);
      if (a < SNAP_THRESHOLD_DEG || 360 - a < SNAP_THRESHOLD_DEG) return 0;
      if (Math.abs(a - 180) < SNAP_THRESHOLD_DEG) return 180;
      return null;
    };
    const snapAngleVertical = (ang) => {
      const a = normalizeDeg(ang || 0);
      if (Math.abs(a - 90) < SNAP_THRESHOLD_DEG) return 90;
      if (Math.abs(a - 270) < SNAP_THRESHOLD_DEG) return 270;
      return null;
    };
    const onRotatingSnap = (e) => {
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
        t.set("angle", targetAngle);
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
    fCanvas.on("object:rotating", onRotatingSnap);

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
      try {
        fCanvas.fire("display:scale", { scale: scaleToFit });
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
    fCanvas.setDisplayScale = (percent) => {
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
  const cssW = Math.max(1, Math.round(baseW * factor));
  const cssH = Math.max(1, Math.round(baseH * factor));

      // Adjust effective retina scaling similarly to auto-fit
      const dpr = window.devicePixelRatio || 1;
  const maxBoost = 4;
  const boost = Math.min(Math.max(1, factor), maxBoost);
      const effectiveRetina = dpr * boost;
      fCanvas.getRetinaScaling = () => effectiveRetina;

      // Keep internal canvas size at design pixels; scale visually via CSS box
      resizingRef.current = true;
      originalSetDimensions({ width: baseW, height: baseH });
      resizingRef.current = false;
      fCanvas.setZoom(1);
      fCanvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });

      // Update state + notify listeners
      setDisplayWidth(baseW);
      setDisplayHeight(baseH);
      setCssHeight(cssH);
      setScale(factor);
      scaleRef.current = factor;
      fCanvas.calcOffset();
      fCanvas.renderAll();
      try {
        fCanvas.fire("display:scale", { scale: factor });
      } catch {}
      return clamped;
    };

    fCanvas.setDimensions = (dimensions, options) => {
      const result = originalSetDimensions(dimensions, options);
      if (options && options.cssOnly) return result;
      const nextW = dimensions?.width ?? designRef.current.width;
      const nextH = dimensions?.height ?? designRef.current.height;
      if (
        !resizingRef.current &&
        typeof nextW === "number" &&
        typeof nextH === "number"
      ) {
        designRef.current = { width: nextW, height: nextH };
        resizingRef.current = true;
        try {
          // Run synchronously so labels (width/height) reflect new size immediately
          resizeToViewport();
        } finally {
          resizingRef.current = false;
        }
      }
      return result;
    };

    resizeToViewport();
    window.addEventListener("resize", resizeToViewport);

    // Рендерери контролів
    const makeTextBadgeRenderer = (symbol) => (ctx, left, top) => {
      ctx.save();
      const s = scaleRef.current || 1;
      const r = 12 / s;
      ctx.beginPath();
      ctx.arc(left, top, r, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1 / s;
      ctx.stroke();
      ctx.fillStyle = "#333";
      ctx.font = `${16 / s}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
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
          img.src = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
          cache.img = img;
        }
        const w = targetW / s;
        const h = targetH / s;
        ctx.save();
        if (cache.img && (cache.img.complete || cache.loaded)) {
          ctx.drawImage(cache.img, left - w / 2, top - h / 2, w, h);
        } else {
          // fallback placeholder box
          ctx.fillStyle = "#eee";
          ctx.strokeStyle = "#999";
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
        img.src = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
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
        ctx.fillStyle = "#159DFF";
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
          ctx.fillStyle = "rgba(21,157,255,1)";
          ctx.fill();
          ctx.lineWidth = 1 / s;
          ctx.strokeStyle = "#fff";
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
        const cloned = await target.clone();
        // Preserve IconMenu flag so modal stays closed for clones
        try {
          const isFromIcon =
            target.fromIconMenu === true ||
            (target.data && target.data.fromIconMenu === true);
          if (isFromIcon) {
            cloned.fromIconMenu = true;
            if (!cloned.data) cloned.data = {};
            cloned.data.fromIconMenu = true;
          }
        } catch {}
        const nextLeft = (target.left || 0) + 10;
        const nextTop = (target.top || 0) + 10;
        cloned.set({ left: nextLeft, top: nextTop });
        if (typeof cloned.setCoords === "function") {
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
          if (
            cloned.fromIconMenu === true ||
            (cloned.data && cloned.data.fromIconMenu === true)
          ) {
            setShapePropertiesOpen(false);
          }
        } catch {}
        fCanvas.requestRenderAll();
      } catch {}
      return true;
    };
    // Копіювання без буфера обміну: додає такий самий елемент зі зміщенням +10 вправо і -10 вгору
    const copyHandler = async (evt, transform) => {
      const target = transform?.target;
      if (!target) return true;
      try {
        const cloned = await target.clone();
        // Preserve IconMenu flag so modal stays closed for clones
        try {
          const isFromIcon =
            target.fromIconMenu === true ||
            (target.data && target.data.fromIconMenu === true);
          if (isFromIcon) {
            cloned.fromIconMenu = true;
            if (!cloned.data) cloned.data = {};
            cloned.data.fromIconMenu = true;
          }
        } catch {}
        // Зміщення: вправо на 10, вгору на 10
        const nextLeft = (target.left || 0) + 10;
        const nextTop = (target.top || 0) - 10;
        cloned.set({ left: nextLeft, top: nextTop });
        if (typeof cloned.setCoords === "function") {
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
          if (
            cloned.fromIconMenu === true ||
            (cloned.data && cloned.data.fromIconMenu === true)
          ) {
            setShapePropertiesOpen(false);
          }
        } catch {}
        fCanvas.requestRenderAll();
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
        const newCenter = new fabric.Point(
          currentCenter.x,
          (H || fCanvas.getHeight()) / 2
        );
        t.setPositionByOrigin(newCenter, "center", "center");
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
        const newCenter = new fabric.Point(
          (W || fCanvas.getWidth()) / 2,
          currentCenter.y
        );
        t.setPositionByOrigin(newCenter, "center", "center");
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
    const ensureActionControls = (obj) => {
      if (!obj || !obj.controls) return;
      // Ensure coordinates exist (text objects can lack aCoords right after creation)
      if (typeof obj.setCoords === "function") {
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
      if (!Object.prototype.hasOwnProperty.call(obj, "controls")) {
        obj.controls = { ...obj.controls };
      }
      obj.hasBorders = false;
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
      const cu = fabric.controlsUtils;

      // Axis-aligned bounding box helpers
      const getAABB = (o) => {
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
      const corner = (which) => (dim, m, o) => {
        const b = getAABB(o);
        if (!b) return new fabric.Point(0, 0);
        return new fabric.Point(
          which.includes("l") ? b.minX : b.maxX,
          which.includes("t") ? b.minY : b.maxY
        );
      };
      const mid = (axis) => (dim, m, o) => {
        const b = getAABB(o);
        if (!b) return new fabric.Point(0, 0);
        if (axis === "x")
          return new fabric.Point((b.minX + b.maxX) / 2, b.minY);
        if (axis === "x2")
          return new fabric.Point((b.minX + b.maxX) / 2, b.maxY);
        if (axis === "y")
          return new fabric.Point(b.minX, (b.minY + b.maxY) / 2);
        return new fabric.Point(b.maxX, (b.minY + b.maxY) / 2);
      };
      const topCenterPos = (dim, m, o) => {
        const b = getAABB(o);
        if (!b) return new fabric.Point(0, 0);
        const s = scaleRef.current || 1;
        return new fabric.Point(
          (b.minX + b.maxX) / 2,
          b.minY - TOP_PANEL_GAP / s
        );
      };
      const bottomCenterPos = (dim, m, o) => {
        const b = getAABB(o);
        if (!b) return new fabric.Point(0, 0);
        const s = scaleRef.current || 1;
        return new fabric.Point(
          (b.minX + b.maxX) / 2,
          b.maxY + BOTTOM_ROTATE_GAP / s
        );
      };

      // 4 кути
      obj.controls.tlc = makeDotControl(cu.scalingEqually, "nwse-resize");
      obj.controls.tlc.positionHandler = corner("lt");
      obj.controls.trc = makeDotControl(cu.scalingEqually, "nesw-resize");
      obj.controls.trc.positionHandler = corner("rt");
      obj.controls.blc = makeDotControl(cu.scalingEqually, "nesw-resize");
      obj.controls.blc.positionHandler = corner("lb");
      obj.controls.brc = makeDotControl(cu.scalingEqually, "nwse-resize");
      obj.controls.brc.positionHandler = corner("rb");
      // 4 середини
      obj.controls.mtc = makeDotControl(cu.scalingY, "ns-resize");
      obj.controls.mtc.positionHandler = mid("x");
      obj.controls.mbc = makeDotControl(cu.scalingY, "ns-resize");
      obj.controls.mbc.positionHandler = mid("x2");
      obj.controls.mlc = makeDotControl(cu.scalingX, "ew-resize");
      obj.controls.mlc.positionHandler = mid("y");
      obj.controls.mrc = makeDotControl(cu.scalingX, "ew-resize");
      obj.controls.mrc.positionHandler = mid("y2");

      // Декоративний фон панелі як окремий control під іншими
      const panelBgKey = "panel___bg";
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
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.strokeStyle = "rgba(0,0,0,1)";
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
        cursorStyle: "default",
        sizeX: 1,
        sizeY: 1,
        touchSizeX: 1,
        touchSizeY: 1,
        actionHandler: () => false,
      });

      // Панель з 5 кнопок (іконки поверх фону)
      const BUTTONS = [
        {
          key: "a",
          render: aIconRenderer,
          handler: copyHandler,
          cursor: "pointer",
          w: 24,
          h: 24,
        },
        {
          key: "b",
          render: bIconRenderer,
          handler: centerHorizontallyHandler,
          cursor: "pointer",
          w: 24,
          h: 24,
        },
        {
          key: "c",
          render: cIconRenderer,
          handler: centerVerticallyHandler,
          cursor: "pointer",
          w: 24,
          h: 24,
        },
        {
          key: "duplicate",
          render: duplicateIconRenderer,
          handler: duplicateHandler,
          cursor: "pointer",
          w: 24,
          h: 24,
        },
        {
          key: "delete",
          render: deleteIconRenderer,
          handler: deleteHandler,
          cursor: "pointer",
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
        obj.controls["panel_" + btn.key] = new fabric.Control({
          positionHandler,
          cursorStyle: btn.cursor,
          mouseUpHandler: (evt, transform) => {
            btn.handler(evt, transform);
            return true;
          },
          render: btn.render,
          sizeX: (btn.w || PANEL_BUTTON_DIAMETER) / (scaleRef.current || 1),
          sizeY: (btn.h || PANEL_BUTTON_DIAMETER) / (scaleRef.current || 1),
        });
      });

      // Кнопка обертання
      obj.controls.rotatec = new fabric.Control({
        positionHandler: bottomCenterPos,
        cursorStyle: "crosshair",
        actionName: "rotate",
        actionHandler: fabric.controlsUtils.rotationWithSnapping,
        render: renderRotateIcon,
        sizeX: 36 / (scaleRef.current || 1),
        sizeY: 36 / (scaleRef.current || 1),
      });
    };

    fCanvas.on("selection:created", (e) => {
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
    fCanvas.on("selection:updated", (e) => {
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

    // Прапор масштабування для показу підказки
    fCanvas.on("object:scaling", (e) => {
      const t = e?.target;
      if (!t) return;
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
    const clearScalingFlag = (e) => {
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
    fCanvas.on("mouse:up", clearScalingFlag);
    fCanvas.on("object:modified", clearScalingFlag);

    // Top overlay: тільки рамка (фон панелі малюється як окремий control)
    const clearTop = () => {
      const ctx = fCanvas.getTopContext
        ? fCanvas.getTopContext()
        : fCanvas.contextTop;
      if (!ctx) return;
      ctx.clearRect(0, 0, fCanvas.getWidth(), fCanvas.getHeight());
    };
    const drawFrame = () => {
      const active = fCanvas.getActiveObject();
      const ctx = fCanvas.getTopContext
        ? fCanvas.getTopContext()
        : fCanvas.contextTop;
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
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = OUTLINE_WIDTH_CSS / s;
      ctx.setLineDash([]);
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      // Якщо об'єкт зафіксовано по горизонталі — малюємо синю пунктирну лінію по центру
      if (active.__snappedHorizontal) {
        const midY = (minY + maxY) / 2;
        ctx.setLineDash([6 / s, 4 / s]);
        ctx.strokeStyle = "rgba(0, 108, 164, 1)"; // синій індикатор
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
        ctx.strokeStyle = "rgba(0, 108, 164, 1)"; // синій індикатор
        ctx.lineWidth = 2 / s;
        ctx.beginPath();
        ctx.moveTo(midX, minY - 20 / s);
        ctx.lineTo(midX, maxY + 20 / s);
        ctx.stroke();
      }

      // Пунктирні лінії на 1 секунду після центровання — через ВСЕ полотно (дизайн-область)
      const nowTs2 = Date.now();
      const W =
        (designRef.current && designRef.current.width) || fCanvas.getWidth();
      const H =
        (designRef.current && designRef.current.height) || fCanvas.getHeight();
      // Горизонтальна лінія по центру полотна (Y): якщо центрували по вертикалі/Y
      if (
        typeof active.__centerFlashHExpireAt === "number" &&
        nowTs2 < active.__centerFlashHExpireAt
      ) {
        const midY = H / 2;
        ctx.setLineDash([6 / s, 4 / s]);
        ctx.strokeStyle = "rgba(0, 108, 164, 1)";
        ctx.lineWidth = 2 / s;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(W, midY);
        ctx.stroke();
      }
      // Вертикальна лінія по центру полотна (X): якщо центрували по горизонталі/X
      if (
        typeof active.__centerFlashVExpireAt === "number" &&
        nowTs2 < active.__centerFlashVExpireAt
      ) {
        const midX = W / 2;
        ctx.setLineDash([6 / s, 4 / s]);
        ctx.strokeStyle = "rgba(0, 108, 164, 1)";
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
        (typeof active.__scaleLabelExpireAt === "number" &&
          nowTs < active.__scaleLabelExpireAt);
      if (showSizeHint) {
        const wPx = Math.max(
          0,
          typeof active.getScaledWidth === "function"
            ? active.getScaledWidth()
            : maxX - minX
        );
        const hPx = Math.max(
          0,
          typeof active.getScaledHeight === "function"
            ? active.getScaledHeight()
            : maxY - minY
        );
        const wMm = pxToMm(wPx).toFixed(1);
        const hMm = pxToMm(hPx).toFixed(1);
        const label = `${wMm} × ${hMm} mm`;

        // Внутрішня бейджка у верхньому лівому куті рамки
        const padX = 8 / s;
        const padY = 5 / s;
        const r = 4 / s;
        ctx.font = `${14 / s}px sans-serif`;
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
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
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fill();
        ctx.lineWidth = 1 / s;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.stroke();

        // текст
        ctx.fillStyle = "#fff";
        // трохи обвідки для контрасту на будь-якому фоні
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.lineWidth = 2 / s;
        ctx.strokeText(label, x + padX, y + padY);
        ctx.fillText(label, x + padX, y + padY);
      }
      ctx.restore();
    };
    fCanvas.on("before:render", clearTop);
    fCanvas.on("after:render", drawFrame);

    // Забезпечити появу контролів одразу при додаванні і автоматичному виборі
    fCanvas.on("object:added", (e) => {
      const target = e.target;
      if (!target) return;
      if (isHole(target)) {
        hardenHole(target);
        return; // не робимо активним
      }
      // Якщо додано з IconMenu — одразу робимо активним та показуємо панель
      try {
        if (
          target.fromIconMenu === true ||
          (target.data && target.data.fromIconMenu === true)
        ) {
          fCanvas.setActiveObject(target);
          ensureActionControls(target);
          setShapePropertiesOpen(false);
          fCanvas.requestRenderAll();
          return;
        }
      } catch {}
      // Ensure text objects compute aCoords before applying controls
      if (typeof target.setCoords === "function") {
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
    fCanvas.on("object:moving", (e) => {
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
    });

    return () => {
      window.removeEventListener("resize", resizeToViewport);
      fCanvas.off("before:render", clearTop);
      fCanvas.off("after:render", drawFrame);
      fCanvas.off("object:rotating", onRotatingSnap);
      fCanvas.off("object:scaling");
      fCanvas.off("mouse:up");
      fCanvas.off("object:modified");
      fCanvas.off("object:added");
      fCanvas.dispose();
      if (canvasRef.current) canvasRef.current.__fabricCanvas = undefined;
    };
  }, [setCanvas, setActiveObject, setShapePropertiesOpen]);

  useEffect(() => {
    if (!canvas) return;
    canvas.set("backgroundColor", globalColors?.backgroundColor || "#FFFFFF");
    try {
      const active = canvas.getActiveObject?.();
      if (active && typeof active.setCoords === "function") {
        active.setCoords();
      }
    } catch {}
    canvas.renderAll();
  }, [canvas, globalColors?.backgroundColor]);

  // Авто-синхронізація кольорів QR/BarCode при зміні теми
  useEffect(() => {
    if (!canvas) return;
    const textColor = globalColors?.textColor || "#000000";
    const bgColor = globalColors?.backgroundColor || "#FFFFFF";
    const objs = canvas.getObjects?.() || [];
    const qrs = objs.filter((o) => o.isQRCode && o.qrText);
    const bars = objs.filter(
      (o) => o.isBarCode && o.barCodeText && o.barCodeType
    );
    if (qrs.length === 0 && bars.length === 0) return;

    let disposed = false;
    const run = async () => {
      canvas.__suspendUndoRedo = true;
      try {
        // Перегенерація QR
        for (const o of qrs) {
          const { left, top, scaleX, scaleY, angle, originX, originY } = o;
          let svgText;
          try {
            // Використовуємо qrcode-generator для повного контролю
            const qrGenerator = (await import('qrcode-generator')).default;
            const qr = qrGenerator(0, 'M');
            qr.addData(o.qrText);
            qr.make();
            
            const moduleCount = qr.getModuleCount();
            const cellSize = 4;
            const size = moduleCount * cellSize;
            
            // Створюємо SVG без quiet zone та мікровідступів
            let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">`;
            svg += `<rect width="${size}" height="${size}" fill="${bgColor}"/>`;
            
            // Модулі QR коду - використовуємо один великий path
            let pathData = '';
            for (let row = 0; row < moduleCount; row++) {
              for (let col = 0; col < moduleCount; col++) {
                if (qr.isDark(row, col)) {
                  const x = col * cellSize;
                  const y = row * cellSize;
                  pathData += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z`;
                }
              }
            }
            
            if (pathData) {
              svg += `<path d="${pathData}" fill="${textColor}" fill-rule="evenodd"/>`;
            }
            svg += '</svg>';
            svgText = svg;
          } catch {
            continue;
          }
          if (disposed) return;
          try {
            const res = await fabric.loadSVGFromString(svgText);
            const obj =
              res?.objects?.length === 1
                ? res.objects[0]
                : fabric.util.groupSVGElements(
                    res.objects || [],
                    res.options || {}
                  );
            obj.set({
              left,
              top,
              scaleX,
              scaleY,
              angle,
              originX: originX || "center",
              originY: originY || "center",
              selectable: true,
              hasControls: true,
              hasBorders: true,
              isQRCode: true,
              qrText: o.qrText,
            });
            const arr = canvas.getObjects();
            const idx = arr.indexOf(o);
            const wasActive = canvas.getActiveObject() === o;
            canvas.add(obj);
            if (typeof canvas.moveTo === "function") canvas.moveTo(obj, idx);
            if (wasActive) canvas.setActiveObject(obj);
            canvas.remove(o);
          } catch {}
        }

        // Перегенерація BarCode
        for (const o of bars) {
          const { left, top, scaleX, scaleY, angle, originX, originY } = o;
          const svgEl = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
          );
          try {
            JsBarcode(svgEl, o.barCodeText, {
              format: o.barCodeType,
              width: 2,
              height: 100,
              displayValue: true,
              fontSize: 14,
              textMargin: 5,
              margin: 0, // removed outer padding
              background: bgColor,
              lineColor: textColor,
            });
            const serializer = new XMLSerializer();
            const svgText = serializer.serializeToString(svgEl);
            const res = await fabric.loadSVGFromString(svgText);
            const obj =
              res?.objects?.length === 1
                ? res.objects[0]
                : fabric.util.groupSVGElements(
                    res.objects || [],
                    res.options || {}
                  );
            obj.set({
              left,
              top,
              scaleX,
              scaleY,
              angle,
              originX: originX || "center",
              originY: originY || "center",
              selectable: true,
              hasControls: true,
              hasBorders: true,
              isBarCode: true,
              barCodeText: o.barCodeText,
              barCodeType: o.barCodeType,
            });
            const arr = canvas.getObjects();
            const idx = arr.indexOf(o);
            const wasActive = canvas.getActiveObject() === o;
            canvas.add(obj);
            if (typeof canvas.moveTo === "function") canvas.moveTo(obj, idx);
            if (wasActive) canvas.setActiveObject(obj);
            canvas.remove(o);
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
  }, [canvas, globalColors?.textColor, globalColors?.backgroundColor]);

  return (
    <div className={styles.viewport} ref={viewportRef}>
      <div className={styles.canvasWrapper}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.widthLabel}>
          <span>{pxToMm(displayWidth).toFixed(1)} mm</span>
        </div>
        <div
          className={styles.heightLabel}
          style={{ height: `${cssHeight}px` }}
        >
          <span>{pxToMm(displayHeight).toFixed(1)} mm</span>
        </div>
      </div>
    </div>
  );
};

export default Canvas;
