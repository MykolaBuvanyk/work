import React, { useState, useEffect, useRef, useCallback } from 'react';
import CustomShapeStopModal from './CustomShapeStopModal';
import { copyHandler } from '../Canvas/Canvas';
// lock shape now: rectangle + top half-circle (width 16mm, height 8mm)
import { useCanvasContext } from '../../contexts/CanvasContext';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useCanvasPropertiesTracker } from '../../hooks/useCanvasPropertiesTracker';
import * as fabric from 'fabric';
import paper from 'paper';
import JsBarcode from 'jsbarcode';
import * as XLSX from 'xlsx';
import UndoRedo from '../UndoRedo/UndoRedo'; // Імпорт компонента
import QRCodeGenerator from '../QRCodeGenerator/QRCodeGenerator';
import BarCodeGenerator from '../BarCodeGenerator/BarCodeGenerator';
import ShapeSelector from '../ShapeSelector/ShapeSelector';
import CutSelector from '../CutSelector/CutSelector';
import IconMenu from '../IconMenu/IconMenu';
import UploadPreview from '../UploadPreview/UploadPreview';
import ShapeProperties from '../ShapeProperties/ShapeProperties';
import { ensureShapeSvgId } from '../../utils/shapeSvgId';
import { fitObjectToCanvas } from '../../utils/canvasFit';
import styles from './Toolbar.module.css';
import {
  exportCanvas,
  addUnsavedSignFromSnapshot,
  deleteUnsavedSign,
  getAllUnsavedSigns,
  addCanvasSnapshotToCurrentProject,
  deleteCanvasFromCurrentProject,
  getProject,
  saveCurrentProject,
  uuid,
} from '../../utils/projectStorage';
import {
  buildQrSvgMarkup,
  computeQrVectorData,
  decorateQrGroup,
  DEFAULT_QR_CELL_SIZE,
} from '../../utils/qrFabricUtils';
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
} from '../../assets/Icons';

const DEFAULT_SHAPE_WIDTH_MM = 120;
const DEFAULT_SHAPE_HEIGHT_MM = 80;
const CUT_STROKE_COLOR = '#FD7714';
const HOLE_FILL_COLOR = '#FFFFFF';
const HOLE_ID_PREFIX = 'hole';
const DEFAULT_RECT_CANVAS_CORNER_RADIUS_MM = 2;
const SIZE_INPUT_DEBOUNCE_MS = 1000;
const Toolbar = ({ formData }) => {
  const {
    canvas,
    globalColors,
    updateGlobalColors,
    isCustomShapeMode,
    setIsCustomShapeMode,
    setCanvasShapeType,
    currentDesignId,
  } = useCanvasContext();
  // Unit conversion helpers (assume CSS 96 DPI)
  const PX_PER_MM = 72 / 25.4;
  const LOCK_ARCH_HEIGHT_MM = 8;
  const MIN_LOCK_HOLE_TOP_GAP_MM = 1.5;
  const LOCK_HOLE_DOWN_SHIFT_MM = 2; // додатково опускаємо отвір
  const LOCK_HOLE_EXTRA_DOWN_MM = 3; // дозволяємо трохи більше простору вниз
  const RECT_HOLE_WIDTH_MM = 5;
  const RECT_HOLE_HEIGHT_MM = 2;
  const RECT_HOLE_MIN_OFFSET_X_MM = 3;
  const RECT_HOLE_MIN_OFFSET_Y_MM = 2;
  // const mmToPx = mm => (typeof mm === 'number' ? Math.round(mm * PX_PER_MM) : 0);
  // NOTE: Fabric supports sub-pixel geometry; avoid rounding to keep holes/cuts accurate.
  const mmToPx = mm => (typeof mm === 'number' ? mm * PX_PER_MM : 0);
  const pxToMm = px => (typeof px === 'number' ? px / PX_PER_MM : 0);
  const holeRadiusPxFromDiameterMm = diameterMm => (Number(diameterMm) || 0) * (PX_PER_MM / 2);
  // Единое округление до 1 знака после запятой для значений в мм (во избежание 5.1999999999)
  const round1 = n => Math.round((Number(n) || 0) * 10) / 10;
  const [activeObject, setActiveObject] = useState(null);
  const [sizeValues, setSizeValues] = useState({
    // Store UI values in millimeters
    width: DEFAULT_SHAPE_WIDTH_MM,
    height: DEFAULT_SHAPE_HEIGHT_MM,
    cornerRadius: DEFAULT_RECT_CANVAS_CORNER_RADIUS_MM,
  });

  // Keep latest values in refs to avoid stale closures (important for debounced size apply)
  const latestSizeValuesRef = useRef(sizeValues);
  useEffect(() => {
    latestSizeValuesRef.current = sizeValues;
  }, [sizeValues]);
  const [currentShapeType, setCurrentShapeType] = useState(null); // Тип поточної фігури
  const hasUserEditedCanvasCornerRadiusRef = useRef(false);
  const rectangleCornerRadiusMmRef = useRef(DEFAULT_RECT_CANVAS_CORNER_RADIUS_MM);

  const latestShapeTypeRef = useRef(currentShapeType);
  useEffect(() => {
    latestShapeTypeRef.current = currentShapeType;
  }, [currentShapeType]);
  // Синхронізація локального currentShapeType з глобальним canvasShapeType та canvas
  useEffect(() => {
    if (currentShapeType) {
      // Оновлюємо глобальний контекст
      if (setCanvasShapeType) {
        setCanvasShapeType(currentShapeType);
      }
      // ВИПРАВЛЕННЯ: Синхронізуємо з canvas
      if (canvas && canvas.get('shapeType') !== currentShapeType) {
        canvas.set('shapeType', currentShapeType);
        console.log('Synced canvas shapeType:', currentShapeType);
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
  // Editable Copies represent the number of EXTRA canvases to create (default: 0)
  const [editableCopiesCount, setEditableCopiesCount] = useState(0);
  const [editableCopiesDraft, setEditableCopiesDraft] = useState('0');
  const editableCopiesFocusedRef = useRef(false);
  const [isEditableCopiesBusy, setIsEditableCopiesBusy] = useState(false);
  const editableCopiesBusyRef = useRef(false);
  const editableCopiesByDesignRef = useRef({});
  const [holesDiameter, setHolesDiameter] = useState(2.5);

  useEffect(() => {
    editableCopiesBusyRef.current = isEditableCopiesBusy;
  }, [isEditableCopiesBusy]);

  useEffect(() => {
    if (editableCopiesFocusedRef.current) return;
    setEditableCopiesDraft(String(Number.isFinite(Number(editableCopiesCount)) ? editableCopiesCount : 0));
  }, [editableCopiesCount]);

  const getEditableCopiesKey = useCallback(() => {
    // Some flows don't set currentDesignId for the first/original canvas.
    if (currentDesignId) return String(currentDesignId);
    try {
      const id =
        localStorage.getItem('currentProjectCanvasId') ||
        localStorage.getItem('currentCanvasId') ||
        window.__currentProjectCanvasId;
      if (id) return String(id);
    } catch {}
    return '__unknown_design__';
  }, [currentDesignId]);

  useEffect(() => {
    const key = getEditableCopiesKey();
    const byDesign = editableCopiesByDesignRef.current || {};
    if (!byDesign[key]) {
      byDesign[key] = {
        count: 0,
        copyCanvasIds: [],
        groupId: null,
      };
    }
    const next = Math.max(0, Math.floor(Number(byDesign[key].count) || 0));
    setEditableCopiesCount(next);
    if (!editableCopiesFocusedRef.current) {
      setEditableCopiesDraft(String(next));
    }
  }, [getEditableCopiesKey]);

  const syncEditableCopies = useCallback(
    async rawNextCount => {
      const nextCount = Math.max(0, Math.floor(Number(rawNextCount) || 0));
      const key = getEditableCopiesKey();

      if (!canvas) {
        const byDesign = editableCopiesByDesignRef.current || {};
        byDesign[key] = byDesign[key] || {
          count: 0,
          copyCanvasIds: [],
          groupId: null,
        };
        byDesign[key].count = nextCount;
        setEditableCopiesCount(nextCount);
        return;
      }

      if (editableCopiesBusyRef.current) return;

      editableCopiesBusyRef.current = true;
      setIsEditableCopiesBusy(true);
      try {
        const byDesign = editableCopiesByDesignRef.current || {};
        const state = byDesign[key] || {
          count: 0,
          copyCanvasIds: [],
          groupId: null,
        };

        const delayMs = 250;
        const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

        // If we're editing an unsaved sign, copies should also be unsaved signs.
        // This avoids forcing project creation and prevents the "first copy creates 2" bug
        // (one being the original persisted into a project canvas).
        let activeUnsavedId = null;
        try {
          activeUnsavedId = localStorage.getItem('currentUnsavedSignId');
        } catch {}

        if (activeUnsavedId) {
          // Keep ids clean
          const unsaved = await getAllUnsavedSigns().catch(() => []);
          const byId = new Map((unsaved || []).map(entry => [entry?.id, entry]));

          if (!state.groupId && Array.isArray(state.copyCanvasIds) && state.copyCanvasIds.length) {
            const first = byId.get(state.copyCanvasIds[0]);
            const inferred = first?.canvasMetadata?.editableCopies?.groupId;
            if (inferred) state.groupId = inferred;
          }

          state.copyCanvasIds = Array.isArray(state.copyCanvasIds)
            ? state.copyCanvasIds.filter(id => {
                const entry = byId.get(id);
                if (!entry) return false;
                const meta = entry?.canvasMetadata?.editableCopies;
                if (!meta) return false;
                if (state.groupId && meta.groupId !== state.groupId) return false;
                if (meta.sourceCanvasId && meta.sourceCanvasId !== activeUnsavedId) return false;
                return true;
              })
            : [];

          state.count = state.copyCanvasIds.length;
          const prevCount = state.count;

          if (nextCount === prevCount) {
            byDesign[key] = state;
            setEditableCopiesCount(prevCount);
            return;
          }

          const delta = nextCount - prevCount;

          if (delta > 0) {
            const toolbarState = window.getCurrentToolbarState?.() || {};
            const baseSnapshot = await exportCanvas(canvas, toolbarState);
            if (!baseSnapshot) return;
            if (!state.groupId) state.groupId = uuid();

            let added = 0;
            const createdIds = [];
            for (let i = 0; i < delta; i += 1) {
              await sleep(delayMs);
              const copyId = uuid();
              const snap = {
                ...baseSnapshot,
                toolbarState: {
                  ...(baseSnapshot.toolbarState || {}),
                  copiesCount: 1,
                },
                copiesCount: 1,
                canvasMetadata: {
                  ...(baseSnapshot.canvasMetadata || {}),
                  editableCopies: {
                    groupId: state.groupId,
                    sourceCanvasId: activeUnsavedId,
                    copyId,
                    createdAt: Date.now(),
                  },
                },
              };

              const created = await addUnsavedSignFromSnapshot(snap);
              const newId = created?.id || null;
              if (!newId) break;
              state.copyCanvasIds.push(newId);
              createdIds.push(newId);
              added += 1;
            }

            state.count = prevCount + added;
            byDesign[key] = state;
            setEditableCopiesCount(state.count);
            try {
              window.dispatchEvent(new CustomEvent('unsaved:signsUpdated'));
            } catch {}
            const nextCanvasId = createdIds[0] || null;
            if (nextCanvasId) {
              try {
                window.dispatchEvent(
                  new CustomEvent('canvas:autoOpen', {
                    detail: { canvasId: nextCanvasId, isUnsaved: true },
                  })
                );
              } catch {}
            }
            return;
          }

          // delta < 0
          const toRemove = Math.min(-delta, state.copyCanvasIds.length);
          for (let i = 0; i < toRemove; i += 1) {
            await sleep(delayMs);
            const id = state.copyCanvasIds.pop();
            if (!id) continue;

            // Safety: only delete entries that match our metadata
            const entry = byId.get(id);
            const meta = entry?.canvasMetadata?.editableCopies;
            const isOurs =
              !!meta &&
              (!state.groupId || meta.groupId === state.groupId) &&
              meta.sourceCanvasId === activeUnsavedId;
            if (!isOurs) continue;

            await deleteUnsavedSign(id).catch(() => {});
          }

          state.count = Math.max(0, prevCount - toRemove);
          byDesign[key] = state;
          setEditableCopiesCount(state.count);
          try {
            window.dispatchEvent(new CustomEvent('unsaved:signsUpdated'));
          } catch {}
          return;
        }

        // Always store editable copies as project canvases.
        // If there is no project yet (common for the first/original canvas), initialize it
        // via the same save pipeline as the rest of the app so we don't break later "new canvas"
        // flows or unsaved-sign transfer logic.
        let currentProjectId = null;
        try {
          currentProjectId = localStorage.getItem('currentProjectId');
        } catch {}

        if (!currentProjectId) {
          await saveCurrentProject(canvas);
          try {
            currentProjectId = localStorage.getItem('currentProjectId');
          } catch {}
        }

        let sourceCanvasId = null;
        try {
          sourceCanvasId =
            (typeof window !== 'undefined' ? window.__currentProjectCanvasId : null) ||
            localStorage.getItem('currentProjectCanvasId') ||
            localStorage.getItem('currentCanvasId') ||
            currentDesignId ||
            null;
        } catch {
          sourceCanvasId = currentDesignId || null;
        }

        // Remove stale / foreign ids (in case something else appended a canvas and we previously mis-attributed it).
        const project = currentProjectId ? await getProject(currentProjectId) : null;
        const projectCanvases = Array.isArray(project?.canvases) ? project.canvases : [];
        const byId = new Map(projectCanvases.map(entry => [entry?.id, entry]));

        if (!state.groupId && Array.isArray(state.copyCanvasIds) && state.copyCanvasIds.length) {
          const first = byId.get(state.copyCanvasIds[0]);
          const inferred = first?.canvasMetadata?.editableCopies?.groupId;
          if (inferred) state.groupId = inferred;
        }

        state.copyCanvasIds = Array.isArray(state.copyCanvasIds)
          ? state.copyCanvasIds.filter(id => {
              const entry = byId.get(id);
              if (!entry) return false;
              const meta = entry?.canvasMetadata?.editableCopies;
              if (!meta) return false;
              if (state.groupId && meta.groupId !== state.groupId) return false;
              if (sourceCanvasId && meta.sourceCanvasId && meta.sourceCanvasId !== sourceCanvasId) {
                return false;
              }
              return true;
            })
          : [];

        // Count reflects number of EXTRA canvases created (not including the source canvas)
        state.count = state.copyCanvasIds.length;

        const prevCount = Math.max(0, Math.floor(Number(state.count) || 0));
        if (nextCount === prevCount) {
          state.count = prevCount;
          byDesign[key] = state;
          setEditableCopiesCount(prevCount);
          return;
        }

        const delta = nextCount - prevCount;

        if (delta > 0) {
          const toolbarState = window.getCurrentToolbarState?.() || {};
          const baseSnapshot = await exportCanvas(canvas, toolbarState);
          if (!baseSnapshot) {
            console.warn('[Editable Copies] Failed to export canvas snapshot');
            return;
          }

          if (!state.groupId) state.groupId = uuid();

          let added = 0;
          const createdIds = [];
          for (let i = 0; i < delta; i += 1) {
            // Small delay to avoid UI freezes and allow storage broadcasts to settle
            // (also matches requested behavior: copy operation feels progressive)
            await sleep(delayMs);

            const copyId = uuid();

            const snap = {
              ...baseSnapshot,
              // Do NOT carry Exact Copies into duplicated canvases.
              toolbarState: {
                ...(baseSnapshot.toolbarState || {}),
                copiesCount: 1,
              },
              copiesCount: 1,
              canvasMetadata: {
                ...(baseSnapshot.canvasMetadata || {}),
                editableCopies: {
                  groupId: state.groupId,
                  sourceCanvasId: sourceCanvasId || currentDesignId,
                  copyId,
                  createdAt: Date.now(),
                },
              },
            };

            const updated = await addCanvasSnapshotToCurrentProject(snap, { setAsCurrent: false });
            const canvases = Array.isArray(updated?.canvases) ? updated.canvases : [];

            // Identify the created canvas robustly by metadata (avoids accidentally grabbing a user-created canvas).
            const createdEntry =
              [...canvases]
                .reverse()
                .find(c => c?.canvasMetadata?.editableCopies?.copyId === copyId) || null;

            const newId = createdEntry?.id || null;
            if (!newId) break; // likely reached max canvases limit

            state.copyCanvasIds.push(newId);
            createdIds.push(newId);
            added += 1;
          }

          const finalCount = prevCount + added;
          state.count = finalCount;
          byDesign[key] = state;
          setEditableCopiesCount(finalCount);
          const nextCanvasId = createdIds[0] || null;
          if (nextCanvasId) {
            try {
              window.dispatchEvent(
                new CustomEvent('canvas:autoOpen', {
                  detail: { canvasId: nextCanvasId, isUnsaved: false },
                })
              );
            } catch {}
          }
          return;
        }

        // delta < 0
        const toRemove = Math.min(-delta, state.copyCanvasIds.length);
        for (let i = 0; i < toRemove; i += 1) {
          await sleep(delayMs);
          const id = state.copyCanvasIds.pop();
          if (!id) continue;

          // Safety: only delete canvases that are confirmed to be ours
          try {
            const currentProjectIdNow = (() => {
              try {
                return localStorage.getItem('currentProjectId');
              } catch {
                return null;
              }
            })();
            const currentProject = currentProjectIdNow ? await getProject(currentProjectIdNow) : null;
            const entry = (currentProject?.canvases || []).find(c => c?.id === id) || null;
            const meta = entry?.canvasMetadata?.editableCopies || null;
            const isOurs =
              !!meta &&
              (!state.groupId || meta.groupId === state.groupId) &&
              (!sourceCanvasId || !meta.sourceCanvasId || meta.sourceCanvasId === sourceCanvasId);
            if (!isOurs) {
              continue;
            }
          } catch {
            // If we can't verify, skip deletion to avoid data loss.
            continue;
          }

          try {
            await deleteCanvasFromCurrentProject(id);
          } catch (err) {
            console.warn('[Editable Copies] Failed to delete copy', id, err);
          }
        }

        const finalCount = Math.max(0, prevCount - toRemove);
        state.count = finalCount;
        byDesign[key] = state;
        setEditableCopiesCount(finalCount);
      } finally {
        editableCopiesBusyRef.current = false;
        setIsEditableCopiesBusy(false);
      }
    },
    [canvas, currentDesignId, getEditableCopiesKey]
  );

  // Для lock: по умолчанию 5мм, тип дырки 2 (сверху), ограничения 2-6мм
  useEffect(() => {
    if (currentShapeType === 'lock') {
      setIsHolesSelected(true);
      setActiveHolesType(2);
      setHolesDiameter(5);
    }
  }, [currentShapeType]);

  // Хардкодим ограничения только для lock и дырки сверху
  const getHolesDiameterLimits = () => {
    if (currentShapeType === 'lock' && activeHolesType === 2) {
      return { min: 2, max: 6, defaultValue: 5 };
    }
    // ...оставить текущие ограничения для других случаев...
    return { min: 2.5, max: 10, defaultValue: 2.5 };
  };

  // Обработчик изменения диаметра дирки
  const handleHolesDiameterChange = value => {
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

  const DEFAULT_BORDER_THICKNESS_PX = 0.67; // зменшено в 3 рази (було 2)
  const BORDER_STROKE_COLOR = '#000000';
  const CUSTOM_BORDER_CANVAS_COLOR = '#000000';
  const CUSTOM_BORDER_EXPORT_COLOR = '#008181';
  const borderStateRef = useRef({
    mode: 'default',
    thicknessPx: DEFAULT_BORDER_THICKNESS_PX,
    // Border button must always create a 2mm custom border (independent from thickness slider)
    customThicknessPx: mmToPx(2),
    defaultThicknessPx: DEFAULT_BORDER_THICKNESS_PX,
  });

  const findBorderObject = useCallback(
    mode => {
      if (!canvas || !canvas.getObjects) return null;
      const objects = canvas.getObjects();
      if (!Array.isArray(objects)) return null;
      if (!mode) {
        return objects.find(obj => obj.isBorderShape) || null;
      }
      return objects.find(obj => obj.isBorderShape && obj.cardBorderMode === mode) || null;
    },
    [canvas]
  );

  const getBorderColor = useCallback(
    (mode = 'default') => {
      // Default thin outline must always be black (do not theme-color it).
      if (mode !== 'custom') return BORDER_STROKE_COLOR;

      // Custom Border-button outline follows the current theme (strokeColor/textColor).
      const themeStroke = globalColors?.strokeColor || globalColors?.textColor || null;
      if (themeStroke) return themeStroke;
      return CUSTOM_BORDER_CANVAS_COLOR;
    },
    [globalColors]
  );

  const removeCanvasOutline = useCallback(() => {
    if (!canvas || !canvas.getObjects) return;
    const outline = canvas.getObjects().find(obj => obj.isCanvasOutline);
    if (outline) {
      canvas.remove(outline);
    }
  }, [canvas]);

  const deriveClipMetrics = useCallback(
    clip => {
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
        (typeof clip.getScaledWidth === 'function' ? clip.getScaledWidth() : clip.width) ??
        bounds?.width ??
        fallbackWidth;
      const scaledHeight =
        (typeof clip.getScaledHeight === 'function' ? clip.getScaledHeight() : clip.height) ??
        bounds?.height ??
        fallbackHeight;

      const centerPoint = typeof clip.getCenterPoint === 'function' ? clip.getCenterPoint() : null;

      const centerX =
        centerPoint?.x ??
        (bounds ? bounds.left + (bounds.width || 0) / 2 : (clip.left ?? 0) + scaledWidth / 2);
      const centerY =
        centerPoint?.y ??
        (bounds ? bounds.top + (bounds.height || 0) / 2 : (clip.top ?? 0) + scaledHeight / 2);

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
  } = useCanvasPropertiesTracker(canvas, globalColors, saveCanvasPropertiesState, {
    currentShapeType,
    cornerRadius: sizeValues ? sizeValues.cornerRadius : 0,
    thickness,
    activeHolesType,
    holesDiameter,
  });

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
      // Custom border (created via Border button) must be exactly 2mm; keep default scaling as-is.
      const strokeForBorder = makeMask
        ? 0
        : mode === 'custom'
          ? effectiveStroke
          : effectiveStroke * 1.8; // зменшено в 3 рази
      if (!clip) {
        const fallback = new fabric.Rect({
          left: centerX,
          top: centerY,
          width: baseWidth,
          height: baseHeight,
          originX: 'center',
          originY: 'center',
          absolutePositioned: true,
          fill: makeMask ? '#000000' : 'transparent',
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
        originX: 'center',
        originY: 'center',
        flipX: !!clip.flipX,
        flipY: !!clip.flipY,
        absolutePositioned: clip.absolutePositioned !== false,
        fill: makeMask ? '#ffffff' : 'transparent',
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
        hoverCursor: 'default',
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

      const clonePathData = path =>
        Array.isArray(path)
          ? path.map(segment => (Array.isArray(segment) ? segment.map(v => v) : segment))
          : path;

      const polygonAreaSigned = pts => {
        if (!Array.isArray(pts) || pts.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          area += (a.x || 0) * (b.y || 0) - (b.x || 0) * (a.y || 0);
        }
        return area / 2;
      };

      const insetConvexPolygon = (pts, inset) => {
        const offset = Number(inset) || 0;
        if (!Array.isArray(pts) || pts.length < 3 || offset <= 0) {
          return Array.isArray(pts) ? pts.map(p => ({ x: p.x, y: p.y })) : [];
        }

        const signedArea = polygonAreaSigned(pts);
        const isCCW = signedArea > 0;

        const norm = v => {
          const len = Math.hypot(v.x, v.y) || 1;
          return { x: v.x / len, y: v.y / len };
        };
        const leftNormal = v => ({ x: -v.y, y: v.x });
        const rightNormal = v => ({ x: v.y, y: -v.x });

        const inwardNormalForEdge = edgeUnit =>
          isCCW ? leftNormal(edgeUnit) : rightNormal(edgeUnit);

        const out = [];
        const n = pts.length;

        for (let i = 0; i < n; i++) {
          const p0 = pts[(i - 1 + n) % n];
          const p1 = pts[i];
          const p2 = pts[(i + 1) % n];

          const e1 = norm({ x: (p1.x || 0) - (p0.x || 0), y: (p1.y || 0) - (p0.y || 0) });
          const e2 = norm({ x: (p2.x || 0) - (p1.x || 0), y: (p2.y || 0) - (p1.y || 0) });

          const n1 = inwardNormalForEdge(e1);
          const n2 = inwardNormalForEdge(e2);

          const bis = { x: n1.x + n2.x, y: n1.y + n2.y };
          const bisLen = Math.hypot(bis.x, bis.y);

          if (bisLen < 1e-6) {
            // nearly straight angle
            out.push({ x: (p1.x || 0) + n1.x * offset, y: (p1.y || 0) + n1.y * offset });
            continue;
          }

          const bisUnit = { x: bis.x / bisLen, y: bis.y / bisLen };
          const denom = bisUnit.x * n1.x + bisUnit.y * n1.y;
          const scale = Math.abs(denom) > 1e-6 ? offset / denom : offset;
          out.push({ x: (p1.x || 0) + bisUnit.x * scale, y: (p1.y || 0) + bisUnit.y * scale });
        }

        return out;
      };

      let borderShape = null;
      switch (clip.type) {
        case 'rect': {
          // IMPORTANT: If a stroked rect sits exactly on the canvas bounds,
          // half of the stroke can be clipped by the HTML canvas edge and look thinner (often noticeable on the right).
          // To keep the OUTER edge on the canvas boundary while keeping the full stroke visible,
          // inset the rect geometry by strokeWidth/2 (i.e., reduce width/height by strokeWidth).
          const insetPx = !makeMask ? strokeForBorder / 2 : 0;
          const rectWidth = !makeMask ? Math.max(0, baseWidth - strokeForBorder) : baseWidth;
          const rectHeight = !makeMask ? Math.max(0, baseHeight - strokeForBorder) : baseHeight;
          const rxRaw = clip.rx ?? 0;
          const ryRaw = clip.ry ?? 0;
          const rx = !makeMask ? Math.max(0, rxRaw - insetPx) : rxRaw;
          const ry = !makeMask ? Math.max(0, ryRaw - insetPx) : ryRaw;

          borderShape = new fabric.Rect({
            ...baseOpts,
            width: rectWidth,
            height: rectHeight,
            rx,
            ry,
          });
          break;
        }
        case 'circle': {
          borderShape = new fabric.Circle({
            ...baseOpts,
            radius:
              clip.radius ?? Math.min(canvas.getWidth?.() || 0, canvas.getHeight?.() || 0) / 2,
          });
          break;
        }
        case 'ellipse': {
          borderShape = new fabric.Ellipse({
            ...baseOpts,
            rx: clip.rx ?? baseWidth / 2,
            ry: clip.ry ?? baseHeight / 2,
          });
          break;
        }
        case 'polygon': {
          const points = Array.isArray(clip.points)
            ? clip.points.map(p => ({ x: p.x, y: p.y }))
            : [];
          if (points.length > 0) {
            const insetPx = !makeMask ? strokeForBorder / 2 : 0;
            const borderPoints = insetPx > 0 ? insetConvexPolygon(points, insetPx) : points;
            borderShape = new fabric.Polygon(borderPoints, baseOpts);
          }
          break;
        }
        case 'path': {
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

        // NOTE: For circles/ellipses a simple scale-inset is geometrically correct.
        // For polygons/paths it can create visible gaps because scaling is not a true normal offset.
        const shouldScaleInset =
          !makeMask && clip && (clip.type === 'circle' || clip.type === 'ellipse');
        const insetScaleX =
          shouldScaleInset && baseWidth > 0 && baseWidth > strokeForBorder
            ? Math.max(0, (baseWidth - strokeForBorder) / baseWidth)
            : 1;
        const insetScaleY =
          shouldScaleInset && baseHeight > 0 && baseHeight > strokeForBorder
            ? Math.max(0, (baseHeight - strokeForBorder) / baseHeight)
            : 1;

        borderShape.set({
          strokeWidth: strokeForBorder,
          strokeUniform: true,
          scaleX: currentScaleX * insetScaleX,
          scaleY: currentScaleY * insetScaleY,
          originX: 'center',
          originY: 'center',
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
            fill: '#000000',
          });
        } else {
          const displayStrokeColor =
            color || (mode === 'custom' ? CUSTOM_BORDER_CANVAS_COLOR : BORDER_STROKE_COLOR);
          const exportStrokeColor =
            mode === 'custom' ? CUSTOM_BORDER_EXPORT_COLOR : displayStrokeColor;
          const exportFill = mode === 'custom' ? 'none' : (borderShape.fill ?? 'transparent');

          borderShape.set({
            isBorderShape: true,
            cardBorderMode: mode,
            cardBorderThicknessPx: thicknessPx,
            id: mode === 'custom' ? 'canvaShapeCustom' : 'canvaShape',
            isCustomBorder: mode === 'custom',
            cardBorderDisplayStrokeColor: displayStrokeColor,
            cardBorderExportStrokeColor: exportStrokeColor,
            cardBorderExportFill: exportFill,
          });

          if (mode === 'custom' && borderShape.fill !== 'transparent') {
            borderShape.set({ fill: 'transparent' });
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
        const maskCenterX = typeof borderShape.left === 'number' ? borderShape.left : 0;
        const maskCenterY = typeof borderShape.top === 'number' ? borderShape.top : 0;
        maskClip.set({
          absolutePositioned: true,
          originX: borderShape.originX ?? 'center',
          originY: borderShape.originY ?? 'center',
          left: maskCenterX,
          top: maskCenterY,
          angle: borderShape.angle ?? 0,
          skewX: borderShape.skewX ?? 0,
          skewY: borderShape.skewY ?? 0,
          flipX: !!borderShape.flipX,
          flipY: !!borderShape.flipY,
        });

        if (maskClip.type === 'path' && maskClip.pathOffset) {
          maskClip.pathOffset = new fabric.Point(
            maskClip.pathOffset.x ?? 0,
            maskClip.pathOffset.y ?? 0
          );
        }

        // IMPORTANT: Do NOT copy borderShape scale/transformMatrix onto the mask.
        // The borderShape may be inset-scaled (to keep the stroke inside), and if the mask
        // inherits that inset it will clip away the outer half of the stroke, making the
        // visible border look offset inward from the shape edge.

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
          obj =>
            obj !== borderShape && obj.isBorderShape && (mode ? obj.cardBorderMode === mode : true)
        )
        .forEach(obj => canvas.remove(obj));

      // Додаємо SVG ID для borderShape
      ensureShapeSvgId(borderShape, canvas, { prefix: 'border' });

      canvas.add(borderShape);
      if (typeof canvas.bringToFront === 'function') {
        canvas.bringToFront(borderShape);
      } else if (typeof canvas.bringObjectToFront === 'function') {
        canvas.bringObjectToFront(borderShape);
      } else if (typeof borderShape.bringToFront === 'function') {
        borderShape.bringToFront();
      }
      let hasCustomAfterUpdate = mode === 'custom';
      if (!hasCustomAfterUpdate) {
        const customBorder = findBorderObject('custom');
        if (customBorder) {
          hasCustomAfterUpdate = true;
          if (typeof canvas.bringToFront === 'function') {
            canvas.bringToFront(customBorder);
          } else if (typeof canvas.bringObjectToFront === 'function') {
            canvas.bringObjectToFront(customBorder);
          } else if (typeof customBorder.bringToFront === 'function') {
            customBorder.bringToFront();
          }
        }
      }
      borderShape.setCoords();
      if (mode === 'custom') {
        borderStateRef.current = {
          ...borderStateRef.current,
          mode: 'custom',
          thicknessPx,
          customThicknessPx: thicknessPx,
        };
      } else {
        borderStateRef.current = {
          ...borderStateRef.current,
          defaultThicknessPx: thicknessPx,
        };
        if (!hasCustomAfterUpdate) {
          borderStateRef.current.mode = 'default';
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

      if (!clip && !findBorderObject('default')) {
        return replaceBorder(DEFAULT_BORDER_THICKNESS_PX, getBorderColor('default'), 'default');
      }

      const fallbackExisting = findBorderObject();
      const resolvedMode =
        opts.mode || fallbackExisting?.cardBorderMode || borderStateRef.current.mode || 'default';
      const existing =
        resolvedMode === 'custom' ? findBorderObject('custom') : findBorderObject('default');

      const desiredCustomPx = borderStateRef.current.customThicknessPx ?? mmToPx(2);
      const desiredDefaultPx =
        borderStateRef.current.defaultThicknessPx ?? DEFAULT_BORDER_THICKNESS_PX;

      const resolvedThicknessPx =
        opts.thicknessPx !== undefined
          ? opts.thicknessPx
          : existing?.cardBorderThicknessPx !== undefined
            ? existing.cardBorderThicknessPx
            : resolvedMode === 'custom'
              ? desiredCustomPx
              : desiredDefaultPx;

      const resolvedColor =
        opts.color || existing?.stroke || getBorderColor(resolvedMode) || '#000000';

      if (
        existing &&
        !forceRebuild &&
        existing.cardBorderThicknessPx === resolvedThicknessPx &&
        (existing.stroke || '#000000') === resolvedColor &&
        existing.cardBorderMode === resolvedMode
      ) {
        if (resolvedMode === 'custom') {
          existing.cardBorderExportStrokeColor = CUSTOM_BORDER_EXPORT_COLOR;
          existing.cardBorderDisplayStrokeColor = getBorderColor('custom');
          existing.cardBorderExportFill = 'none';
          if (existing.fill !== 'transparent') {
            existing.set({ fill: 'transparent' });
          }
        } else {
          const displayStroke = resolvedColor || existing.stroke || BORDER_STROKE_COLOR;
          existing.cardBorderExportStrokeColor =
            existing.cardBorderExportStrokeColor || displayStroke;
          existing.cardBorderDisplayStrokeColor =
            existing.cardBorderDisplayStrokeColor || displayStroke;
          if (!existing.cardBorderExportFill) {
            existing.cardBorderExportFill = existing.fill ?? 'transparent';
          }
        }

        if (resolvedMode === 'custom') {
          borderStateRef.current = {
            ...borderStateRef.current,
            mode: 'custom',
            thicknessPx: resolvedThicknessPx,
            customThicknessPx: resolvedThicknessPx,
          };
          setIsBorderActive(true);
        } else {
          const customBorderExists = !!findBorderObject('custom');
          borderStateRef.current = {
            ...borderStateRef.current,
            defaultThicknessPx: resolvedThicknessPx,
          };
          if (!customBorderExists) {
            borderStateRef.current.mode = 'default';
            borderStateRef.current.thicknessPx = resolvedThicknessPx;
          }
          setIsBorderActive(customBorderExists);
        }
        return existing;
      }

      return replaceBorder(resolvedThicknessPx, resolvedColor, resolvedMode);
    },
    [canvas, findBorderObject, getBorderColor, replaceBorder, setIsBorderActive, mmToPx]
  );

  useEffect(() => {
    if (typeof setCanvasShapeType === 'function') {
      setCanvasShapeType(currentShapeType || 'rectangle');
    }
  }, [currentShapeType, setCanvasShapeType]);
  const toolbarStateRef = useRef(null);
  const prevToolbarStateSerializedRef = useRef('');

  const cloneToolbarState = useCallback(state => {
    if (!state) return null;
    return {
      ...state,
      sizeValues: { ...(state.sizeValues || {}) },
      globalColors: { ...(state.globalColors || {}) },
    };
  }, []);

  const buildToolbarState = useCallback(() => {
    const borderObjects = canvas?.getObjects?.()?.filter(obj => obj?.isBorderShape) || [];
    const hasBorder =
      borderStateRef.current.mode === 'custom' ||
      borderObjects.some(obj => obj.cardBorderMode === 'custom');
    const safeSize = sizeValues || {};
    const safeColors = globalColors || {};

    return {
      currentShapeType: currentShapeType || 'rectangle',
      sizeValues: {
        width: safeSize.width !== undefined ? Number(safeSize.width) || 0 : 0,
        height: safeSize.height !== undefined ? Number(safeSize.height) || 0 : 0,
        cornerRadius: safeSize.cornerRadius !== undefined ? Number(safeSize.cornerRadius) || 0 : 0,
      },
      hasUserEditedCanvasCornerRadius: !!hasUserEditedCanvasCornerRadiusRef.current,
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
    incoming => {
      if (!incoming || typeof incoming !== 'object') return;

      // ВИПРАВЛЕННЯ: Спочатку перевіряємо, чи є shapeType на canvas
      // Якщо є і він відрізняється від incoming, використовуємо canvas shapeType
      const canvasShapeType = canvas?.get?.('shapeType');
      const incomingShapeType = incoming.currentShapeType;

      if (incomingShapeType) {
        // Якщо є canvas shapeType і він збігається з incoming, або якщо canvas shapeType відсутній
        if (!canvasShapeType || canvasShapeType === incomingShapeType) {
          setCurrentShapeType(incomingShapeType);
          console.log('Applied shapeType from toolbar state:', incomingShapeType);
        } else {
          // Canvas має інший shapeType - використовуємо його
          setCurrentShapeType(canvasShapeType);
          console.log(
            'Preserved canvas shapeType over toolbar state:',
            canvasShapeType,
            'vs',
            incomingShapeType
          );
        }
      } else if (canvasShapeType) {
        // Якщо incoming не має shapeType, але canvas має - використовуємо canvas
        setCurrentShapeType(canvasShapeType);
        console.log('Used canvas shapeType (no incoming):', canvasShapeType);
      }

      if (incoming.sizeValues) {
        setSizeValues(prev => ({
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
        try {
          const inferredShape = incoming.currentShapeType || canvas?.get?.('shapeType');
          if (inferredShape === 'rectangle' && incoming.sizeValues.cornerRadius !== undefined) {
            const v = Number(incoming.sizeValues.cornerRadius);
            if (Number.isFinite(v)) rectangleCornerRadiusMmRef.current = v;
          }
        } catch {}
      }

      if (incoming.cornerRadius !== undefined && !incoming.sizeValues) {
        const parsedCorner = Number(incoming.cornerRadius);
        if (Number.isFinite(parsedCorner)) {
          setSizeValues(prev => ({ ...prev, cornerRadius: parsedCorner }));
        }
      }

      if (incoming.thickness !== undefined) {
        setThickness(prev => {
          const parsed = Number(incoming.thickness);
          return Number.isFinite(parsed) ? parsed : prev;
        });
      }

      if (incoming.globalColors) {
        // Уникаємо передчасного перезапису фону: loadDesign сам синхронізує фон та globalColors
        const { backgroundColor, backgroundType, ...otherColors } = incoming.globalColors;

        if (Object.keys(otherColors).length > 0) {
          updateGlobalColors({ ...otherColors });
        }

        console.log('Deferred background sync to load pipeline', {
          incomingBg: backgroundColor,
          incomingBgType: backgroundType,
          preservedBg: canvas?.backgroundColor || canvas?.get?.('backgroundColor'),
          preservedBgType: canvas?.get?.('backgroundType'),
        });
      }

      if (incoming.selectedColorIndex !== undefined) {
        setSelectedColorIndex(prev => {
          const parsed = Number(incoming.selectedColorIndex);
          return Number.isFinite(parsed) ? parsed : prev;
        });
      }

      if (incoming.isAdhesiveTape !== undefined) {
        setIsAdhesiveTape(!!incoming.isAdhesiveTape);
      }

      if (incoming.activeHolesType !== undefined) {
        setActiveHolesType(prev => {
          const parsed = Number(incoming.activeHolesType);
          return Number.isFinite(parsed) ? parsed : prev;
        });
      }

      if (incoming.holesDiameter !== undefined) {
        setHolesDiameter(prev => {
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
        setCopiesCount(prev => {
          const parsed = Number(incoming.copiesCount);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : prev;
        });
      }

      if (incoming.isCustomShapeMode !== undefined) {
        setIsCustomShapeMode(!!incoming.isCustomShapeMode);
      }

      if (incoming.hasBorder !== undefined) {
        const enableCustom = !!incoming.hasBorder;
        // Border is always 2mm and must not depend on thickness.
        const customPx = mmToPx(2);
        borderStateRef.current = {
          ...borderStateRef.current,
          mode: enableCustom ? 'custom' : 'default',
          thicknessPx: enableCustom ? customPx : DEFAULT_BORDER_THICKNESS_PX,
          customThicknessPx: enableCustom
            ? customPx
            : (borderStateRef.current.customThicknessPx ?? customPx),
        };
        setIsBorderActive(enableCustom);
        if (enableCustom) {
          ensureBorderPresence({
            mode: 'default',
            thicknessPx: borderStateRef.current.defaultThicknessPx ?? DEFAULT_BORDER_THICKNESS_PX,
            color: getBorderColor('default'),
          });
          ensureBorderPresence({
            mode: 'custom',
            thicknessPx: customPx,
            color: getBorderColor('custom'),
            forceRebuild: true,
          });
        } else {
          const customBorders =
            canvas
              ?.getObjects?.()
              ?.filter(obj => obj.isBorderShape && obj.cardBorderMode === 'custom') || [];
          if (customBorders.length) {
            customBorders.forEach(borderShape => canvas.remove(borderShape));
          }
          ensureBorderPresence({
            mode: 'default',
            thicknessPx: borderStateRef.current.defaultThicknessPx ?? DEFAULT_BORDER_THICKNESS_PX,
            color: getBorderColor('default'),
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
    // Always compute fresh state: refs (like borderStateRef) and canvas objects
    // can change without changing hook deps, so relying on toolbarStateRef.current
    // can return stale `hasBorder` after resize/toggle.
    const snapshot = buildToolbarState();
    toolbarStateRef.current = snapshot;
    return cloneToolbarState(snapshot);
  }, [buildToolbarState, cloneToolbarState]);

  useEffect(() => {
    const snapshot = buildToolbarState();
    toolbarStateRef.current = snapshot;

    const serialized = JSON.stringify(snapshot);
    if (serialized !== prevToolbarStateSerializedRef.current) {
      prevToolbarStateSerializedRef.current = serialized;
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(
            new CustomEvent('toolbar:changed', {
              detail: cloneToolbarState(snapshot),
            })
          );
        } catch (error) {
          console.warn('Failed to dispatch toolbar:changed', error);
        }
      }
    }
  }, [buildToolbarState, cloneToolbarState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mmToPxLocal = mmValue => Math.round((Number(mmValue) || 0) * PX_PER_MM);
    const pxToMmLocal = pxValue => (Number(pxValue) || 0) / PX_PER_MM;

    const recreateBorder = (incoming = {}) => {
      const enableCustom = !!incoming.hasBorder;
      const restoredThicknessMm = Number(incoming.thickness);
      const customThicknessPx = enableCustom ? mmToPxLocal(2) : DEFAULT_BORDER_THICKNESS_PX;

      if (enableCustom) {
        // Restore thickness only for internal elements; border thickness is fixed.
        if (Number.isFinite(restoredThicknessMm)) {
          setThickness(restoredThicknessMm);
        }
        borderStateRef.current = {
          ...borderStateRef.current,
          mode: 'custom',
          thicknessPx: customThicknessPx,
          customThicknessPx,
        };
        ensureBorderPresence({
          mode: 'default',
          thicknessPx: borderStateRef.current.defaultThicknessPx ?? DEFAULT_BORDER_THICKNESS_PX,
          color: getBorderColor('default'),
        });
        ensureBorderPresence({
          mode: 'custom',
          thicknessPx: customThicknessPx,
          color: getBorderColor('custom'),
          forceRebuild: true,
        });
        setIsBorderActive(true);
        trackBorderChange?.(true);
      } else {
        const customBorders =
          canvas
            ?.getObjects?.()
            ?.filter(obj => obj.isBorderShape && obj.cardBorderMode === 'custom') || [];
        customBorders.forEach(borderShape => canvas.remove(borderShape));
        borderStateRef.current = {
          ...borderStateRef.current,
          mode: 'default',
          thicknessPx: DEFAULT_BORDER_THICKNESS_PX,
          defaultThicknessPx: DEFAULT_BORDER_THICKNESS_PX,
        };
        setIsBorderActive(false);
        ensureBorderPresence({
          mode: 'default',
          thicknessPx: DEFAULT_BORDER_THICKNESS_PX,
          color: getBorderColor('default'),
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
  }, [canvas, applyToolbarState, ensureBorderPresence, getBorderColor, getToolbarState, thickness]);

  // НОВИЙ: Окремий useEffect для forceRestoreCanvasShape (після updateSize)
  useEffect(() => {
    const forceRestoreCanvasShape = toolbarState => {
      if (!canvas || !toolbarState) return;

      const shapeType = toolbarState.currentShapeType || 'rectangle';
      const widthMm = toolbarState.sizeValues?.width || DEFAULT_SHAPE_WIDTH_MM;
      const heightMm = toolbarState.sizeValues?.height || DEFAULT_SHAPE_HEIGHT_MM;
      const rawCorner =
        toolbarState.sizeValues?.cornerRadius !== undefined
          ? toolbarState.sizeValues.cornerRadius
          : toolbarState.cornerRadius;
      const canvasCornerRaw = canvas?.get?.('cornerRadius');
      const canvasCorner = Number(canvasCornerRaw);

      const hasEditedCornerFlag =
        !!toolbarState.hasUserEditedCanvasCornerRadius ||
        !!canvas?.get?.('hasUserEditedCanvasCornerRadius');

      // Backward-compatible inference:
      // older saved states may have cornerRadius but no explicit "hasUserEdited" flag.
      const inferredEditedCorner = (() => {
        if (hasEditedCornerFlag) return true;
        const v1 = Number(rawCorner);
        if (Number.isFinite(v1) && v1 !== 0 && v1 !== DEFAULT_RECT_CANVAS_CORNER_RADIUS_MM)
          return true;
        if (
          Number.isFinite(canvasCorner) &&
          canvasCorner !== 0 &&
          canvasCorner !== DEFAULT_RECT_CANVAS_CORNER_RADIUS_MM
        )
          return true;
        return false;
      })();

      const resolvedCornerMm = (() => {
        const fromToolbar = Number(rawCorner);
        if (Number.isFinite(fromToolbar)) return fromToolbar;
        if (Number.isFinite(canvasCorner)) return canvasCorner;
        return rectangleCornerRadiusMmRef.current;
      })();

      const cornerRadiusMm =
        shapeType === 'rectangle'
          ? inferredEditedCorner
            ? resolvedCornerMm
            : DEFAULT_RECT_CANVAS_CORNER_RADIUS_MM
          : 0;

      // Sync refs and canvas flags so subsequent shape switches preserve *per-canvas* rectangle value
      try {
        if (shapeType === 'rectangle') {
          rectangleCornerRadiusMmRef.current = Number(cornerRadiusMm);
          hasUserEditedCanvasCornerRadiusRef.current = !!inferredEditedCorner;
          canvas.set?.('hasUserEditedCanvasCornerRadius', !!inferredEditedCorner);
          canvas.set?.('cornerRadius', Number(cornerRadiusMm) || 0);
        }
      } catch {}

      console.log('Force restoring canvas shape:', {
        shapeType,
        widthMm,
        heightMm,
        cornerRadiusMm,
      });

      // Встановлюємо shapeType на canvas
      canvas.set('shapeType', shapeType);
      setCurrentShapeType(shapeType);

      // Встановлюємо розміри
      setSizeValues({
        width: widthMm,
        height: heightMm,
        cornerRadius: cornerRadiusMm,
      });

      // Викликаємо updateSize для перебудови clipPath
      setTimeout(() => {
        const hasApprovedCustomShape = !!toolbarState.isCustomShapeApplied;
        const hasClipPath = !!canvas.clipPath;
        if (hasApprovedCustomShape && hasClipPath) {
          try {
            setIsCustomShapeApplied(true);
          } catch {}
          canvas.requestRenderAll();
          return;
        }
        if (updateSize) {
          updateSize({
            widthMm: widthMm,
            heightMm: heightMm,
            cornerRadiusMm: cornerRadiusMm,
            __skipAutoFit: true,
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
        const crMm = Number(canvas.get?.('cornerRadius')) || 0;
        const storedW = Number(canvas.get?.('designWidthMm'));
        const storedH = Number(canvas.get?.('designHeightMm'));
        const wMm = Number.isFinite(storedW)
          ? Math.round(storedW * 10) / 10
          : Number(
              pxToMm(
                typeof canvas.getWidth === 'function' ? canvas.getWidth() : canvas.width || 0
              ).toFixed(1)
            );
        const hMm = Number.isFinite(storedH)
          ? Math.round(storedH * 10) / 10
          : Number(
              pxToMm(
                typeof canvas.getHeight === 'function' ? canvas.getHeight() : canvas.height || 0
              ).toFixed(1)
            );
        // Не змінюємо форму, лише відображаємо актуальні розміри/радіус у UI
        setSizeValues(prev => ({
          ...prev,
          width: wMm,
          height: hMm,
          cornerRadius: crMm,
        }));
      } catch (e) {
        console.warn('syncToolbarSizeFromCanvas failed', e);
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
    ensureBorderPresence({ mode: 'default' });
    if (borderStateRef.current.mode === 'custom' || findBorderObject('custom')) {
      ensureBorderPresence({
        mode: 'custom',
        thicknessPx: borderStateRef.current.customThicknessPx ?? mmToPx(2),
      });
    }
  }, [ensureBorderPresence, findBorderObject, mmToPx]);

  useEffect(() => {
    if (!canvas || typeof canvas.on !== 'function') {
      setIsBorderActive(false);
      return undefined;
    }

    const syncBorderState = () => {
      const customBorder = findBorderObject('custom');
      const isCustomMode = borderStateRef.current.mode === 'custom' || !!customBorder;
      setIsBorderActive(isCustomMode);
    };

    syncBorderState();
    canvas.on('object:added', syncBorderState);
    canvas.on('object:removed', syncBorderState);

    return () => {
      canvas.off?.('object:added', syncBorderState);
      canvas.off?.('object:removed', syncBorderState);
    };
  }, [canvas, findBorderObject]);

  // Очистити canvas з збереженням фону
  const clearCanvasPreserveTheme = () => {
    if (!canvas) return;
    const bg =
      canvas.backgroundColor ||
      canvas.get('backgroundColor') ||
      globalColors?.backgroundColor ||
      '#FFFFFF';
    canvas.clear();
    canvas.set('backgroundColor', bg);
    canvas.requestRenderAll();
    // ВАЖЛИВО: Не скидаємо режим/товщину бордера при зміні базової фігури
    // (щоб створення нової фігури відразу підхопило останній вибір користувача)
    // Реконструкція відбудеться після встановлення нового clipPath через ensureBorderPresence().
  };

  // Зміна фігури полотна: зберігаємо всі елементи, але прибираємо бордер/маску/outline.
  // Потім бордер перебудовується під новий clipPath.
  const preserveElementsOnShapeChange = () => {
    if (!canvas) return;
    try {
      canvas.discardActiveObject?.();
    } catch {}
    try {
      const objects = canvas.getObjects?.() || [];

      const isCircleWithLineDefaultElement = o =>
        !!(
          o &&
          (o.isCircleWithLineCenterLine ||
            o.isCircleWithLineTopText ||
            o.isCircleWithLineBottomText ||
            o.name === 'circleWithLineCenterLine' ||
            o.name === 'circleWithLineTopText' ||
            o.name === 'circleWithLineBottomText')
        );

      const isCircleWithCrossDefaultElement = o =>
        !!(
          o &&
          (o.isCircleWithCrossHorizontalLine ||
            o.isCircleWithCrossVerticalLine ||
            o.isCircleWithCrossTopText ||
            o.isCircleWithCrossBottomLeftText ||
            o.isCircleWithCrossBottomRightText ||
            o.name === 'circleWithCrossHorizontalLine' ||
            o.name === 'circleWithCrossVerticalLine' ||
            o.name === 'circleWithCrossTopText' ||
            o.name === 'circleWithCrossBottomLeftText' ||
            o.name === 'circleWithCrossBottomRightText')
        );

      objects
        .filter(o => {
          if (!o) return false;
          if (o.isBorderShape || o.isBorderMask || o.isCanvasOutline) return true;
          if (o.isCutElement && o.cutType === 'hole') return true;
          // IMPORTANT: When switching away from these two special canvas shapes,
          // do NOT transfer their default (auto-created) text/line elements.
          // All user-added elements must continue to transfer as before.
          if (currentShapeType === 'circleWithLine') {
            return isCircleWithLineDefaultElement(o);
          }
          if (currentShapeType === 'circleWithCross') {
            return isCircleWithCrossDefaultElement(o);
          }
          return false;
        })
        .forEach(o => {
          try {
            canvas.remove(o);
          } catch {}
        });
      canvas.requestRenderAll?.();
    } catch {}
  };

  const rebuildCanvasBordersAfterShapeChange = () => {
    if (!canvas) return;
    try {
      const toRemove = (canvas.getObjects?.() || []).filter(
        o => o && (o.isBorderShape || o.isBorderMask)
      );
      toRemove.forEach(o => {
        try {
          canvas.remove(o);
        } catch {}
      });
    } catch {}

    try {
      // Default border (if your pipeline uses it) should be rebuilt against the new clipPath.
      ensureBorderPresence?.({
        mode: 'default',
        thicknessPx:
          borderStateRef.current.defaultThicknessPx ??
          borderStateRef.current.thicknessPx ??
          DEFAULT_BORDER_THICKNESS_PX,
        color: getBorderColor?.('default'),
        forceRebuild: true,
      });

      const shouldHaveCustom =
        borderStateRef.current.mode === 'custom' || !!findBorderObject?.('custom');
      if (shouldHaveCustom) {
        ensureBorderPresence?.({
          mode: 'custom',
          thicknessPx: borderStateRef.current.customThicknessPx ?? mmToPx(2),
          color: getBorderColor?.('custom'),
          forceRebuild: true,
        });
      }
    } catch {}

    try {
      canvas.requestRenderAll?.();
    } catch {}

    // Always rebuild holes after the new clipPath/shape is applied.
    // This keeps holes aligned to the new canvas geometry.
    try {
      if (typeof resetHolesToNone === 'function') {
        resetHolesToNone();
      } else {
        clearExistingHoles?.();
        setIsHolesSelected?.(false);
        setActiveHolesType?.(1);
      }
    } catch {}
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
    currentShapeType === 'circle' ||
    currentShapeType === 'oval' ||
    currentShapeType === 'ellipse' ||
    currentShapeType === 'circleWithLine' ||
    currentShapeType === 'circleWithCross' ||
    currentShapeType === 'leftArrow' ||
    currentShapeType === 'rightArrow';
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
  const withShapePick = fn => () => {
    fn();
    setHasUserPickedShape(true);
    // При виборі нової фігури — виходимо з режиму кастомної фігури
    if (isCustomShapeMode) exitCustomShapeMode();
    // Нова фігура => скидаємо прапорець кастомного застосування
    setIsCustomShapeApplied(false);
  };

  // Custom shape теперь дозволений для всіх типів
  const blockedCustomTypes = new Set([
    'circle',
    'ellipse', // disable custom for oval
    'halfCircle',
    'extendedHalfCircle',
    'circleWithLine',
    'circleWithCross',
  ]);

  // Extract corner points of current clipPath for ANY base shape.
  const extractBaseCorners = () => {
    if (!canvas || !canvas.clipPath) return [];
    const cp = canvas.clipPath;
    // Polygon: просто копируем
    if (cp.type === 'polygon' && Array.isArray(cp.points)) {
      return cp.points.map(p => ({ x: p.x, y: p.y }));
    }
    // Rect
    if (cp.type === 'rect') {
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
    if (cp.type === 'circle' || cp.type === 'ellipse') {
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
      const minX = Math.min(...pts.map(p => p.x));
      const minY = Math.min(...pts.map(p => p.y));
      return pts.map(p => ({ x: p.x - minX, y: p.y - minY }));
    }
    // Path (стрілки, адаптивні трикутники, інші складні фігури)
    if (cp.type === 'path' && cp.path) {
      // Берём конечные точки сегментов. cp.path — массив команд fabric: ['M',x,y], ['L',x,y], ['C',...x,y], ['Q',...x,y], etc.
      const raw = cp.path;
      const points = [];
      let lastX = null,
        lastY = null;
      raw.forEach(seg => {
        const cmd = seg[0];
        // последние координаты сегмента — конец
        let x = null,
          y = null;
        switch (cmd) {
          case 'M':
          case 'L':
          case 'T':
            x = seg[1];
            y = seg[2];
            break;
          case 'H': // горизонтальная линия
            x = seg[1];
            y = lastY;
            break;
          case 'V':
            x = lastX;
            y = seg[1];
            break;
          case 'C': // кубическая Безье: ... , x,y в конце
            x = seg[5];
            y = seg[6];
            break;
          case 'S':
            x = seg[3];
            y = seg[4];
            break;
          case 'Q':
            x = seg[3];
            y = seg[4];
            break;
          case 'Z':
          case 'z':
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
      const minX = Math.min(...points.map(p => p.x));
      const minY = Math.min(...points.map(p => p.y));
      return points.map(p => ({ x: p.x - minX, y: p.y - minY }));
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
    cornerHandlesRef.current.forEach(h => canvas.remove(h));
    cornerHandlesRef.current = [];
  };

  // Base (non-rounded) points for supported polygonal shapes
  const getBaseShapePoints = (type, w, h) => {
    switch (type) {
      case 'rectangle':
        return [
          { x: 0, y: 0 },
          { x: Math.max(0, w - 1), y: 0 },
          { x: Math.max(0, w - 1), y: Math.max(0, h - 1) },
          { x: 0, y: Math.max(0, h - 1) },
        ];
      case 'triangle':
        return [
          { x: w / 2, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ];
      case 'hexagon':
        return [
          { x: w * 0.25, y: 0 },
          { x: w * 0.75, y: 0 },
          { x: w, y: h * 0.5 },
          { x: w * 0.75, y: h },
          { x: w * 0.25, y: h },
          { x: 0, y: h * 0.5 },
        ];
      case 'octagon':
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
      case 'arrowLeft':
        return [
          { x: 0, y: h * 0.5625 },
          { x: w * 0.25, y: h * 0.1875 },
          { x: w * 0.25, y: h * 0.375 },
          { x: w, y: h * 0.375 },
          { x: w, y: h * 0.75 },
          { x: w * 0.25, y: h * 0.75 },
          { x: w * 0.25, y: h * 0.9375 },
        ];
      case 'arrowRight':
        return [
          { x: w, y: h * 0.5625 },
          { x: w * 0.75, y: h * 0.1875 },
          { x: w * 0.75, y: h * 0.375 },
          { x: 0, y: h * 0.375 },
          { x: 0, y: h * 0.75 },
          { x: w * 0.75, y: h * 0.75 },
          { x: w * 0.75, y: h * 0.9375 },
        ];
      case 'flag':
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
      case 'diamond':
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
      pts.map(p => ({ x: p.x, y: p.y })),
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
    if (!rPx || rPx <= 0) return points.map(p => ({ ...p }));
    const n = points.length;
    if (n < 3) return points.map(p => ({ ...p }));
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

  const applyCornerRadiusToCurrentPolygon = cornerRadiusMm => {
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
  const polygonSelfIntersects = pts => {
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
    pts.forEach(p => {
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
    setSizeValues(prev => ({
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
    document.addEventListener('mousemove', onDomDragMove, true);
    document.addEventListener('mouseup', onDomDragEnd, true);
  };

  const onDomDragMove = e => {
    const st = dragStateRef.current;
    if (!st || st.index === undefined) return;
    if (!canvas) return;
    const rect = canvas.upperCanvasEl.getBoundingClientRect();
    // Якщо під час drag змінився масштаб (zoom) – перерахуємо scale на льоту
    let scaleX = st.scaleX;
    let scaleY = st.scaleY;
    const currentScaleX = rect.width / canvas.getWidth();
    const currentScaleY = rect.height / canvas.getHeight();
    if (Math.abs(currentScaleX - scaleX) > 1e-3 || Math.abs(currentScaleY - scaleY) > 1e-3) {
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
        if (internalAngle(snapshot, i) >= MIN_ANGLE && !polygonSelfIntersects(snapshot)) {
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
    document.removeEventListener('mousemove', onDomDragMove, true);
    document.removeEventListener('mouseup', onDomDragEnd, true);
  };

  const enterCustomShapeMode = () => {
    if (!canvas) return;
    if (isCustomShapeMode) return;
    // Blocked types (e.g., ellipse/oval, circles, extended half-circles)
    if (blockedCustomTypes.has(currentShapeType)) return;
    let corners = [];
    // Якщо застосовано cornerRadius та clip ще не кастом – беремо базову (неокруглену) форму
    if (sizeValues.cornerRadius > 0 && canvas.clipPath && !canvas.clipPath.isCustomEdited) {
      const wPx = mmToPx(sizeValues.width);
      const hPx = mmToPx(sizeValues.height);
      const basePts = getBaseShapePoints(currentShapeType, wPx, hPx);
      if (basePts && basePts.length >= 3) {
        corners = basePts;
        // Оновлюємо UI значення cornerRadius на 0, щоб відобразити відсутність округлення у кастомі
        setSizeValues(prev => ({ ...prev, cornerRadius: 0 }));
        // Зберігаємо оригінальний clip для можливого відновлення (Cancel)
        originalClipRef.current = canvas.clipPath;
        // Перемикаємо clipPath на неокруглений полігон
        canvas.clipPath = new fabric.Polygon(
          basePts.map(p => ({ ...p })),
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
      canvas.clipPath.__baseCustomCorners = baseCornersRef.current.map(p => ({
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
      document.removeEventListener('mousedown', outsideCustomListenerRef.current, true);
      outsideCustomListenerRef.current = null;
    }
  };

  // Перепозиціонування та масштабування DOM-хендлів при zoom / resize / рендерах canvas
  useEffect(() => {
    if (!isCustomShapeMode || !canvas) return;
    const handleWheel = e => {
      if (e.ctrlKey || e.metaKey) {
        // ймовірно змінюємо zoom — оновити на наступний кадр
        positionHandles();
      }
    };
    const handleResize = () => positionHandles();
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });
    const afterRender = () => {
      // Під час drag або змін – оновлення позицій
      if (isCustomShapeMode) positionHandles();
    };
    canvas.on('after:render', afterRender);
    // Початковий виклик (на випадок якщо zoom вже не 1)
    positionHandles();
    return () => {
      window.removeEventListener('resize', handleResize, { passive: true });
      window.removeEventListener('wheel', handleWheel, { passive: true });
      canvas.off('after:render', afterRender);
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
        handleInputChange('cornerRadius', 50, 0);
      }
      // Теперь включаем кастом-шейп — corners будут взяты уже от неокругленной фигуры
      enterCustomShapeMode();
    }
  };

  // Глобальний helper: логічний розмір canvas (без масштабу)
  const getLogicalCanvasSize = () => {
    if (!canvas) return { width: 0, height: 0 };
    const zoom = typeof canvas.getZoom === 'function' ? canvas.getZoom() : 1;
    return {
      width: Math.round(canvas.getWidth() / (zoom || 1)),
      height: Math.round(canvas.getHeight() / (zoom || 1)),
    };
  };

  // (Видалено mouse:down: заважав drag якорів)
  useEffect(() => {
    if (!canvas) return;
    // Хелпер: санація контролів об'єкта, щоб виключити падіння у drawControls при першому кліку
    const sanitizeObjectControls = obj => {
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
          Object.keys(obj.controls).forEach(k => {
            if (!obj.controls[k]) delete obj.controls[k];
          });
        }
        // Перевіряємо кожен контроль
        Object.keys(obj.controls || {}).forEach(k => {
          const ctrl = obj.controls[k];
          const base = baseControls[k];
          if (
            !ctrl ||
            typeof ctrl.positionHandler !== 'function' ||
            typeof ctrl.render !== 'function'
          ) {
            if (base) obj.controls[k] = base;
            else delete obj.controls[k];
          }
        });
        // Безпечна обгортка positionHandler: завжди повертаємо {x,y}
        Object.keys(obj.controls || {}).forEach(k => {
          const ctrl = obj.controls[k];
          if (!ctrl) return;
          if (!ctrl.__safeWrapped && typeof ctrl.positionHandler === 'function') {
            const original = ctrl.positionHandler;
            ctrl.positionHandler = function (...args) {
              try {
                const p = original.apply(this, args);
                if (p && typeof p.x === 'number' && typeof p.y === 'number') return p;
              } catch {}
              const center =
                typeof obj.getCenterPoint === 'function'
                  ? obj.getCenterPoint()
                  : { x: obj.left || 0, y: obj.top || 0 };
              return { x: center.x, y: center.y };
            };
            ctrl.__safeWrapped = true;
          }
        });
        if (typeof obj.cornerSize !== 'number' || !isFinite(obj.cornerSize)) obj.cornerSize = 13;
        if (typeof obj.setCoords === 'function') obj.setCoords();
      } catch {}
    };
    // init canvas listeners
    canvas.on('selection:created', () => {
      const obj = canvas.getActiveObject();
      // Санітуємо контролли активного об'єкта для виключення падіння при першому кліку
      sanitizeObjectControls(obj);
      if (obj && (obj.name === 'vertex' || obj.name === 'cornerHandle')) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }
      setActiveObject(obj);
    });
    canvas.on('selection:updated', () => {
      const obj = canvas.getActiveObject();
      sanitizeObjectControls(obj);
      if (obj && (obj.name === 'vertex' || obj.name === 'cornerHandle')) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }
      setActiveObject(obj);
    });
    canvas.on('selection:cleared', () => {
      setActiveObject(null);
      // Коли нічого не вибрано, показуємо розміри canvas
      const storedW = Number(canvas.get?.('designWidthMm'));
      const storedH = Number(canvas.get?.('designHeightMm'));
      const widthMm = Number.isFinite(storedW)
        ? Math.round(storedW * 10) / 10
        : (() => {
            const sz = getLogicalCanvasSize();
            return Number(pxToMm(sz.width).toFixed(1));
          })();
      const heightMm = Number.isFinite(storedH)
        ? Math.round(storedH * 10) / 10
        : (() => {
            const sz = getLogicalCanvasSize();
            return Number(pxToMm(sz.height).toFixed(1));
          })();
      const crMm = Number(canvas.get?.('cornerRadius')) || 0;
      setSizeValues({
        width: widthMm,
        height: heightMm,
        cornerRadius: crMm,
      });
    });
    canvas.on('object:modified', () => {
      // Не підлаштовуємо поля розмірів під модифікації випадкових об'єктів
    });

    // Ініціалізуємо початкові значення розмірів canvas
    {
      const storedW = Number(canvas.get?.('designWidthMm'));
      const storedH = Number(canvas.get?.('designHeightMm'));
      const sz = getLogicalCanvasSize();
      setSizeValues({
        width: Number.isFinite(storedW)
          ? Math.round(storedW * 10) / 10
          : Number(pxToMm(sz.width).toFixed(1)),
        height: Number.isFinite(storedH)
          ? Math.round(storedH * 10) / 10
          : Number(pxToMm(sz.height).toFixed(1)),
        cornerRadius: Number(canvas.get?.('cornerRadius')) || 0,
      });
    }
    // Блокуємо відкриття пропертей по dblclick на якорі
    const onDblClick = opt => {
      const t = opt?.target;
      if (t && (t.name === 'vertex' || t.name === 'cornerHandle')) {
        if (isShapePropertiesOpen) setIsShapePropertiesOpen(false);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }
      if (t && t.isQRCode) {
        try {
          canvas.setActiveObject(t);
        } catch {}
        try {
          setActiveObject(t);
        } catch {}
        try {
          if (isShapePropertiesOpen) setIsShapePropertiesOpen(false);
        } catch {}
        setIsQrOpen(true);
      }
    };
    canvas.on('mouse:dblclick', onDblClick);
    return () => {
      if (canvas) {
        canvas.off('mouse:dblclick');
        canvas.off('selection:created');
        canvas.off('selection:updated');
        canvas.off('selection:cleared');
        canvas.off('object:modified');
      }
    };
  }, [canvas]);
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('toolbar:changed'));
    } catch {
      // no-op
    }
  }, [sizeValues?.width, sizeValues?.height, thickness, isAdhesiveTape]);

  // Застосовуємо дефолтну схему кольорів при завантаженні
  useEffect(() => {
    if (canvas) {
      updateColorScheme('#000000', '#FFFFFF', 'solid', 0);
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

      const rLocal = Math.max(0, Math.min(rMaxGlobal, len1 / 2 - 0.001, len2 / 2 - 0.001));

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
    if (!points || points.length < 3) return '';
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
      d0 += ' Z';
      return d0;
    }

    let d = '';
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

      const rLocal = Math.max(0, Math.min(rMaxGlobal, len1 / 2 - 0.001, len2 / 2 - 0.001));

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
    d += ' Z';
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
        originX: 'center',
        originY: 'center',
        left: width / 2,
        top: height / 2,
      });
      path.pathOffset = new fabric.Point(width / 2, height / 2);
    } catch {
      try {
        path.set({
          originX: 'center',
          originY: 'center',
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

    let path = '';

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
            Math.min(50, Math.round(((startCornerAngle - angleLeftCorner) * r) / 6))
          ); // більше точок для плавності
          for (let i = 0; i <= cornerSteps; i++) {
            const t = i / cornerSteps;
            const ang = startCornerAngle + (angleLeftCorner - startCornerAngle) * t;
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
            Math.min(100, Math.round(((angleLeftTop - angleRightTop) * Rbase) / 5))
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
            const ang = angleRightCorner + (endCornerAngle - angleRightCorner) * t;
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
            const k = Math.min(1, Math.max(0, (r - sideLen * 0.6) / (sideLen * 0.4))); // 0 при 0.6, 1 при >=1.0
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
      p => p.x >= 0,
      (a, b) => intersectX(0, a, b)
    );
    // Right x<=width
    pts = clipEdge(
      pts,
      p => p.x <= width,
      (a, b) => intersectX(width, a, b)
    );
    // Top y>=0
    pts = clipEdge(
      pts,
      p => p.y >= 0,
      (a, b) => intersectY(0, a, b)
    );
    // Bottom y<=height
    pts = clipEdge(
      pts,
      p => p.y <= height,
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
    console.log('[adaptiveTriangle] getAdaptiveTriangleData ratio:', {
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
    if (canvas && typeof canvas.set === 'function') {
      const normalizedCorner = Number.isFinite(Number(cornerRadiusMm)) ? Number(cornerRadiusMm) : 0;
      canvas.set('cornerRadius', normalizedCorner);

      // Persist explicit per-canvas edit intent.
      // Default logic (2mm) remains when user never edited.
      try {
        const effectiveType = canvas?.get?.('shapeType') || currentShapeType;
        if (effectiveType === 'rectangle' && editedKey === 'cornerRadius') {
          canvas.set('hasUserEditedCanvasCornerRadius', true);
        }
      } catch {}

      // Зберігаємо точні розміри в мм, щоб інпути тулбара не «пливли» через округлення px.
      const normalizedWidthMm = Number.isFinite(Number(widthMm)) ? Number(widthMm) : 0;
      const normalizedHeightMm = Number.isFinite(Number(heightMm)) ? Number(heightMm) : 0;
      canvas.set('designWidthMm', normalizedWidthMm);
      canvas.set('designHeightMm', normalizedHeightMm);
    }

    const effectiveShapeType = canvas?.get?.('shapeType') || currentShapeType;

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
        (canvas.clipPath.type === 'polygon'
          ? canvas.clipPath.points.map(p => ({ x: p.x, y: p.y }))
          : []);
      if (basePts.length >= 3) {
        const rPx = mmToPx(cornerRadiusMm || 0);
        if (rPx <= 0) {
          canvas.clipPath = new fabric.Polygon(
            basePts.map(p => ({ ...p })),
            {
              left: 0,
              top: 0,
              absolutePositioned: true,
              isCustomEdited: true,
              __baseCustomCorners: basePts.map(p => ({ ...p })),
            }
          );
        } else {
          const rounded = [];
          const n = basePts.length;
          const segPerCorner = Math.max(4, Math.min(24, Math.round(Math.sqrt(rPx))));
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
              (Math.min(len1, len2) * Math.sin(angle / 2)) / (1 + Math.sin(angle / 2))
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
            __baseCustomCorners: basePts.map(p => ({ ...p })),
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
      const repositionObjectsForResize = (prevW, prevH, nextW, nextH) => {
        if (!canvas || typeof canvas.getObjects !== 'function') return;
        const oldW = Number(prevW) || 0;
        const oldH = Number(prevH) || 0;
        const newW = Number(nextW) || 0;
        const newH = Number(nextH) || 0;
        if (oldW <= 0 || oldH <= 0 || newW <= 0 || newH <= 0) return;
        const sx = newW / oldW;
        const sy = newH / oldH;
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
        if (Math.abs(sx - 1) < 1e-6 && Math.abs(sy - 1) < 1e-6) return;

        const objects = canvas.getObjects() || [];
        objects.forEach(obj => {
          if (!obj) return;

          // Skip system/service objects.
          if (obj.isBorderShape || obj.isBorderMask || obj.isCanvasOutline) return;
          if (obj.isCutElement && obj.cutType === 'hole') return;
          if (typeof obj.id === 'string' && obj.id.startsWith(`${HOLE_ID_PREFIX}-`)) return;

          const left = obj.left;
          const top = obj.top;
          if (typeof left !== 'number' || typeof top !== 'number') return;

          try {
            obj.set({ left: left * sx, top: top * sy });
            obj.setCoords?.();
          } catch {}
        });
      };

      const enforceAutoFitObjects = () => {
        if (overrides.__skipAutoFit) return;
        if (!canvas || typeof canvas.getObjects !== 'function') return;
        const objects = canvas.getObjects() || [];
        objects.forEach(obj => {
          if (!obj) return;
          // Skip system/service objects.
          if (obj.isBorderShape || obj.isBorderMask || obj.isCanvasOutline) return;
          if (obj.isCutElement && obj.cutType === 'hole') return;
          if (typeof obj.id === 'string' && obj.id.startsWith(`${HOLE_ID_PREFIX}-`)) return;

          const isCandidate =
            !!obj.fromIconMenu ||
            !!obj.isQRCode ||
            !!obj.isBarCode ||
            !!obj.shapeSvgId ||
            !!obj.shapeType ||
            !!obj.isUploadedImage;

          if (!isCandidate) return;

          try {
            fitObjectToCanvas(canvas, obj, { maxRatio: 0.6 });
          } catch {}
        });
      };

      // Спеціальна обробка для адаптивного трикутника
      if (effectiveShapeType === 'adaptiveTriangle') {
        const prevW = canvas.getWidth?.() || canvas.width || 0;
        const prevH = canvas.getHeight?.() || canvas.height || 0;
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
          if (editedKey === 'height' && editedIsDecrease) {
            // НОВА ЛОГІКА: дозвіл зменшувати висоту — пропорційно зменшуємо ширину
            finalHeight = inputHeight;
            finalWidth = refRatio * finalHeight;
            setSizeValues(prev => ({
              ...prev,
              width: Number(pxToMm(finalWidth).toFixed(1)),
              height: Number(pxToMm(finalHeight).toFixed(1)),
            }));
          } else {
            // СТАРА ЛОГІКА: при розширенні — автоматично збільшуємо висоту
            const scale = inputWidth / refW;
            finalHeight = refH * scale;
            setSizeValues(prev => ({
              ...prev,
              height: Number(pxToMm(finalHeight).toFixed(1)),
            }));
          }
        }

        // Встановлюємо розміри canvas
        canvas.setDimensions({ width: finalWidth, height: finalHeight });

        // Keep elements in the same relative position after resize.
        repositionObjectsForResize(prevW, prevH, finalWidth, finalHeight);

        // Keep certain newly-added elements within 60% of canvas after resize.
        enforceAutoFitObjects();

        // Створюємо clipPath з оновленими розмірами
        const triData = getAdaptiveTriangleData(finalWidth, finalHeight);
        console.log(
          '[adaptiveTriangle] updateSize: isFull=',
          triData.isFull,
          'points=',
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
              const d = makeRoundedTrianglePath(finalWidth, finalHeight, rCorner);
              try {
                const svgNS = 'http://www.w3.org/2000/svg';
                const path = document.createElementNS(svgNS, 'path');
                path.setAttribute('d', d);
                const total = path.getTotalLength();
                const target = Math.min(1400, Math.max(160, Math.round(total)));
                const triRoundedPts = [];
                for (let i = 0; i <= target; i++) {
                  const p = path.getPointAtLength((total * i) / target);
                  triRoundedPts.push({ x: p.x, y: p.y });
                }
                pts = clipPolygonWithRect(triRoundedPts, finalWidth, finalHeight);
              } catch (e) {
                // fallback до 5-кутної логіки
                const seg = Math.max(8, Math.min(24, Math.round(rCorner / 2)));
                const weights = getAdaptivePentagonCornerWeights(
                  pts,
                  finalWidth,
                  finalHeight,
                  cornerRadiusMm
                );
                pts = sampleRoundedPolygonPerCornerFlexible(pts, rCorner, seg, weights);
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
              pts = sampleRoundedPolygonPerCornerFlexible(pts, rCorner, seg, weights);
            }
          }
          canvas.clipPath = new fabric.Polygon(pts, {
            absolutePositioned: true,
          });
        }

        // Оновлюємо контур
        updateCanvasOutline();

        ensureBorderPresence({
          mode: 'default',
          forceRebuild: true,
        });
        if (borderStateRef.current.mode === 'custom' || findBorderObject('custom')) {
          ensureBorderPresence({
            mode: 'custom',
            thicknessPx: borderStateRef.current.customThicknessPx ?? mmToPx(2),
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

      if (effectiveShapeType === 'halfCircle') {
        // Зберігаємо справжній півкруг: ширина = 2 * висота (height = width/2)
        // Визначаємо, яку величину змінював користувач (прийшла в overrides)
        const changedWidth = Object.prototype.hasOwnProperty.call(overrides, 'widthMm');
        const changedHeight = Object.prototype.hasOwnProperty.call(overrides, 'heightMm');
        if (changedWidth && !changedHeight) {
          effHeightMm = round1(effWidthMm / 2);
        } else if (changedHeight && !changedWidth) {
          effWidthMm = round1(effHeightMm * 2);
        } else {
          // Обидва або жодного — пріоритет ширина
          effHeightMm = round1(effWidthMm / 2);
        }
        // Оновлюємо state (щоб інпут висоти відобразив скориговане значення)
        setSizeValues(prev => ({
          ...prev,
          width: effWidthMm,
          height: effHeightMm,
        }));
      } else if (effectiveShapeType === 'roundTop') {
        // roundTop: пропорція верхнього півкола повинна зберігатися — воно ідеально кругле (діаметр = ширина фігури)
        // Вихідний базовий path: ширина 100, висота 100 (верхній півкруг радіуса 50 + прямі стінки вниз)
        // Щоб зберегти півкруг, половина верхньої висоти повинна дорівнювати радіусу = width/2.
        // Тут приймаємо рішення фіксувати повну висоту = ширина (щоб верхній сегмент масштабувався рівно).
        const changedWidth = Object.prototype.hasOwnProperty.call(overrides, 'widthMm');
        const changedHeight = Object.prototype.hasOwnProperty.call(overrides, 'heightMm');
        if (changedWidth && !changedHeight) {
          effHeightMm = effWidthMm; // висота підлаштовується під ширину
        } else if (changedHeight && !changedWidth) {
          effWidthMm = effHeightMm; // ширина підлаштовується під висоту
        } else {
          effHeightMm = effWidthMm;
        }
        setSizeValues(prev => ({
          ...prev,
          width: effWidthMm,
          height: effHeightMm,
        }));
      }

      const width = mmToPx(effWidthMm);
      const height = mmToPx(effHeightMm);
      const cr = Math.max(0, Number(mmToPx(cornerRadiusMm)) || 0);

      const prevW = canvas.getWidth?.() || canvas.width || 0;
      const prevH = canvas.getHeight?.() || canvas.height || 0;

      // Встановлюємо нові розміри canvas
      canvas.setDimensions({ width, height });

      // Keep elements in the same relative position after resize.
      repositionObjectsForResize(prevW, prevH, width, height);

      // Keep certain newly-added elements within 60% of canvas after resize.
      enforceAutoFitObjects();

      // Створюємо новий clipPath з новими розмірами
      let newClipPath = null;

      switch (effectiveShapeType) {
        case 'rectangle':
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

        case 'circle':
          // --- Normalize clipPath to avoid 1px transparent contour seams ---
          if (newClipPath) {
            // Remove any accidental stroke that could create an inner gap
            newClipPath.set({ stroke: null, strokeWidth: 0 });
            // Для всіх, крім прямокутника, жорстко якіруємо до (0,0) лівий верх
            if (newClipPath.type !== 'rect') {
              newClipPath.set({
                originX: 'left',
                originY: 'top',
                left: 0,
                top: 0,
              });
              // Обнулити pathOffset (важливо для path), щоб уникнути зсувів на малих розмірах
              try {
                if (newClipPath.type === 'path') {
                  newClipPath.pathOffset = new fabric.Point(0, 0);
                }
              } catch {}
            } else {
              // Для прямокутника зберігаємо -0.5 інфляцію і не округлюємо
            }
            // For centered shapes, make sure radius-based ones fully cover area (slight +0.5 expansion if needed)
            if (newClipPath.type === 'circle' || newClipPath.type === 'ellipse') {
              // Expand by 0.25 to counteract anti-alias shrink
              if (typeof newClipPath.radius === 'number') newClipPath.radius += 0.25;
              if (typeof newClipPath.rx === 'number') newClipPath.rx += 0.25;
              if (typeof newClipPath.ry === 'number') newClipPath.ry += 0.25;
            }
            // Disable caching for crisper edge blending with background
            newClipPath.set({ objectCaching: false });
          }

        case 'circleWithLine':
        case 'circleWithCross':
          const radius = Math.min(width, height) / 2;
          newClipPath = new fabric.Circle({
            left: width / 2,
            top: height / 2,
            radius: radius,
            originX: 'center',
            originY: 'center',
            absolutePositioned: true,
          });
          break;

        case 'ellipse':
          newClipPath = new fabric.Ellipse({
            left: width / 2,
            top: height / 2,
            rx: width / 2,
            ry: height / 2,
            originX: 'center',
            originY: 'center',
            absolutePositioned: true,
          });
          break;

        case 'lock': {
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
          const cornerSegs = baseCr > 0 ? Math.max(10, Math.round(baseCr / 2)) : 0;

          // ---- Top-right ----
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
            // повертаємося на початок дуги
            pts.push({ x: leftArcX, y: rectTopY });
          } else {
            pts.push({ x: 0, y: rectTopY });
          }

          newClipPath = new fabric.Polygon(pts, {
            absolutePositioned: true,
            originX: 'left',
            originY: 'top',
            left: 0,
            top: 0,
            objectCaching: false,
          });
          break;
        }

        case 'house':
          const houseScale = Math.min(width / 96, height / 105);
          newClipPath = new fabric.Path('M6 66V105H51H90V66L48 6L6 66Z', {
            left: (width - 96 * houseScale) / 2,
            top: (height - 105 * houseScale) / 2,
            absolutePositioned: true,
            scaleX: houseScale,
            scaleY: houseScale,
          });
          break;

        case 'halfCircle': {
          // Для дуже малих розмірів — точний шлях еліптичної дуги, щоб уникнути зсувів
          if (width <= 64 || height <= 32) {
            const rx = width / 2;
            const ry = height; // півеліпс по висоті
            const dArc = `M0 ${height} A ${rx} ${ry} 0 0 1 ${width} ${height} L ${width} ${height} L 0 ${height} Z`;
            newClipPath = new fabric.Path(dArc, {
              absolutePositioned: true,
              originX: 'center',
              originY: 'center',
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
            const filletSeg = Math.max(14, Math.min(180, Math.round(Math.sqrt(cr) * 11)));
            pts = roundHalfCircleBaseCorners(pts, cr, filletSeg);
          }
          // 3. Uniform reparameterization along arc portion to reduce uneven spacing (micro steps)
          if (pts.length > 12) {
            // separate base line points (lowest y ~ height) from arc points (y < height)
            const baseY = Math.max(...pts.map(p => p.y));
            const arcPts = pts.filter(p => p.y < baseY - 0.0001);
            if (arcPts.length > 4) {
              // compute total length of arc polyline
              let len = 0;
              for (let i = 0; i < arcPts.length - 1; i++)
                len += Math.hypot(arcPts[i + 1].x - arcPts[i].x, arcPts[i + 1].y - arcPts[i].y);
              const targetCount = Math.min(1200, Math.max(80, Math.round(len / 1))); // ~1px spacing target (cap 1200)
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
                const chaikin = arr => {
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
                if (refined.length > 1500) refined = refined.filter((_, i) => i % 2 === 0);
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
            originX: 'center',
            originY: 'center',
            left: width / 2,
            top: height / 2,
            objectCaching: false,
          });
          break;
        }

        case 'extendedHalfCircle': {
          // Для дуже малих розмірів — прямий еліптичний верх із вертикальними «подовженнями» працює нестабільно,
          // тому робимо точний півеліпс як у halfCircle
          if (width <= 64 || height <= 32) {
            const rx = width / 2;
            const ry = height;
            const dArc = `M0 ${height} A ${rx} ${ry} 0 0 1 ${width} ${height} L ${width} ${height} L 0 ${height} Z`;
            newClipPath = new fabric.Path(dArc, {
              absolutePositioned: true,
              originX: 'center',
              originY: 'center',
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
              const filletSeg = Math.max(14, Math.min(180, Math.round(Math.sqrt(cr) * 11)));
              pts = roundHalfCircleBaseCorners(pts, cr, filletSeg);
            }
            if (pts.length > 12) {
              const baseY = Math.max(...pts.map(p => p.y));
              const arcPts = pts.filter(p => p.y < baseY - 0.0001);
              if (arcPts.length > 4) {
                let len = 0;
                for (let i = 0; i < arcPts.length - 1; i++)
                  len += Math.hypot(arcPts[i + 1].x - arcPts[i].x, arcPts[i + 1].y - arcPts[i].y);
                const targetCount = Math.min(1200, Math.max(80, Math.round(len / 1)));
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
                  const chaikin = arr => {
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
                  if (refined.length > 1500) refined = refined.filter((_, i) => i % 2 === 0);
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
              originX: 'center',
              originY: 'center',
              left: width / 2,
              top: height / 2,
              objectCaching: false,
            });
          } else {
            // Високий варіант – наша спеціальна плавна логіка
            const cornerRadius = Math.max(0, Math.min(cr, height - 1));
            const pathString = makeExtendedHalfCircleSmoothPath(width, height, cornerRadius);
            newClipPath = new fabric.Path(pathString, {
              absolutePositioned: true,
              originX: 'center',
              originY: 'center',
              left: width / 2,
              top: height / 2,
              fill: 'transparent',
              stroke: 'transparent',
            });
          }

          break;
        }

        case 'adaptiveTriangle': {
          // Адаптивний трикутник, обрізаний прямокутником полотна
          const pts = getAdaptiveTrianglePoints(width, height);
          newClipPath = new fabric.Polygon(pts, { absolutePositioned: true });
          break;
        }

        case 'hexagon': {
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
              originX: 'left',
              originY: 'top',
              left: 0,
              top: 0,
              objectCaching: false,
            });
          } else {
            // Генеруємо округлений hexagon
            const d = makeRoundedHexagonPath(width, height, cr);

            newClipPath = new fabric.Path(d, {
              absolutePositioned: true,
              originX: 'center',
              originY: 'center',
              left: width / 2,
              top: height / 2,
              objectCaching: false,
            });
          }
          break;
        }

        case 'octagon': {
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
              originX: 'left',
              originY: 'top',
              left: 0,
              top: 0,
              objectCaching: false,
            });
          } else {
            // Генеруємо округлений octagon
            const d = makeRoundedOctagonPath(width, height, cr);

            newClipPath = new fabric.Path(d, {
              absolutePositioned: true,
              originX: 'center',
              originY: 'center',
              left: width / 2,
              top: height / 2,
              objectCaching: false,
            });
          }
          break;
        }

        case 'triangle': {
          if (width <= 64 || height <= 64) {
            const pts = [
              { x: width / 2, y: 0 },
              { x: width, y: height },
              { x: 0, y: height },
            ];
            newClipPath = new fabric.Polygon(pts, {
              absolutePositioned: true,
              originX: 'left',
              originY: 'top',
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
              fill: '#000000',
              stroke: '#000000',
              strokeWidth: adaptiveStrokeWidth,
              strokeLineJoin: 'round',
            });
            // Центруємо шлях точно по габаритам, щоб при зміні радіуса не було зсуву
            centerPathToCanvas(newClipPath, width, height);
          }
          break;
        }

        case 'arrowLeft': {
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
              originX: 'left',
              originY: 'top',
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
              fill: '#000000',
              stroke: '#000000',
              strokeWidth: adaptiveStrokeWidth,
              strokeLineJoin: 'round',
            });
            centerPathToCanvas(newClipPath, width, height);
          }
          break;
        }

        case 'arrowRight': {
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
              originX: 'left',
              originY: 'top',
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
              fill: '#000000',
              stroke: '#000000',
              strokeWidth: adaptiveStrokeWidth,
              strokeLineJoin: 'round',
            });
            centerPathToCanvas(newClipPath, width, height);
          }
          break;
        }

        case 'flag': {
          // Генеруємо округлений flag
          const d = makeRoundedFlagPath(width, height, cr);

          newClipPath = new fabric.Path(d, {
            absolutePositioned: true,
            originX: 'center',
            originY: 'center',
            left: width / 2,
            top: height / 2,
            objectCaching: false,
          });
          break;
        }

        case 'diamond':
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
            Object.prototype.hasOwnProperty.call(overrides, 'cornerRadiusMm') &&
            newClipPath.type === 'path'
          ) {
            centerPathToCanvas(newClipPath, width, height);
          }
        } catch {}
        canvas.clipPath = newClipPath;
        // Прибираємо будь-який контур у самої фігури clipPath (та дочірніх якщо група)
        // ОКРІМ triangle та arrows, де stroke потрібен для покриття білих зон від Bezier
        const stripStroke = obj => {
          if (!obj) return;
          // Зберігаємо stroke для triangle та стрілок при наявності cornerRadius
          const keepStroke =
            (currentShapeType === 'triangle' ||
              currentShapeType === 'arrowLeft' ||
              currentShapeType === 'arrowRight') &&
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
        mode: 'default',
        forceRebuild: true,
      });
      if (borderStateRef.current.mode === 'custom' || findBorderObject('custom')) {
        ensureBorderPresence({
          mode: 'custom',
          thicknessPx: borderStateRef.current.customThicknessPx ?? mmToPx(2),
          forceRebuild: true,
        });
      }

      // Перерахунок і перевстановлення дирок після зміни розміру + лог відступу
      recomputeHolesAfterResize();

      // Спеціальна адаптація внутрішніх елементів для circleWithLine після зміни розміру
      if (currentShapeType === 'circleWithLine') {
        const diameterPx = canvas.width; // квадрат
        // Лінія
        const lineObj = canvas
          .getObjects()
          .find(o => o.isCircleWithLineCenterLine || o.name === 'circleWithLineCenterLine');
        if (lineObj) {
          const diameterMm = pxToMm(diameterPx);
          const lineWidthMm = diameterMm * 0.65;
          // Fixed 1mm thickness: must NOT depend on toolbar thickness.
          const lineThicknessMm = 1;
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
          .find(o => o.isCircleWithLineTopText || o.name === 'circleWithLineTopText');
        const bottomText = canvas
          .getObjects()
          .find(o => o.isCircleWithLineBottomText || o.name === 'circleWithLineBottomText');
        // Фіксоване співвідношення 100/5 => 1:20 (fontSizeMm = widthMm / 20)
        const widthMmNow = pxToMm(diameterPx);
        const desiredFontPx = mmToPx(widthMmNow / 20);
        if (topText) topText.set({ fontSize: Math.max(1, Math.round(desiredFontPx)) });
        if (bottomText) bottomText.set({ fontSize: Math.max(1, Math.round(desiredFontPx)) });
        if (topText || bottomText) {
          // Використовуємо поточну товщину (state thickness) для перерахунку відступів
          const diameterMm = pxToMm(diameterPx);
          const effectiveThickMm = (() => {
            // Fixed 1mm thickness: must NOT depend on toolbar thickness.
            return 1;
          })();
          const lineThicknessMm = effectiveThickMm; // мм
          const radiusMm = diameterMm / 2;
          // Узгоджуємо з початковим створенням (там було /6) щоб уникнути першого "стрибка"
          const gapMm = (radiusMm - lineThicknessMm / 2) / 6;
          const centerY = canvas.height / 2;
          if (topText) {
            topText.set({
              left: diameterPx / 2,
              top: centerY - mmToPx(gapMm),
            });
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
      } else if (currentShapeType === 'circleWithCross') {
        const canvasW = canvas.width;
        const canvasH = canvas.height;
        const centerX = canvasW / 2;
        const diameterMm = pxToMm(canvasW);
        // Лінії «Т» — перебудова
        const hLine = canvas
          .getObjects()
          .find(
            o => o.isCircleWithCrossHorizontalLine || o.name === 'circleWithCrossHorizontalLine'
          );
        const vLine = canvas
          .getObjects()
          .find(o => o.isCircleWithCrossVerticalLine || o.name === 'circleWithCrossVerticalLine');
        const lineWidthMm = diameterMm * 0.65;
        // Fixed 1mm thickness: must NOT depend on toolbar thickness.
        const lineThicknessMm = 1;
        const lineThicknessPx = mmToPx(lineThicknessMm);
        const lineWidthPx = mmToPx(lineWidthMm);
        const paddingPx = mmToPx(0.5); // зменшений відступ для ближчого розташування до лінії

        // Відступ від лінії як в оригіналі
        const radiusMm = diameterMm / 2;
        const gapMm = (radiusMm - lineThicknessMm / 2) / 6;
        const gapPx = mmToPx(gapMm);

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
            top: canvasH / 2 + 2,
          });
          vLine.setCoords();
        }

        // Тексти — детермінована прив'язка до «Т» і меж круга
        const topText = canvas
          .getObjects()
          .find(o => o.isCircleWithCrossTopText || o.name === 'circleWithCrossTopText');
        const blText = canvas
          .getObjects()
          .find(
            o => o.isCircleWithCrossBottomLeftText || o.name === 'circleWithCrossBottomLeftText'
          );
        const brText = canvas
          .getObjects()
          .find(
            o => o.isCircleWithCrossBottomRightText || o.name === 'circleWithCrossBottomRightText'
          );
        // Фіксоване співвідношення 100/5 => 1:20 (fontSizeMm = widthMm / 20)
        const widthMmNow2 = pxToMm(canvasW);
        const desiredFontPx2 = Math.max(1, Math.round(mmToPx(widthMmNow2 / 20)));
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
            originX: 'center',
            textAlign: 'center',
            width: Math.max(20, lineWidthPx - paddingPx * 2),
            fontSize: desiredFontPx2,
          });
          topText.initDimensions && topText.initDimensions();
          // Використовуємо ту ж логіку що й при створенні
          const topY = canvasH / 2 - gapPx;
          topText.set({ top: topY });
          topText.setCoords();
        }

        if (blText) {
          const leftX = paddingPx;
          const leftW = Math.max(20, vLeft - paddingPx - leftX);
          blText.set({
            left: leftX,
            width: leftW,
            originX: 'left',
            textAlign: 'center',
            fontSize: desiredFontPx2,
          });
          blText.initDimensions && blText.initDimensions();
          // Використовуємо ту ж логіку що й при створенні
          const bottomY = canvasH / 2 + gapPx;
          blText.set({ top: bottomY });
          blText.setCoords();
        }

        if (brText) {
          const rightLeft = vRight + paddingPx;
          const rightW = Math.max(20, canvasW - paddingPx - rightLeft);
          brText.set({
            left: rightLeft,
            width: rightW,
            originX: 'left',
            textAlign: 'center',
            fontSize: desiredFontPx2,
          });
          brText.initDimensions && brText.initDimensions();
          // Використовуємо ту ж логіку що й при створенні
          const bottomY = canvasH / 2 + gapPx;
          brText.set({ top: bottomY });
          brText.setCoords();
        }

        canvas.requestRenderAll();
      }

      canvas.renderAll();
    } else if (canvas) {
      // Якщо нічого не вибрано і немає фігури - просто змінюємо розміри canvas
      const prevW = canvas.getWidth?.() || canvas.width || 0;
      const prevH = canvas.getHeight?.() || canvas.height || 0;
      const nextW = mmToPx(widthMm);
      const nextH = mmToPx(heightMm);
      canvas.setDimensions({
        width: nextW,
        height: nextH,
      });

      // Keep elements in the same relative position after resize.
      try {
        const oldW = Number(prevW) || 0;
        const oldH = Number(prevH) || 0;
        const newW = Number(nextW) || 0;
        const newH = Number(nextH) || 0;
        if (oldW > 0 && oldH > 0 && newW > 0 && newH > 0) {
          const sx = newW / oldW;
          const sy = newH / oldH;
          if (Number.isFinite(sx) && Number.isFinite(sy)) {
            (canvas.getObjects?.() || []).forEach(obj => {
              if (!obj) return;
              if (obj.isBorderShape || obj.isBorderMask || obj.isCanvasOutline) return;
              if (obj.isCutElement && obj.cutType === 'hole') return;
              if (typeof obj.id === 'string' && obj.id.startsWith(`${HOLE_ID_PREFIX}-`)) return;
              if (typeof obj.left !== 'number' || typeof obj.top !== 'number') return;
              obj.set?.({ left: obj.left * sx, top: obj.top * sy });
              obj.setCoords?.();
            });
          }
        }
      } catch {}
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

    // Use effective shape type from canvas metadata to avoid relying on React state timing.
    const effectiveShapeType = canvas?.get?.('shapeType') || currentShapeType;

    // Спеціальна логіка для замка
    if (effectiveShapeType === 'lock') {
      clearExistingHoles();
      const hole = createLockHoleCircle();
      if (hole) {
        try {
          const topGapMm = pxToMm((hole.top || 0) - (hole.radius || 0));
          console.log(
            `Відступ отвору зверху: ${topGapMm.toFixed(2)} мм (lock, Ø ${holesDiameter} мм)`
          );
        } catch {}
        canvas.add(hole);
        canvas.renderAll();
      }
      return;
    }

    // Обчислюємо відступ і логуємо його в мм
    if (activeHolesType === 5) {
      const { offsetXpx, offsetYpx } = getRectHoleOffsetsPx();
      try {
        console.log(
          `Відступ прямокутних отворів: X=${pxToMm(offsetXpx).toFixed(
            2
          )} мм, Y=${pxToMm(offsetYpx).toFixed(2)} мм (тип 5, 5x2мм)`
        );
      } catch {}
    } else {
      const offsetPx = getHoleOffsetPx();
      const offsetMm = pxToMm(offsetPx);
      try {
        console.log(
          `Відступ отворів: ${offsetMm.toFixed(
            2
          )} мм (тип ${activeHolesType}, Ø ${holesDiameter} мм)`
        );
      } catch {}
    }

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
    const existingOutlineAll = canvas.getObjects().filter(o => o.isCanvasOutline);
    if (existingOutlineAll.length) {
      existingOutlineAll.forEach(o => canvas.remove(o));
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
    ensureBorderPresence({ mode: 'default', forceRebuild: true });
    if (borderStateRef.current.mode === 'custom' || findBorderObject('custom')) {
      ensureBorderPresence({
        mode: 'custom',
        thicknessPx: borderStateRef.current.customThicknessPx ?? mmToPx(2),
        forceRebuild: true,
      });
    }
  }, [ensureBorderPresence, findBorderObject, mmToPx]);

  // --- Hexagon / Octagon inner border helpers (rounded polygon sampling) ---
  const sampleRoundedPolygon = (basePts, r, segments) => {
    // basePts: original polygon (closed CCW or CW). Round only convex corners to avoid artifacts.
    const n = basePts.length;
    if (!r || r <= 0 || n < 3) return basePts.map(p => ({ x: p.x, y: p.y }));

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
          Math.hypot(pts[pts.length - 1].x - curr.x, pts[pts.length - 1].y - curr.y) > 0.01
        ) {
          pts.push({ x: curr.x, y: curr.y });
        }
        continue;
      }

      const rClamped = Math.min(r, len1 / 2 - 0.001, len2 / 2 - 0.001);
      if (rClamped <= 0) {
        if (
          pts.length === 0 ||
          Math.hypot(pts[pts.length - 1].x - curr.x, pts[pts.length - 1].y - curr.y) > 0.01
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
        Math.hypot(pts[pts.length - 1].x - p1x, pts[pts.length - 1].y - p1y) > 0.01
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
    if (!r || r <= 0 || n < 3) return basePts.map(p => ({ x: p.x, y: p.y }));
    const w = Array.isArray(weights) && weights.length === n ? weights : new Array(n).fill(1);

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
          Math.hypot(pts[pts.length - 1].x - curr.x, pts[pts.length - 1].y - curr.y) > 0.01
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
          Math.hypot(pts[pts.length - 1].x - curr.x, pts[pts.length - 1].y - curr.y) > 0.01
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
        Math.hypot(pts[pts.length - 1].x - p1x, pts[pts.length - 1].y - p1y) > 0.01
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
  function sampleRoundedPolygonPerCornerFlexible(basePts, r, segments, weights) {
    const n = basePts.length;
    if (!r || r <= 0 || n < 3) return basePts.map(p => ({ x: p.x, y: p.y }));
    // Find top index (min Y)
    let topIdx = 0;
    let minY = Infinity;
    for (let i = 0; i < n; i++) {
      if (basePts[i].y < minY) {
        minY = basePts[i].y;
        topIdx = i;
      }
    }
    const w = Array.isArray(weights) && weights.length === n ? weights : new Array(n).fill(1);
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
          Math.hypot(out[out.length - 1].x - curr.x, out[out.length - 1].y - curr.y) > 0.01
        ) {
          out.push({ x: curr.x, y: curr.y });
        }
        continue;
      }

      const rTarget = Math.max(0, r * (w[i] ?? 1));
      if (rTarget <= 0.001) {
        if (
          out.length === 0 ||
          Math.hypot(out[out.length - 1].x - curr.x, out[out.length - 1].y - curr.y) > 0.01
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
        Math.hypot(out[out.length - 1].x - p1.x, out[out.length - 1].y - p1.y) > 0.01
      ) {
        out.push(p1);
      }
      for (let s = 1; s < seg; s++) {
        const t = s / seg;
        const omt = 1 - t;
        const bx = omt * omt * p1.x + 2 * omt * t * curr.x + t * t * p2.x;
        const by = omt * omt * p1.y + 2 * omt * t * curr.y + t * t * p2.y;
        if (Math.hypot(bx - p1.x, by - p1.y) > 0.005 && Math.hypot(bx - p2.x, by - p2.y) > 0.005) {
          out.push({ x: bx, y: by });
        }
      }
      if (Math.hypot(out[out.length - 1].x - p2.x, out[out.length - 1].y - p2.y) > 0.005) {
        out.push(p2);
      }
    }
    return out;
  }

  // Build weights for adaptiveTriangle pentagon: keep TOP=1.0, reduce JUNCTIONS a bit, BOTTOM corners slightly.
  function getAdaptivePentagonCornerWeights(basePts, width, height, cornerRadiusMm) {
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
    if (!r || r <= 0) return basePts.map(p => ({ x: p.x, y: p.y }));
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
        Math.hypot(out[out.length - 1].x - p1x, out[out.length - 1].y - p1y) > 0.05
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
    const maxAllowed = Math.min(leftArcLen, rightArcLen, width / 2 - 0.01, height - 0.01);
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
        x: omt * omt * pBaseLeft.x + 2 * omt * t * cpLeft.x + t * t * pArcLeft.x,
        y: omt * omt * pBaseLeft.y + 2 * omt * t * cpLeft.y + t * t * pArcLeft.y,
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
    const angleFromPoint = p => {
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
    const arcSamples = Math.max(40, Math.min(1200, Math.round(angleSpan * Math.max(rx, ry) * 2)));
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
        x: omt * omt * pArcRight.x + 2 * omt * t * cpRight.x + t * t * pBaseRight.x,
        y: omt * omt * pArcRight.y + 2 * omt * t * cpRight.y + t * t * pBaseRight.y,
      });
    }
    out.push(pBaseRight);
    return out;
  }

  // Перетворення масиву дискретних точок у гладкий шлях з квадратичними кривими.
  // ensureClosed=true додає замикання (Z).
  function pointsToQuadraticSmoothPath(pts, ensureClosed = false) {
    if (!pts || pts.length < 2) return '';
    // Прибираємо послідовні дублі щоб уникнути Q з нульовою довжиною
    const cleaned = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const last = cleaned[cleaned.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 0.15) cleaned.push(p);
    }
    if (cleaned.length < 2) return '';
    let d = `M ${cleaned[0].x} ${cleaned[0].y}`;
    if (cleaned.length === 2) {
      d += ` L ${cleaned[1].x} ${cleaned[1].y}`;
      if (ensureClosed) d += ' Z';
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
    if (ensureClosed) d += ' Z';
    return d;
  }

  // Перетворення множини точок у замкнений шлях із кубічних Безьє через Catmull-Rom (tension parameter)
  function pointsToClosedCatmullRomCubicPath(pts, tension = 0.5) {
    if (!pts || pts.length < 3) return '';
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
    if (n < 3) return '';
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
    d += ' Z';
    return d;
  }

  // Open Catmull-Rom -> cubic Bezier path (no wrap-around) then close with straight line between last and first.
  // This avoids wrap-induced overshoot artifacts ("зубці") at the halfCircle base corners.
  function pointsToOpenCatmullRomCubicPath(pts, tension = 0.5) {
    if (!pts || pts.length < 2) return '';
    // remove near duplicates
    const cleaned = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const last = cleaned[cleaned.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 0.2) cleaned.push(p);
    }
    if (cleaned.length < 2) return '';
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
      const p3 = i + 2 < cleaned.length ? cleaned[i + 2] : cleaned[cleaned.length - 1];
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
      return basePts.map(p => ({ x: p.x, y: p.y }));
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
        Math.hypot(out[out.length - 1].x - startX, out[out.length - 1].y - startY) > 0.05
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
  const updateThickness = value => {
    // Thickness slider must not toggle Border and must not affect border thickness.

    // Пункт 3 (товщина) стосується лише внутрішніх бордерів/елементів картки, не змінює активні об'єкти
    // Якщо вже додано внутрішній бордер – оновлюємо його товщину без потреби вимикати/вмикати
    if (canvas) {
      canvas.renderAll();

      // Відстежуємо зміну товщини
      trackThicknessChange(value);
      // Reset color scheme to default: black text, white background
      updateColorScheme('#000000', '#FFFFFF', 'solid', 0);
    }
  };

  // Зміна кольору
  const updateColor = color => {
    if (activeObject) {
      activeObject.set({ fill: color });
      canvas.renderAll();
    }
  };

  // Функція для регенерації QR коду з новими кольорами
  const regenerateQRCode = async (qrObj, text, foregroundColor, backgroundColor) => {
    try {
      // Імпортуємо qrcode-generator на льоту
      const qrGenerator = (await import('qrcode-generator')).default;

      // Генеруємо QR код з новою бібліотекою
      const qr = qrGenerator(0, 'M');
      qr.addData(text);
      qr.make();
      const cellSize = DEFAULT_QR_CELL_SIZE;
      const { optimizedPath, displayPath, size } = computeQrVectorData(qr, cellSize);

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
        newObj = fabric.util.groupSVGElements(result.objects || [], result.options || {});
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
        qrColor: newColor,
        selectable: true,
        hasControls: true,
        hasBorders: true,
        backgroundColor: 'transparent',
      });

      // Замінюємо старий об'єкт новим
      const index = canvas.getObjects().indexOf(qrObj);
      if (index !== -1) {
        canvas.remove(qrObj);
        canvas.insertAt(newObj, index);
      }
    } catch (error) {
      console.error('Помилка регенерації QR коду:', error);
    }
  };

  // Функція для регенерації Bar коду з новими кольорами
  const regenerateBarCode = async (barObj, text, foregroundColor, backgroundColor) => {
    try {
      if (!canvas || !barObj) return;
      const codeType = barObj.barCodeType || 'CODE128';
      // Генеруємо SVG напряму (як при створенні) замість растрового canvas -> FabricImage
      const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svgEl, text || barObj.barCodeText || '', {
        format: codeType,
        width: 2,
        height: 100,
        displayValue: false,
        background: 'transparent',
        lineColor: foregroundColor,
        margin: 0,
      });
      const serializer = new XMLSerializer();
      const svgText = serializer.serializeToString(svgEl);
      const result = await fabric.loadSVGFromString(svgText);
      let newImg;
      if (result?.objects?.length === 1) newImg = result.objects[0];
      else newImg = fabric.util.groupSVGElements(result.objects || [], result.options || {});
      if (!newImg) return;
      newImg.set({
        left: barObj.left,
        top: barObj.top,
        scaleX: barObj.scaleX,
        scaleY: barObj.scaleY,
        angle: barObj.angle,
        originX: barObj.originX || 'center',
        originY: barObj.originY || 'center',
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
          typeof newImg.getScaledWidth === 'function'
            ? newImg.getScaledWidth()
            : (newImg.width || 0) * (newImg.scaleX || 1);
        if (currentWidth > 0 && currentWidth < minPx) {
          const factor = minPx / currentWidth;
          newImg.scaleX *= factor;
          newImg.scaleY *= factor;
        }
        if (typeof newImg.setCoords === 'function') newImg.setCoords();
      } catch (enforceErr) {
        console.warn('Не вдалося застосувати мінімальну ширину для бар-коду:', enforceErr);
      }

      // Замінюємо старий об'єкт новим
      const index = canvas.getObjects().indexOf(barObj);
      if (index !== -1) {
        canvas.remove(barObj);
        canvas.insertAt(newImg, index);
        try {
          if (typeof newImg.setCoords === 'function') newImg.setCoords();
        } catch {}
        try {
          canvas.setActiveObject(newImg);
        } catch {}
        try {
          canvas.requestRenderAll();
        } catch {}
      }
    } catch (error) {
      console.error('Помилка регенерації Bar коду:', error);
    }
  };

  // Оновлена функція для зміни кольору всіх текстів та фону canvas
  const updateColorScheme = (
    textColor,
    backgroundColor,
    backgroundType = 'solid',
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
      fillColor: textColor === '#FFFFFF' ? backgroundColor : 'transparent',
      backgroundType,
    });

    // Змінюємо колір всіх об'єктів на canvas, з урахуванням manual Cut
    const objects = canvas.getObjects();

    objects.forEach(obj => {
      // Оновлення кольору ліній для фігур "Коло з лінією" та "Коло з хрестом"
      if (
        obj.isCircleWithLineCenterLine ||
        obj.name === 'circleWithLineCenterLine' ||
        obj.isCircleWithCrossHorizontalLine ||
        obj.name === 'circleWithCrossHorizontalLine' ||
        obj.isCircleWithCrossVerticalLine ||
        obj.name === 'circleWithCrossVerticalLine'
      ) {
        // Лінії мають іти тим самим кольором, що і текст/обводка теми.
        const lineColor = textColor || '#000000';
        obj.set({
          stroke: lineColor,
          fill: lineColor,
        });
        return;
      }

      if (obj.isBorderShape) {
        const mode = obj.cardBorderMode === 'custom' ? 'custom' : 'default';
        // Use the newly chosen theme color immediately (state update is async).
        // IMPORTANT: default thin outline stays black.
        const displayStroke = mode === 'custom' ? textColor || '#000000' : '#000000';
        const exportStroke = mode === 'custom' ? CUSTOM_BORDER_EXPORT_COLOR : displayStroke;
        const exportFillValue =
          mode === 'custom' ? 'none' : obj.cardBorderExportFill || obj.fill || 'transparent';

        obj.set({
          stroke: displayStroke,
          fill: 'transparent',
          cardBorderDisplayStrokeColor: displayStroke,
          cardBorderExportStrokeColor: exportStroke,
          cardBorderExportFill: exportFillValue,
        });
        return;
      }
      // Cut елементи (manual): stroke = ORANGE, fill = білий (зберігаємо як раніше)
      if (obj.isCutElement && obj.cutType === 'manual') {
        obj.set({ stroke: '#FD7714', fill: '#FFFFFF' });
        return;
      }

      // Cut елементи з вкладки CUT (тип "shape"): завжди біла заливка і оранжевий бордер
      if (obj.isCutElement && obj.cutType === 'shape') {
        obj.set({ stroke: '#FD7714', fill: '#FFFFFF' });
        // Заборонити застосування темного кольору випадково
        if (obj.useThemeColor) obj.useThemeColor = false;
        return;
      }

      if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
        obj.set({ fill: textColor });
      } else if (
        obj.type === 'rect' ||
        obj.type === 'circle' ||
        obj.type === 'ellipse' ||
        obj.type === 'triangle' ||
        obj.type === 'polygon' ||
        obj.type === 'path'
      ) {
        const isTransparent =
          obj.fill === 'transparent' ||
          obj.fill === '' ||
          obj.fill === null ||
          typeof obj.fill === 'undefined';
        const usesThemeColor = obj.useThemeColor === true;
        const followThemeStroke = obj.followThemeStroke !== false;

        if (isTransparent) {
          obj.set({ fill: 'transparent' });
        } else if (usesThemeColor) {
          obj.set({ fill: textColor });
        } else if (
          typeof obj.initialFillColor === 'string' &&
          obj.initialFillColor !== '' &&
          obj.initialFillColor !== 'transparent' &&
          obj.fill !== obj.initialFillColor
        ) {
          obj.set({ fill: obj.initialFillColor });
        }

        if (usesThemeColor || followThemeStroke) {
          obj.set({ stroke: textColor });
        } else if (typeof obj.initialStrokeColor === 'string') {
          obj.set({ stroke: obj.initialStrokeColor });
        }
      } else if (obj.type === 'circle-with-cut') {
        const isTransparent =
          obj.fill === 'transparent' ||
          obj.fill === '' ||
          obj.fill === null ||
          typeof obj.fill === 'undefined';
        const usesThemeColor = obj.useThemeColor === true;
        const followThemeStroke = obj.followThemeStroke !== false;

        if (isTransparent) {
          obj.set({ fill: 'transparent' });
        } else if (usesThemeColor) {
          obj.set({ fill: textColor });
        } else if (
          typeof obj.initialFillColor === 'string' &&
          obj.initialFillColor !== '' &&
          obj.initialFillColor !== 'transparent' &&
          obj.fill !== obj.initialFillColor
        ) {
          obj.set({ fill: obj.initialFillColor });
        }

        if (usesThemeColor || followThemeStroke) {
          obj.set({ stroke: textColor });
        } else if (typeof obj.initialStrokeColor === 'string') {
          obj.set({ stroke: obj.initialStrokeColor });
        }
      } else if (obj.type === 'line') {
        obj.set({ stroke: textColor });
      }
      // QR та Bar коди залишаємо без змін - вони будуть використовувати нові кольори при створенні
    });

    // Тимчасово відключено автоперегенерацію BarCode при зміні схеми щоб уникнути помилок Fabric
    // Якщо потрібно оновити кольори смуг — можна зробити окрему кнопку чи відкладену регенерацію

    // Встановлюємо фон canvas
    if (backgroundType === 'solid') {
      canvas.set('backgroundColor', backgroundColor);
      canvas.set('backgroundTextureUrl', null);
      canvas.set('backgroundType', 'solid');
      canvas.renderAll();
      trackColorThemeChange({ textColor, backgroundColor, backgroundType });
    } else if (backgroundType === 'gradient') {
      // Місце для градієнта - буде реалізовано пізніше
      canvas.set('backgroundColor', backgroundColor); // Тимчасово використовуємо solid color
      canvas.set('backgroundTextureUrl', null);
      canvas.set('backgroundType', 'gradient');
      canvas.renderAll();
      trackColorThemeChange({ textColor, backgroundColor, backgroundType });
    } else if (backgroundType === 'texture') {
      // Завантажуємо текстуру
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          // Обраховуємо масштаб як відношення canvas до зображення
          // Зменшуємо у 4 рази для повторення текстури
          const scaleX = canvas.width / img.width;
          const scaleY = canvas.height / img.height;

          // Створюємо canvas для масштабування текстури
          const patternCanvas = document.createElement('canvas');
          const ctx = patternCanvas.getContext('2d');

          patternCanvas.width = img.width * scaleX;
          patternCanvas.height = img.height * scaleY;

          // Малюємо масштабоване зображення
          ctx.drawImage(img, 0, 0, patternCanvas.width, patternCanvas.height);

          const pattern = new fabric.Pattern({
            source: patternCanvas,
            repeat: 'no-repeat', // не дублюємо текстуру
            id: 'canvasBackgroundTexture', // ID для ідентифікації в SVG
          });

          // Зберігаємо оригінальний URL текстури для серіалізації
          canvas.set('backgroundColor', pattern);
          canvas.set('backgroundTextureUrl', backgroundColor);
          canvas.set('backgroundType', 'texture');
          canvas.renderAll();
        } catch (error) {
          console.error('Error creating texture pattern:', error);
          canvas.set('backgroundColor', backgroundColor);
          canvas.renderAll();
        }
      };
      img.onerror = () => {
        console.error('Error loading texture image:', backgroundColor);
        canvas.set('backgroundColor', '#FFFFFF');
        canvas.renderAll();
      };
      img.src = backgroundColor;
      trackColorThemeChange({ textColor, backgroundColor, backgroundType });
    }
  };

  // Запобігаємо повторному застосуванню вже активної схеми
  const handleColorPick = (idx, textColor, bgColor, type = 'solid') => {
    if (selectedColorIndex === idx) return; // нічого не робимо якщо вже вибрано
    updateColorScheme(textColor, bgColor, type, idx);
  };

  // Додавання тексту
  const addText = () => {
    if (canvas) {
      const text = new fabric.IText('Text', {
        left: canvas.width / 2,
        top: canvas.height / 2,
        originX: 'center',
        originY: 'center',
        fontFamily: 'Arial',
        fill: globalColors.textColor,
        fontSize: mmToPx(5),
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      // Запускаем редактирование единообразно через copyHandler без дополнительных таймеров/дублирования
      // Небольшая задержка кадра нужна, чтобы объект стал активным и имел корректные coords
      requestAnimationFrame(() => {
        try {
          if (typeof copyHandler === 'function') {
            copyHandler(null, { target: text });
          } else if (typeof text.enterEditing === 'function') {
            text.enterEditing();
          }
        } catch {}
      });
      canvas.renderAll();
      trackElementAdded('Text');
    }
  };

  // Додавання зображення через IconMenu
  const addImage = () => {
    setIsIconMenuOpen(true);
  };

  // Upload preview modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState('raster'); // 'raster' | 'svg'
  const [uploadDataURL, setUploadDataURL] = useState('');
  const [uploadSvgText, setUploadSvgText] = useState('');

  // Додавання зображення через файловий діалог (для Upload кнопки)
  const addUploadImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Покращена функція завантаження зображень
  const handleUpload = e => {
    const file = e.target.files[0];
    if (file && canvas) {
      // Перевіряємо тип файлу
      if (!file.type.startsWith('image/')) {
        alert('Будь ласка, виберіть файл зображення');
        return;
      }

      // Перевіряємо розмір файлу (максимум 5MB)
      if (file.size > 6 * 1024 * 1024) {
        alert('Файл занадто великий. Максимальний розмір: 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = async event => {
        let addedOk = false; // track if we successfully added any object
        try {
          // Перевіряємо чи це SVG файл
          if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
            // For preview flow: open modal with original SVG (no immediate add)
            const raw = String(event.target.result || '');
            setUploadMode('svg');
            setUploadSvgText(raw);
            setUploadDataURL('');
            setIsUploadOpen(true);
            return; // defer adding until confirm
          } else {
            // Raster: open modal with dataURL, preview will vectorize live
            const raw = String(event.target.result || '');
            setUploadMode('raster');
            setUploadDataURL(raw);
            setUploadSvgText('');
            setIsUploadOpen(true);
            return; // defer adding until confirm
          }
        } catch (error) {
          console.error('Помилка завантаження зображення:', error);
          // Прибираємо сповіщення про помилку за новою логікою
        }
      };
      reader.onerror = () => {
        // Без сповіщень — просто лог
        console.error('Помилка завантаження файлу');
      };
      reader.readAsDataURL(file);
    }

    // Очищаємо input після завантаження
    e.target.value = '';
  };

  const addBorder = () => {
    if (!canvas) return;

    const currentBg = canvas.backgroundColor || canvas.get('backgroundColor');
    if (!currentBg || currentBg === 'transparent') {
      const fallbackBg = (globalColors && globalColors.backgroundColor) || '#FFFFFF';
      canvas.set('backgroundColor', fallbackBg);
    }

    const customBorders =
      canvas?.getObjects?.()?.filter(obj => obj.isBorderShape && obj.cardBorderMode === 'custom') ||
      [];

    if (customBorders.length > 0) {
      customBorders.forEach(borderShape => canvas.remove(borderShape));
      borderStateRef.current = {
        ...borderStateRef.current,
        mode: 'default',
        thicknessPx: borderStateRef.current.defaultThicknessPx ?? DEFAULT_BORDER_THICKNESS_PX,
      };
      ensureBorderPresence({
        mode: 'default',
        thicknessPx: borderStateRef.current.defaultThicknessPx ?? DEFAULT_BORDER_THICKNESS_PX,
        color: getBorderColor('default'),
        forceRebuild: true,
      });
      canvas.requestRenderAll();
      setIsBorderActive(false);
      trackBorderChange?.(false);
      return;
    }

    ensureBorderPresence({
      mode: 'default',
      thicknessPx: borderStateRef.current.defaultThicknessPx ?? DEFAULT_BORDER_THICKNESS_PX,
      color: getBorderColor('default'),
    });

    const storedCustomPx = borderStateRef.current.customThicknessPx ?? mmToPx(2);

    const border = ensureBorderPresence({
      mode: 'custom',
      thicknessPx: storedCustomPx,
      color: getBorderColor('custom'),
      forceRebuild: true,
    });

    if (border) {
      borderStateRef.current = {
        ...borderStateRef.current,
        mode: 'custom',
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
          if (cp.type === 'rect') {
            const w = pxToMm(cp.width || 0);
            const h = pxToMm(cp.height || 0);
            minMm = Math.min(w, h);
            maxMm = Math.max(w, h);
          } else if (cp.type === 'circle') {
            const d = pxToMm((cp.radius || 0) * 2);
            minMm = d;
            maxMm = d;
          } else if (cp.type === 'ellipse') {
            const w = pxToMm((cp.rx || 0) * 2);
            const h = pxToMm((cp.ry || 0) * 2);
            minMm = Math.min(w, h);
            maxMm = Math.max(w, h);
          } else if (cp.type === 'polygon' && Array.isArray(cp.points)) {
            const xs = cp.points.map(p => p.x);
            const ys = cp.points.map(p => p.y);
            const w = Math.max(...xs) - Math.min(...xs) || 0;
            const h = Math.max(...ys) - Math.min(...ys) || 0;
            const wMm = pxToMm(w);
            const hMm = pxToMm(h);
            minMm = Math.min(wMm, hMm);
            maxMm = Math.max(wMm, hMm);
          } else if (typeof cp.width === 'number' && typeof cp.height === 'number') {
            const w = pxToMm(cp.width);
            const h = pxToMm(cp.height);
            minMm = Math.min(w, h);
            maxMm = Math.max(w, h);
          }
        } catch {}
      }
      if (!minMm || !maxMm) {
        const ds = typeof canvas.getDesignSize === 'function' ? canvas.getDesignSize() : null;
        if (ds && typeof ds.width === 'number' && typeof ds.height === 'number') {
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

  const HOLE_OFFSET_ADDITIVE_MIN = 1.2; // гарантований мінімальний проміжок (мм)
  const HOLE_OFFSET_SIDE_MULTIPLIER = 0.02; // L*0.02 (L — довша сторона полотна)

  // Нова формула відступу (за вимогою):
  // offsetMm = 1.2(гарантований мінімальний проміжок) + півдіаметр вибраного отвору + L*0.02
  // де L — довша сторона полотна (в мм)

  // Стара версія (НЕ ВИДАЛЯТИ):
  // const HOLE_OFFSET_BASE_MULTIPLIER = 0.04; // трохи агресивніше віддаляємо від країв
  // const HOLE_OFFSET_CAP_MM = 9; // попереднє значення 7.5 мм
  // const HOLE_OFFSET_ADDITIVE_MAX = 4.0; // попереднє значення 3.2 мм
  // const HOLE_OFFSET_DIAMETER_BASE = 5.4; // попереднє значення 4.8
  // const HOLE_OFFSET_DIAMETER_DIVISOR = 16; // попереднє значення 18
  // const HOLE_EDGE_CLEARANCE_MM = 3.5; // попередньо 2 мм
  //

  // Емпірична формула відступу (з ескізів):
  // offsetMm = clamp(0, cap, baseMultiplier * maxSideMm + clamp(additiveMin, additiveMax, base - divisor/diameterMm))
  const getHoleOffsetPx = (overrideDiameterMm = null) => {
    const { maxMm, minMm } = getFigureDimsMm();
    const diameterSource =
      typeof overrideDiameterMm === 'number' ? overrideDiameterMm : holesDiameter;
    const d = Math.max(diameterSource || 0, 0.1);

    const longSideMm = maxMm || 0;
    const radiusMm = d / 2;

    // Нова формула (за уточненням): потрібен відступ ВІД КРАЮ ПОЛОТНА ДО КРАЮ ОТВОРУ.
    // edgeGapMm = 1.2 + (d/2) + L*0.02, де L — довша сторона полотна (maxMm).
    const desiredCenterOffsetMm =
      HOLE_OFFSET_ADDITIVE_MIN + radiusMm + longSideMm * HOLE_OFFSET_SIDE_MULTIPLIER;

    // Компенсація під виробничі виміри: часто міряють до ЛІНІЇ РІЗУ (stroke), а не до геометрії.
    // Stroke у Fabric малюється по центру контуру, тому зовнішній край stroke "з'їдає" halfStroke.
    // Додаємо halfStroke + невеликий fudge (аналогічно прямокутним отворам), щоб у CAM було рівно по формулі.
    const holeStrokeWidthPx = 1;
    const halfStrokeMm = pxToMm(holeStrokeWidthPx) / 2;
    const edgeFudgeMm = 0.04;
    // const edgeGapMm = desiredEdgeGapMm + halfStrokeMm + edgeFudgeMm;

    // У Fabric отвір позиціонуємо по центру (origin='center'), тому переводимо edgeGap -> centerOffset.
    let offsetMm = desiredCenterOffsetMm + halfStrokeMm + edgeFudgeMm;
    if (!isFinite(offsetMm)) offsetMm = 0;

    // Геометричний запобіжник: дирка не повинна заходити далі центру (для дуже великих дирок)
    const maxOffsetMm = Math.max(0, (minMm || 0) - (d || 0.1) / 2);
    offsetMm = Math.min(offsetMm, maxOffsetMm);

    if (import.meta?.env?.DEV) {
      console.debug('[getHoleOffsetPx] calc', {
        diameterMm: d,
        radiusMm,
        longSideMm,
        desiredEdgeGapMm,
        edgeGapMm,
        centerOffsetMm: offsetMm,
        edgeGapAfterClampMm: Math.max(0, offsetMm - radiusMm),
        maxOffsetMm,
        halfStrokeMm,
        edgeFudgeMm,
      });
    }
    // Стара версія розрахунку (НЕ ВИДАЛЯТИ):
    // let additive = HOLE_OFFSET_DIAMETER_BASE - HOLE_OFFSET_DIAMETER_DIVISOR / d; // зменшується при збільшенні діаметра
    // if (!isFinite(additive)) additive = 0;
    // additive = Math.max(HOLE_OFFSET_ADDITIVE_MIN, Math.min(additive, HOLE_OFFSET_ADDITIVE_MAX));
    // const base = HOLE_OFFSET_BASE_MULTIPLIER * (maxMm || 0);
    // let offsetMm = Math.min(base + additive, HOLE_OFFSET_CAP_MM);
    // // Мінімальна відстань від краю дирки до краю фігури: 3.5мм
    // // Тобто offset >= 3.5мм + радіус дирки
    // const minOffsetMm = HOLE_EDGE_CLEARANCE_MM + (d || 0.1) / 2;
    // // Максимальний відступ: дирка не повинна заходити далі центру (для дуже великих дирок)
    // const maxOffsetMm = Math.max(0, minMm - (d || 0.1) / 2);
    // offsetMm = Math.max(offsetMm, minOffsetMm);
    // offsetMm = Math.min(offsetMm, maxOffsetMm);

    return mmToPx(offsetMm);
  };

  // Прямокутні отвори (тип 5): фіксований відступ від краю.
  // ВАЖЛИВО: у виробничих інструментах (LightBurn) зазвичай міряють до лінії різу (stroke).
  // Тому щоб відступ по лінії різу був рівно X/Y мм, додаємо 0.5*stroke до геометрії.
  // Координата центру = offsetEdge + 0.5*stroke + (width/2).
  const getRectHoleOffsetsPx = () => {
    const holeStrokeWidthPx = 1;
    const halfStrokeMm = pxToMm(holeStrokeWidthPx) / 2;

    // Small calibration tweak to match CAM measurement precisely.
    const edgeFudgeMm = 0.04;

    const desiredCenterOffsetXmm =
      RECT_HOLE_MIN_OFFSET_X_MM + edgeFudgeMm + halfStrokeMm + RECT_HOLE_WIDTH_MM / 2;
    const desiredCenterOffsetYmm =
      RECT_HOLE_MIN_OFFSET_Y_MM + edgeFudgeMm + halfStrokeMm + RECT_HOLE_HEIGHT_MM / 2;

    let offsetXpx = mmToPx(desiredCenterOffsetXmm);
    let offsetYpx = mmToPx(desiredCenterOffsetYmm);

    // Safety for very small canvases: keep centers inside.
    const wPx = canvas?.getWidth?.() || canvas?.width || 0;
    const hPx = canvas?.getHeight?.() || canvas?.height || 0;
    if (wPx > 0) offsetXpx = Math.min(offsetXpx, wPx / 2);
    if (hPx > 0) offsetYpx = Math.min(offsetYpx, hPx / 2);

    return { offsetXpx, offsetYpx };
  };

  const registerHoleShape = shape => {
    if (!shape) return shape;
    try {
      const holeId = `hole-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (typeof shape.set === 'function') {
        shape.set({
          stroke: CUT_STROKE_COLOR,
          fill: shape.fill || HOLE_FILL_COLOR,
          isCutElement: true,
          cutType: 'hole',
          preventThemeRecolor: true,
          id: holeId,
        });
      } else {
        shape.stroke = CUT_STROKE_COLOR;
        shape.fill = shape.fill || HOLE_FILL_COLOR;
        shape.isCutElement = true;
        shape.cutType = 'hole';
        shape.preventThemeRecolor = true;
        shape.id = holeId;
      }
      // ensureShapeSvgId(shape, canvas, { prefix: HOLE_ID_PREFIX });
    } catch (error) {
      console.warn('Не вдалося призначити hole ID', error);
    }
    return shape;
  };

  const createLockHoleCircle = () => {
    if (!canvas) return null;
    const canvasWidth = canvas.getWidth?.() || canvas.width || 0;
    const semicircleRadiusPx = mmToPx(LOCK_ARCH_HEIGHT_MM);
    const chordY = semicircleRadiusPx;
    const holeRadiusPx = holeRadiusPxFromDiameterMm(holesDiameter || 2.5);
    const minTopGapPx = mmToPx(MIN_LOCK_HOLE_TOP_GAP_MM);
    const extraAllowancePx = mmToPx(LOCK_HOLE_EXTRA_DOWN_MM);
    const baseCenterY = semicircleRadiusPx / 2;
    const downShiftPx = mmToPx(LOCK_HOLE_DOWN_SHIFT_MM);
    const desiredCenterYBase = Math.max(baseCenterY, holeRadiusPx + minTopGapPx);
    const desiredCenterY = desiredCenterYBase + downShiftPx;
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
        originX: 'center',
        originY: 'center',
        isCutElement: true,
        cutType: 'hole',
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
      o => o.isCutElement && o.cutType === 'hole'
    );
    toRemove.forEach(o => canvas.remove(o));
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

    if (currentShapeType === 'lock') {
      const hole = createLockHoleCircle();
      if (hole) {
        try {
          const topGapMm = pxToMm((hole.top || 0) - (hole.radius || 0));
          console.log(
            `Відступ отвору зверху: ${topGapMm.toFixed(2)} мм (lock, Ø ${holesDiameter} мм)`
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
        `Відступ отворів: ${pxToMm(offsetPx).toFixed(2)} мм (тип 2, Ø ${holesDiameter} мм)`
      );
    } catch {}
    const hole = registerHoleShape(
      new fabric.Circle({
        left: canvasWidth / 2,
        top: offsetPx,
        radius: holeRadiusPxFromDiameterMm(holesDiameter || 2.5),
        fill: HOLE_FILL_COLOR, // Білий фон дирки
        stroke: CUT_STROKE_COLOR, // Оранжевий бордер
        strokeWidth: 1, // 1px
        originX: 'center',
        originY: 'center',
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
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
          `Відступ отворів: ${pxToMm(offsetPx).toFixed(2)} мм (тип 3, Ø ${holesDiameter} мм)`
        );
      } catch {}

      // Лівий отвір
      const leftHole = registerHoleShape(
        new fabric.Circle({
          left: offsetPx,
          top: canvasHeight / 2,
          radius: holeRadiusPxFromDiameterMm(holesDiameter || 2.5),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: 'center',
          originY: 'center',
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: 'hole', // Додаємо тип cut елементу
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
          radius: holeRadiusPxFromDiameterMm(holesDiameter || 2.5),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: 'center',
          originY: 'center',
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: 'hole', // Додаємо тип cut елементу
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
          `Відступ отворів: ${pxToMm(offsetPx).toFixed(2)} мм (тип 4, Ø ${holesDiameter} мм)`
        );
      } catch {}

      // Верхній лівий
      const topLeft = registerHoleShape(
        new fabric.Circle({
          left: offsetPx,
          top: offsetPx,
          radius: holeRadiusPxFromDiameterMm(holesDiameter || 2.5),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: 'center',
          originY: 'center',
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: 'hole', // Додаємо тип cut елементу
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
          radius: holeRadiusPxFromDiameterMm(holesDiameter || 2.5),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: 'center',
          originY: 'center',
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: 'hole', // Додаємо тип cut елементу
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
          radius: holeRadiusPxFromDiameterMm(holesDiameter || 2.5),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: 'center',
          originY: 'center',
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: 'hole', // Додаємо тип cut елементу
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
          radius: holeRadiusPxFromDiameterMm(holesDiameter || 2.5),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: 'center',
          originY: 'center',
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: 'hole', // Додаємо тип cut елементу
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

  // Тип 5 - 4 ПРЯМОКУТНІ отвори 5x2мм у кутах (динамічний відступ як у решти)
  const addHoleType5 = () => {
    if (!canvas) return;
    clearExistingHoles();
    setIsHolesSelected(true);
    setActiveHolesType(5);
    const holeWmm = RECT_HOLE_WIDTH_MM;
    const holeHmm = RECT_HOLE_HEIGHT_MM;
    const wPx = canvas.getWidth();
    const hPx = canvas.getHeight();
    const { offsetXpx, offsetYpx } = getRectHoleOffsetsPx();
    const cxLeft = offsetXpx;
    const cxRight = wPx - offsetXpx;
    const cyTop = offsetYpx;
    const cyBottom = hPx - offsetYpx;
    const hwPx = mmToPx(holeWmm);
    const hhPx = mmToPx(holeHmm);
    const makeRect = (left, top) =>
      registerHoleShape(
        new fabric.Rect({
          left,
          top,
          width: hwPx,
          height: hhPx,
          originX: 'center',
          originY: 'center',
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          isCutElement: true,
          cutType: 'hole',
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
        `Тип5: 4 прямокутні 5x2мм. Горизонтальний відступ центру=${pxToMm(offsetXpx).toFixed(
          2
        )}мм, вертикальний=${pxToMm(offsetYpx).toFixed(2)}мм`
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
        radius: holeRadiusPxFromDiameterMm(diameterMm),
        fill: HOLE_FILL_COLOR,
        stroke: CUT_STROKE_COLOR,
        strokeWidth: 1,
        originX: 'center',
        originY: 'center',
        isCutElement: true,
        cutType: 'hole',
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
        `Type6 hole: center=(${pxToMm(offsetPx).toFixed(2)}mm, ${pxToMm(centerY).toFixed(
          2
        )}mm) diameter=${diameterMm}mm (px ${diameterPx.toFixed(2)})`
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
          `Відступ отворів: ${pxToMm(offsetPx).toFixed(2)} мм (тип 7, Ø ${holesDiameter} мм)`
        );
      } catch {}

      const rightHole = registerHoleShape(
        new fabric.Circle({
          left: canvasWidth - offsetPx,
          top: canvasHeight / 2,
          radius: holeRadiusPxFromDiameterMm(holesDiameter || 3),
          fill: HOLE_FILL_COLOR,
          stroke: CUT_STROKE_COLOR,
          strokeWidth: 1,
          originX: 'center',
          originY: 'center',
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: 'hole', // Додаємо тип cut елементу
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

  /* ========== EXCEL EXPORT - DISABLED ==========
   * Функція exportToExcel закоментована.
   * Збережена для можливого використання в майбутньому.
   *
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
  ========== END EXCEL EXPORT ========== */

  /* ========== EXCEL IMPORT (legacy) ==========
   * Стара реалізація імпорту Excel.
   *
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
  ========== END EXCEL IMPORT (legacy) ========== */

  // Новий імпорт тексту з Excel: кожний рядок стає окремим текстовим об'єктом
  const importFromExcel = () => {
    if (!canvas) {
      alert('Canvas не ініціалізований');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';

    input.onchange = event => {
      const file = event?.target?.files?.[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = loadEvent => {
        try {
          const arrayBuffer = loadEvent?.target?.result;
          if (!(arrayBuffer instanceof ArrayBuffer)) {
            throw new Error('Невідомий формат файлу');
          }

          const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
            type: 'array',
          });

          const sheetName = workbook.SheetNames?.[0];
          if (!sheetName) {
            throw new Error('Файл не містить аркушів');
          }

          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            blankrows: false,
          });

          const texts = rows
            .map(row =>
              Array.isArray(row)
                ? row
                    .map(cell => (cell === null || cell === undefined ? '' : String(cell).trim()))
                    .filter(Boolean)
                : []
            )
            .map(cells => cells.join(' '))
            .map(text => text.trim())
            .filter(text => text.length > 0);

          if (texts.length === 0) {
            throw new Error('Файл не містить текстових даних');
          }

          const canvasWidth = canvas.getWidth();
          const canvasHeight = canvas.getHeight();
          const FONT_SIZE_MM = 5;
          const fontSize = Math.round(FONT_SIZE_MM * PX_PER_MM);
          const lineSpacing = Math.round(2 * PX_PER_MM);
          const totalHeight = texts.length * fontSize + (texts.length - 1) * lineSpacing;
          let currentTop = canvasHeight / 2 - totalHeight / 2;
          const createdObjects = [];

          canvas.discardActiveObject?.();

          texts.forEach(text => {
            const textObject = new fabric.IText(text, {
              left: canvasWidth / 2,
              top: currentTop,
              originX: 'center',
              originY: 'top',
              fontSize,
              fill: '#000000',
              selectable: true,
            });

            currentTop += fontSize + lineSpacing;
            canvas.add(textObject);
            createdObjects.push(textObject);
          });

          canvas.renderAll();

          if (createdObjects.length > 0) {
            canvas.setActiveObject(createdObjects[0]);
          }

          alert(`Імпортовано ${createdObjects.length} текстових рядків`);
        } catch (error) {
          console.error('Помилка імпорту тексту з Excel:', error);
          alert(`Не вдалося імпортувати текст: ${error.message}`);
        }
      };

      reader.onerror = error => {
        console.error('Помилка читання файлу Excel:', error);
        alert('Не вдалося прочитати файл Excel');
      };

      reader.readAsArrayBuffer(file);
    };

    input.click();
  };

  // Фігури (Shape Icons) - встановлюють форму canvas
  const resetCornerRadiusState = () => {
    setSizeValues(prev => ({ ...prev, cornerRadius: 0 }));
  };

  // Helper: встановлення типу фігури (локально + на canvas для збереження в БД)
  const setShapeType = type => {
    setCurrentShapeType(type);
    if (canvas) {
      canvas.set('shapeType', type);
    }
  };

  // Icon0 - Прямокутник (задає форму canvas)
  const addRectangle = () => {
    if (canvas) {
      const cornerMm = hasUserEditedCanvasCornerRadiusRef.current
        ? rectangleCornerRadiusMmRef.current
        : DEFAULT_RECT_CANVAS_CORNER_RADIUS_MM;
      setIsCustomShapeApplied(false);
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setShapeType('rectangle');

      // УНІФІКУЄМО: створення через той самий пайплайн, що й ресайз (updateSize)
      // Це прибирає «тонкий контур» на rectangle до першого resize.
      const width = 120; // mm
      const height = 80; // mm
      setSizeValues(prev => ({ ...prev, width, height, cornerRadius: cornerMm }));
      try {
        canvas.set('cornerRadius', cornerMm);
      } catch {}

      updateSize({ widthMm: width, heightMm: height, cornerRadiusMm: cornerMm });

      rebuildCanvasBordersAfterShapeChange();

      // Відстежуємо зміну форми полотна
      trackShapeChange('rectangle');
    }
  };

  // Icon1 - Коло (задає форму canvas)
  const addCircle = () => {
    if (canvas) {
      resetCornerRadiusState();
      setIsCustomShapeApplied(false);
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setShapeType('circle');

      // УНІФІКУЄМО: створення через той самий пайплайн, що й ресайз (updateSize)
      const width = 100; // mm
      const height = 100; // mm
      setSizeValues(prev => ({ ...prev, width, height, cornerRadius: 0 }));
      updateSize({ widthMm: width, heightMm: height, cornerRadiusMm: 0 });

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon2 - Еліпс (задає форму canvas)
  const addEllipse = () => {
    if (canvas) {
      resetCornerRadiusState();
      setIsCustomShapeApplied(false);
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setShapeType('ellipse');

      // УНІФІКУЄМО: створення через той самий пайплайн, що й ресайз (updateSize)
      const width = 140; // mm
      const height = 80; // mm
      setSizeValues(prev => ({ ...prev, width, height, cornerRadius: 0 }));
      updateSize({ widthMm: width, heightMm: height, cornerRadiusMm: 0 });

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon3 - Замок (задає форму canvas)
  const addLock = () => {
    if (canvas) {
      // Якщо вже активна форма lock і є отвір типу 2 (верхній) — просто ігноруємо повторне створення
      if (currentShapeType === 'lock' && isHolesSelected && activeHolesType === 2) {
        return; // залишаємо існуючу дирку
      }
      resetCornerRadiusState();
      setIsCustomShapeApplied(false);
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setShapeType('lock');

      // Lock starts with no rounding by default.
      // IMPORTANT: do not read cornerRadius from sizeValues here (setState is async).
      const lockCornerRadiusMm = 0;
      try {
        canvas.set?.('cornerRadius', 0);
        canvas.set?.('hasUserEditedCanvasCornerRadius', false);
      } catch {}

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
        const cornerRadiusPx = mmToPx(lockCornerRadiusMm);
        const baseCr = Math.min(cornerRadiusPx, rectBottomY - rectTopY, wPx / 2);
        const topSideLen = wPx - rightArcX; // від правого краю дуги до правого краю прямокутника
        const crTop = Math.min(baseCr, topSideLen);
        const crBottom = baseCr;
        const cornerSegs = baseCr > 0 ? Math.max(10, Math.round(baseCr / 2)) : 0;
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
      setSizeValues(prev => ({
        ...prev,
        width: widthMM,
        height: totalHeightMM,
        cornerRadius: 0,
      }));

      updateCanvasOutline();
      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon4 - Коло з горизонтальною лінією (задає форму canvas)
  const addCircleWithLine = () => {
    if (canvas) {
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setShapeType('circleWithLine');

      // Встановлюємо розміри canvas (100x100 мм для кола)
      canvas.setDimensions({ width: mmToPx(100), height: mmToPx(100) });

      // Створюємо clipPath у формі кола
      const clipPath = new fabric.Circle({
        left: mmToPx(100) / 2,
        top: mmToPx(100) / 2,
        radius: mmToPx(100) / 2,
        originX: 'center',
        originY: 'center',
        absolutePositioned: true,
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues(prev => ({
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
      const lineThicknessMm = 1; // Fixed 1mm thickness

      // Лінії повинні відповідати поточному кольору тексту/обводки (включно з синім/червоним).
      // Fallback (якщо глобальні кольори ще не ініціалізовані): чорний/білий за темою.
      const themeStroke = globalColors?.strokeColor || globalColors?.textColor;
      const isBlackTheme = [0, 1, 2, 7, 8, 12].includes(selectedColorIndex);
      const lineColor = themeStroke || (isBlackTheme ? '#000000' : '#FFFFFF');

      const centerLine = new fabric.Rect({
        left: mmToPx(100) / 2,
        top: mmToPx(100) / 2,
        originX: 'center',
        originY: 'center',
        width: mmToPx(lineWidthMm),
        height: mmToPx(lineThicknessMm),
        fill: lineColor,
        stroke: lineColor,
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
        hoverCursor: 'default',
        moveCursor: 'default',
        strokeUniform: true,
        isCircleWithLineCenterLine: true,
        name: 'circleWithLineCenterLine',
        id: 'LineFromCircle',
      });
      canvas.add(centerLine);

      // Заготовки тексту над і під лінією
      const radiusMm = diameterMm / 2;
      const gapMm = (radiusMm - lineThicknessMm / 2) / 6; // еще меньший отступ для компактности
      const topY = mmToPx(100) / 2 - mmToPx(gapMm);
      const bottomY = mmToPx(100) / 2 + mmToPx(gapMm);
      const commonText = {
        fontSize: mmToPx(5),
        fontFamily: 'Arial',
        fill: globalColors?.textColor || '#000',
        originX: 'center',
        originY: 'center',
        textAlign: 'center',
        selectable: true,
        editable: true,
      };
      const topText = new fabric.IText('TEXT TOP', {
        left: mmToPx(100) / 2,
        top: topY,
        ...commonText,
        isCircleWithLineTopText: true,
        name: 'circleWithLineTopText',
      });
      const bottomText = new fabric.IText('TEXT BOTTOM', {
        left: mmToPx(100) / 2,
        top: bottomY,
        ...commonText,
        isCircleWithLineBottomText: true,
        name: 'circleWithLineBottomText',
      });
      canvas.add(topText, bottomText);
      canvas.sendObjectToBack(centerLine);

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon5 - Коло з хрестом (задає форму canvas)
  const addCircleWithCross = () => {
    if (canvas) {
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setShapeType('circleWithCross');

      // Встановлюємо розміри canvas (100x100 мм для кола)
      canvas.setDimensions({ width: mmToPx(100), height: mmToPx(100) });

      // Створюємо clipPath у формі кола
      const clipPath = new fabric.Circle({
        left: mmToPx(100) / 2,
        top: mmToPx(100) / 2,
        radius: mmToPx(100) / 2,
        originX: 'center',
        originY: 'center',
        absolutePositioned: true,
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues(prev => ({
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
      const lineThicknessMm = 1; // Fixed 1mm thickness

      // Лінії повинні відповідати поточному кольору тексту/обводки (включно з синім/червоним).
      // Fallback (якщо глобальні кольори ще не ініціалізовані): чорний/білий за темою.
      const themeStroke = globalColors?.strokeColor || globalColors?.textColor;
      const isBlackTheme = [0, 1, 2, 7, 8, 12].includes(selectedColorIndex);
      const lineColor = themeStroke || (isBlackTheme ? '#000000' : '#FFFFFF');

      const hLine = new fabric.Rect({
        left: mmToPx(100) / 2,
        top: mmToPx(100) / 2,
        originX: 'center',
        originY: 'center',
        width: mmToPx(lineWidthMm),
        height: mmToPx(lineThicknessMm),
        fill: lineColor,
        stroke: lineColor,
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
        hoverCursor: 'default',
        moveCursor: 'default',
        strokeUniform: true,
        isCircleWithCrossHorizontalLine: true,
        name: 'circleWithCrossHorizontalLine',
        id: 'LineFromCircle',
      });
      canvas.add(hLine);
      // Додаємо вертикальну лінію: висота 33% діаметра, починається від центру вниз
      const vHeightMm = diameterMm * 0.33;
      const vLine = new fabric.Rect({
        left: mmToPx(100) / 2,
        top: mmToPx(100) / 2 + 2, // верх вертикальної лінії у центрі
        originX: 'center',
        originY: 'top',
        width: mmToPx(lineThicknessMm),
        height: mmToPx(vHeightMm),
        fill: lineColor,
        stroke: lineColor,
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
        hoverCursor: 'default',
        moveCursor: 'default',
        strokeUniform: true,
        isCircleWithCrossVerticalLine: true,
        name: 'circleWithCrossVerticalLine',
        id: 'LineFromCircle',
      });
      canvas.add(vLine);
      // Тексти як Textbox: top center, bottom left, bottom right
      const radiusMm = diameterMm / 2;
      const gapMm = (radiusMm - lineThicknessMm / 2) / 6; // еще меньший отступ для компактности
      const topY = mmToPx(100) / 2 - mmToPx(gapMm);
      const bottomY = mmToPx(100) / 2 + mmToPx(gapMm);
      const commonTextbox = {
        fontSize: mmToPx(5), // 5 мм по стандарту
        fontFamily: 'Arial',
        fill: globalColors?.textColor || '#000',
        originY: 'center',
        selectable: true,
        editable: true,
        splitByGrapheme: true, // м'який перенос по символах
      };
      const centerX = mmToPx(100) / 2;
      const lineThicknessPx = mmToPx(lineThicknessMm);
      const lineWidthPx = mmToPx(lineWidthMm);
      const paddingPx = mmToPx(0.5); // зменшений відступ для ближчого розташування до лінії

      const topText = new fabric.Textbox('TEXT TOP', {
        left: centerX,
        top: topY,
        width: Math.max(20, lineWidthPx - paddingPx * 2),
        textAlign: 'center',
        originX: 'center',
        ...commonTextbox,
        isCircleWithCrossTopText: true,
        name: 'circleWithCrossTopText',
      });
      const bottomLeftText = new fabric.Textbox('TEXT L', {
        left: paddingPx, // стартова позиція, можна рухати по X
        top: bottomY,
        textAlign: 'center', // центр у своїй області
        originX: 'left',
        ...commonTextbox,
        isCircleWithCrossBottomLeftText: true,
        name: 'circleWithCrossBottomLeftText',
      });
      const bottomRightText = new fabric.Textbox('TEXT R', {
        left: centerX + lineThicknessPx / 2 + paddingPx, // старт справа від вертикалі, можна рухати по X
        top: bottomY,
        textAlign: 'center', // центр у своїй області
        originX: 'left',
        ...commonTextbox,
        splitByGrapheme: true, // перенос по буквах завжди
        isCircleWithCrossBottomRightText: true,
        name: 'circleWithCrossBottomRightText',
      });
      // Зафіксувати стартовий валідний розмір = 5мм
      const startPx = mmToPx(5);
      topText._lastValidFontSize = startPx;
      bottomLeftText._lastValidFontSize = startPx;
      bottomRightText._lastValidFontSize = startPx;
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
          return pts.every(p => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            return dx * dx + dy * dy <= padR * padR;
          });
        };

        // Перевірка «влазить?»
        const fitsNow = tb => {
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
          if (tb.isCircleWithCrossBottomLeftText || tb.isCircleWithCrossBottomRightText) {
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

        // Підігнати розмір шрифту, щоб не виходити за межі круга
        const fitInsideCircle = tb => {
          if (!tb) return;
          if (tb.__fitting) return;
          tb.__fitting = true;

          let minFont = Math.floor(mmToPx(5));
          if (typeof tb.__minFontPx === 'number') {
            minFont = Math.max(1, Math.round(tb.__minFontPx));
          }
          const current = Math.max(minFont, Math.round(tb.fontSize || minFont));

          tb.initDimensions && tb.initDimensions();

          // Перевіряємо чи текст виходить за межі canvas
          let rect = tb.getBoundingRect(true, true);
          if (rect.top < 0) tb.top += -rect.top;
          if (rect.left < 0) tb.left += -rect.left;
          if (rect.left + rect.width > canvasW) tb.left -= rect.left + rect.width - canvasW;
          if (rect.top + rect.height > canvasH) tb.top -= rect.top + rect.height - canvasH;
          tb.initDimensions && tb.initDimensions();

          tb.__fitting = false;
        };

        // Верхній текст: ширина по горизонтальній лінії, вільно рухається
        topText.set({
          width: Math.max(20, lineWidthPx - paddingPx * 2),
          originX: 'center',
          textAlign: 'center',
        });
        topText.initDimensions && topText.initDimensions();
        fitInsideCircle(topText);

        // Лівий нижній бокс: динамічна ширина до вертикальної лінії
        const leftW = Math.max(20, vLeft - paddingPx - (bottomLeftText.left || 0));
        bottomLeftText.set({
          width: leftW,
          originX: 'left',
        });
        bottomLeftText.initDimensions && bottomLeftText.initDimensions();
        fitInsideCircle(bottomLeftText);

        // Правий нижній бокс: динамічна ширина до правого краю
        let rightTextLeft = bottomRightText.left || vRight + paddingPx;
        let minLeft = vRight + paddingPx;
        let maxRight = canvasW - paddingPx;
        rightTextLeft = Math.max(minLeft, bottomRightText.left || minLeft);
        let rightW = Math.max(20, maxRight - rightTextLeft);
        if (rightTextLeft + rightW > maxRight) {
          rightTextLeft = maxRight - rightW;
        }
        bottomRightText.set({
          left: rightTextLeft,
          width: rightW,
          originX: 'left',
        });
        bottomRightText.initDimensions && bottomRightText.initDimensions();
        fitInsideCircle(bottomRightText);

        canvas.requestRenderAll();
      };

      // Події для нормалізації масштабу в fontSize (без автоперерозкладки)
      const attachScaleHandler = obj => {
        obj.on('scaling', () => {
          try {
            const scale = Math.max(obj.scaleX || 1, obj.scaleY || 1);
            if (scale !== 1) {
              const base = Math.round(obj.fontSize || mmToPx(5));
              const desired = Math.max(6, Math.round(base * scale));
              obj.set({ scaleX: 1, scaleY: 1, fontSize: desired });
              obj.initDimensions && obj.initDimensions();
              canvas.requestRenderAll();
            }
          } catch (e) {}
        });
      };
      attachScaleHandler(topText);
      attachScaleHandler(bottomLeftText);
      attachScaleHandler(bottomRightText);

      // Встановлюємо початкові позиції (без прижимання)
      const canvasW = mmToPx(100);
      const canvasH = mmToPx(100);
      const centerX2 = canvasW / 2;

      topText.set({
        left: centerX2,
        top: topY,
        width: Math.max(20, lineWidthPx - paddingPx * 2),
      });
      bottomLeftText.set({
        left: paddingPx,
        top: bottomY,
        width: Math.max(20, centerX2 - lineThicknessPx / 2 - paddingPx * 2),
      });
      bottomRightText.set({
        left: centerX2 + lineThicknessPx / 2 + paddingPx,
        top: bottomY,
        width: Math.max(20, canvasW - (centerX2 + lineThicknessPx / 2 + paddingPx) - paddingPx),
      });

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon6 - Будинок (задає форму canvas)
  const addHouse = () => {
    if (canvas) {
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType('house');

      // Встановлюємо розміри canvas (96x105 мм для будинка)
      const wPxH = mmToPx(96);
      const hPxH = mmToPx(105);
      canvas.setDimensions({ width: wPxH, height: hPxH });

      // Створюємо clipPath у формі будинка
      const clipPath = new fabric.Path('M6 66V105H51H90V66L48 6L6 66Z', {
        absolutePositioned: true,
        left: (wPxH - 96) / 2,
        top: (hPxH - 105) / 2,
        scaleX: Math.min(wPxH / 96, hPxH / 105),
        scaleY: Math.min(wPxH / 96, hPxH / 105),
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues(prev => ({
        ...prev,
        width: 96,
        height: 105,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon7 - Адаптивний трикутник (Polygon): видні всі кути при 190:165; при меншій ширині бокові кути обрізаються
  // Icon7 - Півкруг (задає форму canvas)
  const addExtendedHalfCircle = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType('extendedHalfCircle');

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
      setSizeValues(prev => ({
        ...prev,
        width: baseWmm,
        height: baseHmm,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  const addHalfCircle = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType('halfCircle');

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
      setSizeValues(prev => ({
        ...prev,
        width: baseWmm,
        height: baseHmm,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon8 - Адаптивний трикутник (задає форму canvas)
  const addAdaptiveTriangle = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Тип поточної фігури - адаптивний трикутник
      setCurrentShapeType('adaptiveTriangle');

      // Початкові розміри — референс 190x165 мм (по дефолту трикутник)
      const width = 190;
      const height = 165;
      canvas.setDimensions({ width: mmToPx(width), height: mmToPx(height) });

      // Побудова адаптивного трикутника та обрізання по краях
      const triData = getAdaptiveTriangleData(mmToPx(width), mmToPx(height));
      console.log(
        '[adaptiveTriangle] addAdaptiveTriangle: isFull=',
        triData.isFull,
        'points=',
        triData.points?.length
      );
      const rCorner = mmToPx(sizeValues.cornerRadius || 0);
      if (triData.isFull) {
        const d = makeRoundedTrianglePath(mmToPx(width), mmToPx(height), rCorner);
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
            const d = makeRoundedTrianglePath(mmToPx(width), mmToPx(height), rCorner);
            try {
              const svgNS = 'http://www.w3.org/2000/svg';
              const path = document.createElementNS(svgNS, 'path');
              path.setAttribute('d', d);
              const total = path.getTotalLength();
              const target = Math.min(1400, Math.max(160, Math.round(total)));
              const triRoundedPts = [];
              for (let i = 0; i <= target; i++) {
                const p = path.getPointAtLength((total * i) / target);
                triRoundedPts.push({ x: p.x, y: p.y });
              }
              pts = clipPolygonWithRect(triRoundedPts, mmToPx(width), mmToPx(height));
            } catch (e) {
              const seg = Math.max(8, Math.min(24, Math.round(rCorner / 2)));
              const weights = getAdaptivePentagonCornerWeights(
                pts,
                mmToPx(width),
                mmToPx(height),
                sizeValues.cornerRadius || 0
              );
              pts = sampleRoundedPolygonPerCornerFlexible(pts, rCorner, seg, weights);
            }
          } else {
            const seg = Math.max(8, Math.min(24, Math.round(rCorner / 2)));
            const weights = getAdaptivePentagonCornerWeights(
              pts,
              mmToPx(width),
              mmToPx(height),
              sizeValues.cornerRadius || 0
            );
            pts = sampleRoundedPolygonPerCornerFlexible(pts, rCorner, seg, weights);
          }
        }
        const clipPath = new fabric.Polygon(pts, { absolutePositioned: true });
        canvas.clipPath = clipPath;
      }

      // Оновлюємо розміри в state
      setSizeValues(prev => ({ ...prev, width, height, cornerRadius: 0 }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon9 - Шестикутник (задає форму canvas)
  const addHexagon = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType('hexagon');

      // Встановлюємо розміри canvas (127x114 мм для шестикутника)
      canvas.setDimensions({ width: mmToPx(127), height: mmToPx(114) });

      // Створюємо clipPath у формі шестикутника з урахуванням радіуса кутів
      const d = makeRoundedHexagonPath(
        mmToPx(127),
        mmToPx(114),
        currentShapeType === 'hexagon' ? mmToPx(sizeValues.cornerRadius || 0) : 0
      );

      const clipPath = new fabric.Path(d, {
        absolutePositioned: true,
        originX: 'center',
        originY: 'center',
        left: mmToPx(127) / 2,
        top: mmToPx(114) / 2,
      });

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues(prev => ({
        ...prev,
        width: 127,
        height: 114,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon10 - Восьмикутник (задає форму canvas)
  const addOctagon = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType('octagon');

      // Встановлюємо розміри canvas (100x100 мм для восьмикутника)
      canvas.setDimensions({ width: mmToPx(100), height: mmToPx(100) });

      // Створюємо clipPath у формі восьмикутника з урахуванням радіуса кутів
      const d = makeRoundedOctagonPath(
        mmToPx(100),
        mmToPx(100),
        currentShapeType === 'octagon' ? mmToPx(sizeValues.cornerRadius || 0) : 0
      );
      const clipPath = new fabric.Path(d, {
        absolutePositioned: true,
        // Центруємо по реальному розміру полотна (100×100 мм),
        // а не по 120×80 мм, щоб виключити зсув фігури до ресайзу
        originX: 'center',
        originY: 'center',
        objectCaching: false,
      });
      // Нормалізуємо позицію та pathOffset відносно поточного canvas
      centerPathToCanvas(clipPath, mmToPx(100), mmToPx(100));

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues(prev => ({
        ...prev,
        width: 100,
        height: 100,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon11 - Трикутник (задає форму canvas)
  const addTriangleUp = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType('triangle');

      // Встановлюємо розміри canvas (100x100 мм для трикутника)
      canvas.setDimensions({ width: mmToPx(100), height: mmToPx(100) });

      // Створюємо clipPath у формі трикутника з урахуванням радіуса кутів
      const d = makeRoundedTrianglePath(
        mmToPx(100),
        mmToPx(100),
        currentShapeType === 'triangle' ? mmToPx(sizeValues.cornerRadius || 0) : 0
      );
      const clipPath = new fabric.Path(d, {
        absolutePositioned: true,
        originX: 'center',
        originY: 'center',
        objectCaching: false,
      });
      centerPathToCanvas(clipPath, mmToPx(100), mmToPx(100));

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues(prev => ({
        ...prev,
        width: 100,
        height: 100,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon12 - Стрілка вліво (задає форму canvas)
  const addArrowLeft = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType('arrowLeft');

      const widthPx = mmToPx(120);
      const heightPx = mmToPx(80);
      // Встановлюємо розміри canvas (120x80 мм для стрілки)
      canvas.setDimensions({ width: widthPx, height: heightPx });

      // Створюємо clipPath у формі стрілки вліво з урахуванням радіуса кутів
      const d = makeRoundedArrowLeftPath(
        widthPx,
        heightPx,
        currentShapeType === 'arrowLeft' ? mmToPx(sizeValues.cornerRadius || 0) : 0
      );
      const clipPath = new fabric.Path(d, {
        absolutePositioned: true,
        objectCaching: false,
      });
      centerPathToCanvas(clipPath, widthPx, heightPx);

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues(prev => ({
        ...prev,
        width: 120,
        height: 80,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon13 - Стрілка вправо (задає форму canvas)
  const addArrowRight = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType('arrowRight');

      const widthPx = mmToPx(120);
      const heightPx = mmToPx(80);
      // Встановлюємо розміри canvas (120x80 мм для стрілки)
      canvas.setDimensions({ width: widthPx, height: heightPx });

      // Створюємо clipPath у формі стрілки вправо з урахуванням радіуса кутів
      const d = makeRoundedArrowRightPath(
        widthPx,
        heightPx,
        currentShapeType === 'arrowRight' ? mmToPx(sizeValues.cornerRadius || 0) : 0
      );
      const clipPath = new fabric.Path(d, {
        absolutePositioned: true,
        objectCaching: false,
      });
      centerPathToCanvas(clipPath, widthPx, heightPx);

      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;

      // Оновлюємо розміри в state
      setSizeValues(prev => ({
        ...prev,
        width: 120,
        height: 80,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon14 - Прапор (задає форму canvas)
  const addFlag = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType('flag');

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
      setSizeValues(prev => ({
        ...prev,
        width: 720,
        height: 600,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Icon15 - Ромб (задає форму canvas)
  const addDiamond = () => {
    if (canvas) {
      resetCornerRadiusState();
      // Зберігаємо всі елементи; прибираємо лише бордер/outline
      preserveElementsOnShapeChange();

      // Встановлюємо тип поточної фігури
      setCurrentShapeType('diamond');

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
      setSizeValues(prev => ({
        ...prev,
        width: 600,
        height: 600,
        cornerRadius: 0,
      }));

      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();

      canvas.renderAll();

      rebuildCanvasBordersAfterShapeChange();
    }
  };

  // Автоматична ініціалізація прямокутника для порожніх полотен
  useEffect(() => {
    if (!canvas) return;

    const handleCanvasLoaded = e => {
      // Перевіряємо чи полотно порожнє (немає об'єктів і немає clipPath)
      const objects = canvas.getObjects();
      const hasObjects = objects && objects.length > 0;
      const hasClipPath = !!canvas.clipPath;

      // Якщо полотно порожнє - ініціалізуємо прямокутник
      if (!hasObjects && !hasClipPath) {
        console.log('Canvas is empty, initializing default rectangle shape');
        // Невелика затримка щоб canvas встиг повністю завантажитися
        setTimeout(() => {
          addRectangle();
        }, 100);
      }
    };

    window.addEventListener('canvas:loaded', handleCanvasLoaded);

    return () => {
      window.removeEventListener('canvas:loaded', handleCanvasLoaded);
    };
  }, [canvas, addRectangle]);

  const handleInputChange = (key, max, rawValue) => {
    const baseSizeValues = latestSizeValuesRef.current || sizeValues;
    const isHeightField = key === 'height';
    const isLockShape = currentShapeType === 'lock';
    const effectiveMax =
      isLockShape && isHeightField ? Math.max(0, max - LOCK_ARCH_HEIGHT_MM) : max;

    // Поддерживаем запятую как разделитель, затем округляем до 1 знака
    const parsed = parseFloat(String(rawValue).replace(',', '.'));
    const clamped = Math.max(0, Math.min(effectiveMax, isNaN(parsed) ? 0 : parsed));
    let value = round1(clamped);
    // Keep corner radius editable for non-circle shapes.
    // For shapes where the UI disables corner radius, enforce 0.
    if (key === 'cornerRadius' && (isCircleSelected || isCustomShapeApplied)) {
      value = 0;
    }
    const effectiveHeight =
      isLockShape && isHeightField ? round1(value + LOCK_ARCH_HEIGHT_MM) : value;

    // Compute next mm values synchronously
    let next = {
      width: key === 'width' ? value : baseSizeValues.width,
      height: key === 'height' ? (isLockShape ? effectiveHeight : value) : baseSizeValues.height,
      cornerRadius: key === 'cornerRadius' ? value : baseSizeValues.cornerRadius,
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
        if (key === 'width') {
          W = LIMIT_OTHER_THRESHOLD; // редагували width
        } else if (key === 'height') {
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
      currentShapeType === 'circle' ||
      currentShapeType === 'circleWithLine' ||
      currentShapeType === 'circleWithCross';
    if (isCircleFamily && (key === 'width' || key === 'height')) {
      // Make it square using the edited dimension
      const side = key === 'width' ? next.width : next.height; // уже клампнули
      next = { ...next, width: side, height: side };
      setSizeValues(prev => ({ ...prev, width: side, height: side }));
    } else {
      if (isLockShape && isHeightField) {
        // effectiveHeight вже врахований в next.height після clampPair
        setSizeValues(prev => ({
          ...prev,
          width: next.width,
          height: next.height,
        }));
      } else {
        setSizeValues(prev => ({
          ...prev,
          width: next.width,
          height: next.height,
          cornerRadius: next.cornerRadius,
        }));
      }
    }

    // Параметри розміру застосовуємо лише до canvas/clipPath
    if (canvas) {
      if (key === 'cornerRadius' && isCustomShapeMode) {
        // Округлюємо поточну форму в режимі кастомізації
        applyCornerRadiusToCurrentPolygon(round1(next.cornerRadius));
      } else {
        if (key === 'cornerRadius' && currentShapeType === 'rectangle') {
          hasUserEditedCanvasCornerRadiusRef.current = true;
          rectangleCornerRadiusMmRef.current = round1(next.cornerRadius);
        }

        // Визначаємо напрямок зміни для трикутника: чи зменшується висота
        const prevHeightMm_forIntent = baseSizeValues.height;
        const prevWidthMm_forIntent = baseSizeValues.width;
        const editedKey = key;
        const editedIsDecrease =
          editedKey === 'height' && next.height < prevHeightMm_forIntent - 1e-3;
        updateSize({
          widthMm: round1(next.width),
          heightMm: round1(next.height),
          cornerRadiusMm: round1(next.cornerRadius),
          __editedKey: editedKey,
          __editedIsDecrease: editedIsDecrease,
          __prevWidthMm: prevWidthMm_forIntent,
          __prevHeightMm: prevHeightMm_forIntent,
        });
        if (key === 'cornerRadius') {
          updateExistingBorders({ cornerRadiusMm: round1(next.cornerRadius) });
        }
      }
    }
  };

  const changeValue = (key, delta, max) => {
    setSizeValues(prev => {
      const isHeightField = key === 'height';
      const isLockShape = currentShapeType === 'lock';
      const cur = parseFloat(String(prev[key]).replace(',', '.')) || 0;
      const minVal = isLockShape && isHeightField ? LOCK_ARCH_HEIGHT_MM : 0;
      const nextVal = Math.max(minVal, Math.min(max, cur + delta));
      let newValue = round1(nextVal);
      // For shapes where the UI disables corner radius, enforce 0.
      if (key === 'cornerRadius' && (isCircleSelected || isCustomShapeApplied)) {
        newValue = 0;
      }
      let updated = { ...prev, [key]: newValue };

      // --- Глобальні обмеження для картки (аналогічно handleInputChange) ---
      const LIMIT_SIDE_MAX = 600;
      const LIMIT_OTHER_THRESHOLD = 295;
      let w = key === 'width' ? newValue : updated.width;
      let h = key === 'height' ? newValue : updated.height;
      w = Math.min(LIMIT_SIDE_MAX, w || 0);
      h = Math.min(LIMIT_SIDE_MAX, h || 0);
      if (w > LIMIT_OTHER_THRESHOLD && h > LIMIT_OTHER_THRESHOLD) {
        if (key === 'width') {
          w = LIMIT_OTHER_THRESHOLD; // редагували width
        } else if (key === 'height') {
          h = LIMIT_OTHER_THRESHOLD; // редагували height
        }
      }
      updated.width = round1(w);
      updated.height = round1(h);

      // Enforce square for circle family shapes via arrows too
      const isCircleFamily =
        currentShapeType === 'circle' ||
        currentShapeType === 'circleWithLine' ||
        currentShapeType === 'circleWithCross';
      if (isCircleFamily && (key === 'width' || key === 'height')) {
        const side = key === 'width' ? updated.width : updated.height; // після клампу
        updated = { ...updated, width: side, height: side };
      }

      // Параметри розміру застосовуємо лише до canvas/clipPath
      if (canvas) {
        if (key === 'cornerRadius' && isCustomShapeMode) {
          applyCornerRadiusToCurrentPolygon(round1(updated.cornerRadius));
        } else {
          if (key === 'cornerRadius' && currentShapeType === 'rectangle') {
            hasUserEditedCanvasCornerRadiusRef.current = true;
            rectangleCornerRadiusMmRef.current = round1(updated.cornerRadius);
          }
          const editedKey = key;
          const editedIsDecrease = editedKey === 'height' && delta < 0;
          updateSize({
            widthMm: round1(updated.width),
            heightMm: round1(updated.height),
            cornerRadiusMm: round1(updated.cornerRadius),
            __editedKey: editedKey,
            __editedIsDecrease: editedIsDecrease,
          });
          if (key === 'cornerRadius') {
            updateExistingBorders({
              cornerRadiusMm: round1(key === 'cornerRadius' ? newValue : updated.cornerRadius),
            });
          }
        }
      }

      return updated;
    });
  };

  const actualHeightMm = Number(sizeValues?.height) || 0;
  const displayHeightMm =
    currentShapeType === 'lock'
      ? round1(Math.max(0, actualHeightMm - LOCK_ARCH_HEIGHT_MM))
      : actualHeightMm;

  // Section 2 (Size) width/height inputs: debounce apply + validation by 1s.
  // Other inputs must remain immediate.
  const sizeInputTimerRef = useRef(null);
  const sizeInputDirtyRef = useRef({ width: false, height: false });
  const lastEditedSizeKeyRef = useRef(null);
  const [widthInputValue, setWidthInputValue] = useState(() =>
    sizeValues.width === 0 ? '' : String(sizeValues.width)
  );
  const [heightInputValue, setHeightInputValue] = useState(() =>
    displayHeightMm === 0 ? '' : String(displayHeightMm)
  );

  const latestSizeInputValuesRef = useRef({ width: widthInputValue, height: heightInputValue });
  useEffect(() => {
    latestSizeInputValuesRef.current.width = widthInputValue;
  }, [widthInputValue]);
  useEffect(() => {
    latestSizeInputValuesRef.current.height = heightInputValue;
  }, [heightInputValue]);

  // Sync displayed input values from applied sizeValues unless user is actively editing.
  useEffect(() => {
    if (!sizeInputDirtyRef.current.width) {
      setWidthInputValue(sizeValues.width === 0 ? '' : String(sizeValues.width));
    }
  }, [sizeValues.width]);

  useEffect(() => {
    if (!sizeInputDirtyRef.current.height) {
      setHeightInputValue(displayHeightMm === 0 ? '' : String(displayHeightMm));
    }
    // displayHeightMm depends on currentShapeType (lock subtracts arch)
  }, [displayHeightMm, currentShapeType]);

  useEffect(() => {
    return () => {
      // cleanup timers on unmount
      if (sizeInputTimerRef.current) {
        clearTimeout(sizeInputTimerRef.current);
        sizeInputTimerRef.current = null;
      }
    };
  }, []);

  const scheduleDebouncedSizeApply = useCallback(
    (max = 1200) => {
      if (sizeInputTimerRef.current) {
        clearTimeout(sizeInputTimerRef.current);
      }

      sizeInputTimerRef.current = setTimeout(() => {
        sizeInputTimerRef.current = null;

        const dirty = sizeInputDirtyRef.current;
        const inputs = latestSizeInputValuesRef.current;
        const shape = latestShapeTypeRef.current;
        const lastKey = lastEditedSizeKeyRef.current;

        const isCircleFamily =
          shape === 'circle' || shape === 'circleWithLine' || shape === 'circleWithCross';

        if (isCircleFamily) {
          if (dirty.width || dirty.height) {
            dirty.width = false;
            dirty.height = false;
            const keyToApply = lastKey === 'height' ? 'height' : 'width';
            handleInputChange(
              keyToApply,
              max,
              keyToApply === 'width' ? inputs.width : inputs.height
            );
          }
          return;
        }

        // For non-circle shapes, apply both changed values (last edited first).
        const applyKey = key => {
          if (!dirty[key]) return;
          dirty[key] = false;
          handleInputChange(key, max, key === 'width' ? inputs.width : inputs.height);
        };

        if (lastKey === 'height') {
          applyKey('height');
          applyKey('width');
        } else {
          applyKey('width');
          applyKey('height');
        }
      }, SIZE_INPUT_DEBOUNCE_MS);
    },
    [handleInputChange]
  );

  const bumpDebouncedSizeValue = useCallback(
    (key, delta, max = 1200) => {
      if (key !== 'width' && key !== 'height') return;
      const rawCurrent = key === 'width' ? widthInputValue : heightInputValue;
      const parsed = parseFloat(String(rawCurrent).replace(',', '.'));
      const base = Number.isFinite(parsed)
        ? parsed
        : key === 'width'
          ? Number(latestSizeValuesRef.current?.width) || 0
          : displayHeightMm;

      const nextRaw = String(round1(base + delta));

      sizeInputDirtyRef.current[key] = true;
      lastEditedSizeKeyRef.current = key;
      if (key === 'width') setWidthInputValue(nextRaw);
      else setHeightInputValue(nextRaw);
      scheduleDebouncedSizeApply(max);
    },
    [widthInputValue, heightInputValue, displayHeightMm, scheduleDebouncedSizeApply]
  );

  // Corner radius input: по умолчанию показываем "0", но позволяем очищать поле
  const [isCornerEditing, setIsCornerEditing] = useState(false);
  const [cornerRadiusInput, setCornerRadiusInput] = useState('0');
  useEffect(() => {
    // Синхронизация из state, если не редактируем и поле не принудительно пустое
    if (!isCornerEditing && cornerRadiusInput !== '') {
      const v =
        sizeValues && sizeValues.cornerRadius != null ? String(sizeValues.cornerRadius) : '0';
      if (cornerRadiusInput !== v) setCornerRadiusInput(v);
    }
  }, [sizeValues?.cornerRadius, isCornerEditing]);

  // Гарантуємо що отвори (cutType: 'hole') завжди залишаються білими з оранжевим обводом, незалежно від теми.
  useEffect(() => {
    if (!canvas) return;
    let didChange = false;
    (canvas.getObjects?.() || [])
      .filter(o => o.isCutElement && o.cutType === 'hole')
      .forEach(o => {
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
      {isCustomShapeMode && <CustomShapeStopModal onConfirm={() => exitCustomShapeMode(false)} />}
      {isCustomShapeMode && overlayHandles.length > 0 && (
        <div className={styles.customShapeOverlay}>
          {overlayHandles.map(h => (
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
              onMouseDown={e => startDomDrag(e, h.index)}
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
          <span title="Rectangle with a loop (Hanging Sing)" onClick={withShapePick(addLock)}>
            {Icon3}
          </span>
          <span title="Round with a line" onClick={withShapePick(addCircleWithLine)}>
            {Icon4}
          </span>
          <span title="Round with a T-shaped line" onClick={withShapePick(addCircleWithCross)}>
            {Icon5}
          </span>
          <span title="Warning Triangle" onClick={withShapePick(addAdaptiveTriangle)}>
            {Icon6}
          </span>
          <span title="Semi round" onClick={withShapePick(addHalfCircle)}>
            {Icon7}
          </span>
          <span title="Round Top" onClick={withShapePick(addExtendedHalfCircle)}>
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
            const title = 'Custom shape';
            return (
              <span
                onClick={disabled ? undefined : toggleCustomShapeMode}
                className={
                  disabled ? styles.disabledIcon : isCustomShapeMode ? styles.activeCustomIcon : ''
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
                value={widthInputValue}
                onChange={e => {
                  const val = e.target.value;
                  sizeInputDirtyRef.current.width = true;
                  setWidthInputValue(val);
                  lastEditedSizeKeyRef.current = 'width';
                  scheduleDebouncedSizeApply(1200);
                }}
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => bumpDebouncedSizeValue('width', 1, 1200)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => bumpDebouncedSizeValue('width', -1, 1200)}
                />
              </div>
            </div>
          </div>

          <div
            className={styles.field}
            style={{
              opacity: isCircleSelected || isCustomShapeApplied ? 0.5 : 1,
              cursor: isCircleSelected || isCustomShapeApplied ? 'not-allowed' : 'default',
            }}
          >
            <label
              style={{
                cursor: isCircleSelected || isCustomShapeApplied ? 'not-allowed' : 'inherit',
              }}
            >
              Corner radius
            </label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                value={cornerRadiusInput}
                max={Math.floor(
                  Math.min(Number(sizeValues.width) || 0, Number(sizeValues.height) || 0) / 2
                )}
                disabled={isCircleSelected || isCustomShapeApplied}
                style={{
                  cursor: isCircleSelected || isCustomShapeApplied ? 'not-allowed' : 'text',
                  opacity: isCustomShapeApplied ? 0.85 : 1,
                }}
                onChange={e => {
                  setIsCornerEditing(true);
                  const raw = e.target.value;
                  if (raw === '') {
                    // Разрешаем пустую строку визуально
                    setCornerRadiusInput('');
                    return; // пока пусто — не применять
                  }
                  const maxCorner = Math.floor(
                    Math.min(Number(sizeValues.width) || 0, Number(sizeValues.height) || 0) / 2
                  );
                  const num = Number(raw);
                  const clamped = isNaN(num) ? 0 : Math.min(maxCorner, Math.max(0, num));
                  // Мгновенно отрисовываем ограниченное значение, если превысили
                  setCornerRadiusInput(String(clamped));
                  if (!isCircleSelected && !isCustomShapeApplied) {
                    handleInputChange(
                      'cornerRadius',
                      Math.floor(
                        Math.min(Number(sizeValues.width) || 0, Number(sizeValues.height) || 0) / 2
                      ),
                      clamped
                    );
                  }
                }}
                onBlur={() => {
                  setIsCornerEditing(false);
                  // Если оставили пусто — восстановим "0" визуально без изменения логики
                  if (cornerRadiusInput === '') {
                    setCornerRadiusInput('0');
                  }
                }}
              />
              <div
                className={styles.arrows}
                style={{
                  pointerEvents: isCircleSelected || isCustomShapeApplied ? 'none' : 'auto',
                  opacity: isCircleSelected || isCustomShapeApplied ? 0.6 : 1,
                }}
              >
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => {
                    if (!isCircleSelected && !isCustomShapeApplied) {
                      const maxCorner = Math.floor(
                        Math.min(Number(sizeValues.width) || 0, Number(sizeValues.height) || 0) / 2
                      );
                      changeValue('cornerRadius', 1, maxCorner);
                    }
                  }}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => {
                    if (!isCircleSelected && !isCustomShapeApplied) {
                      const maxCorner = Math.floor(
                        Math.min(Number(sizeValues.width) || 0, Number(sizeValues.height) || 0) / 2
                      );
                      changeValue('cornerRadius', -1, maxCorner);
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
                onChange={e => {
                  const val = e.target.value;
                  sizeInputDirtyRef.current.height = true;
                  setHeightInputValue(val);
                  lastEditedSizeKeyRef.current = 'height';
                  scheduleDebouncedSizeApply(1200);
                }}
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => bumpDebouncedSizeValue('height', 1, 1200)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => bumpDebouncedSizeValue('height', -1, 1200)}
                />
              </div>
            </div>
          </div>

          <div className={styles.unitLabel}>{'* (mm)'}</div>
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
          <div className={styles.fieldAdhesive}>
            <label>Adhesive Tape</label>
            <input
              type="checkbox"
              checked={isAdhesiveTape}
              onChange={e => {
                setIsAdhesiveTape(e.target.checked);
                updateThickness(thickness);
              }}
            />
          </div>
          <div></div>
          <div className={styles.unitLabel}>
            {currentShapeType === 'lock'
              ? isHolesSelected && activeHolesType !== 1
                ? holesDiameter
                : 0
              : '*'}{' '}
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
          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][0].isSelect && (
            <span
              onClick={() => handleColorPick(0, '#000000', '#FFFFFF', 'solid')}
              title="White / Black"
            >
              <A1
                borderColor={selectedColorIndex === 0 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 0 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 0 ? '3' : '1'}
              />
            </span>
          )}

          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][1].isSelect && (
            <span
              onClick={() => handleColorPick(1, '#0000FF', '#FFFFFF', 'solid')}
              title="White / Blue"
            >
              <A2
                borderColor={selectedColorIndex === 1 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 1 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 1 ? '3' : '1'}
              />
            </span>
          )}

          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][2].isSelect && (
            <span
              onClick={() => handleColorPick(2, '#FF0000', '#FFFFFF', 'solid')}
              title="White / Red"
            >
              <A3
                borderColor={selectedColorIndex === 2 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 2 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 2 ? '3' : '1'}
              />
            </span>
          )}

          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][3].isSelect && (
            <span
              onClick={() => handleColorPick(3, '#FFFFFF', '#000000', 'solid')}
              title="Black / White"
            >
              <A4
                borderColor={selectedColorIndex === 3 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 3 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 3 ? '3' : '1'}
              />
            </span>
          )}
          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][4].isSelect && (
            <span
              onClick={() => handleColorPick(4, '#FFFFFF', '#0000FF', 'solid')}
              title="Blue / White"
            >
              <A5
                borderColor={selectedColorIndex === 4 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 4 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 4 ? '3' : '1'}
              />
            </span>
          )}

          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][5].isSelect && (
            <span
              onClick={() => handleColorPick(5, '#FFFFFF', '#FF0000', 'solid')}
              title="Red / White"
            >
              <A6
                borderColor={selectedColorIndex === 5 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 5 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 5 ? '3' : '1'}
              />
            </span>
          )}

          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][6].isSelect && (
            <span
              onClick={() => handleColorPick(6, '#FFFFFF', '#018001', 'solid')}
              title="Green / White"
            >
              <A7
                borderColor={selectedColorIndex === 6 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 6 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 6 ? '3' : '1'}
              />
            </span>
          )}

          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][7].isSelect && (
            <span
              onClick={() => handleColorPick(7, '#000000', '#FFFF00', 'solid')}
              title="Yellow / Black"
            >
              <A8
                borderColor={selectedColorIndex === 7 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 7 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 7 ? '3' : '1'}
              />
            </span>
          )}

          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][8].isSelect && (
            <span
              onClick={() => handleColorPick(8, '#000000', '#F0F0F0', 'gradient')}
              title="Silver / Black"
            >
              <A9
                borderColor={selectedColorIndex === 8 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 8 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 8 ? '3' : '1'}
              />
            </span>
          )}

          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][9].isSelect && (
            <span
              onClick={() => handleColorPick(9, '#FFFFFF', '#8B4513', 'solid')}
              title="Brown / White"
            >
              <A10
                borderColor={selectedColorIndex === 9 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 9 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 9 ? '3' : '1'}
              />
            </span>
          )}

          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][10].isSelect && (
            <span
              onClick={() => handleColorPick(10, '#FFFFFF', '#FFA500', 'solid')}
              title="Orange / White"
            >
              <A11
                borderColor={selectedColorIndex === 10 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 10 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 10 ? '3' : '1'}
              />
            </span>
          )}
          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][11].isSelect && (
            <span
              onClick={() => handleColorPick(11, '#FFFFFF', '#808080', 'solid')}
              title="Gray / White"
            >
              <A12
                borderColor={selectedColorIndex === 11 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 11 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 11 ? '3' : '1'}
              />
            </span>
          )}
          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][12].isSelect && (
            <span
              onClick={() => handleColorPick(12, '#000000', '/textures/Wood.jpg', 'texture')}
              title="Maple (“Wood”) / Black"
            >
              <A13
                borderColor={selectedColorIndex === 12 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 12 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 12 ? '3' : '1'}
              />
            </span>
          )}

          {formData[`${isAdhesiveTape?'A':''}colour${thickness.toString().replace('.', '')}`][13].isSelect && (
            <span
              onClick={() => handleColorPick(13, '#FFFFFF', '/textures/Carbon.jpg', 'texture')}
              title="Carbon / White"
            >
              <A14
                borderColor={selectedColorIndex === 13 ? 'rgba(0, 108, 164, 1)' : 'black'}
                borderOpacity={selectedColorIndex === 13 ? '1' : '0.29'}
                strokeWidth={selectedColorIndex === 13 ? '3' : '1'}
              />
            </span>
          )}
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
              <span style={{ fontWeight: 'bold' }}>A</span>
              <span>Text</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addImage}>
            <span
              className={[styles.elementsSpanWrapper, isIconMenuOpen ? styles.active : ''].join(
                ' '
              )}
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
              title="Fill + Cut + Frame"
              className={[styles.elementsSpanWrapper, isShapeOpen ? styles.active : ''].join(' ')}
            >
              {Shape}
              <span>Shape</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addBorder}>
            <span
              className={[styles.elementsSpanWrapper, isBorderActive ? styles.active : ''].join(
                ' '
              )}
            >
              {Border}
              <span>Border</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={cut}>
            <span
              title="Different Shapes"
              className={[styles.elementsSpanWrapper, isCutOpen ? styles.active : ''].join(' ')}
            >
              {Cut}
              <span>Cut</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addQrCode}>
            <span className={[styles.elementsSpanWrapper, isQrOpen ? styles.active : ''].join(' ')}>
              {QrCode}
              <span>QR Code</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addBarCode}>
            <span
              className={[styles.elementsSpanWrapper, isBarCodeOpen ? styles.active : ''].join(' ')}
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
          themeColor={(globalColors && globalColors.textColor) || '#000'}
          onClose={() => setIsUploadOpen(false)}
          onConfirm={async ({ svg: finalSVG, strokeOnly }) => {
            if (!canvas || !finalSVG) return;
            try {
              let themedSVG = String(finalSVG);
              // Ensure theme color is applied
              const theme = (globalColors && globalColors.textColor) || '#000';
              try {
                const doc = new DOMParser().parseFromString(themedSVG, 'image/svg+xml');
                // Apply theme color to all relevant elements; keep strokeOnly where indicated
                doc.querySelectorAll('path,polygon,polyline,rect,circle,ellipse').forEach(el => {
                  if (strokeOnly) {
                    el.setAttribute('fill', 'transparent');
                    el.setAttribute('stroke', theme);
                    if (!el.getAttribute('stroke-width')) el.setAttribute('stroke-width', '1');
                  } else {
                    el.setAttribute('fill', theme);
                    el.setAttribute('stroke', theme);
                  }
                });
                themedSVG = new XMLSerializer().serializeToString(doc);
              } catch {}

              const result = await fabric.loadSVGFromString(themedSVG);
              const obj =
                result.objects.length === 1
                  ? result.objects[0]
                  : fabric.util.groupSVGElements(result.objects, result.options);

              // Tag to theme if needed
              try {
                obj.set && obj.set({ useThemeColor: true });
                if (obj.type === 'group' && typeof obj.forEachObject === 'function') {
                  obj.forEachObject(child => child.set && child.set({ useThemeColor: true }));
                }
              } catch {}

              // Tag as uploaded element so resize auto-fit can pick it up.
              try {
                obj.set && obj.set({ isUploadedImage: true });
              } catch {}

              // Center and scale
              obj.set({
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: 'center',
                originY: 'center',
                selectable: true,
                hasControls: true,
                hasBorders: true,
              });

              canvas.add(obj);

              // Auto-fit uploaded element to canvas (max 60%).
              try {
                fitObjectToCanvas(canvas, obj, { maxRatio: 0.6 });
              } catch {}
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
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <h3 style={{ marginRight: '60px' }}>Holes</h3>
            {isHolesSelected && activeHolesType !== 5 && (
              <>
                <div className={styles.field} style={{ margin: 0 }}>
                  <div className={styles.inputGroup}>
                    <input
                      type="number"
                      min={currentShapeType === 'lock' ? 2 : 2.5}
                      max={currentShapeType === 'lock' ? 6 : 10}
                      step={0.5}
                      value={holesDiameter}
                      onChange={e => {
                        const raw = parseFloat(e.target.value);
                        let val = isNaN(raw) ? 2.5 : raw;
                        // Только для lock и дырки сверху
                        if (currentShapeType === 'lock' && activeHolesType === 2) {
                          val = Math.max(2, Math.min(6, val));
                        }
                        setHolesDiameter(val);
                      }}
                    />
                    <div className={styles.arrows}>
                      <i
                        className="fa-solid fa-chevron-up"
                        onClick={() => {
                          setHolesDiameter(prev => {
                            let next = Number((prev + 0.5).toFixed(1));
                            if (currentShapeType === 'lock' && activeHolesType === 2) {
                              next = Math.min(6, next);
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
                          setHolesDiameter(prev => {
                            let next = Number((prev - 0.5).toFixed(1));
                            if (currentShapeType === 'lock' && activeHolesType === 2) {
                              next = Math.max(2, next);
                              next = Math.min(6, next);
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
                <p style={{ padding: '0', margin: '0 0 0 10px' }}>Ø mm</p>
              </>
            )}
          </div>
        </div>
        <div className={styles.holes}>
          <span
            onClick={addHoleType1}
            title="Without holes"
            className={activeHolesType === 1 ? styles.holeActive : ''}
          >
            {Hole1}
          </span>
          <span
            onClick={addHoleType2}
            title="One hole at the top center"
            className={activeHolesType === 2 ? styles.holeActive : ''}
          >
            {Hole2}
          </span>
          <span
            onClick={addHoleType3}
            title="Two holes on the sides"
            className={activeHolesType === 3 ? styles.holeActive : ''}
          >
            {Hole3}
          </span>
          <span
            onClick={addHoleType4}
            title="Four holes in the corners"
            className={activeHolesType === 4 ? styles.holeActive : ''}
          >
            {Hole4}
          </span>
          <span
            onClick={addHoleType5}
            title="Four rectangular holes for cable ties"
            className={activeHolesType === 5 ? styles.holeActive : ''}
          >
            {Hole5}
          </span>
          <span
            onClick={addHoleType6}
            title="Left-centered hole"
            className={activeHolesType === 6 ? styles.holeActive : ''}
          >
            {Hole6}
          </span>
          <span
            onClick={addHoleType7}
            title="Right-centered hole"
            className={activeHolesType === 7 ? styles.holeActive : ''}
          >
            {Hole7}
          </span>
        </div>
      </div>
      {/* Copies */}
      <div className={`${styles.section} ${styles.colorSection}`}>
        <div className={`${styles.colorTitleWrapper} ${styles.copiesWrapper}`}>
          <div className={styles.copyItem}>
            <h3 className={styles.copyTitle}>
              <span className={styles.copyTitleTop}>Exact</span>
              <span>Copies</span>
            </h3>
            <div className={`${styles.field} ${styles.copyField}`}>
              <div className={`${styles.inputGroup} ${styles.copyInputGroup}`}>
                <input
                  type="number"
                  value={copiesCount === 0 ? '' : copiesCount}
                  onChange={e => {
                    const val = e.target.value === '' ? '' : parseInt(e.target.value);
                    setCopiesCount(val);
                  }}
                />
                <div className={`${styles.arrows} ${styles.copyArrows}`}>
                  <i
                    className="fa-solid fa-chevron-up"
                    onClick={() =>
                      setCopiesCount(prev => {
                        const n = Number(prev);
                        return (Number.isFinite(n) ? n : 0) + 1;
                      })
                    }
                  />
                  <i
                    className="fa-solid fa-chevron-down"
                    onClick={() =>
                      setCopiesCount(prev => {
                        const n = Number(prev);
                        const safe = Number.isFinite(n) ? n : 1;
                        return safe > 1 ? safe - 1 : 1;
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.copyItem}>
            <h3 className={styles.copyTitle}>
              <span className={styles.copyTitleTop}>Editable</span>
              <span>Copies</span>
            </h3>
            <div className={`${styles.field} ${styles.copyField}`}>
              <div className={`${styles.inputGroup} ${styles.copyInputGroup}`}>
                <input
                  type="number"
                  value={editableCopiesDraft}
                  disabled={isEditableCopiesBusy}
                  onFocus={() => {
                    editableCopiesFocusedRef.current = true;
                  }}
                  onBlur={async () => {
                    editableCopiesFocusedRef.current = false;
                    await syncEditableCopies(editableCopiesDraft);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  onChange={e => {
                    setEditableCopiesDraft(e.target.value);
                  }}
                />
                <div
                  className={`${styles.arrows} ${styles.copyArrows} ${
                    isEditableCopiesBusy ? styles.copyArrowsDisabled : ''
                  }`}
                >
                  <i
                    className="fa-solid fa-chevron-up"
                    onClick={() => syncEditableCopies((Number(editableCopiesCount) || 0) + 1)}
                  />
                  <i
                    className="fa-solid fa-chevron-down"
                    onClick={() =>
                      syncEditableCopies(Math.max(0, (Number(editableCopiesCount) || 0) - 1))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Undo/Redo */}
      {/* <UndoRedo /> */}
      <QRCodeGenerator isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} />
      <BarCodeGenerator isOpen={isBarCodeOpen} onClose={() => setIsBarCodeOpen(false)} />
      <ShapeSelector isOpen={isShapeOpen} onClose={() => setIsShapeOpen(false)} />
      <CutSelector isOpen={isCutOpen} onClose={() => setIsCutOpen(false)} />
      <IconMenu isOpen={isIconMenuOpen} onClose={() => setIsIconMenuOpen(false)} />
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
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default Toolbar;
