import React, { useState, useEffect, useRef } from "react";
import { lockPolygonPoints } from "./lockShapePoints";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import paper from "paper";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import * as XLSX from "xlsx";
import UndoRedo from "../UndoRedo/UndoRedo"; // Імпорт компонента
import QRCodeGenerator from "../QRCodeGenerator/QRCodeGenerator";
import BarCodeGenerator from "../BarCodeGenerator/BarCodeGenerator";
import ShapeSelector from "../ShapeSelector/ShapeSelector";
import CutSelector from "../CutSelector/CutSelector";
import IconMenu from "../IconMenu/IconMenu";
import ShapeProperties from "../ShapeProperties/ShapeProperties";
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
  Hole7,
} from "../../assets/Icons";

// Local cache for inner stroke classes (не додаємо в fabric namespace)
let InnerStrokeRectClass = null;
let InnerStrokeCircleClass = null;
let InnerStrokeEllipseClass = null;
let InnerStrokePolygonClass = null;

const Toolbar = () => {
  const { canvas, globalColors, updateGlobalColors } = useCanvasContext();
  // Unit conversion helpers (assume CSS 96 DPI)
  const PX_PER_MM = 96 / 25.4;
  const mmToPx = (mm) => (typeof mm === "number" ? Math.round(mm * PX_PER_MM) : 0);
  const pxToMm = (px) => (typeof px === "number" ? px / PX_PER_MM : 0);
  // Единое округление до 1 знака после запятой для значений в мм (во избежание 5.1999999999)
  const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
  const [activeObject, setActiveObject] = useState(null);
  const [sizeValues, setSizeValues] = useState({
    // Store UI values in millimeters
    width: 150,
    height: 150,
    cornerRadius: 0,
  });
  const [currentShapeType, setCurrentShapeType] = useState(null); // Тип поточної фігури
  const [thickness, setThickness] = useState(1.6);
  const [isAdhesiveTape, setIsAdhesiveTape] = useState(false);
  const fileInputRef = useRef(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isBarCodeOpen, setIsBarCodeOpen] = useState(false);
  const [isShapeOpen, setIsShapeOpen] = useState(false);
  const [isCutOpen, setIsCutOpen] = useState(false);
  const [isIconMenuOpen, setIsIconMenuOpen] = useState(false);
  const [isShapePropertiesOpen, setIsShapePropertiesOpen] = useState(false);
  const [copiesCount, setCopiesCount] = useState(1);
  const [holesDiameter, setHolesDiameter] = useState(2.5);
  const [isHolesSelected, setIsHolesSelected] = useState(false);
  const [activeHolesType, setActiveHolesType] = useState(1); // 1..7, за замовчуванням — без отворів
  const [selectedColorIndex, setSelectedColorIndex] = useState(0); // Індекс обраного кольору (0 - перший колір за замовчуванням)
  // Set default selected shape on mount
  useEffect(() => {
    // Choose the default shape type, e.g., rectangle
    setCurrentShapeType("rectangle");
    // Call addRectangle to initialize the canvas with the default shape
    if (canvas) {
      addRectangle();
    }
  }, [canvas]);

  // Визначаємо, чи наразі вибране коло (для відключення Corner radius)
  const isCircleSelected =
    (activeObject &&
      (activeObject.type === "circle" || activeObject.isCircle)) ||
    currentShapeType === "circle" ||
    currentShapeType === "circleWithLine" ||
    currentShapeType === "circleWithCross";
  const addQrCode = () => {
    setIsQrOpen(true);
  };

  const addBarCode = () => {
    setIsBarCodeOpen(true);
  };

  const addShape = () => {
    setIsShapeOpen(true);
  };

  // Preserve current theme background when clearing/changing shape
  const clearCanvasPreserveTheme = () => {
    if (!canvas) return;
    const bg =
      canvas.backgroundColor ||
      canvas.get("backgroundColor") ||
      globalColors?.backgroundColor;
    canvas.clear();
    if (bg) canvas.set("backgroundColor", bg);
  };

  const openIconMenu = () => {
    setIsIconMenuOpen(true);
  };

  // Оновлення активного об'єкта та розмірів при зміні
  useEffect(() => {
    if (canvas) {
      const getLogicalCanvasSize = () => {
        if (typeof canvas.getDesignSize === "function") {
          return canvas.getDesignSize(); // returns px
        }
        const zoom =
          typeof canvas.getZoom === "function" ? canvas.getZoom() : 1;
        return {
          width: Math.round(canvas.getWidth() / (zoom || 1)),
          height: Math.round(canvas.getHeight() / (zoom || 1)),
        }; // px
      };

      canvas.on("selection:created", () => {
        const obj = canvas.getActiveObject();
        setActiveObject(obj);
        if (obj) {
          const wPx = Math.round(obj.width * obj.scaleX);
          const hPx = Math.round(obj.height * obj.scaleY);
          setSizeValues({
            width: Number(pxToMm(wPx).toFixed(1)),
            height: Number(pxToMm(hPx).toFixed(1)),
            cornerRadius: Number(pxToMm(obj.rx || 0).toFixed(1)),
          });
        }
      });
      canvas.on("selection:updated", () => {
        const obj = canvas.getActiveObject();
        setActiveObject(obj);
        if (obj) {
          const wPx = Math.round(obj.width * obj.scaleX);
          const hPx = Math.round(obj.height * obj.scaleY);
          setSizeValues({
            width: Number(pxToMm(wPx).toFixed(1)),
            height: Number(pxToMm(hPx).toFixed(1)),
            cornerRadius: Number(pxToMm(obj.rx || 0).toFixed(1)),
          });
        }
      });
      canvas.on("selection:cleared", () => {
        setActiveObject(null);
        // Коли нічого не вибрано, показуємо розміри canvas
        const sz = getLogicalCanvasSize();
        setSizeValues({
          width: Number(pxToMm(sz.width).toFixed(1)),
          height: Number(pxToMm(sz.height).toFixed(1)),
          cornerRadius: 0,
        });
      });
      canvas.on("object:modified", () => {
        const obj = canvas.getActiveObject();
        if (obj && !obj.isCutElement) {
          // Ігноруємо cut елементи
          const wPx = Math.round(obj.width * obj.scaleX);
          const hPx = Math.round(obj.height * obj.scaleY);
          setSizeValues({
            width: Number(pxToMm(wPx).toFixed(1)),
            height: Number(pxToMm(hPx).toFixed(1)),
            cornerRadius: Number(pxToMm(obj.rx || 0).toFixed(1)) || 0,
          });
        }
      });

      // Ініціалізуємо початкові значення розмірів canvas
      const sz = getLogicalCanvasSize();
      setSizeValues({
        width: Number(pxToMm(sz.width).toFixed(1)),
        height: Number(pxToMm(sz.height).toFixed(1)),
        cornerRadius: 0,
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

  // Застосовуємо дефолтну схему кольорів при завантаженні
  useEffect(() => {
    if (canvas) {
      updateColorScheme("#000000", "#FFFFFF", "solid", 0);
    }
  }, [canvas]);

  // Оновлення розмірів активного об'єкта або canvas
  // Helpers for rounded polygon clipPaths
  const clampRadiusForEdges = (points, r) => {
    if (!r || r <= 0) return 0;
    let minEdge = Infinity;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len > 0) minEdge = Math.min(minEdge, len);
    }
    const maxR = Math.max(0, minEdge / 2 - 0.001);
    return Math.max(0, Math.min(r, maxR));
  };

  const buildRoundedPolygonPath = (points, radius) => {
    if (!points || points.length < 3) return "";
    const r = clampRadiusForEdges(points, radius);
    if (r <= 0) {
      let d0 = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++)
        d0 += ` L ${points[i].x} ${points[i].y}`;
      d0 += " Z";
      return d0;
    }
    const n = points.length;
    let d = "";
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];

      const v1x = curr.x - prev.x,
        v1y = curr.y - prev.y;
      const v2x = next.x - curr.x,
        v2y = next.y - curr.y;
      const len1 = Math.hypot(v1x, v1y) || 1;
      const len2 = Math.hypot(v2x, v2y) || 1;
      const u1x = v1x / len1,
        u1y = v1y / len1;
      const u2x = v2x / len2,
        u2y = v2y / len2;

      const p1x = curr.x - u1x * r;
      const p1y = curr.y - u1y * r;
      const p2x = curr.x + u2x * r;
      const p2y = curr.y + u2y * r;

      if (i === 0) d += `M ${p1x} ${p1y}`;
      else d += ` L ${p1x} ${p1y}`;
      d += ` Q ${curr.x} ${curr.y} ${p2x} ${p2y}`;
    }
    d += " Z";
    return d;
  };

  const makeRoundedHexagonPath = (w, h, r) => {
    const pts = [
      { x: w * 0.25, y: 0 },
      { x: w * 0.75, y: 0 },
      { x: w, y: h * 0.5 },
      { x: w * 0.75, y: h },
      { x: w * 0.25, y: h },
      { x: 0, y: h * 0.5 },
    ];
    return buildRoundedPolygonPath(pts, r);
  };

  const makeRoundedOctagonPath = (w, h, r) => {
    const pts = [
      { x: w * 0.3, y: 0 },
      { x: w * 0.7, y: 0 },
      { x: w, y: h * 0.3 },
      { x: w, y: h * 0.7 },
      { x: w * 0.7, y: h },
      { x: w * 0.3, y: h },
      { x: 0, y: h * 0.7 },
      { x: 0, y: h * 0.3 },
    ];
    return buildRoundedPolygonPath(pts, r);
  };

  const makeRoundedTrianglePath = (w, h, r) => {
    const pts = [
      { x: w / 2, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
    return buildRoundedPolygonPath(pts, r);
  };

  const makeRoundedArrowLeftPath = (w, h, r) => {
    const pts = [
      { x: 0, y: h * 0.5625 },
      { x: w * 0.25, y: h * 0.1875 },
      { x: w * 0.25, y: h * 0.375 },
      { x: w, y: h * 0.375 },
      { x: w, y: h * 0.75 },
      { x: w * 0.25, y: h * 0.75 },
      { x: w * 0.25, y: h * 0.9375 },
    ];
    return buildRoundedPolygonPath(pts, r);
  };

  const makeRoundedArrowRightPath = (w, h, r) => {
    const pts = [
      { x: w, y: h * 0.5625 },
      { x: w * 0.75, y: h * 0.1875 },
      { x: w * 0.75, y: h * 0.375 },
      { x: 0, y: h * 0.375 },
      { x: 0, y: h * 0.75 },
      { x: w * 0.75, y: h * 0.75 },
      { x: w * 0.75, y: h * 0.9375 },
    ];
    return buildRoundedPolygonPath(pts, r);
  };

  const makeRoundedFlagPath = (w, h, r) => {
    const pts = [
      { x: 0, y: h * 0.4 },
      { x: 0, y: h * 0.8 },
      { x: w * 0.25, y: h * 0.7 },
      { x: w * 0.5, y: h * 0.85 },
      { x: w * 0.733, y: h * 0.7 },
      { x: w * 0.733, y: h * 0.4 },
      { x: w * 0.5, y: h * 0.35 },
      { x: w * 0.292, y: 0 },
      { x: 0, y: h * 0.4 },
    ];
    return buildRoundedPolygonPath(pts, r);
  };

  // Adaptive half-circle that turns into rectangle with arced top as height grows beyond width/2
  const makeAdaptiveHalfCirclePath = (w, h) => {
    // w = full width, h = total height
    if (w <= 0 || h <= 0) return '';
    const R = w / 2; // radius of top semicircle
    const cpFactor = 0.45; // control point factor for Bezier approximation
    const cp = cpFactor * R;
    if (h <= R + 0.01) {
      // Pure half circle (flat base at y=R)
      // Two cubic Beziers approximation
      return `M0 ${R} C0 ${R - cp} ${cp} 0 ${R} 0 C${w - cp} 0 ${w} ${R - cp} ${w} ${R} Z`;
    }
    // Extended shape: rectangle extension below y=R down to y=h
    // Path order: start bottom-left -> up left side to base of arc -> arc -> down right side -> bottom line -> close
    return `M0 ${h} L0 ${R} C0 ${R - cp} ${cp} 0 ${R} 0 C${w - cp} 0 ${w} ${R - cp} ${w} ${R} L${w} ${h} Z`;
  };

  const makeHalfCirclePolygonPoints = (w, h, segments = 40) => {
    // w full width, h full height (base at y=h, arc top at y=0). Arc approximates half-ellipse with rx=w/2, ry=h.
    const pts = [];
    const rx = w / 2;
    const ry = h;
    const cx = w / 2;
    const cy = h;
    // base left
    pts.push({ x: 0, y: h });
    for (let i = 0; i <= segments; i++) {
      const t = Math.PI - (Math.PI * i) / segments; // from PI down to 0
      const x = cx + rx * Math.cos(t);
      const y = cy - ry * Math.sin(t);
      pts.push({ x, y });
    }
    // base right automatically via last arc point (w,h); polygon close gives base line
    return pts;
  };

  const makeAdaptiveHalfCirclePolygonPoints = (w, h, segments = 40) => {
    const R = w / 2;
    if (w <= 0 || h <= 0) return [];
    // If height <= R treat like simple half circle with height=h (arc apex at y=0, base y=h)
    if (h <= R + 0.01) return makeHalfCirclePolygonPoints(w, h, segments);
    // Extended shape: rectangle below arc from y=R to y=h
    const pts = [];
    const cx = R;
    const cy = R; // center of semicircle portion
    // Start at bottom-left
    pts.push({ x: 0, y: h });
    // Up left side to arc start
    pts.push({ x: 0, y: R });
    // Arc points from PI to 0 around center (cx,cy) radius R
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI - (Math.PI * i) / segments; // PI -> 0
      const x = cx + R * Math.cos(angle);
      const y = cy - R * Math.sin(angle);
      pts.push({ x, y });
    }
    // Down right side to bottom-right
    pts.push({ x: w, y: h });
    return pts;
  };

  // Adaptive triangle (Icon7) via polygon + rectangle clipping
  const clipPolygonWithRect = (poly, width, height) => {
    // Sutherland–Hodgman clipping against rectangle [0,width]x[0,height]
    const clipEdge = (points, isInside, intersect) => {
      if (!points || points.length === 0) return [];
      const out = [];
      for (let i = 0; i < points.length; i++) {
        const curr = points[i];
        const prev = points[(i - 1 + points.length) % points.length];
        const currIn = isInside(curr);
        const prevIn = isInside(prev);
        if (currIn) {
          if (!prevIn) out.push(intersect(prev, curr));
          out.push(curr);
        } else if (prevIn) {
          out.push(intersect(prev, curr));
        }
      }
      return out;
    };
    const intersectX = (X, a, b) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) < 1e-9) return { x: X, y: a.y }; // vertical segment degenerate
      const t = (X - a.x) / dx;
      return { x: X, y: a.y + t * dy };
    };
    const intersectY = (Y, a, b) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dy) < 1e-9) return { x: a.x, y: Y }; // horizontal segment degenerate
      const t = (Y - a.y) / dy;
      return { x: a.x + t * dx, y: Y };
    };

    let pts = poly;
    // Left x>=0
    pts = clipEdge(
      pts,
      (p) => p.x >= 0,
      (a, b) => intersectX(0, a, b)
    );
    // Right x<=width
    pts = clipEdge(
      pts,
      (p) => p.x <= width,
      (a, b) => intersectX(width, a, b)
    );
    // Top y>=0
    pts = clipEdge(
      pts,
      (p) => p.y >= 0,
      (a, b) => intersectY(0, a, b)
    );
    // Bottom y<=height
    pts = clipEdge(
      pts,
      (p) => p.y <= height,
      (a, b) => intersectY(height, a, b)
    );
    return pts;
  };

  const getAdaptiveTrianglePoints = (width, height) => {
    // Референс трикутник 190x165
    const refW = 190;
    const refH = 165;

    // Обчислюємо співвідношення
    const refRatio = refW / refH; // ~1.15
    const currentRatio = width / height;

    let triangleWidth, triangleHeight;

    if (currentRatio > refRatio) {
      // Якщо ширина більше по співвідношенню - збільшуємо і висоту пропорційно
      const scale = width / refW; // масштаб за шириною
      triangleWidth = width;
      triangleHeight = refH * scale; // збільшуємо висоту пропорційно
    } else {
      // Масштабування за висотою для збереження пропорцій трикутника
      const scale = height / refH;
      triangleWidth = refW * scale;
      triangleHeight = height;
    }

    // Центр по ширині
    const centerX = width / 2;

    // Точки трикутника (верхівка по центру, основа внизу)
    const triangle = [
      { x: centerX, y: 0 }, // верхівка
      { x: centerX - triangleWidth / 2, y: triangleHeight }, // ліва основа
      { x: centerX + triangleWidth / 2, y: triangleHeight }, // права основа
    ];

    // Обрізання трикутника прямокутником canvas
    // Коли ширина менша за потрібну, бічні кути обрізаються -> утворюється "хатинка"
    const clippedPoints = clipPolygonWithRect(triangle, width, height);
    return clippedPoints;
  };

  const updateSize = (overrides = {}) => {
    // Use explicit override values when provided to avoid state lag
    const widthMm = overrides.widthMm ?? sizeValues.width;
    const heightMm = overrides.heightMm ?? sizeValues.height;
    const cornerRadiusMm = overrides.cornerRadiusMm ?? sizeValues.cornerRadius;

    if (activeObject) {
      // Якщо вибрано об'єкт - змінюємо його розміри
      const wPx = mmToPx(widthMm);
      const hPx = mmToPx(heightMm);
      const rPx = mmToPx(cornerRadiusMm);
      activeObject.set({
        width: wPx,
        height: hPx,
        rx: rPx,
        ry: rPx,
      });
      activeObject.scaleToWidth(wPx);
      activeObject.scaleToHeight(hPx);
      canvas.renderAll();
    } else if (canvas && currentShapeType) {
      // Спеціальна обробка для адаптивного трикутника
      if (currentShapeType === "adaptiveTriangle") {
        const refW = mmToPx(190);
        const refH = mmToPx(165);
        const refRatio = refW / refH;
        const inputWidth = mmToPx(widthMm);
        const inputHeight = mmToPx(heightMm);
        const currentRatio = inputWidth / inputHeight;

        let finalWidth = inputWidth;
        let finalHeight = inputHeight;

        // Якщо ширина збільшилась понад стандартне співвідношення
        if (currentRatio > refRatio) {
          // Автоматично збільшуємо висоту пропорційно
          const scale = inputWidth / refW;
          finalHeight = refH * scale;

          // Оновлюємо sizeValues з новою висотою
          setSizeValues((prev) => ({
            ...prev,
            height: Number(pxToMm(finalHeight).toFixed(1)),
          }));
        }

        // Встановлюємо розміри canvas
        canvas.setDimensions({ width: finalWidth, height: finalHeight });

        // Створюємо clipPath з оновленими розмірами
        const pts = getAdaptiveTrianglePoints(finalWidth, finalHeight);
        canvas.clipPath = new fabric.Polygon(pts, { absolutePositioned: true });

        // Оновлюємо контур
        updateCanvasOutline();

        // Якщо вже був внутрішній бордер для adaptiveTriangle – перебудувати
        const existingAdaptive = canvas.getObjects().find(o => o.isAdaptiveTriangleInnerBorder);
        if (existingAdaptive) {
          let thicknessMm = 1;
          if (existingAdaptive.innerStrokeWidth) thicknessMm = round1(pxToMm(existingAdaptive.innerStrokeWidth));
          applyAdaptiveTriangleInnerBorder({ thicknessMm, color: existingAdaptive.stroke || '#000' });
        }

        // Перерахунок і перевстановлення дирок після зміни розміру + лог відступу
        recomputeHolesAfterResize();

        canvas.renderAll();
        return;
      }

      // Для всіх інших типів фігур - стандартна логіка
      const width = mmToPx(widthMm);
      const height = mmToPx(heightMm);
      const cr = Math.max(0, Number(mmToPx(cornerRadiusMm)) || 0);

      // Встановлюємо нові розміри canvas
      canvas.setDimensions({ width, height });

      // Створюємо новий clipPath з новими розмірами
      let newClipPath = null;

      switch (currentShapeType) {
        case "rectangle":
          newClipPath = new fabric.Rect({
            left: 0,
            top: 0,
            width: width - 1,
            height: height - 1,
            rx: cr,
            ry: cr,
            absolutePositioned: true,
          });
          break;

        case "circle":
        case "circleWithLine":
        case "circleWithCross":
          const radius = Math.min(width, height) / 2;
          newClipPath = new fabric.Circle({
            left: width / 2,
            top: height / 2,
            radius: radius,
            originX: "center",
            originY: "center",
            absolutePositioned: true,
          });
          break;

        case "ellipse":
          newClipPath = new fabric.Ellipse({
            left: width / 2,
            top: height / 2,
            rx: width / 2,
            ry: height / 2,
            originX: "center",
            originY: "center",
            absolutePositioned: true,
          });
          break;

        case "lock": {
          // Rebuild polygon with baked scaling (no scaleX/scaleY) for consistent stroke thickness
          const src = lockPolygonPoints; // original points
          const minX = Math.min(...src.map(p => p.x));
          const minY = Math.min(...src.map(p => p.y));
          const norm = src.map(p => ({ x: p.x - minX, y: p.y - minY }));
          const origW = Math.max(...norm.map(p => p.x));
          const origH = Math.max(...norm.map(p => p.y));
          const shapeScaleFactor = 0.99; // match addLock
          const sx = (width / origW) * shapeScaleFactor;
          const sy = (height / origH) * shapeScaleFactor;
          const scaled = norm.map(p => ({ x: p.x * sx, y: p.y * sy }));
          const polyW = origW * sx;
          const polyH = origH * sy;
          newClipPath = new fabric.Polygon(scaled, {
            left: (width - polyW) / 2,
            top: (height - polyH) / 2,
            absolutePositioned: true,
          });
          break;
        }

        case "house":
          const houseScale = Math.min(width / 96, height / 105);
          newClipPath = new fabric.Path("M6 66V105H51H90V66L48 6L6 66Z", {
            left: (width - 96 * houseScale) / 2,
            top: (height - 105 * houseScale) / 2,
            absolutePositioned: true,
            scaleX: houseScale,
            scaleY: houseScale,
          });
          break;

        case "halfCircle": {
          const pts = makeHalfCirclePolygonPoints(width, height);
          newClipPath = new fabric.Polygon(pts, { absolutePositioned: true });
          break;
        }

        case "extendedHalfCircle": {
          const pts = makeAdaptiveHalfCirclePolygonPoints(width, height);
          newClipPath = new fabric.Polygon(pts, { absolutePositioned: true });
          break;
        }

        case "adaptiveTriangle": {
          // Адаптивний трикутник, обрізаний прямокутником полотна
          const pts = getAdaptiveTrianglePoints(width, height);
          newClipPath = new fabric.Polygon(pts, { absolutePositioned: true });
          break;
        }

        case "hexagon": {
          const d = makeRoundedHexagonPath(width, height, cr);
          newClipPath = new fabric.Path(d, { absolutePositioned: true });
          break;
        }

        case "octagon": {
          const d = makeRoundedOctagonPath(width, height, cr);
          newClipPath = new fabric.Path(d, { absolutePositioned: true });
          break;
        }

        case "triangle": {
          const d = makeRoundedTrianglePath(width, height, cr);
          newClipPath = new fabric.Path(d, { absolutePositioned: true });
          break;
        }

        case "arrowLeft": {
          const d = makeRoundedArrowLeftPath(width, height, cr);
          newClipPath = new fabric.Path(d, { absolutePositioned: true });
          break;
        }

        case "arrowRight": {
          const d = makeRoundedArrowRightPath(width, height, cr);
          newClipPath = new fabric.Path(d, { absolutePositioned: true });
          break;
        }

        case "flag": {
          const d = makeRoundedFlagPath(width, height, cr);
          newClipPath = new fabric.Path(d, { absolutePositioned: true });
          break;
        }

        case "diamond":
          newClipPath = new fabric.Path(
            `M${width * 0.5} 0L${width} ${height * 0.5}L${width * 0.5
            } ${height}L0 ${height * 0.5}Z`,
            { absolutePositioned: true }
          );
          break;

        default:
          break;
      }

      // Встановлюємо новий clipPath
      if (newClipPath) {
        canvas.clipPath = newClipPath;
      }

      // Оновлюємо візуальний контур і обводки
      updateCanvasOutline();
      updateExistingBorders();

      // Reapply inner border for current shape if it already exists
      if (currentShapeType === 'rectangle') {
        const existing = canvas.getObjects().find(o => o.isRectangleInnerBorder);
        if (existing) {
          let thicknessMm = 1;
          if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
          applyRectangleInnerBorder({ thicknessMm, color: existing.stroke || '#000' });
        }
      } else if (currentShapeType === 'circle') {
        const existing = canvas.getObjects().find(o => o.isCircleInnerBorder);
        if (existing) {
          let thicknessMm = 1;
          if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
          applyCircleInnerBorder({ thicknessMm, color: existing.stroke || '#000' });
        }
      } else if (currentShapeType === 'ellipse') {
        const existing = canvas.getObjects().find(o => o.isEllipseInnerBorder);
        if (existing) {
          let thicknessMm = 1;
          if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
          applyEllipseInnerBorder({ thicknessMm, color: existing.stroke || '#000' });
        }
      } else if (currentShapeType === 'halfCircle') {
        const existing = canvas.getObjects().find(o => o.isHalfCircleInnerBorder);
        if (existing) {
          let thicknessMm = 1;
          if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
          applyHalfCircleInnerBorder({ thicknessMm, color: existing.stroke || '#000' });
        }
      } else if (currentShapeType === 'extendedHalfCircle') {
        const existing = canvas.getObjects().find(o => o.isExtendedHalfCircleInnerBorder);
        if (existing) {
          let thicknessMm = 1;
          if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
          applyExtendedHalfCircleInnerBorder({ thicknessMm, color: existing.stroke || '#000' });
        }
      } else if (currentShapeType === 'hexagon') {
        const existing = canvas.getObjects().find(o => o.isHexagonInnerBorder);
        if (existing) {
          let thicknessMm = 1;
          if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
          applyHexagonInnerBorder({ thicknessMm, color: existing.stroke || '#000' });
        }
      } else if (currentShapeType === 'octagon') {
        const existing = canvas.getObjects().find(o => o.isOctagonInnerBorder);
        if (existing) {
          let thicknessMm = 1;
          if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
          applyOctagonInnerBorder({ thicknessMm, color: existing.stroke || '#000' });
        }
      } else if (currentShapeType === 'triangle') {
        const existing = canvas.getObjects().find(o => o.isTriangleInnerBorder);
        if (existing) {
          let thicknessMm = 1;
          if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
          applyTriangleInnerBorder({ thicknessMm, color: existing.stroke || '#000' });
        }
      } else if (currentShapeType === 'arrowLeft') {
        const existing = canvas.getObjects().find(o => o.isArrowLeftInnerBorder);
        if (existing) {
          let thicknessMm = 1;
          if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
          applyArrowLeftInnerBorder({ thicknessMm, color: existing.stroke || '#000' });
        }
      } else if (currentShapeType === 'arrowRight') {
        const existing = canvas.getObjects().find(o => o.isArrowRightInnerBorder);
        if (existing) {
          let thicknessMm = 1;
          if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
          applyArrowRightInnerBorder({ thicknessMm, color: existing.stroke || '#000' });
        }
      } else if (currentShapeType === 'adaptiveTriangle') {
        const existing = canvas.getObjects().find(o => o.isAdaptiveTriangleInnerBorder);
        if (existing) {
          let thicknessMm = 1;
          if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
          applyAdaptiveTriangleInnerBorder({ thicknessMm, color: existing.stroke || '#000' });
        }
      } else if (currentShapeType === 'lock') {
        const existing = canvas.getObjects().find(o => o.isLockInnerBorder);
        if (existing) {
          let thicknessMm = 1;
          if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
          applyLockInnerBorder({ thicknessMm, color: existing.stroke || '#000' });
        }
      }

      // Перерахунок і перевстановлення дирок після зміни розміру + лог відступу
      recomputeHolesAfterResize();

      canvas.renderAll();
    } else if (canvas) {
      // Якщо нічого не вибрано і немає фігури - просто змінюємо розміри canvas
      canvas.setDimensions({
        width: mmToPx(widthMm),
        height: mmToPx(heightMm),
      });
      updateCanvasOutline();

      // Перерахунок і перевстановлення дирок після зміни розміру + лог відступу
      recomputeHolesAfterResize();

      canvas.renderAll();
    }
  };

  // Перерахунок та перестановка отворів після зміни розміру фігури + лог поточного відступу в мм
  const recomputeHolesAfterResize = () => {
    if (!canvas) return;
    if (!isHolesSelected || activeHolesType === 1) return; // коли «без отворів», нічого не робимо

    // Спеціальна логіка для замка
    if (currentShapeType === 'lock') {
      clearExistingHoles();
      const heightMm = pxToMm(canvas.height);
      const lockHoleDiameter = heightMm * 0.22;
      const lockHoleRadius = lockHoleDiameter / 2;
      // Позиція 10% від верху + радіус (щоб центр кола був на правильній відстані)
      const lockHoleOffsetFromTop = heightMm * 0.10 + lockHoleRadius;
      
      const hole = new fabric.Circle({
        left: canvas.width / 2, // по центру ширини
        top: mmToPx(lockHoleOffsetFromTop), // 10% від верху + радіус
        radius: mmToPx(lockHoleRadius),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true,
        cutType: "hole",
        hasControls: false,
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });
      canvas.add(hole);
      canvas.renderAll();
      return;
    }

    // Обчислюємо відступ і логуємо його в мм
    const offsetPx =
      activeHolesType === 5 ? getRectHoleOffsetPx() : getHoleOffsetPx();
    const offsetMm = pxToMm(offsetPx);
    try {
      console.log(
        `Відступ отворів: ${offsetMm.toFixed(
          2
        )} мм (тип ${activeHolesType}, Ø ${holesDiameter} мм)`
      );
    } catch { }

    // Переставляємо отвори відповідно до активного типу
    switch (activeHolesType) {
      case 2:
        addHoleType2();
        break;
      case 3:
        addHoleType3();
        break;
      case 4:
        addHoleType4();
        break;
      case 5:
        addHoleType5();
        break;
      case 6:
        addHoleType6();
        break;
      case 7:
        addHoleType7();
        break;
      default:
        break;
    }
  };

  // Функція для оновлення візуального контуру canvas
  const updateCanvasOutline = () => {
    if (!canvas) return;

    // Видаляємо попередній контур
    const existingOutline = canvas
      .getObjects()
      .find((obj) => obj.isCanvasOutline);
    if (existingOutline) {
      canvas.remove(existingOutline);
    }

    // Перевіряємо чи є користувацькі обводки
    const hasBorder = canvas.getObjects().some((obj) => obj.isBorderShape);

    // Додаємо контур тільки якщо немає користувацьких обводок
    if (!hasBorder && canvas.clipPath) {
      let outlineShape;
      const clipPathData = canvas.clipPath.toObject();

      if (canvas.clipPath.type === "rect") {
        outlineShape = new fabric.Rect(clipPathData);
      } else if (canvas.clipPath.type === "circle") {
        outlineShape = new fabric.Circle(clipPathData);
      } else if (canvas.clipPath.type === "ellipse") {
        outlineShape = new fabric.Ellipse(clipPathData);
      } else if (canvas.clipPath.type === "path") {
        outlineShape = new fabric.Path(canvas.clipPath.path, clipPathData);
      } else if (canvas.clipPath.type === "polygon") {
        // Flatten scale so stroke width is not magnified
        const cp = canvas.clipPath;
        const sx = cp.scaleX || 1;
        const sy = cp.scaleY || 1;
        if (sx !== 1 || sy !== 1) {
          const flatPts = cp.points.map(p => ({ x: p.x * sx, y: p.y * sy }));
          outlineShape = new fabric.Polygon(flatPts, {
            left: cp.left,
            top: cp.top,
            absolutePositioned: true,
          });
        } else {
          outlineShape = new fabric.Polygon(cp.points, clipPathData);
        }
      }

      if (outlineShape) {
        outlineShape.set({
          fill: "transparent",
          stroke: "#000000",
          strokeWidth: 1,
          strokeDashArray: null,
          selectable: false,
          evented: false,
          excludeFromExport: true,
          isCanvasOutline: true,
          strokeUniform: true,
        });

        canvas.add(outlineShape);
        // Переміщуємо контур на задній план
        canvas.sendObjectToBack(outlineShape);
      }
    }
  };

  // Повне перезбирання внутрішнього бордера при зміні розміру / cornerRadius
  const updateExistingBorders = () => {
    if (!canvas) return;
    // Зчитуємо поточні параметри вже доданого бордера (товщина/колір)
    const existing = canvas.getObjects().find(o => o.isRectangleInnerBorder || o.isCircleInnerBorder || o.isEllipseInnerBorder || o.isHalfCircleInnerBorder || o.isExtendedHalfCircleInnerBorder || o.isHexagonInnerBorder || o.isOctagonInnerBorder || o.isTriangleInnerBorder || o.isArrowLeftInnerBorder || o.isArrowRightInnerBorder || o.isAdaptiveTriangleInnerBorder || o.isLockInnerBorder);
    if (!existing) return; // немає що перебудовувати
    let thicknessMm = 1;
    if (existing.innerStrokeWidth) thicknessMm = round1(pxToMm(existing.innerStrokeWidth));
    const color = existing.stroke || '#000';
    // Видаляємо всі borderShape
    canvas.getObjects().filter(o => o.isBorderShape).forEach(o => canvas.remove(o));
    // Перебудова згідно поточного типу
    switch (currentShapeType) {
      case 'rectangle':
        applyRectangleInnerBorder({ thicknessMm, color });
        break;
      case 'circle':
        applyCircleInnerBorder({ thicknessMm, color });
        break;
      case 'ellipse':
        applyEllipseInnerBorder({ thicknessMm, color });
        break;
      case 'halfCircle':
        applyHalfCircleInnerBorder({ thicknessMm, color });
        break;
      case 'extendedHalfCircle':
        applyExtendedHalfCircleInnerBorder({ thicknessMm, color });
        break;
      case 'hexagon':
        applyHexagonInnerBorder({ thicknessMm, color });
        break;
      case 'octagon':
        applyOctagonInnerBorder({ thicknessMm, color });
        break;
      case 'triangle':
        applyTriangleInnerBorder({ thicknessMm, color });
        break;
      case 'arrowLeft':
        applyArrowLeftInnerBorder({ thicknessMm, color });
        break;
      case 'arrowRight':
        applyArrowRightInnerBorder({ thicknessMm, color });
        break;
      case 'adaptiveTriangle':
        applyAdaptiveTriangleInnerBorder({ thicknessMm, color });
        break;
      case 'lock':
        applyLockInnerBorder({ thicknessMm, color });
        break;
      default:
        break;
    }
  };

  // --- Inner border (shape border) infrastructure ---
  // Custom rect with inner stroke rendering (visible stroke fully inside bounds)
  const ensureInnerStrokeClasses = () => {
    if (InnerStrokeRectClass && InnerStrokeCircleClass && InnerStrokeEllipseClass && InnerStrokePolygonClass) return;
    class InnerStrokeRect extends fabric.Rect {
      static type = 'innerStrokeRect';
      constructor(options = {}) {
        super(options);
        this.type = 'innerStrokeRect';
        this.innerStrokeWidth = options.innerStrokeWidth || 1;
      }
      _render(ctx) {
        const strokeColor = this.stroke;
        const innerW = this.innerStrokeWidth;
        const fillColor = this.fill;
        const w = this.width; const h = this.height;
        const rx = this.rx || 0; const ry = this.ry || rx;
        const x = -w / 2, y = -h / 2;
        const drawRounded = () => {
          const rxl = Math.min(rx, w / 2), ryl = Math.min(ry, h / 2);
          ctx.moveTo(x + rxl, y);
          ctx.lineTo(x + w - rxl, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + ryl);
          ctx.lineTo(x + w, y + h - ryl);
          ctx.quadraticCurveTo(x + w, y + h, x + w - rxl, y + h);
          ctx.lineTo(x + rxl, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - ryl);
          ctx.lineTo(x, y + ryl);
          ctx.quadraticCurveTo(x, y, x + rxl, y);
        };
        // Fill
        ctx.save();
        ctx.beginPath();
        if (rx > 0 || ry > 0) drawRounded(); else ctx.rect(x, y, w, h);
        if (fillColor) {
          ctx.fillStyle = fillColor;
          ctx.fill();
        }
        if (strokeColor && innerW) {
          // Inner stroke: clip, stroke with doubled width
          ctx.save();
          ctx.clip();
          ctx.lineWidth = innerW * 2;
          ctx.strokeStyle = strokeColor;
          ctx.lineJoin = this.strokeLineJoin || 'miter';
          ctx.lineCap = this.strokeLineCap || 'butt';
          ctx.miterLimit = this.strokeMiterLimit || 4;
          ctx.beginPath();
          if (rx > 0 || ry > 0) drawRounded(); else ctx.rect(x, y, w, h);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      }
      toObject(additional = []) { return { ...super.toObject(additional), innerStrokeWidth: this.innerStrokeWidth }; }
      static fromObject(object, callback) { callback && callback(new InnerStrokeRect(object)); }
    }
    class InnerStrokeCircle extends fabric.Circle {
      static type = 'innerStrokeCircle';
      constructor(options = {}) { super(options); this.type = 'innerStrokeCircle'; this.innerStrokeWidth = options.innerStrokeWidth || 1; }
      _render(ctx) {
        const strokeColor = this.stroke, innerW = this.innerStrokeWidth, fillColor = this.fill, r = this.radius; ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); } if (strokeColor && innerW) { ctx.save(); ctx.clip(); ctx.lineWidth = innerW * 2; ctx.strokeStyle = strokeColor; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } ctx.restore();
      }
      toObject(a = []) { return { ...super.toObject(a), innerStrokeWidth: this.innerStrokeWidth }; }
      static fromObject(o, cb) { cb && cb(new InnerStrokeCircle(o)); }
    }
    class InnerStrokeEllipse extends fabric.Ellipse {
      static type = 'innerStrokeEllipse';
      constructor(options = {}) { super(options); this.type = 'innerStrokeEllipse'; this.innerStrokeWidth = options.innerStrokeWidth || 1; }
      _render(ctx) {
        const strokeColor = this.stroke, innerW = this.innerStrokeWidth, fillColor = this.fill, rx = this.rx, ry = this.ry; ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); } if (strokeColor && innerW) { ctx.save(); ctx.clip(); ctx.lineWidth = innerW * 2; ctx.strokeStyle = strokeColor; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } ctx.restore();
      }
      toObject(a = []) { return { ...super.toObject(a), innerStrokeWidth: this.innerStrokeWidth }; }
      static fromObject(o, cb) { cb && cb(new InnerStrokeEllipse(o)); }
    }
    class InnerStrokePolygon extends fabric.Polygon {
      static type = 'innerStrokePolygon';
      constructor(points = [], options = {}) { super(points, options); this.type = 'innerStrokePolygon'; this.innerStrokeWidth = options.innerStrokeWidth || 1; }
      _render(ctx) {
        if (!this.points || !this.points.length) return;
        const strokeColor = this.stroke, innerW = this.innerStrokeWidth, fillColor = this.fill;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(this.points[0].x - this.pathOffset.x, this.points[0].y - this.pathOffset.y);
        for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i].x - this.pathOffset.x, this.points[i].y - this.pathOffset.y);
        ctx.closePath();
        if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); }
        if (strokeColor && innerW) {
          ctx.save(); ctx.clip(); ctx.lineWidth = innerW * 2; ctx.strokeStyle = strokeColor; ctx.beginPath();
          ctx.moveTo(this.points[0].x - this.pathOffset.x, this.points[0].y - this.pathOffset.y);
          for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i].x - this.pathOffset.x, this.points[i].y - this.pathOffset.y);
          ctx.closePath(); ctx.stroke(); ctx.restore();
        }
        ctx.restore();
      }
      toObject(a = []) { return { ...super.toObject(a), innerStrokeWidth: this.innerStrokeWidth }; }
      static fromObject(o, cb) { cb && cb(new InnerStrokePolygon(o.points, o)); }
    }
    InnerStrokeRectClass = InnerStrokeRect;
    InnerStrokeCircleClass = InnerStrokeCircle;
    InnerStrokeEllipseClass = InnerStrokeEllipse;
    InnerStrokePolygonClass = InnerStrokePolygon;
  };

  // Add / update inner border for rectangle current shape
  const applyRectangleInnerBorder = (opts = {}) => {
    if (!canvas || currentShapeType !== 'rectangle') return;
    ensureInnerStrokeClasses();
    const strokeColor = opts.color || '#000';
    const thicknessMm = opts.thicknessMm ?? 1; // visible thickness in mm
    const thicknessPx = mmToPx(thicknessMm);
    // remove existing rectangle border shapes
    canvas.getObjects().filter(o => o.isRectangleInnerBorder).forEach(o => canvas.remove(o));
    // derive dimensions from clipPath
    const cp = canvas.clipPath;
    if (!cp || cp.type !== 'rect') return;
    const RectClass = InnerStrokeRectClass; // ensured above
    const rect = new RectClass({
      left: cp.left + cp.width / 2,
      top: cp.top + cp.height / 2,
      width: cp.width,
      height: cp.height,
      rx: cp.rx || 0,
      ry: cp.ry || 0,
      originX: 'center',
      originY: 'center',
      fill: 'transparent',
      stroke: strokeColor,
      innerStrokeWidth: thicknessPx,
      selectable: false,
      evented: false,
      excludeFromExport: false,
      isBorderShape: true,
      isRectangleInnerBorder: true,
    });
    canvas.add(rect);
    // Remove existing outline if present (border replaces it)
    const outline = canvas.getObjects().find(o => o.isCanvasOutline);
    if (outline) canvas.remove(outline);
    canvas.renderAll();
  };

  // Add / update inner border for lock shape
  const applyLockInnerBorder = (opts = {}) => {
    if (!canvas || currentShapeType !== 'lock') return;
    ensureInnerStrokeClasses();
    const strokeColor = opts.color || '#000';
    const thicknessMm = opts.thicknessMm ?? 1;
    const thicknessPx = mmToPx(thicknessMm);
    // remove existing
    canvas.getObjects().filter(o => o.isLockInnerBorder).forEach(o => canvas.remove(o));
    const cp = canvas.clipPath;
    if (!cp || cp.type !== 'polygon') return;
    const PolyClass = InnerStrokePolygonClass;
    // clone points
    const pts = cp.points.map(p => ({ x: p.x, y: p.y }));
    const poly = new PolyClass(pts, {
      left: cp.left,
      top: cp.top,
      absolutePositioned: true,
      fill: 'transparent',
      stroke: strokeColor,
      innerStrokeWidth: thicknessPx,
      selectable: false,
      evented: false,
      excludeFromExport: false,
      strokeUniform: true,
    });
    poly.isBorderShape = true;
    poly.isLockInnerBorder = true;
    canvas.add(poly);
    canvas.sendObjectToBack(poly);
    canvas.renderAll();
  };

  const applyCircleInnerBorder = (opts = {}) => {
    if (!canvas || currentShapeType !== 'circle') return;
    ensureInnerStrokeClasses();
    const strokeColor = opts.color || '#000';
    const thicknessMm = opts.thicknessMm ?? 1;
    const thicknessPx = mmToPx(thicknessMm);
    canvas.getObjects().filter(o => o.isCircleInnerBorder).forEach(o => canvas.remove(o));
    const cp = canvas.clipPath;
    if (!cp || cp.type !== 'circle') return;
    const circle = new InnerStrokeCircleClass({
      left: cp.left,
      top: cp.top,
      originX: cp.originX || 'center',
      originY: cp.originY || 'center',
      radius: cp.radius,
      fill: 'transparent',
      stroke: strokeColor,
      innerStrokeWidth: thicknessPx,
      selectable: false,
      evented: false,
      excludeFromExport: false,
      isBorderShape: true,
      isCircleInnerBorder: true,
    });
    canvas.add(circle);
    const outline = canvas.getObjects().find(o => o.isCanvasOutline);
    if (outline) canvas.remove(outline);
    canvas.renderAll();
  };

  const applyEllipseInnerBorder = (opts = {}) => {
    if (!canvas || currentShapeType !== 'ellipse') return;
    ensureInnerStrokeClasses();
    const strokeColor = opts.color || '#000';
    const thicknessMm = opts.thicknessMm ?? 1;
    const thicknessPx = mmToPx(thicknessMm);
    canvas.getObjects().filter(o => o.isEllipseInnerBorder).forEach(o => canvas.remove(o));
    const cp = canvas.clipPath;
    if (!cp || cp.type !== 'ellipse') return;
    const ellipse = new InnerStrokeEllipseClass({
      left: cp.left,
      top: cp.top,
      originX: cp.originX || 'center',
      originY: cp.originY || 'center',
      rx: cp.rx,
      ry: cp.ry,
      fill: 'transparent',
      stroke: strokeColor,
      innerStrokeWidth: thicknessPx,
      selectable: false,
      evented: false,
      excludeFromExport: false,
      isBorderShape: true,
      isEllipseInnerBorder: true,
    });
    canvas.add(ellipse);
    const outline = canvas.getObjects().find(o => o.isCanvasOutline);
    if (outline) canvas.remove(outline);
    canvas.renderAll();
  };

  // Half-circle inner border (using polygon approximation of arc)
  const applyHalfCircleInnerBorder = (opts = {}) => {
    if (!canvas || currentShapeType !== 'halfCircle') return;
    ensureInnerStrokeClasses();
    const strokeColor = opts.color || '#000';
    const thicknessMm = opts.thicknessMm ?? 1;
    const thicknessPx = mmToPx(thicknessMm);
    canvas.getObjects().filter(o => o.isHalfCircleInnerBorder).forEach(o => canvas.remove(o));
    const cp = canvas.clipPath;
    if (!cp) return;
    let points;
    if (cp.type === 'polygon') points = cp.points.map(p => ({ x: p.x, y: p.y }));
    else points = makeHalfCirclePolygonPoints(canvas.width, canvas.height);
    const poly = new InnerStrokePolygonClass(points, {
      left: 0,
      top: 0,
      absolutePositioned: true,
      fill: 'transparent',
      stroke: strokeColor,
      innerStrokeWidth: thicknessPx,
      selectable: false,
      evented: false,
      excludeFromExport: false,
      isBorderShape: true,
      isHalfCircleInnerBorder: true,
    });
    canvas.add(poly);
    const outline = canvas.getObjects().find(o => o.isCanvasOutline);
    if (outline) canvas.remove(outline);
    canvas.renderAll();
  };

  const applyExtendedHalfCircleInnerBorder = (opts = {}) => {
    if (!canvas || currentShapeType !== 'extendedHalfCircle') return;
    ensureInnerStrokeClasses();
    const strokeColor = opts.color || '#000';
    const thicknessMm = opts.thicknessMm ?? 1;
    const thicknessPx = mmToPx(thicknessMm);
    canvas.getObjects().filter(o => o.isExtendedHalfCircleInnerBorder).forEach(o => canvas.remove(o));
    const cp = canvas.clipPath;
    if (!cp) return;
    let points;
    if (cp.type === 'polygon') points = cp.points.map(p => ({ x: p.x, y: p.y }));
    else points = makeAdaptiveHalfCirclePolygonPoints(canvas.width, canvas.height);
    const poly = new InnerStrokePolygonClass(points, {
      left: 0,
      top: 0,
      absolutePositioned: true,
      fill: 'transparent',
      stroke: strokeColor,
      innerStrokeWidth: thicknessPx,
      selectable: false,
      evented: false,
      excludeFromExport: false,
      isBorderShape: true,
      isExtendedHalfCircleInnerBorder: true,
    });
    canvas.add(poly);
    const outline = canvas.getObjects().find(o => o.isCanvasOutline);
    if (outline) canvas.remove(outline);
    canvas.renderAll();
  };

  // --- Hexagon / Octagon inner border helpers (rounded polygon sampling) ---
  const sampleRoundedPolygon = (basePts, r, segments) => {
    // basePts: original corner points in order, r: corner radius (px), segments: samples along each corner curve
    const n = basePts.length;
    if (!r || r <= 0) return basePts.map(p => ({ x: p.x, y: p.y }));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const prev = basePts[(i - 1 + n) % n];
      const curr = basePts[i];
      const next = basePts[(i + 1) % n];
      const v1x = curr.x - prev.x, v1y = curr.y - prev.y;
      const v2x = next.x - curr.x, v2y = next.y - curr.y;
      const len1 = Math.hypot(v1x, v1y) || 1;
      const len2 = Math.hypot(v2x, v2y) || 1;
      const u1x = v1x / len1, u1y = v1y / len1;
      const u2x = v2x / len2, u2y = v2y / len2;
      const rClamped = Math.min(r, len1 / 2, len2 / 2);
      const p1x = curr.x - u1x * rClamped;
      const p1y = curr.y - u1y * rClamped;
      const p2x = curr.x + u2x * rClamped;
      const p2y = curr.y + u2y * rClamped;
      if (i === 0) pts.push({ x: p1x, y: p1y }); // start
      // sample interior points of quadratic curve excluding endpoints
      for (let s = 1; s < segments; s++) {
        const t = s / segments;
        const oneMinusT = 1 - t;
        const bx = oneMinusT * oneMinusT * p1x + 2 * oneMinusT * t * curr.x + t * t * p2x;
        const by = oneMinusT * oneMinusT * p1y + 2 * oneMinusT * t * curr.y + t * t * p2y;
        pts.push({ x: bx, y: by });
      }
      pts.push({ x: p2x, y: p2y });
    }
    return pts;
  };

  const makeRoundedHexagonPolygonPoints = (w, h, rPx, segments = 5) => {
    const base = [
      { x: w * 0.25, y: 0 },
      { x: w * 0.75, y: 0 },
      { x: w, y: h * 0.5 },
      { x: w * 0.75, y: h },
      { x: w * 0.25, y: h },
      { x: 0, y: h * 0.5 },
    ];
    return sampleRoundedPolygon(base, rPx, segments);
  };

  const makeRoundedOctagonPolygonPoints = (w, h, rPx, segments = 5) => {
    const base = [
      { x: w * 0.3, y: 0 },
      { x: w * 0.7, y: 0 },
      { x: w, y: h * 0.3 },
      { x: w, y: h * 0.7 },
      { x: w * 0.7, y: h },
      { x: w * 0.3, y: h },
      { x: 0, y: h * 0.7 },
      { x: 0, y: h * 0.3 },
    ];
    return sampleRoundedPolygon(base, rPx, segments);
  };

  const applyHexagonInnerBorder = (opts = {}) => {
    if (!canvas || currentShapeType !== 'hexagon') return;
    ensureInnerStrokeClasses();
    const strokeColor = opts.color || '#000';
    const thicknessMm = opts.thicknessMm ?? 1;
    const thicknessPx = mmToPx(thicknessMm);
    canvas.getObjects().filter(o => o.isHexagonInnerBorder).forEach(o => canvas.remove(o));
    const rPx = mmToPx(sizeValues.cornerRadius || 0);
    const points = makeRoundedHexagonPolygonPoints(canvas.width, canvas.height, rPx);
    const poly = new InnerStrokePolygonClass(points, {
      left: 0,
      top: 0,
      absolutePositioned: true,
      fill: 'transparent',
      stroke: strokeColor,
      innerStrokeWidth: thicknessPx,
      selectable: false,
      evented: false,
      excludeFromExport: false,
      isBorderShape: true,
      isHexagonInnerBorder: true,
    });
    canvas.add(poly);
    const outline = canvas.getObjects().find(o => o.isCanvasOutline);
    if (outline) canvas.remove(outline);
    canvas.renderAll();
  };

  const applyOctagonInnerBorder = (opts = {}) => {
    if (!canvas || currentShapeType !== 'octagon') return;
    ensureInnerStrokeClasses();
    const strokeColor = opts.color || '#000';
    const thicknessMm = opts.thicknessMm ?? 1;
    const thicknessPx = mmToPx(thicknessMm);
    canvas.getObjects().filter(o => o.isOctagonInnerBorder).forEach(o => canvas.remove(o));
    const rPx = mmToPx(sizeValues.cornerRadius || 0);
    const points = makeRoundedOctagonPolygonPoints(canvas.width, canvas.height, rPx);
    const poly = new InnerStrokePolygonClass(points, {
      left: 0,
      top: 0,
      absolutePositioned: true,
      fill: 'transparent',
      stroke: strokeColor,
      innerStrokeWidth: thicknessPx,
      selectable: false,
      evented: false,
      excludeFromExport: false,
      isBorderShape: true,
      isOctagonInnerBorder: true,
    });
    canvas.add(poly);
    const outline = canvas.getObjects().find(o => o.isCanvasOutline);
    if (outline) canvas.remove(outline);
    canvas.renderAll();
  };

  const applyTriangleInnerBorder = (opts = {}) => {
    if (!canvas || currentShapeType !== 'triangle') return;
    ensureInnerStrokeClasses();
    const strokeColor = opts.color || '#000';
    const thicknessMm = opts.thicknessMm ?? 1;
    const thicknessPx = mmToPx(thicknessMm);
    canvas.getObjects().filter(o => o.isTriangleInnerBorder).forEach(o => canvas.remove(o));
    // build rounded triangle polygon approximation
    const rPx = mmToPx(sizeValues.cornerRadius || 0);
    const base = [
      { x: canvas.width / 2, y: 0 },
      { x: canvas.width, y: canvas.height },
      { x: 0, y: canvas.height },
    ];
    const points = sampleRoundedPolygon(base, rPx, 6);
    const poly = new InnerStrokePolygonClass(points, {
      left: 0,
      top: 0,
      absolutePositioned: true,
      fill: 'transparent',
      stroke: strokeColor,
      innerStrokeWidth: thicknessPx,
      selectable: false,
      evented: false,
      excludeFromExport: false,
      isBorderShape: true,
      isTriangleInnerBorder: true,
    });
    canvas.add(poly);
    const outline = canvas.getObjects().find(o => o.isCanvasOutline);
    if (outline) canvas.remove(outline);
    canvas.renderAll();
  };

  const applyArrowLeftInnerBorder = (opts = {}) => {
    if (!canvas || currentShapeType !== 'arrowLeft') return;
    ensureInnerStrokeClasses();
    const strokeColor = opts.color || '#000';
    const thicknessMm = opts.thicknessMm ?? 1;
    const thicknessPx = mmToPx(thicknessMm);
    canvas.getObjects().filter(o => o.isArrowLeftInnerBorder).forEach(o => canvas.remove(o));
    // Recreate path then sample its base polygon (approx corners defined in path generator before rounding)
    const rPx = mmToPx(sizeValues.cornerRadius || 0);
    const base = [
      { x: 0, y: canvas.height * 0.5625 },
      { x: canvas.width * 0.25, y: canvas.height * 0.1875 },
      { x: canvas.width * 0.25, y: canvas.height * 0.375 },
      { x: canvas.width, y: canvas.height * 0.375 },
      { x: canvas.width, y: canvas.height * 0.75 },
      { x: canvas.width * 0.25, y: canvas.height * 0.75 },
      { x: canvas.width * 0.25, y: canvas.height * 0.9375 },
    ];
    const minY = base.reduce((m, p) => Math.min(m, p.y), Infinity);
    const shifted = base.map(p => ({ x: p.x, y: p.y - minY }));
    const points = sampleRoundedPolygon(shifted, rPx, 4);
    const poly = new InnerStrokePolygonClass(points, {
      left: 0,
      top: minY,
      absolutePositioned: true,
      fill: 'transparent',
      stroke: strokeColor,
      innerStrokeWidth: thicknessPx,
      selectable: false,
      evented: false,
      excludeFromExport: false,
      isBorderShape: true,
      isArrowLeftInnerBorder: true,
    });
    canvas.add(poly);
    const outline = canvas.getObjects().find(o => o.isCanvasOutline);
    if (outline) canvas.remove(outline);
    canvas.renderAll();
  };

  const applyArrowRightInnerBorder = (opts = {}) => {
    if (!canvas || currentShapeType !== 'arrowRight') return;
    ensureInnerStrokeClasses();
    const strokeColor = opts.color || '#000';
    const thicknessMm = opts.thicknessMm ?? 1;
    const thicknessPx = mmToPx(thicknessMm);
    canvas.getObjects().filter(o => o.isArrowRightInnerBorder).forEach(o => canvas.remove(o));
    const rPx = mmToPx(sizeValues.cornerRadius || 0);
    const base = [
      { x: 0, y: canvas.height * 0.375 },
      { x: canvas.width * 0.75, y: canvas.height * 0.375 },
      { x: canvas.width * 0.75, y: canvas.height * 0.1875 },
      { x: canvas.width, y: canvas.height * 0.5625 },
      { x: canvas.width * 0.75, y: canvas.height * 0.9375 },
      { x: canvas.width * 0.75, y: canvas.height * 0.75 },
      { x: 0, y: canvas.height * 0.75 },
    ];
    const minY = base.reduce((m, p) => Math.min(m, p.y), Infinity);
    const shifted = base.map(p => ({ x: p.x, y: p.y - minY }));
    const points = sampleRoundedPolygon(shifted, rPx, 4);
    const poly = new InnerStrokePolygonClass(points, {
      left: 0,
      top: minY,
      absolutePositioned: true,
      fill: 'transparent',
      stroke: strokeColor,
      innerStrokeWidth: thicknessPx,
      selectable: false,
      evented: false,
      excludeFromExport: false,
      isBorderShape: true,
      isArrowRightInnerBorder: true,
    });
    canvas.add(poly);
    const outline = canvas.getObjects().find(o => o.isCanvasOutline);
    if (outline) canvas.remove(outline);
    canvas.renderAll();
  };

  const applyAdaptiveTriangleInnerBorder = (opts = {}) => {
    if (!canvas || currentShapeType !== 'adaptiveTriangle') return;
    ensureInnerStrokeClasses();
    const strokeColor = opts.color || '#000';
    const thicknessMm = opts.thicknessMm ?? 1;
    const thicknessPx = mmToPx(thicknessMm);
    canvas.getObjects().filter(o => o.isAdaptiveTriangleInnerBorder).forEach(o => canvas.remove(o));
    const pts = getAdaptiveTrianglePoints(canvas.width, canvas.height);
    // We can optionally round corners using existing sampleRoundedPolygon; treat pts as base polygon
    const rPx = mmToPx(sizeValues.cornerRadius || 0);
    const rounded = sampleRoundedPolygon(pts, rPx, 4);
    const poly = new InnerStrokePolygonClass(rounded, {
      left: 0,
      top: 0,
      absolutePositioned: true,
      fill: 'transparent',
      stroke: strokeColor,
      innerStrokeWidth: thicknessPx,
      selectable: false,
      evented: false,
      excludeFromExport: false,
      isBorderShape: true,
      isAdaptiveTriangleInnerBorder: true,
    });
    canvas.add(poly);
    const outline = canvas.getObjects().find(o => o.isCanvasOutline);
    if (outline) canvas.remove(outline);
    canvas.renderAll();
  };

  // Оновлення товщини обводки
  const updateThickness = (value) => {
    if (activeObject) {
      activeObject.set({ strokeWidth: mmToPx(value) });
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

  // Функція для регенерації QR коду з новими кольорами
  const regenerateQRCode = async (
    qrObj,
    text,
    foregroundColor,
    backgroundColor
  ) => {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(text, {
        width: 200,
        height: 200,
        color: {
          dark: foregroundColor,
          light: backgroundColor,
        },
      });

      const newImg = await fabric.FabricImage.fromURL(qrCodeDataURL);

      // Зберігаємо властивості оригінального об'єкта
      newImg.set({
        left: qrObj.left,
        top: qrObj.top,
        scaleX: qrObj.scaleX,
        scaleY: qrObj.scaleY,
        angle: qrObj.angle,
        isQRCode: true,
        qrText: text,
        selectable: true,
        hasControls: true,
        hasBorders: true,
      });

      // Замінюємо старий об'єкт новим
      const index = canvas.getObjects().indexOf(qrObj);
      if (index !== -1) {
        canvas.remove(qrObj);
        canvas.insertAt(newImg, index);
      }
    } catch (error) {
      console.error("Помилка регенерації QR коду:", error);
    }
  };

  // Функція для регенерації Bar коду з новими кольорами
  const regenerateBarCode = async (
    barObj,
    text,
    foregroundColor,
    backgroundColor
  ) => {
    try {
      const canvas2D = document.createElement("canvas");
      const codeType = barObj.barCodeType || "CODE128"; // Використовуємо збережений тип коду

      JsBarcode(canvas2D, text, {
        format: codeType,
        width: 2,
        height: 100,
        displayValue: true,
        background: backgroundColor,
        lineColor: foregroundColor,
      });

      const barCodeDataURL = canvas2D.toDataURL();
      const newImg = await fabric.FabricImage.fromURL(barCodeDataURL);

      // Зберігаємо властивості оригінального об'єкта
      newImg.set({
        left: barObj.left,
        top: barObj.top,
        scaleX: barObj.scaleX,
        scaleY: barObj.scaleY,
        angle: barObj.angle,
        isBarCode: true,
        barCodeText: text,
        barCodeType: codeType,
        selectable: true,
        hasControls: true,
        hasBorders: true,
      });

      // Замінюємо старий об'єкт новим
      const index = canvas.getObjects().indexOf(barObj);
      if (index !== -1) {
        canvas.remove(barObj);
        canvas.insertAt(newImg, index);
      }
    } catch (error) {
      console.error("Помилка регенерації Bar коду:", error);
    }
  };

  // Оновлена функція для зміни кольору всіх текстів та фону canvas
  const updateColorScheme = (
    textColor,
    backgroundColor,
    backgroundType = "solid",
    colorIndex = 0
  ) => {
    if (!canvas) return;

    // Оновлюємо індекс обраного кольору
    setSelectedColorIndex(colorIndex);

    // Оновлюємо глобальні кольори
    updateGlobalColors({
      textColor,
      backgroundColor,
      strokeColor: textColor,
      fillColor: textColor === "#FFFFFF" ? backgroundColor : "transparent",
      backgroundType,
    });

    // Змінюємо колір всіх об'єктів на canvas (крім Cut елементів)
    const objects = canvas.getObjects();

    objects.forEach((obj) => {
      // Пропускаємо об'єкти, які позначені як Cut елементи
      if (obj.isCutElement) return;

      if (obj.type === "i-text" || obj.type === "text") {
        obj.set({ fill: textColor });
      } else if (
        obj.type === "rect" ||
        obj.type === "circle" ||
        obj.type === "ellipse" ||
        obj.type === "triangle" ||
        obj.type === "polygon" ||
        obj.type === "path"
      ) {
        // Для фігур встановлюємо stroke колір та прозору заливку або колір тексту
        obj.set({
          stroke: textColor,
          fill:
            obj.fill === "transparent" || obj.fill === ""
              ? "transparent"
              : textColor,
        });
      } else if (obj.type === "line") {
        obj.set({ stroke: textColor });
      }
      // QR та Bar коди залишаємо без змін - вони будуть використовувати нові кольори при створенні
    });

    // Встановлюємо фон canvas
    if (backgroundType === "solid") {
      canvas.set("backgroundColor", backgroundColor);
    } else if (backgroundType === "gradient") {
      // Місце для градієнта - буде реалізовано пізніше
      canvas.set("backgroundColor", backgroundColor); // Тимчасово використовуємо solid color
    } else if (backgroundType === "texture") {
      // Місце для текстури - буде реалізовано пізніше
      canvas.set("backgroundColor", backgroundColor); // Тимчасово використовуємо solid color
    }

    // Рендеримо canvas
    canvas.renderAll();
  };

  // Додавання тексту
  const addText = () => {
    if (canvas) {
      const text = new fabric.IText("Текст", {
        left: canvas.width / 2,
        top: canvas.height / 2,
        originX: "center",
        originY: "center",
        fontFamily: "Arial",
        fill: globalColors.textColor,
        fontSize: 20,
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.renderAll();
    }
  };

  // Додавання зображення через IconMenu
  const addImage = () => {
    setIsIconMenuOpen(true);
  };

  // Додавання зображення через файловий діалог (для Upload кнопки)
  const addUploadImage = () => {
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
          // Перевіряємо чи це SVG файл
          if (
            file.type === "image/svg+xml" ||
            file.name.toLowerCase().endsWith(".svg")
          ) {
            // Обробляємо SVG файл з застосуванням кольорів
            let svgText = event.target.result;

            // Застосовуємо поточні кольори до SVG
            if (
              globalColors.strokeColor &&
              globalColors.strokeColor !== "transparent"
            ) {
              svgText = svgText
                .replace(/fill="[^"]*"/g, `fill="${globalColors.strokeColor}"`)
                .replace(
                  /stroke="[^"]*"/g,
                  `stroke="${globalColors.strokeColor}"`
                );

              // Додаємо стилі до SVG, якщо їх немає
              if (!svgText.includes("fill=") && !svgText.includes("style=")) {
                svgText = svgText.replace(
                  /<svg([^>]*)>/,
                  `<svg$1 fill="${globalColors.strokeColor}">`
                );
              }
            }

            try {
              // Спробуємо завантажити як SVG об'єкт
              const result = await fabric.loadSVGFromString(svgText);
              let svgObject;
              if (result.objects.length === 1) {
                svgObject = result.objects[0];
              } else {
                svgObject = fabric.util.groupSVGElements(
                  result.objects,
                  result.options
                );
              }

              // Застосовуємо кольори до SVG об'єктів
              const applyColorsToObject = (obj) => {
                if (obj.type === "group") {
                  obj.forEachObject(applyColorsToObject);
                } else {
                  if (
                    globalColors.strokeColor &&
                    globalColors.strokeColor !== "transparent"
                  ) {
                    obj.set({
                      fill: globalColors.strokeColor,
                      stroke: globalColors.strokeColor,
                    });
                  }
                }
              };

              applyColorsToObject(svgObject);

              // Масштабуємо SVG, якщо воно занадто велике
              const bounds = svgObject.getBoundingRect
                ? svgObject.getBoundingRect()
                : { width: 100, height: 100 };
              const maxWidth = 300;
              const maxHeight = 300;

              if (bounds.width > maxWidth || bounds.height > maxHeight) {
                const scale = Math.min(
                  maxWidth / bounds.width,
                  maxHeight / bounds.height
                );
                svgObject.scale(scale);
              }

              svgObject.set({
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: "center",
                originY: "center",
                selectable: true,
                hasControls: true,
                hasBorders: true,
              });

              canvas.add(svgObject);
              canvas.setActiveObject(svgObject);
              canvas.renderAll();
            } catch (svgError) {
              console.warn(
                "Не вдалося завантажити як SVG, спробуємо як зображення:",
                svgError
              );
              // Якщо не вдалося завантажити як SVG, завантажуємо як звичайне зображення
              const img = await fabric.FabricImage.fromURL(
                event.target.result,
                {
                  crossOrigin: "anonymous",
                }
              );

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
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: "center",
                originY: "center",
                selectable: true,
                hasControls: true,
                hasBorders: true,
              });

              canvas.add(img);
              canvas.setActiveObject(img);
              canvas.renderAll();
            }
          } else {
            // Обробляємо звичайні растрові зображення
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
              left: canvas.width / 2,
              top: canvas.height / 2,
              originX: "center",
              originY: "center",
              selectable: true,
              hasControls: true,
              hasBorders: true,
            });

            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
          }
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

  // Border button handler (clean skeleton). Logic will be extended per shape.
  const addBorder = () => {
    if (!canvas) return;
    // 1. Remove temporary outline so visual state is clean
    const outline = canvas.getObjects().find(o => o.isCanvasOutline);
    if (outline) canvas.remove(outline);

    // 2. Detect current figure type (via state or clipPath)
    const shapeType = currentShapeType; // fallback could inspect canvas.clipPath.type

    // 3. If border already exists -> toggle off (remove it) for now
    const existing = canvas.getObjects().filter(o => o.isBorderShape || o.isRectangleInnerBorder || o.isCircleInnerBorder || o.isEllipseInnerBorder || o.isHalfCircleInnerBorder || o.isExtendedHalfCircleInnerBorder || o.isHexagonInnerBorder || o.isOctagonInnerBorder || o.isTriangleInnerBorder || o.isArrowLeftInnerBorder || o.isArrowRightInnerBorder || o.isAdaptiveTriangleInnerBorder || o.isLockInnerBorder);
    if (existing.length) {
      existing.forEach(o => canvas.remove(o));
      // After removing, restore thin outline
      updateCanvasOutline();
      canvas.requestRenderAll();
      return;
    }

    // 4. Apply baseline inner border depending on shape type
    if (shapeType === 'rectangle') {
      applyRectangleInnerBorder({ thicknessMm: 1, color: '#000' });
    } else if (shapeType === 'circle') {
      applyCircleInnerBorder({ thicknessMm: 1, color: '#000' });
    } else if (shapeType === 'ellipse') {
      applyEllipseInnerBorder({ thicknessMm: 1, color: '#000' });
    } else if (shapeType === 'halfCircle') {
      applyHalfCircleInnerBorder({ thicknessMm: 1, color: '#000' });
    } else if (shapeType === 'extendedHalfCircle') {
      applyExtendedHalfCircleInnerBorder({ thicknessMm: 1, color: '#000' });
    } else if (shapeType === 'hexagon') {
      applyHexagonInnerBorder({ thicknessMm: 1, color: '#000' });
    } else if (shapeType === 'octagon') {
      applyOctagonInnerBorder({ thicknessMm: 1, color: '#000' });
    } else if (shapeType === 'triangle') {
      applyTriangleInnerBorder({ thicknessMm: 1, color: '#000' });
    } else if (shapeType === 'arrowLeft') {
      applyArrowLeftInnerBorder({ thicknessMm: 1, color: '#000' });
    } else if (shapeType === 'arrowRight') {
      applyArrowRightInnerBorder({ thicknessMm: 1, color: '#000' });
    } else if (shapeType === 'adaptiveTriangle') {
      applyAdaptiveTriangleInnerBorder({ thicknessMm: 1, color: '#000' });
    } else if (shapeType === 'lock') {
      applyLockInnerBorder({ thicknessMm: 1, color: '#000' });
    } else {
      console.warn('Border placeholder: shape not yet supported', shapeType);
      updateCanvasOutline(); // keep outline if nothing added
    }
    canvas.requestRenderAll();
  };

  // Cut (відкриття селектора форм вирізів)
  const cut = () => {
    setIsCutOpen(true);
  };

  // Функції для різних типів отворів

  // Допоміжні функції для обчислення відступів отворів
  // Отримати мін/макс габарити фігури в мм (пріоритетно з clipPath)
  const getFigureDimsMm = () => {
    let minMm = 0;
    let maxMm = 0;
    if (canvas) {
      const cp = canvas.clipPath;
      if (cp) {
        try {
          if (cp.type === "rect") {
            const w = pxToMm(cp.width || 0);
            const h = pxToMm(cp.height || 0);
            minMm = Math.min(w, h);
            maxMm = Math.max(w, h);
          } else if (cp.type === "circle") {
            const d = pxToMm((cp.radius || 0) * 2);
            minMm = d;
            maxMm = d;
          } else if (cp.type === "ellipse") {
            const w = pxToMm((cp.rx || 0) * 2);
            const h = pxToMm((cp.ry || 0) * 2);
            minMm = Math.min(w, h);
            maxMm = Math.max(w, h);
          } else if (cp.type === "polygon" && Array.isArray(cp.points)) {
            const xs = cp.points.map((p) => p.x);
            const ys = cp.points.map((p) => p.y);
            const w = Math.max(...xs) - Math.min(...xs) || 0;
            const h = Math.max(...ys) - Math.min(...ys) || 0;
            const wMm = pxToMm(w);
            const hMm = pxToMm(h);
            minMm = Math.min(wMm, hMm);
            maxMm = Math.max(wMm, hMm);
          } else if (
            typeof cp.width === "number" &&
            typeof cp.height === "number"
          ) {
            const w = pxToMm(cp.width);
            const h = pxToMm(cp.height);
            minMm = Math.min(w, h);
            maxMm = Math.max(w, h);
          }
        } catch { }
      }
      if (!minMm || !maxMm) {
        const ds =
          typeof canvas.getDesignSize === "function"
            ? canvas.getDesignSize()
            : null;
        if (
          ds &&
          typeof ds.width === "number" &&
          typeof ds.height === "number"
        ) {
          const w = pxToMm(ds.width);
          const h = pxToMm(ds.height);
          minMm = Math.min(w, h);
          maxMm = Math.max(w, h);
        } else {
          const widthPx = canvas.getWidth?.() || 0;
          const heightPx = canvas.getHeight?.() || 0;
          const w = pxToMm(widthPx);
          const h = pxToMm(heightPx);
          minMm = Math.min(w, h);
          maxMm = Math.max(w, h);
        }
      }
    }
    return { minMm, maxMm };
  };

  // Емпірична формула відступу (з ескізів):
  // offsetMm = clamp(0, 7.5, 0.03 * maxSideMm + clamp(0.8, 3.2, 4.8 - 18/diameterMm))
  const getHoleOffsetPx = () => {
    const { maxMm } = getFigureDimsMm();
    const d = Math.max(holesDiameter || 0, 0.1);
    let additive = 4.8 - 18 / d; // зменшується при збільшенні діаметра
    if (!isFinite(additive)) additive = 0;
    additive = Math.max(0.8, Math.min(additive, 3.2));
    const base = 0.03 * (maxMm || 0);
    const offsetMm = Math.min(base + additive, 7.5);
    return mmToPx(offsetMm);
  };

  // Фіксований відступ для прямокутних (квадратних) отворів — 2 мм
  const getRectHoleOffsetPx = () => mmToPx(2);

  // Тип 1 - без отворів (по дефолту)
  const addHoleType1 = () => {
    if (!canvas) return;
    clearExistingHoles();
    setIsHolesSelected(false);
    setActiveHolesType(1);
  };

  // Допоміжна: видалити всі існуючі отвори (щоб одночасно був тільки один тип)
  const clearExistingHoles = () => {
    if (!canvas) return;
    const toRemove = (canvas.getObjects?.() || []).filter(
      (o) => o.isCutElement && o.cutType === "hole"
    );
    toRemove.forEach((o) => canvas.remove(o));
    canvas.requestRenderAll?.();
  };

  // Тип 2 - отвір по центру ширини і зверху по висоті (відступ ~4мм)
  const addHoleType2 = () => {
    if (canvas) {
      clearExistingHoles();
      setIsHolesSelected(true);
      setActiveHolesType(2);
      const canvasWidth = canvas.getWidth();
      const offsetPx = getHoleOffsetPx();
      try {
        console.log(
          `Відступ отворів: ${pxToMm(offsetPx).toFixed(
            2
          )} мм (тип 2, Ø ${holesDiameter} мм)`
        );
      } catch { }
      const hole = new fabric.Circle({
        left: canvasWidth / 2,
        top: offsetPx,
        radius: mmToPx((holesDiameter || 2.5) / 2),
        fill: "#FFFFFF", // Білий фон дирки
        stroke: "#000000", // Чорний бордер
        strokeWidth: 1, // 1px
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        // Статичне розміщення: заборонити вибір/переміщення мишкою
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });
      canvas.add(hole);
      canvas.renderAll();
    }
  };

  // Тип 3 - два отвори по середині висоти, по бокам ширини (відступ 15px)
  const addHoleType3 = () => {
    if (canvas) {
      clearExistingHoles();
      setIsHolesSelected(true);
      setActiveHolesType(3);
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      const offsetPx = getHoleOffsetPx();
      try {
        console.log(
          `Відступ отворів: ${pxToMm(offsetPx).toFixed(
            2
          )} мм (тип 3, Ø ${holesDiameter} мм)`
        );
      } catch { }

      // Лівий отвір
      const leftHole = new fabric.Circle({
        left: offsetPx,
        top: canvasHeight / 2,
        radius: mmToPx((holesDiameter || 2.5) / 2),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });

      // Правий отвір
      const rightHole = new fabric.Circle({
        left: canvasWidth - offsetPx,
        top: canvasHeight / 2,
        radius: mmToPx((holesDiameter || 2.5) / 2),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });

      canvas.add(leftHole);
      canvas.add(rightHole);
      canvas.renderAll();
    }
  };

  // Тип 4 - 4 отвори по кутам (відступ 15px)
  const addHoleType4 = () => {
    if (canvas) {
      clearExistingHoles();
      setIsHolesSelected(true);
      setActiveHolesType(4);
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      const offsetPx = getHoleOffsetPx();
      try {
        console.log(
          `Відступ отворів: ${pxToMm(offsetPx).toFixed(
            2
          )} мм (тип 4, Ø ${holesDiameter} мм)`
        );
      } catch { }

      // Верхній лівий
      const topLeft = new fabric.Circle({
        left: offsetPx,
        top: offsetPx,
        radius: mmToPx((holesDiameter || 2.5) / 2),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });

      // Верхній правий
      const topRight = new fabric.Circle({
        left: canvasWidth - offsetPx,
        top: offsetPx,
        radius: mmToPx((holesDiameter || 2.5) / 2),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });

      // Нижній лівий
      const bottomLeft = new fabric.Circle({
        left: offsetPx,
        top: canvasHeight - offsetPx,
        radius: mmToPx((holesDiameter || 2.5) / 2),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });

      // Нижній правий
      const bottomRight = new fabric.Circle({
        left: canvasWidth - offsetPx,
        top: canvasHeight - offsetPx,
        radius: mmToPx((holesDiameter || 2.5) / 2),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });

      canvas.add(topLeft);
      canvas.add(topRight);
      canvas.add(bottomLeft);
      canvas.add(bottomRight);
      canvas.renderAll();
    }
  };

  // Тип 5 - 4 прямокутні отвори по кутам (відступ 15px)
  const addHoleType5 = () => {
    if (canvas) {
      clearExistingHoles();
      setIsHolesSelected(true);
      setActiveHolesType(5);
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      const offsetPx = getRectHoleOffsetPx();
      try {
        console.log(
          `Відступ отворів: ${pxToMm(offsetPx).toFixed(
            2
          )} мм (тип 5, квадратні, розмір ≈ ${holesDiameter} мм)`
        );
      } catch { }

      // Верхній лівий
      const topLeft = new fabric.Rect({
        left: offsetPx,
        top: offsetPx,
        width: mmToPx(holesDiameter || 2.5),
        height: mmToPx(holesDiameter || 2.5),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });

      // Верхній правий
      const topRight = new fabric.Rect({
        left: canvasWidth - offsetPx,
        top: offsetPx,
        width: mmToPx(holesDiameter || 2.5),
        height: mmToPx(holesDiameter || 2.5),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });

      // Нижній лівий
      const bottomLeft = new fabric.Rect({
        left: offsetPx,
        top: canvasHeight - offsetPx,
        width: mmToPx(holesDiameter || 2.5),
        height: mmToPx(holesDiameter || 2.5),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });

      // Нижній правий
      const bottomRight = new fabric.Rect({
        left: canvasWidth - offsetPx,
        top: canvasHeight - offsetPx,
        width: mmToPx(holesDiameter || 2.5),
        height: mmToPx(holesDiameter || 2.5),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });

      canvas.add(topLeft);
      canvas.add(topRight);
      canvas.add(bottomLeft);
      canvas.add(bottomRight);
      canvas.renderAll();
    }
  };

  // Тип 6 - отвір по середині висоти і лівого краю ширини
  const addHoleType6 = () => {
    if (canvas) {
      clearExistingHoles();
      setIsHolesSelected(true);
      setActiveHolesType(6);
      const canvasHeight = canvas.getHeight();
      const offsetPx = getHoleOffsetPx();
      try {
        console.log(
          `Відступ отворів: ${pxToMm(offsetPx).toFixed(
            2
          )} мм (тип 6, Ø ${holesDiameter} мм)`
        );
      } catch { }

      const leftHole = new fabric.Circle({
        left: offsetPx,
        top: canvasHeight / 2,
        radius: mmToPx((holesDiameter || 3) / 2),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });

      canvas.add(leftHole);
      canvas.renderAll();
    }
  };

  // Тип 7 - отвір по середині висоти і правого краю ширини
  const addHoleType7 = () => {
    if (canvas) {
      clearExistingHoles();
      setIsHolesSelected(true);
      setActiveHolesType(7);
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      const offsetPx = getHoleOffsetPx();
      try {
        console.log(
          `Відступ отворів: ${pxToMm(offsetPx).toFixed(
            2
          )} мм (тип 7, Ø ${holesDiameter} мм)`
        );
      } catch { }

      const rightHole = new fabric.Circle({
        left: canvasWidth - offsetPx,
        top: canvasHeight / 2,
        radius: mmToPx((holesDiameter || 3) / 2),
        fill: "#FFFFFF",
        stroke: "#000000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });

      canvas.add(rightHole);
      canvas.renderAll();
    }
  };

  // Експорт шаблону в Excel
  const exportToExcel = () => {
    if (!canvas) {
      alert("Canvas не ініціалізований");
      return;
    }

    try {
      // Збираємо дані про всі об'єкти на canvas
      const canvasData = {
        width: canvas.getWidth(),
        height: canvas.getHeight(),
        backgroundColor:
          canvas.backgroundColor || canvas.get("backgroundColor") || "#ffffff",
        objects: [],
      };

      // Проходимо по всіх об'єктах canvas
      canvas.getObjects().forEach((obj, index) => {
        const objData = {
          id: index,
          type: obj.type,
          left: obj.left || 0,
          top: obj.top || 0,
          width: obj.width || (obj.radius ? obj.radius * 2 : 0),
          height: obj.height || (obj.radius ? obj.radius * 2 : 0),
          scaleX: obj.scaleX || 1,
          scaleY: obj.scaleY || 1,
          angle: obj.angle || 0,
          fill: obj.fill || "#000000",
          stroke: obj.stroke || null,
          strokeWidth: obj.strokeWidth || 0,
          opacity: obj.opacity !== undefined ? obj.opacity : 1,
          visible: obj.visible !== undefined ? obj.visible : true,
          originX: obj.originX || "left",
          originY: obj.originY || "top",
        };

        // Додаткові властивості для тексту
        if (obj.type === "i-text" || obj.type === "text") {
          objData.text = obj.text || "";
          objData.fontSize = obj.fontSize || 20;
          objData.fontFamily = obj.fontFamily || "Arial";
          objData.fontWeight = obj.fontWeight || "normal";
          objData.fontStyle = obj.fontStyle || "normal";
          objData.textAlign = obj.textAlign || "left";
        }

        // Додаткові властивості для зображень
        if (obj.type === "image") {
          try {
            objData.src = obj.getSrc ? obj.getSrc() : obj.src;
          } catch (e) {
            console.warn("Не вдалося отримати src зображення:", e);
            objData.src = "";
          }
        }

        // Додаткові властивості для кругів
        if (obj.type === "circle") {
          objData.radius = obj.radius || 50;
        }

        // Додаткові властивості для полігонів
        if (obj.type === "polygon") {
          objData.points = obj.points || [];
        }

        // Додаткові властивості для path (включаючи halfCircle)
        if (obj.type === "path") {
          objData.path = obj.path || "";
        }

        canvasData.objects.push(objData);
      });

      console.log("Exporting data:", canvasData); // Для діагностики

      // Створюємо Excel файл
      const worksheet = XLSX.utils.json_to_sheet([
        { property: "Canvas Width", value: canvasData.width },
        { property: "Canvas Height", value: canvasData.height },
        { property: "Background Color", value: canvasData.backgroundColor },
        { property: "Objects Count", value: canvasData.objects.length },
        { property: "", value: "" }, // Порожній рядок
        { property: "=== OBJECTS DATA ===", value: "" },
        ...canvasData.objects.map((obj, index) => ({
          property: `Object ${index + 1}`,
          value: JSON.stringify(obj),
        })),
      ]);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Canvas Template");

      // Завантажуємо файл
      const fileName = `canvas-template-${Date.now()}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      alert(
        `Шаблон успішно експортовано! Збережено об'єктів: ${canvasData.objects.length}`
      );
    } catch (error) {
      console.error("Помилка експорту:", error);
      alert(`Помилка при експорті шаблону: ${error.message}`);
    }
  };

  // Імпорт шаблону з Excel
  const importFromExcel = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          // Читаємо перший лист
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          console.log("Imported data:", jsonData); // Для діагностики

          if (!jsonData || jsonData.length === 0) {
            throw new Error("Файл не містить даних");
          }

          // Очищуємо canvas
          if (canvas) {
            canvas.clear();
          }

          // Знаходимо параметри canvas (з більш гнучким пошуком)
          let canvasWidth = 800;
          let canvasHeight = 600;
          let backgroundColor = "#ffffff";

          // Шукаємо параметри canvas
          jsonData.forEach((row) => {
            if (row.property === "Canvas Width" && row.value) {
              canvasWidth = Number(row.value) || 800;
            }
            if (row.property === "Canvas Height" && row.value) {
              canvasHeight = Number(row.value) || 600;
            }
            if (row.property === "Background Color" && row.value) {
              backgroundColor = row.value || "#ffffff";
            }
          });

          // Встановлюємо розміри canvas
          if (canvas) {
            canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
            // Використовуємо правильний метод для fabric.js v6+
            canvas.set("backgroundColor", backgroundColor);
            canvas.renderAll();
          }

          // Відновлюємо об'єкти
          const objectsData = jsonData.filter(
            (row) =>
              row.property &&
              row.property.toString().startsWith("Object ") &&
              row.value &&
              row.value.toString().trim() !== ""
          );

          console.log("Objects to restore:", objectsData.length); // Для діагностики

          let restoredCount = 0;

          objectsData.forEach((row, index) => {
            try {
              let objData;

              // Спробуємо розпарсити JSON
              if (typeof row.value === "string") {
                objData = JSON.parse(row.value);
              } else {
                objData = row.value;
              }

              if (!objData || !objData.type) {
                console.warn(`Object ${index + 1} has no type:`, objData);
                return;
              }

              console.log(
                `Restoring object ${index + 1}:`,
                objData.type,
                objData
              ); // Для діагностики

              // Створюємо об'єкт відповідно до типу
              let fabricObj = null;

              switch (objData.type) {
                case "rect":
                  fabricObj = new fabric.Rect({
                    left: objData.left || 0,
                    top: objData.top || 0,
                    width: objData.width || 100,
                    height: objData.height || 100,
                    fill: objData.fill || "#000000",
                    stroke: objData.stroke || null,
                    strokeWidth: objData.strokeWidth || 0,
                    originX: objData.originX || "left",
                    originY: objData.originY || "top",
                  });
                  break;

                case "circle":
                  fabricObj = new fabric.Circle({
                    left: objData.left || 0,
                    top: objData.top || 0,
                    radius: objData.radius || 50,
                    fill: objData.fill || "#000000",
                    stroke: objData.stroke || null,
                    strokeWidth: objData.strokeWidth || 0,
                    originX: objData.originX || "left",
                    originY: objData.originY || "top",
                  });
                  break;

                case "triangle":
                  fabricObj = new fabric.Triangle({
                    left: objData.left || 0,
                    top: objData.top || 0,
                    width: objData.width || 100,
                    height: objData.height || 100,
                    fill: objData.fill || "#000000",
                    stroke: objData.stroke || null,
                    strokeWidth: objData.strokeWidth || 0,
                    originX: objData.originX || "left",
                    originY: objData.originY || "top",
                  });
                  break;

                case "i-text":
                case "text":
                  fabricObj = new fabric.IText(objData.text || "Text", {
                    left: objData.left || 0,
                    top: objData.top || 0,
                    fontSize: objData.fontSize || 20,
                    fontFamily: objData.fontFamily || "Arial",
                    fill: objData.fill || "#000000",
                    fontWeight: objData.fontWeight || "normal",
                    fontStyle: objData.fontStyle || "normal",
                    textAlign: objData.textAlign || "left",
                    originX: objData.originX || "left",
                    originY: objData.originY || "top",
                  });
                  break;

                case "polygon":
                  if (objData.points && Array.isArray(objData.points)) {
                    fabricObj = new fabric.Polygon(objData.points, {
                      left: objData.left || 0,
                      top: objData.top || 0,
                      fill: objData.fill || "#000000",
                      stroke: objData.stroke || null,
                      strokeWidth: objData.strokeWidth || 0,
                      originX: objData.originX || "left",
                      originY: objData.originY || "top",
                    });
                  }
                  break;

                case "path":
                  if (objData.path) {
                    fabricObj = new fabric.Path(objData.path, {
                      left: objData.left || 0,
                      top: objData.top || 0,
                      fill: objData.fill || "#000000",
                      stroke: objData.stroke || null,
                      strokeWidth: objData.strokeWidth || 0,
                      originX: objData.originX || "left",
                      originY: objData.originY || "top",
                    });
                  }
                  break;

                case "image":
                  if (objData.src) {
                    fabric.FabricImage.fromURL(objData.src)
                      .then((img) => {
                        img.set({
                          left: objData.left || 0,
                          top: objData.top || 0,
                          scaleX: objData.scaleX || 1,
                          scaleY: objData.scaleY || 1,
                          angle: objData.angle || 0,
                          opacity: objData.opacity || 1,
                          originX: objData.originX || "left",
                          originY: objData.originY || "top",
                        });
                        canvas.add(img);
                        canvas.renderAll();
                      })
                      .catch((err) => {
                        console.error("Помилка завантаження зображення:", err);
                      });
                  }
                  break;

                default:
                  console.warn(`Unknown object type: ${objData.type}`);
                  break;
              }

              // Додаємо об'єкт на canvas (крім зображень, які додаються асинхронно)
              if (fabricObj && canvas) {
                fabricObj.set({
                  scaleX: objData.scaleX || 1,
                  scaleY: objData.scaleY || 1,
                  angle: objData.angle || 0,
                  opacity: objData.opacity !== undefined ? objData.opacity : 1,
                  visible:
                    objData.visible !== undefined ? objData.visible : true,
                });
                canvas.add(fabricObj);
                restoredCount++;
              }
            } catch (objError) {
              console.error(
                `Помилка створення об'єкта ${index + 1}:`,
                objError,
                row
              );
            }
          });

          if (canvas) {
            canvas.renderAll();
          }

          alert(
            `Шаблон успішно імпортовано! Відновлено об'єктів: ${restoredCount}`
          );
        } catch (error) {
          console.error("Детальна помилка імпорту:", error);
          alert(
            `Помилка при імпорті шаблону: ${error.message}. Перевірте консоль для деталей.`
          );
        }
      };

      reader.onerror = (error) => {
        console.error("Помилка читання файлу:", error);
        alert("Помилка при читанні файлу");
      };

      reader.readAsArrayBuffer(file);
    };

    input.click();
  };

  // Фігури (Shape Icons) - встановлюють форму canvas
  const resetCornerRadiusState = () => {
    setSizeValues(prev => ({ ...prev, cornerRadius: 0 }));
  };

  // Icon0 - Прямокутник (задає форму canvas)
  const addRectangle = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("rectangle");

      // Встановлюємо розміри canvas (120x80 мм для прямокутника з відступами)
      const width = 120; // mm
      const height = 80; // mm
      canvas.setDimensions({ width: mmToPx(width), height: mmToPx(height) });

      // Створюємо clipPath для обмеження області малювання
      const clipPath = new fabric.Rect({
        left: 0,
        top: 0,
        width: mmToPx(width) - 1,
        height: mmToPx(height) - 1,
        absolutePositioned: true,
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в стані
      setSizeValues((prev) => ({ ...prev, width, height, cornerRadius: 0 }));

      // Додаємо візуальний контур
      updateCanvasOutline();

      // Initial inner border removed; will be added only when user presses border button

      canvas.renderAll();
    }
  };

  // Icon1 - Коло (задає форму canvas)
  const addCircle = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("circle");

      // Встановлюємо розміри canvas (100x100 мм для кола)
      const width = 100; // mm
      const height = 100; // mm
      canvas.setDimensions({ width: mmToPx(width), height: mmToPx(height) });

      // Створюємо clipPath у формі кола з правильними розмірами
      const radius = mmToPx(Math.min(width, height) / 2);
      const clipPath = new fabric.Circle({
        left: mmToPx(width) / 2,
        top: mmToPx(height) / 2,
        radius: radius,
        originX: "center",
        originY: "center",
        absolutePositioned: true,
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в стані
      setSizeValues((prev) => ({ ...prev, width, height, cornerRadius: 0 }));

      // Додаємо візуальний контур
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon2 - Еліпс (задає форму canvas)
  const addEllipse = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("ellipse");

      // Встановлюємо розміри canvas (140x80 мм для еліпса)
      const width = 140; // mm
      const height = 80; // mm
      canvas.setDimensions({ width: mmToPx(width), height: mmToPx(height) });

      // Створюємо clipPath у формі еліпса з правильними розмірами
      const clipPath = new fabric.Ellipse({
        left: mmToPx(width) / 2,
        top: mmToPx(height) / 2,
        rx: mmToPx(width) / 2,
        ry: mmToPx(height) / 2,
        originX: "center",
        originY: "center",
        absolutePositioned: true,
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в стані
      setSizeValues((prev) => ({ ...prev, width, height, cornerRadius: 0 }));

      // Додаємо візуальний контур
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon3 - Замок (задає форму canvas)
  const addLock = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("lock");

      // Зменшені фізичні розміри (раніше 120x108мм) залишаємо співвідношення 1.111... (100/90)
      const targetWidthMM = 100; // було 120
      const targetHeightMM = 90; // було 108
      const wPx = mmToPx(targetWidthMM);
      const hPx = mmToPx(targetHeightMM);
      canvas.setDimensions({ width: wPx, height: hPx });

      // Деталізовані координати полігону (усі надані точки)
      const rawPoints = lockPolygonPoints;

      // Нормалізуємо точки (0,0) у верхній лівий кут
      const minX = Math.min(...rawPoints.map((p) => p.x));
      const minY = Math.min(...rawPoints.map((p) => p.y));
      const normPoints = rawPoints.map((p) => ({ x: p.x - minX, y: p.y - minY }));
      const origWidth = Math.max(...normPoints.map((p) => p.x));
      const origHeight = Math.max(...normPoints.map((p) => p.y));

      // Масштабуємо координати напряму (без використання scaleX/scaleY)
      const shapeScaleFactor = 0.99;
      const sx = (wPx / origWidth) * shapeScaleFactor;
      const sy = (hPx / origHeight) * shapeScaleFactor;
      const scaledPoints = normPoints.map(p => ({ x: p.x * sx, y: p.y * sy }));
      const polyW = origWidth * sx;
      const polyH = origHeight * sy;
      const clipPath = new fabric.Polygon(scaledPoints, {
        left: (wPx - polyW) / 2,
        top: (hPx - polyH) / 2,
        absolutePositioned: true,
      });

      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: targetWidthMM, height: targetHeightMM, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      // Автоматично додаємо отвір типу 1 для замка
      clearExistingHoles();
      setIsHolesSelected(true);
      setActiveHolesType(2); // тип 2 (один отвір по центру зверху)
      
      // Діаметр отвору 22% від висоти фігури
      const lockHoleDiameter = targetHeightMM * 0.22;
      const lockHoleRadius = lockHoleDiameter / 2;
      // Позиція 10% від верху фігури + радіус (щоб центр кола був на правильній відстані)
      const lockHoleOffsetFromTop = targetHeightMM * 0.10 + lockHoleRadius;
      
      const hole = new fabric.Circle({
        left: wPx / 2, // по центру ширини
        top: mmToPx(lockHoleOffsetFromTop), // 10% від верху + радіус
        radius: mmToPx(lockHoleRadius),
        fill: "#FFFFFF", // Білий фон дирки
        stroke: "#000000", // Чорний бордер
        strokeWidth: 1, // 1px
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        // Статичне розміщення: заборонити вибір/переміщення мишкою
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      });
      canvas.add(hole);

      canvas.renderAll();
    }
  };

  // Icon4 - Коло з горизонтальною лінією (задає форму canvas)
  const addCircleWithLine = () => {
    if (canvas) {
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("circleWithLine");

      // Встановлюємо розміри canvas (100x100 мм для кола)
      canvas.setDimensions({ width: mmToPx(100), height: mmToPx(100) });

      // Створюємо clipPath у формі кола
      const clipPath = new fabric.Circle({
        left: mmToPx(100) / 2,
        top: mmToPx(100) / 2,
        radius: mmToPx(100) / 2,
        originX: "center",
        originY: "center",
        absolutePositioned: true,
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: 100, height: 100, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon5 - Коло з хрестом (задає форму canvas)
  const addCircleWithCross = () => {
    if (canvas) {
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("circleWithCross");

      // Встановлюємо розміри canvas (100x100 мм для кола)
      canvas.setDimensions({ width: mmToPx(100), height: mmToPx(100) });

      // Створюємо clipPath у формі кола
      const clipPath = new fabric.Circle({
        left: mmToPx(100) / 2,
        top: mmToPx(100) / 2,
        radius: mmToPx(100) / 2,
        originX: "center",
        originY: "center",
        absolutePositioned: true,
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: 100, height: 100, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon6 - Будинок (задає форму canvas)
  const addHouse = () => {
    if (canvas) {
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("house");

      // Встановлюємо розміри canvas (96x105 мм для будинка)
      const wPxH = mmToPx(96);
      const hPxH = mmToPx(105);
      canvas.setDimensions({ width: wPxH, height: hPxH });

      // Створюємо clipPath у формі будинка
      const clipPath = new fabric.Path("M6 66V105H51H90V66L48 6L6 66Z", {
        absolutePositioned: true,
        left: (wPxH - 96) / 2,
        top: (hPxH - 105) / 2,
        scaleX: Math.min(wPxH / 96, hPxH / 105),
        scaleY: Math.min(wPxH / 96, hPxH / 105),
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: 96, height: 105, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon7 - Адаптивний трикутник (Polygon): видні всі кути при 190:165; при меншій ширині бокові кути обрізаються
  // Icon7 - Півкруг (задає форму canvas)
  const addExtendedHalfCircle = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("extendedHalfCircle");

      // Базовий стан як чистий півкруг (2:1) – потім користувач може збільшувати висоту
      const baseWmm = 120;
      const baseHmm = baseWmm / 2; // 60 мм
      const wPxE = mmToPx(baseWmm);
      const hPxE = mmToPx(baseHmm);
      canvas.setDimensions({ width: wPxE, height: hPxE });

      // Динамічний clipPath (адаптивна форма) як polygon
      const pts = makeAdaptiveHalfCirclePolygonPoints(wPxE, hPxE);
      const clipPath = new fabric.Polygon(pts, { absolutePositioned: true });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: baseWmm, height: baseHmm, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  const addHalfCircle = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("halfCircle");

      // Статичний півкруг (100x50 мм)
      const baseWmm = 100;
      const baseHmm = 50;
      const wPxHC = mmToPx(baseWmm);
      const hPxHC = mmToPx(baseHmm);
      canvas.setDimensions({ width: wPxHC, height: hPxHC });

      const pts = makeHalfCirclePolygonPoints(wPxHC, hPxHC);
      const clipPath = new fabric.Polygon(pts, { absolutePositioned: true });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: baseWmm, height: baseHmm, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon8 - Адаптивний трикутник (задає форму canvas)
  const addAdaptiveTriangle = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Тип поточної фігури - адаптивний трикутник
      setCurrentShapeType("adaptiveTriangle");

      // Початкові розміри — референс 190x165 мм (по дефолту трикутник)
      const width = 190;
      const height = 165;
      canvas.setDimensions({ width: mmToPx(width), height: mmToPx(height) });

      // Побудова адаптивного трикутника та обрізання по краях
      const pts = getAdaptiveTrianglePoints(mmToPx(width), mmToPx(height));
      const clipPath = new fabric.Polygon(pts, { absolutePositioned: true });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width, height, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon9 - Шестикутник (задає форму canvas)
  const addHexagon = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("hexagon");

      // Встановлюємо розміри canvas (127x114 мм для шестикутника)
      canvas.setDimensions({ width: mmToPx(127), height: mmToPx(114) });

      // Створюємо clipPath у формі шестикутника з урахуванням радіуса кутів
      const d = makeRoundedHexagonPath(
        mmToPx(127),
        mmToPx(114),
        currentShapeType === 'hexagon' ? mmToPx(sizeValues.cornerRadius || 0) : 0
      );
      const clipPath = new fabric.Path(d, { absolutePositioned: true });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: 127, height: 114, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon10 - Восьмикутник (задає форму canvas)
  const addOctagon = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("octagon");

      // Встановлюємо розміри canvas (100x100 мм для восьмикутника)
      canvas.setDimensions({ width: mmToPx(100), height: mmToPx(100) });

      // Створюємо clipPath у формі восьмикутника з урахуванням радіуса кутів
      const d = makeRoundedOctagonPath(
        mmToPx(100),
        mmToPx(100),
        currentShapeType === 'octagon' ? mmToPx(sizeValues.cornerRadius || 0) : 0
      );
      const clipPath = new fabric.Path(d, { absolutePositioned: true });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: 100, height: 100, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon11 - Трикутник (задає форму canvas)
  const addTriangleUp = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("triangle");

      // Встановлюємо розміри canvas (100x100 мм для трикутника)
      canvas.setDimensions({ width: mmToPx(100), height: mmToPx(100) });

      // Створюємо clipPath у формі трикутника з урахуванням радіуса кутів
      const d = makeRoundedTrianglePath(
        mmToPx(100),
        mmToPx(100),
        currentShapeType === 'triangle' ? mmToPx(sizeValues.cornerRadius || 0) : 0
      );
      const clipPath = new fabric.Path(d, { absolutePositioned: true });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: 100, height: 100, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon12 - Стрілка вліво (задає форму canvas)
  const addArrowLeft = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("arrowLeft");

      // Встановлюємо розміри canvas (120x80 мм для стрілки)
      canvas.setDimensions({ width: mmToPx(120), height: mmToPx(80) });

      // Створюємо clipPath у формі стрілки вліво з урахуванням радіуса кутів
      const d = makeRoundedArrowLeftPath(
        mmToPx(120),
        mmToPx(80),
        currentShapeType === 'arrowLeft' ? mmToPx(sizeValues.cornerRadius || 0) : 0
      );
      const clipPath = new fabric.Path(d, { absolutePositioned: true });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: 120, height: 80, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon13 - Стрілка вправо (задає форму canvas)
  const addArrowRight = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("arrowRight");

      // Встановлюємо розміри canvas (120x80 мм для стрілки)
      canvas.setDimensions({ width: mmToPx(120), height: mmToPx(80) });

      // Створюємо clipPath у формі стрілки вправо з урахуванням радіуса кутів
      const d = makeRoundedArrowRightPath(
        mmToPx(120),
        mmToPx(80),
        currentShapeType === 'arrowRight' ? mmToPx(sizeValues.cornerRadius || 0) : 0
      );
      const clipPath = new fabric.Path(d, { absolutePositioned: true });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: 120, height: 80, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon14 - Прапор (задає форму canvas)
  const addFlag = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("flag");

      // Встановлюємо розміри canvas (720x600 мм)
      canvas.setDimensions({ width: mmToPx(720), height: mmToPx(600) });

      // Створюємо clipPath у формі прапора з урахуванням радіуса кутів
      const d = makeRoundedFlagPath(
        mmToPx(720),
        mmToPx(600),
        currentShapeType === 'flag' ? mmToPx(sizeValues.cornerRadius || 0) : 0
      );
      const clipPath = new fabric.Path(d, { absolutePositioned: true });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: 720, height: 600, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };

  // Icon15 - Ромб (задає форму canvas)
  const addDiamond = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType("diamond");

      // Встановлюємо розміри canvas (600x600 мм)
      const wPxD = mmToPx(600);
      const hPxD = mmToPx(600);
      canvas.setDimensions({ width: wPxD, height: hPxD });

      // Створюємо clipPath у формі ромба на весь canvas
      const dPath = `M${wPxD / 2} 0L${wPxD} ${hPxD / 2}L${wPxD / 2} ${hPxD}L0 ${hPxD / 2}Z`;
      const clipPath = new fabric.Path(dPath, {
        absolutePositioned: true,
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width: 600, height: 600, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();
    }
  };
  const handleInputChange = (key, max, rawValue) => {
    // Поддерживаем запятую как разделитель, затем округляем до 1 знака
    const parsed = parseFloat(String(rawValue).replace(",", "."));
    const clamped = Math.max(0, Math.min(max, isNaN(parsed) ? 0 : parsed));
    const value = round1(clamped);

    // Compute next mm values synchronously
    const next = {
      width: key === "width" ? value : sizeValues.width,
      height: key === "height" ? value : sizeValues.height,
      cornerRadius: key === "cornerRadius" ? value : sizeValues.cornerRadius,
    };
    setSizeValues((prev) => ({ ...prev, [key]: value }));

    // Apply immediately without relying on async state
    if (activeObject && canvas) {
      const currentLeft = activeObject.left;
      const currentTop = activeObject.top;

      if (activeObject.type === "circle") {
        const originalRadius = activeObject.radius;
        const targetWpx = mmToPx(round1(next.width));
        const targetHpx = mmToPx(round1(next.height));
        const scaleX = targetWpx / (originalRadius * 2);
        const scaleY = targetHpx / (originalRadius * 2);
        activeObject.set({
          scaleX,
          scaleY,
          left: currentLeft,
          top: currentTop,
        });
      } else if (activeObject.type === "ellipse") {
        const originalRx = activeObject.rx;
        const originalRy = activeObject.ry;
        if (key === "width") {
          const scaleX = mmToPx(value) / (originalRx * 2);
          activeObject.set({ scaleX, left: currentLeft, top: currentTop });
        } else if (key === "height") {
          const scaleY = mmToPx(value) / (originalRy * 2);
          activeObject.set({ scaleY, left: currentLeft, top: currentTop });
        } else if (key === "cornerRadius") {
          const rPx = mmToPx(value);
          activeObject.set({ rx: rPx, ry: rPx });
        }
      } else {
        const originalWidth = activeObject.width;
        const originalHeight = activeObject.height;
        if (key === "width") {
          const scaleX = mmToPx(value) / originalWidth;
          activeObject.set({ scaleX, left: currentLeft, top: currentTop });
        } else if (key === "height") {
          const scaleY = mmToPx(value) / originalHeight;
          activeObject.set({ scaleY, left: currentLeft, top: currentTop });
        } else if (key === "cornerRadius") {
          const rPx = mmToPx(value);
          activeObject.set({ rx: rPx, ry: rPx });
        }
      }
      canvas.renderAll();
    } else if (canvas) {
      // Update canvas/clipPath using explicit overrides to avoid one-step lag
      updateSize({
        widthMm: round1(next.width),
        heightMm: round1(next.height),
        cornerRadiusMm: round1(next.cornerRadius),
      });
    }
  };

  const changeValue = (key, delta, max) => {
    setSizeValues((prev) => {
      const cur = parseFloat(String(prev[key]).replace(",", ".")) || 0;
      const nextVal = Math.max(0, Math.min(max, cur + delta));
      const newValue = round1(nextVal);
      const updated = { ...prev, [key]: newValue };

      // Apply immediately using explicit values
      if (activeObject && canvas) {
        const currentLeft = activeObject.left;
        const currentTop = activeObject.top;

        if (activeObject.type === "circle") {
          const originalRadius = activeObject.radius;
          const scaleX = mmToPx(updated.width) / (originalRadius * 2);
          const scaleY = mmToPx(updated.height) / (originalRadius * 2);
          activeObject.set({
            scaleX,
            scaleY,
            left: currentLeft,
            top: currentTop,
          });
        } else if (activeObject.type === "ellipse") {
          const originalRx = activeObject.rx;
          const originalRy = activeObject.ry;
          if (key === "width") {
            const scaleX = mmToPx(newValue) / (originalRx * 2);
            activeObject.set({ scaleX, left: currentLeft, top: currentTop });
          } else if (key === "height") {
            const scaleY = mmToPx(newValue) / (originalRy * 2);
            activeObject.set({ scaleY, left: currentLeft, top: currentTop });
          } else if (key === "cornerRadius") {
            const rPx = mmToPx(newValue);
            activeObject.set({ rx: rPx, ry: rPx });
          }
        } else {
          const originalWidth = activeObject.width;
          const originalHeight = activeObject.height;
          if (key === "width") {
            const scaleX = mmToPx(newValue) / originalWidth;
            activeObject.set({ scaleX, left: currentLeft, top: currentTop });
          } else if (key === "height") {
            const scaleY = mmToPx(newValue) / originalHeight;
            activeObject.set({ scaleY, left: currentLeft, top: currentTop });
          } else if (key === "cornerRadius") {
            const rPx = mmToPx(newValue);
            activeObject.set({ rx: rPx, ry: rPx });
          }
        }
        canvas.renderAll();
      } else if (canvas) {
        updateSize({
          widthMm: round1(key === "width" ? newValue : updated.width),
          heightMm: round1(key === "height" ? newValue : updated.height),
          cornerRadiusMm: round1(
            key === "cornerRadius" ? newValue : updated.cornerRadius
          ),
        });
      }

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
          <span onClick={addEllipse}>{Icon2}</span>
          <span onClick={addLock}>{Icon3}</span>
          <span onClick={addCircleWithLine}>{Icon4}</span>
          <span onClick={addCircleWithCross}>{Icon5}</span>
          <span onClick={addAdaptiveTriangle}>{Icon6}</span>
          <span onClick={addHalfCircle}>{Icon7}</span>
          <span onClick={addExtendedHalfCircle}>{Icon8}</span>
          <span onClick={addHexagon}>{Icon9}</span>
          <span onClick={addOctagon}>{Icon10}</span>
          <span onClick={addTriangleUp}>{Icon11}</span>
          <span onClick={addArrowLeft}>{Icon12}</span>
          <span onClick={addArrowRight}>{Icon13}</span>
          <span onClick={addFlag}>{Icon14}</span>
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
                  handleInputChange(
                    "width",
                    activeObject ? 300 : 1200,
                    e.target.value
                  )
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() =>
                    changeValue("width", 1, activeObject ? 300 : 1200)
                  }
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() =>
                    changeValue("width", -1, activeObject ? 300 : 1200)
                  }
                />
              </div>
            </div>
          </div>

          <div
            className={styles.field}
            style={{
              opacity: isCircleSelected ? 0.5 : 1,
              cursor: isCircleSelected ? "not-allowed" : "default",
            }}
          >
            <label
              style={{ cursor: isCircleSelected ? "not-allowed" : "inherit" }}
            >
              Corner radius
            </label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                value={sizeValues.cornerRadius}
                disabled={isCircleSelected}
                style={{ cursor: isCircleSelected ? "not-allowed" : "text" }}
                onChange={(e) =>
                  !isCircleSelected &&
                  handleInputChange("cornerRadius", 50, e.target.value)
                }
              />
              <div
                className={styles.arrows}
                style={{
                  pointerEvents: isCircleSelected ? "none" : "auto",
                  opacity: isCircleSelected ? 0.6 : 1,
                }}
              >
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() =>
                    !isCircleSelected && changeValue("cornerRadius", 1, 50)
                  }
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() =>
                    !isCircleSelected && changeValue("cornerRadius", -1, 50)
                  }
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
                  handleInputChange(
                    "height",
                    activeObject ? 300 : 1200,
                    e.target.value
                  )
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() =>
                    changeValue("height", 1, activeObject ? 300 : 1200)
                  }
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() =>
                    changeValue("height", -1, activeObject ? 300 : 1200)
                  }
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
          <span
            onClick={() => updateColorScheme("#000000", "#FFFFFF", "solid", 0)}
            title="Чорний текст, білий фон"
          >
            <A1 
              borderColor={selectedColorIndex === 0 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 0 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 0 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#0000FF", "#FFFFFF", "solid", 1)}
            title="Синій текст, білий фон"
          >
            <A2 
              borderColor={selectedColorIndex === 1 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 1 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 1 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#FF0000", "#FFFFFF", "solid", 2)}
            title="Червоний текст, білий фон"
          >
            <A3 
              borderColor={selectedColorIndex === 2 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 2 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 2 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#000000", "solid", 3)}
            title="Білий текст, чорний фон"
          >
            <A4 
              borderColor={selectedColorIndex === 3 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 3 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 3 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#0000FF", "solid", 4)}
            title="Білий текст, синій фон"
          >
            <A5 
              borderColor={selectedColorIndex === 4 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 4 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 4 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#FF0000", "solid", 5)}
            title="Білий текст, червоний фон"
          >
            <A6 
              borderColor={selectedColorIndex === 5 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 5 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 5 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#00FF00", "solid", 6)}
            title="Білий текст, зелений фон"
          >
            <A7 
              borderColor={selectedColorIndex === 6 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 6 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 6 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#000000", "#FFFF00", "solid", 7)}
            title="Чорний текст, жовтий фон"
          >
            <A8 
              borderColor={selectedColorIndex === 7 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 7 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 7 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#000000", "#F0F0F0", "gradient", 8)}
            title="Чорний текст, градієнт фон"
          >
            <A9 
              borderColor={selectedColorIndex === 8 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 8 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 8 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#8B4513", "solid", 9)}
            title="Білий текст, коричневий фон"
          >
            <A10 
              borderColor={selectedColorIndex === 9 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 9 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 9 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#FFA500", "solid", 10)}
            title="Білий текст, оранжевий фон"
          >
            <A11 
              borderColor={selectedColorIndex === 10 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 10 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 10 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#808080", "solid", 11)}
            title="Білий текст, сірий фон"
          >
            <A12 
              borderColor={selectedColorIndex === 11 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 11 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 11 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#000000", "#D2B48C", "texture", 12)}
            title="Чорний текст, фон дерева"
          >
            <A13 
              borderColor={selectedColorIndex === 12 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 12 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 12 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#36454F", "texture", 13)}
            title="Білий текст, карбоновий фон"
          >
            <A14 
              borderColor={selectedColorIndex === 13 ? "rgba(0, 108, 164, 1)" : "black"} 
              borderOpacity={selectedColorIndex === 13 ? "1" : "0.29"} 
              strokeWidth={selectedColorIndex === 13 ? "3" : "1"}
            />
          </span>
        </div>
        <ShapeProperties />
      </div>
      {/* 5. Elements & Tools */}
      <div className={`${styles.section} ${styles.colorSection}`}>
        <div className={styles.numbering}>
          <p>5</p>
        </div>
        <ul className={styles.elementsList}>
          <li className={styles.elementsEl} onClick={addText}>
            <span className={styles.elementsSpanWrapper}>
              <span style={{ fontWeight: "bold" }}>A</span>
              <span>Text</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addImage}>
            <span
              className={[
                styles.elementsSpanWrapper,
                isIconMenuOpen ? styles.active : "",
              ].join(" ")}
            >
              {Image}
              <span>Image</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addUploadImage}>
            <span className={styles.elementsSpanWrapper}>
              {Upload}
              <span>Upload</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addShape}>
            <span
              className={[
                styles.elementsSpanWrapper,
                isShapeOpen ? styles.active : "",
              ].join(" ")}
            >
              {Shape}
              <span>Shape</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addBorder}>
            <span className={styles.elementsSpanWrapper}>
              {Border}
              <span>Border</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={cut}>
            <span
              className={[
                styles.elementsSpanWrapper,
                isCutOpen ? styles.active : "",
              ].join(" ")}
            >
              {Cut}
              <span>Cut</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addQrCode}>
            <span
              className={[
                styles.elementsSpanWrapper,
                isQrOpen ? styles.active : "",
              ].join(" ")}
            >
              {QrCode}
              <span>QR Code</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addBarCode}>
            <span
              className={[
                styles.elementsSpanWrapper,
                isBarCodeOpen ? styles.active : "",
              ].join(" ")}
            >
              {BarCode}
              <span>Bar Code</span>
            </span>
          </li>
          {/* <li className={styles.elementsEl} onClick={exportToExcel}>
            <span className={styles.elementsSpanWrapper}>
              <span style={{ fontWeight: "bold" }}>📤</span>
              <span>Export</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={importFromExcel}>
            <span className={styles.elementsSpanWrapper}>
              <span style={{ fontWeight: "bold" }}>📥</span>
              <span>Import</span>
            </span>
          </li> */}
        </ul>
      </div>
      {/* 6. Holes */}
      <div className={`${styles.section} ${styles.colorSection}`}>
        <div className={styles.colorTitleWrapper}>
          <div className={styles.numbering}>
            <p>6</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
            <h3 style={{ marginRight: "60px" }}>Holes</h3>
            {isHolesSelected && (
              <>
                <div className={styles.field} style={{ margin: 0 }}>
                  <div className={styles.inputGroup}>
                    <input
                      type="number"
                      min={1}
                      value={holesDiameter}
                      onChange={(e) => {
                        const val = Math.max(
                          1,
                          parseFloat(e.target.value) || 1
                        );
                        setHolesDiameter(val);
                      }}
                    />
                    <div className={styles.arrows}>
                      <i
                        className="fa-solid fa-chevron-up"
                        onClick={() => setHolesDiameter((prev) => prev + 1)}
                      />
                      <i
                        className="fa-solid fa-chevron-down"
                        onClick={() =>
                          setHolesDiameter((prev) => (prev > 1 ? prev - 1 : 1))
                        }
                      />
                    </div>
                  </div>
                </div>
                <p style={{ padding: "0", margin: "0 0 0 10px" }}>Ø mm</p>
              </>
            )}
          </div>
        </div>
        <div className={styles.holes}>
          <span
            onClick={addHoleType1}
            title="Без отворів"
            className={activeHolesType === 1 ? styles.holeActive : ""}
          >
            {Hole1}
          </span>
          <span
            onClick={addHoleType2}
            title="Отвір зверху по центру"
            className={activeHolesType === 2 ? styles.holeActive : ""}
          >
            {Hole2}
          </span>
          <span
            onClick={addHoleType3}
            title="Два отвори по бокам"
            className={activeHolesType === 3 ? styles.holeActive : ""}
          >
            {Hole3}
          </span>
          <span
            onClick={addHoleType4}
            title="4 круглі отвори по кутам"
            className={activeHolesType === 4 ? styles.holeActive : ""}
          >
            {Hole4}
          </span>
          <span
            onClick={addHoleType5}
            title="4 квадратні отвори по кутам"
            className={activeHolesType === 5 ? styles.holeActive : ""}
          >
            {Hole5}
          </span>
          <span
            onClick={addHoleType6}
            title="Отвір зліва по центру"
            className={activeHolesType === 6 ? styles.holeActive : ""}
          >
            {Hole6}
          </span>
          <span
            onClick={addHoleType7}
            title="Отвір зправа по центру"
            className={activeHolesType === 7 ? styles.holeActive : ""}
          >
            {Hole7}
          </span>
        </div>
      </div>
      {/* Copies */}
      <div className={`${styles.section} ${styles.colorSection}`}>
        <div className={styles.colorTitleWrapper}>
          <h3>Copies</h3>
          <div className={styles.field} style={{ margin: 0 }}>
            <div className={styles.inputGroup}>
              <input
                type="number"
                min={1}
                value={copiesCount}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setCopiesCount(val);
                }}
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => setCopiesCount((prev) => prev + 1)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() =>
                    setCopiesCount((prev) => (prev > 1 ? prev - 1 : 1))
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Undo/Redo */}
      {/* <UndoRedo /> */}
      <QRCodeGenerator isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} />
      <BarCodeGenerator
        isOpen={isBarCodeOpen}
        onClose={() => setIsBarCodeOpen(false)}
      />
      <ShapeSelector
        isOpen={isShapeOpen}
        onClose={() => setIsShapeOpen(false)}
      />
      <CutSelector isOpen={isCutOpen} onClose={() => setIsCutOpen(false)} />
      <IconMenu
        isOpen={isIconMenuOpen}
        onClose={() => setIsIconMenuOpen(false)}
      />
      <ShapeProperties
        isOpen={isShapePropertiesOpen}
        onClose={() => setIsShapePropertiesOpen(false)}
      />
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
