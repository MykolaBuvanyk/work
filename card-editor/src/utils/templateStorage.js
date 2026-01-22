import { exportCanvas, uuid } from "./projectStorage";

const DB_NAME = "card-editor-templates";
const DB_VERSION = 1;
const STORE = "templates";

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        try {
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        } catch {}
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(db, mode = "readonly") {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function putTemplate(template) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "readwrite");
    const req = store.put(template);
    req.onsuccess = () => resolve(template);
    req.onerror = () => reject(req.error);
  }).finally(() => {
    try {
      db.close();
    } catch {}
  });
}

export async function getAllTemplates() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "readonly");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }).finally(() => {
    try {
      db.close();
    } catch {}
  });
}

export async function getTemplateById(id) {
  if (!id) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "readonly");
    const req = store.get(String(id));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }).finally(() => {
    try {
      db.close();
    } catch {}
  });
}

export async function deleteTemplate(id) {
  if (!id) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, "readwrite");
    const req = store.delete(String(id));
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  }).finally(() => {
    try {
      db.close();
    } catch {}
  });
}

export async function renameTemplate(id, name) {
  const trimmed = String(name || "").trim();
  if (!id) throw new Error("Template id is required");
  if (!trimmed) throw new Error("Template name is required");

  const existing = await getTemplateById(id);
  if (!existing) throw new Error("Template not found");

  const updated = {
    ...existing,
    name: trimmed,
    updatedAt: Date.now(),
  };
  await putTemplate(updated);
  return updated;
}

export async function saveTemplateSnapshot(name, snapshot) {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new Error("Template name is required");
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Canvas snapshot is required");
  }

  const now = Date.now();
  const template = {
    id: uuid(),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
    canvas: snapshot,
  };

  return putTemplate(template);
}

export async function saveNewTemplate(name, canvas) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    throw new Error("Template name is required");
  }
  if (!canvas) {
    throw new Error("Canvas is not available");
  }

  const toolbarState =
    typeof window !== "undefined" && window.getCurrentToolbarState
      ? window.getCurrentToolbarState() || {}
      : {};

  const snapshot = await exportCanvas(canvas, toolbarState, {
    keepClipPath: true,
  });

  if (!snapshot) {
    throw new Error("Failed to export canvas");
  }

  const now = Date.now();
  const template = {
    id: uuid(),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
    canvas: snapshot,
  };

  return putTemplate(template);
}
