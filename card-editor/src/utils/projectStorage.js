import { 
  decorateQrGroup, 
  removeBlackBackgroundRects,
  buildQrSvgMarkup,
  computeQrVectorData,
  QR_DISPLAY_LAYER_ID,
  QR_EXPORT_LAYER_ID,
  DEFAULT_QR_CELL_SIZE
} from "./qrFabricUtils";
// import { decorateQrGroup } from "./qrFabricUtils";
import { CUSTOM_FONT_FILES } from "../constants/fonts";
import qrGenerator from "qrcode-generator";

// Lightweight IndexedDB storage for projects and their canvases (JSON + preview)
// Store: projects (keyPath: id)

const DB_NAME = "card-editor";
const DB_VERSION = 2; // bumped to add unsavedSigns store
const STORE = "projects";
const UNSAVED_STORE = "unsavedSigns"; // temporary signs not yet attached to a project

const DEFAULT_GLOBAL_COLORS = {
  textColor: "#000000",
  backgroundColor: "#FFFFFF",
  strokeColor: "#000000",
  fillColor: "transparent",
  backgroundType: "solid",
};

const DEFAULT_SIGN_SIZE_MM = {
  width: 120,
  height: 80,
};

const CUSTOM_BORDER_EXPORT_COLOR = "#008181";
const CUSTOM_BORDER_EXPORT_FILL = "none";

const FONT_PUBLIC_PATH = "/fonts";
const FONT_EXT_FORMAT_MAP = {
  ttf: { mime: "font/ttf", format: "truetype" },
  otf: { mime: "font/otf", format: "opentype" },
  woff: { mime: "font/woff", format: "woff" },
  woff2: { mime: "font/woff2", format: "woff2" },
};

const normalizeFontName = (name) =>
  (name || "").trim().toLowerCase().replace(/"/g, "");

const FONT_NAME_MAP = new Map();
CUSTOM_FONT_FILES.forEach((font) => {
  if (!font?.name || !font?.file) return;
  FONT_NAME_MAP.set(normalizeFontName(font.name), font.file);
});

const FONT_DATA_URI_CACHE = new Map();

const TEXT_OBJECT_TYPES = new Set(["i-text", "text", "textbox"]);

const base64Encode = (binary) => {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(binary);
  }
  if (typeof btoa === "function") {
    return btoa(binary);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(binary, "binary").toString("base64");
  }
  return "";
};

const arrayBufferToBase64 = (buffer) => {
  if (!buffer) return "";
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64Encode(binary);
};

const getFontFileByName = (fontName = "") => {
  const normalized = normalizeFontName(fontName.split(",")[0]);
  return FONT_NAME_MAP.get(normalized) || null;
};

// Runtime fonts loader for the canvas (ensures correct font on initial render)
export async function ensureFontsLoaded(fontFamilies = []) {
  if (!Array.isArray(fontFamilies) || fontFamilies.length === 0) return true;
  const hasDocumentFonts =
    typeof document !== "undefined" &&
    document.fonts &&
    typeof document.fonts.load === "function";
  const canUseFontFace = typeof FontFace !== "undefined";

  const loadOne = async (family) => {
    try {
      if (!family || typeof family !== "string") return true;
      const plain = family
        .split(",")[0]
        .trim()
        .replace(/^['"]|['"]$/g, "");

      if (hasDocumentFonts) {
        try {
          // If already available, skip
          if (
            document.fonts.check(`12px ${plain}`) ||
            document.fonts.check(`12px "${plain}"`)
          ) {
            return true;
          }
        } catch {}
      }

      const fontFile = getFontFileByName(plain);
      if (canUseFontFace && fontFile) {
        const srcUrl = `${FONT_PUBLIC_PATH}/${fontFile}`;
        try {
          const ff = new FontFace(plain, `url(${srcUrl})`);
          const loaded = await ff.load();
          if (hasDocumentFonts) {
            try {
              document.fonts.add(loaded);
            } catch {}
          }
        } catch (e) {
          // Fallback to document.fonts.load even if FontFace failed
          if (hasDocumentFonts) {
            try {
              await document.fonts.load(`12px ${plain}`);
            } catch {}
          }
        }
      } else if (hasDocumentFonts) {
        // No mapping or FontFace not available; try generic load
        try {
          await document.fonts.load(`12px ${plain}`);
        } catch {}
      }
    } catch {}
    return true;
  };

  try {
    await Promise.all(fontFamilies.map(loadOne));
  } catch {}
  return true;
}

export async function loadCanvasFontsAndRerender(canvas) {
  if (!canvas || typeof canvas.getObjects !== "function") return false;
  try {
    const families = collectFontFamiliesFromCanvas(canvas);
    await ensureFontsLoaded(families);
    try {
      canvas.getObjects().forEach((obj) => {
        if (!obj || !TEXT_OBJECT_TYPES.has(obj.type)) return;
        try {
          // Reapply font to trigger Fabric's metrics recalculation
          if (obj.fontFamily) obj.set({ fontFamily: obj.fontFamily });
          if (typeof obj.initDimensions === "function") obj.initDimensions();
          if (typeof obj.setCoords === "function") obj.setCoords();
          obj.dirty = true;
        } catch {}
      });
    } catch {}
    try {
      canvas.renderAll?.();
      canvas.requestRenderAll?.();
    } catch {}
    return true;
  } catch (e) {
    console.warn("Failed to load canvas fonts and rerender", e);
    return false;
  }
}

// Explicitly reapply all text styling properties after load to avoid Arial fallback until first click
export function reapplyTextAttributes(canvas) {
  if (!canvas || typeof canvas.getObjects !== "function") return false;
  try {
    canvas.getObjects().forEach((obj) => {
      if (!obj || !TEXT_OBJECT_TYPES.has(obj.type)) return;
      try {
        const nextProps = {};
        if (obj.fontFamily) nextProps.fontFamily = obj.fontFamily;
        if (obj.fontSize) nextProps.fontSize = obj.fontSize;
        if (obj.fontWeight) nextProps.fontWeight = obj.fontWeight;
        if (obj.fontStyle) nextProps.fontStyle = obj.fontStyle;
        if (typeof obj.underline !== "undefined")
          nextProps.underline = obj.underline;
        if (typeof obj.linethrough !== "undefined")
          nextProps.linethrough = obj.linethrough;
        if (obj.textAlign) nextProps.textAlign = obj.textAlign;
        if (typeof obj.charSpacing === "number")
          nextProps.charSpacing = obj.charSpacing;
        if (typeof obj.lineHeight === "number")
          nextProps.lineHeight = obj.lineHeight;
        if (obj.fill) nextProps.fill = obj.fill;

        if (Object.keys(nextProps).length) obj.set(nextProps);
        if (typeof obj.initDimensions === "function") obj.initDimensions();
        if (typeof obj.setCoords === "function") obj.setCoords();
        obj.dirty = true;
      } catch {}
    });
    try {
      canvas.renderAll?.();
      canvas.requestRenderAll?.();
    } catch {}
    return true;
  } catch {
    return false;
  }
}

const detectFontFormatMeta = (fileName = "") => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "ttf";
  return FONT_EXT_FORMAT_MAP[ext] || FONT_EXT_FORMAT_MAP.ttf;
};

const loadFontDataUri = async (fontName) => {
  const fontFile = getFontFileByName(fontName);
  if (!fontFile) return null;
  if (FONT_DATA_URI_CACHE.has(fontFile)) {
    return FONT_DATA_URI_CACHE.get(fontFile);
  }
  if (typeof fetch !== "function") {
    return null;
  }
  try {
    const response = await fetch(`${FONT_PUBLIC_PATH}/${fontFile}`);
    if (!response.ok) {
      console.warn("Failed to fetch font file", fontFile, response.status);
      return null;
    }
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    const meta = detectFontFormatMeta(fontFile);
    const dataUri = `data:${meta.mime};base64,${base64}`;
    const entry = { dataUri, format: meta.format };
    FONT_DATA_URI_CACHE.set(fontFile, entry);
    return entry;
  } catch (error) {
    console.error("Failed to load font for SVG embedding", fontFile, error);
    return null;
  }
};

const collectFontFamiliesFromCanvas = (canvas) => {
  if (!canvas || typeof canvas.getObjects !== "function") return [];
  const fonts = new Set();
  try {
    canvas.getObjects().forEach((obj) => {
      if (!obj || !TEXT_OBJECT_TYPES.has(obj.type)) return;
      if (!obj.fontFamily) return;
      const family = String(obj.fontFamily)
        .split(",")[0]
        .trim()
        .replace(/^['"]|['"]$/g, "");
      if (family) {
        fonts.add(family);
      }
    });
  } catch {}
  return Array.from(fonts);
};

export const collectFontFamiliesFromJson = (json) => {
  const fonts = new Set();
  try {
    const objects = (json && json.objects) || [];
    objects.forEach((obj) => {
      if (!obj || !obj.type) return;
      if (!TEXT_OBJECT_TYPES.has(obj.type)) return;
      if (!obj.fontFamily) return;
      const family = String(obj.fontFamily)
        .split(",")[0]
        .trim()
        .replace(/^['"]|['"]$/g, "");
      if (family) fonts.add(family);
    });
  } catch {}
  return Array.from(fonts);
};

const embedFontsIntoSvgMarkup = async (svgMarkup, fontFamilies) => {
  if (!svgMarkup || !fontFamilies?.length) {
    return svgMarkup;
  }
  if (
    typeof DOMParser === "undefined" ||
    typeof XMLSerializer === "undefined"
  ) {
    return svgMarkup;
  }
  const cssChunks = [];
  for (const family of fontFamilies) {
    const fontData = await loadFontDataUri(family);
    if (!fontData) continue;
    cssChunks.push(
      `@font-face { font-family: '${family.replace(/'/g, "\\'")}'; src: url(${
        fontData.dataUri
      }) format('${
        fontData.format
      }'); font-weight: normal; font-style: normal; font-display: block; }`
    );
  }
  if (!cssChunks.length) {
    return svgMarkup;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgMarkup, "image/svg+xml");
    const svgElement = doc.documentElement;
    if (!svgElement || svgElement.nodeName.toLowerCase() !== "svg") {
      return svgMarkup;
    }
    let defs = svgElement.querySelector("defs");
    if (!defs) {
      defs = doc.createElementNS(svgElement.namespaceURI, "defs");
      svgElement.insertBefore(defs, svgElement.firstChild);
    }
    Array.from(
      defs.querySelectorAll("style[data-embedded-fonts='true']")
    ).forEach((node) => defs.removeChild(node));
    const styleEl = doc.createElementNS(svgElement.namespaceURI, "style");
    styleEl.setAttribute("type", "text/css");
    styleEl.setAttribute("data-embedded-fonts", "true");
    styleEl.textContent = cssChunks.join("\n");
    defs.appendChild(styleEl);
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgElement);
  } catch (error) {
    console.error("Failed to embed fonts into SVG", error);
    return svgMarkup;
  }
};

export async function generateCanvasPreviews(canvas, options = {}) {
  if (!canvas) {
    return { previewSvg: "", previewPng: "" };
  }
  const width =
    typeof options.width === "number"
      ? options.width
      : canvas.getWidth?.() || 0;
  const height =
    typeof options.height === "number"
      ? options.height
      : canvas.getHeight?.() || 0;

  let previewSvg = "";
  let previewPng = "";

  const pngMultiplier =
    typeof options.pngMultiplier === "number" && isFinite(options.pngMultiplier)
      ? options.pngMultiplier
      : 0.5;

  const maxPngDimension =
    typeof options.maxPngDimension === "number" &&
    isFinite(options.maxPngDimension) &&
    options.maxPngDimension > 0
      ? options.maxPngDimension
      : null;

  const baseMaxSide = Math.max(1, Number(width) || 1, Number(height) || 1);
  const capMultiplier =
    maxPngDimension != null ? Math.max(0.1, maxPngDimension / baseMaxSide) : null;
  const effectivePngMultiplier =
    capMultiplier != null ? Math.max(0.1, Math.min(pngMultiplier, capMultiplier)) : pngMultiplier;

  try {
    if (canvas.toSVG) {
      const rawSvg = canvas.toSVG({
        viewBox: {
          x: 0,
          y: 0,
          width,
          height,
        },
        width,
        height,
      });

      const sanitized = rawSvg
        .replace(/[\x00-\x1F\x7F]/g, "")
        .replace(/[\uFFFE\uFFFF]/g, "");

      const fontFamilies = collectFontFamiliesFromCanvas(canvas);
      previewSvg = await embedFontsIntoSvgMarkup(sanitized, fontFamilies);
      console.log("Generated SVG preview, length:", previewSvg.length);
    }

    if (canvas.toDataURL) {
      previewPng = canvas.toDataURL({ format: "png", multiplier: effectivePngMultiplier });
      console.log("Generated PNG preview as fallback");
    }
  } catch (error) {
    console.error("Failed to generate preview:", error);
    try {
      if (canvas.toDataURL) {
        previewPng = canvas.toDataURL({ format: "png", multiplier: effectivePngMultiplier });
        console.log("Generated PNG preview as backup after SVG error");
      }
    } catch (pngError) {
      console.error("Failed to generate PNG preview as backup:", pngError);
    }
  }

  return { previewSvg, previewPng };
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Projects store
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
      // Unsaved signs store
      if (!db.objectStoreNames.contains(UNSAVED_STORE)) {
        const u = db.createObjectStore(UNSAVED_STORE, { keyPath: "id" });
        u.createIndex("createdAt", "createdAt", { unique: false });
        u.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode = "readonly") {
  return db.transaction(STORE, mode).objectStore(STORE);
}
function txUnsaved(db, mode = "readonly") {
  return db.transaction(UNSAVED_STORE, mode).objectStore(UNSAVED_STORE);
}

export async function getAllProjects() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ---------------- Unsaved Signs (temporary) -----------------
export async function getAllUnsavedSigns() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(UNSAVED_STORE)) return resolve([]);
    const store = txUnsaved(db);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function putUnsavedSign(sign) {
  if (!sign?.id) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txUnsaved(db, "readwrite");
    const req = store.put(sign);
    req.onsuccess = () => resolve(sign);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteUnsavedSign(id) {
  if (!id) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txUnsaved(db, "readwrite");
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllUnsavedSigns() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(UNSAVED_STORE)) return resolve();
    const store = txUnsaved(db, "readwrite");
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function broadcastUnsavedUpdate() {
  try {
    window.dispatchEvent(new CustomEvent("unsaved:signsUpdated"));
  } catch {}
}

export async function addUnsavedSignFromSnapshot(snapshot) {
  if (!snapshot) return null;
  const now = Date.now();
  const entry = { id: uuid(), ...snapshot, createdAt: now, updatedAt: now };
  await putUnsavedSign(entry);
  broadcastUnsavedUpdate();
  return entry;
}

// Add canvases from selected projects into the unsavedSigns store (draft mode).
// Returns number of canvases added.
export async function addCanvasesFromProjectsToUnsavedSigns(
  projectIds,
  { maxCanvases = 10 } = {}
) {
  if (!Array.isArray(projectIds) || projectIds.length === 0) return 0;

  const existingUnsaved = await getAllUnsavedSigns();
  const currentCount = Array.isArray(existingUnsaved) ? existingUnsaved.length : 0;
  const limit = typeof maxCanvases === "number" && maxCanvases > 0 ? maxCanvases : 10;

  let added = 0;
  let remaining = Math.max(0, limit - currentCount);
  if (remaining === 0) return 0;

  for (const projectId of projectIds) {
    if (remaining === 0) break;
    if (!projectId) continue;

    try {
      const sourceProject = await getProject(projectId);
      const canvases = Array.isArray(sourceProject?.canvases)
        ? sourceProject.canvases
        : [];
      if (!canvases.length) continue;

      for (const canvasEntry of canvases) {
        if (remaining === 0) break;
        if (!canvasEntry) continue;

        // IMPORTANT: prevent snapshot.id from overriding generated unsaved id.
        const { id: _ignored, ...snapshot } = canvasEntry;
        await addUnsavedSignFromSnapshot(snapshot);
        added += 1;
        remaining -= 1;
      }
    } catch (error) {
      console.error(
        "Error adding canvases from project to unsaved signs:",
        projectId,
        error
      );
    }
  }

  return added;
}

export async function addBlankUnsavedSign(width = 0, height = 0) {
  const entry = {
    id: uuid(),
    json: { objects: [], version: "fabric" },
    preview: "",
    width,
    height,
    // ВИПРАВЛЕННЯ: Завжди встановлюємо білий фон для нових карток
    backgroundColor: "#FFFFFF",
    backgroundType: "solid",
    toolbarState: {
      ...getDefaultToolbarState(),
      globalColors: { ...DEFAULT_GLOBAL_COLORS },
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await putUnsavedSign(entry);
  broadcastUnsavedUpdate();
  return entry;
}

export async function updateUnsavedSignFromCanvas(id, canvas) {
  if (!id || !canvas) return null;

  console.log(
    "Updating unsaved sign:",
    id,
    "with",
    canvas.getObjects().length,
    "objects"
  );

  const db = await openDB();
  let existing;
  try {
    const readStore = txUnsaved(db);
    const getReq = readStore.get(id);
    existing = await new Promise((resolve, reject) => {
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (error) {
    console.error("Error fetching unsaved sign for update:", error);
    throw error;
  }

  if (!existing) {
    console.warn("Unsaved sign not found for update:", id);
    return null;
  }

  try {
    // ВИПРАВЛЕННЯ: Отримуємо актуальний toolbar state з кількох джерел
    let toolbarState = {};

    // Перевіряємо чи це новий порожній canvas
    const isNewCanvas = canvas.getObjects().length === 0;

    // Спочатку намагаємося отримати з window функції
    // НО для нових canvas НЕ використовуємо background з toolbar state
    if (window.getCurrentToolbarState) {
      toolbarState = window.getCurrentToolbarState() || {};
      console.log("Got toolbar state from window function", {
        isNewCanvas,
        hasToolbarState: !!toolbarState,
      });
    }

    // Додатково намагаємося отримати з canvas properties
    // ВИПРАВЛЕННЯ: Обробка Pattern для текстур
    let bgColor =
      canvas.backgroundColor || canvas.get("backgroundColor") || "#FFFFFF";
    const bgTextureUrl = canvas.get("backgroundTextureUrl");
    const bgType = canvas.get("backgroundType") || "solid";

    // Якщо це Pattern (текстура), використовуємо збережений URL
    if (bgType === "texture" && bgTextureUrl) {
      bgColor = bgTextureUrl;
    } else if (typeof bgColor === "object" && bgColor !== null) {
      // Якщо backgroundColor - це об'єкт Pattern, але немає URL, повертаємо білий
      bgColor = "#FFFFFF";
    }

    const canvasState = {
      currentShapeType: canvas.get("shapeType") || "rectangle",
      cornerRadius: canvas.get("cornerRadius") || 0,
      hasUserEditedCanvasCornerRadius: !!canvas.get("hasUserEditedCanvasCornerRadius"),
      backgroundColor: bgColor,
      backgroundType: bgType,
      width: canvas.getWidth(),
      height: canvas.getHeight(),
    };

    // ВИПРАВЛЕННЯ: Мержимо toolbar state, але canvasState має вищий пріоритет
    // Це гарантує, що фактичний стан canvas не буде перезаписаний старим toolbar state
    // Для нових canvas ЗАВЖДИ використовуємо тільки canvasState (білий фон)
    if (isNewCanvas) {
      console.log(
        "New canvas detected - using only canvas state (white background)"
      );
      toolbarState = {
        ...canvasState,
        globalColors: {
          backgroundColor: "#FFFFFF",
          backgroundType: "solid",
        },
      };
    } else {
      toolbarState = {
        ...toolbarState,
        ...canvasState,
        // Також оновлюємо globalColors якщо вони є
        globalColors: {
          ...(toolbarState.globalColors || {}),
          backgroundColor: bgColor,
          backgroundType: bgType,
        },
      };
    }

    // ВИПРАВЛЕННЯ: Синхронізуємо cornerRadius у sizeValues з актуальним значенням canvas
    toolbarState.sizeValues = {
      ...(toolbarState.sizeValues || {}),
      cornerRadius: canvasState.cornerRadius,
    };

    // Ensure the explicit "user edited" flag persists per design/canvas
    toolbarState.hasUserEditedCanvasCornerRadius =
      !!canvasState.hasUserEditedCanvasCornerRadius;

    console.log("Final toolbar state for unsaved sign update:", toolbarState);

    const snap = await exportCanvas(canvas, toolbarState);
    if (!snap) {
      console.error("Failed to export canvas for unsaved sign update");
      return null;
    }

    console.log(
      "Exported canvas snapshot with",
      snap.json?.objects?.length || 0,
      "objects"
    );

    const updated = { ...existing, ...snap, updatedAt: Date.now() };

    // ВИПРАВЛЕННЯ: Додаткова перевірка та очистка перед збереженням в IndexedDB
    // Видаляємо всі можливі HTMLCanvasElement та інші non-serializable об'єкти
    const safeUpdated = JSON.parse(JSON.stringify(updated));

    await new Promise((resolve, reject) => {
      const writeStore = txUnsaved(db, "readwrite");
      const putReq = writeStore.put(safeUpdated);
      putReq.onsuccess = () => {
        console.log("Successfully updated unsaved sign:", id);
        resolve();
      };
      putReq.onerror = () => {
        console.error("Failed to save updated unsaved sign:", putReq.error);
        reject(putReq.error);
      };
    });

    broadcastUnsavedUpdate();
    return safeUpdated;
  } catch (error) {
    console.error("Error updating unsaved sign:", error);
    throw error;
  }
}

export async function getProject(id) {
  if (!id) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function putProject(project) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "readwrite");
    const req = store.put(project);
    req.onsuccess = () => resolve(project);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProject(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "readwrite");
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function uuid() {
  // RFC4122-ish simple UUID
  return (
    crypto?.randomUUID?.() ||
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })
  ).toString();
}

// Serialize current Fabric canvas to JSON + preview image + toolbar state
export async function exportCanvas(canvas, toolbarState = {}, options = {}) {
  if (!canvas) return null;
  try {
    // Include ALL custom props used across the app to preserve element-specific data
    const extraProps = [
      // Basic element metadata
      "data",
      "shapeType",
      "isCutElement",
      "cutType",
      "fromIconMenu",
      "isCircle",
      "clipPath",

      // Shape-specific properties
      "baseCornerRadius",
      "displayCornerRadiusMm",
      "cornerRadiusMm",

      // Stroke and visual properties
      "strokeUniform",
      "borderColor",
      "borderScaleFactor",
      "innerStrokeWidth",

      // Border element properties
      "isBorderShape",
      "cardBorderMode",
      "cardBorderThicknessPx",
      "cardBorderDisplayStrokeColor",
      "cardBorderExportStrokeColor",
      "cardBorderExportFill",

      // QR Code properties
      "isQRCode",
      "qrText",
      "qrSize",
      "qrColor",

      // Barcode properties
      "isBarCode",
      "barCodeText",
      "barCodeType",

      // Image properties
      "originalSrc",
      "imageSource",
      "filters",

      // Text properties (already covered by Fabric, but ensuring custom text data)
      "customTextData",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",

      // Element identification and grouping
      "id",
      "name",
      "layerId",
      "groupId",
      "customData",

      // Interaction & lock flags (so constraints persist after reload)
      "selectable",
      "evented",
      "hasControls",
      "hasBorders",
      "lockMovementX",
      "lockMovementY",
      "lockScalingX",
      "lockScalingY",
      "lockRotation",
      "lockSkewingX",
      "lockSkewingY",

      // Visual interaction properties
      "perPixelTargetFind",
      "hoverCursor",
      "moveCursor",
      "transparentCorners",
      "cornerColor",
      "cornerStrokeColor",
      "cornerStyle",
      "cornerSize",

      // Exclusion properties
      "excludeFromExport",

      // QR internal preview stroke state
      "qrExportStrokeWidth",

      // Custom hole properties
      "holeType",
      "holeDiameter",
      "holePosition",

      // Animation and state properties
      "animatable",
      "visible",
      "opacity",
      "shadow",

      // Custom geometric properties for complex shapes
      "customPath",
      "originalGeometry",
      "transformMatrix",

      // Element creation context
      "createdAt",
      "createdBy",
      "elementVersion",
      "toolbarSnapshot",

      // THEME FOLLOW PROPS (to keep dynamic coloring after reload)
      "useThemeColor",
      "followThemeStroke",
      "initialFillColor",
      "initialStrokeColor",

      // Source flags (helpful for restore heuristics)
      "fromIconMenu",
      "fromShapeTab",
    ];

    let json;
    if (typeof canvas.toDatalessJSON === "function") {
      json = canvas.toDatalessJSON(extraProps);
    } else if (typeof canvas.toJSON === "function") {
      json = canvas.toJSON(extraProps);
    } else {
      json = {};
    }

    // Fabric може повертати об'єкти з методами/екземплярами класів (наприклад, clipPath).
    // Пропускаємо результат через JSON serialization, щоб гарантовано отримати чисті дані.
    try {
      json = JSON.parse(JSON.stringify(json));
    } catch (serializationError) {
      console.warn(
        "Failed to sanitize canvas JSON before export",
        serializationError
      );
    }

    // ВИПРАВЛЕННЯ: Додаткова очистка від HTMLCanvasElement та інших non-serializable об'єктів
    const cleanObject = (obj) => {
      if (!obj || typeof obj !== "object") return obj;

      // Якщо це HTMLCanvasElement або інший DOM елемент, повертаємо null
      if (obj instanceof HTMLElement || obj instanceof HTMLCanvasElement) {
        return null;
      }

      // Якщо це Array
      if (Array.isArray(obj)) {
        return obj
          .map((item) => cleanObject(item))
          .filter((item) => item !== null);
      }

      // Якщо це звичайний об'єкт
      const cleaned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];

          // Пропускаємо функції та non-serializable об'єкти
          if (typeof value === "function") continue;
          if (
            value instanceof HTMLElement ||
            value instanceof HTMLCanvasElement
          )
            continue;

          // Рекурсивно очищаємо вкладені об'єкти
          const cleanedValue = cleanObject(value);
          if (cleanedValue !== null) {
            cleaned[key] = cleanedValue;
          }
        }
      }
      return cleaned;
    };

    json = cleanObject(json);

    // НОВЕ: Вбудовуємо надійні джерела для image-об'єктів, щоб виживали після перезавантаження
    try {
      if (json && Array.isArray(json.objects)) {
        const liveObjects =
          typeof canvas.getObjects === "function" ? canvas.getObjects() : [];
        json.objects = json.objects.map((obj, idx) => {
          try {
            if (obj && obj.type === "image") {
              // Пошук відповідного live-об'єкта за індексом як основний варіант
              const live =
                liveObjects[idx] && liveObjects[idx].type === "image"
                  ? liveObjects[idx]
                  : liveObjects.find(
                      (o) =>
                        o.type === "image" &&
                        (o.id && obj.id ? o.id === obj.id : true)
                    ) || null;
              const element =
                live &&
                (live._originalElement || live._element || live.getElement?.());
              const origSrc =
                (live &&
                  (live.getSrc?.() || live.src || (element && element.src))) ||
                obj.src;

              // Якщо src відсутній або це тимчасовий blob:, пробуємо вбудувати dataURL
              const needsEmbed =
                !obj.src ||
                (typeof obj.src === "string" && obj.src.startsWith("blob:"));
              if (
                element &&
                (needsEmbed ||
                  (typeof origSrc === "string" && origSrc.startsWith("blob:")))
              ) {
                try {
                  const off = document.createElement("canvas");
                  const w =
                    element.naturalWidth ||
                    element.videoWidth ||
                    element.width ||
                    live?.width ||
                    0;
                  const h =
                    element.naturalHeight ||
                    element.videoHeight ||
                    element.height ||
                    live?.height ||
                    0;
                  if (w > 0 && h > 0) {
                    off.width = w;
                    off.height = h;
                    const ctx = off.getContext("2d");
                    ctx.drawImage(element, 0, 0, w, h);
                    const dataUrl = off.toDataURL("image/png");
                    if (dataUrl && dataUrl.length > 0) {
                      obj.originalSrc = origSrc || obj.originalSrc || null;
                      obj.src = dataUrl;
                    }
                  }
                } catch (embedErr) {
                  // Якщо неможливо вбудувати через CORS — зберігаємо хоч би originalSrc
                  obj.originalSrc = origSrc || obj.originalSrc || null;
                }
              } else if (origSrc) {
                // Переконуємося, що зберегли оригінальне посилання
                obj.originalSrc = origSrc || obj.originalSrc || null;
                obj.src = obj.src || origSrc;
              }
            }
          } catch {}
          return obj;
        });
      }
    } catch (imgSanitizeErr) {
      console.warn("Image embedding during export failed:", imgSanitizeErr);
    }

    // ВИПРАВЛЕННЯ: Додаємо shapeType до JSON верхнього рівня
    if (json && !json.shapeType) {
      json.shapeType =
        canvas.get("shapeType") || toolbarState.currentShapeType || "rectangle";
    }

    if (json && Array.isArray(json.objects)) {
      json.objects = json.objects.map((obj) => {
        if (obj?.isBorderShape && obj.clipPath && !options.keepClipPath) {
          // ClipPath використовується лише для внутрішнього відмалювання рамки, не зберігаємо його в snapshot.
          delete obj.clipPath;
        }
        return obj;
      });
    }

    // Check if canvas has border elements before filtering
    const borderElements = canvas
      .getObjects()
      .filter((obj) => obj.isBorderShape);
    const hasAnyBorder = borderElements.length > 0;
    const hasCustomBorder =
      borderElements.some((obj) => obj.cardBorderMode === "custom") ||
      !!toolbarState.hasBorder;

    console.log(
      "Canvas export - found border elements:",
      borderElements.length
    );
    console.log("Canvas export - custom border active:", hasCustomBorder);
    console.log(
      "Canvas export - toolbar state hasBorder:",
      toolbarState.hasBorder
    );
    console.log("Canvas export - final hasBorder:", hasCustomBorder);

    // Enhance JSON with additional element-specific metadata
    if (json && json.objects && Array.isArray(json.objects)) {
      json.objects = json.objects.map((obj) => {
        // Add element creation timestamp if not present
        if (!obj.createdAt) {
          obj.createdAt = Date.now();
        }

        // Store current toolbar snapshot for each element
        obj.toolbarSnapshot = toolbarState;

        // Preserve element version for compatibility
        obj.elementVersion = "2.0";

        return obj;
      });
    }

    // Prefer design size (Fabric internal size equals design pixels in this app)
    const width = canvas.getWidth?.() || 0;
    const height = canvas.getHeight?.() || 0;

    // ВИПРАВЛЕННЯ: Отримуємо shapeType з canvas
    const canvasShapeType =
      canvas.get("shapeType") || toolbarState.currentShapeType || "rectangle";
    console.log("Exporting canvas - shapeType sources:", {
      canvasShapeType: canvas.get("shapeType"),
      toolbarShapeType: toolbarState.currentShapeType,
      finalShapeType: canvasShapeType,
    });

    // ВИПРАВЛЕННЯ: Генеруємо SVG preview з вбудованими шрифтами + PNG fallback
    let previewSvg = "";
    let previewPng = "";
    if (!options.skipPreview) {
      try {
        const previews = await generateCanvasPreviews(canvas, {
          width,
          height,
          pngMultiplier:
            typeof options.previewPngMultiplier === "number"
              ? options.previewPngMultiplier
              : undefined,
          maxPngDimension:
            typeof options.previewPngMaxDimension === "number"
              ? options.previewPngMaxDimension
              : undefined,
        });
        previewSvg = previews.previewSvg;
        previewPng = previews.previewPng;
      } catch (previewError) {
        console.error("Failed to produce previews:", previewError);
      }
    }

    // Store comprehensive toolbar state for each canvas
    // ВИПРАВЛЕННЯ: Обробка Pattern для текстур
    let bgColor =
      canvas.backgroundColor || canvas.get("backgroundColor") || "#FFFFFF";
    const bgTextureUrl = canvas.get("backgroundTextureUrl");
    const bgType = canvas.get("backgroundType") || "solid";

    // Якщо це Pattern (текстура), використовуємо збережений URL
    if (bgType === "texture" && bgTextureUrl) {
      bgColor = bgTextureUrl;
    } else if (typeof bgColor === "object" && bgColor !== null) {
      // Якщо backgroundColor - це об'єкт Pattern, але немає URL, повертаємо білий
      bgColor = "#FFFFFF";
    }

    // НОВЕ: Зберігаємо фон-картинку canvas, якщо вона є
    let backgroundImage = null;
    try {
      const bgImg = canvas.backgroundImage || canvas.get?.("backgroundImage");
      if (bgImg) {
        const element =
          bgImg._originalElement || bgImg._element || bgImg.getElement?.();
        let src = bgImg.getSrc?.() || (element && element.src) || null;
        const needsEmbed =
          !src || (typeof src === "string" && src.startsWith("blob:"));
        if (element && needsEmbed) {
          try {
            const off = document.createElement("canvas");
            const w =
              element.naturalWidth || element.videoWidth || element.width || 0;
            const h =
              element.naturalHeight ||
              element.videoHeight ||
              element.height ||
              0;
            if (w > 0 && h > 0) {
              off.width = w;
              off.height = h;
              const ctx = off.getContext("2d");
              ctx.drawImage(element, 0, 0, w, h);
              src = off.toDataURL("image/png");
            }
          } catch {}
        }
        backgroundImage = {
          src: src || null,
          opacity: bgImg.opacity ?? 1,
          originX: bgImg.originX ?? "left",
          originY: bgImg.originY ?? "top",
          scaleX: bgImg.scaleX ?? 1,
          scaleY: bgImg.scaleY ?? 1,
          left: bgImg.left ?? 0,
          top: bgImg.top ?? 0,
          angle: bgImg.angle ?? 0,
        };
      }
    } catch {}

    const canvasState = {
      json,
      preview: previewPng, // Зберігаємо PNG як fallback
      previewSvg: previewSvg, // НОВИЙ: SVG preview для UI
      width,
      height,
      // ВИПРАВЛЕННЯ: Покращене збереження canvas properties
      backgroundColor: bgColor,
      backgroundType: bgType,
      backgroundImage, // НОВЕ: фон як зображення, якщо було встановлено
      canvasType: canvasShapeType, // Використовуємо вже визначений canvasShapeType
      cornerRadius: canvas.get("cornerRadius") || 0,
      hasUserEditedCanvasCornerRadius: !!canvas.get("hasUserEditedCanvasCornerRadius"),

      // ВИПРАВЛЕННЯ: Зберігаємо повний toolbar state з canvas properties
      toolbarState: {
        ...toolbarState,
        cornerRadius: canvas.get("cornerRadius") || 0,
        hasUserEditedCanvasCornerRadius: !!canvas.get("hasUserEditedCanvasCornerRadius"),
        // ВИПРАВЛЕННЯ: Зберігаємо актуальний тип фігури з canvas
        currentShapeType: canvasShapeType, // Використовуємо вже визначений canvasShapeType
        // Оновлюємо розміри в toolbar state
        sizeValues: {
          width:
            typeof width === "number"
              ? Math.round((width * 25.4) / 72)
              : DEFAULT_SIGN_SIZE_MM.width,
          height:
            typeof height === "number"
              ? Math.round((height * 25.4) / 72)
              : DEFAULT_SIGN_SIZE_MM.height,
          cornerRadius: canvas.get("cornerRadius") || 0,
        },
        // Оновлюємо background color
        globalColors: {
          ...(toolbarState.globalColors || {}),
          backgroundColor: bgColor,
          backgroundType: bgType,
        },
        // Зберігаємо border flag з множинних джерел
        hasBorder: hasCustomBorder,
        // Зберігаємо copies count
        copiesCount: Number(toolbarState.copiesCount) || 1,
        // Зберігаємо timestamp
        lastSaved: Date.now(),
      },

      // Зберігаємо copies count на верхньому рівні для зручного доступу
      copiesCount: Number(toolbarState.copiesCount) || 1,

      // ВИПРАВЛЕННЯ: Додаткові метадані для відстеження
      canvasMetadata: {
        objectCount: canvas.getObjects().length,
        hasBorderElements: hasAnyBorder,
        lastModified: Date.now(),
        version: "2.0",
      },
    };

    console.log("Canvas exported successfully:", {
      canvasType: canvasState.canvasType,
      width: canvasState.width,
      height: canvasState.height,
      objectCount: canvasState.json?.objects?.length || 0,
      backgroundColor: canvasState.backgroundColor,
      currentShapeType: canvasState.toolbarState?.currentShapeType,
      hasBorder: canvasState.toolbarState?.hasBorder,
    });

    return canvasState;
  } catch (e) {
    console.error("exportCanvas failed", e);
    return null;
  }
}

// Helper function to extract toolbar state from saved canvas data
export function extractToolbarState(canvasData) {
  if (!canvasData) {
    return getDefaultToolbarState();
  }

  // ВИПРАВЛЕННЯ: Правильно витягуємо збережений стан
  const savedState = canvasData.toolbarState || {};

  // ВИПРАВЛЕННЯ: Використовуємо canvasType з верхнього рівня як пріоритетний
  // Це гарантує, що тип фігури береться з фактичного збереженого canvas.shapeType
  const actualShapeType =
    canvasData.canvasType ||
    savedState.currentShapeType ||
    canvasData.json?.shapeType ||
    "rectangle";

  return {
    currentShapeType: actualShapeType,
    cornerRadius: savedState.cornerRadius || 0,
      hasUserEditedCanvasCornerRadius: !!savedState.hasUserEditedCanvasCornerRadius,
    sizeValues: savedState.sizeValues || {
      width: canvasData.width
        ? Math.round((canvasData.width * 25.4) / 72)
        : DEFAULT_SIGN_SIZE_MM.width,
      height: canvasData.height
        ? Math.round((canvasData.height * 25.4) / 72)
        : DEFAULT_SIGN_SIZE_MM.height,
      cornerRadius: savedState.cornerRadius || 0,
    },
    globalColors: savedState.globalColors || {
      textColor: "#000000",
      backgroundColor: canvasData.backgroundColor || "#FFFFFF",
      strokeColor: "#000000",
      fillColor: "transparent",
      backgroundType: canvasData.backgroundType || "solid",
    },
    selectedColorIndex: savedState.selectedColorIndex || 0,
    thickness: savedState.thickness || 1.6,
    isAdhesiveTape: savedState.isAdhesiveTape || false,
    activeHolesType: savedState.activeHolesType || 1,
    holesDiameter: savedState.holesDiameter || 2.5,
    isHolesSelected: savedState.isHolesSelected || false,
    isCustomShapeMode: false, // Завжди false при завантаженні
    isCustomShapeApplied: savedState.isCustomShapeApplied || false,
    hasUserPickedShape: savedState.hasUserPickedShape || false,
    copiesCount: savedState.copiesCount || 1,
    hasBorder: savedState.hasBorder || false,
  };
}

// Helper function to get default toolbar state
function getDefaultToolbarState() {
  return {
    currentShapeType: "rectangle",
    cornerRadius: 0,
    hasUserEditedCanvasCornerRadius: false,
    sizeValues: {
      width: DEFAULT_SIGN_SIZE_MM.width,
      height: DEFAULT_SIGN_SIZE_MM.height,
      cornerRadius: 0,
    },
    globalColors: {
      textColor: "#000000",
      backgroundColor: "#FFFFFF",
      strokeColor: "#000000",
      fillColor: "transparent",
      backgroundType: "solid",
    },
    selectedColorIndex: 0,
    thickness: 1.6,
    isAdhesiveTape: false,
    activeHolesType: 1,
    holesDiameter: 2.5,
    isHolesSelected: false,
    isCustomShapeMode: false,
    isCustomShapeApplied: false,
    hasUserPickedShape: false,
    copiesCount: 1,
    hasBorder: false,
  };
}

// Helper function to regenerate QR code from saved data
async function regenerateQrCode(canvas, oldObj, qrText, themeTextColor) {
  if (!canvas || !oldObj || !qrText) return null;
  
  console.log('[regenerateQrCode] Перегенерація QR коду:', qrText);
  console.log('[regenerateQrCode] oldObj.qrColor:', oldObj.qrColor);
  
  try {
    // Зберігаємо позицію та розмір старого об'єкта ПЕРЕД видаленням
    const preserved = {
      left: oldObj.left,
      top: oldObj.top,
      scaleX: oldObj.scaleX,
      scaleY: oldObj.scaleY,
      angle: oldObj.angle,
      originX: oldObj.originX || "center",
      originY: oldObj.originY || "center",
    };
    
    // Витягуємо оригінальний колір QR коду
    // Пріоритет: qrColor > display-layer fill > export-layer stroke > themeTextColor
    let originalColor = null;
    const isUsableColor = (c) => {
      if (typeof c !== 'string') return false;
      const v = c.trim().toLowerCase();
      if (!v) return false;
      if (v === 'none') return false;
      if (v === 'transparent') return false;
      // Reject fully transparent rgba/hsla values that visually make QR invisible
      if (/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(v)) return false;
      if (/^hsla\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(v)) return false;
      return true;
    };
    // 1. Спочатку перевіряємо збережений qrColor
    if (isUsableColor(oldObj.qrColor)) {
      originalColor = oldObj.qrColor;
      console.log('[regenerateQrCode] Використовуємо збережений qrColor:', originalColor);
    }
    
    // 2. Якщо немає qrColor, шукаємо в дочірніх елементах
    if (!originalColor && typeof oldObj.getObjects === 'function') {
      const children = oldObj.getObjects();
      console.log('[regenerateQrCode] Шукаємо колір в дочірніх елементах:', children.length);
      
      // Спочатку шукаємо display-layer (він має правильний fill)
      for (const child of children) {
        console.log('[regenerateQrCode] Child:', { id: child.id, fill: child.fill, stroke: child.stroke });
        
        if (child.id === 'qr-display-layer' && child.fill) {
          // Display layer має fill з оригінальним кольором
          const fill = child.fill;
          if (fill && fill !== 'none' && fill !== 'transparent' && fill !== null && fill !== '') {
            originalColor = fill;
            console.log('[regenerateQrCode] Знайдено колір з display-layer fill:', originalColor);
            break;
          }
        }
      }
      
      // Якщо не знайшли в display-layer, шукаємо в export-layer
      if (!originalColor) {
        for (const child of children) {
          if (child.id === 'qr-export-layer' && child.stroke) {
            const stroke = child.stroke;
            if (stroke && stroke !== 'none' && stroke !== 'transparent' && stroke !== null && stroke !== '') {
              originalColor = stroke;
              console.log('[regenerateQrCode] Знайдено колір з export-layer stroke:', originalColor);
              break;
            }
          }
        }
      }
    }
    
    // 3. Fallback до themeTextColor
    if (!originalColor) {
      originalColor = themeTextColor || "#000000";
      console.log('[regenerateQrCode] Fallback до themeTextColor:', originalColor);
    }
    
    console.log('[regenerateQrCode] Фінальний колір для QR:', originalColor);
    
    // ВАЖЛИВО: Спочатку видаляємо старий об'єкт ПЕРЕД створенням нового
    const oldIndex = canvas.getObjects().indexOf(oldObj);
    console.log('[regenerateQrCode] Видаляємо старий QR, index:', oldIndex, 'total before:', canvas.getObjects().length);
    
    // Видаляємо старий об'єкт
    canvas.remove(oldObj);
    canvas.renderAll();
    
    // Перевіряємо що об'єкт видалено
    const stillExists = canvas.getObjects().includes(oldObj);
    console.log('[regenerateQrCode] Старий QR ще існує після remove:', stillExists, 'total after remove:', canvas.getObjects().length);
    
    if (stillExists) {
      console.error('[regenerateQrCode] ПОМИЛКА: Старий QR не видалено! Спроба примусового видалення...');
      // Примусове видалення
      const objects = canvas.getObjects();
      const idx = objects.indexOf(oldObj);
      if (idx >= 0) {
        objects.splice(idx, 1);
        canvas.renderAll();
      }
    }
    
    // Генеруємо новий QR код
    const cellSize = DEFAULT_QR_CELL_SIZE;
    const qr = qrGenerator(0, "M");
    qr.addData(qrText);
    qr.make();
    
    const { optimizedPath, displayPath, size } = computeQrVectorData(qr, cellSize);
    
    const svgText = buildQrSvgMarkup({
      size,
      displayPath,
      optimizedPath,
      strokeColor: originalColor,
    });
    
    
    // Динамічний імпорт fabric
    const fabricModule = await import('fabric');
    const fabricLib = fabricModule?.fabric || fabricModule?.default || fabricModule;
    
    
    // Завантажуємо SVG
    if (!fabricLib || typeof fabricLib.loadSVGFromString !== 'function') {
      throw new Error('Fabric loadSVGFromString is not available');
    }
    const result = await fabricLib.loadSVGFromString(svgText);
    let newObj;
    if (result?.objects?.length === 1) {
      newObj = result.objects[0];
    } else {
      if (!fabricLib.util?.groupSVGElements) {
        throw new Error('Fabric util.groupSVGElements is not available');
      }
      newObj = fabricLib.util.groupSVGElements(result.objects || [], result.options || {});
    }
    
    // Застосовуємо decorateQrGroup
    decorateQrGroup(newObj);
    
    // Відновлюємо позицію та розмір
    newObj.set({
      left: preserved.left,
      top: preserved.top,
      scaleX: preserved.scaleX,
      scaleY: preserved.scaleY,
      angle: preserved.angle,
      originX: preserved.originX,
      originY: preserved.originY,
      selectable: true,
      hasControls: true,
      hasBorders: true,
      isQRCode: true,
      qrText: qrText,
      qrSize: size,
      qrColor: originalColor,
      backgroundColor: "transparent",
    });
    
    // Додаємо новий об'єкт на позицію старого
    const currentObjects = canvas.getObjects();
    if (oldIndex >= 0 && oldIndex <= currentObjects.length) {
      canvas.insertAt(oldIndex, newObj);
    } else {
      canvas.add(newObj);
    }
    
    canvas.renderAll();
    console.log('[regenerateQrCode] QR код успішно перегенеровано, всього об\'єктів:', canvas.getObjects().length);
    return newObj;
  } catch (error) {
    console.error('[regenerateQrCode] Помилка перегенерації QR:', error);
    return null;
  }
}

// Helper function to restore element-specific properties after canvas load
export async function restoreElementProperties(canvas, toolbarState = null) {
  console.log('========== [restoreElementProperties] ФУНКЦІЯ ВИКЛИКАНА ==========');
  console.log('[restoreElementProperties] canvas:', canvas);
  console.log('[restoreElementProperties] canvas.getObjects:', typeof canvas?.getObjects);
  
  if (!canvas || !canvas.getObjects) {
    console.log('[restoreElementProperties] ВИХІД: canvas або getObjects відсутній');
    return;
  }

  try {
    const themeTextColor =
      (toolbarState &&
        toolbarState.globalColors &&
        toolbarState.globalColors.textColor) ||
      "#000000";
    const objects = canvas.getObjects();

    console.log('[restoreElementProperties] Всього об\'єктів:', objects.length);

    // Збираємо QR коди для перегенерації окремо
    const qrCodesToRegenerate = [];
    const isQrLayerChild = (child) =>
      !!child && (child.id === QR_DISPLAY_LAYER_ID || child.id === QR_EXPORT_LAYER_ID);

    const objectLooksLikeQrGroup = (obj) => {
      if (!obj) return false;
      if (obj.isQRCode === true) return true;
      if (obj.data && obj.data.isQRCode === true) return true;
      if (obj.type === "group" && typeof obj.getObjects === "function") {
        try {
          const children = obj.getObjects() || [];
          return children.some(isQrLayerChild);
        } catch {}
      }
      return false;
    };

    const getQrTextFromObject = (obj) => {
      if (!obj) return null;
      if (typeof obj.qrText === "string" && obj.qrText.trim()) return obj.qrText.trim();
      if (obj.data && typeof obj.data.qrText === "string" && obj.data.qrText.trim()) {
        return obj.data.qrText.trim();
      }
      return null;
    };
    for (let index = 0; index < objects.length; index++) {
      const obj = objects[index];
      
      // Детальна діагностика - виводимо всі кастомні властивості
      const customProps = {};
      const keysToCheck = ['isQRCode', 'qrText', 'qrSize', 'isBarCode', 'barCodeText', 'type', 'id'];
      keysToCheck.forEach(key => {
        if (obj[key] !== undefined) customProps[key] = obj[key];
      });
      
      // Також перевіряємо дочірні елементи якщо це група
      let childrenInfo = null;
      if (obj.type === 'group' && typeof obj.getObjects === 'function') {
        const children = obj.getObjects();
        childrenInfo = children.map((child, i) => ({
          index: i,
          type: child.type,
          id: child.id,
          fill: child.fill,
          stroke: child.stroke
        }));
      }
      
      console.log(`[restoreElementProperties] Об'єкт ${index}:`, {
        ...customProps,
        childrenCount: childrenInfo ? childrenInfo.length : 0,
        children: childrenInfo
      });

      // Збираємо QR коди для перегенерації (видалимо старі та додамо нові)
      try {
        const qrText = getQrTextFromObject(obj);
        if (qrText && objectLooksLikeQrGroup(obj)) {
          console.log('[restoreElementProperties] Знайдено QR код для перегенерації:', qrText);
          qrCodesToRegenerate.push({
            oldObj: obj,
            qrText,
            index: index,
          });
        }
      } catch {}

      // Restore Barcode functionality
      if (obj.isBarCode && obj.barCodeText && obj.barCodeType) {
        obj.set({
          isBarCode: true,
          barCodeText: obj.barCodeText,
          barCodeType: obj.barCodeType,
        });
      }

      // Restore cut element properties
      if (obj.isCutElement) {
        obj.set({
          isCutElement: true,
          cutType: obj.cutType || "hole",
        });
      }

      // Restore shape properties
      if (obj.shapeType) {
        obj.set({
          shapeType: obj.shapeType,
        });
      }

      // Restore corner radius properties
      if (obj.cornerRadiusMm !== undefined) {
        obj.set({
          cornerRadiusMm: obj.cornerRadiusMm,
          baseCornerRadius: obj.baseCornerRadius,
          displayCornerRadiusMm: obj.displayCornerRadiusMm,
        });
      }

      // Restore stroke properties
      if (obj.strokeUniform !== undefined) {
        obj.set({
          strokeUniform: obj.strokeUniform,
        });
      }

      // Restore inner stroke properties for border elements
      if (obj.innerStrokeWidth !== undefined) {
        obj.set({
          innerStrokeWidth: obj.innerStrokeWidth,
        });
      }

      // Restore border element properties
      if (obj.isBorderShape) {
        const displayStrokeColor =
          obj.cardBorderDisplayStrokeColor || obj.stroke || "#000000";
        const exportStrokeColor =
          obj.cardBorderExportStrokeColor ||
          (obj.cardBorderMode === "custom"
            ? CUSTOM_BORDER_EXPORT_COLOR
            : displayStrokeColor);
        const exportFillValue =
          obj.cardBorderMode === "custom"
            ? obj.cardBorderExportFill || CUSTOM_BORDER_EXPORT_FILL
            : obj.cardBorderExportFill || obj.fill || "transparent";

        obj.set({
          isBorderShape: true,
          cardBorderMode: obj.cardBorderMode || "default",
          cardBorderThicknessPx:
            obj.cardBorderThicknessPx !== undefined
              ? obj.cardBorderThicknessPx
              : 2,
          cardBorderDisplayStrokeColor: displayStrokeColor,
          cardBorderExportStrokeColor: exportStrokeColor,
          cardBorderExportFill: exportFillValue,
        });

        if (obj.cardBorderMode === "custom") {
          obj.set({
            stroke: displayStrokeColor,
            fill: "transparent",
          });
        }
      }

      // Ensure themed icons/shapes continue to follow theme after reload
      try {
        // If object originated from icon menu or previously marked to follow theme,
        // persist/propagate the flag (children of groups too)
        let shouldFollowTheme =
          obj.useThemeColor === true || obj.fromIconMenu === true;

        // Heuristic: for legacy saved objects without flag — if stroke already matches theme
        // but fill is plain white, treat it as theme-following icon
        if (!shouldFollowTheme && !obj.isCutElement) {
          const fillStr =
            typeof obj.fill === "string" ? obj.fill.toLowerCase() : "";
          const strokeStr =
            typeof obj.stroke === "string" ? obj.stroke.toLowerCase() : "";
          const themeStr = String(themeTextColor || "#000000").toLowerCase();
          if (
            (fillStr === "#ffffff" || fillStr === "white") &&
            strokeStr === themeStr
          ) {
            shouldFollowTheme = true;
          }
        }
        if (shouldFollowTheme) {
          obj.useThemeColor = true;
          if (typeof obj.set === "function") {
            // Do not override explicit transparent fills, but ensure default white artifacts are recolored
            const isTransparent =
              obj.fill === "transparent" || obj.fill === "" || obj.fill == null;
            if (!isTransparent) {
              // Align fill to current theme color so next theme switch also works predictably
              obj.set({ fill: themeTextColor });
            }
            obj.set({ stroke: themeTextColor });
          }
          if (obj.type === "group" && typeof obj.forEachObject === "function") {
            obj.forEachObject((child) => {
              try {
                if (child && typeof child.set === "function") {
                  child.set({ useThemeColor: true });
                  const childTransparent =
                    child.fill === "transparent" ||
                    child.fill === "" ||
                    child.fill == null;
                  if (!childTransparent) child.set({ fill: themeTextColor });
                  child.set({ stroke: themeTextColor });
                }
              } catch {}
            });
          }
        }
      } catch {}

      // Restore image properties
      if (obj.type === "image" && obj.originalSrc) {
        obj.set({
          originalSrc: obj.originalSrc,
        });
      }

      // Restore icon menu properties
      if (obj.fromIconMenu) {
        obj.set({
          fromIconMenu: true,
        });
      }

      // Restore custom data
      if (obj.customData) {
        obj.set({
          customData: obj.customData,
        });
      }

      // Restore identification properties
      if (obj.layerId || obj.groupId) {
        obj.set({
          layerId: obj.layerId,
          groupId: obj.groupId,
        });
      }
    }

    // Перегенеровуємо QR коди - видаляємо старі та створюємо нові
    if (qrCodesToRegenerate.length > 0) {
      console.log('[restoreElementProperties] Перегенеровуємо QR коди:', qrCodesToRegenerate.length);
      for (const qrData of qrCodesToRegenerate) {
        try {
          await regenerateQrCode(canvas, qrData.oldObj, qrData.qrText, themeTextColor);
        } catch (error) {
          console.error('[restoreElementProperties] Помилка перегенерації QR:', error);
        }
      }
    }

    canvas.renderAll();

    // Programmatic border recreation if needed
    if (toolbarState && toolbarState.hasBorder) {
      console.log("Border recreation needed - hasBorder:", true);
      console.log("Toolbar state for border recreation:", {
        hasBorder: toolbarState.hasBorder,
        thickness: toolbarState.thickness,
        globalColors: toolbarState.globalColors,
        currentShapeType: toolbarState.currentShapeType,
      });

      if (window.recreateBorder) {
        console.log("Calling window.recreateBorder() with saved toolbarState");
        // Use timeout to ensure canvas is fully rendered before adding border
        setTimeout(() => {
          try {
            window.recreateBorder(toolbarState);
            console.log("Border recreation completed successfully");
          } catch (error) {
            console.error("Failed to recreate border:", error);
          }
        }, 200);
      } else {
        console.error("window.recreateBorder function not available");
      }
    } else {
      console.log("Border recreation skipped:", {
        hasToolbarState: !!toolbarState,
        hasBorder: toolbarState?.hasBorder,
        hasRecreateBorderFunction: !!window.recreateBorder,
      });
    }
  } catch (e) {
    console.error("Failed to restore element properties:", e);
  }
}

export async function saveNewProject(name, canvas) {
  const toolbarState = window.getCurrentToolbarState?.() || {};
  const snap = await exportCanvas(canvas, toolbarState);
  const now = Date.now();

  const cloneCanvasEntry = (entry) => {
    try {
      return JSON.parse(JSON.stringify(entry));
    } catch {
      return { ...entry };
    }
  };

  // Якщо Save As викликається з уже відкритого проекту,
  // копіюємо ВСІ його полотна, а не лише поточне.
  let sourceProjectId = null;
  let currentCanvasId = null;
  let currentProjectCanvasId = null;
  let currentProjectCanvasIndex = null;
  let runtimeProjectCanvasId = null;
  let runtimeProjectCanvasIndex = null;
  try {
    sourceProjectId = localStorage.getItem("currentProjectId");
  } catch {}
  try {
    currentCanvasId = localStorage.getItem("currentCanvasId");
  } catch {}
  try {
    currentProjectCanvasId = localStorage.getItem("currentProjectCanvasId");
  } catch {}
  try {
    const storedIndex = localStorage.getItem("currentProjectCanvasIndex");
    if (storedIndex !== null && storedIndex !== undefined) {
      const parsed = Number(storedIndex);
      if (!Number.isNaN(parsed)) {
        currentProjectCanvasIndex = parsed;
      }
    }
  } catch {}
  try {
    if (typeof window !== "undefined") {
      runtimeProjectCanvasId = window.__currentProjectCanvasId || null;
      runtimeProjectCanvasIndex = window.__currentProjectCanvasIndex || null;
    }
  } catch {}

  // Отримуємо поточний ID незбереженого знаку
  let currentUnsavedId = null;
  try {
    currentUnsavedId = localStorage.getItem("currentUnsavedSignId");
  } catch {}

  const activeProjectCanvasId =
    runtimeProjectCanvasId || currentProjectCanvasId || null;
  const activeProjectCanvasIndex =
    typeof runtimeProjectCanvasIndex === "number" &&
    runtimeProjectCanvasIndex >= 0
      ? runtimeProjectCanvasIndex
      : currentProjectCanvasIndex;

  let canvases = [];
  let activeCanvasIndex = 0;
  // Track unsaved sign IDs that are already embedded in canvases
  // so we can delete them from the unsaved store and exclude from transferUnsavedSignsToProject
  let includedUnsavedIds = [];

  if (sourceProjectId) {
    try {
      const sourceProject = await getProject(sourceProjectId);
      const sourceCanvases = Array.isArray(sourceProject?.canvases)
        ? sourceProject.canvases.slice(0, 10)
        : [];

      if (sourceCanvases.length > 0) {
        canvases = sourceCanvases.map(cloneCanvasEntry);

        let targetIndex = -1;
        if (activeProjectCanvasId) {
          targetIndex = canvases.findIndex((c) => c.id === activeProjectCanvasId);
        }
        if (
          targetIndex === -1 &&
          typeof activeProjectCanvasIndex === "number" &&
          activeProjectCanvasIndex >= 0 &&
          activeProjectCanvasIndex < canvases.length
        ) {
          targetIndex = activeProjectCanvasIndex;
        }
        if (targetIndex === -1 && currentCanvasId) {
          targetIndex = canvases.findIndex((c) => c.id === currentCanvasId);
        }

        if (snap) {
          if (targetIndex !== -1) {
            canvases[targetIndex] = { ...canvases[targetIndex], ...snap };
          } else if (canvases.length < 10) {
            canvases.push({ id: uuid(), ...snap });
            targetIndex = canvases.length - 1;
          }
        }

        if (targetIndex >= 0) {
          activeCanvasIndex = targetIndex;
        }
      }
    } catch (error) {
      console.warn("Save As: failed to clone source project canvases", error);
    }
  }

  if (canvases.length === 0) {
    // No source project — build canvases from ALL unsaved signs keeping their original
    // creation order (oldest → newest), same as ProjectCanvasesGrid grid display.
    // Apply the current snap to the currently-open unsaved sign in place so its
    // position is preserved instead of being forced to index 0.
    let allUnsaved = [];
    try {
      const rawUnsaved = await getAllUnsavedSigns();
      allUnsaved = [...rawUnsaved].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    } catch {}

    for (const s of allUnsaved) {
      if (canvases.length >= 10) break;
      const isCurrent = Boolean(currentUnsavedId && s.id === currentUnsavedId);
      canvases.push({
        id: uuid(),
        ...(isCurrent && snap
          ? snap
          : {
              json: s.json,
              preview: s.preview,
              previewSvg: s.previewSvg,
              width: s.width,
              height: s.height,
              backgroundColor: s.backgroundColor,
              backgroundType: s.backgroundType,
              backgroundImage: s.backgroundImage,
              canvasType: s.canvasType,
              cornerRadius: s.cornerRadius,
              toolbarState: s.toolbarState,
              copiesCount: s.copiesCount,
            }),
      });
      if (isCurrent) activeCanvasIndex = canvases.length - 1;
      includedUnsavedIds.push(s.id);
    }

    // Fallback: no unsaved signs at all, just the current snap
    if (canvases.length === 0 && snap) {
      canvases = [{ id: uuid(), ...snap }];
      activeCanvasIndex = 0;
    }
  }

  const activeCanvas = canvases[activeCanvasIndex] || canvases[0] || null;

  const project = {
    id: uuid(),
    name: name && String(name).trim() ? String(name).trim() : "Untitled",
    createdAt: now,
    updatedAt: now,
    canvases,
  };
  await putProject(project);
  try {
    localStorage.setItem("currentProjectId", project.id);
    localStorage.setItem("currentProjectName", project.name);
    if (activeCanvas) {
      localStorage.setItem("currentCanvasId", activeCanvas.id);
      localStorage.setItem("currentProjectCanvasId", activeCanvas.id);
      localStorage.setItem(
        "currentProjectCanvasIndex",
        String(activeCanvasIndex)
      );
      localStorage.removeItem("currentUnsavedSignId");
      try {
        if (typeof window !== "undefined") {
          window.__currentProjectCanvasId = activeCanvas.id;
          window.__currentProjectCanvasIndex = activeCanvasIndex;
        }
      } catch {}
    } else {
      localStorage.removeItem("currentCanvasId");
      localStorage.removeItem("currentProjectCanvasId");
      localStorage.removeItem("currentProjectCanvasIndex");
      try {
        if (typeof window !== "undefined") {
          window.__currentProjectCanvasId = null;
          window.__currentProjectCanvasIndex = null;
        }
      } catch {}
    }
  } catch {}
  // Delete unsaved signs that were directly embedded into canvases above
  if (includedUnsavedIds.length > 0) {
    try {
      await Promise.all(includedUnsavedIds.map((id) => deleteUnsavedSign(id)));
      broadcastUnsavedUpdate();
    } catch {}
  }
  // absorb any remaining unsaved signs (excluding current one and already included ones)
  try {
    const excludeSet = new Set([
      ...(currentUnsavedId ? [currentUnsavedId] : []),
      ...includedUnsavedIds,
    ]);
    await transferUnsavedSignsToProject(project.id, excludeSet);
  } catch {}
  return project;
}

export async function saveCurrentProject(canvas) {
  let currentId = null;
  try {
    currentId = localStorage.getItem("currentProjectId");
  } catch {}
  if (!currentId) {
    // No current project — fallback to save-as with default name
    const fallbackName = `Untitled ${new Date().toLocaleString()}`;
    return saveNewProject(fallbackName, canvas);
  }
  const existing = await getProject(currentId);
  if (!existing) {
    const fallbackName = `Untitled ${new Date().toLocaleString()}`;
    return saveNewProject(fallbackName, canvas);
  }

  // Отримуємо поточний ID незбереженого знаку
  let currentUnsavedId = null;
  try {
    currentUnsavedId = localStorage.getItem("currentUnsavedSignId");
  } catch {}

  // Визначаємо активне полотно, яке потрібно оновити
  let currentCanvasId = null;
  let currentProjectCanvasId = null;
  let currentProjectCanvasIndex = null;
  let runtimeProjectCanvasId = null;
  let runtimeProjectCanvasIndex = null;
  let pendingUnsavedCleanupId = null;
  try {
    if (typeof window !== "undefined") {
      runtimeProjectCanvasId = window.__currentProjectCanvasId || null;
      runtimeProjectCanvasIndex = window.__currentProjectCanvasIndex || null;
      pendingUnsavedCleanupId = window.__pendingUnsavedCleanupId || null;
    }
  } catch {}
  try {
    currentCanvasId = localStorage.getItem("currentCanvasId");
  } catch {}
  try {
    currentProjectCanvasId = localStorage.getItem("currentProjectCanvasId");
  } catch {}
  try {
    const storedIndex = localStorage.getItem("currentProjectCanvasIndex");
    if (storedIndex !== null && storedIndex !== undefined) {
      const parsed = Number(storedIndex);
      if (!Number.isNaN(parsed)) {
        currentProjectCanvasIndex = parsed;
      }
    }
  } catch {}
  const activeProjectCanvasId =
    runtimeProjectCanvasId || currentProjectCanvasId || null;
  const activeProjectCanvasIndex =
    typeof runtimeProjectCanvasIndex === "number" &&
    runtimeProjectCanvasIndex >= 0
      ? runtimeProjectCanvasIndex
      : currentProjectCanvasIndex;

  const targetCanvasId = activeProjectCanvasId || currentCanvasId || null;
  const hasStoredIndex =
    typeof activeProjectCanvasIndex === "number" &&
    activeProjectCanvasIndex >= 0;

  const toolbarState = window.getCurrentToolbarState?.() || {};
  const snap = await exportCanvas(canvas, toolbarState);
  const now = Date.now();
  const canvases = Array.isArray(existing.canvases)
    ? existing.canvases.slice(0, 10).map((canvasEntry) => ({ ...canvasEntry }))
    : [];

  if (snap) {
    if (canvases.length === 0) {
      const newCanvasId = targetCanvasId || uuid();
      canvases.push({ id: newCanvasId, ...snap });
      currentCanvasId = newCanvasId;
      try {
        localStorage.setItem("currentCanvasId", newCanvasId);
        localStorage.setItem("currentProjectCanvasId", newCanvasId);
        localStorage.setItem("currentProjectCanvasIndex", "0");
        localStorage.removeItem("currentUnsavedSignId");
      } catch {}
      try {
        if (typeof window !== "undefined") {
          window.__currentProjectCanvasId = newCanvasId;
          window.__currentProjectCanvasIndex = 0;
        }
      } catch {}
      console.log(
        "[projectStorage] saveCurrentProject: created first canvas entry",
        { newCanvasId }
      );
    } else {
      const isActiveUnsaved = Boolean(currentUnsavedId) && !targetCanvasId;
      let targetIndex = -1;

      if (!isActiveUnsaved && targetCanvasId) {
        targetIndex = canvases.findIndex((c) => c.id === targetCanvasId);
        console.log("[projectStorage] saveCurrentProject: lookup by id", {
          targetCanvasId,
          targetIndex,
          canvasesCount: canvases.length,
        });
      }

      if (
        !isActiveUnsaved &&
        targetIndex === -1 &&
        hasStoredIndex &&
        activeProjectCanvasIndex < canvases.length
      ) {
        targetIndex = activeProjectCanvasIndex;
        console.log(
          "[projectStorage] saveCurrentProject: fallback to stored index",
          {
            storedIndex: activeProjectCanvasIndex,
            canvasesCount: canvases.length,
          }
        );
      }

      if (!isActiveUnsaved && targetIndex !== -1) {
        const resolvedId = canvases[targetIndex].id;
        canvases[targetIndex] = { ...canvases[targetIndex], ...snap };
        currentCanvasId = resolvedId;
        try {
          localStorage.setItem("currentCanvasId", resolvedId);
          localStorage.setItem("currentProjectCanvasId", resolvedId);
          localStorage.setItem(
            "currentProjectCanvasIndex",
            String(targetIndex)
          );
        } catch {}
        try {
          if (typeof window !== "undefined") {
            window.__currentProjectCanvasId = resolvedId;
            window.__currentProjectCanvasIndex = targetIndex;
          }
        } catch {}
        console.log(
          "[projectStorage] saveCurrentProject: updated existing canvas",
          {
            targetIndex,
            resolvedId,
          }
        );
      } else {
        const newCanvasId = uuid();
        canvases.push({ id: newCanvasId, ...snap });
        currentCanvasId = newCanvasId;
        try {
          localStorage.setItem("currentCanvasId", newCanvasId);
          localStorage.setItem("currentProjectCanvasId", newCanvasId);
          localStorage.setItem(
            "currentProjectCanvasIndex",
            String(canvases.length - 1)
          );
          localStorage.removeItem("currentUnsavedSignId");
        } catch {}
        try {
          if (typeof window !== "undefined") {
            window.__currentProjectCanvasId = newCanvasId;
            window.__currentProjectCanvasIndex = canvases.length - 1;
          }
        } catch {}
        console.warn(
          "[projectStorage] saveCurrentProject: appended new canvas because no target found",
          {
            newCanvasId,
            canvasesCount: canvases.length,
            targetCanvasId,
            hasStoredIndex,
            storedIndex: currentProjectCanvasIndex,
            isActiveUnsaved,
          }
        );
      }
    }
  }
  const updated = { ...existing, canvases, updatedAt: now };
  await putProject(updated);
  try {
    const detail = {
      projectId: updated.id,
      activeCanvasId: (() => {
        try {
          return typeof window !== "undefined"
            ? window.__currentProjectCanvasId ||
                currentProjectCanvasId ||
                currentCanvasId ||
                null
            : currentProjectCanvasId || currentCanvasId || null;
        } catch {
          return currentProjectCanvasId || currentCanvasId || null;
        }
      })(),
      activeCanvasIndex: (() => {
        try {
          return typeof window !== "undefined"
            ? window.__currentProjectCanvasIndex ??
                currentProjectCanvasIndex ??
                null
            : currentProjectCanvasIndex ?? null;
        } catch {
          return currentProjectCanvasIndex ?? null;
        }
      })(),
    };
    window.dispatchEvent(
      new CustomEvent("project:canvasesUpdated", { detail })
    );
  } catch {}
  try {
    await transferUnsavedSignsToProject(updated.id, currentUnsavedId);
  } catch {}

  const unsavedToRemove = new Set();
  if (currentUnsavedId) unsavedToRemove.add(currentUnsavedId);
  if (
    pendingUnsavedCleanupId &&
    !unsavedToRemove.has(pendingUnsavedCleanupId)
  ) {
    unsavedToRemove.add(pendingUnsavedCleanupId);
  }

  if (unsavedToRemove.size) {
    try {
      await Promise.all(
        [...unsavedToRemove].map((id) => deleteUnsavedSign(id))
      );
      broadcastUnsavedUpdate();
    } catch (err) {
      console.warn("Failed to clean up unsaved signs after project save:", err);
    }

    try {
      if (typeof window !== "undefined") {
        if (unsavedToRemove.has(pendingUnsavedCleanupId)) {
          window.__pendingUnsavedCleanupId = null;
        }
      }
      if (unsavedToRemove.has(currentUnsavedId)) {
        try {
          localStorage.removeItem("currentUnsavedSignId");
        } catch {}
      }
    } catch {}
  }
  return updated;
}

export function formatDate(ts) {
  try {
    const d = new Date(ts);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd} - ${mm} - ${yyyy}`;
  } catch {
    return "";
  }
}

// --- Additional canvas management helpers ---

function broadcastProjectUpdate(projectId) {
  try {
    const detail = { projectId };
    try {
      if (typeof window !== "undefined") {
        detail.activeCanvasId = window.__currentProjectCanvasId ?? null;
        detail.activeCanvasIndex = window.__currentProjectCanvasIndex ?? null;
      }
    } catch {}
    window.dispatchEvent(
      new CustomEvent("project:canvasesUpdated", { detail })
    );
  } catch {}
}

// Transfer all unsaved signs into the specified project (append, max 10 total). Clears unsaved store.
// excludeId - ID незбереженого знаку, який не потрібно додавати (щоб уникнути дублювання поточного полотна)
export async function transferUnsavedSignsToProject(
  projectId,
  excludeIds = null
) {
  if (!projectId) return null;
  const unsaved = await getAllUnsavedSigns();
  if (!unsaved.length) return null;
  const project = await getProject(projectId);
  if (!project) return null;
  const existing = Array.isArray(project.canvases) ? project.canvases : [];

  const excludeSet = new Set();
  if (excludeIds instanceof Set) {
    excludeIds.forEach((id) => {
      if (id) excludeSet.add(id);
    });
  } else if (Array.isArray(excludeIds)) {
    excludeIds.forEach((id) => {
      if (id) excludeSet.add(id);
    });
  } else if (typeof excludeIds === "string" && excludeIds) {
    excludeSet.add(excludeIds);
  }

  console.log("[projectStorage] transferUnsavedSignsToProject", {
    projectId,
    unsavedCount: unsaved.length,
    excludeIds: Array.from(excludeSet),
  });
  // Append unsaved entries (mapping to project canvas schema by adding ids if missing)
  // Виключаємо поточний знак, щоб уникнути дублювання
  const transferredIds = [];
  for (const s of unsaved) {
    if (excludeSet.has(s.id)) continue; // Пропускаємо виключені знаки
    if (existing.length >= 10) break; // respect limit
    const newCanvasId = uuid();
    existing.push({
      id: newCanvasId,
      json: s.json,
      preview: s.preview,
      previewSvg: s.previewSvg,
      width: s.width,
      height: s.height,
      backgroundColor: s.backgroundColor,
      backgroundType: s.backgroundType,
      backgroundImage: s.backgroundImage,
      canvasType: s.canvasType,
      cornerRadius: s.cornerRadius,
      toolbarState: s.toolbarState,
      copiesCount: s.copiesCount,
      canvasMetadata: {
        ...(s.canvasMetadata || {}),
        sourceUnsavedId: s.id,
        migratedAt: Date.now(),
      },
    });
    transferredIds.push(s.id);
  }

  if (transferredIds.length) {
    project.canvases = existing;
    project.updatedAt = Date.now();
    await putProject(project);
    await Promise.all(transferredIds.map((id) => deleteUnsavedSign(id)));
    broadcastProjectUpdate(project.id);
    broadcastUnsavedUpdate();
  } else {
    // Якщо нічого не перенесено, все одно повідомляємо про оновлення списку незбережених знаків
    broadcastUnsavedUpdate();
  }
  return project;
}

// Transfer selected unsaved signs into the specified project (append, max 10 total).
// Unlike transferUnsavedSignsToProject, this ONLY migrates the provided ids.
export async function transferUnsavedSignsToProjectByIds(
  projectId,
  unsavedIds
) {
  if (!projectId) return null;
  if (!Array.isArray(unsavedIds) || unsavedIds.length === 0) return null;

  const include = new Set(unsavedIds.filter(Boolean));
  if (!include.size) return null;

  const unsaved = await getAllUnsavedSigns();
  if (!unsaved.length) return null;

  const project = await getProject(projectId);
  if (!project) return null;

  const existing = Array.isArray(project.canvases) ? project.canvases : [];

  const toTransfer = unsaved.filter((s) => s && include.has(s.id));
  if (!toTransfer.length) {
    return project;
  }

  const transferredIds = [];
  for (const s of toTransfer) {
    if (existing.length >= 10) break;
    const newCanvasId = uuid();
    existing.push({
      id: newCanvasId,
      json: s.json,
      preview: s.preview,
      previewSvg: s.previewSvg,
      width: s.width,
      height: s.height,
      backgroundColor: s.backgroundColor,
      backgroundType: s.backgroundType,
      backgroundImage: s.backgroundImage,
      canvasType: s.canvasType,
      cornerRadius: s.cornerRadius,
      toolbarState: s.toolbarState,
      copiesCount: s.copiesCount,
      canvasMetadata: {
        ...(s.canvasMetadata || {}),
        sourceUnsavedId: s.id,
        migratedAt: Date.now(),
      },
    });
    transferredIds.push(s.id);
  }

  if (transferredIds.length) {
    project.canvases = existing;
    project.updatedAt = Date.now();
    await putProject(project);
    await Promise.all(transferredIds.map((id) => deleteUnsavedSign(id)));
    broadcastProjectUpdate(project.id);
    broadcastUnsavedUpdate();
  } else {
    broadcastUnsavedUpdate();
  }

  return project;
}

// Update (replace) a specific canvas snapshot in the current project by its id
export async function updateCanvasInCurrentProject(canvasId, canvas) {
  if (!canvasId) return null;

  console.log(
    "Updating project canvas:",
    canvasId,
    "with",
    canvas.getObjects().length,
    "objects"
  );

  let currentId = null;
  try {
    currentId = localStorage.getItem("currentProjectId");
  } catch {}
  if (!currentId) {
    console.warn("No current project ID found");
    return null;
  }

  const project = await getProject(currentId);
  if (!project) {
    console.warn("Project not found:", currentId);
    return null;
  }

  try {
    const toolbarState = window.getCurrentToolbarState?.() || {};
    console.log("Capturing toolbar state for project canvas update");

    const snap = await exportCanvas(canvas, toolbarState);
    if (!snap) {
      console.error("Failed to export canvas for project canvas update");
      return null;
    }

    console.log(
      "Exported canvas snapshot with",
      snap.json?.objects?.length || 0,
      "objects"
    );

    const idx = (project.canvases || []).findIndex((c) => c.id === canvasId);
    if (idx === -1) {
      console.warn("Canvas not found in project:", canvasId);
      return null;
    }

    project.canvases[idx] = { ...project.canvases[idx], ...snap };
    project.updatedAt = Date.now();

    await putProject(project);
    console.log("Successfully updated project canvas:", canvasId);

    broadcastProjectUpdate(project.id);
    return project;
  } catch (error) {
    console.error("Error updating project canvas:", error);
    return null;
  }
}

// Append a new (blank or current state) canvas snapshot to current project (max 10)
export async function addCanvasSnapshotToCurrentProject(
  snapshot,
  { setAsCurrent = true } = {}
) {
  if (!snapshot) return null;
  let currentId = null;
  try {
    currentId = localStorage.getItem("currentProjectId");
  } catch {}
  if (!currentId) {
    // If no project exists yet, create a new one with this single canvas
    const now = Date.now();
    const project = {
      id: uuid(),
      name: `Untitled ${new Date(now).toLocaleString()}`,
      createdAt: now,
      updatedAt: now,
      canvases: [{ id: uuid(), ...snapshot }],
    };
    await putProject(project);
    broadcastProjectUpdate(project.id);
    try {
      localStorage.setItem("currentProjectId", project.id);
      localStorage.setItem("currentProjectName", project.name);
      if (setAsCurrent && project.canvases[0]) {
        localStorage.setItem("currentCanvasId", project.canvases[0].id);
        localStorage.setItem("currentProjectCanvasId", project.canvases[0].id);
        localStorage.setItem("currentProjectCanvasIndex", "0");
        localStorage.removeItem("currentUnsavedSignId");
        try {
          if (typeof window !== "undefined") {
            window.__currentProjectCanvasId = project.canvases[0].id;
            window.__currentProjectCanvasIndex = 0;
          }
        } catch {}
      }
    } catch {}
    return project;
  }
  const project = await getProject(currentId);
  if (!project) return null;
  project.canvases = Array.isArray(project.canvases) ? project.canvases : [];
  if (project.canvases.length >= 10) {
    return project; // max reached; silently ignore
  }
  const canvasEntry = { id: uuid(), ...snapshot };
  project.canvases.push(canvasEntry);
  project.updatedAt = Date.now();
  await putProject(project);
  broadcastProjectUpdate(project.id);
  if (setAsCurrent) {
    try {
      localStorage.setItem("currentCanvasId", canvasEntry.id);
      localStorage.setItem("currentProjectCanvasId", canvasEntry.id);
      localStorage.setItem(
        "currentProjectCanvasIndex",
        String(project.canvases.length - 1)
      );
      localStorage.removeItem("currentUnsavedSignId");
      try {
        if (typeof window !== "undefined") {
          window.__currentProjectCanvasId = canvasEntry.id;
          window.__currentProjectCanvasIndex = project.canvases.length - 1;
        }
      } catch {}
    } catch {}
  }
  return project;
}

// Delete a canvas by id from current project. If deleted was current, caller should decide what to load next.
export async function deleteCanvasFromCurrentProject(canvasId) {
  if (!canvasId) return null;
  let currentId = null;
  try {
    currentId = localStorage.getItem("currentProjectId");
  } catch {}
  if (!currentId) return null;
  const project = await getProject(currentId);
  if (!project) return null;
  const before = project.canvases || [];
  const filtered = before.filter((c) => c.id !== canvasId);
  if (filtered.length === before.length) return project; // nothing removed
  project.canvases = filtered;
  project.updatedAt = Date.now();
  await putProject(project);
  broadcastProjectUpdate(project.id);
  return project;
}

// Add canvases from selected projects to the current project
export async function addCanvasesFromProjectsToCurrentProject(projectIds) {
  if (!Array.isArray(projectIds) || projectIds.length === 0) return null;

  let currentId = null;
  try {
    currentId = localStorage.getItem("currentProjectId");
  } catch {}
  if (!currentId) {
    console.warn("No current project to add canvases to");
    return null;
  }

  const currentProject = await getProject(currentId);
  if (!currentProject) {
    console.warn("Current project not found:", currentId);
    return null;
  }

  currentProject.canvases = Array.isArray(currentProject.canvases)
    ? currentProject.canvases
    : [];

  let addedCount = 0;
  const MAX_CANVASES = 10;

  // Iterate through selected projects
  for (const projectId of projectIds) {
    if (projectId === currentId) {
      console.log("Skipping current project itself");
      continue; // Skip current project
    }

    if (currentProject.canvases.length >= MAX_CANVASES) {
      console.warn("Maximum canvas limit reached:", MAX_CANVASES);
      break;
    }

    try {
      const sourceProject = await getProject(projectId);
      if (!sourceProject || !Array.isArray(sourceProject.canvases)) {
        console.warn("Source project not found or has no canvases:", projectId);
        try {
          const unsavedToRemove = new Set();
          if (currentUnsavedId) unsavedToRemove.add(currentUnsavedId);
          if (
            pendingUnsavedCleanupId &&
            !unsavedToRemove.has(pendingUnsavedCleanupId)
          ) {
            unsavedToRemove.add(pendingUnsavedCleanupId);
          }

          if (unsavedToRemove.size) {
            console.log(
              "[projectStorage] saveCurrentProject: removing pending unsaved signs",
              {
                ids: Array.from(unsavedToRemove),
              }
            );
            try {
              await Promise.all(
                [...unsavedToRemove].map((id) => deleteUnsavedSign(id))
              );
              broadcastUnsavedUpdate();
            } catch (err) {
              console.warn(
                "Failed to clean up unsaved signs after project save:",
                err
              );
            }

            try {
              if (typeof window !== "undefined") {
                if (unsavedToRemove.has(pendingUnsavedCleanupId)) {
                  window.__pendingUnsavedCleanupId = null;
                }
              }
              if (unsavedToRemove.has(currentUnsavedId)) {
                try {
                  localStorage.removeItem("currentUnsavedSignId");
                } catch {}
              }
            } catch {}
          }
          await transferUnsavedSignsToProject(updated.id, unsavedToRemove);
        } catch {}
      }

      // Add canvases from source project
      for (const canvas of sourceProject.canvases) {
        if (currentProject.canvases.length >= MAX_CANVASES) {
          console.warn("Maximum canvas limit reached during transfer");
          break;
        }

        // Create a copy with new ID
        const canvasCopy = {
          ...canvas,
          id: uuid(), // Generate new ID to avoid conflicts
        };

        currentProject.canvases.push(canvasCopy);
        addedCount++;
      }
    } catch (error) {
      console.error("Error adding canvases from project:", projectId, error);
    }
  }

  if (addedCount > 0) {
    currentProject.updatedAt = Date.now();
    await putProject(currentProject);
    broadcastProjectUpdate(currentProject.id);
    console.log(`Successfully added ${addedCount} canvases to current project`);
  }

  return currentProject;
}
