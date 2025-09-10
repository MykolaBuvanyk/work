// Lightweight IndexedDB storage for projects and their canvases (JSON + preview)
// Store: projects (keyPath: id)

const DB_NAME = "card-editor";
const DB_VERSION = 1;
const STORE = "projects";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode = "readonly") {
  return db.transaction(STORE, mode).objectStore(STORE);
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
  return (crypto?.randomUUID?.() || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }))
    .toString();
}

// Serialize current Fabric canvas to JSON + preview image
export function exportCanvas(canvas) {
  if (!canvas) return null;
  try {
    // Include common custom props used across the app
    const extraProps = [
      "data",
      "shapeType",
      "isCutElement",
      "cutType",
      "fromIconMenu",
      "isCircle",
      "clipPath",
    ];
    let json;
    if (typeof canvas.toDatalessJSON === "function") {
      json = canvas.toDatalessJSON(extraProps);
    } else if (typeof canvas.toJSON === "function") {
      json = canvas.toJSON(extraProps);
    } else {
      json = {};
    }
    // Prefer design size (Fabric internal size equals design pixels in this app)
    const width = canvas.getWidth?.() || 0;
    const height = canvas.getHeight?.() || 0;
    const preview = canvas.toDataURL?.({ format: "png", multiplier: 0.5 }) || "";
    return { json, preview, width, height };
  } catch (e) {
    console.error("exportCanvas failed", e);
    return null;
  }
}

export async function saveNewProject(name, canvas) {
  const snap = exportCanvas(canvas);
  const now = Date.now();
  const project = {
    id: uuid(),
    name: name && String(name).trim() ? String(name).trim() : "Untitled",
    createdAt: now,
    updatedAt: now,
    canvases: snap ? [ { id: uuid(), ...snap } ] : [],
  };
  await putProject(project);
  try {
    localStorage.setItem("currentProjectId", project.id);
    localStorage.setItem("currentProjectName", project.name);
  } catch {}
  return project;
}

export async function saveCurrentProject(canvas) {
  let currentId = null;
  try { currentId = localStorage.getItem("currentProjectId"); } catch {}
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
  const snap = exportCanvas(canvas);
  const now = Date.now();
  const canvases = Array.isArray(existing.canvases) ? existing.canvases.slice(0, 10) : [];
  if (snap) {
    if (canvases.length === 0) {
      canvases.push({ id: uuid(), ...snap });
    } else {
      canvases[0] = { ...(canvases[0] || {}), ...snap };
    }
  }
  const updated = { ...existing, canvases, updatedAt: now };
  await putProject(updated);
  try { window.dispatchEvent(new CustomEvent("project:canvasesUpdated", { detail: { projectId: updated.id } })); } catch {}
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
    window.dispatchEvent(new CustomEvent("project:canvasesUpdated", { detail: { projectId } }));
  } catch {}
}

// Update (replace) a specific canvas snapshot in the current project by its id
export async function updateCanvasInCurrentProject(canvasId, canvas) {
  if (!canvasId) return null;
  let currentId = null;
  try { currentId = localStorage.getItem("currentProjectId"); } catch {}
  if (!currentId) return null;
  const project = await getProject(currentId);
  if (!project) return null;
  const snap = exportCanvas(canvas);
  if (!snap) return null;
  const idx = (project.canvases || []).findIndex(c => c.id === canvasId);
  if (idx === -1) return null;
  project.canvases[idx] = { ...project.canvases[idx], ...snap };
  project.updatedAt = Date.now();
  await putProject(project);
  broadcastProjectUpdate(project.id);
  return project;
}

// Append a new (blank or current state) canvas snapshot to current project (max 10)
export async function addCanvasSnapshotToCurrentProject(snapshot, { setAsCurrent = true } = {}) {
  if (!snapshot) return null;
  let currentId = null;
  try { currentId = localStorage.getItem("currentProjectId"); } catch {}
  if (!currentId) {
    // If no project exists yet, create a new one with this single canvas
    const now = Date.now();
    const project = {
      id: uuid(),
      name: `Untitled ${new Date(now).toLocaleString()}`,
      createdAt: now,
      updatedAt: now,
      canvases: [ { id: uuid(), ...snapshot } ],
    };
  await putProject(project);
  broadcastProjectUpdate(project.id);
    try { localStorage.setItem("currentProjectId", project.id); localStorage.setItem("currentProjectName", project.name); } catch {}
    if (setAsCurrent) try { localStorage.setItem("currentCanvasId", project.canvases[0].id); } catch {}
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
  if (setAsCurrent) try { localStorage.setItem("currentCanvasId", canvasEntry.id); } catch {}
  return project;
}

// Delete a canvas by id from current project. If deleted was current, caller should decide what to load next.
export async function deleteCanvasFromCurrentProject(canvasId) {
  if (!canvasId) return null;
  let currentId = null;
  try { currentId = localStorage.getItem("currentProjectId"); } catch {}
  if (!currentId) return null;
  const project = await getProject(currentId);
  if (!project) return null;
  const before = project.canvases || [];
  const filtered = before.filter(c => c.id !== canvasId);
  if (filtered.length === before.length) return project; // nothing removed
  project.canvases = filtered;
  project.updatedAt = Date.now();
  await putProject(project);
  broadcastProjectUpdate(project.id);
  return project;
}
