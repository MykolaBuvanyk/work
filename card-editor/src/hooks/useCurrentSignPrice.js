import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useCanvasContext } from "../contexts/CanvasContext";
import { $host } from "../http";
import {
  getAllUnsavedSigns,
  getProject,
  extractToolbarState,
} from "../utils/projectStorage";

const PX_PER_MM = 72 / 25.4;

const pxToMm = (px) => (Number(px) || 0) / PX_PER_MM;

const mmToCm = (mm) => (Number(mm) || 0) / 10;

const normalizeMm = (mm) => {
  const n = safeNumber(mm);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Match UI expectations: most sizes are 0.1mm or whole-mm.
  // When px->mm conversion loses precision (e.g. 100mm stored as 283px => 99.83mm),
  // snap near-integers back to the intended value.
  const round1 = Math.round(n * 10) / 10;
  const nearestInt = Math.round(round1);
  if (Math.abs(round1 - nearestInt) < 0.25) return nearestInt;
  return round1;
};

const safeNumber = (v) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const normalized = String(v).trim().replace(",", ".");
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const resolveThicknessKey = (thicknessMm) => {
  const t = safeNumber(thicknessMm);
  if (Math.abs(t - 0.8) < 0.25) return "thinkness08";
  if (Math.abs(t - 3.2) < 0.25) return "thinkness32";
  return "thinkness16";
};

const isHoleObject = (obj) => {
  if (!obj) return false;
  if (obj.isCutElement && String(obj.cutType).toLowerCase() === "hole") return true;
  if (typeof obj.id === "string" && obj.id.startsWith("hole-")) return true;
  if (typeof obj.id === "string" && obj.id.startsWith("holes-")) return true;
  if (typeof obj.id === "string" && obj.id.includes("HOLE")) return true;
  if (typeof obj.name === "string" && obj.name.toLowerCase().includes("hole")) return true;
  if (obj.isHole === true) return true;
  return false;
};

const isBorderObject = (obj) => {
  if (!obj) return false;
  return Boolean(
    obj.isBorderShape ||
      obj.isBorderMask ||
      obj.isCanvasOutline ||
      obj.cardBorderMode ||
      obj.cardBorderThicknessPx
  );
};

const getObjectAreaCm2 = (obj) => {
  try {
    // Use raw width*scaleX to match JSON-based computation exactly (getScaledWidth
    // includes stroke in bbox and would diverge from the saved-entry path).
    const widthPx = safeNumber(obj.width) * (obj.scaleX === undefined ? 1 : safeNumber(obj.scaleX));
    const heightPx = safeNumber(obj.height) * (obj.scaleY === undefined ? 1 : safeNumber(obj.scaleY));

    const widthMm = pxToMm(widthPx);
    const heightMm = pxToMm(heightPx);

    const areaCm2 = mmToCm(widthMm) * mmToCm(heightMm);
    return Number.isFinite(areaCm2) && areaCm2 > 0 ? areaCm2 : 0;
  } catch {
    return 0;
  }
};

const getObjectRectMm = (obj) => {
  try {
    // Use raw width*scaleX to match JSON-based computation exactly.
    const widthPx = safeNumber(obj.width) * (obj.scaleX === undefined ? 1 : safeNumber(obj.scaleX));
    const heightPx = safeNumber(obj.height) * (obj.scaleY === undefined ? 1 : safeNumber(obj.scaleY));

    const widthMm = normalizeMm(pxToMm(widthPx));
    const heightMm = normalizeMm(pxToMm(heightPx));

    return {
      widthMm: Number.isFinite(widthMm) && widthMm > 0 ? widthMm : 0,
      heightMm: Number.isFinite(heightMm) && heightMm > 0 ? heightMm : 0,
    };
  } catch {
    return { widthMm: 0, heightMm: 0 };
  }
};

const getJsonObjectAreaCm2 = (obj) => {
  if (!obj) return 0;
  const widthPx = safeNumber(obj.width) * (obj.scaleX === undefined ? 1 : safeNumber(obj.scaleX));
  const heightPx =
    safeNumber(obj.height) * (obj.scaleY === undefined ? 1 : safeNumber(obj.scaleY));
  const areaCm2 = mmToCm(pxToMm(widthPx)) * mmToCm(pxToMm(heightPx));
  return Number.isFinite(areaCm2) && areaCm2 > 0 ? areaCm2 : 0;
};

const getJsonObjectRectMm = (obj) => {
  if (!obj) return { widthMm: 0, heightMm: 0 };
  const widthPx = safeNumber(obj.width) * (obj.scaleX === undefined ? 1 : safeNumber(obj.scaleX));
  const heightPx = safeNumber(obj.height) * (obj.scaleY === undefined ? 1 : safeNumber(obj.scaleY));
  const widthMm = normalizeMm(pxToMm(widthPx));
  const heightMm = normalizeMm(pxToMm(heightPx));
  return {
    widthMm: Number.isFinite(widthMm) && widthMm > 0 ? widthMm : 0,
    heightMm: Number.isFinite(heightMm) && heightMm > 0 ? heightMm : 0,
  };
};

const getEntryJson = (entry) => {
  return entry?.jsonTemplate || entry?.json || null;
};

// Round to 2 decimal places (cents), using EPSILON to handle floating-point drift
const round2 = (v) => Math.round((safeNumber(v) + Number.EPSILON) * 100) / 100;

const hasCustomBorderEnabled = (toolbarState, objects) => {
  // Prefer objects presence as source-of-truth; toolbarState can be stale during
  // fast resize/toggle sequences.
  if (Array.isArray(objects)) {
    return objects.some(
      (obj) =>
        obj &&
        (obj.isBorderShape || obj.cardBorderMode || obj.cardBorderThicknessPx) &&
        String(obj.cardBorderMode || "").toLowerCase() === "custom"
    );
  }
  return toolbarState?.hasBorder === true;
};

const computeBorderPrice = ({ widthMm, heightMm, hasBorder }) => {
  if (!hasBorder) return 0;
  const w = normalizeMm(safeNumber(widthMm));
  const h = normalizeMm(safeNumber(heightMm));
  if (!(w > 0) || !(h > 0)) return 0;

  // P is the canvas perimeter in millimeters.
  // Pricing rule: 0.2 + (P - 40) * 0.0056
  // Interpret as: base 0.2 up to P=40mm, then add per extra mm.
  // Example: 100x100 => P=400 => 0.2 + (400-40)*0.0056 = 2.216
  const pMm = 2 * (w + h);
  const extra = Math.max(0, pMm - 40);
  const price = 0.2 + extra * 0.0056;
  return Number.isFinite(price) && price > 0 ? price : 0;
};

const computeEntrySubtotal = (entry, formData) => {
  const json = getEntryJson(entry);
  const toolbarState = entry?.toolbarState || extractToolbarState(entry) || {};

  const widthMm =
    normalizeMm(safeNumber(toolbarState?.sizeValues?.width)) ||
    normalizeMm(pxToMm(safeNumber(entry?.width || json?.width))) ||
    120;
  const heightMm =
    normalizeMm(safeNumber(toolbarState?.sizeValues?.height)) ||
    normalizeMm(pxToMm(safeNumber(entry?.height || json?.height))) ||
    80;

  const thicknessKey = resolveThicknessKey(toolbarState?.thickness);
  const tapeIndex = toolbarState?.isAdhesiveTape ? 1 : 0;

  // Canvas/material coefficient (same source as before)
  const kMaterial =
    safeNumber(formData?.listThinkness?.[thicknessKey]?.materialArea?.[tapeIndex]) || 0;

  // Engraving coefficient comes from engravingArea
  const kEngraving =
    safeNumber(formData?.listThinkness?.[thicknessKey]?.engravingArea?.[tapeIndex]) || 0;

  // Canvas/base price formula
  const canvasPrice = round2(1.15 + widthMm * heightMm * 0.00115 * kMaterial);

  const objects = Array.isArray(json?.objects) ? json.objects : [];
  const hasBorder = hasCustomBorderEnabled(toolbarState, objects);
  const borderPrice = round2(computeBorderPrice({ widthMm, heightMm, hasBorder }));
  let engravingPrice = 0;
  for (const obj of objects) {
    if (!obj) continue;
    if (isBorderObject(obj)) continue;
    if (isHoleObject(obj)) continue;
    if (obj.excludeFromExport) continue;

    const { widthMm: objW, heightMm: objH } = getJsonObjectRectMm(obj);
    // Engraving formula per element (except holes), round each element contribution
    engravingPrice = round2(engravingPrice + round2((objW + objH) * 0.039 * kEngraving));
  }

  const subtotal = round2(canvasPrice + engravingPrice + borderPrice);
  return Number.isFinite(subtotal) ? subtotal : 0;
};

const getSelectedAccessoriesSnapshot = () => {
  try {
    const getter = typeof window !== "undefined" ? window.getSelectedAccessories : null;
    const list = typeof getter === "function" ? getter() : null;
    if (Array.isArray(list)) return list;
  } catch {
    // no-op
  }

  return [];
};

const resolveVatCountryCode = () => {
  // TODO: replace with real country resolver from user profile / delivery address.
  return "DE";
};

const resolveVatPercent = ({ formData, userType, countryCode }) => {
  const country = String(countryCode || "DE").trim().toUpperCase();
  const type = String(userType || "Consumer").trim();

  if (type === "Consumer") {
    return safeNumber(formData?.[`${country}_CONS`]);
  }

  if (type === "Business" || type === "Admin") {
    return safeNumber(formData?.[country]);
  }

  return safeNumber(formData?.[`${country}_CONS`]);
};

export const useCurrentSignPrice = () => {
  const { canvas } = useCanvasContext();
  const userType = useSelector((state) => state?.user?.user?.type || "Consumer");
  const [price, setPrice] = useState(0);
  const [netAfterDiscount, setNetAfterDiscount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [orderSubtotal, setOrderSubtotal] = useState(0);
  const [accessoriesPrice, setAccessoriesPrice] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [vatPercent, setVatPercent] = useState(0);
  const [vatAmount, setVatAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);
  const inFlightRef = useRef(false);

  const computeNow = useCallback(async () => {
    if (!canvas) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const toolbarState =
        typeof window !== "undefined" && typeof window.getCurrentToolbarState === "function"
          ? window.getCurrentToolbarState() || {}
          : {};

      // During some resize flows toolbar state can lag behind canvas dimensions.
      // Use canvas px dimensions as a fallback to keep price consistent.
      let widthMm = normalizeMm(safeNumber(toolbarState?.sizeValues?.width));
      let heightMm = normalizeMm(safeNumber(toolbarState?.sizeValues?.height));
      if (!(widthMm > 0)) widthMm = normalizeMm(pxToMm(safeNumber(canvas.getWidth?.())));
      if (!(heightMm > 0)) heightMm = normalizeMm(pxToMm(safeNumber(canvas.getHeight?.())));

      const thicknessKey = resolveThicknessKey(toolbarState?.thickness);
      const tapeIndex = toolbarState?.isAdhesiveTape ? 1 : 0;

      const { data: formData } = await $host.get("auth/getDate");

      // Canvas/material coefficient
      const kMaterial =
        safeNumber(formData?.listThinkness?.[thicknessKey]?.materialArea?.[tapeIndex]) || 0;

      // Engraving coefficient
      const kEngraving =
        safeNumber(formData?.listThinkness?.[thicknessKey]?.engravingArea?.[tapeIndex]) || 0;

      // Canvas/base price formula
      const basePrice = round2(1.15 + widthMm * heightMm * 0.00115 * kMaterial);

      const hasBorder = hasCustomBorderEnabled(toolbarState, canvas?.getObjects?.() || []);
      const borderPrice = round2(computeBorderPrice({ widthMm, heightMm, hasBorder }));

      const objects = (canvas.getObjects?.() || []).filter(Boolean);
      let elementsPrice = 0;
      for (const obj of objects) {
        if (!obj) continue;
        if (isBorderObject(obj)) continue;
        if (isHoleObject(obj)) continue;
        if (obj.excludeFromExport) continue;

        const { widthMm: objW, heightMm: objH } = getObjectRectMm(obj);
        // Engraving formula per element (except holes), round each element contribution
        elementsPrice = round2(elementsPrice + round2((objW + objH) * 0.039 * kEngraving));
      }

      const selectedAccessories = getSelectedAccessoriesSnapshot();
      let accessoriesPrice = 0;

      if (Array.isArray(formData?.listAccessories)) {
        for (const sel of selectedAccessories) {
          if (!sel || !sel.checked) continue;
          const qty = Math.max(0, Math.floor(safeNumber(sel.qty)));
          if (qty <= 0) continue;

          const name = String(sel.name || "");
          const match = formData.listAccessories.find((x) => String(x?.text) === name);
          const unitPrice = safeNumber(match?.number);
          accessoriesPrice = round2(accessoriesPrice + round2(qty * unitPrice));
        }
      }

      // Current sign: active canvas price shown in the per-canvas banner only
      const currentCanvasSubtotal = round2(basePrice + elementsPrice + borderPrice);
      const currentSignSubtotal = currentCanvasSubtotal;

      // Order subtotal: sum of all canvases (project + unsaved) + accessories once
      // Always computed from saved entry JSON so it never changes when switching canvases
      let orderCanvasesSubtotal = 0;
      let entriesCount = 0;
      let totalCopiesCount = 0;
      try {
        const unsaved = await getAllUnsavedSigns().catch(() => []);
        let projectCanvases = [];
        try {
          const projectId = localStorage.getItem("currentProjectId");
          if (projectId) {
            const project = await getProject(projectId).catch(() => null);
            projectCanvases = Array.isArray(project?.canvases) ? project.canvases : [];
          }
        } catch {
          projectCanvases = [];
        }

        const mergedEntries = [
          ...(Array.isArray(projectCanvases) ? projectCanvases : []),
          ...(Array.isArray(unsaved) ? unsaved : []),
        ];

        const seen = new Set();
        const entries = [];
        for (const entry of mergedEntries) {
          if (!entry) continue;
          const json = getEntryJson(entry);
          const stableId =
            entry?.id ||
            entry?._id ||
            entry?.canvasId ||
            entry?.localId ||
            entry?.tempId;
          const fallbackKey = [
            safeNumber(entry?.width || json?.width),
            safeNumber(entry?.height || json?.height),
            safeNumber(entry?.toolbarState?.thickness),
            String(entry?.toolbarState?.isAdhesiveTape === true),
            Array.isArray(json?.objects) ? json.objects.length : 0,
          ].join("|");
          const dedupeKey = String(stableId || fallbackKey);
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          entries.push(entry);
        }

        entriesCount = entries.length;
        for (const entry of entries) {
          if (!entry) continue;
          const copies = Math.max(
            1,
            Math.floor(safeNumber(entry?.copiesCount || entry?.toolbarState?.copiesCount || 1))
          );
          totalCopiesCount += copies;
          orderCanvasesSubtotal = round2(
            orderCanvasesSubtotal + round2(computeEntrySubtotal(entry, formData) * copies)
          );
        }
      } catch {
        // no-op
      }

      // Fallback: if nothing loaded yet, at least use current canvas
      if (!(orderCanvasesSubtotal > 0)) {
        orderCanvasesSubtotal = currentCanvasSubtotal;
      }

      const isSingleCanvasNoAccessories =
        entriesCount === 1 && totalCopiesCount === 1 && !(accessoriesPrice > 0);

      const orderSubtotal = orderCanvasesSubtotal;

      const rules = Array.isArray(formData?.discount) ? formData.discount : [];
      const pickDiscountPercent = (amount) => {
        if (!Array.isArray(rules) || rules.length === 0) return 0;

        const parseRange = (raw) => {
          const text = String(raw ?? "").trim();
          if (!text) return null;

          // Accept formats like "30 - 50", "30-50", "500 - 10000"
          const parts = text.split("-").map((p) => p.trim());
          if (parts.length === 1) {
            const single = safeNumber(parts[0]);
            return { min: single, max: single };
          }
          const min = safeNumber(parts[0]);
          const max = safeNumber(parts[1]);
          return { min, max: max > 0 ? max : 0 };
        };

        // Sort by min ascending for safety
        const normalized = rules
          .map((r) => {
            const range = parseRange(r?.price);
            if (!range) return null;
            return {
              min: range.min,
              max: range.max,
              percent: safeNumber(r?.discount),
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.min - b.min);

        for (let i = 0; i < normalized.length; i++) {
          const rule = normalized[i];
          const isLast = i === normalized.length - 1;
          const lowerOk = amount >= rule.min;
          const upperOk = isLast ? amount <= rule.max : amount < rule.max;
          if (lowerOk && upperOk) return rule.percent;
        }

        return 0;
      };

      const percent = pickDiscountPercent(orderSubtotal);
      const discAmount = round2(orderSubtotal * (percent / 100));
      const netAfterDiscount = round2(orderSubtotal - discAmount + accessoriesPrice);

      const vatCountryCode = resolveVatCountryCode();
      const vatP = resolveVatPercent({
        formData,
        userType,
        countryCode: vatCountryCode,
      });
      const vat = round2(netAfterDiscount * (vatP / 100));
      const totalInclVat = round2(netAfterDiscount + vat);
      console.log("All price components", {
        currentCanvasSubtotal,
        accessoriesPrice,
        entriesCount,
        totalCopiesCount,
        isSingleCanvasNoAccessories,
        orderSubtotal,
        percent,
        discAmount,
        netAfterDiscount,
        vatP,
        vat,
        totalInclVat
      });
      setPrice(Number.isFinite(currentSignSubtotal) ? currentSignSubtotal : 0);
      setNetAfterDiscount(Number.isFinite(netAfterDiscount) ? netAfterDiscount : 0);
      setDiscountPercent(Number.isFinite(percent) ? percent : 0);
      setDiscountAmount(Number.isFinite(discAmount) ? discAmount : 0);
      setOrderSubtotal(Number.isFinite(orderSubtotal) ? orderSubtotal : 0);
      setAccessoriesPrice(Number.isFinite(accessoriesPrice) ? accessoriesPrice : 0);
      setVatPercent(vatP);
      setVatAmount(Number.isFinite(vat) ? vat : 0);
      setTotalPrice(Number.isFinite(totalInclVat) ? totalInclVat : 0);
    } catch (e) {
      setError(e);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [canvas, userType]);

  const scheduleDebounced = useCallback(() => {
    if (!canvas) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      computeNow();
    }, 2000);
  }, [canvas, computeNow]);

  const computeImmediate = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    computeNow();
  }, [computeNow]);

  useEffect(() => {
    if (!canvas) return;

    const onAnyCanvasChange = () => scheduleDebounced();
    const onCanvasLoaded = () => computeImmediate();

    canvas.on?.("object:added", onAnyCanvasChange);
    canvas.on?.("object:removed", onAnyCanvasChange);
    canvas.on?.("object:modified", onAnyCanvasChange);
    canvas.on?.("text:changed", onAnyCanvasChange);
    canvas.on?.("object:scaling", onAnyCanvasChange);
    canvas.on?.("canvas:resized", onAnyCanvasChange);
    canvas.on?.("canvas:loaded", onCanvasLoaded);

    const onAccessoriesChanged = () => scheduleDebounced();
    const onToolbarChanged = () => scheduleDebounced();
    const onWindowCanvasLoaded = () => computeImmediate();

    window.addEventListener?.("accessories:changed", onAccessoriesChanged);
    window.addEventListener?.("toolbar:changed", onToolbarChanged);
    window.addEventListener?.("canvas:loaded", onWindowCanvasLoaded);

    // Initial compute once canvas exists
    computeImmediate();

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      canvas.off?.("object:added", onAnyCanvasChange);
      canvas.off?.("object:removed", onAnyCanvasChange);
      canvas.off?.("object:modified", onAnyCanvasChange);
      canvas.off?.("text:changed", onAnyCanvasChange);
      canvas.off?.("object:scaling", onAnyCanvasChange);
      canvas.off?.("canvas:resized", onAnyCanvasChange);
      canvas.off?.("canvas:loaded", onCanvasLoaded);

      window.removeEventListener?.("accessories:changed", onAccessoriesChanged);
      window.removeEventListener?.("toolbar:changed", onToolbarChanged);
      window.removeEventListener?.("canvas:loaded", onWindowCanvasLoaded);
    };
  }, [canvas, scheduleDebounced, computeImmediate]);

  return {
    price,
    netAfterDiscount,
    discountPercent,
    discountAmount,
    orderSubtotal,
    accessoriesPrice,
    totalPrice,
    vatPercent,
    vatAmount,
    isLoading,
    error,
    recompute: computeImmediate,
  };
};
