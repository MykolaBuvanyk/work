import React, { useState, useEffect, useRef, useCallback } from "react";
import CustomShapeStopModal from "./CustomShapeStopModal";
import { copyHandler } from "../Canvas/Canvas";
// lock shape now: rectangle + top half-circle (width 16mm, height 8mm)
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import { useCanvasPropertiesTracker } from "../../hooks/useCanvasPropertiesTracker";
import * as fabric from "fabric";
import paper from "paper";
import JsBarcode from "jsbarcode";
import * as XLSX from "xlsx";
import UndoRedo from "../UndoRedo/UndoRedo"; // Імпорт компонента
import QRCodeGenerator from "../QRCodeGenerator/QRCodeGenerator";
import BarCodeGenerator from "../BarCodeGenerator/BarCodeGenerator";
import ShapeSelector from "../ShapeSelector/ShapeSelector";
import CutSelector from "../CutSelector/CutSelector";
import IconMenu from "../IconMenu/IconMenu";
import UploadPreview from "../UploadPreview/UploadPreview";
import ShapeProperties from "../ShapeProperties/ShapeProperties";
import { ensureShapeSvgId } from "../../utils/shapeSvgId";
import styles from "./Toolbar.module.css";
import {
  buildQrSvgMarkup,
  computeQrVectorData,
  decorateQrGroup,
  DEFAULT_QR_CELL_SIZE,
} from "../../utils/qrFabricUtils";
import {
  // Shape palette icons
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
  // Color preview icons
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
  // Toolbar glyphs
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

const DEFAULT_SHAPE_WIDTH_MM = 120;
const DEFAULT_SHAPE_HEIGHT_MM = 80;
const CUT_STROKE_COLOR = "#FD7714";
const HOLE_FILL_COLOR = "#FFFFFF";
const HOLE_ID_PREFIX = "hole";

const Toolbar = () => {
  const {
    canvas,
    globalColors,
    updateGlobalColors,
    isCustomShapeMode,
    setIsCustomShapeMode,
    setCanvasShapeType,
  } = useCanvasContext();
  // Unit conversion helpers (assume CSS 96 DPI)
  const PX_PER_MM = 72 / 25.4;
  const LOCK_ARCH_HEIGHT_MM = 8;
  const MIN_LOCK_HOLE_TOP_GAP_MM = 1.5;
  const LOCK_HOLE_EXTRA_DOWN_MM = 1;
  const mmToPx = (mm) =>
    typeof mm === "number" ? Math.round(mm * PX_PER_MM) : 0;
  const pxToMm = (px) => (typeof px === "number" ? px / PX_PER_MM : 0);
  // Единое округление до 1 знака после запятой для значений в мм (во избежание 5.1999999999)
  const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
  const [activeObject, setActiveObject] = useState(null);
  const [sizeValues, setSizeValues] = useState({
    // Store UI values in millimeters
    width: DEFAULT_SHAPE_WIDTH_MM,
    height: DEFAULT_SHAPE_HEIGHT_MM,
    cornerRadius: 0,
  });
  const [currentShapeType, setCurrentShapeType] = useState(null); // Тип поточної фігури

  // Синхронізація локального currentShapeType з глобальним canvasShapeType та canvas
  useEffect(() => {
    if (currentShapeType) {
      // Оновлюємо глобальний контекст
      if (setCanvasShapeType) {
        setCanvasShapeType(currentShapeType);
      }
      // ВИПРАВЛЕННЯ: Синхронізуємо з canvas
      if (canvas && canvas.get("shapeType") !== currentShapeType) {
        canvas.set("shapeType", currentShapeType);
        console.log("Synced canvas shapeType:", currentShapeType);
      }
    }
  }, [currentShapeType, setCanvasShapeType, canvas]);

  // Чи застосовано кастомне редагування (після натискання іконки кастом форми)
  const [isCustomShapeApplied, setIsCustomShapeApplied] = useState(false);
  // Застосовуємо дефолтну схему кольорів при завантаженні
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

  // Для lock: по умолчанию 5мм, тип дырки 2 (сверху), ограничения 2-7мм
  useEffect(() => {
    if (currentShapeType === "lock") {
      setIsHolesSelected(true);
      setActiveHolesType(2);
      setHolesDiameter(5);
    }
  }, [currentShapeType]);

  // Хардкодим ограничения только для lock и дырки сверху
  const getHolesDiameterLimits = () => {
    if (currentShapeType === "lock" && activeHolesType === 2) {
      return { min: 2, max: 7, defaultValue: 5 };
    }
    // ...оставить текущие ограничения для других случаев...
    return { min: 2.5, max: 10, defaultValue: 2.5 };
  };

  // Обработчик изменения диаметра дирки
  const handleHolesDiameterChange = (value) => {
    const { min, max } = getHolesDiameterLimits();
    let v = Number(value);
    if (isNaN(v)) v = min;
    v = Math.max(min, Math.min(max, v));
    setHolesDiameter(v);
  };
  const [isHolesSelected, setIsHolesSelected] = useState(false);
  const [activeHolesType, setActiveHolesType] = useState(1); // 1..7, за замовчуванням — без отворів
  const [selectedColorIndex, setSelectedColorIndex] = useState(0); // Індекс обраного кольору (0 - перший колір за замовчуванням)
  // Користувач вибрав фігуру вручну (для розблокування останньої іконки в блоці 1)
  const [hasUserPickedShape, setHasUserPickedShape] = useState(false);
  const [thickness, setThickness] = useState(1.6); // товщина (мм) для блоку 3
  const [isBorderActive, setIsBorderActive] = useState(false);

  const DEFAULT_BORDER_THICKNESS_PX = 2;
  const BORDER_STROKE_COLOR = "#000000";
  const CUSTOM_BORDER_CANVAS_COLOR = "#000000";
  const CUSTOM_BORDER_EXPORT_COLOR = "#008181";
  const borderStateRef = useRef({
    mode: "default",
    thicknessPx: DEFAULT_BORDER_THICKNESS_PX,
    customThicknessPx: mmToPx(1.6),
    defaultThicknessPx: DEFAULT_BORDER_THICKNESS_PX,
  });

  const findBorderObject = useCallback(
    (mode) => {
      if (!canvas || !canvas.getObjects) return null;
      const objects = canvas.getObjects();
      if (!Array.isArray(objects)) return null;
      if (!mode) {
        return objects.find((obj) => obj.isBorderShape) || null;
      }
      return (
        objects.find(
          (obj) => obj.isBorderShape && obj.cardBorderMode === mode
        ) || null
      );
    },
    [canvas]
  );

  const getBorderColor = useCallback(
    (mode = "default") =>
      mode === "custom" ? CUSTOM_BORDER_CANVAS_COLOR : BORDER_STROKE_COLOR,
    []
  );

  const removeCanvasOutline = useCallback(() => {
    if (!canvas || !canvas.getObjects) return;
    const outline = canvas.getObjects().find((obj) => obj.isCanvasOutline);
    if (outline) {
      canvas.remove(outline);
    }
  }, [canvas]);

  const deriveClipMetrics = useCallback(
    (clip) => {
      const fallbackWidth = canvas?.getWidth?.() || 0;
      const fallbackHeight = canvas?.getHeight?.() || 0;

      if (!clip) {
        return {
          width: fallbackWidth,
          height: fallbackHeight,
          centerX: fallbackWidth / 2,
          centerY: fallbackHeight / 2,
        };
      }

      let bounds = null;
      try {
        bounds = clip.getBoundingRect?.(true, true) || null;
      } catch {
        bounds = null;
      }

      const scaledWidth =
        (typeof clip.getScaledWidth === "function"
          ? clip.getScaledWidth()
          : clip.width) ??
        bounds?.width ??
        fallbackWidth;
      const scaledHeight =
        (typeof clip.getScaledHeight === "function"
          ? clip.getScaledHeight()
          : clip.height) ??
        bounds?.height ??
        fallbackHeight;

      const centerPoint =
        typeof clip.getCenterPoint === "function"
          ? clip.getCenterPoint()
          : null;

      const centerX =
        centerPoint?.x ??
        (bounds
          ? bounds.left + (bounds.width || 0) / 2
          : (clip.left ?? 0) + scaledWidth / 2);
      const centerY =
        centerPoint?.y ??
        (bounds
          ? bounds.top + (bounds.height || 0) / 2
          : (clip.top ?? 0) + scaledHeight / 2);

      return {
        width: scaledWidth,
        height: scaledHeight,
        centerX,
        centerY,
      };
    },
    [canvas]
  );

  // Undo/Redo + трекер змін властивостей полотна
  const { saveCanvasPropertiesState } = useUndoRedo();
  const {
    trackCanvasResize,
    trackViewportChange,
    trackShapeChange,
    trackElementAdded,
    trackColorThemeChange,
    trackThicknessChange,
    trackHolesChange,
    trackBorderChange,
    immediateSave,
    debouncedSave,
  } = useCanvasPropertiesTracker(
    canvas,
    globalColors,
    saveCanvasPropertiesState,
    {
      currentShapeType,
      cornerRadius: sizeValues ? sizeValues.cornerRadius : 0,
      thickness,
      activeHolesType,
      holesDiameter,
    }
  );

  const createBorderFromClipPath = useCallback(
    (thicknessPx, color, mode, options = {}) => {
      const { makeMask = false } = options || {};
      if (!canvas) return null;
      const clip = canvas.clipPath;
      const effectiveStroke = Math.max(0, thicknessPx);
      const metrics = deriveClipMetrics(clip);
      const baseWidth = metrics?.width || 0;
      const baseHeight = metrics?.height || 0;
      const centerX = metrics?.centerX || 0;
      const centerY = metrics?.centerY || 0;
      const strokeForBorder = makeMask ? 0 : effectiveStroke * 2;
      if (!clip) {
        const fallback = new fabric.Rect({
          left: centerX,
          top: centerY,
          width: baseWidth,
          height: baseHeight,
          originX: "center",
          originY: "center",
          absolutePositioned: true,
          fill: makeMask ? "#000000" : "transparent",
          stroke: makeMask ? null : color,
          strokeWidth: strokeForBorder,
          strokeUniform: !makeMask,
          selectable: false,
          evented: false,
          excludeFromExport: false,
          isBorderShape: !makeMask,
          cardBorderMode: makeMask ? undefined : mode,
          cardBorderThicknessPx: makeMask ? undefined : thicknessPx,
          objectCaching: false,
        });
        if (makeMask) {
          fallback.set({ excludeFromExport: true, isBorderMask: true });
        }
        return fallback;
      }

      const hasTransformMatrix = Array.isArray(clip.transformMatrix);
      const baseOpts = {
        left: centerX,
        top: centerY,
        originX: "center",
        originY: "center",
        flipX: !!clip.flipX,
        flipY: !!clip.flipY,
        absolutePositioned: clip.absolutePositioned !== false,
        fill: makeMask ? "#ffffff" : "transparent",
        stroke: makeMask ? null : color,
        strokeWidth: strokeForBorder,
        strokeUniform: !makeMask,
        selectable: false,
        evented: false,
        excludeFromExport: false,
        isBorderShape: !makeMask,
        cardBorderMode: makeMask ? undefined : mode,
        cardBorderThicknessPx: makeMask ? undefined : thicknessPx,
        objectCaching: false,
        perPixelTargetFind: false,
        hoverCursor: "default",
      };

      if (hasTransformMatrix) {
        baseOpts.transformMatrix = [...clip.transformMatrix];
      } else {
        baseOpts.angle = clip.angle ?? 0;
        baseOpts.scaleX = clip.scaleX ?? 1;
        baseOpts.scaleY = clip.scaleY ?? 1;
        baseOpts.skewX = clip.skewX ?? 0;
        baseOpts.skewY = clip.skewY ?? 0;
      }

      const clonePathData = (path) =>
        Array.isArray(path)
          ? path.map((segment) =>
              Array.isArray(segment) ? segment.map((v) => v) : segment
            )
          : path;

      let borderShape = null;
      switch (clip.type) {
        case "rect": {
          borderShape = new fabric.Rect({
            ...baseOpts,
            width: baseWidth,
            height: baseHeight,
            rx: clip.rx ?? 0,
            ry: clip.ry ?? 0,
          });
          break;
        }
        case "circle": {
          borderShape = new fabric.Circle({
            ...baseOpts,
            radius:
              clip.radius ??
              Math.min(canvas.getWidth?.() || 0, canvas.getHeight?.() || 0) / 2,
          });
          break;
        }
        case "ellipse": {
          borderShape = new fabric.Ellipse({
            ...baseOpts,
            rx: clip.rx ?? baseWidth / 2,
            ry: clip.ry ?? baseHeight / 2,
          });
          break;
        }
        case "polygon": {
          const points = Array.isArray(clip.points)
            ? clip.points.map((p) => ({ x: p.x, y: p.y }))
            : [];
          if (points.length > 0) {
            borderShape = new fabric.Polygon(points, baseOpts);
          }
          break;
        }
        case "path": {
          const pathData = clonePathData(clip.path);
          if (pathData && pathData.length) {
            borderShape = new fabric.Path(pathData, baseOpts);
            if (clip.pathOffset) {
              borderShape.pathOffset = new fabric.Point(
                clip.pathOffset.x ?? 0,
                clip.pathOffset.y ?? 0
              );
            }
          }
          break;
        }
        default: {
          const bbox = clip.getBoundingRect?.(true, true);
          borderShape = new fabric.Rect({
            ...baseOpts,
            width: bbox ? bbox.width : baseWidth,
            height: bbox ? bbox.height : baseHeight,
          });
          break;
        }
      }

      if (!borderShape) {
        const bbox = clip?.getBoundingRect?.(true, true);
        borderShape = new fabric.Rect({
          ...baseOpts,
          width: bbox ? bbox.width : baseWidth,
          height: bbox ? bbox.height : baseHeight,
        });
      }

      if (borderShape) {
        const currentScaleX = borderShape.scaleX ?? 1;
        const currentScaleY = borderShape.scaleY ?? 1;

        borderShape.set({
          strokeWidth: strokeForBorder,
          strokeUniform: true,
          scaleX: currentScaleX,
          scaleY: currentScaleY,
          originX: "center",
          originY: "center",
          left: centerX,
          top: centerY,
          absolutePositioned: true,
        });

        if (makeMask) {
          borderShape.set({
            isBorderShape: false,
            isBorderMask: true,
            excludeFromExport: true,
            stroke: null,
            fill: "#000000",
          });
        } else {
          const displayStrokeColor =
            color ||
            (mode === "custom"
              ? CUSTOM_BORDER_CANVAS_COLOR
              : BORDER_STROKE_COLOR);
          const exportStrokeColor =
            mode === "custom" ? CUSTOM_BORDER_EXPORT_COLOR : displayStrokeColor;
          const exportFill =
            mode === "custom" ? "none" : borderShape.fill ?? "transparent";

          borderShape.set({
            isBorderShape: true,
            cardBorderMode: mode,
            cardBorderThicknessPx: thicknessPx,
            id: mode === "custom" ? "canvaShapeCustom" : "canvaShape",
            isCustomBorder: mode === "custom",
            cardBorderDisplayStrokeColor: displayStrokeColor,
            cardBorderExportStrokeColor: exportStrokeColor,
            cardBorderExportFill: exportFill,
          });

          if (mode === "custom" && borderShape.fill !== "transparent") {
            borderShape.set({ fill: "transparent" });
          }
        }
      }

      return borderShape;
    },
    [canvas, deriveClipMetrics]
  );

  const replaceBorder = useCallback(
    (thicknessPx, color, mode) => {
      if (!canvas) return null;

      const borderShape = createBorderFromClipPath(thicknessPx, color, mode);
      if (!borderShape) return null;

      const maskClip = createBorderFromClipPath(thicknessPx, color, mode, {
        makeMask: true,
      });
      if (maskClip) {
        const maskCenterX =
          typeof borderShape.left === "number" ? borderShape.left : 0;
        const maskCenterY =
          typeof borderShape.top === "number" ? borderShape.top : 0;
        maskClip.set({
          absolutePositioned: true,
          originX: borderShape.originX ?? "center",
          originY: borderShape.originY ?? "center",
          left: maskCenterX,
          top: maskCenterY,
          angle: borderShape.angle ?? 0,
          scaleX: borderShape.scaleX ?? 1,
          scaleY: borderShape.scaleY ?? 1,
          skewX: borderShape.skewX ?? 0,
          skewY: borderShape.skewY ?? 0,
          flipX: !!borderShape.flipX,
          flipY: !!borderShape.flipY,
        });

        if (maskClip.type === "path" && maskClip.pathOffset) {
          maskClip.pathOffset = new fabric.Point(
            maskClip.pathOffset.x ?? 0,
            maskClip.pathOffset.y ?? 0
          );
        }

        if (Array.isArray(borderShape.transformMatrix)) {
          maskClip.transformMatrix = [...borderShape.transformMatrix];
        }

        maskClip.set({ strokeWidth: 0, stroke: null });

        borderShape.clipPath = maskClip;
      }

      const existing = findBorderObject(mode);
      if (existing) {
        canvas.remove(existing);
      }

      // Прибираємо можливі дублікати, якщо лишились
      canvas
        .getObjects()
        .filter(
          (obj) =>
            obj !== borderShape &&
            obj.isBorderShape &&
            (mode ? obj.cardBorderMode === mode : true)
        )
        .forEach((obj) => canvas.remove(obj));

      canvas.add(borderShape);
      if (typeof canvas.bringToFront === "function") {
        canvas.bringToFront(borderShape);
      } else if (typeof canvas.bringObjectToFront === "function") {
        canvas.bringObjectToFront(borderShape);
      } else if (typeof borderShape.bringToFront === "function") {
        borderShape.bringToFront();
      }
      let hasCustomAfterUpdate = mode === "custom";
      if (!hasCustomAfterUpdate) {
        const customBorder = findBorderObject("custom");
        if (customBorder) {
          hasCustomAfterUpdate = true;
          if (typeof canvas.bringToFront === "function") {
            canvas.bringToFront(customBorder);
          } else if (typeof canvas.bringObjectToFront === "function") {
            canvas.bringObjectToFront(customBorder);
          } else if (typeof customBorder.bringToFront === "function") {
            customBorder.bringToFront();
          }
        }
      }
      borderShape.setCoords();
      if (mode === "custom") {
        borderStateRef.current = {
          ...borderStateRef.current,
          mode: "custom",
          thicknessPx,
          customThicknessPx: thicknessPx,
        };
      } else {
        borderStateRef.current = {
          ...borderStateRef.current,
          defaultThicknessPx: thicknessPx,
        };
        if (!hasCustomAfterUpdate) {
          borderStateRef.current.mode = "default";
          borderStateRef.current.thicknessPx = thicknessPx;
        }
      }
      removeCanvasOutline();
      trackBorderChange?.(hasCustomAfterUpdate);
      canvas.requestRenderAll();
      setIsBorderActive(hasCustomAfterUpdate);
      return borderShape;
    },
    [
      canvas,
      createBorderFromClipPath,
      findBorderObject,
      removeCanvasOutline,
      setIsBorderActive,
      trackBorderChange,
    ]
  );

  const ensureBorderPresence = useCallback(
    (opts = {}) => {
      if (!canvas) return null;
      const clip = canvas.clipPath;
      const { forceRebuild = false } = opts;

      if (!clip && !findBorderObject("default")) {
        return replaceBorder(
          DEFAULT_BORDER_THICKNESS_PX,
          getBorderColor("default"),
          "default"
        );
      }

      const fallbackExisting = findBorderObject();
      const resolvedMode =
        opts.mode ||
        fallbackExisting?.cardBorderMode ||
        borderStateRef.current.mode ||
        "default";
      const existing =
        resolvedMode === "custom"
          ? findBorderObject("custom")
          : findBorderObject("default");

      const desiredCustomPx =
        borderStateRef.current.customThicknessPx ?? mmToPx(thickness);
      const desiredDefaultPx =
        borderStateRef.current.defaultThicknessPx ??
        DEFAULT_BORDER_THICKNESS_PX;

      const resolvedThicknessPx =
        opts.thicknessPx !== undefined
          ? opts.thicknessPx
          : existing?.cardBorderThicknessPx !== undefined
          ? existing.cardBorderThicknessPx
          : resolvedMode === "custom"
          ? desiredCustomPx
          : desiredDefaultPx;

      const resolvedColor =
        opts.color ||
        existing?.stroke ||
        getBorderColor(resolvedMode) ||
        "#000000";

      if (
        existing &&
        !forceRebuild &&
        existing.cardBorderThicknessPx === resolvedThicknessPx &&
        (existing.stroke || "#000000") === resolvedColor &&
        existing.cardBorderMode === resolvedMode
      ) {
        if (resolvedMode === "custom") {
          existing.cardBorderExportStrokeColor = CUSTOM_BORDER_EXPORT_COLOR;
          existing.cardBorderDisplayStrokeColor = getBorderColor("custom");
          existing.cardBorderExportFill = "none";
          if (existing.fill !== "transparent") {
            existing.set({ fill: "transparent" });
          }
        } else {
          const displayStroke =
            resolvedColor || existing.stroke || BORDER_STROKE_COLOR;
          existing.cardBorderExportStrokeColor =
            existing.cardBorderExportStrokeColor || displayStroke;
          existing.cardBorderDisplayStrokeColor =
            existing.cardBorderDisplayStrokeColor || displayStroke;
          if (!existing.cardBorderExportFill) {
            existing.cardBorderExportFill = existing.fill ?? "transparent";
          }
        }

        if (resolvedMode === "custom") {
          borderStateRef.current = {
            ...borderStateRef.current,
            mode: "custom",
            thicknessPx: resolvedThicknessPx,
            customThicknessPx: resolvedThicknessPx,
          };
          setIsBorderActive(true);
        } else {
          const customBorderExists = !!findBorderObject("custom");
          borderStateRef.current = {
            ...borderStateRef.current,
            defaultThicknessPx: resolvedThicknessPx,
          };
          if (!customBorderExists) {
            borderStateRef.current.mode = "default";
            borderStateRef.current.thicknessPx = resolvedThicknessPx;
          }
          setIsBorderActive(customBorderExists);
        }
        return existing;
      }

      return replaceBorder(resolvedThicknessPx, resolvedColor, resolvedMode);
    },
    [
      canvas,
      findBorderObject,
      getBorderColor,
      replaceBorder,
      setIsBorderActive,
      mmToPx,
      thickness,
    ]
  );

  useEffect(() => {
    if (typeof setCanvasShapeType === "function") {
      setCanvasShapeType(currentShapeType || "rectangle");
    }
  }, [currentShapeType, setCanvasShapeType]);
  const toolbarStateRef = useRef(null);
  const prevToolbarStateSerializedRef = useRef("");

  const cloneToolbarState = useCallback((state) => {
    if (!state) return null;
    return {
      ...state,
      sizeValues: { ...(state.sizeValues || {}) },
      globalColors: { ...(state.globalColors || {}) },
    };
  }, []);

  const buildToolbarState = useCallback(() => {
    const borderObjects =
      canvas?.getObjects?.()?.filter((obj) => obj?.isBorderShape) || [];
    const hasBorder =
      borderStateRef.current.mode === "custom" ||
      borderObjects.some((obj) => obj.cardBorderMode === "custom");
    const safeSize = sizeValues || {};
    const safeColors = globalColors || {};

    return {
      currentShapeType: currentShapeType || "rectangle",
      sizeValues: {
        width: safeSize.width !== undefined ? Number(safeSize.width) || 0 : 0,
        height:
          safeSize.height !== undefined ? Number(safeSize.height) || 0 : 0,
        cornerRadius:
          safeSize.cornerRadius !== undefined
            ? Number(safeSize.cornerRadius) || 0
            : 0,
      },
      thickness: Number(thickness) || 0,
      hasBorder,
      globalColors: { ...safeColors },
      selectedColorIndex,
      isAdhesiveTape: !!isAdhesiveTape,
      activeHolesType,
      holesDiameter: Number(holesDiameter) || 0,
      isHolesSelected: !!isHolesSelected,
      isCustomShapeMode: !!isCustomShapeMode,
      isCustomShapeApplied: !!isCustomShapeApplied,
      hasUserPickedShape: !!hasUserPickedShape,
      copiesCount: Number(copiesCount) || 1,
    };
  }, [
    canvas,
    sizeValues,
    globalColors,
    currentShapeType,
    thickness,
    selectedColorIndex,
    isAdhesiveTape,
    activeHolesType,
    holesDiameter,
    isHolesSelected,
    isCustomShapeMode,
    isCustomShapeApplied,
    hasUserPickedShape,
    copiesCount,
  ]);

  const applyToolbarState = useCallback(
    (incoming) => {
      if (!incoming || typeof incoming !== "object") return;

      // ВИПРАВЛЕННЯ: Спочатку перевіряємо, чи є shapeType на canvas
      // Якщо є і він відрізняється від incoming, використовуємо canvas shapeType
      const canvasShapeType = canvas?.get?.("shapeType");
      const incomingShapeType = incoming.currentShapeType;

      if (incomingShapeType) {
        // Якщо є canvas shapeType і він збігається з incoming, або якщо canvas shapeType відсутній
        if (!canvasShapeType || canvasShapeType === incomingShapeType) {
          setCurrentShapeType(incomingShapeType);
          console.log(
            "Applied shapeType from toolbar state:",
            incomingShapeType
          );
        } else {
          // Canvas має інший shapeType - використовуємо його
          setCurrentShapeType(canvasShapeType);
          console.log(
            "Preserved canvas shapeType over toolbar state:",
            canvasShapeType,
            "vs",
            incomingShapeType
          );
        }
      } else if (canvasShapeType) {
        // Якщо incoming не має shapeType, але canvas має - використовуємо canvas
        setCurrentShapeType(canvasShapeType);
        console.log("Used canvas shapeType (no incoming):", canvasShapeType);
      }

      if (incoming.sizeValues) {
        setSizeValues((prev) => ({
          width:
            incoming.sizeValues.width !== undefined
              ? Number(incoming.sizeValues.width) || prev.width
              : prev.width,
          height:
            incoming.sizeValues.height !== undefined
              ? Number(incoming.sizeValues.height) || prev.height
              : prev.height,
          cornerRadius:
            incoming.sizeValues.cornerRadius !== undefined
              ? Number(incoming.sizeValues.cornerRadius) || prev.cornerRadius
              : prev.cornerRadius,
        }));
      }

      if (incoming.cornerRadius !== undefined && !incoming.sizeValues) {
        const parsedCorner = Number(incoming.cornerRadius);
        if (Number.isFinite(parsedCorner)) {
          setSizeValues((prev) => ({ ...prev, cornerRadius: parsedCorner }));
        }
      }

      if (incoming.thickness !== undefined) {
        setThickness((prev) => {
          const parsed = Number(incoming.thickness);
          return Number.isFinite(parsed) ? parsed : prev;
        });
        const parsed = Number(incoming.thickness);
        if (Number.isFinite(parsed)) {
          const customPx = mmToPx(parsed);
          borderStateRef.current = {
            ...borderStateRef.current,
            customThicknessPx: customPx,
          };
          if (borderStateRef.current.mode === "custom") {
            ensureBorderPresence({
              mode: "custom",
              thicknessPx: customPx,
              forceRebuild: true,
            });
          }
        }
      }

      if (incoming.globalColors) {
        // Уникаємо передчасного перезапису фону: loadDesign сам синхронізує фон та globalColors
        const { backgroundColor, backgroundType, ...otherColors } =
          incoming.globalColors;

        if (Object.keys(otherColors).length > 0) {
          updateGlobalColors({ ...otherColors });
        }

        console.log("Deferred background sync to load pipeline", {
          incomingBg: backgroundColor,
          incomingBgType: backgroundType,
          preservedBg:
            canvas?.backgroundColor || canvas?.get?.("backgroundColor"),
          preservedBgType: canvas?.get?.("backgroundType"),
        });
      }

      if (incoming.selectedColorIndex !== undefined) {
        setSelectedColorIndex((prev) => {
          const parsed = Number(incoming.selectedColorIndex);
          return Number.isFinite(parsed) ? parsed : prev;
        });
      }

      if (incoming.isAdhesiveTape !== undefined) {
        setIsAdhesiveTape(!!incoming.isAdhesiveTape);
      }

      if (incoming.activeHolesType !== undefined) {
        setActiveHolesType((prev) => {
          const parsed = Number(incoming.activeHolesType);
          return Number.isFinite(parsed) ? parsed : prev;
        });
      }

      if (incoming.holesDiameter !== undefined) {
        setHolesDiameter((prev) => {
          const parsed = Number(incoming.holesDiameter);
          return Number.isFinite(parsed) ? parsed : prev;
        });
      }

      if (incoming.isHolesSelected !== undefined) {
        setIsHolesSelected(!!incoming.isHolesSelected);
      }

      if (incoming.isCustomShapeApplied !== undefined) {
        setIsCustomShapeApplied(!!incoming.isCustomShapeApplied);
      }

      if (incoming.hasUserPickedShape !== undefined) {
        setHasUserPickedShape(!!incoming.hasUserPickedShape);
      }

      if (incoming.copiesCount !== undefined) {
        setCopiesCount((prev) => {
          const parsed = Number(incoming.copiesCount);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : prev;
        });
      }

      if (incoming.isCustomShapeMode !== undefined) {
        setIsCustomShapeMode(!!incoming.isCustomShapeMode);
      }

      if (incoming.hasBorder !== undefined) {
        const enableCustom = !!incoming.hasBorder;
        const parsedThickness = Number(incoming.thickness);
        const thicknessMm = Number.isFinite(parsedThickness)
          ? parsedThickness
          : thickness;
        const customPx =
          borderStateRef.current.customThicknessPx ?? mmToPx(thicknessMm);
        borderStateRef.current = {
          ...borderStateRef.current,
          mode: enableCustom ? "custom" : "default",
          thicknessPx: enableCustom ? customPx : DEFAULT_BORDER_THICKNESS_PX,
          customThicknessPx: enableCustom
            ? customPx
            : borderStateRef.current.customThicknessPx ?? customPx,
        };
        setIsBorderActive(enableCustom);
        if (enableCustom) {
          ensureBorderPresence({
            mode: "default",
            thicknessPx:
              borderStateRef.current.defaultThicknessPx ??
              DEFAULT_BORDER_THICKNESS_PX,
            color: getBorderColor("default"),
          });
          ensureBorderPresence({
            mode: "custom",
            thicknessPx: borderStateRef.current.customThicknessPx ?? customPx,
            color: getBorderColor("custom"),
            forceRebuild: true,
          });
        } else {
          const customBorders =
            canvas
              ?.getObjects?.()
              ?.filter(
                (obj) => obj.isBorderShape && obj.cardBorderMode === "custom"
              ) || [];
          if (customBorders.length) {
            customBorders.forEach((borderShape) => canvas.remove(borderShape));
          }
          ensureBorderPresence({
            mode: "default",
            thicknessPx:
              borderStateRef.current.defaultThicknessPx ??
              DEFAULT_BORDER_THICKNESS_PX,
            color: getBorderColor("default"),
            forceRebuild: true,
          });
          canvas?.requestRenderAll?.();
        }
      }
    },
    [
      canvas,
      setCurrentShapeType,
      setSizeValues,
      setThickness,
      updateGlobalColors,
      setSelectedColorIndex,
      setIsAdhesiveTape,
      setActiveHolesType,
      setHolesDiameter,
      setIsHolesSelected,
      setIsCustomShapeApplied,
      setHasUserPickedShape,
      setCopiesCount,
      setIsCustomShapeMode,
      ensureBorderPresence,
      setIsBorderActive,
    ]
  );

  const getToolbarState = useCallback(() => {
    const current = toolbarStateRef.current || buildToolbarState();
    return cloneToolbarState(current);
  }, [buildToolbarState, cloneToolbarState]);

  useEffect(() => {
    const snapshot = buildToolbarState();
    toolbarStateRef.current = snapshot;

    const serialized = JSON.stringify(snapshot);
    if (serialized !== prevToolbarStateSerializedRef.current) {
      prevToolbarStateSerializedRef.current = serialized;
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(
            new CustomEvent("toolbar:changed", {
              detail: cloneToolbarState(snapshot),
            })
          );
        } catch (error) {
          console.warn("Failed to dispatch toolbar:changed", error);
        }
      }
    }
  }, [buildToolbarState, cloneToolbarState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mmToPxLocal = (mmValue) =>
      Math.round((Number(mmValue) || 0) * PX_PER_MM);
    const pxToMmLocal = (pxValue) => (Number(pxValue) || 0) / PX_PER_MM;

    const recreateBorder = (incoming = {}) => {
      const enableCustom = !!incoming.hasBorder;
      const fallbackPx =
        borderStateRef.current.customThicknessPx ?? mmToPxLocal(thickness);
      const restoredThicknessMm = Number(incoming.thickness);
      const customThicknessPx = enableCustom
        ? mmToPxLocal(
            Number.isFinite(restoredThicknessMm)
              ? restoredThicknessMm
              : pxToMmLocal(fallbackPx)
          )
        : DEFAULT_BORDER_THICKNESS_PX;

      if (enableCustom) {
        setThickness(
          Number.isFinite(restoredThicknessMm)
            ? restoredThicknessMm
            : pxToMmLocal(customThicknessPx)
        );
        borderStateRef.current = {
          ...borderStateRef.current,
          mode: "custom",
          thicknessPx: customThicknessPx,
          customThicknessPx,
        };
        ensureBorderPresence({
          mode: "default",
          thicknessPx:
            borderStateRef.current.defaultThicknessPx ??
            DEFAULT_BORDER_THICKNESS_PX,
          color: getBorderColor("default"),
        });
        ensureBorderPresence({
          mode: "custom",
          thicknessPx: customThicknessPx,
          color: getBorderColor("custom"),
          forceRebuild: true,
        });
        setIsBorderActive(true);
        trackBorderChange?.(true);
      } else {
        const customBorders =
          canvas
            ?.getObjects?.()
            ?.filter(
              (obj) => obj.isBorderShape && obj.cardBorderMode === "custom"
            ) || [];
        customBorders.forEach((borderShape) => canvas.remove(borderShape));
        borderStateRef.current = {
          ...borderStateRef.current,
          mode: "default",
          thicknessPx: DEFAULT_BORDER_THICKNESS_PX,
          defaultThicknessPx: DEFAULT_BORDER_THICKNESS_PX,
        };
        setIsBorderActive(false);
        ensureBorderPresence({
          mode: "default",
          thicknessPx: DEFAULT_BORDER_THICKNESS_PX,
          color: getBorderColor("default"),
          forceRebuild: true,
        });
        trackBorderChange?.(false);
        canvas?.requestRenderAll?.();
      }
    };

    window.getCurrentToolbarState = getToolbarState;
    window.restoreToolbarState = applyToolbarState;
    window.recreateBorder = recreateBorder;

    return () => {
      if (window.getCurrentToolbarState === getToolbarState) {
        delete window.getCurrentToolbarState;
      }
      if (window.restoreToolbarState === applyToolbarState) {
        delete window.restoreToolbarState;
      }
      if (window.recreateBorder === recreateBorder) {
        delete window.recreateBorder;
      }
    };
  }, [
    canvas,
    applyToolbarState,
    ensureBorderPresence,
    getBorderColor,
    getToolbarState,
    thickness,
  ]);

  // НОВИЙ: Окремий useEffect для forceRestoreCanvasShape (після updateSize)
  useEffect(() => {
    const forceRestoreCanvasShape = (toolbarState) => {
      if (!canvas || !toolbarState) return;

      const shapeType = toolbarState.currentShapeType || "rectangle";
      const widthMm = toolbarState.sizeValues?.width || DEFAULT_SHAPE_WIDTH_MM;
      const heightMm =
        toolbarState.sizeValues?.height || DEFAULT_SHAPE_HEIGHT_MM;
      const cornerRadiusMm = toolbarState.sizeValues?.cornerRadius || 0;

      console.log("Force restoring canvas shape:", {
        shapeType,
        widthMm,
        heightMm,
        cornerRadiusMm,
      });

      // Встановлюємо shapeType на canvas
      canvas.set("shapeType", shapeType);
      setCurrentShapeType(shapeType);

      // Встановлюємо розміри
      setSizeValues({
        width: widthMm,
        height: heightMm,
        cornerRadius: cornerRadiusMm,
      });

      // Викликаємо updateSize для перебудови clipPath
      setTimeout(() => {
        if (updateSize) {
          updateSize({
            widthMm: widthMm,
            heightMm: heightMm,
            cornerRadiusMm: cornerRadiusMm,
          });
          canvas.requestRenderAll();
        }
      }, 50);
    };

    window.forceRestoreCanvasShape = forceRestoreCanvasShape;

    // Додатково: API для синхронізації інпутів тулбара з фактичними значеннями canvas
    const syncToolbarSizeFromCanvas = () => {
      try {
        if (!canvas) return;
        const pxToMmLocal = (px) => Number(((Number(px) || 0) * 25.4) / 72);
        const wPx =
          typeof canvas.getWidth === "function"
            ? canvas.getWidth()
            : canvas.width || 0;
        const hPx =
          typeof canvas.getHeight === "function"
            ? canvas.getHeight()
            : canvas.height || 0;
        const crMm = Number(canvas.get?.("cornerRadius")) || 0;
        const wMm = Math.round(pxToMmLocal(wPx) * 10) / 10;
        const hMm = Math.round(pxToMmLocal(hPx) * 10) / 10;
        // Не змінюємо форму, лише відображаємо актуальні розміри/радіус у UI
        setSizeValues((prev) => ({
          ...prev,
          width: wMm,
          height: hMm,
          cornerRadius: crMm,
        }));
      } catch (e) {
        console.warn("syncToolbarSizeFromCanvas failed", e);
      }
    };

    window.syncToolbarSizeFromCanvas = syncToolbarSizeFromCanvas;

    return () => {
      if (window.forceRestoreCanvasShape === forceRestoreCanvasShape) {
        delete window.forceRestoreCanvasShape;
      }
      if (window.syncToolbarSizeFromCanvas === syncToolbarSizeFromCanvas) {
        delete window.syncToolbarSizeFromCanvas;
      }
    };
  }, [canvas, setCurrentShapeType, setSizeValues]);

  useEffect(() => {
    ensureBorderPresence({ mode: "default" });
    if (
      borderStateRef.current.mode === "custom" ||
      findBorderObject("custom")
    ) {
      ensureBorderPresence({
        mode: "custom",
        thicknessPx:
          borderStateRef.current.customThicknessPx ?? mmToPx(thickness),
      });
    }
  }, [ensureBorderPresence, findBorderObject, mmToPx, thickness]);

  useEffect(() => {
    if (!canvas || typeof canvas.on !== "function") {
      setIsBorderActive(false);
      return undefined;
    }

    const syncBorderState = () => {
      const customBorder = findBorderObject("custom");
      const isCustomMode =
        borderStateRef.current.mode === "custom" || !!customBorder;
      setIsBorderActive(isCustomMode);
    };

    syncBorderState();
    canvas.on("object:added", syncBorderState);
    canvas.on("object:removed", syncBorderState);

    return () => {
      canvas.off?.("object:added", syncBorderState);
      canvas.off?.("object:removed", syncBorderState);
    };
  }, [canvas, findBorderObject]);

  // Очистити canvas з збереженням фону
  const clearCanvasPreserveTheme = () => {
    if (!canvas) return;
    const bg =
      canvas.backgroundColor ||
      canvas.get("backgroundColor") ||
      globalColors?.backgroundColor ||
      "#FFFFFF";
    canvas.clear();
    canvas.set("backgroundColor", bg);
    canvas.requestRenderAll();
    // ВАЖЛИВО: Не скидаємо режим/товщину бордера при зміні базової фігури
    // (щоб створення нової фігури відразу підхопило останній вибір користувача)
    // Реконструкція відбудеться після встановлення нового clipPath через ensureBorderPresence().
  };
  // Режим кастомної фігури (редагування вершин) — тепер у контексті
  // --- Custom Shape (нова реалізація) ---
  // --- Handle-based custom corner rounding ---
  const cornerHandlesRef = useRef([]); // fabric.Circle corner handles (orange, can move corner)
  const dragStateRef = useRef({}); // { index, cornerStart:{x,y}, handleStart:{x,y} }
  const outsideCustomListenerRef = useRef(null); // handler for outside click
  const baseCornersRef = useRef([]); // mutable corner points [{x,y}]
  const originalClipRef = useRef(null); // original clipPath for cancel
  const [overlayHandles, setOverlayHandles] = useState([]); // DOM overlay handles
  const overlayHandlesRafRef = useRef(null); // pending requestAnimationFrame id for handle positioning
  useEffect(
    () => () => {
      if (overlayHandlesRafRef.current !== null) {
        cancelAnimationFrame(overlayHandlesRafRef.current);
        overlayHandlesRafRef.current = null;
      }
    },
    []
  );
  // Set default selected shape on mount
  // useEffect(() => {
  //   setCurrentShapeType("rectangle");
  //   if (canvas) {
  //     addRectangle();
  //   }
  // }, [canvas]);

  // Corner radius вимикаємо для кола та простих стрілок (left/right)
  const isCircleSelected =
    currentShapeType === "circle" ||
    currentShapeType === "oval" ||
    currentShapeType === "ellipse" ||
    currentShapeType === "circleWithLine" ||
    currentShapeType === "circleWithCross" ||
    currentShapeType === "leftArrow" ||
    currentShapeType === "rightArrow";
  const addQrCode = () => {
    setIsQrOpen(true);
  };

  const addBarCode = () => {
    setIsBarCodeOpen(true);
  };

  const addShape = () => {
    setIsShapeOpen(true);
  };

  // Обгортка для кліків по фігурах: виклик функції та фіксація вибору користувача
  const withShapePick = (fn) => () => {
    fn();
    setHasUserPickedShape(true);
    // При виборі нової фігури — виходимо з режиму кастомної фігури
    if (isCustomShapeMode) exitCustomShapeMode();
    // Нова фігура => скидаємо прапорець кастомного застосування
    setIsCustomShapeApplied(false);
  };

  // Custom shape теперь дозволений для всіх типів
  const blockedCustomTypes = new Set([
    "circle",
    "ellipse", // disable custom for oval
    "halfCircle",
    "extendedHalfCircle",
    "circleWithLine",
    "circleWithCross",
  ]);

  // Extract corner points of current clipPath for ANY base shape.
  const extractBaseCorners = () => {
    if (!canvas || !canvas.clipPath) return [];
    const cp = canvas.clipPath;
    // Polygon: просто копируем
    if (cp.type === "polygon" && Array.isArray(cp.points)) {
      return cp.points.map((p) => ({ x: p.x, y: p.y }));
    }
    // Rect
    if (cp.type === "rect") {
      const w = (cp.width || 0) * (cp.scaleX || 1);
      const h = (cp.height || 0) * (cp.scaleY || 1);
      return [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];
    }
    // Circle / Ellipse -> аппроксимация регулярным многоугольником (больше точек = плавнее)
    if (cp.type === "circle" || cp.type === "ellipse") {
      const rx = (cp.rx || cp.radius || 0) * (cp.scaleX || 1);
      const ry = (cp.ry || cp.radius || 0) * (cp.scaleY || 1);
      const cx = (cp.left || 0) + rx;
      const cy = (cp.top || 0) + ry;
      const steps = 24; // достаточно для редактирования
      const pts = [];
      for (let i = 0; i < steps; i++) {
        const a = (2 * Math.PI * i) / steps;
        pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
      }
      // нормализация
      const minX = Math.min(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      return pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
    }
    // Path (стрілки, адаптивні трикутники, інші складні фігури)
    if (cp.type === "path" && cp.path) {
      // Берём конечные точки сегментов. cp.path — массив команд fabric: ['M',x,y], ['L',x,y], ['C',...x,y], ['Q',...x,y], etc.
      const raw = cp.path;
      const points = [];
      let lastX = null,
        lastY = null;
      raw.forEach((seg) => {
        const cmd = seg[0];
        // последние координаты сегмента — конец
        let x = null,
          y = null;
        switch (cmd) {
          case "M":
          case "L":
          case "T":
            x = seg[1];
            y = seg[2];
            break;
          case "H": // горизонтальная линия
            x = seg[1];
            y = lastY;
            break;
          case "V":
            x = lastX;
            y = seg[1];
            break;
          case "C": // кубическая Безье: ... , x,y в конце
            x = seg[5];
            y = seg[6];
            break;
          case "S":
            x = seg[3];
            y = seg[4];
            break;
          case "Q":
            x = seg[3];
            y = seg[4];
            break;
          case "Z":
          case "z":
            // ignore explicit close
            return;
          default:
            return;
        }
        if (x == null || y == null) return;
        lastX = x;
        lastY = y;
        // фильтр близких точек
        const prev = points[points.length - 1];
        if (!prev || Math.hypot(prev.x - x, prev.y - y) > 0.5) {
          points.push({ x, y });
        }
      });
      if (points.length < 3) return [];
      // нормализация
      const minX = Math.min(...points.map((p) => p.x));
      const minY = Math.min(...points.map((p) => p.y));
      return points.map((p) => ({ x: p.x - minX, y: p.y - minY }));
    }
    // Fallback — используем текущие габариты canvas
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    return [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
  };

  const clearCornerHandles = () => {
    if (!canvas) return;
    cornerHandlesRef.current.forEach((h) => canvas.remove(h));
    cornerHandlesRef.current = [];
  };

  // Base (non-rounded) points for supported polygonal shapes
  const getBaseShapePoints = (type, w, h) => {
    switch (type) {
      case "rectangle":
        return [
          { x: 0, y: 0 },
          { x: Math.max(0, w - 1), y: 0 },
          { x: Math.max(0, w - 1), y: Math.max(0, h - 1) },
          { x: 0, y: Math.max(0, h - 1) },
        ];
      case "triangle":
        return [
          { x: w / 2, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ];
      case "hexagon":
        return [
          { x: w * 0.25, y: 0 },
          { x: w * 0.75, y: 0 },
          { x: w, y: h * 0.5 },
          { x: w * 0.75, y: h },
          { x: w * 0.25, y: h },
          { x: 0, y: h * 0.5 },
        ];
      case "octagon":
        return [
          { x: w * 0.3, y: 0 },
          { x: w * 0.7, y: 0 },
          { x: w, y: h * 0.3 },
          { x: w, y: h * 0.7 },
          { x: w * 0.7, y: h },
          { x: w * 0.3, y: h },
          { x: 0, y: h * 0.7 },
          { x: 0, y: h * 0.3 },
        ];
      case "arrowLeft":
        return [
          { x: 0, y: h * 0.5625 },
          { x: w * 0.25, y: h * 0.1875 },
          { x: w * 0.25, y: h * 0.375 },
          { x: w, y: h * 0.375 },
          { x: w, y: h * 0.75 },
          { x: w * 0.25, y: h * 0.75 },
          { x: w * 0.25, y: h * 0.9375 },
        ];
      case "arrowRight":
        return [
          { x: w, y: h * 0.5625 },
          { x: w * 0.75, y: h * 0.1875 },
          { x: w * 0.75, y: h * 0.375 },
          { x: 0, y: h * 0.375 },
          { x: 0, y: h * 0.75 },
          { x: w * 0.75, y: h * 0.75 },
          { x: w * 0.75, y: h * 0.9375 },
        ];
      case "flag":
        return [
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
      case "diamond":
        return [
          { x: w * 0.5, y: 0 },
          { x: w, y: h * 0.5 },
          { x: w * 0.5, y: h },
          { x: 0, y: h * 0.5 },
        ];
      default:
        return null;
    }
  };

  // Rebuild clipPath as polygon from current corner points (без скруглень)
  const rebuildPolygonClip = () => {
    if (!canvas) return;
    const pts = baseCornersRef.current;
    if (!pts || pts.length < 3) return;
    const poly = new fabric.Polygon(
      pts.map((p) => ({ x: p.x, y: p.y })),
      {
        left: 0,
        top: 0,
        absolutePositioned: true,
      }
    );
    canvas.clipPath = poly;
    updateCanvasOutline();
    updateExistingBorders();
    canvas.requestRenderAll();
  };

  // Точний алгоритм округлення (використовує дуги з центром на перетині внутрішніх бісекторів)
  const roundPolygonWithRadius = (points, rPx) => {
    if (!rPx || rPx <= 0) return points.map((p) => ({ ...p }));
    const n = points.length;
    if (n < 3) return points.map((p) => ({ ...p }));
    const out = [];
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const cur = points[i];
      const next = points[(i + 1) % n];
      const vPrev = { x: prev.x - cur.x, y: prev.y - cur.y };
      const vNext = { x: next.x - cur.x, y: next.y - cur.y };
      let lenPrev = Math.hypot(vPrev.x, vPrev.y);
      let lenNext = Math.hypot(vNext.x, vNext.y);
      if (lenPrev < 1e-6 || lenNext < 1e-6) {
        out.push({ ...cur });
        continue;
      }
      const uPrev = { x: vPrev.x / lenPrev, y: vPrev.y / lenPrev };
      const uNext = { x: vNext.x / lenNext, y: vNext.y / lenNext };
      let dot = uPrev.x * uNext.x + uPrev.y * uNext.y;
      dot = Math.max(-1, Math.min(1, dot));
      const angle = Math.acos(dot); // внутрішній кут
      const rMax = Math.min(lenPrev, lenNext) * Math.tan(angle / 2);
      const rUse = Math.min(rPx, rMax * 0.999);
      const distAlong = rUse / Math.tan(angle / 2);
      const p1 = {
        x: cur.x + uPrev.x * distAlong,
        y: cur.y + uPrev.y * distAlong,
      };
      const p2 = {
        x: cur.x + uNext.x * distAlong,
        y: cur.y + uNext.y * distAlong,
      };
      const bis = { x: uPrev.x + uNext.x, y: uPrev.y + uNext.y };
      const bisLen = Math.hypot(bis.x, bis.y) || 1;
      const bisUnit = { x: bis.x / bisLen, y: bis.y / bisLen };
      const centerDist = rUse / Math.sin(angle / 2);
      const center = {
        x: cur.x + bisUnit.x * centerDist,
        y: cur.y + bisUnit.y * centerDist,
      };
      const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
      let a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
      let da = a2 - a1;
      while (da <= 0) da += 2 * Math.PI;
      const arcLen = rUse * da;
      const segments = Math.max(4, Math.min(32, Math.round(arcLen / 6)));
      out.push(p1);
      for (let s = 1; s < segments; s++) {
        const t = s / segments;
        const ang = a1 + da * t;
        out.push({
          x: center.x + Math.cos(ang) * rUse,
          y: center.y + Math.sin(ang) * rUse,
        });
      }
      out.push(p2);
    }
    return out;
  };

  const applyCornerRadiusToCurrentPolygon = (cornerRadiusMm) => {
    if (!canvas) return;
    if (isCustomShapeApplied) return; // Заборонено змінювати після кастому
    const pts = baseCornersRef.current;
    if (!pts || pts.length < 3) return;
    const rPx = mmToPx(cornerRadiusMm || 0);
    const rounded = roundPolygonWithRadius(pts, rPx);
    canvas.clipPath = new fabric.Polygon(rounded, {
      left: 0,
      top: 0,
      absolutePositioned: true,
    });
    updateCanvasOutline();
    updateExistingBorders({ cornerRadiusMm });
    canvas.requestRenderAll();
  };

  // --- Геометрические утилиты для валидации полигона ---
  const orientation = (a, b, c) => {
    const v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
    if (Math.abs(v) < 1e-9) return 0;
    return v > 0 ? 1 : 2; // 1 = cw, 2 = ccw
  };
  const onSegment = (a, b, c) =>
    Math.min(a.x, c.x) - 1e-9 <= b.x &&
    b.x <= Math.max(a.x, c.x) + 1e-9 &&
    Math.min(a.y, c.y) - 1e-9 <= b.y &&
    b.y <= Math.max(a.y, c.y) + 1e-9;
  const segmentsIntersect = (p1, p2, p3, p4) => {
    // Общие конечные точки считаем допустимыми (смежные рёбра)
    if (
      (p1.x === p3.x && p1.y === p3.y) ||
      (p1.x === p4.x && p1.y === p4.y) ||
      (p2.x === p3.x && p2.y === p3.y) ||
      (p2.x === p4.x && p2.y === p4.y)
    )
      return false;
    const o1 = orientation(p1, p2, p3);
    const o2 = orientation(p1, p2, p4);
    const o3 = orientation(p3, p4, p1);
    const o4 = orientation(p3, p4, p2);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p3, p2)) return true;
    if (o2 === 0 && onSegment(p1, p4, p2)) return true;
    if (o3 === 0 && onSegment(p3, p1, p4)) return true;
    if (o4 === 0 && onSegment(p3, p2, p4)) return true;
    return false;
  };
  const polygonSelfIntersects = (pts) => {
    const m = pts.length;
    if (m < 4) return false; // треугольник не может самопересекаться
    for (let i = 0; i < m; i++) {
      const a1 = pts[i];
      const a2 = pts[(i + 1) % m];
      for (let j = i + 1; j < m; j++) {
        // пропускаем соседние и совпадающие ребра
        if (Math.abs(i - j) <= 1) continue;
        if (i === 0 && j === m - 1) continue; // первое и последнее смежны
        const b1 = pts[j];
        const b2 = pts[(j + 1) % m];
        if (segmentsIntersect(a1, a2, b1, b2)) return true;
      }
    }
    return false;
  };
  const internalAngle = (pts, idx) => {
    const n = pts.length;
    const prev = pts[(idx - 1 + n) % n];
    const cur = pts[idx];
    const next = pts[(idx + 1) % n];
    const v1 = { x: prev.x - cur.x, y: prev.y - cur.y };
    const v2 = { x: next.x - cur.x, y: next.y - cur.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1;
    const l2 = Math.hypot(v2.x, v2.y) || 1;
    let dot = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2);
    dot = Math.max(-1, Math.min(1, dot));
    return Math.acos(dot); // 0..pi
  };

  // Нормализация: переносим минимум в (0,0), меняем размеры canvas и sizeValues
  const normalizeAndResizeCanvas = () => {
    if (!canvas) return;
    const pts = baseCornersRef.current;
    if (!pts.length) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    pts.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    const widthPx = Math.max(1, maxX - minX);
    const heightPx = Math.max(1, maxY - minY);
    if (minX !== 0 || minY !== 0) {
      for (let i = 0; i < pts.length; i++) {
        pts[i] = { x: pts[i].x - minX, y: pts[i].y - minY };
      }
    }
    baseCornersRef.current = [...pts];
    canvas.setWidth(widthPx);
    canvas.setHeight(heightPx);
    setSizeValues((prev) => ({
      ...prev,
      width: round1(pxToMm(widthPx)),
      height: round1(pxToMm(heightPx)),
    }));
    rebuildPolygonClip();
  };

  const computeHandlePositions = () => {
    if (!canvas) return;
    const pts = baseCornersRef.current;
    const upperCanvas = canvas.upperCanvasEl;
    if (!pts.length || !upperCanvas) {
      setOverlayHandles([]);
      return;
    }
    const rect = upperCanvas.getBoundingClientRect();
    const figW = canvas.getWidth();
    const figH = canvas.getHeight();
    if (!figW || !figH || !rect.width || !rect.height) {
      setOverlayHandles([]);
      return;
    }
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    // Фактичний масштаб у viewport (враховує fabric zoom + можливий CSS transform контейнера)
    const scaleX = rect.width / figW;
    const scaleY = rect.height / figH;
    const uniformScale = (scaleX + scaleY) / 2; // усереднюємо для діаметра
    const minSide = Math.max(1, Math.min(figW, figH));
    const dynamicRadius = Math.max(1.5, Math.min(4, minSide * 0.012));
    const n = pts.length;
    const newHandles = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const hx = p.x;
      const hy = p.y;
      newHandles.push({
        index: i,
        corner: { x: p.x, y: p.y },
        handle: { x: hx, y: hy },
        screenX: scrollX + rect.left + hx * scaleX,
        screenY: scrollY + rect.top + hy * scaleY,
        size: dynamicRadius * 2 * uniformScale,
      });
    }
    setOverlayHandles(newHandles);
  };

  const positionHandles = ({ immediate = false } = {}) => {
    if (!canvas) return;
    if (overlayHandlesRafRef.current !== null) {
      cancelAnimationFrame(overlayHandlesRafRef.current);
      overlayHandlesRafRef.current = null;
    }
    if (immediate) {
      computeHandlePositions();
      return;
    }
    overlayHandlesRafRef.current = window.requestAnimationFrame(() => {
      overlayHandlesRafRef.current = null;
      computeHandlePositions();
    });
  };

  const startDomDrag = (e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvas) return;
    const pts = baseCornersRef.current;
    const cornerStart = { ...pts[idx] };
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    // Використовуємо фактичний масштаб viewport (як у positionHandles)
    const scaleX = rect.width / canvas.getWidth();
    const scaleY = rect.height / canvas.getHeight();
    dragStateRef.current = {
      index: idx,
      cornerStart,
      pointerStart: {
        x: (e.clientX - rect.left) / scaleX,
        y: (e.clientY - rect.top) / scaleY,
      },
      scaleX,
      scaleY,
    };
    document.addEventListener("mousemove", onDomDragMove, true);
    document.addEventListener("mouseup", onDomDragEnd, true);
  };

  const onDomDragMove = (e) => {
    const st = dragStateRef.current;
    if (!st || st.index === undefined) return;
    if (!canvas) return;
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    // Якщо під час drag змінився масштаб (zoom) – перерахуємо scale на льоту
    let scaleX = st.scaleX;
    let scaleY = st.scaleY;
    const currentScaleX = rect.width / canvas.getWidth();
    const currentScaleY = rect.height / canvas.getHeight();
    if (
      Math.abs(currentScaleX - scaleX) > 1e-3 ||
      Math.abs(currentScaleY - scaleY) > 1e-3
    ) {
      // оновити scale й скоригувати стартову точку, щоб не було скачка
      const factorX = currentScaleX / scaleX;
      const factorY = currentScaleY / scaleY;
      st.pointerStart.x *= factorX;
      st.pointerStart.y *= factorY;
      scaleX = st.scaleX = currentScaleX;
      scaleY = st.scaleY = currentScaleY;
    }
    const pointerX = (e.clientX - rect.left) / scaleX;
    const pointerY = (e.clientY - rect.top) / scaleY;
    const dx = pointerX - st.pointerStart.x;
    const dy = pointerY - st.pointerStart.y;
    const i = st.index;
    const MIN_ANGLE = (5 * Math.PI) / 180;
    const snapshot = [...baseCornersRef.current];
    const prevValid = snapshot[i];
    let candidate = { x: st.cornerStart.x + dx, y: st.cornerStart.y + dy };
    snapshot[i] = candidate;
    let angleOk = internalAngle(snapshot, i) >= MIN_ANGLE;
    let noIntersect = !polygonSelfIntersects(snapshot);
    if (!angleOk || !noIntersect) {
      let lo = 0,
        hi = 1,
        best = prevValid;
      for (let iter = 0; iter < 25; iter++) {
        const mid = (lo + hi) / 2;
        const test = {
          x: st.cornerStart.x + (candidate.x - st.cornerStart.x) * mid,
          y: st.cornerStart.y + (candidate.y - st.cornerStart.y) * mid,
        };
        snapshot[i] = test;
        if (
          internalAngle(snapshot, i) >= MIN_ANGLE &&
          !polygonSelfIntersects(snapshot)
        ) {
          best = test;
          lo = mid;
        } else hi = mid;
      }
      candidate = best;
    }
    baseCornersRef.current[i] = candidate;
    rebuildPolygonClip();
    canvas.requestRenderAll();
    positionHandles({ immediate: true });
  };

  const onDomDragEnd = () => {
    if (!dragStateRef.current.index && dragStateRef.current.index !== 0) return;
    dragStateRef.current = {};
    normalizeAndResizeCanvas();
    positionHandles();
    document.removeEventListener("mousemove", onDomDragMove, true);
    document.removeEventListener("mouseup", onDomDragEnd, true);
  };

  const enterCustomShapeMode = () => {
    if (!canvas) return;
    if (isCustomShapeMode) return;
    // Blocked types (e.g., ellipse/oval, circles, extended half-circles)
    if (blockedCustomTypes.has(currentShapeType)) return;
    let corners = [];
    // Якщо застосовано cornerRadius та clip ще не кастом – беремо базову (неокруглену) форму
    if (
      sizeValues.cornerRadius > 0 &&
      canvas.clipPath &&
      !canvas.clipPath.isCustomEdited
    ) {
      const wPx = mmToPx(sizeValues.width);
      const hPx = mmToPx(sizeValues.height);
      const basePts = getBaseShapePoints(currentShapeType, wPx, hPx);
      if (basePts && basePts.length >= 3) {
        corners = basePts;
        // Оновлюємо UI значення cornerRadius на 0, щоб відобразити відсутність округлення у кастомі
        setSizeValues((prev) => ({ ...prev, cornerRadius: 0 }));
        // Зберігаємо оригінальний clip для можливого відновлення (Cancel)
        originalClipRef.current = canvas.clipPath;
        // Перемикаємо clipPath на неокруглений полігон
        canvas.clipPath = new fabric.Polygon(
          basePts.map((p) => ({ ...p })),
          {
            left: 0,
            top: 0,
            absolutePositioned: true,
          }
        );
        updateCanvasOutline();
      } else {
        // Fallback: екстракція з поточного clipPath
        corners = extractBaseCorners();
        if (corners.length < 3) return;
        originalClipRef.current = canvas.clipPath;
      }
    } else {
      // Стандартний шлях: беремо кути з поточної форми
      corners = extractBaseCorners();
      if (corners.length < 3) return;
      originalClipRef.current = canvas.clipPath;
    }
    baseCornersRef.current = corners;
    clearCornerHandles();
    rebuildPolygonClip();
    positionHandles();
    setIsCustomShapeMode(true);
    setIsCustomShapeApplied(true);
    canvas.discardActiveObject();
  };

  const exitCustomShapeMode = (restore = false) => {
    if (!canvas) return;
    if (!isCustomShapeMode) return;
    if (restore && originalClipRef.current) {
      canvas.clipPath = originalClipRef.current;
    }
    // Перед очищенням — позначаємо clipPath як кастомно відредагований, зберігаємо базові точки
    if (!restore && canvas.clipPath && baseCornersRef.current.length >= 3) {
      canvas.clipPath.isCustomEdited = true;
      canvas.clipPath.__baseCustomCorners = baseCornersRef.current.map((p) => ({
        ...p,
      }));
    }
    clearCornerHandles();
    baseCornersRef.current = [];
    originalClipRef.current = null;
    setIsCustomShapeMode(false);
    // Вихід – фігура вже кастомна, залишаємо true (не скидаємо)
    setOverlayHandles([]);
    if (overlayHandlesRafRef.current !== null) {
      cancelAnimationFrame(overlayHandlesRafRef.current);
      overlayHandlesRafRef.current = null;
    }
    updateCanvasOutline();
    canvas.requestRenderAll();
    if (outsideCustomListenerRef.current) {
      document.removeEventListener(
        "mousedown",
        outsideCustomListenerRef.current,
        true
      );
      outsideCustomListenerRef.current = null;
    }
  };

  // Перепозиціонування та масштабування DOM-хендлів при zoom / resize / рендерах canvas
  useEffect(() => {
    if (!isCustomShapeMode || !canvas) return;
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        // ймовірно змінюємо zoom — оновити на наступний кадр
        positionHandles();
      }
    };
    const handleResize = () => positionHandles();
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    const afterRender = () => {
      // Під час drag або змін – оновлення позицій
      if (isCustomShapeMode) positionHandles();
    };
    canvas.on("after:render", afterRender);
    // Початковий виклик (на випадок якщо zoom вже не 1)
    positionHandles();
    return () => {
      window.removeEventListener("resize", handleResize, { passive: true });
      window.removeEventListener("wheel", handleWheel, { passive: true });
      canvas.off("after:render", afterRender);
    };
  }, [isCustomShapeMode, canvas]);

  const toggleCustomShapeMode = () => {
    if (isCustomShapeMode) {
      exitCustomShapeMode();
    } else {
      // Перед входом в кастом — жёстко сбрасываем скругление до 0
      // (как просили: «спочатку в інпуті змінюй значення на 0, вони застосуються на фігуру»)
      if (
        canvas &&
        canvas.clipPath &&
        !canvas.clipPath.isCustomEdited &&
        (Number(sizeValues.cornerRadius) || 0) > 0
      ) {
        // Используем общую логику, чтобы и UI, и clipPath, и бордеры обновились синхронно
        handleInputChange("cornerRadius", 50, 0);
      }
      // Теперь включаем кастом-шейп — corners будут взяты уже от неокругленной фигуры
      enterCustomShapeMode();
    }
  };

  // Глобальний helper: логічний розмір canvas (без масштабу)
  const getLogicalCanvasSize = () => {
    if (!canvas) return { width: 0, height: 0 };
    const zoom = typeof canvas.getZoom === "function" ? canvas.getZoom() : 1;
    return {
      width: Math.round(canvas.getWidth() / (zoom || 1)),
      height: Math.round(canvas.getHeight() / (zoom || 1)),
    };
  };

  // (Видалено mouse:down: заважав drag якорів)
  useEffect(() => {
    if (!canvas) return;
    // Хелпер: санація контролів об'єкта, щоб виключити падіння у drawControls при першому кліку
    const sanitizeObjectControls = (obj) => {
      if (!obj) return;
      try {
        const baseControls =
          (fabric &&
            fabric.Object &&
            fabric.Object.prototype &&
            fabric.Object.prototype.controls) ||
          {};
        // Відновлюємо контролли якщо відсутні/порожні
        if (!obj.controls || Object.keys(obj.controls).length === 0) {
          obj.controls = Object.entries(baseControls).reduce((acc, [k, v]) => {
            if (v) acc[k] = v;
            return acc;
          }, {});
        } else {
          // Прибираємо невалідні
          Object.keys(obj.controls).forEach((k) => {
            if (!obj.controls[k]) delete obj.controls[k];
          });
        }
        // Перевіряємо кожен контроль
        Object.keys(obj.controls || {}).forEach((k) => {
          const ctrl = obj.controls[k];
          const base = baseControls[k];
          if (
            !ctrl ||
            typeof ctrl.positionHandler !== "function" ||
            typeof ctrl.render !== "function"
          ) {
            if (base) obj.controls[k] = base;
            else delete obj.controls[k];
          }
        });
        // Безпечна обгортка positionHandler: завжди повертаємо {x,y}
        Object.keys(obj.controls || {}).forEach((k) => {
          const ctrl = obj.controls[k];
          if (!ctrl) return;
          if (
            !ctrl.__safeWrapped &&
            typeof ctrl.positionHandler === "function"
          ) {
            const original = ctrl.positionHandler;
            ctrl.positionHandler = function (...args) {
              try {
                const p = original.apply(this, args);
                if (p && typeof p.x === "number" && typeof p.y === "number")
                  return p;
              } catch {}
              const center =
                typeof obj.getCenterPoint === "function"
                  ? obj.getCenterPoint()
                  : { x: obj.left || 0, y: obj.top || 0 };
              return { x: center.x, y: center.y };
            };
            ctrl.__safeWrapped = true;
          }
        });
        if (typeof obj.cornerSize !== "number" || !isFinite(obj.cornerSize))
          obj.cornerSize = 13;
        if (typeof obj.setCoords === "function") obj.setCoords();
      } catch {}
    };
    // init canvas listeners
    canvas.on("selection:created", () => {
      const obj = canvas.getActiveObject();
      // Санітуємо контролли активного об'єкта для виключення падіння при першому кліку
      sanitizeObjectControls(obj);
      if (obj && (obj.name === "vertex" || obj.name === "cornerHandle")) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }
      setActiveObject(obj);
    });
    canvas.on("selection:updated", () => {
      const obj = canvas.getActiveObject();
      sanitizeObjectControls(obj);
      if (obj && (obj.name === "vertex" || obj.name === "cornerHandle")) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }
      setActiveObject(obj);
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
      // Не підлаштовуємо поля розмірів під модифікації випадкових об'єктів
    });

    // Ініціалізуємо початкові значення розмірів canvas
    const sz = getLogicalCanvasSize();
    setSizeValues({
      width: Number(pxToMm(sz.width).toFixed(1)),
      height: Number(pxToMm(sz.height).toFixed(1)),
      cornerRadius: 0,
    });
    // Блокуємо відкриття пропертей по dblclick на якорі
    const onDblClick = (opt) => {
      const t = opt?.target;
      if (t && (t.name === "vertex" || t.name === "cornerHandle")) {
        if (isShapePropertiesOpen) setIsShapePropertiesOpen(false);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    };
    canvas.on("mouse:dblclick", onDblClick);
    return () => {
      if (canvas) {
        canvas.off("mouse:dblclick");
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

  // Генерує точки для полігону з округленими кутами (для використання з fabric.Polygon)
  const roundPolygonCorners = (points, radius, segments = 8) => {
    if (!points || points.length < 3) return points;
    if (radius <= 0) return points;

    const n = points.length;
    const result = [];

    // Полігональна орієнтація
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      area += a.x * b.y - b.x * a.y;
    }
    const ccw = area > 0;

    const rMaxGlobal = clampRadiusForEdges(points, radius);
    if (rMaxGlobal <= 0) return points;

    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];

      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;

      const len1 = Math.hypot(v1x, v1y) || 1;
      const len2 = Math.hypot(v2x, v2y) || 1;
      const u1x = v1x / len1;
      const u1y = v1y / len1;
      const u2x = v2x / len2;
      const u2y = v2y / len2;

      const cross = u1x * u2y - u1y * u2x;
      const isConvex = ccw ? cross > 0 : cross < 0;

      const rLocal = Math.max(
        0,
        Math.min(rMaxGlobal, len1 / 2 - 0.001, len2 / 2 - 0.001)
      );

      if (!isConvex || rLocal <= 0) {
        result.push({ x: curr.x, y: curr.y });
        continue;
      }

      const p1x = curr.x - u1x * rLocal;
      const p1y = curr.y - u1y * rLocal;
      const p2x = curr.x + u2x * rLocal;
      const p2y = curr.y + u2y * rLocal;

      // Додаємо точку перед округленням
      result.push({ x: p1x, y: p1y });

      // Апроксимуємо quadratic bezier curve точками
      for (let j = 1; j <= segments; j++) {
        const t = j / (segments + 1);
        const mt = 1 - t;
        const x = mt * mt * p1x + 2 * mt * t * curr.x + t * t * p2x;
        const y = mt * mt * p1y + 2 * mt * t * curr.y + t * t * p2y;
        result.push({ x, y });
      }

      // Додаємо точку після округлення
      result.push({ x: p2x, y: p2y });
    }

    return result;
  };

  const buildRoundedPolygonPath = (points, radius) => {
    if (!points || points.length < 3) return "";
    const n = points.length;

    // Полігональна орієнтація (shoelace) для розрізнення опуклих/вгнутих кутів
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      area += a.x * b.y - b.x * a.y;
    }
    const ccw = area > 0;

    const rMaxGlobal = clampRadiusForEdges(points, radius);

    // Якщо радіус 0 — повертаємо звичайний багатокутник
    if (rMaxGlobal <= 0) {
      let d0 = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < n; i++) d0 += ` L ${points[i].x} ${points[i].y}`;
      d0 += " Z";
      return d0;
    }

    let d = "";
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];

      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;

      const len1 = Math.hypot(v1x, v1y) || 1;
      const len2 = Math.hypot(v2x, v2y) || 1;
      const u1x = v1x / len1;
      const u1y = v1y / len1;
      const u2x = v2x / len2;
      const u2y = v2y / len2;

      const cross = u1x * u2y - u1y * u2x;
      const isConvex = ccw ? cross > 0 : cross < 0;

      const rLocal = Math.max(
        0,
        Math.min(rMaxGlobal, len1 / 2 - 0.001, len2 / 2 - 0.001)
      );

      if (!isConvex || rLocal <= 0) {
        if (i === 0) d += `M ${curr.x} ${curr.y}`;
        else d += ` L ${curr.x} ${curr.y}`;
        continue;
      }

      const p1x = curr.x - u1x * rLocal;
      const p1y = curr.y - u1y * rLocal;
      const p2x = curr.x + u2x * rLocal;
      const p2y = curr.y + u2y * rLocal;

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

  const centerPathToCanvas = (path, width, height) => {
    // Надёжное центрирование path по координатам фрейма [0..width, 0..height]
    // Игнорируем _calcDimensions, т.к. для скруглённых форм Bezier‑экстремумы
    // могут давать смещённый bbox и приводить к визуальному сдвигу.
    if (!path) return;
    try {
      path.set({
        originX: "center",
        originY: "center",
        left: width / 2,
        top: height / 2,
      });
      path.pathOffset = new fabric.Point(width / 2, height / 2);
    } catch {
      try {
        path.set({
          originX: "center",
          originY: "center",
          left: width / 2,
          top: height / 2,
        });
        path.pathOffset = new fabric.Point(width / 2, height / 2);
      } catch {}
    }
  };

  const makeRoundedArrowLeftPath = (w, h, r) => {
    const shaftTop = h * 0.25;
    const shaftBottom = h * 0.75;
    const neckX = w * 0.3;
    const pts = [
      { x: 0, y: h / 2 },
      { x: neckX, y: 0 },
      { x: neckX, y: shaftTop },
      { x: w, y: shaftTop },
      { x: w, y: shaftBottom },
      { x: neckX, y: shaftBottom },
      { x: neckX, y: h },
    ];
    return buildRoundedPolygonPath(pts, r);
  };

  const makeRoundedArrowRightPath = (w, h, r) => {
    const shaftTop = h * 0.25;
    const shaftBottom = h * 0.75;
    const neckX = w * 0.7;
    const pts = [
      { x: w, y: h / 2 },
      { x: neckX, y: 0 },
      { x: neckX, y: shaftTop },
      { x: 0, y: shaftTop },
      { x: 0, y: shaftBottom },
      { x: neckX, y: shaftBottom },
      { x: neckX, y: h },
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
    if (w <= 0 || h <= 0) return "";
    const R = w / 2; // radius of top semicircle
    const cpFactor = 0.45; // control point factor for Bezier approximation
    const cp = cpFactor * R;
    if (h <= R + 0.01) {
      // Pure half circle (flat base at y=R)
      // Two cubic Beziers approximation
      return `M0 ${R} C0 ${R - cp} ${cp} 0 ${R} 0 C${w - cp} 0 ${w} ${
        R - cp
      } ${w} ${R} Z`;
    }
    // Extended shape: rectangle extension below y=R down to y=h
    // Path order: start bottom-left -> up left side to base of arc -> arc -> down right side -> bottom line -> close
    return `M0 ${h} L0 ${R} C0 ${R - cp} ${cp} 0 ${R} 0 C${w - cp} 0 ${w} ${
      R - cp
    } ${w} ${R} L${w} ${h} Z`;
  };

  const makeHalfCirclePolygonPoints = (w, h, segments = 160) => {
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
    const Rbase = w * 0.5; // Радіус основи
    if (w <= 0 || h <= 0) return [];

    const pts = [];
    const cx = Rbase; // Центр по X
    const baseY = h;

    if (h <= Rbase) {
      // ---- КРУГОВИЙ СЕГМЕНТ ----
      const H = Math.max(0.5, h); // Ефективна висота сегмента
      const Rseg = H / 2 + (w * w) / (8 * H);
      const yChord = baseY; // Хорда на базовій лінії

      // Початкова точка (ліва частина основи)
      pts.push({ x: 0, y: baseY });

      // Точки дуги сегмента зліва направо
      for (let i = 0; i <= segments; i++) {
        const t = i / segments; // 0..1
        const angle = Math.PI - t * Math.PI; // PI -> 0 (зліва направо)
        const x = cx + Rseg * Math.cos(angle);
        const y = yChord - Rseg * Math.sin(angle);

        // Обмежуємо точки в межах сегмента
        if (x >= 0 && x <= w && y >= 0 && y <= baseY) {
          pts.push({ x, y });
        }
      }

      // Кінцева точка (права частина основи)
      pts.push({ x: w, y: baseY });
    } else {
      // ---- ПІВКОЛО + ВЕРТИКАЛЬНІ СТІНКИ ----
      const sideLen = h - Rbase;
      const yTop = baseY - sideLen; // Рівень стику стінок з півколом

      // Початок знизу зліва
      pts.push({ x: 0, y: baseY });

      // Ліва вертикальна стінка
      pts.push({ x: 0, y: yTop });

      // Точки півкола від лівого до правого краю
      for (let i = 0; i <= segments; i++) {
        const angle = Math.PI - (Math.PI * i) / segments; // PI -> 0
        const x = cx + Rbase * Math.cos(angle);
        const y = yTop - Rbase * Math.sin(angle);
        pts.push({ x, y });
      }

      // Права вертикальна стінка
      pts.push({ x: w, y: yTop });

      // Кінець знизу справа
      pts.push({ x: w, y: baseY });
    }

    return pts;
  };

  // Adaptive semicircle path based on enhanced HTML implementation
  function makeExtendedHalfCircleSmoothPath(w, h, crPx) {
    const Rbase = w * 0.5; // Радіус основи
    const cr = Math.max(0, Math.min(crPx || 0, h - 1)); // Обмежуємо радіус кутів
    const baseY = h;
    const cx = w * 0.5; // Центр по X
    const xL = 0;
    const xR = w;

    let path = "";

    if (h <= Rbase) {
      // Використовуємо точну логіку звичайного півкола: дуга кола радіуса Rbase з філе на основі
      path = `M ${xL + cr} ${baseY}`;
      if (cr > 0) path += ` A ${cr} ${cr} 0 0 1 ${xL} ${baseY - cr}`;
      else path += ` L ${xL} ${baseY}`;
      // верхня дуга ідеальної півокружності між (0,baseY) і (w,baseY)
      path += ` A ${Rbase} ${Rbase} 0 0 1 ${xR} ${baseY - cr}`;
      if (cr > 0) path += ` A ${cr} ${cr} 0 0 1 ${xR - cr} ${baseY}`;
      else path += ` L ${xR} ${baseY}`;
      path += ` L ${xL + cr} ${baseY} Z`;
    } else {
      // ---- ВИСОКИЙ ВАРІАНТ: ПІВКОЛО + ВЕРТИКАЛЬНІ СТІНКИ + ЗАОКРУГЛЕНА ОСНОВА ----
      const sideLen = h - Rbase;
      const yTop = baseY - sideLen; // рівень дотику вертикальних стінок з півколом
      const r = cr;
      const yJoin = baseY - r; // верх точки заокруглення на боковій стінці
      // Розширена логіка: починаємо "з'їдати" стінки трохи раніше (коли r покриває >=60% їх висоти)
      const eatsWalls = r >= sideLen * 0.6; // раніше було тільки коли r > sideLen

      // Початок (ліва нижня точка із урахуванням радіуса)
      path = `M ${xL + r} ${baseY}`;

      if (!eatsWalls) {
        // Звичайний випадок: радіус не доходить до верху стінки
        if (r > 0) path += ` A ${r} ${r} 0 0 1 ${xL} ${baseY - r}`;
        else path += ` L ${xL} ${baseY}`;
        // Ліва вертикальна
        path += ` L ${xL} ${yTop}`;
        // Верхня півкола (повна)
        path += ` A ${Rbase} ${Rbase} 0 0 1 ${xR} ${yTop}`;
        // Права вертикальна вниз до початку нижнього скруглення
        path += ` L ${xR} ${baseY - r}`;
        // Правий нижній кут
        if (r > 0) path += ` A ${r} ${r} 0 0 1 ${xR - r} ${baseY}`;
        else path += ` L ${xR} ${baseY}`;
        // Закриття основи
        path += ` L ${xL + r} ${baseY} Z`;
      } else {
        // Радіус більший за висоту вертикальних стінок: прибираємо стінки, робимо плавний перехід одразу в дугу
        // Точне обчислення точки дотику (перетину) між кутовим колом (r) та верхнім півколом (Rbase) – забезпечує C1 (тангенційну) без Q
        const C1x = r; // центр лівого кутового кола
        const C1y = baseY - r;
        const C2x = cx; // центр верхнього півкола
        const C2y = yTop; // ( = Rbase )
        const dx = C2x - C1x;
        const dy = C2y - C1y;
        const dist = Math.hypot(dx, dy);
        // Якщо кола не перетинаються (патологія) – fallback на попередню логіку вертикалі
        if (dist < 1e-6 || dist > r + Rbase || dist < Math.abs(Rbase - r)) {
          // деградація: поводимось як звичайний випадок
          if (r > 0) path += ` A ${r} ${r} 0 0 1 ${xL} ${baseY - r}`;
          else path += ` L ${xL} ${baseY}`;
          path += ` L ${xL} ${yTop}`;
          path += ` A ${Rbase} ${Rbase} 0 0 1 ${xR} ${yTop}`;
          path += ` L ${xR} ${baseY - r}`;
          if (r > 0) path += ` A ${r} ${r} 0 0 1 ${xR - r} ${baseY}`;
          else path += ` L ${xR} ${baseY}`;
          path += ` L ${xL + r} ${baseY} Z`;
        } else {
          // Замість жорсткого стику будуємо згладжений контур через дискретизацію і Catmull-Rom
          const pts = [];
          // Формула перетину двох кіл (для визначення кута переходу)
          const a = (r * r - Rbase * Rbase + dist * dist) / (2 * dist);
          const hLenSq = r * r - a * a;
          const hLen = hLenSq > 0 ? Math.sqrt(hLenSq) : 0;
          const x2 = C1x + (a * dx) / dist;
          const y2 = C1y + (a * dy) / dist;
          const rxp = -dy * (hLen / dist);
          const ryp = dx * (hLen / dist);
          let ixLeft = x2 + rxp;
          let iyLeft = y2 + ryp; // верхня точка лівого стику
          if (iyLeft > baseY - 0.01) iyLeft = baseY - 0.01;
          const ixRight = w - ixLeft;
          const iyRight = iyLeft;
          // Кути на лівому кутовому колі (центр C1) від нижньої точки (θ=π/2) до точки стику
          const angleLeftCorner = Math.atan2(iyLeft - C1y, ixLeft - C1x); // ~ між 0 і -π/2
          const startCornerAngle = Math.PI / 2;
          const cornerSteps = Math.max(
            8,
            Math.min(
              50,
              Math.round(((startCornerAngle - angleLeftCorner) * r) / 6)
            )
          ); // більше точок для плавності
          for (let i = 0; i <= cornerSteps; i++) {
            const t = i / cornerSteps;
            const ang =
              startCornerAngle + (angleLeftCorner - startCornerAngle) * t;
            pts.push({
              x: C1x + r * Math.cos(ang),
              y: C1y + r * Math.sin(ang),
            });
          }
          // Вгорі (укорочена частина півкола) – від лівої точки стику до правої
          const angleLeftTop = Math.acos((ixLeft - cx) / Rbase); // ∈ (0,π)
          const angleRightTop = Math.PI - angleLeftTop;
          const topSteps = Math.max(
            14,
            Math.min(
              100,
              Math.round(((angleLeftTop - angleRightTop) * Rbase) / 5)
            )
          );
          for (let i = 1; i <= topSteps; i++) {
            // починаємо з 1 щоб не дублювати ixLeft
            const t = i / topSteps;
            const ang = angleLeftTop - (angleLeftTop - angleRightTop) * t; // зменшуємо до правої
            pts.push({
              x: cx + Rbase * Math.cos(ang),
              y: yTop - Rbase * Math.sin(ang),
            });
          }
          // Правий кутовий сегмент (дзеркально) – від точки стику до нижньої правої точки
          const C3x = w - r;
          const C3y = baseY - r;
          const angleRightCorner = Math.atan2(iyRight - C3y, ixRight - C3x); // від'ємний
          const endCornerAngle = Math.PI / 2; // нижня точка (w-r, h)
          const cornerStepsR = cornerSteps;
          for (let i = 1; i <= cornerStepsR; i++) {
            // стартуємо з 1 щоб не дублювати ixRight
            const t = i / cornerStepsR;
            const ang =
              angleRightCorner + (endCornerAngle - angleRightCorner) * t;
            pts.push({
              x: C3x + r * Math.cos(ang),
              y: C3y + r * Math.sin(ang),
            });
          }
          // Тепер будуємо плавний відкритий Catmull-Rom та закриваємо по основі
          // Додаткове згладжування перед побудовою
          const smoothIters = 2;
          for (let si = 0; si < smoothIters; si++) {
            for (let i = 1; i < pts.length - 1; i++) {
              const a = pts[i - 1],
                b = pts[i],
                c = pts[i + 1];
              b.x = (a.x + 2 * b.x + c.x) / 4;
              b.y = (a.y + 2 * b.y + c.y) / 4;
            }
          }
          // Адаптивна напруга: чим більший r відносно sideLen, тим вища (до 0.9)
          const tStrength = (() => {
            if (sideLen <= 0) return 0.9;
            const k = Math.min(
              1,
              Math.max(0, (r - sideLen * 0.6) / (sideLen * 0.4))
            ); // 0 при 0.6, 1 при >=1.0
            // return 0.68 + 0.22 * k; // 0.68..0.9
            return 0.98;
          })();
          path = pointsToOpenCatmullRomCubicPath(pts, tStrength);
        }
      }
    }

    return path;
  }

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

  // Повертає { points, isFull } де points – або повна форма трикутника, або обрізаний полігон
  const getAdaptiveTriangleData = (width, height) => {
    // 3 vs 5 визначаємо відносно 190/165, щоб зона між 180/165 і 190/165 залишалась 5-кутною
    // (вона потрібна для переходу типу заокруглення при порозі 180/165)
    const refW = 190;
    const refH = 165;
    const refRatio = refW / refH; // ~1.1515 (190/165)
    const currentRatio = width / height;
    let triangleWidth, triangleHeight;
    if (currentRatio > refRatio) {
      const scale = width / refW;
      triangleWidth = width;
      triangleHeight = refH * scale;
    } else {
      const scale = height / refH;
      triangleWidth = refW * scale;
      triangleHeight = height;
    }
    const centerX = width / 2;
    const triangle = [
      { x: centerX, y: 0 },
      { x: centerX - triangleWidth / 2, y: triangleHeight },
      { x: centerX + triangleWidth / 2, y: triangleHeight },
    ];
    // Визначаємо 3 vs 5 кутів за співвідношенням ширина/висота відносно 190/165
    const ratioTol = 0.003; // невеликий допуск на округлення
    const isFull = currentRatio >= refRatio - ratioTol;
    console.log("[adaptiveTriangle] getAdaptiveTriangleData ratio:", {
      width,
      height,
      currentRatio,
      refRatio,
      isFull,
    });
    if (isFull) {
      return { points: triangle, isFull: true };
    }
    // 5-кутник: реальний кліпінг
    const clipped = clipPolygonWithRect(triangle, width, height);
    return { points: clipped, isFull: false };
  };

  const updateSize = (overrides = {}) => {
    // Use explicit override values when provided to avoid state lag
    const widthMm = overrides.widthMm ?? sizeValues.width;
    const heightMm = overrides.heightMm ?? sizeValues.height;
    const cornerRadiusMm = overrides.cornerRadiusMm ?? sizeValues.cornerRadius;
    const editedKey = overrides.__editedKey;
    const editedIsDecrease = !!overrides.__editedIsDecrease;

    // ВИПРАВЛЕННЯ: Зберігаємо поточний cornerRadius прямо на canvas (в міліметрах)
    if (canvas && typeof canvas.set === "function") {
      const normalizedCorner = Number.isFinite(Number(cornerRadiusMm))
        ? Number(cornerRadiusMm)
        : 0;
      canvas.set("cornerRadius", normalizedCorner);
    }

    const effectiveShapeType = canvas?.get?.("shapeType") || currentShapeType;

    // Якщо ми НЕ в custom режимі, але current clipPath позначено як customEdited — застосуємо лише округлення без перебудови оригінальної форми
    if (
      canvas &&
      canvas.clipPath &&
      canvas.clipPath.isCustomEdited &&
      overrides.cornerRadiusMm !== undefined &&
      !isCustomShapeMode
    ) {
      const basePts =
        canvas.clipPath.__baseCustomCorners ||
        (canvas.clipPath.type === "polygon"
          ? canvas.clipPath.points.map((p) => ({ x: p.x, y: p.y }))
          : []);
      if (basePts.length >= 3) {
        const rPx = mmToPx(cornerRadiusMm || 0);
        if (rPx <= 0) {
          canvas.clipPath = new fabric.Polygon(
            basePts.map((p) => ({ ...p })),
            {
              left: 0,
              top: 0,
              absolutePositioned: true,
              isCustomEdited: true,
              __baseCustomCorners: basePts.map((p) => ({ ...p })),
            }
          );
        } else {
          const rounded = [];
          const n = basePts.length;
          const segPerCorner = Math.max(
            4,
            Math.min(24, Math.round(Math.sqrt(rPx)))
          );
          for (let i = 0; i < n; i++) {
            const pPrev = basePts[(i - 1 + n) % n];
            const p = basePts[i];
            const pNext = basePts[(i + 1) % n];
            const v1 = { x: pPrev.x - p.x, y: pPrev.y - p.y };
            const v2 = { x: pNext.x - p.x, y: pNext.y - p.y };
            const len1 = Math.hypot(v1.x, v1.y) || 1;
            const len2 = Math.hypot(v2.x, v2.y) || 1;
            const n1 = { x: v1.x / len1, y: v1.y / len1 };
            const n2 = { x: v2.x / len2, y: v2.y / len2 };
            const dot = Math.max(-1, Math.min(1, n1.x * n2.x + n1.y * n2.y));
            const angle = Math.acos(dot);
            const offset = Math.min(
              rPx,
              (Math.min(len1, len2) * Math.sin(angle / 2)) /
                (1 + Math.sin(angle / 2))
            );
            const cutPoint1 = {
              x: p.x + -n1.x * offset,
              y: p.y + -n1.y * offset,
            };
            const cutPoint2 = {
              x: p.x + -n2.x * offset,
              y: p.y + -n2.y * offset,
            };
            rounded.push(cutPoint1);
            for (let s = 1; s < segPerCorner; s++) {
              const t = s / segPerCorner;
              const ang1 = Math.atan2(-n1.y, -n1.x);
              const ang2 = Math.atan2(-n2.y, -n2.x);
              let dAng = ang2 - ang1;
              while (dAng > Math.PI) dAng -= 2 * Math.PI;
              while (dAng < -Math.PI) dAng += 2 * Math.PI;
              const ang = ang1 + dAng * t;
              const radius = offset;
              const ax = p.x + Math.cos(ang) * radius;
              const ay = p.y + Math.sin(ang) * radius;
              rounded.push({ x: ax, y: ay });
            }
            rounded.push(cutPoint2);
          }
          canvas.clipPath = new fabric.Polygon(rounded, {
            left: 0,
            top: 0,
            absolutePositioned: true,
            isCustomEdited: true,
            __baseCustomCorners: basePts.map((p) => ({ ...p })),
          });
        }
        updateCanvasOutline();
        updateExistingBorders({ cornerRadiusMm });
        canvas.requestRenderAll();
        return; // early exit — не перебудовуємо форму стандартним шляхом
      }
    }

    // Пункт 2 (розмір) завжди змінює лише полотно/картку, ігноруючи активні об'єкти
    if (canvas && effectiveShapeType) {
      // Спеціальна обробка для адаптивного трикутника
      if (effectiveShapeType === "adaptiveTriangle") {
        const refW = mmToPx(190);
        const refH = mmToPx(165);
        const refRatio = refW / refH;
        const inputWidth = mmToPx(widthMm);
        const inputHeight = mmToPx(heightMm);
        const currentRatio = inputWidth / inputHeight;

        let finalWidth = inputWidth;
        let finalHeight = inputHeight;

        // Якщо співвідношення виходить за еталон (ширше за 190/165)
        if (currentRatio > refRatio) {
          if (editedKey === "height" && editedIsDecrease) {
            // НОВА ЛОГІКА: дозвіл зменшувати висоту — пропорційно зменшуємо ширину
            finalHeight = inputHeight;
            finalWidth = refRatio * finalHeight;
            setSizeValues((prev) => ({
              ...prev,
              width: Number(pxToMm(finalWidth).toFixed(1)),
              height: Number(pxToMm(finalHeight).toFixed(1)),
            }));
          } else {
            // СТАРА ЛОГІКА: при розширенні — автоматично збільшуємо висоту
            const scale = inputWidth / refW;
            finalHeight = refH * scale;
            setSizeValues((prev) => ({
              ...prev,
              height: Number(pxToMm(finalHeight).toFixed(1)),
            }));
          }
        }

        // Встановлюємо розміри canvas
        canvas.setDimensions({ width: finalWidth, height: finalHeight });

        // Створюємо clipPath з оновленими розмірами
        const triData = getAdaptiveTriangleData(finalWidth, finalHeight);
        console.log(
          "[adaptiveTriangle] updateSize: isFull=",
          triData.isFull,
          "points=",
          triData.points?.length
        );
        const rCorner = mmToPx(cornerRadiusMm || 0);
        if (triData.isFull) {
          // Повна фігура (3 кути): поводимось як звичайний трикутник — clipPath як path
          const d = makeRoundedTrianglePath(finalWidth, finalHeight, rCorner);
          canvas.clipPath = new fabric.Path(d, { absolutePositioned: true });
        } else {
          // Обрізаний варіант (5 кутів)
          let pts = triData.points;
          const currRatio = finalWidth / finalHeight;
          const roundThreshold = 180 / 165; // поріг стилю заокруглення
          const ratioTol = 0.003;
          // Вище або на порозі — трикутне заокруглення; нижче — 5-кутна логіка
          const roundAsTriangle = currRatio >= roundThreshold - ratioTol;
          if (rCorner > 0) {
            if (roundAsTriangle) {
              // Вище/на порозі — візуально як трикутник: будуємо округлений трикутник і кліпимо в прямокутник
              const d = makeRoundedTrianglePath(
                finalWidth,
                finalHeight,
                rCorner
              );
              try {
                const svgNS = "http://www.w3.org/2000/svg";
                const path = document.createElementNS(svgNS, "path");
                path.setAttribute("d", d);
                const total = path.getTotalLength();
                const target = Math.min(1400, Math.max(160, Math.round(total)));
                const triRoundedPts = [];
                for (let i = 0; i <= target; i++) {
                  const p = path.getPointAtLength((total * i) / target);
                  triRoundedPts.push({ x: p.x, y: p.y });
                }
                pts = clipPolygonWithRect(
                  triRoundedPts,
                  finalWidth,
                  finalHeight
                );
              } catch (e) {
                // fallback до 5-кутної логіки
                const seg = Math.max(8, Math.min(24, Math.round(rCorner / 2)));
                const weights = getAdaptivePentagonCornerWeights(
                  pts,
                  finalWidth,
                  finalHeight,
                  cornerRadiusMm
                );
                pts = sampleRoundedPolygonPerCornerFlexible(
                  pts,
                  rCorner,
                  seg,
                  weights
                );
              }
            } else {
              // Нижче порогу — існуюча логіка 5-кутника
              const seg = Math.max(8, Math.min(24, Math.round(rCorner / 2)));
              const weights = getAdaptivePentagonCornerWeights(
                pts,
                finalWidth,
                finalHeight,
                cornerRadiusMm
              );
              pts = sampleRoundedPolygonPerCornerFlexible(
                pts,
                rCorner,
                seg,
                weights
              );
            }
          }
          canvas.clipPath = new fabric.Polygon(pts, {
            absolutePositioned: true,
          });
        }

        // Оновлюємо контур
        updateCanvasOutline();

        ensureBorderPresence({
          mode: "default",
          forceRebuild: true,
        });
        if (
          borderStateRef.current.mode === "custom" ||
          findBorderObject("custom")
        ) {
          ensureBorderPresence({
            mode: "custom",
            thicknessPx:
              borderStateRef.current.customThicknessPx ?? mmToPx(thickness),
            forceRebuild: true,
          });
        }

        // Перерахунок і перевстановлення дирок після зміни розміру + лог відступу
        recomputeHolesAfterResize();

        canvas.renderAll();
        return;
      }

      // Для всіх інших типів фігур - стандартна логіка
      // Спершу можлива корекція пропорцій для специфічних типів
      let effWidthMm = widthMm;
      let effHeightMm = heightMm;

      if (effectiveShapeType === "halfCircle") {
        // Зберігаємо справжній півкруг: ширина = 2 * висота (height = width/2)
        // Визначаємо, яку величину змінював користувач (прийшла в overrides)
        const changedWidth = Object.prototype.hasOwnProperty.call(
          overrides,
          "widthMm"
        );
        const changedHeight = Object.prototype.hasOwnProperty.call(
          overrides,
          "heightMm"
        );
        if (changedWidth && !changedHeight) {
          effHeightMm = round1(effWidthMm / 2);
        } else if (changedHeight && !changedWidth) {
          effWidthMm = round1(effHeightMm * 2);
        } else {
          // Обидва або жодного — пріоритет ширина
          effHeightMm = round1(effWidthMm / 2);
        }
        // Оновлюємо state (щоб інпут висоти відобразив скориговане значення)
        setSizeValues((prev) => ({
          ...prev,
          width: effWidthMm,
          height: effHeightMm,
        }));
      } else if (effectiveShapeType === "roundTop") {
        // roundTop: пропорція верхнього півкола повинна зберігатися — воно ідеально кругле (діаметр = ширина фігури)
        // Вихідний базовий path: ширина 100, висота 100 (верхній півкруг радіуса 50 + прямі стінки вниз)
        // Щоб зберегти півкруг, половина верхньої висоти повинна дорівнювати радіусу = width/2.
        // Тут приймаємо рішення фіксувати повну висоту = ширина (щоб верхній сегмент масштабувався рівно).
        const changedWidth = Object.prototype.hasOwnProperty.call(
          overrides,
          "widthMm"
        );
        const changedHeight = Object.prototype.hasOwnProperty.call(
          overrides,
          "heightMm"
        );
        if (changedWidth && !changedHeight) {
          effHeightMm = effWidthMm; // висота підлаштовується під ширину
        } else if (changedHeight && !changedWidth) {
          effWidthMm = effHeightMm; // ширина підлаштовується під висоту
        } else {
          effHeightMm = effWidthMm;
        }
        setSizeValues((prev) => ({
          ...prev,
          width: effWidthMm,
          height: effHeightMm,
        }));
      }

      const width = mmToPx(effWidthMm);
      const height = mmToPx(effHeightMm);
      const cr = Math.max(0, Number(mmToPx(cornerRadiusMm)) || 0);

      // Встановлюємо нові розміри canvas
      canvas.setDimensions({ width, height });

      // Створюємо новий clipPath з новими розмірами
      let newClipPath = null;

      switch (effectiveShapeType) {
        case "rectangle":
          newClipPath = new fabric.Rect({
            // Slight outward inflation (-0.5 offset + +1 size) to fully cover pixel grid and remove residual seams
            left: 0,
            top: 0,
            width: width,
            height: height,
            rx: cr,
            ry: cr,
            absolutePositioned: true,
            stroke: null,
            strokeWidth: 0,
            objectCaching: false, // reduce chance of cached edge anti-alias seam
          });
          break;

        case "circle":
          // --- Normalize clipPath to avoid 1px transparent contour seams ---
          if (newClipPath) {
            // Remove any accidental stroke that could create an inner gap
            newClipPath.set({ stroke: null, strokeWidth: 0 });
            // Для всіх, крім прямокутника, жорстко якіруємо до (0,0) лівий верх
            if (newClipPath.type !== "rect") {
              newClipPath.set({
                originX: "left",
                originY: "top",
                left: 0,
                top: 0,
              });
              // Обнулити pathOffset (важливо для path), щоб уникнути зсувів на малих розмірах
              try {
                if (newClipPath.type === "path") {
                  newClipPath.pathOffset = new fabric.Point(0, 0);
                }
              } catch {}
            } else {
              // Для прямокутника зберігаємо -0.5 інфляцію і не округлюємо
            }
            // For centered shapes, make sure radius-based ones fully cover area (slight +0.5 expansion if needed)
            if (
              newClipPath.type === "circle" ||
              newClipPath.type === "ellipse"
            ) {
              // Expand by 0.25 to counteract anti-alias shrink
              if (typeof newClipPath.radius === "number")
                newClipPath.radius += 0.25;
              if (typeof newClipPath.rx === "number") newClipPath.rx += 0.25;
              if (typeof newClipPath.ry === "number") newClipPath.ry += 0.25;
            }
            // Disable caching for crisper edge blending with background
            newClipPath.set({ objectCaching: false });
          }

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
          // Прямокутник з верхнім напівколом по центру (ш=16мм, в=8мм) і скругленими прямими кутами
          const wPx = width;
          const hPx = height;
          const rPx = mmToPx(8); // радіус напівкола по вертикалі
          const rectTopY = rPx; // y хорди напівкола
          const rectBottomY = hPx; // низ фігури
          const cx = wPx / 2;
          const radiusX = mmToPx(16) / 2; // 8мм по горизонталі (півширина хорди)
          const radiusY = rPx; // 8мм по вертикалі
          const leftArcX = cx - radiusX;
          const rightArcX = cx + radiusX;

          const pts = [];
          // Ліва точка хорди
          pts.push({ x: leftArcX, y: rectTopY });
          // Семпл дуги напівкола (π -> 2π)
          const steps = 60;
          for (let i = 1; i < steps - 1; i++) {
            const t = i / (steps - 1);
            const angle = Math.PI + Math.PI * t;
            const x = cx + radiusX * Math.cos(angle);
            const y = rectTopY + radiusY * Math.sin(angle);
            pts.push({ x, y });
          }
          // Права точка хорди
          pts.push({ x: rightArcX, y: rectTopY });

          // Скруглення прямокутної частини
          const baseCr = Math.min(cr, rectBottomY - rectTopY, wPx / 2);
          const topSideLen = wPx - rightArcX; // довжина верхньої прямої ділянки справа
          const crTop = Math.min(baseCr, topSideLen);
          const crBottom = baseCr;
          const cornerSegs =
            baseCr > 0 ? Math.max(10, Math.round(baseCr / 2)) : 0;

          // ---- Top-right ----
          if (crTop > 0) {
            pts.push({ x: wPx - crTop, y: rectTopY });
            const cxTR = wPx - crTop;
            const cyTR = rectTopY + crTop;
            for (let i = 0; i <= cornerSegs; i++) {
              const theta =
                (3 * Math.PI) / 2 + (Math.PI / 2) * (i / cornerSegs); // 270->360°
              pts.push({
                x: cxTR + crTop * Math.cos(theta),
                y: cyTR + crTop * Math.sin(theta),
              });
            }
          } else {
            pts.push({ x: wPx, y: rectTopY });
          }
          // ---- Right side + bottom-right ----
          if (crBottom > 0) {
            pts.push({ x: wPx, y: rectBottomY - crBottom });
            const cxBR = wPx - crBottom;
            const cyBR = rectBottomY - crBottom;
            for (let i = 0; i <= cornerSegs; i++) {
              const theta = 0 + (Math.PI / 2) * (i / cornerSegs); // 0->90°
              pts.push({
                x: cxBR + crBottom * Math.cos(theta),
                y: cyBR + crBottom * Math.sin(theta),
              });
            }
          } else {
            pts.push({ x: wPx, y: rectBottomY });
          }
          // ---- Bottom edge + bottom-left ----
          if (crBottom > 0) {
            pts.push({ x: crBottom, y: rectBottomY });
            const cxBL = crBottom;
            const cyBL = rectBottomY - crBottom;
            for (let i = 0; i <= cornerSegs; i++) {
              const theta = Math.PI / 2 + (Math.PI / 2) * (i / cornerSegs); // 90->180°
              pts.push({
                x: cxBL + crBottom * Math.cos(theta),
                y: cyBL + crBottom * Math.sin(theta),
              });
            }
          } else {
            pts.push({ x: 0, y: rectBottomY });
          }
          // ---- Left side + top-left ----
          if (crTop > 0) {
            pts.push({ x: 0, y: rectTopY + crTop });
            const cxTL = crTop;
            const cyTL = rectTopY + crTop;
            for (let i = 0; i <= cornerSegs; i++) {
              const theta = Math.PI + (Math.PI / 2) * (i / cornerSegs); // 180->270°
              pts.push({
                x: cxTL + crTop * Math.cos(theta),
                y: cyTL + crTop * Math.sin(theta),
              });
            }
            // повертаємося на початок дуги
            pts.push({ x: leftArcX, y: rectTopY });
          } else {
            pts.push({ x: 0, y: rectTopY });
          }

          newClipPath = new fabric.Polygon(pts, { absolutePositioned: true });
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
          // Для дуже малих розмірів — точний шлях еліптичної дуги, щоб уникнути зсувів
          if (width <= 64 || height <= 32) {
            const rx = width / 2;
            const ry = height; // півеліпс по висоті
            const dArc = `M0 ${height} A ${rx} ${ry} 0 0 1 ${width} ${height} L ${width} ${height} L 0 ${height} Z`;
            newClipPath = new fabric.Path(dArc, {
              absolutePositioned: true,
              originX: "center",
              originY: "center",
              left: width / 2,
              top: height / 2,
              objectCaching: false,
            });
            break;
          }
          // Ultra smooth: adaptive tension + optional arc refinement for large/середніх розмірів
          // 1. Base coarse sampling – rely on smoothing to remove micro steps
          const arcSeg = Math.max(48, Math.min(220, Math.round(width / 4))); // slight increase for stability
          let pts = makeHalfCirclePolygonPoints(width, height, arcSeg);
          // 2. Apply corner fillets (still polygonal) to embed geometry of base radius
          if (cr > 0) {
            const filletSeg = Math.max(
              14,
              Math.min(180, Math.round(Math.sqrt(cr) * 11))
            );
            pts = roundHalfCircleBaseCorners(pts, cr, filletSeg);
          }
          // 3. Uniform reparameterization along arc portion to reduce uneven spacing (micro steps)
          if (pts.length > 12) {
            // separate base line points (lowest y ~ height) from arc points (y < height)
            const baseY = Math.max(...pts.map((p) => p.y));
            const arcPts = pts.filter((p) => p.y < baseY - 0.0001);
            if (arcPts.length > 4) {
              // compute total length of arc polyline
              let len = 0;
              for (let i = 0; i < arcPts.length - 1; i++)
                len += Math.hypot(
                  arcPts[i + 1].x - arcPts[i].x,
                  arcPts[i + 1].y - arcPts[i].y
                );
              const targetCount = Math.min(
                1200,
                Math.max(80, Math.round(len / 1))
              ); // ~1px spacing target (cap 1200)
              let resampled = [];
              for (let k = 0; k <= targetCount; k++) {
                const dTarget = (len * k) / targetCount;
                let acc = 0;
                for (let i = 0; i < arcPts.length - 1; i++) {
                  const a = arcPts[i],
                    b = arcPts[i + 1];
                  const seg = Math.hypot(b.x - a.x, b.y - a.y);
                  if (acc + seg >= dTarget) {
                    const t = (dTarget - acc) / seg;
                    resampled.push({
                      x: a.x + (b.x - a.x) * t,
                      y: a.y + (b.y - a.y) * t,
                    });
                    break;
                  }
                  acc += seg;
                }
              }
              // rebuild pts: left base start, resampled arc, right base end
              const leftBase = pts[0];
              const rightBase = pts[pts.length - 1];
              // Optional Chaikin refinement for smoother curvature (applies only for sufficiently large radius)
              if (cr > 25) {
                const chaikin = (arr) => {
                  const out = [];
                  for (let i = 0; i < arr.length - 1; i++) {
                    const p = arr[i];
                    const q = arr[i + 1];
                    out.push({
                      x: p.x * 0.75 + q.x * 0.25,
                      y: p.y * 0.75 + q.y * 0.25,
                    });
                    out.push({
                      x: p.x * 0.25 + q.x * 0.75,
                      y: p.y * 0.25 + q.y * 0.75,
                    });
                  }
                  return out;
                };
                // one or two iterations depending on radius size
                let refined = resampled;
                refined = chaikin(refined);
                if (cr > 40) refined = chaikin(refined);
                // keep length cap
                if (refined.length > 1500)
                  refined = refined.filter((_, i) => i % 2 === 0);
                resampled = refined;
              }
              pts = [leftBase, ...resampled, rightBase];
            }
          }
          // 4. Adaptive tension: increase a bit for mid radii to smooth, reduce for extreme (avoid over-round)
          const tension = (() => {
            if (cr <= 0) return 0.5;
            if (cr < width * 0.15) return 0.55;
            if (cr < width * 0.3) return 0.6; // slightly softer
            if (cr < width * 0.45) return 0.56; // pull back
            return 0.5; // very large radii keep neutral
          })();
          // Final micro-smoothing pass: small Laplacian smoothing to reduce residual "зубці"
          if (pts.length > 20 && cr > 0) {
            const smoothIter = cr > 30 ? 3 : 2;
            for (let it = 0; it < smoothIter; it++) {
              for (let i = 1; i < pts.length - 1; i++) {
                const p = pts[i];
                const a = pts[i - 1];
                const b = pts[i + 1];
                // skip base endpoints (y close to height)
                p.x = (p.x * 2 + a.x + b.x) / 4; // weighted average preserves shape more
                p.y = (p.y * 2 + a.y + b.y) / 4;
              }
            }
          }
          // Using OPEN Catmull-Rom (no wrap) then straight base line closure to avoid small spikes at base corners
          const d = pointsToOpenCatmullRomCubicPath(pts, tension);
          newClipPath = new fabric.Path(d, {
            absolutePositioned: true,
            originX: "center",
            originY: "center",
            left: width / 2,
            top: height / 2,
            objectCaching: false,
          });
          break;
        }

        case "extendedHalfCircle": {
          // Для дуже малих розмірів — прямий еліптичний верх із вертикальними «подовженнями» працює нестабільно,
          // тому робимо точний півеліпс як у halfCircle
          if (width <= 64 || height <= 32) {
            const rx = width / 2;
            const ry = height;
            const dArc = `M0 ${height} A ${rx} ${ry} 0 0 1 ${width} ${height} L ${width} ${height} L 0 ${height} Z`;
            newClipPath = new fabric.Path(dArc, {
              absolutePositioned: true,
              originX: "center",
              originY: "center",
              left: width / 2,
              top: height / 2,
              objectCaching: false,
            });
            break;
          }
          // Використовуємо покращену логіку з HTML реалізації для більших розмірів
          const Rbase = width * 0.5;

          if (height <= Rbase) {
            // 1:1 використання пайплайну звичайного півкола (округлення + ресемпл + Catmull-Rom)
            const arcSeg = Math.max(48, Math.min(220, Math.round(width / 4)));
            let pts = makeHalfCirclePolygonPoints(width, height, arcSeg);
            if (cr > 0) {
              const filletSeg = Math.max(
                14,
                Math.min(180, Math.round(Math.sqrt(cr) * 11))
              );
              pts = roundHalfCircleBaseCorners(pts, cr, filletSeg);
            }
            if (pts.length > 12) {
              const baseY = Math.max(...pts.map((p) => p.y));
              const arcPts = pts.filter((p) => p.y < baseY - 0.0001);
              if (arcPts.length > 4) {
                let len = 0;
                for (let i = 0; i < arcPts.length - 1; i++)
                  len += Math.hypot(
                    arcPts[i + 1].x - arcPts[i].x,
                    arcPts[i + 1].y - arcPts[i].y
                  );
                const targetCount = Math.min(
                  1200,
                  Math.max(80, Math.round(len / 1))
                );
                let resampled = [];
                for (let k = 0; k <= targetCount; k++) {
                  const dTarget = (len * k) / targetCount;
                  let acc = 0;
                  for (let i = 0; i < arcPts.length - 1; i++) {
                    const a = arcPts[i],
                      b = arcPts[i + 1];
                    const seg = Math.hypot(b.x - a.x, b.y - a.y);
                    if (acc + seg >= dTarget) {
                      const t = (dTarget - acc) / seg;
                      resampled.push({
                        x: a.x + (b.x - a.x) * t,
                        y: a.y + (b.y - a.y) * t,
                      });
                      break;
                    }
                    acc += seg;
                  }
                }
                const leftBase = pts[0];
                const rightBase = pts[pts.length - 1];
                if (cr > 25) {
                  const chaikin = (arr) => {
                    const out = [];
                    for (let i = 0; i < arr.length - 1; i++) {
                      const p = arr[i];
                      const q = arr[i + 1];
                      out.push({
                        x: p.x * 0.75 + q.x * 0.25,
                        y: p.y * 0.75 + q.y * 0.25,
                      });
                      out.push({
                        x: p.x * 0.25 + q.x * 0.75,
                        y: p.y * 0.25 + q.y * 0.75,
                      });
                    }
                    return out;
                  };
                  let refined = resampled;
                  refined = chaikin(refined);
                  if (cr > 40) refined = chaikin(refined);
                  if (refined.length > 1500)
                    refined = refined.filter((_, i) => i % 2 === 0);
                  resampled = refined;
                }
                pts = [leftBase, ...resampled, rightBase];
              }
            }
            const tension = (() => {
              if (cr <= 0) return 0.5;
              if (cr < width * 0.15) return 0.55;
              if (cr < width * 0.3) return 0.6;
              if (cr < width * 0.45) return 0.56;
              return 0.5;
            })();
            const d = pointsToOpenCatmullRomCubicPath(pts, tension);
            newClipPath = new fabric.Path(d, {
              absolutePositioned: true,
              originX: "center",
              originY: "center",
              left: width / 2,
              top: height / 2,
              objectCaching: false,
            });
          } else {
            // Високий варіант – наша спеціальна плавна логіка
            const cornerRadius = Math.max(0, Math.min(cr, height - 1));
            const pathString = makeExtendedHalfCircleSmoothPath(
              width,
              height,
              cornerRadius
            );
            newClipPath = new fabric.Path(pathString, {
              absolutePositioned: true,
              originX: "center",
              originY: "center",
              left: width / 2,
              top: height / 2,
              fill: "transparent",
              stroke: "transparent",
            });
          }

          break;
        }

        case "adaptiveTriangle": {
          // Адаптивний трикутник, обрізаний прямокутником полотна
          const pts = getAdaptiveTrianglePoints(width, height);
          newClipPath = new fabric.Polygon(pts, { absolutePositioned: true });
          break;
        }

        case "hexagon": {
          if (width <= 64 || height <= 64) {
            // точний шістикутник малих розмірів
            const pts = [
              { x: width * 0.25, y: 0 },
              { x: width * 0.75, y: 0 },
              { x: width, y: height * 0.5 },
              { x: width * 0.75, y: height },
              { x: width * 0.25, y: height },
              { x: 0, y: height * 0.5 },
            ];
            newClipPath = new fabric.Polygon(pts, {
              absolutePositioned: true,
              originX: "left",
              originY: "top",
              left: 0,
              top: 0,
              objectCaching: false,
            });
          } else {
            // Генеруємо округлений hexagon
            const d = makeRoundedHexagonPath(width, height, cr);

            newClipPath = new fabric.Path(d, {
              absolutePositioned: true,
              originX: "center",
              originY: "center",
              left: width / 2,
              top: height / 2,
              objectCaching: false,
            });
          }
          break;
        }

        case "octagon": {
          if (width <= 64 || height <= 64) {
            const pts = [
              { x: width * 0.3, y: 0 },
              { x: width * 0.7, y: 0 },
              { x: width, y: height * 0.3 },
              { x: width, y: height * 0.7 },
              { x: width * 0.7, y: height },
              { x: width * 0.3, y: height },
              { x: 0, y: height * 0.7 },
              { x: 0, y: height * 0.3 },
            ];
            newClipPath = new fabric.Polygon(pts, {
              absolutePositioned: true,
              originX: "left",
              originY: "top",
              left: 0,
              top: 0,
              objectCaching: false,
            });
          } else {
            // Генеруємо округлений octagon
            const d = makeRoundedOctagonPath(width, height, cr);

            newClipPath = new fabric.Path(d, {
              absolutePositioned: true,
              originX: "center",
              originY: "center",
              left: width / 2,
              top: height / 2,
              objectCaching: false,
            });
          }
          break;
        }

        case "triangle": {
          if (width <= 64 || height <= 64) {
            const pts = [
              { x: width / 2, y: 0 },
              { x: width, y: height },
              { x: 0, y: height },
            ];
            newClipPath = new fabric.Polygon(pts, {
              absolutePositioned: true,
              originX: "left",
              originY: "top",
              left: 0,
              top: 0,
              objectCaching: false,
            });
          } else {
            // Генеруємо округлений triangle
            const d = makeRoundedTrianglePath(width, height, cr);

            // Адаптивний strokeWidth: 1:1 з радіусом для повного покриття
            // cr=5->5px, cr=20->20px, cr=47->47px, cr=50->50px (cap)
            const adaptiveStrokeWidth = Math.min(50, Math.max(2, cr));

            newClipPath = new fabric.Path(d, {
              absolutePositioned: true,
              objectCaching: false,
              // Додаємо fill stroke щоб заповнити білі зони від Bezier-скруглень
              fill: "#000000",
              stroke: "#000000",
              strokeWidth: adaptiveStrokeWidth,
              strokeLineJoin: "round",
            });
            // Центруємо шлях точно по габаритам, щоб при зміні радіуса не було зсуву
            centerPathToCanvas(newClipPath, width, height);
          }
          break;
        }

        case "arrowLeft": {
          if (width <= 64 || height <= 64) {
            const pts = [
              { x: 0, y: height / 2 },
              { x: width * 0.3, y: 0 },
              { x: width * 0.3, y: height * 0.25 },
              { x: width, y: height * 0.25 },
              { x: width, y: height * 0.75 },
              { x: width * 0.3, y: height * 0.75 },
              { x: width * 0.3, y: height },
            ];
            newClipPath = new fabric.Polygon(pts, {
              absolutePositioned: true,
              originX: "left",
              originY: "top",
              left: 0,
              top: 0,
              objectCaching: false,
            });
          } else {
            // Генеруємо округлену arrowLeft
            const d = makeRoundedArrowLeftPath(width, height, cr);

            // Адаптивний strokeWidth: 1:1 з радіусом для повного покриття
            const adaptiveStrokeWidth = Math.min(50, Math.max(2, cr));

            newClipPath = new fabric.Path(d, {
              absolutePositioned: true,
              objectCaching: false,
              fill: "#000000",
              stroke: "#000000",
              strokeWidth: adaptiveStrokeWidth,
              strokeLineJoin: "round",
            });
            centerPathToCanvas(newClipPath, width, height);
          }
          break;
        }

        case "arrowRight": {
          if (width <= 64 || height <= 64) {
            const pts = [
              { x: width, y: height / 2 },
              { x: width * 0.7, y: 0 },
              { x: width * 0.7, y: height * 0.25 },
              { x: 0, y: height * 0.25 },
              { x: 0, y: height * 0.75 },
              { x: width * 0.7, y: height * 0.75 },
              { x: width * 0.7, y: height },
            ];
            newClipPath = new fabric.Polygon(pts, {
              absolutePositioned: true,
              originX: "left",
              originY: "top",
              left: 0,
              top: 0,
              objectCaching: false,
            });
          } else {
            // Генеруємо округлену arrowRight
            const d = makeRoundedArrowRightPath(width, height, cr);

            // Адаптивний strokeWidth: 1:1 з радіусом для повного покриття
            const adaptiveStrokeWidth = Math.min(50, Math.max(2, cr));

            newClipPath = new fabric.Path(d, {
              absolutePositioned: true,
              objectCaching: false,
              fill: "#000000",
              stroke: "#000000",
              strokeWidth: adaptiveStrokeWidth,
              strokeLineJoin: "round",
            });
            centerPathToCanvas(newClipPath, width, height);
          }
          break;
        }

        case "flag": {
          // Генеруємо округлений flag
          const d = makeRoundedFlagPath(width, height, cr);

          newClipPath = new fabric.Path(d, {
            absolutePositioned: true,
            originX: "center",
            originY: "center",
            left: width / 2,
            top: height / 2,
            objectCaching: false,
          });
          break;
        }

        case "diamond":
          newClipPath = new fabric.Path(
            `M${width * 0.5} 0L${width} ${height * 0.5}L${
              width * 0.5
            } ${height}L0 ${height * 0.5}Z`,
            { absolutePositioned: true }
          );
          break;

        default:
          break;
      }

      // Встановлюємо новий clipPath
      if (newClipPath) {
        // При изменении именно cornerRadius гарантируем повторное центрирование
        // для фигур, создаваемых как path (особенно triangle/arrowLeft/arrowRight)
        try {
          if (
            overrides &&
            Object.prototype.hasOwnProperty.call(overrides, "cornerRadiusMm") &&
            newClipPath.type === "path"
          ) {
            centerPathToCanvas(newClipPath, width, height);
          }
        } catch {}
        canvas.clipPath = newClipPath;
        // Прибираємо будь-який контур у самої фігури clipPath (та дочірніх якщо група)
        // ОКРІМ triangle та arrows, де stroke потрібен для покриття білих зон від Bezier
        const stripStroke = (obj) => {
          if (!obj) return;
          // Зберігаємо stroke для triangle та стрілок при наявності cornerRadius
          const keepStroke =
            (currentShapeType === "triangle" ||
              currentShapeType === "arrowLeft" ||
              currentShapeType === "arrowRight") &&
            cr > 0;
          if (!keepStroke) {
            obj.set({ stroke: null, strokeWidth: 0, strokeDashArray: null });
          }
          if (obj._objects && Array.isArray(obj._objects)) {
            obj._objects.forEach(stripStroke);
          }
        };
        stripStroke(canvas.clipPath);
      }

      // Оновлюємо візуальний контур і обводки
      updateCanvasOutline();
      // Бордер відновлюється окремо у викликах-обробниках після resize/radius, щоб уникати подвійної перебудови

      ensureBorderPresence({
        mode: "default",
        forceRebuild: true,
      });
      if (
        borderStateRef.current.mode === "custom" ||
        findBorderObject("custom")
      ) {
        ensureBorderPresence({
          mode: "custom",
          thicknessPx:
            borderStateRef.current.customThicknessPx ?? mmToPx(thickness),
          forceRebuild: true,
        });
      }

      // Перерахунок і перевстановлення дирок після зміни розміру + лог відступу
      recomputeHolesAfterResize();

      // Спеціальна адаптація внутрішніх елементів для circleWithLine після зміни розміру
      if (currentShapeType === "circleWithLine") {
        const diameterPx = canvas.width; // квадрат
        // Лінія
        const lineObj = canvas
          .getObjects()
          .find((o) => o.isCircleWithLineCenterLine);
        if (lineObj) {
          const diameterMm = pxToMm(diameterPx);
          const lineWidthMm = diameterMm * 0.65;
          // Обчислюємо поточну пропорцію товщини до розміру картки і зберігаємо її
          const currThickMm = pxToMm(lineObj.height || 0);
          const currRatio = diameterMm > 0 ? currThickMm / diameterMm : 0;
          // Нова товщина за збереженою пропорцією
          const lineThicknessMm = Math.max(
            0,
            diameterMm * (currRatio || thickness / Math.max(1, diameterMm))
          );
          lineObj.set({
            width: mmToPx(lineWidthMm),
            height: mmToPx(lineThicknessMm),
            left: diameterPx / 2,
            top: canvas.height / 2,
          });
          lineObj.setCoords();
        }
        // Тексти
        const topText = canvas
          .getObjects()
          .find((o) => o.isCircleWithLineTopText);
        const bottomText = canvas
          .getObjects()
          .find((o) => o.isCircleWithLineBottomText);
        // Фіксоване співвідношення 100/5 => 1:20 (fontSizeMm = widthMm / 20)
        const widthMmNow = pxToMm(diameterPx);
        const desiredFontPx = mmToPx(widthMmNow / 20);
        if (topText)
          topText.set({ fontSize: Math.max(1, Math.round(desiredFontPx)) });
        if (bottomText)
          bottomText.set({ fontSize: Math.max(1, Math.round(desiredFontPx)) });
        if (topText || bottomText) {
          // Використовуємо поточну товщину (state thickness) для перерахунку відступів
          const diameterMm = pxToMm(diameterPx);
          const effectiveThickMm = (() => {
            if (lineObj) {
              const currThickMm = pxToMm(lineObj.height || 0);
              const currRatio = diameterMm > 0 ? currThickMm / diameterMm : 0;
              return Math.max(
                0,
                diameterMm * (currRatio || thickness / Math.max(1, diameterMm))
              );
            }
            return thickness;
          })();
          const lineThicknessMm = effectiveThickMm; // мм
          const radiusMm = diameterMm / 2;
          // Узгоджуємо з початковим створенням (там було /6) щоб уникнути першого "стрибка"
          const gapMm = (radiusMm - lineThicknessMm / 2) / 6;
          const centerY = canvas.height / 2;
          if (topText) {
            topText.set({ left: diameterPx / 2, top: centerY - mmToPx(gapMm) });
            topText.setCoords();
          }
          if (bottomText) {
            bottomText.set({
              left: diameterPx / 2,
              top: centerY + mmToPx(gapMm),
            });
            bottomText.setCoords();
          }
        }
        canvas.renderAll();
      } else if (currentShapeType === "circleWithCross") {
        const canvasW = canvas.width;
        const canvasH = canvas.height;
        const centerX = canvasW / 2;
        const diameterMm = pxToMm(canvasW);
        // Лінії «Т» — перебудова
        const hLine = canvas
          .getObjects()
          .find((o) => o.isCircleWithCrossHorizontalLine);
        const vLine = canvas
          .getObjects()
          .find((o) => o.isCircleWithCrossVerticalLine);
        const lineWidthMm = diameterMm * 0.65;
        // Обчислюємо актуальну пропорцію товщини до розміру картки за наявними лініями
        const deriveThickRatio = () => {
          const hThickMm = hLine ? pxToMm(hLine.height || 0) : null;
          const vThickMm = vLine ? pxToMm(vLine.width || 0) : null;
          const mm =
            typeof hThickMm === "number" && hThickMm > 0 ? hThickMm : vThickMm;
          return diameterMm > 0 && mm ? mm / diameterMm : null;
        };
        const thickRatio = deriveThickRatio();
        const lineThicknessMm = Math.max(
          0,
          thickRatio != null ? diameterMm * thickRatio : thickness // fallback до поточного state товщини
        );
        const lineThicknessPx = mmToPx(lineThicknessMm);
        const lineWidthPx = mmToPx(lineWidthMm);
        const paddingPx = mmToPx(0.5); // зменшений відступ для ближчого розташування до лінії
        const hTop = canvasH / 2 - lineThicknessPx / 2;
        const hBottom = canvasH / 2 + lineThicknessPx / 2;
        const vLeft = centerX - lineThicknessPx / 2;
        const vRight = centerX + lineThicknessPx / 2;

        if (hLine) {
          hLine.set({
            width: lineWidthPx,
            height: lineThicknessPx,
            left: centerX,
            top: canvasH / 2,
          });
          hLine.setCoords();
        }
        if (vLine) {
          const vHeightMm = diameterMm * 0.33;
          vLine.set({
            width: lineThicknessPx,
            height: mmToPx(vHeightMm),
            left: centerX,
            top: canvasH / 2,
          });
          vLine.setCoords();
        }

        // Тексти — детермінована прив'язка до «Т» і меж круга
        const topText = canvas
          .getObjects()
          .find((o) => o.isCircleWithCrossTopText);
        const blText = canvas
          .getObjects()
          .find((o) => o.isCircleWithCrossBottomLeftText);
        const brText = canvas
          .getObjects()
          .find((o) => o.isCircleWithCrossBottomRightText);
        // Фіксоване співвідношення 100/5 => 1:20 (fontSizeMm = widthMm / 20)
        const widthMmNow2 = pxToMm(canvasW);
        const desiredFontPx2 = Math.max(
          1,
          Math.round(mmToPx(widthMmNow2 / 20))
        );
        if (topText) {
          topText.set({ fontSize: desiredFontPx2 });
          topText.__minFontPx = desiredFontPx2;
        }
        if (blText) {
          blText.set({ fontSize: desiredFontPx2 });
          blText.__minFontPx = desiredFontPx2;
        }
        if (brText) {
          brText.set({ fontSize: desiredFontPx2 });
          brText.__minFontPx = desiredFontPx2;
        }

        if (topText) {
          topText.set({
            left: centerX,
            originX: "center",
            textAlign: "center",
            width: Math.max(20, lineWidthPx - paddingPx * 2),
            fontSize: desiredFontPx2,
          });
          topText.initDimensions && topText.initDimensions();
          const topH = topText.height || 0;
          const desiredTop = Math.max(0, hTop - paddingPx - topH / 2);
          topText.set({ top: desiredTop });
          topText.setCoords();
        }

        if (blText) {
          const leftX = paddingPx;
          const leftW = Math.max(20, vLeft - paddingPx - leftX);
          blText.set({
            left: leftX,
            width: leftW,
            originX: "left",
            textAlign: "center",
            fontSize: desiredFontPx2,
          });
          blText.initDimensions && blText.initDimensions();
          const h = blText.height || 0;
          const desiredTop = hBottom + paddingPx + h / 2;
          blText.set({ top: desiredTop });
          blText.setCoords();
        }

        if (brText) {
          const rightLeft = vRight + paddingPx;
          const rightW = Math.max(20, canvasW - paddingPx - rightLeft);
          brText.set({
            left: rightLeft,
            width: rightW,
            originX: "left",
            textAlign: "center",
            fontSize: desiredFontPx2,
          });
          brText.initDimensions && brText.initDimensions();
          const h = brText.height || 0;
          const desiredTop = hBottom + paddingPx + h / 2;
          brText.set({ top: desiredTop });
          brText.setCoords();
        }

        canvas.requestRenderAll();
      }

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
    if (currentShapeType === "lock") {
      clearExistingHoles();
      const hole = createLockHoleCircle();
      if (hole) {
        try {
          const topGapMm = pxToMm((hole.top || 0) - (hole.radius || 0));
          console.log(
            `Відступ отвору зверху: ${topGapMm.toFixed(
              2
            )} мм (lock, Ø ${holesDiameter} мм)`
          );
        } catch {}
        canvas.add(hole);
        canvas.renderAll();
      }
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
    } catch {}

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

  // При зміні діаметра — оновлюємо розміщення і розмір отворів
  useEffect(() => {
    if (!canvas) return;
    if (!isHolesSelected || activeHolesType === 1) return;
    recomputeHolesAfterResize();
  }, [holesDiameter, canvas, isHolesSelected, activeHolesType]);

  // Функція для оновлення візуального контуру canvas
  const updateCanvasOutline = () => {
    if (!canvas) return;
    // Полністю відключено: більше не створюємо жодного контуру на canvas
    const existingOutlineAll = canvas
      .getObjects()
      .filter((o) => o.isCanvasOutline);
    if (existingOutlineAll.length) {
      existingOutlineAll.forEach((o) => canvas.remove(o));
      canvas.requestRenderAll();
    }
    return; // <- припиняємо виконання щоб гарантовано не відмальовувати контур
    /*
    // Видаляємо попередній контур, якщо лишився
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
      const clipPathData = { ...canvas.clipPath.toObject() };
      // fabric попередження "Setting type has no effect" якщо передати type в options — видаляємо
      delete clipPathData.type;

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
          const flatPts = cp.points.map((p) => ({ x: p.x * sx, y: p.y * sy }));
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
        // Більше не інсетуємо контур окремо – це робить глобальний viewport scale.
        outlineShape.set({
          fill: "transparent",
          stroke: globalColors?.textColor || "#000000",
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
  */
  };

  // Повне перезбирання відображення бордера при зміні розмірів / cornerRadius
  const updateExistingBorders = useCallback(() => {
    ensureBorderPresence({ mode: "default", forceRebuild: true });
    if (
      borderStateRef.current.mode === "custom" ||
      findBorderObject("custom")
    ) {
      ensureBorderPresence({
        mode: "custom",
        thicknessPx:
          borderStateRef.current.customThicknessPx ?? mmToPx(thickness),
        forceRebuild: true,
      });
    }
  }, [ensureBorderPresence, findBorderObject, mmToPx, thickness]);

  // --- Hexagon / Octagon inner border helpers (rounded polygon sampling) ---
  const sampleRoundedPolygon = (basePts, r, segments) => {
    // basePts: original polygon (closed CCW or CW). Round only convex corners to avoid artifacts.
    const n = basePts.length;
    if (!r || r <= 0 || n < 3) return basePts.map((p) => ({ x: p.x, y: p.y }));

    // Determine orientation
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = basePts[i];
      const b = basePts[(i + 1) % n];
      area += a.x * b.y - b.x * a.y;
    }
    const ccw = area > 0;

    const pts = [];
    const seg = Math.max(4, Math.min(48, Math.round(segments || 8)));
    for (let i = 0; i < n; i++) {
      const prev = basePts[(i - 1 + n) % n];
      const curr = basePts[i];
      const next = basePts[(i + 1) % n];

      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;

      const len1 = Math.hypot(v1x, v1y) || 1;
      const len2 = Math.hypot(v2x, v2y) || 1;
      const u1x = v1x / len1;
      const u1y = v1y / len1;
      const u2x = v2x / len2;
      const u2y = v2y / len2;

      const cross = u1x * u2y - u1y * u2x; // sign to detect convexity
      const isConvex = ccw ? cross > 0 : cross < 0;

      // If concave, do not round: keep original corner
      if (!isConvex) {
        // avoid duplicates
        if (
          pts.length === 0 ||
          Math.hypot(
            pts[pts.length - 1].x - curr.x,
            pts[pts.length - 1].y - curr.y
          ) > 0.01
        ) {
          pts.push({ x: curr.x, y: curr.y });
        }
        continue;
      }

      const rClamped = Math.min(r, len1 / 2 - 0.001, len2 / 2 - 0.001);
      if (rClamped <= 0) {
        if (
          pts.length === 0 ||
          Math.hypot(
            pts[pts.length - 1].x - curr.x,
            pts[pts.length - 1].y - curr.y
          ) > 0.01
        ) {
          pts.push({ x: curr.x, y: curr.y });
        }
        continue;
      }

      const p1x = curr.x - u1x * rClamped;
      const p1y = curr.y - u1y * rClamped;
      const p2x = curr.x + u2x * rClamped;
      const p2y = curr.y + u2y * rClamped;

      if (
        pts.length === 0 ||
        Math.hypot(pts[pts.length - 1].x - p1x, pts[pts.length - 1].y - p1y) >
          0.01
      ) {
        pts.push({ x: p1x, y: p1y });
      }
      for (let s = 1; s < seg; s++) {
        const t = s / seg;
        const omt = 1 - t;
        const bx = omt * omt * p1x + 2 * omt * t * curr.x + t * t * p2x;
        const by = omt * omt * p1y + 2 * omt * t * curr.y + t * t * p2y;
        pts.push({ x: bx, y: by });
      }
      pts.push({ x: p2x, y: p2y });
    }
    return pts;
  };

  // Per-corner rounding with weights: r_i = r * weights[i] (still clamped by adjacent edge lengths)
  const sampleRoundedPolygonPerCorner = (basePts, r, segments, weights) => {
    const n = basePts.length;
    if (!r || r <= 0 || n < 3) return basePts.map((p) => ({ x: p.x, y: p.y }));
    const w =
      Array.isArray(weights) && weights.length === n
        ? weights
        : new Array(n).fill(1);

    // Determine orientation
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = basePts[i];
      const b = basePts[(i + 1) % n];
      area += a.x * b.y - b.x * a.y;
    }
    const ccw = area > 0;

    const pts = [];
    const seg = Math.max(4, Math.min(48, Math.round(segments || 8)));
    for (let i = 0; i < n; i++) {
      const prev = basePts[(i - 1 + n) % n];
      const curr = basePts[i];
      const next = basePts[(i + 1) % n];

      const v1x = curr.x - prev.x;
      const v1y = curr.y - prev.y;
      const v2x = next.x - curr.x;
      const v2y = next.y - curr.y;

      const len1 = Math.hypot(v1x, v1y) || 1;
      const len2 = Math.hypot(v2x, v2y) || 1;
      const u1x = v1x / len1;
      const u1y = v1y / len1;
      const u2x = v2x / len2;
      const u2y = v2y / len2;

      const cross = u1x * u2y - u1y * u2x;
      const isConvex = ccw ? cross > 0 : cross < 0;

      if (!isConvex) {
        if (
          pts.length === 0 ||
          Math.hypot(
            pts[pts.length - 1].x - curr.x,
            pts[pts.length - 1].y - curr.y
          ) > 0.01
        ) {
          pts.push({ x: curr.x, y: curr.y });
        }
        continue;
      }

      const rCorner = Math.max(0, r * (w[i] ?? 1));
      const rClamped = Math.min(rCorner, len1 / 2 - 0.001, len2 / 2 - 0.001);
      if (rClamped <= 0) {
        if (
          pts.length === 0 ||
          Math.hypot(
            pts[pts.length - 1].x - curr.x,
            pts[pts.length - 1].y - curr.y
          ) > 0.01
        ) {
          pts.push({ x: curr.x, y: curr.y });
        }
        continue;
      }

      const p1x = curr.x - u1x * rClamped;
      const p1y = curr.y - u1y * rClamped;
      const p2x = curr.x + u2x * rClamped;
      const p2y = curr.y + u2y * rClamped;

      if (
        pts.length === 0 ||
        Math.hypot(pts[pts.length - 1].x - p1x, pts[pts.length - 1].y - p1y) >
          0.01
      ) {
        pts.push({ x: p1x, y: p1y });
      }
      for (let s = 1; s < seg; s++) {
        const t = s / seg;
        const omt = 1 - t;
        const bx = omt * omt * p1x + 2 * omt * t * curr.x + t * t * p2x;
        const by = omt * omt * p1y + 2 * omt * t * curr.y + t * t * p2y;
        pts.push({ x: bx, y: by });
      }
      pts.push({ x: p2x, y: p2y });
    }
    return pts;
  };

  // Walk along polyline from vertex index i, direction dir (-1 prev, +1 next), accumulating distance
  function walkAlongPolyline(basePts, i, dir, distance, maxSteps = 3) {
    const n = basePts.length;
    let remaining = Math.max(0, distance);
    let from = basePts[i];
    let steps = 0;
    let j = (i + dir + n) % n;
    while (steps < maxSteps) {
      const to = basePts[j];
      const segLen = Math.hypot(to.x - from.x, to.y - from.y) || 0;
      if (remaining <= segLen) {
        const t = segLen > 0 ? remaining / segLen : 0;
        return {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        };
      }
      remaining -= segLen;
      from = to;
      j = (j + dir + n) % n;
      steps++;
    }
    return { x: from.x, y: from.y };
  }

  // Flexible per-corner rounding: for non-top corners, walk across multiple edges so radius keeps growing
  function sampleRoundedPolygonPerCornerFlexible(
    basePts,
    r,
    segments,
    weights
  ) {
    const n = basePts.length;
    if (!r || r <= 0 || n < 3) return basePts.map((p) => ({ x: p.x, y: p.y }));
    // Find top index (min Y)
    let topIdx = 0;
    let minY = Infinity;
    for (let i = 0; i < n; i++) {
      if (basePts[i].y < minY) {
        minY = basePts[i].y;
        topIdx = i;
      }
    }
    const w =
      Array.isArray(weights) && weights.length === n
        ? weights
        : new Array(n).fill(1);
    // orientation for convexity test
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = basePts[i];
      const b = basePts[(i + 1) % n];
      area += a.x * b.y - b.x * a.y;
    }
    const ccw = area > 0;
    const out = [];
    const seg = Math.max(8, Math.min(64, Math.round(segments || 12)));
    for (let i = 0; i < n; i++) {
      const prev = basePts[(i - 1 + n) % n];
      const curr = basePts[i];
      const next = basePts[(i + 1) % n];

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
      const cross = u1x * u2y - u1y * u2x;
      const isConvex = ccw ? cross > 0 : cross < 0;
      if (!isConvex) {
        if (
          out.length === 0 ||
          Math.hypot(
            out[out.length - 1].x - curr.x,
            out[out.length - 1].y - curr.y
          ) > 0.01
        ) {
          out.push({ x: curr.x, y: curr.y });
        }
        continue;
      }

      const rTarget = Math.max(0, r * (w[i] ?? 1));
      if (rTarget <= 0.001) {
        if (
          out.length === 0 ||
          Math.hypot(
            out[out.length - 1].x - curr.x,
            out[out.length - 1].y - curr.y
          ) > 0.01
        ) {
          out.push({ x: curr.x, y: curr.y });
        }
        continue;
      }

      let p1, p2;
      if (i === topIdx) {
        // верхній кут – залишаємо стару стабільну схему з локальним клампом
        const rClamp = Math.min(rTarget, len1 / 2 - 0.001, len2 / 2 - 0.001);
        p1 = { x: curr.x - u1x * rClamp, y: curr.y - u1y * rClamp };
        p2 = { x: curr.x + u2x * rClamp, y: curr.y + u2y * rClamp };
      } else {
        // інші кути – не виходимо за межі сусідніх ребер (щоб не було "листків")
        const rPrev = Math.min(rTarget, len1 * 0.48);
        const rNext = Math.min(rTarget, len2 * 0.48);
        const rUse = Math.max(0.001, Math.min(rPrev, rNext));
        p1 = { x: curr.x - u1x * rUse, y: curr.y - u1y * rUse };
        p2 = { x: curr.x + u2x * rUse, y: curr.y + u2y * rUse };
      }

      if (
        out.length === 0 ||
        Math.hypot(out[out.length - 1].x - p1.x, out[out.length - 1].y - p1.y) >
          0.01
      ) {
        out.push(p1);
      }
      for (let s = 1; s < seg; s++) {
        const t = s / seg;
        const omt = 1 - t;
        const bx = omt * omt * p1.x + 2 * omt * t * curr.x + t * t * p2.x;
        const by = omt * omt * p1.y + 2 * omt * t * curr.y + t * t * p2.y;
        if (
          Math.hypot(bx - p1.x, by - p1.y) > 0.005 &&
          Math.hypot(bx - p2.x, by - p2.y) > 0.005
        ) {
          out.push({ x: bx, y: by });
        }
      }
      if (
        Math.hypot(out[out.length - 1].x - p2.x, out[out.length - 1].y - p2.y) >
        0.005
      ) {
        out.push(p2);
      }
    }
    return out;
  }

  // Build weights for adaptiveTriangle pentagon: keep TOP=1.0, reduce JUNCTIONS a bit, BOTTOM corners slightly.
  function getAdaptivePentagonCornerWeights(
    basePts,
    width,
    height,
    cornerRadiusMm
  ) {
    const n = basePts.length;
    const weights = new Array(n).fill(0.85);
    if (n < 5) return weights; // fallback
    // Top = minimal y
    let topIdx = 0;
    let minY = Infinity;
    for (let i = 0; i < n; i++) {
      if (basePts[i].y < minY) {
        minY = basePts[i].y;
        topIdx = i;
      }
    }
    weights[topIdx] = 1.0;

    const eps = Math.max(1, Math.min(width, height) * 0.002);
    // bottom-level vertices (near canvas bottom)
    const bottomish = [];
    for (let i = 0; i < n; i++) {
      if (Math.abs(basePts[i].y - height) <= eps) bottomish.push(i);
    }
    // scale down others when radius is large (beyond ~31mm user threshold)
    const mm = Number(cornerRadiusMm) || 0;
    const scaleLarge = mm > 31 ? Math.max(0.6, 31 / mm) : 1;

    // identify bottom corners (near x=0 and x=width)
    let leftBottomIdx = -1;
    let rightBottomIdx = -1;
    for (const i of bottomish) {
      if (Math.abs(basePts[i].x - 0) <= eps) leftBottomIdx = i;
      if (Math.abs(basePts[i].x - width) <= eps) rightBottomIdx = i;
    }
    if (leftBottomIdx >= 0) weights[leftBottomIdx] = 0.8 * scaleLarge;
    if (rightBottomIdx >= 0) weights[rightBottomIdx] = 0.8 * scaleLarge;

    // junctions: bottomish but not bottom corners
    for (const i of bottomish) {
      if (i !== leftBottomIdx && i !== rightBottomIdx) {
        weights[i] = 0.65 * scaleLarge;
      }
    }
    return weights;
  }

  // Selective rounding (only specified corner indices) – used for halfCircle base corners
  function sampleRoundedPolygonSelective(basePts, r, segments, cornerIndices) {
    if (!r || r <= 0) return basePts.map((p) => ({ x: p.x, y: p.y }));
    const n = basePts.length;
    const cornerSet = new Set(cornerIndices);
    const out = [];
    for (let i = 0; i < n; i++) {
      const curr = basePts[i];
      if (!cornerSet.has(i)) {
        out.push({ x: curr.x, y: curr.y });
        continue;
      }
      const prev = basePts[(i - 1 + n) % n];
      const next = basePts[(i + 1) % n];
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
      const rClamped = Math.min(r, len1 / 2 - 0.001, len2 / 2 - 0.001);
      const p1x = curr.x - u1x * rClamped;
      const p1y = curr.y - u1y * rClamped;
      const p2x = curr.x + u2x * rClamped;
      const p2y = curr.y + u2y * rClamped;
      if (
        out.length === 0 ||
        Math.hypot(out[out.length - 1].x - p1x, out[out.length - 1].y - p1y) >
          0.05
      ) {
        out.push({ x: p1x, y: p1y });
      }
      const seg = Math.max(4, Math.min(48, Math.round(segments || 8)));
      for (let s = 1; s < seg; s++) {
        const t = s / seg;
        const omt = 1 - t;
        const bx = omt * omt * p1x + 2 * omt * t * curr.x + t * t * p2x;
        const by = omt * omt * p1y + 2 * omt * t * curr.y + t * t * p2y;
        out.push({ x: bx, y: by });
      }
      out.push({ x: p2x, y: p2y });
    }
    return out;
  }

  function roundHalfCircleBaseCorners(pts, r, segments = 6) {
    if (!Array.isArray(pts) || pts.length < 4 || !r || r <= 0) return pts;
    const n = pts.length;
    const left = pts[0];
    const right = pts[n - 1];
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const width = right.x - left.x;
    const height = left.y; // y=h
    let rTarget = Math.min(r, width / 2 - 0.01, height - 0.01);
    if (rTarget <= 0) return pts;

    // helper: find point at path distance d from index start moving forward
    const pointAtDistanceForward = (startIdx, d) => {
      let acc = 0;
      for (let i = startIdx; i < n - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const segLen = dist(a, b);
        if (acc + segLen >= d) {
          const t = (d - acc) / segLen;
          return {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            idx: i + 1,
          };
        }
        acc += segLen;
      }
      return { x: pts[n - 2].x, y: pts[n - 2].y, idx: n - 2 };
    };
    // backward
    const pointAtDistanceBackward = (startIdx, d) => {
      let acc = 0;
      for (let i = startIdx; i > 0; i--) {
        const a = pts[i];
        const b = pts[i - 1];
        const segLen = dist(a, b);
        if (acc + segLen >= d) {
          const t = (d - acc) / segLen;
          return {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            idx: i - 1,
          };
        }
        acc += segLen;
      }
      return { x: pts[1].x, y: pts[1].y, idx: 1 };
    };

    // find arc side points at distance rTarget
    const leftArcPoint = pointAtDistanceForward(0, rTarget);
    const rightArcPoint = pointAtDistanceBackward(n - 1, rTarget);

    // If arc segments too short -> reduce radius
    const leftArcLen = dist(left, leftArcPoint);
    const rightArcLen = dist(right, rightArcPoint);
    const maxAllowed = Math.min(
      leftArcLen,
      rightArcLen,
      width / 2 - 0.01,
      height - 0.01
    );
    rTarget = clamp(rTarget, 0, maxAllowed);
    if (rTarget <= 0) return pts;

    // recompute precise arc points for adjusted radius
    const leftArcP = pointAtDistanceForward(0, rTarget);
    const rightArcP = pointAtDistanceBackward(n - 1, rTarget);

    // directions
    const baseDirLeft = { x: 1, y: 0 };
    const baseDirRight = { x: -1, y: 0 };
    const arcDirLeft = (() => {
      const l = dist(left, leftArcP) || 1;
      return { x: (leftArcP.x - left.x) / l, y: (leftArcP.y - left.y) / l };
    })();
    const arcDirRight = (() => {
      const l = dist(right, rightArcP) || 1;
      return { x: (rightArcP.x - right.x) / l, y: (rightArcP.y - right.y) / l };
    })();

    const pBaseLeft = { x: left.x + baseDirLeft.x * rTarget, y: left.y };
    const pArcLeft = {
      x: left.x + arcDirLeft.x * rTarget,
      y: left.y + arcDirLeft.y * rTarget,
    };
    const pArcRight = {
      x: right.x + arcDirRight.x * rTarget,
      y: right.y + arcDirRight.y * rTarget,
    };
    const pBaseRight = { x: right.x + baseDirRight.x * rTarget, y: right.y };

    const out = [];
    // ---- Left fillet with tangent continuity ----
    // Approximate arc tangent at leftArcP using next point
    const arcLeftNextIdx = Math.min(leftArcP.idx + 1, n - 1);
    let tArcLeft = {
      x: pts[arcLeftNextIdx].x - leftArcP.x,
      y: pts[arcLeftNextIdx].y - leftArcP.y,
    };
    let lenTL = Math.hypot(tArcLeft.x, tArcLeft.y) || 1;
    tArcLeft.x /= lenTL;
    tArcLeft.y /= lenTL;
    let cpLeft; // control point
    if (Math.abs(tArcLeft.y) > 1e-3) {
      const mu = (pArcLeft.y - pBaseLeft.y) / tArcLeft.y; // along reversed direction from arc to base horizontal line
      cpLeft = { x: pArcLeft.x - tArcLeft.x * mu, y: pBaseLeft.y };
    } else {
      // Near horizontal tangent – fallback mid-point control
      cpLeft = { x: (pBaseLeft.x + pArcLeft.x) / 2, y: pBaseLeft.y };
    }
    out.push(pBaseLeft);
    for (let s = 1; s < segments; s++) {
      const t = s / segments;
      const omt = 1 - t;
      out.push({
        x:
          omt * omt * pBaseLeft.x + 2 * omt * t * cpLeft.x + t * t * pArcLeft.x,
        y:
          omt * omt * pBaseLeft.y + 2 * omt * t * cpLeft.y + t * t * pArcLeft.y,
      });
    }
    out.push(pArcLeft);

    // arc middle points (skip those within radius zone on both sides)
    // Instead of raw sampled points (які можуть бути грубими при великому радіусі) – ресемпл еліптичної дуги.
    const startIdx = leftArcP.idx;
    const endIdx = rightArcP.idx;
    const cx = (left.x + right.x) / 2;
    const cy = left.y; // центр півеліпса по Y
    const rx = (right.x - left.x) / 2;
    const ry = cy; // висота = h
    // Відновлюємо кути за формулою x = cx + rx cos θ, y = cy - ry sin θ
    const angleFromPoint = (p) => {
      const cosTheta = (p.x - cx) / rx;
      let theta = Math.acos(Math.min(1, Math.max(-1, cosTheta)));
      // гарантуємо правильний знак sin через y
      // sin θ = (cy - y)/ry >=0 для нашої півдуги
      return theta; // θ в [0, π]
    };
    let thetaLeft = angleFromPoint(pArcLeft); // близько до π -> 0
    let thetaRight = angleFromPoint(pArcRight);
    if (thetaLeft < thetaRight) {
      const tmp = thetaLeft;
      thetaLeft = thetaRight;
      thetaRight = tmp;
    }
    const angleSpan = thetaLeft - thetaRight;
    const arcSamples = Math.max(
      40,
      Math.min(1200, Math.round(angleSpan * Math.max(rx, ry) * 2))
    );
    for (let i = 1; i < arcSamples; i++) {
      const t = i / arcSamples;
      const theta = thetaLeft - angleSpan * t;
      const x = cx + rx * Math.cos(theta);
      const y = cy - ry * Math.sin(theta);
      // уникаємо додавання точки занадто близько до pArcLeft або pArcRight
      if (
        Math.hypot(x - pArcLeft.x, y - pArcLeft.y) > 0.5 &&
        Math.hypot(x - pArcRight.x, y - pArcRight.y) > 0.5
      ) {
        out.push({ x, y });
      }
    }

    // ---- Right fillet with tangent continuity ----
    const arcRightPrevIdx = Math.max(rightArcP.idx - 1, 0);
    let tArcRight = {
      x: rightArcP.x - pts[arcRightPrevIdx].x,
      y: rightArcP.y - pts[arcRightPrevIdx].y,
    };
    let lenTR = Math.hypot(tArcRight.x, tArcRight.y) || 1;
    tArcRight.x /= lenTR;
    tArcRight.y /= lenTR;
    let cpRight; // control point
    if (Math.abs(tArcRight.y) > 1e-3) {
      const mu = (pArcRight.y - pBaseRight.y) / tArcRight.y; // distance backward to horizontal line at base
      cpRight = { x: pArcRight.x - tArcRight.x * mu, y: pBaseRight.y };
    } else {
      cpRight = { x: (pArcRight.x + pBaseRight.x) / 2, y: pBaseRight.y };
    }
    // Quadratic from arc to base (maintain path order left->right)
    out.push(pArcRight);
    for (let s = 1; s < segments; s++) {
      const t = s / segments;
      const omt = 1 - t;
      out.push({
        x:
          omt * omt * pArcRight.x +
          2 * omt * t * cpRight.x +
          t * t * pBaseRight.x,
        y:
          omt * omt * pArcRight.y +
          2 * omt * t * cpRight.y +
          t * t * pBaseRight.y,
      });
    }
    out.push(pBaseRight);
    return out;
  }

  // Перетворення масиву дискретних точок у гладкий шлях з квадратичними кривими.
  // ensureClosed=true додає замикання (Z).
  function pointsToQuadraticSmoothPath(pts, ensureClosed = false) {
    if (!pts || pts.length < 2) return "";
    // Прибираємо послідовні дублі щоб уникнути Q з нульовою довжиною
    const cleaned = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const last = cleaned[cleaned.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 0.15) cleaned.push(p);
    }
    if (cleaned.length < 2) return "";
    let d = `M ${cleaned[0].x} ${cleaned[0].y}`;
    if (cleaned.length === 2) {
      d += ` L ${cleaned[1].x} ${cleaned[1].y}`;
      if (ensureClosed) d += " Z";
      return d;
    }
    for (let i = 1; i < cleaned.length - 1; i++) {
      const a = cleaned[i];
      const b = cleaned[i + 1];
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      d += ` Q ${a.x} ${a.y} ${midX} ${midY}`;
    }
    // останній сегмент до фінальної точки (щоб не втрачати її)
    const last = cleaned[cleaned.length - 1];
    d += ` L ${last.x} ${last.y}`;
    if (ensureClosed) d += " Z";
    return d;
  }

  // Перетворення множини точок у замкнений шлях із кубічних Безьє через Catmull-Rom (tension parameter)
  function pointsToClosedCatmullRomCubicPath(pts, tension = 0.5) {
    if (!pts || pts.length < 3) return "";
    // clean near-duplicates
    const cleaned = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const last = cleaned[cleaned.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 0.2) cleaned.push(p);
    }
    // ensure last not same as first
    if (
      Math.hypot(
        cleaned[0].x - cleaned[cleaned.length - 1].x,
        cleaned[0].y - cleaned[cleaned.length - 1].y
      ) < 0.2
    ) {
      cleaned.pop();
    }
    const n = cleaned.length;
    if (n < 3) return "";
    // Catmull-Rom to cubic: P0,P1,P2,P3 -> segment from P1 to P2
    const alpha = tension; // 0..1 (0 – straight lines, 0.5 – canonical, ~0.6 smoother, <0.5 tighter)
    let d = `M ${cleaned[0].x} ${cleaned[0].y}`;
    for (let i = 0; i < n; i++) {
      const p0 = cleaned[(i - 1 + n) % n];
      const p1 = cleaned[i];
      const p2 = cleaned[(i + 1) % n];
      const p3 = cleaned[(i + 2) % n];
      // Control points
      const c1x = p1.x + ((p2.x - p0.x) * alpha) / 6;
      const c1y = p1.y + ((p2.y - p0.y) * alpha) / 6;
      const c2x = p2.x - ((p3.x - p1.x) * alpha) / 6;
      const c2y = p2.y - ((p3.y - p1.y) * alpha) / 6;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    d += " Z";
    return d;
  }

  // Open Catmull-Rom -> cubic Bezier path (no wrap-around) then close with straight line between last and first.
  // This avoids wrap-induced overshoot artifacts ("зубці") at the halfCircle base corners.
  function pointsToOpenCatmullRomCubicPath(pts, tension = 0.5) {
    if (!pts || pts.length < 2) return "";
    // remove near duplicates
    const cleaned = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const last = cleaned[cleaned.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 0.2) cleaned.push(p);
    }
    if (cleaned.length < 2) return "";
    if (cleaned.length === 2) {
      const a = cleaned[0],
        b = cleaned[1];
      return `M ${a.x} ${a.y} L ${b.x} ${b.y} L ${a.x} ${a.y} Z`;
    }
    const alpha = tension;
    let d = `M ${cleaned[0].x} ${cleaned[0].y}`;
    for (let i = 0; i < cleaned.length - 1; i++) {
      const p0 = i === 0 ? cleaned[0] : cleaned[i - 1];
      const p1 = cleaned[i];
      const p2 = cleaned[i + 1];
      const p3 =
        i + 2 < cleaned.length ? cleaned[i + 2] : cleaned[cleaned.length - 1];
      const c1x = p1.x + ((p2.x - p0.x) * alpha) / 6;
      const c1y = p1.y + ((p2.y - p0.y) * alpha) / 6;
      const c2x = p2.x - ((p3.x - p1.x) * alpha) / 6;
      const c2y = p2.y - ((p3.y - p1.y) * alpha) / 6;
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
    }
    // Close with a straight base edge (assumes first & last are base endpoints for halfCircle)
    const first = cleaned[0];
    d += ` L ${first.x} ${first.y} Z`;
    return d;
  }

  // Спеціальне округлення саме для трикутника (3 точки) з плавними дугами
  const roundTriangle = (basePts, r, segments) => {
    if (!r || r <= 0 || !Array.isArray(basePts) || basePts.length !== 3)
      return basePts.map((p) => ({ x: p.x, y: p.y }));
    const n = 3;
    const seg = Math.max(4, segments || 12);
    const out = [];
    for (let i = 0; i < n; i++) {
      const prev = basePts[(i - 1 + n) % n];
      const curr = basePts[i];
      const next = basePts[(i + 1) % n];
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
      const rClamped = Math.min(r, len1 / 2, len2 / 2);
      const startX = curr.x - u1x * rClamped;
      const startY = curr.y - u1y * rClamped;
      const endX = curr.x + u2x * rClamped;
      const endY = curr.y + u2y * rClamped;
      if (
        out.length === 0 ||
        Math.hypot(
          out[out.length - 1].x - startX,
          out[out.length - 1].y - startY
        ) > 0.05
      ) {
        out.push({ x: startX, y: startY });
      }
      for (let s = 1; s <= seg; s++) {
        const t = s / (seg + 1);
        const omt = 1 - t;
        const bx = omt * omt * startX + 2 * omt * t * curr.x + t * t * endX;
        const by = omt * omt * startY + 2 * omt * t * curr.y + t * t * endY;
        out.push({ x: bx, y: by });
      }
      out.push({ x: endX, y: endY });
    }
    return out;
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

  // Оновлення товщини обводки
  const updateThickness = (value) => {
    const customThicknessPx = mmToPx(value);
    borderStateRef.current = {
      ...borderStateRef.current,
      mode: "custom",
      customThicknessPx,
      thicknessPx: customThicknessPx,
    };
    setIsBorderActive(true);

    // Пункт 3 (товщина) стосується лише внутрішніх бордерів/елементів картки, не змінює активні об'єкти
    // Якщо вже додано внутрішній бордер – оновлюємо його товщину без потреби вимикати/вмикати
    if (canvas) {
      if (currentShapeType === "circleWithLine") {
        const lineObj = canvas
          .getObjects()
          .find((o) => o.isCircleWithLineCenterLine);
        if (lineObj) {
          lineObj.set({ height: mmToPx(value) });
          lineObj.setCoords();
        }
      }
      if (currentShapeType === "circleWithCross") {
        const hLine = canvas
          .getObjects()
          .find((o) => o.isCircleWithCrossHorizontalLine);
        if (hLine) {
          hLine.set({ height: mmToPx(value) });
          hLine.setCoords();
        }
        const vLine = canvas
          .getObjects()
          .find((o) => o.isCircleWithCrossVerticalLine);
        if (vLine) {
          vLine.set({ width: mmToPx(value) });
          vLine.setCoords();
        }
      }
      ensureBorderPresence({
        mode: "default",
        thicknessPx:
          borderStateRef.current.defaultThicknessPx ??
          DEFAULT_BORDER_THICKNESS_PX,
        color: getBorderColor("default"),
      });
      ensureBorderPresence({
        mode: "custom",
        thicknessPx: customThicknessPx,
        forceRebuild: true,
      });
      // Також оновлюємо позицію текстів у circleWithLine при зміні товщини
      if (currentShapeType === "circleWithLine") {
        const diameterPx = canvas.width;
        const topText = canvas
          .getObjects()
          .find((o) => o.isCircleWithLineTopText);
        const bottomText = canvas
          .getObjects()
          .find((o) => o.isCircleWithLineBottomText);
        if (topText || bottomText) {
          const radiusMm = pxToMm(diameterPx) / 2;
          const gapMm = (radiusMm - value / 2) / 3; // value у мм (зменшений відступ)
          const centerY = canvas.height / 2;
          if (topText) {
            topText.set({ top: centerY - mmToPx(gapMm), left: diameterPx / 2 });
            topText.setCoords();
          }
          if (bottomText) {
            bottomText.set({
              top: centerY + mmToPx(gapMm),
              left: diameterPx / 2,
            });
            bottomText.setCoords();
          }
        }
      } else if (currentShapeType === "circleWithCross") {
        const diameterPx = canvas.width;
        const topText = canvas
          .getObjects()
          .find((o) => o.isCircleWithCrossTopText);
        const blText = canvas
          .getObjects()
          .find((o) => o.isCircleWithCrossBottomLeftText);
        const brText = canvas
          .getObjects()
          .find((o) => o.isCircleWithCrossBottomRightText);
        if (topText || blText || brText) {
          const radiusMm = pxToMm(diameterPx) / 2;
          const gapMm = (radiusMm - value / 2) / 3; // зменшений відступ
          const centerY = canvas.height / 2;
          const bottomY = centerY + mmToPx(gapMm);
          if (topText) {
            topText.set({ left: diameterPx / 2, top: centerY - mmToPx(gapMm) });
            topText.setCoords();
          }
          if (blText) {
            blText.set({ left: diameterPx * 0.35, top: bottomY });
            blText.setCoords();
          }
          if (brText) {
            brText.set({ left: diameterPx * 0.65, top: bottomY });
            brText.setCoords();
          }
        }
      }
      canvas.renderAll();

      // Відстежуємо зміну товщини
      trackThicknessChange(value);
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
      // Імпортуємо qrcode-generator на льоту
      const qrGenerator = (await import("qrcode-generator")).default;

      // Генеруємо QR код з новою бібліотекою
      const qr = qrGenerator(0, "M");
      qr.addData(text);
      qr.make();
      const cellSize = DEFAULT_QR_CELL_SIZE;
      const { optimizedPath, displayPath, size } = computeQrVectorData(
        qr,
        cellSize
      );

      const svg = buildQrSvgMarkup({
        size,
        displayPath,
        optimizedPath,
        strokeColor: foregroundColor,
      });

      // Завантажуємо SVG в Fabric
      const result = await fabric.loadSVGFromString(svg);
      let newObj;
      if (result?.objects?.length === 1) {
        newObj = result.objects[0];
      } else {
        newObj = fabric.util.groupSVGElements(
          result.objects || [],
          result.options || {}
        );
      }

      decorateQrGroup(newObj);

      // Зберігаємо властивості оригінального об'єкта
      newObj.set({
        left: qrObj.left,
        top: qrObj.top,
        scaleX: qrObj.scaleX,
        scaleY: qrObj.scaleY,
        angle: qrObj.angle,
        originX: qrObj.originX,
        originY: qrObj.originY,
        isQRCode: true,
        qrText: text,
        qrSize: size || qrObj.qrSize || newObj.width || 0,
        selectable: true,
        hasControls: true,
        hasBorders: true,
        backgroundColor: "transparent",
      });

      // Замінюємо старий об'єкт новим
      const index = canvas.getObjects().indexOf(qrObj);
      if (index !== -1) {
        canvas.remove(qrObj);
        canvas.insertAt(newObj, index);
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
      if (!canvas || !barObj) return;
      const codeType = barObj.barCodeType || "CODE128";
      // Генеруємо SVG напряму (як при створенні) замість растрового canvas -> FabricImage
      const svgEl = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      JsBarcode(svgEl, text || barObj.barCodeText || "", {
        format: codeType,
        width: 2,
        height: 100,
        displayValue: false,
        background: "transparent",
        lineColor: foregroundColor,
        margin: 0,
      });
      const serializer = new XMLSerializer();
      const svgText = serializer.serializeToString(svgEl);
      const result = await fabric.loadSVGFromString(svgText);
      let newImg;
      if (result?.objects?.length === 1) newImg = result.objects[0];
      else
        newImg = fabric.util.groupSVGElements(
          result.objects || [],
          result.options || {}
        );
      if (!newImg) return;
      newImg.set({
        left: barObj.left,
        top: barObj.top,
        scaleX: barObj.scaleX,
        scaleY: barObj.scaleY,
        angle: barObj.angle,
        originX: barObj.originX || "center",
        originY: barObj.originY || "center",
        selectable: true,
        hasControls: true,
        hasBorders: true,
        isBarCode: true,
        barCodeText: text,
        barCodeType: codeType,
        suppressBarText: true,
        fill: foregroundColor,
        barCodeColor: foregroundColor,
      });

      // Мінімальна ширина 30мм: коригуємо масштаб, якщо поточна менша
      try {
        const minPx = mmToPx(30);
        const currentWidth =
          typeof newImg.getScaledWidth === "function"
            ? newImg.getScaledWidth()
            : (newImg.width || 0) * (newImg.scaleX || 1);
        if (currentWidth > 0 && currentWidth < minPx) {
          const factor = minPx / currentWidth;
          newImg.scaleX *= factor;
          newImg.scaleY *= factor;
        }
        if (typeof newImg.setCoords === "function") newImg.setCoords();
      } catch (enforceErr) {
        console.warn(
          "Не вдалося застосувати мінімальну ширину для бар-коду:",
          enforceErr
        );
      }

      // Замінюємо старий об'єкт новим
      const index = canvas.getObjects().indexOf(barObj);
      if (index !== -1) {
        canvas.remove(barObj);
        canvas.insertAt(newImg, index);
        try {
          if (typeof newImg.setCoords === "function") newImg.setCoords();
        } catch {}
        try {
          canvas.setActiveObject(newImg);
        } catch {}
        try {
          canvas.requestRenderAll();
        } catch {}
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

    // Змінюємо колір всіх об'єктів на canvas, з урахуванням manual Cut
    const objects = canvas.getObjects();

    objects.forEach((obj) => {
      if (obj.isBorderShape) {
        const mode = obj.cardBorderMode === "custom" ? "custom" : "default";
        const displayStroke = getBorderColor(mode);
        const exportStroke =
          mode === "custom" ? CUSTOM_BORDER_EXPORT_COLOR : displayStroke;
        const exportFillValue =
          mode === "custom"
            ? "none"
            : obj.cardBorderExportFill || obj.fill || "transparent";

        obj.set({
          stroke: displayStroke,
          fill: "transparent",
          cardBorderDisplayStrokeColor: displayStroke,
          cardBorderExportStrokeColor: exportStroke,
          cardBorderExportFill: exportFillValue,
        });
        return;
      }
      // Cut елементи (manual): stroke = ORANGE, fill = білий (зберігаємо як раніше)
      if (obj.isCutElement && obj.cutType === "manual") {
        obj.set({ stroke: "#FD7714", fill: "#FFFFFF" });
        return;
      }

      // Cut елементи з вкладки CUT (тип "shape"): завжди біла заливка і оранжевий бордер
      if (obj.isCutElement && obj.cutType === "shape") {
        obj.set({ stroke: "#FD7714", fill: "#FFFFFF" });
        // Заборонити застосування темного кольору випадково
        if (obj.useThemeColor) obj.useThemeColor = false;
        return;
      }

      if (
        obj.type === "i-text" ||
        obj.type === "text" ||
        obj.type === "textbox"
      ) {
        obj.set({ fill: textColor });
      } else if (
        obj.type === "rect" ||
        obj.type === "circle" ||
        obj.type === "ellipse" ||
        obj.type === "triangle" ||
        obj.type === "polygon" ||
        obj.type === "path"
      ) {
        const isTransparent =
          obj.fill === "transparent" ||
          obj.fill === "" ||
          obj.fill === null ||
          typeof obj.fill === "undefined";
        const usesThemeColor = obj.useThemeColor === true;
        const followThemeStroke = obj.followThemeStroke !== false;

        if (isTransparent) {
          obj.set({ fill: "transparent" });
        } else if (usesThemeColor) {
          obj.set({ fill: textColor });
        } else if (
          typeof obj.initialFillColor === "string" &&
          obj.initialFillColor !== "" &&
          obj.initialFillColor !== "transparent" &&
          obj.fill !== obj.initialFillColor
        ) {
          obj.set({ fill: obj.initialFillColor });
        }

        if (usesThemeColor || followThemeStroke) {
          obj.set({ stroke: textColor });
        } else if (typeof obj.initialStrokeColor === "string") {
          obj.set({ stroke: obj.initialStrokeColor });
        }
      } else if (obj.type === "circle-with-cut") {
        const isTransparent =
          obj.fill === "transparent" ||
          obj.fill === "" ||
          obj.fill === null ||
          typeof obj.fill === "undefined";
        const usesThemeColor = obj.useThemeColor === true;
        const followThemeStroke = obj.followThemeStroke !== false;

        if (isTransparent) {
          obj.set({ fill: "transparent" });
        } else if (usesThemeColor) {
          obj.set({ fill: textColor });
        } else if (
          typeof obj.initialFillColor === "string" &&
          obj.initialFillColor !== "" &&
          obj.initialFillColor !== "transparent" &&
          obj.fill !== obj.initialFillColor
        ) {
          obj.set({ fill: obj.initialFillColor });
        }

        if (usesThemeColor || followThemeStroke) {
          obj.set({ stroke: textColor });
        } else if (typeof obj.initialStrokeColor === "string") {
          obj.set({ stroke: obj.initialStrokeColor });
        }
      } else if (obj.type === "line") {
        obj.set({ stroke: textColor });
      }
      // QR та Bar коди залишаємо без змін - вони будуть використовувати нові кольори при створенні
    });

    // Тимчасово відключено автоперегенерацію BarCode при зміні схеми щоб уникнути помилок Fabric
    // Якщо потрібно оновити кольори смуг — можна зробити окрему кнопку чи відкладену регенерацію

    // Встановлюємо фон canvas
    if (backgroundType === "solid") {
      canvas.set("backgroundColor", backgroundColor);
      canvas.set("backgroundTextureUrl", null);
      canvas.set("backgroundType", "solid");
      canvas.renderAll();
      trackColorThemeChange({ textColor, backgroundColor, backgroundType });
    } else if (backgroundType === "gradient") {
      // Місце для градієнта - буде реалізовано пізніше
      canvas.set("backgroundColor", backgroundColor); // Тимчасово використовуємо solid color
      canvas.set("backgroundTextureUrl", null);
      canvas.set("backgroundType", "gradient");
      canvas.renderAll();
      trackColorThemeChange({ textColor, backgroundColor, backgroundType });
    } else if (backgroundType === "texture") {
      // Завантажуємо текстуру
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          // Обраховуємо масштаб як відношення canvas до зображення
          // Зменшуємо у 4 рази для повторення текстури
          const scaleX = canvas.width / img.width;
          const scaleY = canvas.height / img.height;

          // Створюємо canvas для масштабування текстури
          const patternCanvas = document.createElement("canvas");
          const ctx = patternCanvas.getContext("2d");

          patternCanvas.width = img.width * scaleX;
          patternCanvas.height = img.height * scaleY;

          // Малюємо масштабоване зображення
          ctx.drawImage(img, 0, 0, patternCanvas.width, patternCanvas.height);

          const pattern = new fabric.Pattern({
            source: patternCanvas,
            repeat: "no-repeat", // не дублюємо текстуру
          });

          // Зберігаємо оригінальний URL текстури для серіалізації
          canvas.set("backgroundColor", pattern);
          canvas.set("backgroundTextureUrl", backgroundColor);
          canvas.set("backgroundType", "texture");
          canvas.renderAll();
        } catch (error) {
          console.error("Error creating texture pattern:", error);
          canvas.set("backgroundColor", backgroundColor);
          canvas.renderAll();
        }
      };
      img.onerror = () => {
        console.error("Error loading texture image:", backgroundColor);
        canvas.set("backgroundColor", "#FFFFFF");
        canvas.renderAll();
      };
      img.src = backgroundColor;
      trackColorThemeChange({ textColor, backgroundColor, backgroundType });
    }
  };

  // Запобігаємо повторному застосуванню вже активної схеми
  const handleColorPick = (idx, textColor, bgColor, type = "solid") => {
    if (selectedColorIndex === idx) return; // нічого не робимо якщо вже вибрано
    updateColorScheme(textColor, bgColor, type, idx);
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
        fontSize: mmToPx(5),
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      // Запускаем редактирование единообразно через copyHandler без дополнительных таймеров/дублирования
      // Небольшая задержка кадра нужна, чтобы объект стал активным и имел корректные coords
      requestAnimationFrame(() => {
        try {
          if (typeof copyHandler === "function") {
            copyHandler(null, { target: text });
          } else if (typeof text.enterEditing === "function") {
            text.enterEditing();
          }
        } catch {}
      });
      canvas.renderAll();
      trackElementAdded("Text");
    }
  };

  // Додавання зображення через IconMenu
  const addImage = () => {
    setIsIconMenuOpen(true);
  };

  // Upload preview modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState("raster"); // 'raster' | 'svg'
  const [uploadDataURL, setUploadDataURL] = useState("");
  const [uploadSvgText, setUploadSvgText] = useState("");

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
      if (file.size > 6 * 1024 * 1024) {
        alert("Файл занадто великий. Максимальний розмір: 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        let addedOk = false; // track if we successfully added any object
        try {
          // Перевіряємо чи це SVG файл
          if (
            file.type === "image/svg+xml" ||
            file.name.toLowerCase().endsWith(".svg")
          ) {
            // For preview flow: open modal with original SVG (no immediate add)
            const raw = String(event.target.result || "");
            setUploadMode("svg");
            setUploadSvgText(raw);
            setUploadDataURL("");
            setIsUploadOpen(true);
            return; // defer adding until confirm
          } else {
            // Raster: open modal with dataURL, preview will vectorize live
            const raw = String(event.target.result || "");
            setUploadMode("raster");
            setUploadDataURL(raw);
            setUploadSvgText("");
            setIsUploadOpen(true);
            return; // defer adding until confirm
          }
        } catch (error) {
          console.error("Помилка завантаження зображення:", error);
          // Прибираємо сповіщення про помилку за новою логікою
        }
      };
      reader.onerror = () => {
        // Без сповіщень — просто лог
        console.error("Помилка завантаження файлу");
      };
      reader.readAsDataURL(file);
    }

    // Очищаємо input після завантаження
    e.target.value = "";
  };

  const addBorder = () => {
    if (!canvas) return;

    const currentBg = canvas.backgroundColor || canvas.get("backgroundColor");
    if (!currentBg || currentBg === "transparent") {
      const fallbackBg =
        (globalColors && globalColors.backgroundColor) || "#FFFFFF";
      canvas.set("backgroundColor", fallbackBg);
    }

    const customBorders =
      canvas
        ?.getObjects?.()
        ?.filter(
          (obj) => obj.isBorderShape && obj.cardBorderMode === "custom"
        ) || [];

    if (customBorders.length > 0) {
      customBorders.forEach((borderShape) => canvas.remove(borderShape));
      borderStateRef.current = {
        ...borderStateRef.current,
        mode: "default",
        thicknessPx:
          borderStateRef.current.defaultThicknessPx ??
          DEFAULT_BORDER_THICKNESS_PX,
      };
      ensureBorderPresence({
        mode: "default",
        thicknessPx:
          borderStateRef.current.defaultThicknessPx ??
          DEFAULT_BORDER_THICKNESS_PX,
        color: getBorderColor("default"),
        forceRebuild: true,
      });
      canvas.requestRenderAll();
      setIsBorderActive(false);
      trackBorderChange?.(false);
      return;
    }

    ensureBorderPresence({
      mode: "default",
      thicknessPx:
        borderStateRef.current.defaultThicknessPx ??
        DEFAULT_BORDER_THICKNESS_PX,
      color: getBorderColor("default"),
    });

    const storedCustomPx =
      borderStateRef.current.customThicknessPx ?? mmToPx(thickness);

    const border = ensureBorderPresence({
      mode: "custom",
      thicknessPx: storedCustomPx,
      color: getBorderColor("custom"),
      forceRebuild: true,
    });

    if (border) {
      borderStateRef.current = {
        ...borderStateRef.current,
        mode: "custom",
        thicknessPx: storedCustomPx,
        customThicknessPx: storedCustomPx,
      };
      setIsBorderActive(true);
      trackBorderChange?.(true);
    }
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
        } catch {}
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
    const { maxMm, minMm } = getFigureDimsMm();
    const d = Math.max(holesDiameter || 0, 0.1);
    let additive = 4.8 - 18 / d; // зменшується при збільшенні діаметра
    if (!isFinite(additive)) additive = 0;
    additive = Math.max(0.8, Math.min(additive, 3.2));
    const base = 0.03 * (maxMm || 0);
    let offsetMm = Math.min(base + additive, 7.5);
    // Мінімальна відстань від краю дирки до краю фігури: 2мм
    // Тобто offset >= 2мм + радіус дирки
    const minOffsetMm = 2 + (d || 0.1) / 2;
    // Максимальний відступ: дирка не повинна заходити далі центру (для дуже великих дирок)
    const maxOffsetMm = Math.max(0, minMm - (d || 0.1) / 2);
    offsetMm = Math.max(offsetMm, minOffsetMm);
    offsetMm = Math.min(offsetMm, maxOffsetMm);
    return mmToPx(offsetMm);
  };

  // Фіксований відступ для прямокутних (квадратних) отворів — 2 мм
  const getRectHoleOffsetPx = () => mmToPx(2);

  const registerHoleShape = (shape) => {
    if (!shape) return shape;
    try {
      if (typeof shape.set === "function") {
        shape.set({
          stroke: CUT_STROKE_COLOR,
          fill: shape.fill || HOLE_FILL_COLOR,
          isCutElement: true,
          cutType: "hole",
          preventThemeRecolor: true,
          id: "canvaShape",
        });
      } else {
        shape.stroke = CUT_STROKE_COLOR;
        shape.fill = shape.fill || HOLE_FILL_COLOR;
        shape.isCutElement = true;
        shape.cutType = "hole";
        shape.preventThemeRecolor = true;
        shape.id = "canvaShape";
      }
      // ensureShapeSvgId(shape, canvas, { prefix: HOLE_ID_PREFIX });
    } catch (error) {
      console.warn("Не вдалося призначити hole ID", error);
    }
    return shape;
  };

  const createLockHoleCircle = () => {
    if (!canvas) return null;
    const canvasWidth = canvas.getWidth?.() || canvas.width || 0;
    const semicircleRadiusPx = mmToPx(LOCK_ARCH_HEIGHT_MM);
    const chordY = semicircleRadiusPx;
    const holeRadiusPx = mmToPx((holesDiameter || 2.5) / 2);
    const minTopGapPx = mmToPx(MIN_LOCK_HOLE_TOP_GAP_MM);
    const extraAllowancePx = mmToPx(LOCK_HOLE_EXTRA_DOWN_MM);
    const baseCenterY = semicircleRadiusPx / 2;
    const desiredCenterY = Math.max(baseCenterY, holeRadiusPx + minTopGapPx);
    const canvasHeightPx = canvas.getHeight?.() || canvas.height || 0;
    let maxCenterY = chordY - holeRadiusPx;
    if (extraAllowancePx > 0) maxCenterY += extraAllowancePx;
    if (canvasHeightPx) {
      maxCenterY = Math.min(maxCenterY, canvasHeightPx - holeRadiusPx);
    }
    let semiCenterY = desiredCenterY;
    if (Number.isFinite(maxCenterY)) {
      semiCenterY = Math.min(semiCenterY, maxCenterY);
    }
    semiCenterY = Math.max(holeRadiusPx, semiCenterY);

    return registerHoleShape(
      new fabric.Circle({
        left: canvasWidth / 2,
        top: semiCenterY,
        radius: holeRadiusPx,
        fill: HOLE_FILL_COLOR,
        stroke: CUT_STROKE_COLOR,
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true,
        cutType: "hole",
        preventThemeRecolor: true,
        hasControls: false,
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: false,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      })
    );
  };

  // Тип 1 - без отворів (по дефолту)
  const addHoleType1 = () => {
    if (!canvas) return;
    clearExistingHoles();
    setIsHolesSelected(false);
    setActiveHolesType(1);

    // Відстежуємо зміну отворів
    trackHolesChange(1, holesDiameter);
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

  // Скинути отвори до стану "No holes" і підсвітити першу іконку
  const resetHolesToNone = () => {
    clearExistingHoles();
    setIsHolesSelected(false);
    setActiveHolesType(1);
  };

  // Тип 2 - отвір по центру ширини і зверху по висоті (відступ ~4мм)
  const addHoleType2 = () => {
    if (!canvas) return;
    clearExistingHoles();
    setIsHolesSelected(true);
    setActiveHolesType(2);

    if (currentShapeType === "lock") {
      const hole = createLockHoleCircle();
      if (hole) {
        try {
          const topGapMm = pxToMm((hole.top || 0) - (hole.radius || 0));
          console.log(
            `Відступ отвору зверху: ${topGapMm.toFixed(
              2
            )} мм (lock, Ø ${holesDiameter} мм)`
          );
        } catch {}
        canvas.add(hole);
        canvas.renderAll();
      }
      return;
    }

    const canvasWidth = canvas.getWidth();
    const offsetPx = getHoleOffsetPx();
    try {
      console.log(
        `Відступ отворів: ${pxToMm(offsetPx).toFixed(
          2
        )} мм (тип 2, Ø ${holesDiameter} мм)`
      );
    } catch {}
    const hole = registerHoleShape(
      new fabric.Circle({
        left: canvasWidth / 2,
        top: offsetPx,
        radius: mmToPx((holesDiameter || 2.5) / 2),
        fill: HOLE_FILL_COLOR, // Білий фон дирки
        stroke: CUT_STROKE_COLOR, // Оранжевий бордер
        strokeWidth: 1, // 1px
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: "hole", // Додаємо тип cut елементу
        preventThemeRecolor: true,
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
      })
    );
    canvas.add(hole);
    canvas.renderAll();
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
      } catch {}

      // Лівий отвір
      const leftHole = registerHoleShape(
        new fabric.Circle({
          left: offsetPx,
          top: canvasHeight / 2,
          radius: mmToPx((holesDiameter || 2.5) / 2),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: "center",
          originY: "center",
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: "hole", // Додаємо тип cut елементу
          preventThemeRecolor: true,
          hasControls: false, // Забороняємо зміну розміру
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
        })
      );

      // Правий отвір
      const rightHole = registerHoleShape(
        new fabric.Circle({
          left: canvasWidth - offsetPx,
          top: canvasHeight / 2,
          radius: mmToPx((holesDiameter || 2.5) / 2),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: "center",
          originY: "center",
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: "hole", // Додаємо тип cut елементу
          preventThemeRecolor: true,
          hasControls: false, // Забороняємо зміну розміру
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
        })
      );

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
      } catch {}

      // Верхній лівий
      const topLeft = registerHoleShape(
        new fabric.Circle({
          left: offsetPx,
          top: offsetPx,
          radius: mmToPx((holesDiameter || 2.5) / 2),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: "center",
          originY: "center",
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: "hole", // Додаємо тип cut елементу
          preventThemeRecolor: true,
          hasControls: false, // Забороняємо зміну розміру
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
        })
      );

      // Верхній правий
      const topRight = registerHoleShape(
        new fabric.Circle({
          left: canvasWidth - offsetPx,
          top: offsetPx,
          radius: mmToPx((holesDiameter || 2.5) / 2),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: "center",
          originY: "center",
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: "hole", // Додаємо тип cut елементу
          preventThemeRecolor: true,
          hasControls: false, // Забороняємо зміну розміру
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
        })
      );

      // Нижній лівий
      const bottomLeft = registerHoleShape(
        new fabric.Circle({
          left: offsetPx,
          top: canvasHeight - offsetPx,
          radius: mmToPx((holesDiameter || 2.5) / 2),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: "center",
          originY: "center",
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: "hole", // Додаємо тип cut елементу
          preventThemeRecolor: true,
          hasControls: false, // Забороняємо зміну розміру
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
        })
      );

      // Нижній правий
      const bottomRight = registerHoleShape(
        new fabric.Circle({
          left: canvasWidth - offsetPx,
          top: canvasHeight - offsetPx,
          radius: mmToPx((holesDiameter || 2.5) / 2),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: "center",
          originY: "center",
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: "hole", // Додаємо тип cut елементу
          preventThemeRecolor: true,
          hasControls: false, // Забороняємо зміну розміру
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
        })
      );

      canvas.add(topLeft);
      canvas.add(topRight);
      canvas.add(bottomLeft);
      canvas.add(bottomRight);
      canvas.renderAll();
    }
  };

  // Тип 5 - 4 ПРЯМОКУТНІ отвори 5x2мм у кутах (відступи від країв: X=3мм, Y=2мм)
  const addHoleType5 = () => {
    if (!canvas) return;
    clearExistingHoles();
    setIsHolesSelected(true);
    setActiveHolesType(5);
    const holeWmm = 5;
    const holeHmm = 2;
    const offXmm = 3; // до лівого/правого краю
    const offYmm = 2; // до верху/низу
    const wPx = canvas.getWidth();
    const hPx = canvas.getHeight();
    const toPx = (mm) => mmToPx(mm);
    const cxLeft = toPx(offXmm + holeWmm / 2);
    const cxRight = wPx - toPx(offXmm + holeWmm / 2);
    const cyTop = toPx(offYmm + holeHmm / 2);
    const cyBottom = hPx - toPx(offYmm + holeHmm / 2);
    const hwPx = toPx(holeWmm);
    const hhPx = toPx(holeHmm);
    const makeRect = (left, top) =>
      registerHoleShape(
        new fabric.Rect({
          left,
          top,
          width: hwPx,
          height: hhPx,
          originX: "center",
          originY: "center",
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          isCutElement: true,
          cutType: "hole",
          preventThemeRecolor: true,
          holeType5Rect: true,
          hasControls: false,
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: false,
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
        })
      );
    const r1 = makeRect(cxLeft, cyTop);
    const r2 = makeRect(cxRight, cyTop);
    const r3 = makeRect(cxLeft, cyBottom);
    const r4 = makeRect(cxRight, cyBottom);
    canvas.add(r1, r2, r3, r4);
    canvas.requestRenderAll();
    try {
      console.log(
        `Тип5: 4 прямокутні 5x2мм. Центри X(left/right)=${
          offXmm + holeWmm / 2
        }мм / ${pxToMm(wPx) - (offXmm + holeWmm / 2)}мм, Y(top/bottom)=${
          offYmm + holeHmm / 2
        }мм / ${pxToMm(hPx) - (offYmm + holeHmm / 2)}мм`
      );
    } catch {}
  };

  // Тип 6 - 4 прямокутні отвори: фіксовано ширина 5мм, висота 2мм
  // Відступи: зліва/справа 3мм (по центру прямокутника), зверху/знизу 2мм
  const addHoleType6 = () => {
    if (!canvas) return;
    clearExistingHoles();
    setIsHolesSelected(true);
    setActiveHolesType(6);
    const wCanvasPx = canvas.getWidth();
    const hCanvasPx = canvas.getHeight();
    // Діаметр дирки в мм
    const diameterMm = holesDiameter || 3;
    const diameterPx = mmToPx(diameterMm);
    // Динамічний відступ як у 7-ї дирки
    const offsetPx = getHoleOffsetPx();
    const centerY = hCanvasPx / 2;
    const hole = registerHoleShape(
      new fabric.Circle({
        left: offsetPx,
        top: centerY,
        radius: diameterPx / 2,
        fill: HOLE_FILL_COLOR,
        stroke: CUT_STROKE_COLOR,
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true,
        cutType: "hole",
        preventThemeRecolor: true,
        hasControls: false,
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
      })
    );
    canvas.add(hole);
    hole.setCoords();
    try {
      console.log(
        `Type6 hole: center=(${pxToMm(offsetPx).toFixed(2)}mm, ${pxToMm(
          centerY
        ).toFixed(2)}mm) diameter=${diameterMm}mm (px ${diameterPx.toFixed(2)})`
      );
    } catch {}
    canvas.requestRenderAll();
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
      } catch {}

      const rightHole = registerHoleShape(
        new fabric.Circle({
          left: canvasWidth - offsetPx,
          top: canvasHeight / 2,
          radius: mmToPx((holesDiameter || 3) / 2),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: "center",
          originY: "center",
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: "hole", // Додаємо тип cut елементу
          preventThemeRecolor: true,
          hasControls: false, // Забороняємо зміну розміру
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          selectable: false,
          evented: false,
          lockMovementX: true,
          lockMovementY: true,
        })
      );

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

          // Допоміжна: логічний розмір canvas без масштабу
          const getLogicalCanvasSize = () => {
            if (!canvas) return { width: 0, height: 0 };
            const zoom =
              typeof canvas.getZoom === "function" ? canvas.getZoom() : 1;
            return {
              width: Math.round(canvas.getWidth() / (zoom || 1)),
              height: Math.round(canvas.getHeight() / (zoom || 1)),
            };
          };
          // --- end helper ---
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
    setSizeValues((prev) => ({ ...prev, cornerRadius: 0 }));
  };

  // Helper: встановлення типу фігури (локально + на canvas для збереження в БД)
  const setShapeType = (type) => {
    setCurrentShapeType(type);
    if (canvas) {
      canvas.set("shapeType", type);
    }
  };

  // Icon0 - Прямокутник (задає форму canvas)
  const addRectangle = () => {
    if (canvas) {
      resetCornerRadiusState();
      setIsCustomShapeApplied(false);
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setShapeType("rectangle");

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

      // Скидаємо отвори до No holes
      resetHolesToNone();

      // Відстежуємо зміну форми полотна
      trackShapeChange("rectangle");
    }
  };

  // Icon1 - Коло (задає форму canvas)
  const addCircle = () => {
    if (canvas) {
      resetCornerRadiusState();
      setIsCustomShapeApplied(false);
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setShapeType("circle");

      // УНІФІКУЄМО: створення через той самий пайплайн, що й ресайз (updateSize)
      const width = 100; // mm
      const height = 100; // mm
      setSizeValues((prev) => ({ ...prev, width, height, cornerRadius: 0 }));
      updateSize({ widthMm: width, heightMm: height, cornerRadiusMm: 0 });

      // Скидаємо отвори до No holes
      resetHolesToNone();
    }
  };

  // Icon2 - Еліпс (задає форму canvas)
  const addEllipse = () => {
    if (canvas) {
      resetCornerRadiusState();
      setIsCustomShapeApplied(false);
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setShapeType("ellipse");

      // УНІФІКУЄМО: створення через той самий пайплайн, що й ресайз (updateSize)
      const width = 140; // mm
      const height = 80; // mm
      setSizeValues((prev) => ({ ...prev, width, height, cornerRadius: 0 }));
      updateSize({ widthMm: width, heightMm: height, cornerRadiusMm: 0 });

      // Скидаємо отвори до No holes
      resetHolesToNone();
    }
  };

  // Icon3 - Замок (задає форму canvas)
  const addLock = () => {
    if (canvas) {
      // Якщо вже активна форма lock і є отвір типу 2 (верхній) — просто ігноруємо повторне створення
      if (
        currentShapeType === "lock" &&
        isHolesSelected &&
        activeHolesType === 2
      ) {
        return; // залишаємо існуючу дирку
      }
      resetCornerRadiusState();
      setIsCustomShapeApplied(false);
      // Очищуємо canvas з збереженням теми
      clearCanvasPreserveTheme();

      // Встановлюємо тип поточної фігури
      setShapeType("lock");

      // Нові розміри (залишимо 100x90 мм загальна висота включно з півкругом)
      const totalHeightMM = 90; // загальна висота
      const widthMM = 100;
      const halfCircleRadiusMM = 8; // висота півкруга та мінус від прямокутника
      const rectHeightMM = totalHeightMM - halfCircleRadiusMM; // прямокутна частина
      const wPx = mmToPx(widthMM);
      const totalHPx = mmToPx(totalHeightMM);
      canvas.setDimensions({ width: wPx, height: totalHPx });

      // Генеруємо полігон: напівколо зверху по центру + прямокутник
      const buildLockPoints = () => {
        const rPx = mmToPx(halfCircleRadiusMM); // радіус = 8мм
        const rectTopY = rPx; // хорда напівкола
        const rectBottomY = mmToPx(rectHeightMM) + rPx;
        const cx = wPx / 2;
        const radiusX = mmToPx(16) / 2; // 8мм
        const radiusY = rPx; // 8мм
        const leftArcX = cx - radiusX;
        const rightArcX = cx + radiusX;
        const pts = [];
        // Ліва точка хорди
        pts.push({ x: leftArcX, y: rectTopY });
        const steps = 60; // smoother semicircle sampling
        for (let i = 1; i < steps - 1; i++) {
          // внутрішні точки дуги
          const t = i / (steps - 1); // 0..1
          const angle = Math.PI + Math.PI * t; // π .. 2π
          const x = cx + radiusX * Math.cos(angle);
          const y = rectTopY + radiusY * Math.sin(angle); // центр (cx, rectTopY)
          pts.push({ x, y });
        }
        // Права точка хорди
        pts.push({ x: rightArcX, y: rectTopY });
        const cornerRadiusPx = mmToPx(sizeValues.cornerRadius || 0);
        const baseCr = Math.min(
          cornerRadiusPx,
          rectBottomY - rectTopY,
          wPx / 2
        );
        const topSideLen = wPx - rightArcX; // від правого краю дуги до правого краю прямокутника
        const crTop = Math.min(baseCr, topSideLen);
        const crBottom = baseCr;
        const cornerSegs =
          baseCr > 0 ? Math.max(10, Math.round(baseCr / 2)) : 0;
        // ---- Top-right corner ----
        if (crTop > 0) {
          pts.push({ x: wPx - crTop, y: rectTopY });
          const cxTR = wPx - crTop;
          const cyTR = rectTopY + crTop;
          for (let i = 0; i <= cornerSegs; i++) {
            const theta = (3 * Math.PI) / 2 + (Math.PI / 2) * (i / cornerSegs); // 270->360°
            pts.push({
              x: cxTR + crTop * Math.cos(theta),
              y: cyTR + crTop * Math.sin(theta),
            });
          }
        } else {
          pts.push({ x: wPx, y: rectTopY });
        }
        // ---- Right side + bottom-right ----
        if (crBottom > 0) {
          pts.push({ x: wPx, y: rectBottomY - crBottom });
          const cxBR = wPx - crBottom;
          const cyBR = rectBottomY - crBottom;
          for (let i = 0; i <= cornerSegs; i++) {
            const theta = 0 + (Math.PI / 2) * (i / cornerSegs); // 0->90°
            pts.push({
              x: cxBR + crBottom * Math.cos(theta),
              y: cyBR + crBottom * Math.sin(theta),
            });
          }
        } else {
          pts.push({ x: wPx, y: rectBottomY });
        }
        // ---- Bottom edge + bottom-left ----
        if (crBottom > 0) {
          pts.push({ x: crBottom, y: rectBottomY });
          const cxBL = crBottom;
          const cyBL = rectBottomY - crBottom;
          for (let i = 0; i <= cornerSegs; i++) {
            const theta = Math.PI / 2 + (Math.PI / 2) * (i / cornerSegs); // 90->180°
            pts.push({
              x: cxBL + crBottom * Math.cos(theta),
              y: cyBL + crBottom * Math.sin(theta),
            });
          }
        } else {
          pts.push({ x: 0, y: rectBottomY });
        }
        // ---- Left side + top-left ----
        if (crTop > 0) {
          pts.push({ x: 0, y: rectTopY + crTop });
          const cxTL = crTop;
          const cyTL = rectTopY + crTop;
          for (let i = 0; i <= cornerSegs; i++) {
            const theta = Math.PI + (Math.PI / 2) * (i / cornerSegs); // 180->270°
            pts.push({
              x: cxTL + crTop * Math.cos(theta),
              y: cyTL + crTop * Math.sin(theta),
            });
          }
          // Повертаємось до початку півкола
          pts.push({ x: leftArcX, y: rectTopY });
        } else {
          pts.push({ x: 0, y: rectTopY });
        }
        return pts;
      };

      const clipPath = new fabric.Polygon(buildLockPoints(), {
        absolutePositioned: true,
      });
      canvas.clipPath = clipPath;

      // Оновлюємо state розмірів
      setSizeValues((prev) => ({
        ...prev,
        width: widthMM,
        height: totalHeightMM,
        cornerRadius: 0,
      }));

      updateCanvasOutline();
      canvas.renderAll();

      // Скидаємо отвори до No holes
      // Але якщо це повторний виклик і до цього вже був lock із отвором типу 2 — не чіпаємо
      if (
        !(
          currentShapeType === "lock" &&
          isHolesSelected &&
          activeHolesType === 2
        )
      ) {
        resetHolesToNone();
      }
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
      setSizeValues((prev) => ({
        ...prev,
        width: 100,
        height: 100,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      // Додаємо горизонтальну лінію по центру (65% ширини кола)
      const diameterMm = 100;
      const lineWidthMm = diameterMm * 0.65;
      const lineThicknessMm = thickness; // поточний state товщини у мм
      const centerLine = new fabric.Rect({
        left: mmToPx(100) / 2,
        top: mmToPx(100) / 2,
        originX: "center",
        originY: "center",
        width: mmToPx(lineWidthMm),
        height: mmToPx(lineThicknessMm),
        fill: globalColors?.textColor || "#000",
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        lockSkewingX: true,
        lockSkewingY: true,
        hoverCursor: "default",
        moveCursor: "default",
        strokeUniform: true,
        isCircleWithLineCenterLine: true,
      });
      canvas.add(centerLine);

      // Заготовки тексту над і під лінією
      const radiusMm = diameterMm / 2;
      const gapMm = (radiusMm - lineThicknessMm / 2) / 6; // еще меньший отступ для компактности
      const topY = mmToPx(100) / 2 - mmToPx(gapMm);
      const bottomY = mmToPx(100) / 2 + mmToPx(gapMm);
      const commonText = {
        fontSize: mmToPx(5),
        fontFamily: "Arial",
        fill: globalColors?.textColor || "#000",
        originX: "center",
        originY: "center",
        textAlign: "center",
        selectable: true,
        editable: true,
      };
      const topText = new fabric.IText("TEXT TOP", {
        left: mmToPx(100) / 2,
        top: topY,
        ...commonText,
        isCircleWithLineTopText: true,
      });
      const bottomText = new fabric.IText("TEXT BOTTOM", {
        left: mmToPx(100) / 2,
        top: bottomY,
        ...commonText,
        isCircleWithLineBottomText: true,
      });
      // Якорі для пропорційного масштабування шрифту при зміні розміру картки
      topText.__fontAnchorW = canvas.width;
      topText.__fontAnchorH = canvas.height;
      bottomText.__fontAnchorW = canvas.width;
      bottomText.__fontAnchorH = canvas.height;
      canvas.add(topText, bottomText);
      canvas.sendObjectToBack(centerLine);

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
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
      setSizeValues((prev) => ({
        ...prev,
        width: 100,
        height: 100,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      // Додаємо горизонтальну лінію (як у icon4)
      const diameterMm = 100;
      const lineWidthMm = diameterMm * 0.65;
      const lineThicknessMm = thickness; // поточна товщина
      const hLine = new fabric.Rect({
        left: mmToPx(100) / 2,
        top: mmToPx(100) / 2,
        originX: "center",
        originY: "center",
        width: mmToPx(lineWidthMm),
        height: mmToPx(lineThicknessMm),
        fill: globalColors?.textColor || "#000",
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        lockSkewingX: true,
        lockSkewingY: true,
        hoverCursor: "default",
        moveCursor: "default",
        strokeUniform: true,
        isCircleWithCrossHorizontalLine: true,
      });
      canvas.add(hLine);
      // Додаємо вертикальну лінію: висота 33% діаметра, починається від центру вниз
      const vHeightMm = diameterMm * 0.33;
      const vLine = new fabric.Rect({
        left: mmToPx(100) / 2,
        top: mmToPx(100) / 2, // верх вертикальної лінії у центрі
        originX: "center",
        originY: "top",
        width: mmToPx(lineThicknessMm),
        height: mmToPx(vHeightMm),
        fill: globalColors?.textColor || "#000",
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        lockSkewingX: true,
        lockSkewingY: true,
        hoverCursor: "default",
        moveCursor: "default",
        strokeUniform: true,
        isCircleWithCrossVerticalLine: true,
      });
      canvas.add(vLine);
      // Тексти як Textbox: top center, bottom left, bottom right
      const radiusMm = diameterMm / 2;
      const gapMm = (radiusMm - lineThicknessMm / 2) / 6; // еще меньший отступ для компактности
      const topY = mmToPx(100) / 2 - mmToPx(gapMm);
      const bottomY = mmToPx(100) / 2 + mmToPx(gapMm);
      const commonTextbox = {
        fontSize: mmToPx(5), // 5 мм по стандарту
        fontFamily: "Arial",
        fill: globalColors?.textColor || "#000",
        originY: "center",
        selectable: true,
        editable: true,
        splitByGrapheme: true, // м'який перенос по символах
      };
      const centerX = mmToPx(100) / 2;
      const lineThicknessPx = mmToPx(lineThicknessMm);
      const lineWidthPx = mmToPx(lineWidthMm);
      const paddingPx = mmToPx(0.5); // зменшений відступ для ближчого розташування до лінії

      const topText = new fabric.Textbox("TEXT TOP", {
        left: centerX,
        top: topY,
        width: Math.max(20, lineWidthPx - paddingPx * 2),
        textAlign: "center",
        originX: "center",
        ...commonTextbox,
        isCircleWithCrossTopText: true,
      });
      const bottomLeftText = new fabric.Textbox("TEXT L", {
        left: paddingPx, // стартова позиція, можна рухати по X
        top: bottomY,
        textAlign: "center", // центр у своїй області
        originX: "left",
        ...commonTextbox,
        isCircleWithCrossBottomLeftText: true,
      });
      const bottomRightText = new fabric.Textbox("TEXT R", {
        left: centerX + lineThicknessPx / 2 + paddingPx, // старт справа від вертикалі, можна рухати по X
        top: bottomY,
        textAlign: "center", // центр у своїй області
        originX: "left",
        ...commonTextbox,
        splitByGrapheme: true, // перенос по буквах завжди
        isCircleWithCrossBottomRightText: true,
      });
      // Зафіксувати стартовий валідний розмір = 5мм
      const startPx = mmToPx(5);
      topText._lastValidFontSize = startPx;
      bottomLeftText._lastValidFontSize = startPx;
      bottomRightText._lastValidFontSize = startPx;
      // Якорі для масштабування шрифту при зміні розміру картки
      topText.__fontAnchorW = canvas.width;
      topText.__fontAnchorH = canvas.height;
      bottomLeftText.__fontAnchorW = canvas.width;
      bottomLeftText.__fontAnchorH = canvas.height;
      bottomRightText.__fontAnchorW = canvas.width;
      bottomRightText.__fontAnchorH = canvas.height;
      canvas.add(topText, bottomLeftText, bottomRightText);
      canvas.sendObjectToBack(hLine);
      canvas.sendObjectToBack(vLine);

      // Розкладка і запобігання перетину з лініями «Т» (авто-перенос у нижніх боксах)
      const enforceCircleCrossLayout = () => {
        const canvasW = mmToPx(100);
        const canvasH = mmToPx(100);
        const cX = canvasW / 2;
        const cY = canvasH / 2;
        const radiusPx = mmToPx(100) / 2;
        const hTop = mmToPx(100) / 2 - lineThicknessPx / 2;
        const hBottom = mmToPx(100) / 2 + lineThicknessPx / 2;
        const vLeft = cX - lineThicknessPx / 2;
        const vRight = cX + lineThicknessPx / 2;

        // Допоміжні: перевірка, що рамка повністю в колі з відступом
        const isRectInsideCircle = (rect, cx, cy, r) => {
          // невеликий запас тільки на padding, без зайвого зменшення радіуса
          const padR = Math.max(0, r - paddingPx);
          const pts = [
            { x: rect.left, y: rect.top },
            { x: rect.left + rect.width, y: rect.top },
            { x: rect.left, y: rect.top + rect.height },
            { x: rect.left + rect.width, y: rect.top + rect.height },
          ];
          return pts.every((p) => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            return dx * dx + dy * dy <= padR * padR;
          });
        };

        // Перевірка «влазить?»
        const fitsNow = (tb) => {
          tb.initDimensions && tb.initDimensions();
          const rect = tb.getBoundingRect(true, true);
          const insideCanvas =
            rect.left >= 0 &&
            rect.top >= 0 &&
            rect.left + rect.width <= canvasW &&
            rect.top + rect.height <= canvasH;
          if (!(insideCanvas && isRectInsideCircle(rect, cX, cY, radiusPx))) {
            return false;
          }
          // Додаткові колізії із «Т»-лініями
          const pad = paddingPx;
          // Верхній текст не повинен торкатись горизонтальної лінії знизу
          if (tb.isCircleWithCrossTopText) {
            const bottomY = rect.top + rect.height;
            if (bottomY > hTop - pad) return false;
          }
          // Нижні тексти не повинні торкатись горизонтальної лінії зверху
          if (
            tb.isCircleWithCrossBottomLeftText ||
            tb.isCircleWithCrossBottomRightText
          ) {
            const topY = rect.top;
            if (topY < hBottom + pad) return false;
          }
          // Лівий нижній не повинен перетинати вертикаль
          if (tb.isCircleWithCrossBottomLeftText) {
            const rightX = rect.left + rect.width;
            if (rightX > vLeft - pad) return false;
          }
          // Правий нижній не повинен перетинати вертикаль
          if (tb.isCircleWithCrossBottomRightText) {
            const leftX = rect.left;
            if (leftX < vRight + pad) return false;
          }
          return true;
        };

        // Обчислити максимальний допустимий fontSize (бінарний пошук)
        const findMaxFontSize = (tb, lo, hi) => {
          // зберігаємо поточний
          const orig = tb.fontSize || lo;
          let L = lo,
            R = hi,
            best = lo;
          // обмежуємо ітерації
          for (let i = 0; i < 12 && L <= R; i++) {
            const mid = Math.floor((L + R) / 2);
            tb.set({ fontSize: mid });
            tb.initDimensions && tb.initDimensions();
            if (fitsNow(tb)) {
              best = mid;
              L = mid + 1;
            } else {
              R = mid - 1;
            }
          }
          // повертаємо кращий та виставляємо його
          tb.set({ fontSize: best });
          tb.initDimensions && tb.initDimensions();
          return best;
        };

        // Підігнати розмір шрифту, щоб не виходити за межі круга (строгий режим)
        const fitInsideCircle = (tb) => {
          if (!tb) return;
          if (tb.__fitting) return; // захист від рекурсії
          tb.__fitting = true;
          let minFont = Math.floor(mmToPx(5)); // мінімум 5мм по стандарту
          if (typeof tb.__minFontPx === "number") {
            minFont = Math.max(1, Math.round(tb.__minFontPx));
          }
          const current = Math.max(minFont, Math.round(tb.fontSize || minFont));
          const lastValid =
            typeof tb._lastValidFontSize === "number"
              ? Math.max(minFont, Math.round(tb._lastValidFontSize))
              : current;
          // Детермінована підгонка позиції до ліній
          tb.initDimensions && tb.initDimensions();
          let rect = tb.getBoundingRect(true, true);
          const pad = paddingPx;
          if (tb.isCircleWithCrossTopText) {
            const bottomY = rect.top + rect.height;
            const maxBottom = hTop - pad;
            if (bottomY > maxBottom) {
              const delta = bottomY - maxBottom;
              tb.top -= delta; // підтягуємо рівно до межі
              tb.initDimensions && tb.initDimensions();
            }
          } else {
            // нижні
            const topY = rect.top;
            const minTop = hBottom + pad;
            if (topY < minTop) {
              const delta = minTop - topY;
              tb.top += delta;
              tb.initDimensions && tb.initDimensions();
            }
          }
          // Після позиційної підгонки — остаточна перевірка і фіксація
          if (fitsNow(tb)) {
            tb._lastValidFontSize = Math.max(minFont, tb.fontSize | 0);
          } else {
            // Намагаємось трохи розслабити тільки позицію в межах canvas, без зменшення шрифта
            rect = tb.getBoundingRect(true, true);
            if (rect.top < 0) tb.top += -rect.top;
            if (rect.left < 0) tb.left += -rect.left;
            if (rect.left + rect.width > canvasW)
              tb.left -= rect.left + rect.width - canvasW;
            if (rect.top + rect.height > canvasH)
              tb.top -= rect.top + rect.height - canvasH;
            tb.initDimensions && tb.initDimensions();
            // Більше не скидаємо fontSize до 5мм, користувач керує сам
          }
          tb.__fitting = false;
        };

        // Верхній текст: ширина по горизонтальній лінії, тримаємо над нею з відступом
        topText.set({
          width: Math.max(20, lineWidthPx - paddingPx * 2),
          left: cX,
          originX: "center",
          textAlign: "center",
        });
        // Після зміни ширини оновлюємо розміри, щоб отримати правильну висоту
        topText.initDimensions && topText.initDimensions();
        const topH = topText.height || 0;
        const desiredTop = Math.max(0, hTop - paddingPx - topH / 2);
        if (topText.top > desiredTop) topText.top = desiredTop;
        // Фітінг в колі
        fitInsideCircle(topText);

        // Лівий нижній бокс: від лівого краю до вертикальної лінії з полями
        // Не фіксуємо left, дозволяємо користувачу рухати по X
        const leftW = Math.max(
          20,
          vLeft - paddingPx - (bottomLeftText.left || 0)
        );
        bottomLeftText.set({ width: leftW, originX: "left" });
        // Позиція нижче горизонтальної лінії
        const minCenterBelow =
          hBottom + paddingPx + (bottomLeftText.height || 0) / 2;
        if (bottomLeftText.top < minCenterBelow)
          bottomLeftText.top = minCenterBelow;
        bottomLeftText.initDimensions && bottomLeftText.initDimensions();
        fitInsideCircle(bottomLeftText);

        // Правий нижній бокс: від правого краю вертикальної до правої межі
        // Не фіксуємо left, дозволяємо користувачу рухати по X
        // Дзеркальна логіка: ліва межа не повинна перетинати центральну лінію
        let rightTextLeft = bottomRightText.left || vRight + paddingPx;
        // Дзеркальна поведінка: left — від центральної лінії, width — до правого краю
        // left = vRight + paddingPx + delta (delta — зміщення вправо)
        let delta =
          (bottomRightText.left || vRight + paddingPx) - (vRight + paddingPx);
        let minLeft = vRight + paddingPx;
        let maxRight = canvasW - paddingPx;
        rightTextLeft = Math.max(minLeft, bottomRightText.left || minLeft);
        // width — від лівого краю тексту до правого краю
        let rightW = Math.max(20, maxRight - rightTextLeft);
        // Якщо рамка виходить за межі правого краю — зсуваємо left вліво
        if (rightTextLeft + rightW > maxRight) {
          rightTextLeft = maxRight - rightW;
        }
        bottomRightText.left = rightTextLeft;
        bottomRightText.set({
          width: rightW,
          originX: "left",
        });
        const minCenterBelowR =
          hBottom + paddingPx + (bottomRightText.height || 0) / 2;
        if (bottomRightText.top < minCenterBelowR)
          bottomRightText.top = minCenterBelowR;
        bottomRightText.initDimensions && bottomRightText.initDimensions();
        fitInsideCircle(bottomRightText);

        // Фінальний guard: якщо будь-який текст вийшов за межі видимої зони — повертаємо в безпечне положення
        const ensureVisible = (tb, zone) => {
          if (!tb) return;
          tb.initDimensions && tb.initDimensions();
          const r = tb.getBoundingRect(true, true);
          let changed = false;
          if (r.top < 0) {
            tb.top += -r.top;
            changed = true;
          }
          if (r.left < 0) {
            tb.left += -r.left;
            changed = true;
          }
          if (r.left + r.width > canvasW) {
            tb.left -= r.left + r.width - canvasW;
            changed = true;
          }
          if (r.top + r.height > canvasH) {
            tb.top -= r.top + r.height - canvasH;
            changed = true;
          }
          if (zone === "top") {
            // не ниже допустимой границы
            const maxBottom = hTop - paddingPx;
            const newRect = tb.getBoundingRect(true, true);
            const bottomY = newRect.top + newRect.height;
            if (bottomY > maxBottom) {
              tb.top -= bottomY - maxBottom;
              changed = true;
            }
          } else if (zone === "bottomL" || zone === "bottomR") {
            const minTop = hBottom + paddingPx;
            const newRect = tb.getBoundingRect(true, true);
            if (newRect.top < minTop) {
              tb.top += minTop - newRect.top;
              changed = true;
            }
          }
          if (changed) tb.initDimensions && tb.initDimensions();
        };

        ensureVisible(topText, "top");
        ensureVisible(bottomLeftText, "bottomL");
        ensureVisible(bottomRightText, "bottomR");

        canvas.requestRenderAll();
      };

      // Події для автоперерозкладки під час редагування/руху
      const attachAutoLayout = (obj) => {
        const handler = () => enforceCircleCrossLayout();
        obj.on("changed", handler);
        obj.on("editing:entered", handler);
        obj.on("editing:exited", handler);
        obj.on("moving", handler);
        obj.on("modified", handler);
        // Переводимо масштаб у fontSize з клампом по вміщенню
        obj.on("scaling", () => {
          try {
            const scale = Math.max(obj.scaleX || 1, obj.scaleY || 1);
            if (scale !== 1) {
              const base = Math.round(obj.fontSize || mmToPx(5));
              const desired = Math.max(6, Math.round(base * scale));
              // шукаємо максимально допустимий до desired
              obj.set({ scaleX: 1, scaleY: 1 });
              // тимчасово виставляємо бажаний, далі fit відклацне до валідного
              obj.set({ fontSize: desired });
            }
          } catch (e) {}
          enforceCircleCrossLayout();
        });
        // Коли користувач змінює fontSize іншими шляхами — підтягнемо назад
        obj.on("changed", () => enforceCircleCrossLayout());
      };
      attachAutoLayout(topText);
      attachAutoLayout(bottomLeftText);
      attachAutoLayout(bottomRightText);

      // Початкова розкладка
      enforceCircleCrossLayout();

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
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
      setSizeValues((prev) => ({
        ...prev,
        width: 96,
        height: 105,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
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

      // Використовуємо аналітичний path одразу (стабільні координати для border cloning)
      const pathStr = makeExtendedHalfCircleSmoothPath(wPxE, hPxE, 0);
      const clipPath = new fabric.Path(pathStr, { absolutePositioned: true });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({
        ...prev,
        width: baseWmm,
        height: baseHmm,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
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
      setSizeValues((prev) => ({
        ...prev,
        width: baseWmm,
        height: baseHmm,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
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
      const triData = getAdaptiveTriangleData(mmToPx(width), mmToPx(height));
      console.log(
        "[adaptiveTriangle] addAdaptiveTriangle: isFull=",
        triData.isFull,
        "points=",
        triData.points?.length
      );
      const rCorner = mmToPx(sizeValues.cornerRadius || 0);
      if (triData.isFull) {
        const d = makeRoundedTrianglePath(
          mmToPx(width),
          mmToPx(height),
          rCorner
        );
        canvas.clipPath = new fabric.Path(d, { absolutePositioned: true });
      } else {
        const currRatio = mmToPx(width) / mmToPx(height);
        const roundThreshold = 180 / 165; // поріг стилю заокруглення
        const ratioTol = 0.003;
        // Вище або на порозі — трикутне заокруглення; нижче — 5-кутна логіка
        const roundAsTriangle = currRatio >= roundThreshold - ratioTol;
        let pts = triData.points;
        if (rCorner > 0) {
          if (roundAsTriangle) {
            // нижче порогу — візуально трикутне заокруглення (кліп округленого трикутника)
            const d = makeRoundedTrianglePath(
              mmToPx(width),
              mmToPx(height),
              rCorner
            );
            try {
              const svgNS = "http://www.w3.org/2000/svg";
              const path = document.createElementNS(svgNS, "path");
              path.setAttribute("d", d);
              const total = path.getTotalLength();
              const target = Math.min(1400, Math.max(160, Math.round(total)));
              const triRoundedPts = [];
              for (let i = 0; i <= target; i++) {
                const p = path.getPointAtLength((total * i) / target);
                triRoundedPts.push({ x: p.x, y: p.y });
              }
              pts = clipPolygonWithRect(
                triRoundedPts,
                mmToPx(width),
                mmToPx(height)
              );
            } catch (e) {
              const seg = Math.max(8, Math.min(24, Math.round(rCorner / 2)));
              const weights = getAdaptivePentagonCornerWeights(
                pts,
                mmToPx(width),
                mmToPx(height),
                sizeValues.cornerRadius || 0
              );
              pts = sampleRoundedPolygonPerCornerFlexible(
                pts,
                rCorner,
                seg,
                weights
              );
            }
          } else {
            const seg = Math.max(8, Math.min(24, Math.round(rCorner / 2)));
            const weights = getAdaptivePentagonCornerWeights(
              pts,
              mmToPx(width),
              mmToPx(height),
              sizeValues.cornerRadius || 0
            );
            pts = sampleRoundedPolygonPerCornerFlexible(
              pts,
              rCorner,
              seg,
              weights
            );
          }
        }
        const clipPath = new fabric.Polygon(pts, { absolutePositioned: true });
        canvas.clipPath = clipPath;
      }

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({ ...prev, width, height, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
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
        currentShapeType === "hexagon"
          ? mmToPx(sizeValues.cornerRadius || 0)
          : 0
      );

      const clipPath = new fabric.Path(d, {
        absolutePositioned: true,
        originX: "center",
        originY: "center",
        left: mmToPx(127) / 2,
        top: mmToPx(114) / 2,
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({
        ...prev,
        width: 127,
        height: 114,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
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
        currentShapeType === "octagon"
          ? mmToPx(sizeValues.cornerRadius || 0)
          : 0
      );
      const clipPath = new fabric.Path(d, {
        absolutePositioned: true,
        // Центруємо по реальному розміру полотна (100×100 мм),
        // а не по 120×80 мм, щоб виключити зсув фігури до ресайзу
        originX: "center",
        originY: "center",
        objectCaching: false,
      });
      // Нормалізуємо позицію та pathOffset відносно поточного canvas
      centerPathToCanvas(clipPath, mmToPx(100), mmToPx(100));

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({
        ...prev,
        width: 100,
        height: 100,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
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
        currentShapeType === "triangle"
          ? mmToPx(sizeValues.cornerRadius || 0)
          : 0
      );
      const clipPath = new fabric.Path(d, {
        absolutePositioned: true,
        originX: "center",
        originY: "center",
        objectCaching: false,
      });
      centerPathToCanvas(clipPath, mmToPx(100), mmToPx(100));

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({
        ...prev,
        width: 100,
        height: 100,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
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

      const widthPx = mmToPx(120);
      const heightPx = mmToPx(80);
      // Встановлюємо розміри canvas (120x80 мм для стрілки)
      canvas.setDimensions({ width: widthPx, height: heightPx });

      // Створюємо clipPath у формі стрілки вліво з урахуванням радіуса кутів
      const d = makeRoundedArrowLeftPath(
        widthPx,
        heightPx,
        currentShapeType === "arrowLeft"
          ? mmToPx(sizeValues.cornerRadius || 0)
          : 0
      );
      const clipPath = new fabric.Path(d, {
        absolutePositioned: true,
        objectCaching: false,
      });
      centerPathToCanvas(clipPath, widthPx, heightPx);

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({
        ...prev,
        width: 120,
        height: 80,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
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

      const widthPx = mmToPx(120);
      const heightPx = mmToPx(80);
      // Встановлюємо розміри canvas (120x80 мм для стрілки)
      canvas.setDimensions({ width: widthPx, height: heightPx });

      // Створюємо clipPath у формі стрілки вправо з урахуванням радіуса кутів
      const d = makeRoundedArrowRightPath(
        widthPx,
        heightPx,
        currentShapeType === "arrowRight"
          ? mmToPx(sizeValues.cornerRadius || 0)
          : 0
      );
      const clipPath = new fabric.Path(d, {
        absolutePositioned: true,
        objectCaching: false,
      });
      centerPathToCanvas(clipPath, widthPx, heightPx);

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({
        ...prev,
        width: 120,
        height: 80,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
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
        currentShapeType === "flag" ? mmToPx(sizeValues.cornerRadius || 0) : 0
      );
      const clipPath = new fabric.Path(d, { absolutePositioned: true });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({
        ...prev,
        width: 720,
        height: 600,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
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
      const dPath = `M${wPxD / 2} 0L${wPxD} ${hPxD / 2}L${wPxD / 2} ${hPxD}L0 ${
        hPxD / 2
      }Z`;
      const clipPath = new fabric.Path(dPath, {
        absolutePositioned: true,
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues((prev) => ({
        ...prev,
        width: 600,
        height: 600,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      // Скидаємо отвори до No holes
      resetHolesToNone();
    }
  };

  // Автоматична ініціалізація прямокутника для порожніх полотен
  useEffect(() => {
    if (!canvas) return;

    const handleCanvasLoaded = (e) => {
      // Перевіряємо чи полотно порожнє (немає об'єктів і немає clipPath)
      const objects = canvas.getObjects();
      const hasObjects = objects && objects.length > 0;
      const hasClipPath = !!canvas.clipPath;

      // Якщо полотно порожнє - ініціалізуємо прямокутник
      if (!hasObjects && !hasClipPath) {
        console.log("Canvas is empty, initializing default rectangle shape");
        // Невелика затримка щоб canvas встиг повністю завантажитися
        setTimeout(() => {
          addRectangle();
        }, 100);
      }
    };

    window.addEventListener("canvas:loaded", handleCanvasLoaded);

    return () => {
      window.removeEventListener("canvas:loaded", handleCanvasLoaded);
    };
  }, [canvas, addRectangle]);

  const handleInputChange = (key, max, rawValue) => {
    const isHeightField = key === "height";
    const isLockShape = currentShapeType === "lock";
    const effectiveMax =
      isLockShape && isHeightField
        ? Math.max(0, max - LOCK_ARCH_HEIGHT_MM)
        : max;

    // Поддерживаем запятую как разделитель, затем округляем до 1 знака
    const parsed = parseFloat(String(rawValue).replace(",", "."));
    const clamped = Math.max(
      0,
      Math.min(effectiveMax, isNaN(parsed) ? 0 : parsed)
    );
    const value = round1(clamped);
    const effectiveHeight =
      isLockShape && isHeightField
        ? round1(value + LOCK_ARCH_HEIGHT_MM)
        : value;

    // Compute next mm values synchronously
    let next = {
      width: key === "width" ? value : sizeValues.width,
      height:
        key === "height"
          ? isLockShape
            ? effectiveHeight
            : value
          : sizeValues.height,
      cornerRadius: key === "cornerRadius" ? value : sizeValues.cornerRadius,
    };

    // --- Глобальні обмеження для картки ---
    // 1) Кожна сторона максимум 600 мм
    // 2) Якщо одна сторона > 295, інша не може бути > 295
    const LIMIT_SIDE_MAX = 600;
    const LIMIT_OTHER_THRESHOLD = 295;

    const clampPair = (w, h) => {
      let W = Math.min(LIMIT_SIDE_MAX, w || 0);
      let H = Math.min(LIMIT_SIDE_MAX, h || 0);
      // Нове правило: не зменшуємо вже велику сторону >295 при зміні іншої.
      // Якщо після зміни обидві >295 — обрізаємо ТІЛЬКИ редаговану до 295.
      if (W > LIMIT_OTHER_THRESHOLD && H > LIMIT_OTHER_THRESHOLD) {
        if (key === "width") {
          W = LIMIT_OTHER_THRESHOLD; // редагували width
        } else if (key === "height") {
          H = LIMIT_OTHER_THRESHOLD; // редагували height
        }
      }
      return { W: round1(W), H: round1(H) };
    };

    const pair = clampPair(next.width, next.height);
    next.width = pair.W;
    next.height = pair.H;

    // For circle-based shapes, keep 1:1 aspect by mirroring the changed side
    const isCircleFamily =
      currentShapeType === "circle" ||
      currentShapeType === "circleWithLine" ||
      currentShapeType === "circleWithCross";
    if (isCircleFamily && (key === "width" || key === "height")) {
      // Make it square using the edited dimension
      const side = key === "width" ? next.width : next.height; // уже клампнули
      next = { ...next, width: side, height: side };
      setSizeValues((prev) => ({ ...prev, width: side, height: side }));
    } else {
      if (isLockShape && isHeightField) {
        // effectiveHeight вже врахований в next.height після clampPair
        setSizeValues((prev) => ({
          ...prev,
          width: next.width,
          height: next.height,
        }));
      } else {
        setSizeValues((prev) => ({
          ...prev,
          width: next.width,
          height: next.height,
          cornerRadius: next.cornerRadius,
        }));
      }
    }

    // Параметри розміру застосовуємо лише до canvas/clipPath
    if (canvas) {
      if (key === "cornerRadius" && isCustomShapeMode) {
        // Округлюємо поточну форму в режимі кастомізації
        applyCornerRadiusToCurrentPolygon(round1(next.cornerRadius));
      } else {
        // Визначаємо напрямок зміни для трикутника: чи зменшується висота
        const prevHeightMm_forIntent = sizeValues.height;
        const prevWidthMm_forIntent = sizeValues.width;
        const editedKey = key;
        const editedIsDecrease =
          editedKey === "height" && next.height < prevHeightMm_forIntent - 1e-3;
        updateSize({
          widthMm: round1(next.width),
          heightMm: round1(next.height),
          cornerRadiusMm: round1(next.cornerRadius),
          __editedKey: editedKey,
          __editedIsDecrease: editedIsDecrease,
          __prevWidthMm: prevWidthMm_forIntent,
          __prevHeightMm: prevHeightMm_forIntent,
        });
        if (key === "cornerRadius") {
          updateExistingBorders({ cornerRadiusMm: round1(next.cornerRadius) });
        }
      }
    }
  };

  const changeValue = (key, delta, max) => {
    setSizeValues((prev) => {
      const isHeightField = key === "height";
      const isLockShape = currentShapeType === "lock";
      const cur = parseFloat(String(prev[key]).replace(",", ".")) || 0;
      const minVal = isLockShape && isHeightField ? LOCK_ARCH_HEIGHT_MM : 0;
      const nextVal = Math.max(minVal, Math.min(max, cur + delta));
      const newValue = round1(nextVal);
      let updated = { ...prev, [key]: newValue };

      // --- Глобальні обмеження для картки (аналогічно handleInputChange) ---
      const LIMIT_SIDE_MAX = 600;
      const LIMIT_OTHER_THRESHOLD = 295;
      let w = key === "width" ? newValue : updated.width;
      let h = key === "height" ? newValue : updated.height;
      w = Math.min(LIMIT_SIDE_MAX, w || 0);
      h = Math.min(LIMIT_SIDE_MAX, h || 0);
      if (w > LIMIT_OTHER_THRESHOLD && h > LIMIT_OTHER_THRESHOLD) {
        if (key === "width") {
          w = LIMIT_OTHER_THRESHOLD; // редагували width
        } else if (key === "height") {
          h = LIMIT_OTHER_THRESHOLD; // редагували height
        }
      }
      updated.width = round1(w);
      updated.height = round1(h);

      // Enforce square for circle family shapes via arrows too
      const isCircleFamily =
        currentShapeType === "circle" ||
        currentShapeType === "circleWithLine" ||
        currentShapeType === "circleWithCross";
      if (isCircleFamily && (key === "width" || key === "height")) {
        const side = key === "width" ? updated.width : updated.height; // після клампу
        updated = { ...updated, width: side, height: side };
      }

      // Параметри розміру застосовуємо лише до canvas/clipPath
      if (canvas) {
        if (key === "cornerRadius" && isCustomShapeMode) {
          applyCornerRadiusToCurrentPolygon(round1(updated.cornerRadius));
        } else {
          const editedKey = key;
          const editedIsDecrease = editedKey === "height" && delta < 0;
          updateSize({
            widthMm: round1(updated.width),
            heightMm: round1(updated.height),
            cornerRadiusMm: round1(updated.cornerRadius),
            __editedKey: editedKey,
            __editedIsDecrease: editedIsDecrease,
          });
          if (key === "cornerRadius") {
            updateExistingBorders({
              cornerRadiusMm: round1(
                key === "cornerRadius" ? newValue : updated.cornerRadius
              ),
            });
          }
        }
      }

      return updated;
    });
  };

  const actualHeightMm = Number(sizeValues?.height) || 0;
  const displayHeightMm =
    currentShapeType === "lock"
      ? round1(Math.max(0, actualHeightMm - LOCK_ARCH_HEIGHT_MM))
      : actualHeightMm;
  const heightInputValue = displayHeightMm === 0 ? "" : displayHeightMm;

  // Corner radius input: по умолчанию показываем "0", но позволяем очищать поле
  const [isCornerEditing, setIsCornerEditing] = useState(false);
  const [cornerRadiusInput, setCornerRadiusInput] = useState("0");
  useEffect(() => {
    // Синхронизация из state, если не редактируем и поле не принудительно пустое
    if (!isCornerEditing && cornerRadiusInput !== "") {
      const v =
        sizeValues && sizeValues.cornerRadius != null
          ? String(sizeValues.cornerRadius)
          : "0";
      if (cornerRadiusInput !== v) setCornerRadiusInput(v);
    }
  }, [sizeValues?.cornerRadius, isCornerEditing]);

  // Гарантуємо що отвори (cutType: 'hole') завжди залишаються білими з оранжевим обводом, незалежно від теми.
  useEffect(() => {
    if (!canvas) return;
    let didChange = false;
    (canvas.getObjects?.() || [])
      .filter((o) => o.isCutElement && o.cutType === "hole")
      .forEach((o) => {
        const nextProps = {};
        if (o.fill !== HOLE_FILL_COLOR) {
          nextProps.fill = HOLE_FILL_COLOR;
        }
        if (o.stroke !== CUT_STROKE_COLOR) {
          nextProps.stroke = CUT_STROKE_COLOR;
        }
        if (Object.keys(nextProps).length) {
          o.set(nextProps);
          didChange = true;
        }
      });
    if (didChange) {
      canvas.requestRenderAll?.();
    }
  }, [canvas, globalColors]);

  return (
    <div className={styles.toolbar}>
      {isCustomShapeMode && (
        <CustomShapeStopModal onConfirm={() => exitCustomShapeMode(false)} />
      )}
      {isCustomShapeMode && overlayHandles.length > 0 && (
        <div className={styles.customShapeOverlay}>
          {overlayHandles.map((h) => (
            <div
              key={h.index}
              className={styles.customShapeHandle}
              style={{
                left: `${h.screenX}px`,
                top: `${h.screenY}px`,
                width: h.size,
                height: h.size,
                marginLeft: -h.size / 2,
                marginTop: -h.size / 2,
              }}
              onMouseDown={(e) => startDomDrag(e, h.index)}
            />
          ))}
        </div>
      )}
      {/* 1. Shape */}
      <div className={styles.section}>
        <div className={styles.numbering}>
          <p>1</p>
        </div>
        <div className={styles.icons}>
          <h3>Shape</h3>
          <span title="Rectangle" onClick={withShapePick(addRectangle)}>
            {Icon0}
          </span>
          <span title="Round" onClick={withShapePick(addCircle)}>
            {Icon1}
          </span>
          <span title="Oval" onClick={withShapePick(addEllipse)}>
            {Icon2}
          </span>
          <span
            title="Rectangle with a loop (Hanging Sing)"
            onClick={withShapePick(addLock)}
          >
            {Icon3}
          </span>
          <span
            title="Round with a line"
            onClick={withShapePick(addCircleWithLine)}
          >
            {Icon4}
          </span>
          <span
            title="Round with a T-shaped line"
            onClick={withShapePick(addCircleWithCross)}
          >
            {Icon5}
          </span>
          <span
            title="Warning Triangle"
            onClick={withShapePick(addAdaptiveTriangle)}
          >
            {Icon6}
          </span>
          <span title="Semi round" onClick={withShapePick(addHalfCircle)}>
            {Icon7}
          </span>
          <span
            title="Round Top"
            onClick={withShapePick(addExtendedHalfCircle)}
          >
            {Icon8}
          </span>
          <span title="Hexagon" onClick={withShapePick(addHexagon)}>
            {Icon9}
          </span>
          <span title="Octagon" onClick={withShapePick(addOctagon)}>
            {Icon10}
          </span>
          <span title="Triangle" onClick={withShapePick(addTriangleUp)}>
            {Icon11}
          </span>
          <span title="Left arrow" onClick={withShapePick(addArrowLeft)}>
            {Icon12}
          </span>
          <span title="Right arrow" onClick={withShapePick(addArrowRight)}>
            {Icon13}
          </span>
          {(() => {
            const disabled = blockedCustomTypes.has(currentShapeType);
            const title = "Custom shape";
            return (
              <span
                onClick={disabled ? undefined : toggleCustomShapeMode}
                className={
                  disabled
                    ? styles.disabledIcon
                    : isCustomShapeMode
                    ? styles.activeCustomIcon
                    : ""
                }
                title={title}
                // Прибрано inline-outline для активної іконки
              >
                {Icon14}
              </span>
            );
          })()}
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
                value={sizeValues.width === 0 ? "" : sizeValues.width}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : e.target.value;
                  handleInputChange("width", 1200, val);
                }}
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => changeValue("width", 1, 1200)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => changeValue("width", -1, 1200)}
                />
              </div>
            </div>
          </div>

          <div
            className={styles.field}
            style={{
              opacity: isCircleSelected || isCustomShapeApplied ? 0.5 : 1,
              cursor:
                isCircleSelected || isCustomShapeApplied
                  ? "not-allowed"
                  : "default",
            }}
          >
            <label
              style={{
                cursor:
                  isCircleSelected || isCustomShapeApplied
                    ? "not-allowed"
                    : "inherit",
              }}
            >
              Corner radius
            </label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                value={cornerRadiusInput}
                max={Math.floor(
                  Math.min(
                    Number(sizeValues.width) || 0,
                    Number(sizeValues.height) || 0
                  ) / 2
                )}
                disabled={isCircleSelected || isCustomShapeApplied}
                style={{
                  cursor:
                    isCircleSelected || isCustomShapeApplied
                      ? "not-allowed"
                      : "text",
                  opacity: isCustomShapeApplied ? 0.85 : 1,
                }}
                onChange={(e) => {
                  setIsCornerEditing(true);
                  const raw = e.target.value;
                  if (raw === "") {
                    // Разрешаем пустую строку визуально
                    setCornerRadiusInput("");
                    return; // пока пусто — не применять
                  }
                  const maxCorner = Math.floor(
                    Math.min(
                      Number(sizeValues.width) || 0,
                      Number(sizeValues.height) || 0
                    ) / 2
                  );
                  const num = Number(raw);
                  const clamped = isNaN(num)
                    ? 0
                    : Math.min(maxCorner, Math.max(0, num));
                  // Мгновенно отрисовываем ограниченное значение, если превысили
                  setCornerRadiusInput(String(clamped));
                  if (!isCircleSelected && !isCustomShapeApplied) {
                    handleInputChange(
                      "cornerRadius",
                      Math.floor(
                        Math.min(
                          Number(sizeValues.width) || 0,
                          Number(sizeValues.height) || 0
                        ) / 2
                      ),
                      clamped
                    );
                  }
                }}
                onBlur={() => {
                  setIsCornerEditing(false);
                  // Если оставили пусто — восстановим "0" визуально без изменения логики
                  if (cornerRadiusInput === "") {
                    setCornerRadiusInput("0");
                  }
                }}
              />
              <div
                className={styles.arrows}
                style={{
                  pointerEvents:
                    isCircleSelected || isCustomShapeApplied ? "none" : "auto",
                  opacity: isCircleSelected || isCustomShapeApplied ? 0.6 : 1,
                }}
              >
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => {
                    if (!isCircleSelected && !isCustomShapeApplied) {
                      const maxCorner = Math.floor(
                        Math.min(
                          Number(sizeValues.width) || 0,
                          Number(sizeValues.height) || 0
                        ) / 2
                      );
                      changeValue("cornerRadius", 1, maxCorner);
                    }
                  }}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => {
                    if (!isCircleSelected && !isCustomShapeApplied) {
                      const maxCorner = Math.floor(
                        Math.min(
                          Number(sizeValues.width) || 0,
                          Number(sizeValues.height) || 0
                        ) / 2
                      );
                      changeValue("cornerRadius", -1, maxCorner);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label>Height</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                value={heightInputValue}
                onChange={(e) => {
                  const val = e.target.value === "" ? "" : e.target.value;
                  handleInputChange("height", 1200, val);
                }}
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => changeValue("height", 1, 1200)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => changeValue("height", -1, 1200)}
                />
              </div>
            </div>
          </div>

          <div className={styles.unitLabel}>{"* (mm)"}</div>
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
          <div className={styles.unitLabel}>
            {currentShapeType === "lock"
              ? isHolesSelected && activeHolesType !== 1
                ? holesDiameter
                : 0
              : "*"}{" "}
            (mm)
          </div>
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
            onClick={() => handleColorPick(0, "#000000", "#FFFFFF", "solid")}
            title="White / Black"
          >
            <A1
              borderColor={
                selectedColorIndex === 0 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 0 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 0 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => handleColorPick(1, "#0000FF", "#FFFFFF", "solid")}
            title="White / Blue"
          >
            <A2
              borderColor={
                selectedColorIndex === 1 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 1 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 1 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => handleColorPick(2, "#FF0000", "#FFFFFF", "solid")}
            title="White / Red"
          >
            <A3
              borderColor={
                selectedColorIndex === 2 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 2 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 2 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => handleColorPick(3, "#FFFFFF", "#000000", "solid")}
            title="Black / White"
          >
            <A4
              borderColor={
                selectedColorIndex === 3 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 3 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 3 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => handleColorPick(4, "#FFFFFF", "#0000FF", "solid")}
            title="Blue / White"
          >
            <A5
              borderColor={
                selectedColorIndex === 4 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 4 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 4 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => handleColorPick(5, "#FFFFFF", "#FF0000", "solid")}
            title="Red / White"
          >
            <A6
              borderColor={
                selectedColorIndex === 5 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 5 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 5 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => handleColorPick(6, "#FFFFFF", "#00FF00", "solid")}
            title="Green / White"
          >
            <A7
              borderColor={
                selectedColorIndex === 6 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 6 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 6 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => handleColorPick(7, "#000000", "#FFFF00", "solid")}
            title="Yellow / Black"
          >
            <A8
              borderColor={
                selectedColorIndex === 7 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 7 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 7 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => handleColorPick(8, "#000000", "#F0F0F0", "gradient")}
            title="Silver / Black"
          >
            <A9
              borderColor={
                selectedColorIndex === 8 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 8 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 8 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => handleColorPick(9, "#FFFFFF", "#8B4513", "solid")}
            title="Brown / White"
          >
            <A10
              borderColor={
                selectedColorIndex === 9 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 9 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 9 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => handleColorPick(10, "#FFFFFF", "#FFA500", "solid")}
            title="Orange / White"
          >
            <A11
              borderColor={
                selectedColorIndex === 10 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 10 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 10 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() => handleColorPick(11, "#FFFFFF", "#808080", "solid")}
            title="Gray / White"
          >
            <A12
              borderColor={
                selectedColorIndex === 11 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 11 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 11 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() =>
              handleColorPick(12, "#000000", "/textures/Wood.jpg", "texture")
            }
            title="Maple (“Wood”) / Black"
          >
            <A13
              borderColor={
                selectedColorIndex === 12 ? "rgba(0, 108, 164, 1)" : "black"
              }
              borderOpacity={selectedColorIndex === 12 ? "1" : "0.29"}
              strokeWidth={selectedColorIndex === 12 ? "3" : "1"}
            />
          </span>
          <span
            onClick={() =>
              handleColorPick(13, "#FFFFFF", "/textures/Carbon.jpg", "texture")
            }
            title="Carbon / White"
          >
            <A14
              borderColor={
                selectedColorIndex === 13 ? "rgba(0, 108, 164, 1)" : "black"
              }
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
              title="Cut + Fill"
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
            <span
              className={[
                styles.elementsSpanWrapper,
                isBorderActive ? styles.active : "",
              ].join(" ")}
            >
              {Border}
              <span>Border</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={cut}>
            <span
              title="Fixed Shapes"
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
        {/* Upload preview modal */}
        <UploadPreview
          isOpen={isUploadOpen}
          mode={uploadMode}
          dataURL={uploadDataURL}
          svgText={uploadSvgText}
          themeColor={(globalColors && globalColors.textColor) || "#000"}
          onClose={() => setIsUploadOpen(false)}
          onConfirm={async ({ svg: finalSVG, strokeOnly }) => {
            if (!canvas || !finalSVG) return;
            try {
              let themedSVG = String(finalSVG);
              // Ensure theme color is applied
              const theme = (globalColors && globalColors.textColor) || "#000";
              try {
                const doc = new DOMParser().parseFromString(
                  themedSVG,
                  "image/svg+xml"
                );
                // Apply theme color to all relevant elements; keep strokeOnly where indicated
                doc
                  .querySelectorAll("path,polygon,polyline,rect,circle,ellipse")
                  .forEach((el) => {
                    if (strokeOnly) {
                      el.setAttribute("fill", "transparent");
                      el.setAttribute("stroke", theme);
                      if (!el.getAttribute("stroke-width"))
                        el.setAttribute("stroke-width", "1");
                    } else {
                      el.setAttribute("fill", theme);
                      el.setAttribute("stroke", theme);
                    }
                  });
                themedSVG = new XMLSerializer().serializeToString(doc);
              } catch {}

              const result = await fabric.loadSVGFromString(themedSVG);
              const obj =
                result.objects.length === 1
                  ? result.objects[0]
                  : fabric.util.groupSVGElements(
                      result.objects,
                      result.options
                    );

              // Tag to theme if needed
              try {
                obj.set && obj.set({ useThemeColor: true });
                if (
                  obj.type === "group" &&
                  typeof obj.forEachObject === "function"
                ) {
                  obj.forEachObject(
                    (child) => child.set && child.set({ useThemeColor: true })
                  );
                }
              } catch {}

              // Center and scale
              const bounds = obj.getBoundingRect
                ? obj.getBoundingRect()
                : { width: 100, height: 100 };
              const maxWidth = 300,
                maxHeight = 300;
              if (bounds.width > maxWidth || bounds.height > maxHeight) {
                const s = Math.min(
                  maxWidth / bounds.width,
                  maxHeight / bounds.height
                );
                obj.scale(s);
              }
              obj.set({
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: "center",
                originY: "center",
                selectable: true,
                hasControls: true,
                hasBorders: true,
              });
              canvas.add(obj);
              try {
                obj.setCoords && obj.setCoords();
              } catch {}
              try {
                canvas.setActiveObject(obj);
              } catch {}
              try {
                canvas.requestRenderAll();
              } catch {}
            } finally {
              setIsUploadOpen(false);
            }
          }}
        />
      </div>
      {/* 6. Holes */}
      <div className={`${styles.section} ${styles.colorSection}`}>
        <div className={styles.colorTitleWrapper}>
          <div className={styles.numbering}>
            <p>6</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
            <h3 style={{ marginRight: "60px" }}>Holes</h3>
            {isHolesSelected && activeHolesType !== 5 && (
              <>
                <div className={styles.field} style={{ margin: 0 }}>
                  <div className={styles.inputGroup}>
                    <input
                      type="number"
                      min={currentShapeType === "lock" ? 2 : 2.5}
                      max={currentShapeType === "lock" ? 7 : 10}
                      step={0.5}
                      value={holesDiameter}
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value);
                        let val = isNaN(raw) ? 2.5 : raw;
                        // Только для lock и дырки сверху
                        if (
                          currentShapeType === "lock" &&
                          activeHolesType === 2
                        ) {
                          val = Math.max(2, Math.min(7, val));
                        }
                        setHolesDiameter(val);
                      }}
                    />
                    <div className={styles.arrows}>
                      <i
                        className="fa-solid fa-chevron-up"
                        onClick={() => {
                          setHolesDiameter((prev) => {
                            let next = Number((prev + 0.5).toFixed(1));
                            if (
                              currentShapeType === "lock" &&
                              activeHolesType === 2
                            ) {
                              next = Math.min(7, next);
                              next = Math.max(2, next);
                            } else {
                              next = Math.min(10, next);
                              next = Math.max(2.5, next);
                            }
                            return next;
                          });
                        }}
                      />
                      <i
                        className="fa-solid fa-chevron-down"
                        onClick={() => {
                          setHolesDiameter((prev) => {
                            let next = Number((prev - 0.5).toFixed(1));
                            if (
                              currentShapeType === "lock" &&
                              activeHolesType === 2
                            ) {
                              next = Math.max(2, next);
                              next = Math.min(7, next);
                            } else {
                              next = Math.max(2.5, next);
                              next = Math.min(10, next);
                            }
                            return next;
                          });
                        }}
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
            title="4 прямокутні 5x2мм по кутам"
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
                value={copiesCount === 0 ? "" : copiesCount}
                onChange={(e) => {
                  const val =
                    e.target.value === "" ? "" : parseInt(e.target.value);
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
        accept="image/*,image/svg+xml,.svg"
        onChange={handleUpload}
        style={{ display: "none" }}
      />
    </div>
  );
};

export default Toolbar;
