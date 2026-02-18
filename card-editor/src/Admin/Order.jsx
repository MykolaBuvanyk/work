import React, { useEffect, useMemo, useState } from 'react';
import './OrderContainer.scss';
import { $authHost } from '../http';
import { clearAllUnsavedSigns, putProject } from '../utils/projectStorage';
import {
  FORMATS,
  buildPlacementPreview,
  formatMaterialLabel,
  getMaterialKey,
  normalizeDesigns,
  planSheets,
} from '../components/ProjectCanvasesGrid/LayoutPlannerModal/LayoutPlannerModal';
import {
  A1,A2,A3,A4,A5,A6,A7,A8,A9,A10,A11,A12,A13,A14,
} from '../assets/Icons';
import { useNavigate } from 'react-router-dom';
import combinedCountries from '../components/Countries';

const PX_PER_MM = 72 / 25.4;

const exportModeOptions = [
  'Normal',
  'Normal (MJ) Frame',
  'Sheet optimized (MJ) Fr.',
  'Sheet A4 portrait',
  'Sheet A5 portrait',
  'Sheet A4 landscape',
  'Production optimized',
];

const exportModePresets = {
  Normal: { enableGaps: false, formatKey: 'MJ_295x600', orientation: 'landscape' },
  'Normal (MJ) Frame': { enableGaps: true, formatKey: 'MJ_295x600', orientation: 'landscape' },
  'Sheet optimized (MJ) Fr.': { enableGaps: true, formatKey: 'A4', orientation: 'portrait' },
  'Sheet A4 portrait': { formatKey: 'A4', orientation: 'portrait' },
  'Sheet A5 portrait': { formatKey: 'A5', orientation: 'portrait' },
  'Sheet A4 landscape': { formatKey: 'A4', orientation: 'landscape' },
};

const downloadBlob = (blob, fileName) => {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    console.error('Failed to download blob', e);
  }
};

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const mapCartCanvasToDesign = (canvas, index) => {
  const c = canvas && typeof canvas === 'object' ? canvas : {};
  const jsonTemplate = c.jsonTemplate || c.json || c?.meta?.jsonTemplate || null;
  const widthFromJson = jsonTemplate?.width;
  const heightFromJson = jsonTemplate?.height;

  const widthMmRaw = c.widthMm ?? c.widthMM ?? c.WidthMm ?? c.WidthMM ?? null;
  const heightMmRaw = c.heightMm ?? c.heightMM ?? c.HeightMm ?? c.HeightMM ?? null;

  const widthFromMmPx = (() => {
    const mm = safeNumber(widthMmRaw, 0);
    return mm > 0 ? mm * PX_PER_MM : 0;
  })();
  const heightFromMmPx = (() => {
    const mm = safeNumber(heightMmRaw, 0);
    return mm > 0 ? mm * PX_PER_MM : 0;
  })();

  const toolbarState = { ...(c.toolbarState || {}) };
  if (c.Thickness != null && toolbarState.thickness == null) {
    toolbarState.thickness = c.Thickness;
  }
  if (c.Tape != null) {
    toolbarState.isAdhesiveTape = String(c.Tape).toUpperCase() === 'TAPE';
  }

  const backgroundColor =
    toolbarState?.globalColors?.backgroundColor ??
    c.backgroundColor ??
    c.ColorTheme ??
    null;

  return {
    id: c.id || `canvas-${index + 1}`,
    name: c.name || `Полотно ${index + 1}`,
    width: c.width || widthFromJson || widthFromMmPx || 1200,
    height: c.height || heightFromJson || heightFromMmPx || 800,
    jsonTemplate,
    backgroundColor,
    toolbarState,
    preview: c.preview || null,
    previewSvg: c.previewSvg || c.previewSVG || c.svg || null,
    copiesCount: c.copiesCount ?? toolbarState?.copiesCount ?? null,
    meta: {
      ...(c.meta || {}),
      backgroundColor,
      thickness: c.Thickness ?? toolbarState.thickness ?? null,
      isAdhesiveTape: toolbarState.isAdhesiveTape ?? null,
    },
  };
};

const Order = ({orderId,update}) => {
  const [order,setOrder]=useState();
  const [selectedMaterialKey, setSelectedMaterialKey] = useState('all');
  const [exportMode, setExportMode] = useState('Normal');

  const [formatKey, setFormatKey] = useState('MJ_295x600');
  const [orientation, setOrientation] = useState('portrait');
  const [enableGaps, setEnableGaps] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isOpeningProject, setIsOpeningProject] = useState(false);

  const [pdfMinPageWidth, setPdfMinPageWidth] = useState(0);
  const [pdfMinPageHeight, setPdfMinPageHeight] = useState(0);
  const [pdfMaxPageWidth, setPdfMaxPageWidth] = useState(0);
  const [pdfMaxPageHeight, setPdfMaxPageHeight] = useState(0);
  const [pdfPageMargin, setPdfPageMargin] = useState(0);
  const [frameSpacingMm, setFrameSpacingMm] = useState(3);
  const [pdfSignSpacing, setPdfSignSpacing] = useState(2);
  const [pdfSortOrder, setPdfSortOrder] = useState('high-first');
  const [pdfAddSheetInfo, setPdfAddSheetInfo] = useState(true);

  const [appliedMinPageWidth, setAppliedMinPageWidth] = useState(0);
  const [appliedMinPageHeight, setAppliedMinPageHeight] = useState(0);
  const [appliedMaxPageWidth, setAppliedMaxPageWidth] = useState(0);
  const [appliedMaxPageHeight, setAppliedMaxPageHeight] = useState(0);
  
  const getOrder=async()=>{
    try{
      const res=await $authHost.get('cart/get/'+orderId);
      setOrder(res.data.order);
    }catch(err){
      console.log(err);
      alert('Помилка отримання замовлення');
    }
  }

  useEffect(()=>{
    getOrder()
  },[orderId])

  // Apply export mode presets (same logic as LayoutPlannerModal).
  useEffect(() => {
    const preset = exportModePresets?.[exportMode];
    if (!preset) return;
    if (typeof preset.enableGaps === 'boolean') setEnableGaps(preset.enableGaps);
    if (typeof preset.formatKey === 'string' && preset.formatKey) setFormatKey(preset.formatKey);
    if (preset.orientation === 'portrait' || preset.orientation === 'landscape') {
      setOrientation(preset.orientation);
    }
  }, [exportMode]);

  // Debounce min/max page constraint inputs (3s) like LayoutPlannerModal.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setAppliedMinPageWidth(pdfMinPageWidth);
      setAppliedMinPageHeight(pdfMinPageHeight);
      setAppliedMaxPageWidth(pdfMaxPageWidth);
      setAppliedMaxPageHeight(pdfMaxPageHeight);
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [pdfMinPageWidth, pdfMinPageHeight, pdfMaxPageWidth, pdfMaxPageHeight]);

  const designs = useMemo(() => {
    const canvases = order?.orderMongo?.project?.canvases;
    if (!Array.isArray(canvases)) return [];
    return canvases.map(mapCartCanvasToDesign).filter(Boolean);
  }, [order]);

  const normalizedItems = useMemo(() => normalizeDesigns(designs), [designs]);

  const materialGroups = useMemo(() => {
    const groups = new Map();
    normalizedItems.forEach((item) => {
      const key = getMaterialKey(item);
      const existing = groups.get(key);
      const countToAdd = Math.max(1, Number(item?.copies) || 1);
      if (!existing) {
        const [colorPart, thicknessPart, tapePart] = String(key).split('::');
        groups.set(key, {
          key,
          color: colorPart || 'unknown',
          thickness: thicknessPart || 'unknown',
          tape: tapePart || 'unknown-tape',
          count: countToAdd,
        });
      } else {
        existing.count += countToAdd;
      }
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.key.localeCompare(b.key);
    });
  }, [normalizedItems]);

  useEffect(() => {
    if (selectedMaterialKey === 'all') return;
    const exists = materialGroups.some((g) => g.key === selectedMaterialKey);
    if (!exists) setSelectedMaterialKey('all');
  }, [materialGroups, selectedMaterialKey]);

  const effectiveSignSpacingMm = (() => {
    const parsed = Number(pdfSignSpacing);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return 5;
  })();

  const sheetSize = useMemo(() => {
    const isMjFrameMode = exportMode === 'Sheet optimized (MJ) Fr.';
    const a4 = FORMATS.A4;
    const base = FORMATS[formatKey] || FORMATS.A4;
    const oriented = isMjFrameMode
      ? { width: a4.width, height: a4.height }
      : orientation === 'landscape'
        ? { width: base.height, height: base.width }
        : { width: base.width, height: base.height };

    const minW = Math.max(0, safeNumber(appliedMinPageWidth, 0));
    const minH = Math.max(0, safeNumber(appliedMinPageHeight, 0));
    let maxW = Math.max(0, safeNumber(appliedMaxPageWidth, 0));
    let maxH = Math.max(0, safeNumber(appliedMaxPageHeight, 0));

    if (minW > 0 && maxW > 0 && maxW < minW) maxW = minW;
    if (minH > 0 && maxH > 0 && maxH < minH) maxH = minH;

    let width = oriented.width;
    let height = oriented.height;
    if (minW > 0) width = Math.max(width, minW);
    if (minH > 0) height = Math.max(height, minH);
    if (maxW > 0) width = Math.min(width, maxW);
    if (maxH > 0) height = Math.min(height, maxH);

    if (isMjFrameMode) {
      width = Math.min(width, a4.width);
      height = Math.min(height, a4.height);
    }

    return {
      width,
      height,
      label: isMjFrameMode ? a4.label : base.label,
    };
  }, [appliedMaxPageHeight, appliedMaxPageWidth, appliedMinPageHeight, appliedMinPageWidth, exportMode, formatKey, orientation]);

  const isMjFrameMode = exportMode === 'Sheet optimized (MJ) Fr.';
  const hasBrownFrame = exportMode === 'Normal (MJ) Frame' || exportMode === 'Sheet optimized (MJ) Fr.';

  const planned = useMemo(() => {
    const a4 = FORMATS.A4;
    const layoutOptions = isMjFrameMode
      ? {
          leftStripWidthMm: 9.5,
          disableLeftFrameSpacing: true,
          optimizeToContent: true,
          maxSheetWidthMm: a4.width,
          maxSheetHeightMm: a4.height,
        }
      : {};

    const safePageMarginMm = Math.max(0, safeNumber(pdfPageMargin, 0));
    const safeFrameSpacingMm = Math.max(0, safeNumber(frameSpacingMm, 0));

    const pageInsetMm = hasBrownFrame ? safePageMarginMm : safePageMarginMm + safeFrameSpacingMm;
    const frameInsetMm = hasBrownFrame ? safeFrameSpacingMm : 0;

    return planSheets(
      normalizedItems,
      { ...sheetSize, sortOrder: pdfSortOrder },
      effectiveSignSpacingMm,
      isMjFrameMode ? 0 : pageInsetMm,
      frameInsetMm,
      layoutOptions
    );
  }, [effectiveSignSpacingMm, frameSpacingMm, hasBrownFrame, isMjFrameMode, normalizedItems, pdfPageMargin, pdfSortOrder, sheetSize]);

  const sheetsWithIndex = useMemo(() => {
    const sheetCount = Array.isArray(planned?.sheets) ? planned.sheets.length : 0;
    return (planned?.sheets || []).map((s, idx) => ({
      ...s,
      globalSheetIndex: idx + 1,
      globalSheetCount: sheetCount,
    }));
  }, [planned]);

  const visibleSheets = useMemo(() => {
    if (selectedMaterialKey === 'all') return sheetsWithIndex;
    return (sheetsWithIndex || []).filter((sheet) => {
      const first = sheet?.placements?.[0] || null;
      if (!first) return false;
      return getMaterialKey(first) === selectedMaterialKey;
    });
  }, [selectedMaterialKey, sheetsWithIndex]);

  const totalRequestedCopies = useMemo(
    () => normalizedItems.reduce((acc, item) => acc + Math.max(1, item.copies || 0), 0),
    [normalizedItems]
  );

  const handleDownloadPdf = async () => {
    if (isExporting) return;
    if (!visibleSheets.length) {
      alert('Немає аркушів для експорту');
      return;
    }
    if (visibleSheets.length > 10) {
      alert(`Максимальна кількість аркушів для PDF — 10. Зараз: ${visibleSheets.length}.`);
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const sheetLabel = FORMATS[formatKey]?.label || 'sheet';

    const computeFrameRect = (sheet) => {
      if (!hasBrownFrame) return null;
      const placements = Array.isArray(sheet?.placements) ? sheet.placements : [];
      if (!placements.length) return null;

      const safeFrameSpacing = Math.max(0, safeNumber(frameSpacingMm, 0));
      const safePageMargin = Math.max(0, safeNumber(pdfPageMargin, 0));

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      placements.forEach((p) => {
        const x = safeNumber(p?.x, 0);
        const y = safeNumber(p?.y, 0);
        const w = Math.max(0, safeNumber(p?.width, 0));
        const h = Math.max(0, safeNumber(p?.height, 0));
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      });

      if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
        return null;
      }

      let x = minX - safeFrameSpacing;
      let y = minY - safeFrameSpacing;
      let width = maxX - minX + safeFrameSpacing * 2;
      let height = maxY - minY + safeFrameSpacing * 2;

      const stripWidthMm =
        exportMode === 'Sheet optimized (MJ) Fr.'
          ? Math.max(0, safeNumber(sheet?.leftStripWidthMm, 9.5))
          : 0;
      if (exportMode === 'Sheet optimized (MJ) Fr.') {
        const holeRadiusMm = 5.5 / 2;
        // Keep the SAME gap to the hole as it used to be on the right side.
        // old right-side gap = stripWidth - (holeCenter + holeRadius)
        const legacyHoleSideGapMm = Math.max(
          0,
          stripWidthMm - (stripWidthMm / 2 + holeRadiusMm)
        );
        x = Math.max(0, stripWidthMm / 2 - holeRadiusMm - legacyHoleSideGapMm);
        y = minY - safeFrameSpacing;
        width = maxX - x + safeFrameSpacing;
        height = maxY - minY + safeFrameSpacing * 2;
      }

      const leftLimit =
        exportMode === 'Sheet optimized (MJ) Fr.'
          ? 0
          : Math.max(safePageMargin, stripWidthMm);
      const topLimit = safePageMargin;
      const rightLimit = Math.max(leftLimit, safeNumber(sheet?.width, 0) - safePageMargin);
      const bottomLimit = Math.max(topLimit, safeNumber(sheet?.height, 0) - safePageMargin);

      x = Math.max(leftLimit, x);
      y = Math.max(topLimit, y);
      width = Math.max(0, Math.min(width, rightLimit - x));
      height = Math.max(0, Math.min(height, bottomLimit - y));

      if (width <= 0 || height <= 0) return null;
      return { x, y, width, height };
    };

    // Always use order.id as the project ID for sheet labels
    const resolvedProjectId = String(order?.id || '').trim() || null;

    // Group sheets by material key for per-group sheet numbering
    const groupKeyBySheet = (sheet) => {
      const first = sheet?.placements?.[0] || null;
      return first ? getMaterialKey(first) : 'unknown';
    };
    const groupSheets = {};
    visibleSheets.forEach((sheet) => {
      const key = groupKeyBySheet(sheet);
      if (!groupSheets[key]) groupSheets[key] = [];
      groupSheets[key].push(sheet);
    });

    // Map: sheetId -> {groupIndex, groupCount}
    const sheetGroupNumbers = {};
    Object.entries(groupSheets).forEach(([key, sheets]) => {
      sheets.forEach((sheet, idx) => {
        sheetGroupNumbers[sheet.index ?? sheet.globalSheetIndex ?? idx] = {
          groupIndex: idx + 1,
          groupCount: sheets.length,
        };
      });
    });

    const preparedSheets = visibleSheets.map((sheet, sheetIndex) => {
      const placements = (sheet.placements || []).map((placement) => {
        const previewData = buildPlacementPreview(placement, { enableGaps });
        return {
          id: placement.id,
          baseId: placement.baseId,
          name: placement.name,
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          copyIndex: placement.copyIndex ?? 1,
          copies: placement.copies ?? 1,
          svgMarkup: previewData?.type === 'svg' ? previewData.exportMarkup : null,
          sourceWidth: placement.sourceWidth || placement.width,
          sourceHeight: placement.sourceHeight || placement.height,
          customBorder: placement.customBorder || null,
          materialColor: placement.materialColor ?? null,
          materialThicknessMm: placement.materialThicknessMm ?? null,
          isAdhesiveTape: placement.isAdhesiveTape ?? false,
          themeStrokeColor: placement.themeStrokeColor ?? null,
        };
      });

      const frameRect = computeFrameRect(sheet);

      // For Normal and Normal (MJ) Frame: no sheetInfo at all
      let sheetInfo = null;
      if (exportMode !== 'Normal' && exportMode !== 'Normal (MJ) Frame') {
        // For all other modes: per-group numbering
        const groupNum = sheetGroupNumbers[sheet.index ?? sheet.globalSheetIndex ?? sheetIndex] || { groupIndex: sheetIndex + 1, groupCount: visibleSheets.length };
        const safePageMarginMm = Math.max(0, safeNumber(pdfPageMargin, 0));
        const safeFrameSpacingMm = Math.max(0, safeNumber(frameSpacingMm, 0));
        const stripWidthMm = Math.max(0, safeNumber(sheet?.leftStripWidthMm, 0));
        const placementsBounds = (() => {
          const list = Array.isArray(sheet?.placements) ? sheet.placements : [];
          if (!list.length) return null;
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          list.forEach((p) => {
            const x = safeNumber(p?.x, 0);
            const y = safeNumber(p?.y, 0);
            const w = Math.max(0, safeNumber(p?.width, 0));
            const h = Math.max(0, safeNumber(p?.height, 0));
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
          });
          if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
            return null;
          }
          return { minX, minY, maxX, maxY };
        })();
        const holeCentersY = (() => {
          const h = Math.max(0, safeNumber(sheet?.height, 0));
          if (h >= 135) return [h / 2 - 80 / 2, h / 2 + 80 / 2];
          return [h / 2];
        })();
        const sheetInfoPlacement = (() => {
          if (!pdfAddSheetInfo) return null;
          if (exportMode === 'Sheet optimized (MJ) Fr.') {
            if (stripWidthMm <= 0) return null;
            const centerYmm = holeCentersY.length
              ? holeCentersY.reduce((a, b) => a + b, 0) / holeCentersY.length
              : Math.max(0, safeNumber(sheet?.height, 0)) / 2;
            return {
              xCenterMm: stripWidthMm / 2,
              yCenterMm: centerYmm,
              areaWidthMm: stripWidthMm,
            };
          }
          if (safeFrameSpacingMm <= 0) return null;
          const contentLeftMm = (() => {
            if (placementsBounds && Number.isFinite(placementsBounds.minX)) return placementsBounds.minX;
            if (frameRect) return frameRect.x + safeFrameSpacingMm;
            return safePageMarginMm + safeFrameSpacingMm;
          })();
          const yCenterMm = (() => {
            if (frameRect) return frameRect.y + frameRect.height / 2;
            if (placementsBounds) return (placementsBounds.minY + placementsBounds.maxY) / 2;
            return Math.max(0, safeNumber(sheet?.height, 0)) / 2;
          })();
          return {
            xCenterMm: Math.max(
              safePageMarginMm + safeFrameSpacingMm / 2,
              contentLeftMm - safeFrameSpacingMm / 2
            ),
            yCenterMm,
            areaWidthMm: safeFrameSpacingMm,
          };
        })();
        if (sheetInfoPlacement) {
          if (exportMode === 'Sheet optimized (MJ) Fr.') {
            const projectId = resolvedProjectId;
            sheetInfo = {
              ...sheetInfoPlacement,
              projectId,
              sheetIndex: groupNum.groupIndex,
              sheetCount: groupNum.groupCount,
              customLabel: `${projectId} \u25CF ${groupNum.groupIndex}/${groupNum.groupCount}`,
            };
          } else {
            sheetInfo = {
              projectId: resolvedProjectId,
              sheetIndex: groupNum.groupIndex,
              sheetCount: groupNum.groupCount,
              ...sheetInfoPlacement,
            };
          }
        }
      }

      return {
        index: sheetIndex,
        width: sheet.width,
        height: sheet.height,
        frameRect,
        exportMode,
        leftStripWidthMm: sheet.leftStripWidthMm ?? 0,
        leftInset: sheet.leftInset ?? null,
        topInset: sheet.topInset ?? null,
        rightInset: sheet.rightInset ?? null,
        bottomInset: sheet.bottomInset ?? null,
        sheetInfo,
        placements,
      };
    });

    const exportEndpoint = import.meta.env.VITE_LAYOUT_EXPORT_URL || '/api/layout-pdf';

    setIsExporting(true);
    try {
      const response = await fetch(exportEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetLabel,
          timestamp,
          formatKey,
          exportMode,
          spacingMm: effectiveSignSpacingMm,
          sheets: preparedSheets,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `Export server error: ${response.status}`);
      }

      const pdfBlob = await response.blob();
      const materialSuffix = selectedMaterialKey === 'all' ? 'all' : 'material';
      const fileName = `order-${orderId}-${materialSuffix}-${timestamp}.pdf`;
      downloadBlob(pdfBlob, fileName);
    } catch (e) {
      console.error('PDF export failed', e);
      alert('Помилка експорту PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadGroupPdf = async (group, displayLabel) => {
    if (!group) return;
    // Use 'Normal' style and fall back to sensible defaults from state
    const localExportMode = 'Normal';
    const localFormatKey = formatKey || exportModePresets['Normal'].formatKey || 'MJ_295x600';
    const localOrientation = orientation || 'portrait';
    const localEnableGaps = typeof enableGaps === 'boolean' ? enableGaps : !!exportModePresets['Normal'].enableGaps;
    const localPageMargin = Math.max(0, safeNumber(pdfPageMargin, 0));
    const localFrameSpacing = Math.max(0, safeNumber(frameSpacingMm, 3));
    const localSignSpacing = Math.max(0, safeNumber(pdfSignSpacing, 5));

    // Filter normalized items for this material group
    const itemsForGroup = normalizedItems.filter((it) => getMaterialKey(it) === group.key);
    if (!itemsForGroup.length) {
      alert('No signs for this material');
      return;
    }

    // compute sheet size using Normal mode logic
    const base = FORMATS[localFormatKey] || FORMATS.A4;
    const oriented = localOrientation === 'landscape' ? { width: base.height, height: base.width } : { width: base.width, height: base.height };
    const sheet = { width: oriented.width, height: oriented.height, label: base.label };

    // plan sheets for this group's items
    const plannedGroup = planSheets(
      itemsForGroup,
      { ...sheet, sortOrder: pdfSortOrder },
      localSignSpacing,
      localPageMargin + localFrameSpacing,
      0,
      {}
    );

    const visible = (plannedGroup?.sheets || []).map((s, idx) => ({ ...s, globalSheetIndex: idx + 1, globalSheetCount: plannedGroup.sheets.length }));
    if (!visible.length) {
      alert('No sheets generated for this material');
      return;
    }
    if (visible.length > 10) {
      alert(`Максимальна кількість аркушів для PDF — 10. Зараз: ${visible.length}.`);
      return;
    }

    const resolvedProjectId = String(order?.id || '').trim() || null;

    const preparedSheets = visible.map((sheet, sheetIndex) => {
      const placements = (sheet.placements || []).map((placement) => {
        const previewData = buildPlacementPreview(placement, { enableGaps: localEnableGaps });
        return {
          id: placement.id,
          baseId: placement.baseId,
          name: placement.name,
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          copyIndex: placement.copyIndex ?? 1,
          copies: placement.copies ?? 1,
          svgMarkup: previewData?.type === 'svg' ? previewData.exportMarkup : null,
          sourceWidth: placement.sourceWidth || placement.width,
          sourceHeight: placement.sourceHeight || placement.height,
          customBorder: placement.customBorder || null,
          materialColor: placement.materialColor ?? null,
          materialThicknessMm: placement.materialThicknessMm ?? null,
          isAdhesiveTape: placement.isAdhesiveTape ?? false,
          themeStrokeColor: placement.themeStrokeColor ?? null,
        };
      });

      // reuse simple sheetInfo (non-MJ)
      const sheetInfo = {
        projectId: resolvedProjectId,
        sheetIndex: sheet.globalSheetIndex ?? sheetIndex + 1,
        sheetCount: sheet.globalSheetCount ?? visible.length,
        xCenterMm: Math.max(0, localPageMargin + localFrameSpacing / 2),
        yCenterMm: (sheet.height || 0) / 2,
        areaWidthMm: localFrameSpacing,
      };

      return {
        index: sheetIndex,
        width: sheet.width,
        height: sheet.height,
        frameRect: null,
        exportMode: localExportMode,
        leftStripWidthMm: 0,
        leftInset: sheet.leftInset ?? null,
        topInset: sheet.topInset ?? null,
        rightInset: sheet.rightInset ?? null,
        bottomInset: sheet.bottomInset ?? null,
        sheetInfo,
        placements,
      };
    });

    const exportEndpoint = import.meta.env.VITE_LAYOUT_EXPORT_URL || '/api/layout-pdf';
    setIsExporting(true);
    try {
      const response = await fetch(exportEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheetLabel: sheet.label || 'sheet',
          timestamp: new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19),
          formatKey: localFormatKey,
          exportMode: localExportMode,
          spacingMm: localSignSpacing,
          sheets: preparedSheets,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `Export server error: ${response.status}`);
      }

      const pdfBlob = await response.blob();
      // Use the visible label as filename when provided, but sanitize for filesystem
      const rawName = typeof displayLabel === 'string' && displayLabel.trim() ? displayLabel.trim() : `order-${orderId}-${group.key}`;
      const sanitize = (s) => s.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
      const sanitized = sanitize(rawName);
      const fileName = sanitized.endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;
      downloadBlob(pdfBlob, fileName);
    } catch (e) {
      console.error('PDF export failed', e);
      alert('Помилка експорту PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const setStatus = async(newStatus) => {
    try {
      const res=await $authHost.post('cart/setStatus', {orderId,newStatus});
      getOrder();
      update();
    }catch {
      alert("Помилка задання статусу");
    }
  }

  const openProject = async () => {
    // Project snapshot is stored under order.orderMongo.project (CartProject.project)
    const project = order?.orderMongo?.project || order?.project || order?.order || null;
    const orderedAccessories = (() => {
      const mongoAccessories = Array.isArray(order?.orderMongo?.accessories)
        ? order.orderMongo.accessories
        : [];
      if (mongoAccessories.length > 0) return mongoAccessories;
      try {
        const parsed = JSON.parse(order?.accessories || '[]');
        const sqlAccessories = Array.isArray(parsed) ? parsed : [];
        if (sqlAccessories.length > 0) return sqlAccessories;
      } catch {
        // no-op
      }
      return [];
    })();
    if (!project || typeof project !== 'object') {
      alert('No project snapshot in this order');
      return;
    }
    if (!project.id) {
      alert('Project snapshot has no id');
      return;
    }

    const projectToOpen = {
      ...project,
      accessories: Array.isArray(orderedAccessories) ? orderedAccessories : [],
    };

    setIsOpeningProject(true);
    try {
      try {
        await clearAllUnsavedSigns();
      } catch {}
      try {
        localStorage.removeItem('currentUnsavedSignId');
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('unsaved:signsUpdated'));
      } catch {}

      await putProject(projectToOpen);

      try {
        localStorage.setItem('pendingOpenedProjectAccessories', JSON.stringify(orderedAccessories));
      } catch {}
      try {
        sessionStorage.setItem('pendingOpenedProjectAccessories', JSON.stringify(orderedAccessories));
      } catch {}

      try {
        localStorage.setItem('currentProjectId', projectToOpen.id);
        localStorage.setItem('currentProjectName', projectToOpen.name || order?.projectName || '');
      } catch {}

      const first = Array.isArray(projectToOpen.canvases) ? projectToOpen.canvases[0] : null;
      if (first?.id) {
        try {
          localStorage.setItem('currentCanvasId', first.id);
          localStorage.setItem('currentProjectCanvasId', first.id);
          localStorage.setItem('currentProjectCanvasIndex', '0');
        } catch {}
        try {
          if (typeof window !== 'undefined') {
            window.__currentProjectCanvasId = first.id;
            window.__currentProjectCanvasIndex = 0;
          }
        } catch {}
      } else {
        try {
          localStorage.removeItem('currentCanvasId');
          localStorage.removeItem('currentProjectCanvasId');
          localStorage.removeItem('currentProjectCanvasIndex');
        } catch {}
        try {
          if (typeof window !== 'undefined') {
            window.__currentProjectCanvasId = null;
            window.__currentProjectCanvasIndex = null;
          }
        } catch {}
      }

      try {
        window.dispatchEvent(
          new CustomEvent('project:opened', {
            detail: { projectId: projectToOpen.id },
          })
        );
      } catch {}

      // Navigate to editor root
      try {
        const prefix = (location && location.pathname && String(location.pathname).match(/^\/([a-z]{2})(\/|$)/i)) ? `/${String(location.pathname).slice(1,3)}` : '';
        // Use window.location to navigate, as Admin may not have router here
        window.location.href = prefix || '/';
      } catch {}
    } catch (e) {
      console.error('Failed to open ordered project', e);
      alert(e?.message || 'Failed to open ordered project');
    } finally {
      setIsOpeningProject(false);
    }
  };

  const downloadFile = async (url, fileName) => {
    const res = await $authHost.get(url, { responseType: 'blob' });

    // Створюємо тимчасове посилання для скачування
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName;
    link.click();

    // Очищуємо пам'ять
    window.URL.revokeObjectURL(link.href);
  };

  const druk = async () => {
    try {
      // Скачуємо по черзі
      await downloadFile(`cart/getPdfs/${orderId}`, `Order-${orderId}.pdf`);
      await downloadFile(`cart/getPdfs2/${orderId}`, `DeliveryNote-${orderId}.pdf`);
      await downloadFile(`cart/getPdfs3/${orderId}`, `Invoice-${orderId}.pdf`);

      console.log('Усі файли завантажено');
    } catch (err) {
      console.error(err);
      alert('Помилка при завантаженні файлів');
    }
  };
  
  const emailOpen = () => {
    window.open(
      `mailto:${order.user.email}?subject=Order no №${order.id}`,
      "_blank"
    );
  };


  if(!order)return null;
  const manufacturerNote =
    String(order?.orderMongo?.manufacturerNote || order?.orderMongo?.project?.manufacturerNote || '').trim() || null;
  return (
    <>
    <div className="order-container">
      <div className="row">
        <p>Order.No</p>
        <span>{order.id} ({order.status})</span>
        <div onClick={druk} className="druk">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 9V2H18V9"
              stroke="#0088FF"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M6 18H4C3.46957 18 2.96086 17.7893 2.58579 17.4142C2.21071 17.0391 2 16.5304 2 16V11C2 10.4696 2.21071 9.96086 2.58579 9.58579C2.96086 9.21071 3.46957 9 4 9H20C20.5304 9 21.0391 9.21071 21.4142 9.58579C21.7893 9.96086 22 10.4696 22 11V16C22 16.5304 21.7893 17.0391 21.4142 17.4142C21.0391 17.7893 20.5304 18 20 18H18"
              stroke="#007AFF"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M18 14H6V22H18V14Z"
              stroke="#0088FF"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>
      <div className="row">
        <p>Order Name</p>
        <span>{order.orderName}</span>
        <div />
      </div>
      <div className="row">
        <p>Customer No</p>
        <span>{order.userId} ({order.user.orders.length}; {order.user.orders.reduce((acc,x)=>acc+=x.sum,0).toFixed(2)}) </span>
        <div />
      </div>
      <div className="row">
        <p>Order Type</p>
        <span>CSA Engraved Plastic</span>
        <div
          className="open"
          onClick={isOpeningProject ? undefined : openProject}
          style={{ cursor: isOpeningProject ? 'default' : 'pointer' }}
        >
          {isOpeningProject ? 'Opening...' : 'Open Project'}
        </div>
      </div>
      <div className="delivery">
        <button>Delivery Note</button>
      </div>
      <div className="buttons">
        <button className={order.status=='Printed'?'active':''} onClick={()=>setStatus('Printed')}>Printed</button>
        <button className={order.status=='Manufact'?'active':''} onClick={()=>setStatus('Manufact')}>Manufact</button>
        <button className={order.status=='Delivered'?'active':''} onClick={()=>setStatus('Delivered')}>Delivered</button>
        <button className={order.status=='Waiting'?'active':''} onClick={()=>setStatus('Waiting')}>Waiting</button>
        <button className={order.status=='Received'?'active':''} onClick={()=>setStatus('Received')}>Received</button>
        <button className={order.status=='Returned'?'active':''} onClick={()=>setStatus('Returned')}>Returned</button>
      </div>
      <div className="row">
        <p>Delivery Type</p>
        <span>{order.deliveryType}</span>
        <div />
      </div>
      <div className="row">
        <p>Order Sum</p>
        <span>{order.sum}</span>
        <div />
      </div>
      <div className="row">
        <p>Freight</p>
        <span>5.95</span>
        <div />
      </div>
      <div className="row">
        <p>Accessories:</p>
        <span className="mol">{JSON.parse(order.accessories).map(x=><>{x.qty} {x.name};{'   '}</>)}</span>
        <div />
      </div>
      <div className="row">
        <p>Count Sings:</p>
        <span>{totalRequestedCopies || order.signs}</span>
        <div />
      </div>
      <div className="row">
        <p>Invoice Tag:</p>
        <span>Invoice No: {order.id}</span>
        <div />
      </div>
      <div className="row">
        <p>Payment Method:</p>
        <span>Invoice</span>
        <div />
      </div>
      <div className="row box">
        <p>Delivery Address:</p>
        <div className="box">
          <div>{order.user.firstName} {order.user.surname}</div>
          <div>{order.user.company||''}</div>
          <div>{order.user.address||''}</div>
          <div>{order.user.address2||''}</div>
          <div>{order.user.address3||''}</div>
          <div>{order.user.city||''}</div>
          <div>{order.user.postcode||''}</div>
          <div>{(combinedCountries.find(x=>x.code===(order.country||order.user.country))||{}).label||order.country||order.user.country||''}</div>    
        </div>
      </div>
      <div className="row">
        <p>E-Mail:</p>
        <span>{order.user.email}</span>
        <div />
      </div>
      <div className="row">
        <p>Phone:</p>
        <span>{order.user.phone}</span>
        <div />
      </div>
      <div className="row">
        <p>Instruction:</p>
        <span>{order?.user?.additional || '---'}</span>
        <div />
      </div>
      <div className="row">
        <p>Massage to Production:</p>
        <span>{manufacturerNote || '---'}</span>
      </div>
      <div className="urls">
        {(materialGroups && materialGroups.length > 0) ? (
          materialGroups.map((group) => {
            const orderNumber = String(order?.id || orderId || '');
            const colorLabel = String(group.color || 'UNKNOWN');
            const thicknessNum = Number(group.thickness);
            const thicknessLabel = Number.isFinite(thicknessNum) && Math.abs(thicknessNum - 1.6) > 1e-6 ? ` ${thicknessNum}` : '';
            const tapePart = String(group.tape || '').trim();
            const hasTape = tapePart === 'tape';
            const tapeLabel = hasTape ? '' : ' NO TAPE';
            const fileLabel = `${orderNumber} ${String(colorLabel || '').toUpperCase()}${thicknessLabel}${tapeLabel}.pdf (${group.count} signs)`;

            const normalizedColor = String(colorLabel || '').trim().toLowerCase();

            const iconMap = {
              'white / black': A1,
              'white/black': A1,
              'white / blue': A2,
              'white/blue': A2,
              'white / red': A3,
              'white/red': A3,
              'black / white': A4,
              'black/white': A4,
              'blue / white': A5,
              'blue/white': A5,
              'red / white': A6,
              'red/white': A6,
              'green / white': A7,
              'green/white': A7,
              'yellow / black': A8,
              'yellow/black': A8,
              'gray / white': A9,
              'gray/white': A9,
              'grey / white': A9,
              'orange / white': A11,
              'orange/white': A11,
              'brown / white': A10,
              'brown/white': A10,
              'silver / black': A12,
              'silver/black': A12,
              'wood / black': A13,
              'wood/black': A13,
              'carbon / white': A14,
              'carbon/white': A14,
            };

            const IconComp = iconMap[normalizedColor] || null;

            return (
              <div className="url-cont" key={group.key}>
                <div
                  className="url"
                  onClick={() => handleDownloadGroupPdf(group, fileLabel)}
                  style={{ cursor: isExporting ? 'default' : 'pointer' }}
                >
                  {fileLabel}
                </div>
                <div className="img">{IconComp ? <IconComp /> : 'A'}</div>
              </div>
            );
          })
        ) : (
          <div className="url-cont">
            <div className="url">No materials</div>
            <div className="img">A</div>
          </div>
        )}
      </div>
      <div className="title">Make Customised PDF:</div>
      <div className="list-info">
        <div className="inf">
          <p>Material</p>
          <select
            style={{ width: '100%', color: '#000000' }}
            value={selectedMaterialKey}
            onChange={(e) => setSelectedMaterialKey(e.target.value)}
          >
            <option value="all">All materials ({totalRequestedCopies} signs)</option>
            {materialGroups.map((group) => (
              <option key={group.key} value={group.key}>
                {formatMaterialLabel(group)} ({group.count} signs)
              </option>
            ))}
          </select>
        </div>
        <div className="inf">
          <p>Mode</p>
          <select
            style={{ width: '172px', color: '#000000' }}
            value={exportMode}
            onChange={(e) => setExportMode(e.target.value)}
          >
            {exportModeOptions.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </div>
        <div className="info-ful">
          <p>Min page width</p>
          <input
            type="number"
            style={{ color: '#000000' }}
            value={pdfMinPageWidth}
            onChange={(e) => setPdfMinPageWidth(Number(e.target.value) || 0)}
          />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Min page height</p>
          <input
            type="number"
            style={{ color: '#000000' }}
            value={pdfMinPageHeight}
            onChange={(e) => setPdfMinPageHeight(Number(e.target.value) || 0)}
          />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Max page width</p>
          <input
            type="number"
            style={{ color: '#000000' }}
            value={pdfMaxPageWidth}
            onChange={(e) => setPdfMaxPageWidth(Number(e.target.value) || 0)}
          />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Max page height</p>
          <input
            type="number"
            style={{ color: '#000000' }}
            value={pdfMaxPageHeight}
            onChange={(e) => setPdfMaxPageHeight(Number(e.target.value) || 0)}
          />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Page margin</p>
          <input
            type="number"
            style={{ color: '#000000' }}
            value={pdfPageMargin}
            onChange={(e) => setPdfPageMargin(Number(e.target.value) || 0)}
            disabled={isMjFrameMode}
          />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Sign spacing</p>
          <input
            type="number"
            style={{ color: '#000000' }}
            value={pdfSignSpacing}
            onChange={(e) => setPdfSignSpacing(Number(e.target.value) || 0)}
          />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Frame spacing</p>
          <input
            type="number"
            style={{ color: '#000000' }}
            value={frameSpacingMm}
            onChange={(e) => setFrameSpacingMm(Number(e.target.value) || 0)}
          />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Max width on sheet</p>
          <input
            type="number"
            style={{ color: '#000000' }}
            defaultValue={0}
            //value={frameSpacingMm}
            //onChange={(e) => setFrameSpacingMm(Number(e.target.value) || 0)}
          />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Max height on sheet</p>
          <input
            type="number"
            style={{ color: '#000000' }}
            defaultValue={0}
            //value={frameSpacingMm}
            //onChange={(e) => setFrameSpacingMm(Number(e.target.value) || 0)}
          />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Sort order</p>
          <select
            style={{ color: '#000000' }}
            value={pdfSortOrder}
            onChange={(e) => setPdfSortOrder(e.target.value)}
          >
            <option value="high-first">High first</option>
            <option value="low-first">Low first</option>
          </select>
        </div>
        <div className="info-ful">
          <p>Add sheet info</p>
          <input type="checkbox" checked={pdfAddSheetInfo} onChange={(e) => setPdfAddSheetInfo(e.target.checked)} />
          <span>Only if sheets are used</span>
        </div>
      </div>
      <div className="but">
        <button onClick={handleDownloadPdf} disabled={isExporting || !visibleSheets.length}>
          {isExporting ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>
      <div className="but-message">
        <button onClick={emailOpen}>Message to customer</button>
      </div>
    </div>
    <br/>
    <br/>
    <div style={{display:'flex',alignItems:'flex-end',justifyContent:'right'}} className="right">
      <button style={{alignItems:'flex-end',marginBottom:"30px",justifyContent:'right',display:'flex',background:'#0095e2',color:'#ff2828ff', fontWeight:'550', padding:'0 5px'}} onClick={()=>setStatus('Deleted')}>Delete Cust. Account</button>
    </div>
    </>
  );
};

export default Order;
