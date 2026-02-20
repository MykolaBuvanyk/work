import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import CircleWithCut from "../../utils/CircleWithCut";
import styles from "./ShapeSelector.module.css";
import {
  /* ...existing code... */ makeRoundedSemiRoundPath,
} from "../ShapeProperties/ShapeProperties";
import { copyHandler as canvasCopyHandler } from "../Canvas/Canvas";
import { ensureShapeSvgId } from "../../utils/shapeSvgId";
import { fitObjectToCanvas, applyCreationScaleByCanvas } from "../../utils/canvasFit";

const DEFAULT_SHAPE_FILL = "#FFFFFF";
const DEFAULT_SHAPE_STROKE = "#000000";
const DEFAULT_ROUNDED_CORNERS_MM = 4;
const DEFAULT_SHAPE_THICKNESS_MM = 0.5;

// Unit conversion (keep consistent with Toolbar/Canvas)
const PX_PER_MM = 72 / 25.4;
const mmToPx = (mm) =>
  typeof mm === "number" && Number.isFinite(mm) ? Math.round(mm * PX_PER_MM) : 0;
const pxToMm = (px) =>
  typeof px === "number" && Number.isFinite(px) ? px / PX_PER_MM : 0;

const BASE_CANVAS_WIDTH_MM = 120;
const BASE_CANVAS_HEIGHT_MM = 80;
const BASE_TEXT_SIZE_MM = 5;
const MIN_TEXT_SIZE_MM = 3;
const BASE_MIN_SIDE_MM = Math.min(BASE_CANVAS_WIDTH_MM, BASE_CANVAS_HEIGHT_MM);

const DEFAULT_SHAPE_STROKE_WIDTH_PX = DEFAULT_SHAPE_THICKNESS_MM * PX_PER_MM;

const ShapeSelector = ({ isOpen, onClose }) => {
  const { canvas, globalColors, setActiveObject, setShapePropertiesOpen } =
    useCanvasContext();
  const [selectedShape, setSelectedShape] = useState(null);
  const dropdownRef = useRef(null);

  // Закриття по клику вне модального окна
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        if (typeof onClose === "function") onClose();
      }
    };
    document.addEventListener("mousedown", handleOutside, true);
    document.addEventListener("touchstart", handleOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside, true);
      document.removeEventListener("touchstart", handleOutside, true);
    };
  }, [isOpen, onClose]);

  const shapes = [
    { id: "rectangle", name: "Rectangle" },
    { id: "roundedCorners", name: "Rounded Corners" },
    { id: "round", name: "Round" },
    { id: "oval", name: "Oval" },
    { id: "hexagon", name: "Hexagon" },
    { id: "octagon", name: "Octagon" },
    { id: "triangle", name: "Triangle" },
    { id: "warningTriangle", name: "Warning Triangle" },
    { id: "semiround", name: "Semi round" },
    { id: "roundTop", name: "Round Top" },
    { id: "leftArrow", name: "Left arrow" },
    { id: "rightArrow", name: "Right arrow" },
    { id: "turnLeft", name: "Turn left" },
    { id: "turnRight", name: "Turn right" },
    { id: "customShape", name: "Custom shape" },
    { id: "arch", name: "180° arc" },
    { id: "quarterCircleTR", name: "90° arc" },
    { id: "rightTriangle", name: "Triangle" },
    { id: "circleWithCut", name: "Circle with cut off" },
    { id: "line", name: "Line" },
    { id: "dashedLine", name: "Dashed Line" },
  ];

  // Додаємо універсальну функцію для додавання об'єкта на canvas з коректною ініціалізацією координат
  const addObjectToCanvas = (obj) => {
    if (!canvas || !obj) return;
    canvas.add(obj);

    try {
      applyCreationScaleByCanvas(canvas, obj);
    } catch { }

    try {
      fitObjectToCanvas(canvas, obj, { maxRatio: 0.6 });
    } catch { }

    if (typeof obj.setCoords === "function") obj.setCoords();
    canvas.setActiveObject(obj);
    if (obj.bringToFront) obj.bringToFront();
    canvas.requestRenderAll();
    setTimeout(() => {
      if (!canvas) return;
      canvas.setActiveObject(obj);
      if (obj.bringToFront) obj.bringToFront();
      if (typeof obj.setCoords === "function") obj.setCoords();
      canvas.requestRenderAll();
    }, 0);
  };

  const addShape = (shapeType) => {
    if (!canvas) return;
    // Закриваємо модалку одразу після вибору фігури
    if (typeof onClose === "function") onClose();

    // Custom shape: додаємо саме ту форму, що й на іконці
    if (shapeType === "customShape") {
      const canvasW =
        typeof canvas.getWidth === "function"
          ? canvas.getWidth()
          : canvas?.width || 0;
      const canvasH =
        typeof canvas.getHeight === "function"
          ? canvas.getHeight()
          : canvas?.height || 0;
      const centerX = (canvasW || 0) / 2;
      const centerY = (canvasH || 0) / 2;
      const themeStroke =
        globalColors.strokeColor ||
        globalColors.textColor ||
        DEFAULT_SHAPE_STROKE;
      const baseOptions = {
        left: centerX,
        top: centerY,
        fill: "transparent", // прозора заливка за замовчуванням
        stroke: themeStroke,
        strokeWidth: DEFAULT_SHAPE_STROKE_WIDTH_PX,
        originX: "center",
        originY: "center",
        strokeUniform: true,
        strokeLineJoin: "round",
      };
      const d =
        "M1 15.7077V48.4538L16.75 43.1231L37.973 51.5L52.75 43.1231V15.7077H37.973L21.027 2L1 15.7077Z";
      const custom = new fabric.Path(d, {
        ...baseOptions,
        width: 54,
        height: 53,
      });
      custom.set({
        shapeType: "customShape",
        hasBorders: true,
        hasControls: true,
        selectable: true,
        useThemeColor: false,
        initialFillColor: themeStroke, // зберігаємо stroke для майбутнього увімкнення fill
        initialStrokeColor: themeStroke,
      });
      custom.pendingShapePropsDefaults = { fill: false, cut: false, frame: true };
      custom.hasFrameEnabled = true;
      custom.isFrameElement = true;
      custom.data = {
        ...(custom.data || {}),
        hasFrameEnabled: true,
        isFrameElement: true,
      };
      ensureShapeSvgId(custom, canvas);
      addObjectToCanvas(custom);
      setActiveObject(custom);
      setShapePropertiesOpen(true);
      return;
    }

    const canvasW =
      typeof canvas.getWidth === "function"
        ? canvas.getWidth()
        : canvas?.width || 0;
    const canvasH =
      typeof canvas.getHeight === "function"
        ? canvas.getHeight()
        : canvas?.height || 0;
    const centerX = (canvasW || 0) / 2;
    const centerY = (canvasH || 0) / 2;

    // Обробка QR-коду: потрібні валідні centerX/centerY
    if (shapeType === "qrcode") {
      // Додаємо простий QR-код як квадрат (замість fabric.Image або fabric.Group для справжнього QR)
      const qr = new fabric.Rect({
        left: centerX,
        top: centerY,
        width: 80,
        height: 80,
        fill: "#fff",
        stroke: "#000",
        strokeWidth: DEFAULT_SHAPE_STROKE_WIDTH_PX,
        originX: "center",
        originY: "center",
        shapeType: "qrcode",
        selectable: true,
      });
      ensureShapeSvgId(qr, canvas);
      addObjectToCanvas(qr);
      setActiveObject(qr);
      setShapePropertiesOpen(true);
      return;
    }

    let shape = null;

    const themeStroke =
      globalColors.strokeColor ||
      globalColors.textColor ||
      DEFAULT_SHAPE_STROKE;

    const baseOptions = {
      left: centerX,
      top: centerY,
      fill: "transparent", // прозора заливка за замовчуванням, оскільки fill вимкнений
      stroke: themeStroke,
      strokeWidth: DEFAULT_SHAPE_STROKE_WIDTH_PX,
      originX: "center",
      originY: "center",
      strokeUniform: true, // утримує товщину контуру при масштабуванні
      strokeLineJoin: "round",
      strokeMiterLimit: 2,
    };

    const createPath = (d, opts) => {
      try {
        // Гарантуємо, що left/top завжди є (fabric.Path може ігнорувати їх, якщо не передані явно)
        const safeOpts = {
          left: opts?.left ?? centerX,
          top: opts?.top ?? centerY,
          ...opts,
        };
        const path = new fabric.Path(d, safeOpts);
        // Додатково гарантуємо, що x/y існують для control points (деякі fabric версії це вимагають)
        if (typeof path.x !== "number") path.x = safeOpts.left;
        if (typeof path.y !== "number") path.y = safeOpts.top;
        // Додатково: якщо path.path не визначено або порожнє — не додавати shape
        if (!Array.isArray(path.path) || path.path.length === 0) return null;
        // Додатково: явно встановлюємо width/height, якщо вони не визначені
        if (typeof path.width !== "number" || isNaN(path.width))
          path.width = safeOpts.width || 52;
        if (typeof path.height !== "number" || isNaN(path.height))
          path.height = safeOpts.height || 52;
        return path;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to create Path for", shapeType, err);
        return null;
      }
    };

    switch (shapeType) {
      case "text":
        {
          const canvasWidthMm = pxToMm(
            typeof canvas.getWidth === "function" ? canvas.getWidth() : canvas.width || 0
          );
          const canvasHeightMm = pxToMm(
            typeof canvas.getHeight === "function" ? canvas.getHeight() : canvas.height || 0
          );
          const minSideMm = Math.max(0, Math.min(canvasWidthMm, canvasHeightMm));
          const defaultTextSizeMm = Math.max(
            MIN_TEXT_SIZE_MM,
            Math.round(BASE_TEXT_SIZE_MM * (minSideMm / (BASE_MIN_SIDE_MM || 1))) || BASE_TEXT_SIZE_MM
          );

        shape = new fabric.IText("Новий текст", {
          ...baseOptions,
          fontSize: mmToPx(defaultTextSizeMm),
          fontFamily: "Arial",
          fill: globalColors.textColor || "#000000",
          selectable: true,
        });
        }
        break;
      case "rectangle":
        shape = new fabric.Rect({
          ...baseOptions,
          width: 52,
          height: 52,
          rx: 0,
          ry: 0,
        });
        break;

      case "roundedCorners":
        {
          const w = 52;
          const h = 52;
          const cornerMm = DEFAULT_ROUNDED_CORNERS_MM;
          const rPx = mmToPx(cornerMm);
          const maxR = Math.max(0, Math.min(w, h) / 2 - 0.001);
          const rClamped = Math.max(0, Math.min(rPx, maxR));
          shape = new fabric.Rect({
            ...baseOptions,
            width: w,
            height: h,
            rx: rClamped,
            ry: rClamped,
          });
          // Keep the same metadata convention as other rounded shapes
          try {
            shape.set({
              displayCornerRadiusMm: cornerMm,
              cornerRadiusMm: cornerMm,
            });
          } catch {
            shape.displayCornerRadiusMm = cornerMm;
            shape.cornerRadiusMm = cornerMm;
          }
        }
        break;


      case "round":
        shape = new fabric.Circle({
          ...baseOptions,
          radius: 29,
        });
        break;

      case "oval":
        shape = new fabric.Ellipse({
          ...baseOptions,
          rx: 30,
          ry: 21,
        });
        break;

      case "hexagon":
        shape = createPath("M59 27 45 51H16L2 27 16 2h29l14 25Z", baseOptions);
        break;

      case "octagon":
        shape = createPath(
          "M39 1L55 17V39L39 55H17L1 39V17L17 1H39Z",
          baseOptions
        );
        break;

      case "triangle":
        shape = createPath("M59 51H2L31 2L59 51Z", baseOptions);
        break;
      case "arch": {
        // 180° arc
        const d = "M10 95 A40 90 0 0 1 90 95 L10 95 Z";
        shape = createPath(d, {
          ...baseOptions,
          width: 100,
          height: 100,
          scaleX: 0.8,
          scaleY: 0.8,
        });
        break;
      }
      case "quarterCircleTR": {
        // 90° arc (top-right quarter)
        const d = "M10 10H70V70A60 60 0 0 1 10 10Z";
        shape = createPath(d, {
          ...baseOptions,
          width: 70,
          height: 70,
          scaleX: 1,
          scaleY: 1,
        });
        break;
      }
      case "rightTriangle": {
        // Right triangle (прямий кут знизу-зліва)
        const d = "M2 51H59L2 2Z";
        shape = createPath(d, {
          ...baseOptions,
          width: 61,
          height: 53,
          scaleX: 1,
          scaleY: 1,
        });
        break;
      }
      case "circleWithCut": {
        // Circle with cut off
        // Використовуємо прямо імпортований клас CircleWithCut (без fallback)
        shape = new CircleWithCut({
          ...baseOptions,
          width: 60,
          height: 74,
          orientation: "vertical",
          fill: "transparent", // прозора заливка, як і в інших фігур
        });
        break;
      }

      case "warningTriangle":
        shape = createPath("M1 32V51.5H23.5H43V32L22 2L1 32Z", baseOptions);
        break;

      case "semiround":
        // Чистий півколо (дуга зверху + пряма основа), без вертикальних боків
        // Використовуємо абсолютну дугу SVG 'A' (fabric.Path підтримує)
        (() => {
          const diameter = 58; // довільний базовий розмір
          const R = diameter / 2;
          // upper semicircle: use sweep-flag=1 so arc goes over the top
          const d = `M 0 ${R} A ${R} ${R} 0 0 1 ${diameter} ${R} L 0 ${R} Z`;
          shape = createPath(d, {
            ...baseOptions,
            width: diameter,
            height: R, // висота півкола = радіус
          });
          if (shape) {
            // Позначимо тип як halfCircle, щоб у властивостях не вмикався радіус кутів для semiround
            shape.shapeType = "halfCircle";
            // Базові розміри для стабільного масштабування від слайдерів
            shape.__baseBBoxW = diameter;
            shape.__baseBBoxH = R;
          }
        })();
        break;

      case "roundTop":
        shape = createPath(
          "M 0 100 L 0 50 Q 0 0 50 0 Q 100 0 100 50 L 100 100 Z",
          baseOptions
        );
        break;

      case "leftArrow":
        shape = createPath("M56 34V10H18V3L2 22L18 41V34H56Z", baseOptions);
        break;

      case "rightArrow":
        shape = createPath("M1 34V10H39V3L55 22L39 41V34H1Z", baseOptions);
        break;

      case "turnLeft":
        shape = createPath("M14 45H43V1H13L2 23L14 45Z", baseOptions);
        break;

      case "turnRight":
        shape = createPath("M30 45H1V1H31L42 23L30 45Z", baseOptions);
        break;

      // customShape видалено (логіка вимкнена)

      case "line":
        shape = createPath("M0 0L100 0", {
          ...baseOptions,
          fill: "",
          stroke:
            globalColors.strokeColor ||
            globalColors.textColor ||
            DEFAULT_SHAPE_STROKE,
          strokeWidth: 3,
          strokeLineCap: "round",
        });
        break;

      case "dashedLine":
        shape = createPath("M0 0L100 0", {
          ...baseOptions,
          fill: "",
          stroke:
            globalColors.strokeColor ||
            globalColors.textColor ||
            DEFAULT_SHAPE_STROKE,
          strokeWidth: 3,
          strokeDashArray: [5, 5],
          strokeLineCap: "round",
        });
        break;

      default:
        return;
    }

    if (shape) {

      // Позначаємо тип фігури для подальшої логіки UI
      // Для semiround ми вже встановили shape.shapeType вище як 'halfCircle'
      if (!shape.shapeType) {
        shape.set({ shapeType: shapeType });
      }
      if (shapeType === "round") {
        // Спеціальний прапорець для кола, навіть якщо це Path
        shape.set({ isCircle: true });
      }

      // Заборонити розтягування у висоту та пропорційно для ліній
      if (shapeType === "line" || shapeType === "dashedLine") {
        shape.set({
          lockScalingY: false,
          lockUniScaling: false,
          lockScalingX: false,
        });
      }

      // Ініціалізуємо Corner Radius для підтримуваних path-фігур
      const pathShapesWithCornerRadius = [
        "hexagon",
        "octagon",
        "triangle",
        "warningTriangle",
        "semiround",
        "roundTop",
        "turnLeft",
        "turnRight",
      ];
      if (pathShapesWithCornerRadius.includes(shapeType)) {
        shape.set({
          displayCornerRadiusMm: 0,
          cornerRadiusMm: 0,
          baseCornerRadius: 0,
        });
      }

      // Початкове заповнення: нові фігури мають прозору заливку за замовчуванням
      if (shapeType === "text") {
        shape.set({ useThemeColor: true });
      } else if (shapeType === "line" || shapeType === "dashedLine") {
        shape.set({ useThemeColor: true });
      } else {
        // Для звичайних фігур встановлюємо прозору заливку, оскільки fill вимкнений за замовчуванням
        shape.set({
          fill: "transparent",
          useThemeColor: false,
          initialFillColor: themeStroke, // зберігаємо stroke для майбутнього увімкнення fill
          initialStrokeColor: themeStroke,
        });
      }

      // Гарантуємо, що у фігури активні контролы/рамка і вона обрана одразу
      shape.set({ hasBorders: true, hasControls: true, selectable: true });

      if (
        shapeType !== "text" &&
        shapeType !== "line" &&
        shapeType !== "dashedLine"
      ) {
        shape.pendingShapePropsDefaults = { fill: false, cut: false, frame: true };
        shape.initialStrokeColor = themeStroke;
        shape.hasFrameEnabled = true;
        shape.isFrameElement = true;
        shape.data = {
          ...(shape.data || {}),
          hasFrameEnabled: true,
          isFrameElement: true,
        };
      }

      // Додаємо прапорець джерела (ShapeSelector)
      shape.fromShapeTab = true;
      shape.data = { ...(shape.data || {}), fromShapeTab: true };
      ensureShapeSvgId(shape, canvas);
      addObjectToCanvas(shape);
      setActiveObject(shape);
      setShapePropertiesOpen(true);
      // Централізованная активация редактирования через copyHandler
      if (shapeType === "text" && typeof canvasCopyHandler === "function") {
        canvasCopyHandler(null, { target: shape });
      } else if (
        shapeType === "text" &&
        typeof shape.enterEditing === "function"
      ) {
        shape.enterEditing();
      }
    }
  };

  const renderShapeIcon = (shapeType) => {
    switch (shapeType) {
      case "customShape":
        return (
          <svg
            width="54"
            height="53"
            viewBox="0 0 54 53"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 15.7077V48.4538L16.75 43.1231L37.973 51.5L52.75 43.1231V15.7077H37.973L21.027 2L1 15.7077Z"
              stroke="black"
              strokeWidth="2"
            />
          </svg>
        );
      case "rectangle":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="54"
            height="54"
            fill="none"
          >
            <path fill="none" stroke="#000" strokeWidth="2" d="M1 1h52v52H1z" />
          </svg>
        );

      case "roundedCorners":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="54"
            height="54"
            fill="none"
          >
            <rect
              width="52"
              height="52"
              x="1"
              y="1"
              fill="none"
              stroke="#000"
              strokeWidth="2"
              rx="12"
            />
          </svg>
        );

      case "round":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="60"
            height="60"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M30 1a29 29 0 1 1 0 58 29 29 0 0 1 0-58Z"
            />
          </svg>
        );

      case "oval":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="60"
            height="42"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M30 1c8 0 15 2 21 6 5 4 8 9 8 14s-3 10-8 14c-6 4-13 6-21 6s-15-2-21-6c-5-4-8-9-8-14S4 11 9 7c6-4 13-6 21-6Z"
            />
          </svg>
        );

      case "hexagon":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="61"
            height="53"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M59 27 45 51H16L2 27 16 2h29l14 25Z"
            />
          </svg>
        );

      case "octagon":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="56"
            height="56"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="m39 1 16 16v22L39 55H17L1 39V17L17 1h22Z"
            />
          </svg>
        );

      case "triangle":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="61"
            height="52"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M59 51H2L31 2l28 49Z"
            />
          </svg>
        );

      case "warningTriangle":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="53"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M1 32v20h42V32L22 2 1 32Z"
            />
          </svg>
        );

      case "semiround":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="57"
            height="53"
            fill="none"
          >
            <path stroke="#000" d="M57 29a29 29 0 0 0-57 0h57Z" />
          </svg>
        );

      case "roundTop":
        return (
          <svg
            width="57"
            height="53"
            viewBox="0 0 20 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M1 9C1 10.9526 1 14 1 14H10.6429H19V9" stroke="black" />
            <path
              d="M19 9.60215C19 4.53459 15.6806 1 9.99999 1C4.31935 1 1 4.82133 1 9.88889"
              stroke="black"
            />
          </svg>
        );
      case "leftArrow":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="57"
            height="44"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M56 34V10H18V3L2 22l16 19v-7h38Z"
            />
          </svg>
        );
      case "rightArrow":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="57"
            height="44"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M1 34V10h38V3l16 19-16 19v-7H1Z"
            />
          </svg>
        );

      case "turnLeft":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="46"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M14 45h29V1H13L2 23l12 22Z"
            />
          </svg>
        );

      case "turnRight":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="46"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M30 45H1V1h30l11 22-12 22Z"
            />
          </svg>
        );

      case "arch":
        return (
          <svg
            width="70"
            height="70"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 95 A40 90 0 0 1 90 95 L10 95 Z"
              fill="none"
              stroke="#000"
              strokeWidth="2.14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "quarterCircleTR":
        return (
          <svg
            width="70"
            height="70"
            viewBox="0 0 70 70"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 9h52v52A52 52 0 0 1 9 9Z"
              stroke="#000"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="bevel"
            />
          </svg>
        );
      case "rightTriangle":
        return (
          <svg
            width="70"
            height="70"
            viewBox="0 0 61 53"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 51H59L2 2Z"
              stroke="#000"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "circleWithCut":
        return (
          <svg
            width="70"
            height="70"
            viewBox="0 0 63 74"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke="#000"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="bevel"
              strokeMiterlimit="22.9"
              d="M1 18v39M61 18v39M61 18a36 36 0 0 0-60 0M1 57a36 36 0 0 0 60 0"
            />
          </svg>
        );

      case "line":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="62"
            height="2"
            fill="none"
          >
            <path stroke="#000" strokeWidth="2" d="M0 1h62" />
          </svg>
        );

      case "dashedLine":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="62"
            height="2"
            fill="none"
          >
            <path
              stroke="#000"
              strokeDasharray="10.5 4.5"
              strokeWidth="2"
              d="M0 1h62"
            />
          </svg>
        );

      default:
        return <div></div>;
    }
  };

  return (
    <>
      {isOpen && (
        <div className={styles.shapeSelector}>
          <div className={styles.dropdown} ref={dropdownRef}>
            <div className={styles.dropdownHeader}>
              <h3>Shapes</h3>
              <button className={styles.closeBtn} onClick={onClose}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12.0008 12.0001L14.8292 14.8285M9.17236 14.8285L12.0008 12.0001L9.17236 14.8285ZM14.8292 9.17163L12.0008 12.0001L14.8292 9.17163ZM12.0008 12.0001L9.17236 9.17163L12.0008 12.0001Z"
                    stroke="#006CA4"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                    stroke="#006CA4"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div className={styles.content}>
              <div className={styles.shapesGrid}>
                {shapes.map((shape, idx) => {
                  const isLine =
                    shape.id === "line" || shape.id === "dashedLine";
                  // Вставляємо розрив рядка перед лініями (останній ряд)
                  const breakBefore = shape.id === "line";
                  return (
                    <React.Fragment key={shape.id}>
                      {breakBefore && <div className={styles.rowBreak} />}
                      <div
                        className={`${styles.shapeItem} ${isLine ? styles.lineItem : ""
                          }`}
                        onClick={() => addShape(shape.id)}
                        title={shape.name}
                      >
                        <div className={styles.shapeIcon}>
                          {renderShapeIcon(shape.id)}
                        </div>
                        <span className={styles.shapeName}>{shape.name}</span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ShapeSelector;
