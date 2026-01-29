import { useCallback, useEffect, useRef, useState } from "react";
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
    const widthPx =
      typeof obj.getScaledWidth === "function"
        ? obj.getScaledWidth()
        : safeNumber(obj.width) * (obj.scaleX === undefined ? 1 : safeNumber(obj.scaleX));

    const heightPx =
      typeof obj.getScaledHeight === "function"
        ? obj.getScaledHeight()
        : safeNumber(obj.height) * (obj.scaleY === undefined ? 1 : safeNumber(obj.scaleY));

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
    const widthPx =
      typeof obj.getScaledWidth === "function"
        ? obj.getScaledWidth()
        : safeNumber(obj.width) * (obj.scaleX === undefined ? 1 : safeNumber(obj.scaleX));

    const heightPx =
      typeof obj.getScaledHeight === "function"
        ? obj.getScaledHeight()
        : safeNumber(obj.height) * (obj.scaleY === undefined ? 1 : safeNumber(obj.scaleY));

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

const computeEntrySubtotal = (entry, formData) => {
  const json = getEntryJson(entry);
  const toolbarState = entry?.toolbarState || extractToolbarState(entry) || {};

  const widthMm =
    safeNumber(toolbarState?.sizeValues?.width) ||
    pxToMm(safeNumber(entry?.width || json?.width)) ||
    120;
  const heightMm =
    safeNumber(toolbarState?.sizeValues?.height) ||
    pxToMm(safeNumber(entry?.height || json?.height)) ||
    80;

  const thicknessKey = resolveThicknessKey(toolbarState?.thickness);
  const tapeIndex = toolbarState?.isAdhesiveTape ? 1 : 0;

  // k comes from Admin "price" block based on thickness + tape
  const k = safeNumber(formData?.listThinkness?.[thicknessKey]?.materialArea?.[tapeIndex]) || 0;

  const objects = Array.isArray(json?.objects) ? json.objects : [];
  let elementsPrice = 0;
  for (const obj of objects) {
    if (!obj) continue;
    if (isHoleObject(obj)) continue;
    if (obj.excludeFromExport) continue;

    const { widthMm: objW, heightMm: objH } = getJsonObjectRectMm(obj);
    // New formula per element (except holes)
    elementsPrice += 1.15 + objW * objH * 0.00115 * k;
  }

  const subtotal = elementsPrice;
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

export const useCurrentSignPrice = () => {
  const { canvas } = useCanvasContext();
  const [price, setPrice] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [vatPercent, setVatPercent] = useState(19);
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

      const widthMm = safeNumber(toolbarState?.sizeValues?.width);
      const heightMm = safeNumber(toolbarState?.sizeValues?.height);

      const thicknessKey = resolveThicknessKey(toolbarState?.thickness);
      const tapeIndex = toolbarState?.isAdhesiveTape ? 1 : 0;

      const { data: formData } = await $host.get("auth/getDate");

      // k comes from Admin "price" block based on thickness + tape
      const k = safeNumber(formData?.listThinkness?.[thicknessKey]?.materialArea?.[tapeIndex]) || 0;

      const objects = (canvas.getObjects?.() || []).filter(Boolean);
      let elementsPrice = 0;
      for (const obj of objects) {
        if (!obj) continue;
        if (isHoleObject(obj)) continue;
        if (obj.excludeFromExport) continue;

        const { widthMm: objW, heightMm: objH } = getObjectRectMm(obj);
        // New formula per element (except holes)
        elementsPrice += 1.15 + objW * objH * 0.00115 * k;
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
          accessoriesPrice += qty * unitPrice;
        }
      }

      // Current sign: active canvas + accessories (as requested earlier)
      const currentCanvasSubtotal = elementsPrice;
      const currentSignSubtotal = currentCanvasSubtotal + accessoriesPrice;

      // Order subtotal: sum of all canvases (project + unsaved) + accessories once
      let orderCanvasesSubtotal = 0;
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

        const entries = [...(Array.isArray(projectCanvases) ? projectCanvases : []), ...(Array.isArray(unsaved) ? unsaved : [])];
        for (const entry of entries) {
          if (!entry) continue;
          const copies = Math.max(1, Math.floor(safeNumber(entry?.copiesCount || entry?.toolbarState?.copiesCount || 1)));
          orderCanvasesSubtotal += computeEntrySubtotal(entry, formData) * copies;
        }
      } catch {
        // no-op
      }

      // Fallback: if nothing loaded yet, at least use current canvas
      if (!(orderCanvasesSubtotal > 0)) {
        orderCanvasesSubtotal = currentCanvasSubtotal;
      }

      const orderSubtotal = orderCanvasesSubtotal + accessoriesPrice;

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
      const discAmount = orderSubtotal * (percent / 100);
      const netAfterDiscount = orderSubtotal - discAmount;

      // VAT: for now always 19% (ignore selected country)
      const vatP = 19;
      const vat = netAfterDiscount * (vatP / 100);
      const totalInclVat = netAfterDiscount + vat;

      setPrice(Number.isFinite(currentSignSubtotal) ? currentSignSubtotal : 0);
      setDiscountPercent(Number.isFinite(percent) ? percent : 0);
      setDiscountAmount(Number.isFinite(discAmount) ? discAmount : 0);
      setVatPercent(vatP);
      setVatAmount(Number.isFinite(vat) ? vat : 0);
      setTotalPrice(Number.isFinite(totalInclVat) ? totalInclVat : 0);
    } catch (e) {
      setError(e);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [canvas]);

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
    discountPercent,
    discountAmount,
    totalPrice,
    vatPercent,
    vatAmount,
    isLoading,
    error,
    recompute: computeImmediate,
  };
};
