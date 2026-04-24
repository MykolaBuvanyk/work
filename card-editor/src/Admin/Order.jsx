import React, { useEffect, useMemo, useState } from 'react';
import './OrderContainer.scss';
import { $authHost } from '../http';
import {
  clearAllUnsavedSigns,
  putProject,
  collectFontFamiliesFromJson,
  ensureFontsLoaded,
} from '../utils/projectStorage';
import {
  FORMATS,
  buildPlacementPreview,
  formatMaterialLabel,
  generateSvgMarkupFromJsonTemplate,
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
const GIT_OPTIMIZED_SHEET_WIDTH_MM = 600;
const GIT_OPTIMIZED_SHEET_HEIGHT_MM = 300;
const GIT_OPTIMIZED_MAX_FRAME_WIDTH_MM = 188.5;
const GIT_OPTIMIZED_MAX_FRAME_HEIGHT_MM = 295;
const GIT_OPTIMIZED_FRAME_GAP_MM = 2;
const MJ_FRAME_DECOR_STRIP_WIDTH_MM = 9.5;

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

const buildSafePdfFileName = (rawName, fallback = 'download') => {
  const baseName =
    typeof rawName === 'string' && rawName.trim() ? rawName.trim() : String(fallback || 'download');

  const sanitized = baseName
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\.pdf\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/g, '');

  return `${sanitized || 'download'}.pdf`;
};

const buildDownloadPdfButtonLabel = ({
  orderId,
  selectedMaterialKey,
  materialGroups,
  exportMode,
  signCount,
}) => {
  const orderNumber = String(orderId || '').trim() || 'Order';
  const groups = Array.isArray(materialGroups) ? materialGroups : [];
  const resolvedMode = String(exportMode || 'Normal').trim() || 'Normal';
  const resolvedCount = Math.max(1, Number(signCount) || 1);

  if (selectedMaterialKey === 'all') {
    return `${orderNumber} ALL MATERIALS ${resolvedMode} (${resolvedCount} signs)`;
  }

  const group = groups.find((item) => item?.key === selectedMaterialKey) || null;
  if (!group) {
    return `${orderNumber} ${resolvedMode} (${resolvedCount} signs)`;
  }

  const colorLabel = normalizeMaterialColorLabel(group.color || 'UNKNOWN').toUpperCase();
  const thicknessNum = Number(group.thickness);
  const thicknessLabel =
    Number.isFinite(thicknessNum) && Math.abs(thicknessNum - 1.6) > 1e-6 ? ` ${thicknessNum}` : '';
  const tapePart = String(group.tape || '').trim();
  const tapeLabel = tapePart === 'tape' ? '' : ' NO TAPE';

  return `${orderNumber} ${colorLabel}${thicknessLabel}${tapeLabel} ${resolvedMode} (${resolvedCount} signs)`;
};

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeMaterialColorLabel = (value) =>
  String(value || '')
    .replace(/["'`“”‘’]/g, '')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();

const resolveDeliveryType = (order) =>
  String(order?.deliveryType || order?.orderMongo?.checkout?.deliveryLabel || '').trim();

const hasAddressLines = (address) => {
  if (!address || typeof address !== 'object') return false;
  return [
    address.fullName,
    address.companyName,
    address.address1,
    address.address2,
    address.address3,
    address.town,
    address.postalCode,
    address.country,
    address.region,
    address.email,
    address.mobile,
  ].some((value) => String(value || '').trim() !== '');
};

const resolveDeliveryPrice = (order) => {
  const rawPrice = Number(order?.orderMongo?.checkout?.deliveryPrice);
  if (Number.isFinite(rawPrice)) {
    return rawPrice.toFixed(2);
  }
  return '---';
};

const resolveInvoiceEmails = (order) =>
  String(order?.orderMongo?.checkout?.invoiceEmail || '').trim();

const resolveInvoiceAddressEmail = (order) =>
  String(
    order?.orderMongo?.checkout?.invoiceAddressEmail ||
      order?.orderMongo?.checkout?.invoiceAddress?.email ||
      order?.user?.eMailInvoice ||
      ''
  ).trim();

const resolveDeliveryComment = (order) =>
  String(order?.orderMongo?.checkout?.deliveryComment || '').trim();

const resolveVatId = (order) =>
  String(order?.orderMongo?.checkout?.vatNumber || order?.user?.vatNumber || '').trim();

const resolvePhoneConsent = (order) => {
  const checkout = order?.orderMongo?.checkout || {};
  return Boolean(
    checkout?.phoneOk ||
      checkout?.isPhoneOk ||
      checkout?.phoneConsent ||
      checkout?.phoneAllowed
  );
};

const resolveCountryLabel = (rawValue) => {
  const value = String(rawValue || '').trim();
  if (!value) return '';

  const normalizedCode = value.toUpperCase() === 'GB' ? 'UK' : value.toUpperCase();
  const byCode = combinedCountries.find((item) =>
    String(item?.code || '').toUpperCase() === normalizedCode
  );
  if (byCode?.label) return String(byCode.label);

  const byLabel = combinedCountries.find((item) =>
    String(item?.label || '').toLowerCase() === value.toLowerCase()
  );
  if (byLabel?.label) return String(byLabel.label);

  return value;
};

const parseLegacyAdditionalInformation = (rawValue) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return String(
        parsed.additionalInformation || parsed.additional || parsed.settings || ''
      ).trim();
    }
  } catch {
    // Legacy plain-string value.
  }

  return '';
};

const mapCartCanvasToDesign = (canvas, index) => {
  const c = canvas && typeof canvas === 'object' ? canvas : {};
  const jsonTemplate = c.jsonTemplate || c.json || c.canvas || c?.meta?.jsonTemplate || null;
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

  const toolbarState = { ...(c.toolbarState || c.toolbar || {}) };
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

const ensureOrderDesignFontsLoaded = async (designs = []) => {
  const fontFamilies = new Set();

  (Array.isArray(designs) ? designs : []).forEach((design) => {
    const jsonTemplate =
      design?.jsonTemplate || design?.json || design?.meta?.jsonTemplate || null;
    collectFontFamiliesFromJson(jsonTemplate).forEach((family) => {
      if (family) fontFamilies.add(family);
    });
  });

  if (!fontFamilies.size) return;

  await ensureFontsLoaded(Array.from(fontFamilies));
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {}
  }
};

const Order = ({orderId,update, onToggleUserOrdersFilter}) => {
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
  const [isInvoiceExpanded, setIsInvoiceExpanded] = useState(false);

  const invoiceEmails = useMemo(() => resolveInvoiceEmails(order), [order]);
  const invoiceAddressEmail = useMemo(() => resolveInvoiceAddressEmail(order), [order]);
  const deliveryComment = useMemo(() => resolveDeliveryComment(order), [order]);
  const vatId = useMemo(() => resolveVatId(order), [order]);
  const isPhoneConsentChecked = useMemo(() => resolvePhoneConsent(order), [order]);
  const instructionMessage = useMemo(
    () => String(order?.user?.additional || '').trim(),
    [order?.user?.additional]
  );
  const additionalInformationMessage = useMemo(
    () =>
      String(order?.user?.tellAbout || '').trim() ||
      parseLegacyAdditionalInformation(order?.user?.additional || ''),
    [order?.user?.additional, order?.user?.tellAbout]
  );
  const hasSeparateInvoiceAddress = useMemo(() => {
    const checkout = order?.orderMongo?.checkout || {};
    if (typeof checkout?.isInvoiceDifferent === 'boolean') {
      return checkout.isInvoiceDifferent;
    }
    return hasAddressLines(checkout?.invoiceAddress);
  }, [order]);

  const invoiceSectionData = useMemo(() => {
    if (!hasSeparateInvoiceAddress) {
      return {
        fullName: '',
        companyName: '',
        address1: '',
        address2: '',
        address3: '',
        town: '',
        postalCode: '',
        countryLabel: '',
        mobile: '',
      };
    }

    const checkoutInvoice = order?.orderMongo?.checkout?.invoiceAddress || {};
    const userInvoice = {
      fullName: [order?.user?.firstName2, order?.user?.surname2].filter(Boolean).join(' '),
      companyName: order?.user?.company2,
      address1: order?.user?.address4,
      address2: order?.user?.address5,
      address3: order?.user?.address6,
      town: order?.user?.city2,
      postalCode: order?.user?.postcode2,
      country: order?.user?.country2,
      region: order?.user?.state2,
      mobile: order?.user?.phone2,
    };

    const pick = (primary, fallback) => {
      const primaryValue = String(primary || '').trim();
      if (primaryValue) return primaryValue;
      return String(fallback || '').trim();
    };

    const countryRaw =
      pick(checkoutInvoice?.country, userInvoice?.country) ||
      pick(checkoutInvoice?.region, userInvoice?.region) ||
      '';

    return {
      fullName: pick(checkoutInvoice?.fullName, userInvoice?.fullName),
      companyName: pick(checkoutInvoice?.companyName, userInvoice?.companyName),
      address1: pick(checkoutInvoice?.address1, userInvoice?.address1),
      address2: pick(checkoutInvoice?.address2, userInvoice?.address2),
      address3: pick(checkoutInvoice?.address3, userInvoice?.address3),
      town: pick(checkoutInvoice?.town, userInvoice?.town),
      postalCode: pick(checkoutInvoice?.postalCode, userInvoice?.postalCode),
      countryLabel: resolveCountryLabel(countryRaw),
      mobile: pick(checkoutInvoice?.mobile, userInvoice?.mobile),
    };
  }, [hasSeparateInvoiceAddress, order]);

  const invoiceAddressLines = useMemo(() => {
    const lines = [
      invoiceSectionData.fullName,
      invoiceSectionData.companyName,
      invoiceSectionData.address1,
      invoiceSectionData.address2,
      invoiceSectionData.address3,
      invoiceSectionData.town,
      invoiceSectionData.postalCode,
      invoiceSectionData.countryLabel,
    ];

    return lines.filter((line) => String(line || '').trim() !== '');
  }, [invoiceSectionData]);

  const hasInvoiceSectionData = useMemo(() => {
    if (!hasSeparateInvoiceAddress) return false;
    if (String(invoiceEmails || '').trim() !== '') return true;
    if (String(invoiceAddressEmail || '').trim() !== '') return true;
    if (String(invoiceSectionData.mobile || '').trim() !== '') return true;
    return invoiceAddressLines.length > 0;
  }, [hasSeparateInvoiceAddress, invoiceAddressEmail, invoiceAddressLines.length, invoiceEmails, invoiceSectionData.mobile]);
  const [pdfAddSheetInfo, setPdfAddSheetInfo] = useState(true);

  const [appliedMinPageWidth, setAppliedMinPageWidth] = useState(0);
  const [appliedMinPageHeight, setAppliedMinPageHeight] = useState(0);
  const [appliedMaxPageWidth, setAppliedMaxPageWidth] = useState(0);
  const [appliedMaxPageHeight, setAppliedMaxPageHeight] = useState(0);

  const customerOrders = Array.isArray(order?.user?.orders) ? order.user.orders : [];
  const customerOrdersCount = customerOrders.length;
  const customerOrdersTotal = customerOrders.reduce((acc, item) => acc + (Number(item?.sum) || 0), 0);
  
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

  useEffect(() => {
    setIsInvoiceExpanded(false);
  }, [orderId]);

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

  const handleCustomerOrdersCountClick = (e) => {
    e.stopPropagation();
    if (typeof onToggleUserOrdersFilter === 'function') {
      onToggleUserOrdersFilter(order?.userId);
    }
  };

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
      ? { width: GIT_OPTIMIZED_SHEET_WIDTH_MM, height: GIT_OPTIMIZED_SHEET_HEIGHT_MM }
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
      width = GIT_OPTIMIZED_SHEET_WIDTH_MM;
      height = GIT_OPTIMIZED_SHEET_HEIGHT_MM;
    }

    return {
      width,
      height,
      label: isMjFrameMode ? '600x300 mm' : base.label,
    };
  }, [appliedMaxPageHeight, appliedMaxPageWidth, appliedMinPageHeight, appliedMinPageWidth, exportMode, formatKey, orientation]);

  const isMjFrameMode = exportMode === 'Sheet optimized (MJ) Fr.';
  const hasBrownFrame = exportMode === 'Normal (MJ) Frame' || exportMode === 'Sheet optimized (MJ) Fr.';

  const planned = useMemo(() => {
    if (isMjFrameMode) {
      const safeFrameSpacingMm = Math.max(0, safeNumber(frameSpacingMm, 0));
      const mjItems = normalizedItems.map((item) => ({
        ...item,
      }));

      const groups = new Map();
      mjItems.forEach((item) => {
        const key = getMaterialKey(item);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
      });

      const resultSheets = [];
      const resultLeftovers = [];

      groups.forEach((groupItems, materialKey) => {
        const maxContentFrameWidthMm = Math.max(
          0,
          GIT_OPTIMIZED_MAX_FRAME_WIDTH_MM - MJ_FRAME_DECOR_STRIP_WIDTH_MM
        );
        const framePlan = planSheets(
          groupItems,
          {
            width: maxContentFrameWidthMm,
            height: GIT_OPTIMIZED_MAX_FRAME_HEIGHT_MM,
            sortOrder: pdfSortOrder,
          },
          effectiveSignSpacingMm,
          0,
          safeFrameSpacingMm,
          {
            leftStripWidthMm: 0,
            disableLeftFrameSpacing: true,
            optimizeToContent: true,
            maxSheetWidthMm: maxContentFrameWidthMm,
            maxSheetHeightMm: GIT_OPTIMIZED_MAX_FRAME_HEIGHT_MM,
            maxPlacementWidthMm: maxContentFrameWidthMm,
            maxPlacementHeightMm: GIT_OPTIMIZED_MAX_FRAME_HEIGHT_MM,
          }
        );

        const frameSheets = Array.isArray(framePlan?.sheets) ? framePlan.sheets : [];
        const frameLeftovers = Array.isArray(framePlan?.leftovers) ? framePlan.leftovers : [];
        resultLeftovers.push(...frameLeftovers);
        if (!frameSheets.length) return;

        const frameItems = frameSheets.map((frameSheet, frameIndex) => {
          const frameId = `${materialKey}::frame-${frameIndex + 1}`;
          const frameWidth = Math.max(0, safeNumber(frameSheet?.width, 0));
          const frameHeight = Math.max(0, safeNumber(frameSheet?.height, 0));
          const decoratedWidth = frameWidth + MJ_FRAME_DECOR_STRIP_WIDTH_MM;
          return {
            id: frameId,
            name: frameId,
            widthMm: decoratedWidth,
            heightMm: frameHeight,
            area: decoratedWidth * frameHeight,
            copies: 1,
            sourceFrame: frameSheet,
            frameIndex: frameIndex + 1,
            frameCount: frameSheets.length,
            decorStripWidthMm: MJ_FRAME_DECOR_STRIP_WIDTH_MM,
            materialColor: groupItems?.[0]?.materialColor ?? null,
            materialThicknessMm: groupItems?.[0]?.materialThicknessMm ?? null,
            isAdhesiveTape: groupItems?.[0]?.isAdhesiveTape ?? false,
            themeStrokeColor: groupItems?.[0]?.themeStrokeColor ?? null,
          };
        });

        const packFramesIntoFixedSheets = (frames) => {
          const gap = GIT_OPTIMIZED_FRAME_GAP_MM;
          const sheetWidth = GIT_OPTIMIZED_SHEET_WIDTH_MM;
          const sheetHeight = GIT_OPTIMIZED_SHEET_HEIGHT_MM;
          const EPS = 0.001;

          const ordered = [...frames].sort((a, b) => {
            const areaA = Number(a?.area) || 0;
            const areaB = Number(b?.area) || 0;
            if (areaA === areaB) return String(a?.id || '').localeCompare(String(b?.id || ''));
            return pdfSortOrder === 'low-first' ? areaA - areaB : areaB - areaA;
          });

          const sheets = [];
          const leftovers = [];

          const intersects = (a, b) => (
            a.x < b.x + b.width - EPS &&
            a.x + a.width > b.x + EPS &&
            a.y < b.y + b.height - EPS &&
            a.y + a.height > b.y + EPS
          );

          const canPlaceAt = (sheet, candidate) => {
            if (candidate.x < 0 || candidate.y < 0) return false;
            if (candidate.x + candidate.width > sheetWidth + EPS) return false;
            if (candidate.y + candidate.height > sheetHeight + EPS) return false;

            for (const existing of sheet.frames) {
              const inflated = {
                x: existing.x - gap,
                y: existing.y - gap,
                width: existing.width + gap * 2,
                height: existing.height + gap * 2,
              };
              if (intersects(candidate, inflated)) return false;
            }
            return true;
          };

          const findTopLeftPosition = (sheet, width, height) => {
            const xs = new Set([0]);
            const ys = new Set([0]);

            sheet.frames.forEach((frame) => {
              xs.add(frame.x);
              xs.add(frame.x + frame.width + gap);
              ys.add(frame.y);
              ys.add(frame.y + frame.height + gap);
            });

            const xCandidates = Array.from(xs).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
            const yCandidates = Array.from(ys).filter((y) => Number.isFinite(y)).sort((a, b) => a - b);

            for (const y of yCandidates) {
              for (const x of xCandidates) {
                const candidate = { x, y, width, height };
                if (canPlaceAt(sheet, candidate)) return { x, y };
              }
            }
            return null;
          };

          ordered.forEach((frame) => {
            const width = Math.max(0, Number(frame?.widthMm) || 0);
            const height = Math.max(0, Number(frame?.heightMm) || 0);
            if (width <= 0 || height <= 0) {
              leftovers.push(frame);
              return;
            }
            if (width > sheetWidth + EPS || height > sheetHeight + EPS) {
              leftovers.push(frame);
              return;
            }

            let placed = false;

            for (const sheet of sheets) {
              const pos = findTopLeftPosition(sheet, width, height);
              if (!pos) continue;
              sheet.frames.push({
                ...frame,
                x: pos.x,
                y: pos.y,
                width,
                height,
              });
              placed = true;
              break;
            }

            if (!placed) {
              const newSheet = {
                width: sheetWidth,
                height: sheetHeight,
                frames: [],
              };
              const pos = findTopLeftPosition(newSheet, width, height);
              if (!pos) {
                leftovers.push(frame);
                return;
              }
              newSheet.frames.push({
                ...frame,
                x: pos.x,
                y: pos.y,
                width,
                height,
              });
              sheets.push(newSheet);
            }
          });

          return { sheets, leftovers };
        };

        const { sheets: packedSheets, leftovers: sheetLeftovers } = packFramesIntoFixedSheets(frameItems);
        resultLeftovers.push(...sheetLeftovers);

        packedSheets.forEach((packedSheet) => {
          const packedFramePlacements = Array.isArray(packedSheet?.frames) ? packedSheet.frames : [];
          const frameRects = [];
          const frameInfos = [];
          const mergedPlacements = [];

          packedFramePlacements.forEach((framePlacement) => {
            const sourceFrame = framePlacement?.sourceFrame;
            if (!sourceFrame) return;

            const decorStripWidth = Math.max(0, safeNumber(framePlacement?.decorStripWidthMm, MJ_FRAME_DECOR_STRIP_WIDTH_MM));
            const frameX = safeNumber(framePlacement?.x, 0);
            const frameY = safeNumber(framePlacement?.y, 0);
            const frameWidth = Math.max(0, safeNumber(framePlacement?.width, 0));
            const frameHeight = Math.max(0, safeNumber(framePlacement?.height, 0));
            if (frameWidth <= 0 || frameHeight <= 0) return;
            if (
              frameX + frameWidth > GIT_OPTIMIZED_SHEET_WIDTH_MM + 0.001 ||
              frameY + frameHeight > GIT_OPTIMIZED_SHEET_HEIGHT_MM + 0.001
            ) {
              return;
            }

            frameRects.push({
              x: frameX,
              y: frameY,
              width: frameWidth,
              height: frameHeight,
            });

            frameInfos.push({
              x: frameX,
              y: frameY,
              width: frameWidth,
              height: frameHeight,
              frameIndex: Number(framePlacement?.frameIndex) || 1,
              frameCount: Number(framePlacement?.frameCount) || packedFramePlacements.length,
              stripWidthMm: decorStripWidth,
            });

            const sourcePlacements = Array.isArray(sourceFrame?.placements) ? sourceFrame.placements : [];
            sourcePlacements.forEach((placement) => {
              mergedPlacements.push({
                ...placement,
                x: frameX + decorStripWidth + safeNumber(placement?.x, 0),
                y: frameY + safeNumber(placement?.y, 0),
              });
            });
          });

          resultSheets.push({
            ...packedSheet,
            width: GIT_OPTIMIZED_SHEET_WIDTH_MM,
            height: GIT_OPTIMIZED_SHEET_HEIGHT_MM,
            pageMarginMm: 0,
            frameSpacingMm: 0,
            leftInset: 0,
            topInset: 0,
            rightInset: 0,
            bottomInset: 0,
            leftStripWidthMm: 0,
            frameRect: null,
            frameRects,
            frameInfos,
            placements: mergedPlacements,
          });
        });
      });

      return {
        sheets: resultSheets,
        leftovers: resultLeftovers,
      };
    }

    const safePageMarginMm = Math.max(0, safeNumber(pdfPageMargin, 0));
    const safeFrameSpacingMm = Math.max(0, safeNumber(frameSpacingMm, 0));

    const pageInsetMm = hasBrownFrame ? safePageMarginMm : safePageMarginMm + safeFrameSpacingMm;
    const frameInsetMm = hasBrownFrame ? safeFrameSpacingMm : 0;

    return planSheets(
      normalizedItems,
      { ...sheetSize, sortOrder: pdfSortOrder },
      effectiveSignSpacingMm,
      pageInsetMm,
      frameInsetMm,
      {}
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

    setIsExporting(true);
    try {
      await ensureOrderDesignFontsLoaded(designs);

      const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      const sheetLabel = FORMATS[formatKey]?.label || 'sheet';

    const computeFrameRect = (sheet) => {
      if (!hasBrownFrame) return null;
      if (isMjFrameMode) return null;
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

    const restorePdfOnlyUseThemeColor = (svgMarkup) => {
      if (typeof svgMarkup !== 'string' || !svgMarkup.trim()) return null;

      return svgMarkup
        .replace(/\buseThemeColor="false"/gi, 'useThemeColor="true"')
        .replace(/\bdata-use-theme-color="false"/gi, 'data-use-theme-color="true"')
        .replace(/\bdata-useThemeColor="false"/gi, 'data-useThemeColor="true"');
    };

    const svgByBaseId = new Map();

    const resolvePlacementSvg = async (placement) => {
      const cacheKey = String(placement?.baseId || placement?.id || '');
      if (cacheKey && svgByBaseId.has(cacheKey)) {
        return svgByBaseId.get(cacheKey);
      }

      const persistedSvg =
        (typeof placement?.svg === 'string' && placement.svg.trim()) ||
        (typeof placement?.previewSvg === 'string' && placement.previewSvg.trim()) ||
        (typeof placement?.previewSVG === 'string' && placement.previewSVG.trim()) ||
        null;

      if (persistedSvg) {
        if (cacheKey) {
          svgByBaseId.set(cacheKey, persistedSvg);
        }
        return persistedSvg;
      }

      const generatedSvg = await generateSvgMarkupFromJsonTemplate(
        placement?.jsonTemplate,
        {
          fallbackWidthMm: placement?.sourceWidth || placement?.width || null,
          fallbackHeightMm: placement?.sourceHeight || placement?.height || null,
        }
      );

      const normalizedSvg =
        typeof generatedSvg === 'string' && generatedSvg.trim()
          ? generatedSvg
          : null;

      if (cacheKey) {
        svgByBaseId.set(cacheKey, normalizedSvg);
      }

      return normalizedSvg;
    };

    const preparedSheets = await Promise.all(visibleSheets.map(async (sheet, sheetIndex) => {
      const placements = await Promise.all((sheet.placements || []).map(async (placement) => {
        const resolvedSvg = await resolvePlacementSvg(placement);
        if (!resolvedSvg) {
          throw new Error(`SVG generation failed for placement: ${placement?.name || placement?.id || 'unknown'}`);
        }

        const previewData = buildPlacementPreview({ ...placement, svg: resolvedSvg }, { enableGaps });
        if (previewData?.type !== 'svg') {
          throw new Error(`PDF export requires SVG placement source: ${placement?.name || placement?.id || 'unknown'}`);
        }

        const rawSvgMarkup = previewData?.type === 'svg' ? previewData.exportMarkup : null;
        const pdfSvgMarkup = restorePdfOnlyUseThemeColor(rawSvgMarkup);
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
          svgMarkup: pdfSvgMarkup,
          previewType: previewData?.type || null,
          parsedSvgForPdf:
            previewData?.type === 'svg' &&
            typeof rawSvgMarkup === 'string' &&
            /\bid="(?:upload-preview-vector-|upload-preview-raster-)/i.test(rawSvgMarkup),
          previewImageUrl: previewData?.type === 'png' ? previewData.url : null,
          hasUploadedSvg:
            previewData?.type === 'svg' &&
            typeof rawSvgMarkup === 'string' &&
            /\bid="(?:upload-preview-vector-|upload-preview-raster-)/i.test(rawSvgMarkup),
          sourceWidth: placement.sourceWidth || placement.width,
          sourceHeight: placement.sourceHeight || placement.height,
          customBorder: placement.customBorder || null,
          materialColor: placement.materialColor ?? null,
          materialThicknessMm: isMjFrameMode ? null : (placement.materialThicknessMm ?? null),
          isAdhesiveTape: isMjFrameMode ? false : (placement.isAdhesiveTape ?? false),
          themeStrokeColor: placement.themeStrokeColor ?? null,
        };
      }));

      const frameRect = computeFrameRect(sheet);
      const frameRects = Array.isArray(sheet?.frameRects) ? sheet.frameRects : [];
      const frameInfos = Array.isArray(sheet?.frameInfos) ? sheet.frameInfos : [];
      const preparedFrameInfos = isMjFrameMode
        ? frameInfos.map((info) => {
            const index = Number(info?.frameIndex) || 1;
            const count = Number(info?.frameCount) || frameInfos.length || 1;
            const projectId = resolvedProjectId ? String(resolvedProjectId) : '';
            return {
              ...info,
              topLabel: projectId || '',
              bottomLabel: `Sh ${index}/${count}`,
            };
          })
        : frameInfos;

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
        frameRects,
        frameInfos: preparedFrameInfos,
        exportMode,
        disableMjStrip: isMjFrameMode,
        skipMaterialSplit: isMjFrameMode,
        leftStripWidthMm: sheet.leftStripWidthMm ?? 0,
        leftInset: sheet.leftInset ?? null,
        topInset: sheet.topInset ?? null,
        rightInset: sheet.rightInset ?? null,
        bottomInset: sheet.bottomInset ?? null,
        sheetInfo,
        placements,
      };
    }));

      const exportEndpoint = import.meta.env.VITE_LAYOUT_EXPORT_URL || '/api/layout-pdf';

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
      const visibleSignCount = visibleSheets.reduce(
        (acc, sheet) => acc + (Array.isArray(sheet?.placements) ? sheet.placements.length : 0),
        0
      );
      const rawFileName = buildDownloadPdfButtonLabel({
        orderId,
        selectedMaterialKey,
        materialGroups,
        exportMode,
        signCount: visibleSignCount,
      });
      const fileName = buildSafePdfFileName(rawFileName, `order-${orderId}-${timestamp}`);
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

    const resolvedProjectId = String(order?.id || '').trim() || null;

    const restorePdfOnlyUseThemeColor = (svgMarkup) => {
      if (typeof svgMarkup !== 'string' || !svgMarkup.trim()) return null;

      return svgMarkup
        .replace(/\buseThemeColor="false"/gi, 'useThemeColor="true"')
        .replace(/\bdata-use-theme-color="false"/gi, 'data-use-theme-color="true"')
        .replace(/\bdata-useThemeColor="false"/gi, 'data-useThemeColor="true"');
    };

    const svgByBaseId = new Map();

    const resolvePlacementSvg = async (placement) => {
      const cacheKey = String(placement?.baseId || placement?.id || '');
      if (cacheKey && svgByBaseId.has(cacheKey)) {
        return svgByBaseId.get(cacheKey);
      }

      const persistedSvg =
        (typeof placement?.svg === 'string' && placement.svg.trim()) ||
        (typeof placement?.previewSvg === 'string' && placement.previewSvg.trim()) ||
        (typeof placement?.previewSVG === 'string' && placement.previewSVG.trim()) ||
        null;

      if (persistedSvg) {
        if (cacheKey) {
          svgByBaseId.set(cacheKey, persistedSvg);
        }
        return persistedSvg;
      }

      const generatedSvg = await generateSvgMarkupFromJsonTemplate(
        placement?.jsonTemplate,
        {
          fallbackWidthMm: placement?.sourceWidth || placement?.width || null,
          fallbackHeightMm: placement?.sourceHeight || placement?.height || null,
        }
      );

      const normalizedSvg =
        typeof generatedSvg === 'string' && generatedSvg.trim()
          ? generatedSvg
          : null;

      if (cacheKey) {
        svgByBaseId.set(cacheKey, normalizedSvg);
      }

      return normalizedSvg;
    };

    const preparedSheets = await Promise.all(visible.map(async (sheet, sheetIndex) => {
      const placements = await Promise.all((sheet.placements || []).map(async (placement) => {
        const resolvedSvg = await resolvePlacementSvg(placement);
        if (!resolvedSvg) {
          throw new Error(`SVG generation failed for placement: ${placement?.name || placement?.id || 'unknown'}`);
        }

        const previewData = buildPlacementPreview(
          { ...placement, svg: resolvedSvg },
          { enableGaps: localEnableGaps }
        );
        if (previewData?.type !== 'svg') {
          throw new Error(`PDF export requires SVG placement source: ${placement?.name || placement?.id || 'unknown'}`);
        }

        const rawSvgMarkup = previewData?.type === 'svg' ? previewData.exportMarkup : null;
        const pdfSvgMarkup = restorePdfOnlyUseThemeColor(rawSvgMarkup);
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
          svgMarkup: pdfSvgMarkup,
          previewType: previewData?.type || null,
          parsedSvgForPdf:
            previewData?.type === 'svg' &&
            typeof rawSvgMarkup === 'string' &&
            /\bid="(?:upload-preview-vector-|upload-preview-raster-)/i.test(rawSvgMarkup),
          previewImageUrl: previewData?.type === 'png' ? previewData.url : null,
          hasUploadedSvg:
            previewData?.type === 'svg' &&
            typeof rawSvgMarkup === 'string' &&
            /\bid="(?:upload-preview-vector-|upload-preview-raster-)/i.test(rawSvgMarkup),
          sourceWidth: placement.sourceWidth || placement.width,
          sourceHeight: placement.sourceHeight || placement.height,
          customBorder: placement.customBorder || null,
          materialColor: placement.materialColor ?? null,
          materialThicknessMm: placement.materialThicknessMm ?? null,
          isAdhesiveTape: placement.isAdhesiveTape ?? false,
          themeStrokeColor: placement.themeStrokeColor ?? null,
        };
      }));

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
    }));

    const exportEndpoint = import.meta.env.VITE_LAYOUT_EXPORT_URL || '/api/layout-pdf';
    setIsExporting(true);
    try {
      await ensureOrderDesignFontsLoaded(designs);

      console.log('[PDF_DEBUG][Order] export payload summary', {
        exportEndpoint,
        sheetLabel: sheet.label || 'sheet',
        timestamp: new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19),
        formatKey: localFormatKey,
        exportMode: localExportMode,
        spacingMm: localSignSpacing,
        sheetsCount: preparedSheets.length,
        sheets: preparedSheets.map((preparedSheet, sheetIndex) => ({
          sheetIndex,
          id: preparedSheet?.id || null,
          name: preparedSheet?.name || null,
          width: preparedSheet?.width ?? null,
          height: preparedSheet?.height ?? null,
          placementsCount: Array.isArray(preparedSheet?.placements) ? preparedSheet.placements.length : 0,
          placements: Array.isArray(preparedSheet?.placements)
            ? preparedSheet.placements.map((placement, placementIndex) => ({
                placementIndex,
                id: placement?.id || null,
                baseId: placement?.baseId || null,
                previewType: placement?.previewType || null,
                svgMarkupLength: String(placement?.svgMarkup || '').length,
                previewImageUrlLength: String(placement?.previewImageUrl || '').length,
                hasUploadedSvg: placement?.hasUploadedSvg === true,
                parsedSvgForPdf: placement?.parsedSvgForPdf === true,
                sourceWidth: placement?.sourceWidth ?? null,
                sourceHeight: placement?.sourceHeight ?? null,
                customBorder: placement?.customBorder ? true : false,
                materialColor: placement?.materialColor ?? null,
                materialThicknessMm: placement?.materialThicknessMm ?? null,
                isAdhesiveTape: placement?.isAdhesiveTape === true,
                themeStrokeColor: placement?.themeStrokeColor ?? null,
              }))
            : [],
        })),
      });

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
      const fileName = buildSafePdfFileName(rawName, `order-${orderId}-${group.key}`);
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
        const targetUrl = prefix ? `${prefix}/online-sign-editor` : '/online-sign-editor';
        window.location.href = targetUrl;
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
    const subject = encodeURIComponent(`Order no №${order.id}`);

    window.location.href = `mailto:${order.user.email}?subject=${subject}`;
  };


  if(!order)return null;
  const manufacturerNote =
    String(order?.orderMongo?.manufacturerNote || order?.orderMongo?.project?.manufacturerNote || '').trim() || null;
  const deliveryTypeLabel = resolveDeliveryType(order);
  const deliveryPriceLabel = resolveDeliveryPrice(order);
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
        <span>
          {order.userId} (
          <button type="button" className="order-count-link" onClick={handleCustomerOrdersCountClick}>
            {customerOrdersCount}
          </button>
          ; {customerOrdersTotal.toFixed(2)})
        </span>
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
        <button className={order.status=='Shipped'?'active':''} onClick={()=>setStatus('Shipped')}>Shipped</button>
        <button className={order.status=='Returned'?'active':''} onClick={()=>setStatus('Returned')}>Returned</button>
        <button className={order.status=='Delivered'?'active':''} onClick={()=>setStatus('Delivered')}>Delivered</button>
        <button className={order.status=='Waiting'?'active':''} onClick={()=>setStatus('Waiting')}>Waiting</button>
        {//<button className={order.status=='Received'?'active':''} onClick={()=>setStatus('Received')}>Received</button>
        }</div>
      <div className="row">
        <p>Delivery Type</p>
        <span>{deliveryTypeLabel || '---'}</span>
        <div />
      </div>
      <div className="row">
        <p>Order Sum</p>
        <span>{order.netAfterDiscount}</span>
        <div />
      </div>
      <div className="row">
        <p>Freight</p>
        <span>{deliveryPriceLabel}</span>
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
      {hasSeparateInvoiceAddress && (
      <div className="row invoice-row">
        <div className="invoice-section">
          <button
            type="button"
            className="invoice-section__toggle"
            onClick={() => setIsInvoiceExpanded((prev) => !prev)}
          >
            <span
              className={`invoice-section__indicator ${
                hasInvoiceSectionData ? 'invoice-section__indicator--has-data' : 'invoice-section__indicator--empty'
              }`}
              aria-hidden="true"
            />
            <span className="invoice-section__toggle-label">Invoice Address:</span>
          </button>

          {isInvoiceExpanded && (
            <div className="invoice-section__content">
              {invoiceAddressLines.length > 0 ? (
                <>
                  <div className="invoice-section__field-row" key={`${invoiceAddressLines[0]}-0`}>
                    <span className="invoice-section__field-label">Invoice Address:</span>
                    <span className="invoice-section__field-value">{invoiceAddressLines[0]}</span>
                  </div>

                  {invoiceAddressLines.slice(1).map((line, idx) => (
                    <div className="invoice-section__field-row" key={`${line}-${idx + 1}`}>
                      <span
                        className='invoice-section__field-label invoice-section__field-label--empty'
                        aria-hidden='true'
                      >
                        Invoice Address:
                      </span>
                      <span className="invoice-section__field-value">{line}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="invoice-section__field-row">
                  <span className='invoice-section__field-label'>Invoice Address:</span>
                  <span className="invoice-section__field-value">---</span>
                </div>
              )}
              <div className="invoice-section__field-row">
                <span className="invoice-section__field-label">Invoice E-Mail address:</span>
                <span className="invoice-section__field-value">{invoiceAddressEmail || '---'}</span>
              </div>
              <div className="invoice-section__field-row">
                <span className="invoice-section__field-label">Mobile Phone:</span>
                <span className="invoice-section__field-value">{invoiceSectionData.mobile || '---'}</span>
              </div>
              <div className="invoice-section__field-row">
                <span className="invoice-section__field-label">Invoice emails:</span>
                <span className="invoice-section__field-value">{invoiceEmails || '---'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      <div className="row">
        <p>E-Mail:</p>
        <span>{order.user.email}</span>
        <div />
      </div>
      <div className="row">
        <p className="order-phone-label">
          Phone:
          {isPhoneConsentChecked && (
            <span
              className="order-phone-indicator"
              aria-label="Phone can be used for questions"
              title="Phone can be used for questions"
            />
          )}
        </p>
        <span>{order.user.phone}</span>
        <div />
      </div>
      <div className="row">
        <p>VAT ID:</p>
        <span>{vatId || '---'}</span>
        <div />
      </div>
      <div className="row">
        <p>Instruction:</p>
        <span>{instructionMessage || '---'}</span>
        <div />
      </div>
      <div className="row">
        <p>Delivery comment:</p>
        <span>{deliveryComment || '---'}</span>
        <div />
      </div>
      <div className="row">
        <p>Message to Production:</p>
        <span>{manufacturerNote || '---'}</span>
        <div />
      </div>
      <div className="urls">
        {(materialGroups && materialGroups.length > 0) ? (
          materialGroups.map((group) => {
            const orderNumber = String(order?.id || orderId || '');
            const colorLabel = normalizeMaterialColorLabel(group.color || 'UNKNOWN');
            const thicknessNum = Number(group.thickness);
            const thicknessLabel = Number.isFinite(thicknessNum) && Math.abs(thicknessNum - 1.6) > 1e-6 ? ` ${thicknessNum}` : '';
            const tapePart = String(group.tape || '').trim();
            const hasTape = tapePart === 'tape';
            const tapeLabel = hasTape ? '' : ' NO TAPE';
            const fileLabel = `${orderNumber} ${String(colorLabel || '').toUpperCase()}${thicknessLabel}${tapeLabel}.pdf (${group.count} signs)`;

            const normalizedColor = normalizeMaterialColorLabel(colorLabel).toLowerCase();

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
              'gray / white': A12,
              'gray/white': A12,
              'grey / white': A12,
              'orange / white': A11,
              'orange/white': A11,
              'brown / white': A10,
              'brown/white': A10,
              'silver / black': A9,
              'silver/black': A9,
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
        <a href={`mailto:${order.user.email}`}>
          <button>Message to customer</button>
        </a>
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
