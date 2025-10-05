// Lightweight IndexedDB storage for projects and their canvases (JSON + preview)
// Store: projects (keyPath: id)

const DB_NAME = "card-editor";
const DB_VERSION = 2; // bumped to add unsavedSigns store
const STORE = "projects";
const UNSAVED_STORE = "unsavedSigns"; // temporary signs not yet attached to a project

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

function tx(db, mode = "readonly") { return db.transaction(STORE, mode).objectStore(STORE); }
function txUnsaved(db, mode = "readonly") { return db.transaction(UNSAVED_STORE, mode).objectStore(UNSAVED_STORE); }

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
  try { window.dispatchEvent(new CustomEvent("unsaved:signsUpdated")); } catch {}
}

export async function addUnsavedSignFromSnapshot(snapshot) {
  if (!snapshot) return null;
  const now = Date.now();
  const entry = { id: uuid(), ...snapshot, createdAt: now, updatedAt: now };
  await putUnsavedSign(entry);
  broadcastUnsavedUpdate();
  return entry;
}

export async function addBlankUnsavedSign(width = 0, height = 0) {
  const entry = { id: uuid(), json: { objects: [], version: "fabric" }, preview: "", width, height, createdAt: Date.now(), updatedAt: Date.now() };
  await putUnsavedSign(entry);
  broadcastUnsavedUpdate();
  return entry;
}

export async function updateUnsavedSignFromCanvas(id, canvas) {
  if (!id || !canvas) return null;
  
  console.log('Updating unsaved sign:', id, 'with', canvas.getObjects().length, 'objects');
  
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = txUnsaved(db, "readwrite");
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) { 
        console.warn('Unsaved sign not found for update:', id);
        resolve(null); 
        return; 
      }
      
      try {
        // ВИПРАВЛЕННЯ: Отримуємо актуальний toolbar state з кількох джерел
        let toolbarState = {};
        
        // Спочатку намагаємося отримати з window функції
        if (window.getCurrentToolbarState) {
          toolbarState = window.getCurrentToolbarState() || {};
          console.log('Got toolbar state from window function');
        }
        
        // Додатково намагаємося отримати з canvas properties
        // ВИПРАВЛЕННЯ: Обробка Pattern для текстур
        let bgColor = canvas.backgroundColor || canvas.get("backgroundColor") || "#FFFFFF";
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
          backgroundColor: bgColor,
          backgroundType: bgType,
          width: canvas.getWidth(),
          height: canvas.getHeight()
        };
        
        // Мержимо всі джерела
        toolbarState = { ...toolbarState, ...canvasState };
        
        console.log('Final toolbar state for unsaved sign update:', toolbarState);
        
        const snap = exportCanvas(canvas, toolbarState);
        if (!snap) { 
          console.error('Failed to export canvas for unsaved sign update');
          resolve(null); 
          return; 
        }
        
        console.log('Exported canvas snapshot with', snap.json?.objects?.length || 0, 'objects');
        
        const updated = { ...existing, ...snap, updatedAt: Date.now() };
        const putReq = store.put(updated);
        putReq.onsuccess = () => { 
          console.log('Successfully updated unsaved sign:', id);
          broadcastUnsavedUpdate(); 
          resolve(updated); 
        };
        putReq.onerror = () => {
          console.error('Failed to save updated unsaved sign:', putReq.error);
          reject(putReq.error);
        };
      } catch (error) {
        console.error('Error updating unsaved sign:', error);
        reject(error);
      }
    };
    getReq.onerror = () => {
      console.error('Error fetching unsaved sign for update:', getReq.error);
      reject(getReq.error);
    };
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

// Serialize current Fabric canvas to JSON + preview image + toolbar state
export function exportCanvas(canvas, toolbarState = {}) {
  if (!canvas) return null;
  try {
    // Include ALL custom props used across the app to preserve element-specific data
    const extraProps = [
      // Basic element metadata
      "data","shapeType","isCutElement","cutType","fromIconMenu","isCircle","clipPath",
      
      // Shape-specific properties
      "baseCornerRadius","displayCornerRadiusMm","cornerRadiusMm",
      
      // Stroke and visual properties
      "strokeUniform","borderColor","borderScaleFactor","innerStrokeWidth",
      
      // Border element properties
      "isBorderShape","isRectangleInnerBorder",
      
      // QR Code properties
      "isQRCode","qrText","qrSize",
      
      // Barcode properties  
      "isBarCode","barCodeText","barCodeType",
      
      // Image properties
      "originalSrc","imageSource","filters",
      
      // Text properties (already covered by Fabric, but ensuring custom text data)
      "customTextData","fontFamily","fontSize","fontWeight","fontStyle",
      
      // Element identification and grouping
      "id","name","layerId","groupId","customData",
      
      // Interaction & lock flags (so constraints persist after reload)
      "selectable","evented","hasControls","hasBorders",
      "lockMovementX","lockMovementY","lockScalingX","lockScalingY",
      "lockRotation","lockSkewingX","lockSkewingY",
      
      // Visual interaction properties
      "perPixelTargetFind","hoverCursor","moveCursor",
      "transparentCorners","cornerColor","cornerStrokeColor",
      "cornerStyle","cornerSize",
      
      // Exclusion properties
      "excludeFromExport",
      
      // Custom hole properties
      "holeType","holeDiameter","holePosition",
      
      // Animation and state properties
      "animatable","visible","opacity","shadow",
      
      // Custom geometric properties for complex shapes
      "customPath","originalGeometry","transformMatrix",
      
      // Element creation context
      "createdAt","createdBy","elementVersion","toolbarSnapshot"
    ];
    
    let json;
    if (typeof canvas.toDatalessJSON === "function") {
      json = canvas.toDatalessJSON(extraProps);
    } else if (typeof canvas.toJSON === "function") {
      json = canvas.toJSON(extraProps);
    } else {
      json = {};
    }
    
    // Check if canvas has border elements before filtering
    const borderElements = canvas.getObjects().filter(obj => obj.isBorderShape);
    const hasBorder = borderElements.length > 0;
    
    console.log('Canvas export - found border elements:', borderElements.length);
    console.log('Canvas export - hasBorder flag:', hasBorder);
    console.log('Canvas export - toolbar state hasBorder:', toolbarState.hasBorder);
    console.log('Canvas export - final hasBorder:', hasBorder || toolbarState.hasBorder || false);
    
    // Filter out border elements from JSON to avoid serialization issues
    if (json && json.objects && Array.isArray(json.objects)) {
      const originalCount = json.objects.length;
      json.objects = json.objects.filter(obj => !obj.isBorderShape);
      console.log('Filtered out border objects:', originalCount - json.objects.length);
    }

    // Enhance JSON with additional element-specific metadata
    if (json && json.objects && Array.isArray(json.objects)) {
      json.objects = json.objects.map(obj => {
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
    
    // ВИПРАВЛЕННЯ: Генеруємо SVG preview замість PNG для кращої якості та розміру
    let previewSvg = "";
    let previewPng = "";
    
    try {
      // Генеруємо SVG preview для відображення в UI
      if (canvas.toSVG) {
        const rawSvg = canvas.toSVG({
          viewBox: {
            x: 0,
            y: 0,
            width: width,
            height: height
          },
          width: width,
          height: height
        });
        
        // ВИПРАВЛЕННЯ: Очищаємо SVG від потенційно проблемних символів
        previewSvg = rawSvg
          .replace(/[\x00-\x1F\x7F]/g, '') // Видаляємо control characters
          .replace(/[\uFFFE\uFFFF]/g, ''); // Видаляємо non-characters
        
        console.log('Generated SVG preview, length:', previewSvg.length);
      }
      
      // Також генеруємо PNG як fallback
      if (canvas.toDataURL) {
        previewPng = canvas.toDataURL({ format: "png", multiplier: 0.5 });
        console.log('Generated PNG preview as fallback');
      }
    } catch (error) {
      console.error('Failed to generate preview:', error);
      // Якщо SVG генерація не вдалася, спробуємо хоча б PNG
      try {
        if (canvas.toDataURL) {
          previewPng = canvas.toDataURL({ format: "png", multiplier: 0.5 });
          console.log('Generated PNG preview as backup after SVG error');
        }
      } catch (pngError) {
        console.error('Failed to generate PNG preview as backup:', pngError);
      }
    }
    
    // Store comprehensive toolbar state for each canvas
    // ВИПРАВЛЕННЯ: Обробка Pattern для текстур
    let bgColor = canvas.backgroundColor || canvas.get("backgroundColor") || "#FFFFFF";
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
      json,
      preview: previewPng, // Зберігаємо PNG як fallback
      previewSvg: previewSvg, // НОВИЙ: SVG preview для UI
      width,
      height,
      // ВИПРАВЛЕННЯ: Покращене збереження canvas properties
      backgroundColor: bgColor,
      backgroundType: bgType,
      canvasType: canvas.get("shapeType") || "rectangle",
      cornerRadius: canvas.get("cornerRadius") || 0,
      
      // ВИПРАВЛЕННЯ: Зберігаємо повний toolbar state з canvas properties
      toolbarState: {
        ...toolbarState,
        // Оновлюємо розміри в toolbar state
        sizeValues: {
          width: Math.round((width || 150) * 25.4 / 96), // px to mm
          height: Math.round((height || 150) * 25.4 / 96), // px to mm
          cornerRadius: toolbarState.cornerRadius || 0
        },
        // Оновлюємо background color
        globalColors: {
          ...(toolbarState.globalColors || {}),
          backgroundColor: bgColor,
          backgroundType: bgType
        },
        // Зберігаємо border flag з множинних джерел
        hasBorder: hasBorder || toolbarState.hasBorder || false,
        // Зберігаємо copies count
        copiesCount: Number(toolbarState.copiesCount) || 1,
        // Зберігаємо timestamp
        lastSaved: Date.now()
      },
      
      // Зберігаємо copies count на верхньому рівні для зручного доступу
      copiesCount: Number(toolbarState.copiesCount) || 1,
      
      // ВИПРАВЛЕННЯ: Додаткові метадані для відстеження
      canvasMetadata: {
        objectCount: canvas.getObjects().length,
        hasBorderElements: hasBorder,
        lastModified: Date.now(),
        version: "2.0"
      }
    };
    
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
  
  return {
    currentShapeType: savedState.currentShapeType || "rectangle",
    cornerRadius: savedState.cornerRadius || 0,
    sizeValues: savedState.sizeValues || { 
      width: canvasData.width ? Math.round(canvasData.width * 25.4 / 96) : 150, 
      height: canvasData.height ? Math.round(canvasData.height * 25.4 / 96) : 150, 
      cornerRadius: savedState.cornerRadius || 0 
    },
    globalColors: savedState.globalColors || {
      textColor: "#000000",
      backgroundColor: canvasData.backgroundColor || "#FFFFFF",
      strokeColor: "#000000",
      fillColor: "transparent",
      backgroundType: canvasData.backgroundType || "solid"
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
    hasBorder: savedState.hasBorder || false
  };
}

// Helper function to get default toolbar state
function getDefaultToolbarState() {
  return {
    currentShapeType: "rectangle",
    cornerRadius: 0,
    sizeValues: { width: 150, height: 150, cornerRadius: 0 },
    globalColors: {
      textColor: "#000000",
      backgroundColor: "#FFFFFF",
      strokeColor: "#000000", 
      fillColor: "transparent",
      backgroundType: "solid"
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
    hasBorder: false
  };
}

// Helper function to restore element-specific properties after canvas load
export function restoreElementProperties(canvas, toolbarState = null) {
  if (!canvas || !canvas.getObjects) return;
  
  try {
    // Ensure inner stroke classes are available before restoring elements
    if (window.ensureInnerStrokeClasses) {
      window.ensureInnerStrokeClasses();
    }
    
    const objects = canvas.getObjects();
    
    objects.forEach(obj => {
      // Restore QR Code functionality
      if (obj.isQRCode && obj.qrText) {
        // Ensure QR code can be regenerated
        obj.set({
          isQRCode: true,
          qrText: obj.qrText,
          qrSize: obj.qrSize || 100
        });
      }
      
      // Restore Barcode functionality
      if (obj.isBarCode && obj.barCodeText && obj.barCodeType) {
        obj.set({
          isBarCode: true,
          barCodeText: obj.barCodeText,
          barCodeType: obj.barCodeType
        });
      }
      
      // Restore cut element properties
      if (obj.isCutElement) {
        obj.set({
          isCutElement: true,
          cutType: obj.cutType || "hole"
        });
      }
      
      // Restore shape properties
      if (obj.shapeType) {
        obj.set({
          shapeType: obj.shapeType
        });
      }
      
      // Restore corner radius properties
      if (obj.cornerRadiusMm !== undefined) {
        obj.set({
          cornerRadiusMm: obj.cornerRadiusMm,
          baseCornerRadius: obj.baseCornerRadius,
          displayCornerRadiusMm: obj.displayCornerRadiusMm
        });
      }
      
      // Restore stroke properties
      if (obj.strokeUniform !== undefined) {
        obj.set({
          strokeUniform: obj.strokeUniform
        });
      }
      
      // Restore inner stroke properties for border elements
      if (obj.innerStrokeWidth !== undefined) {
        obj.set({
          innerStrokeWidth: obj.innerStrokeWidth
        });
      }
      
      // Restore border element properties
      if (obj.isBorderShape) {
        obj.set({
          isBorderShape: true,
          isRectangleInnerBorder: obj.isRectangleInnerBorder || false
        });
      }
      
      // Restore image properties
      if (obj.type === 'image' && obj.originalSrc) {
        obj.set({
          originalSrc: obj.originalSrc
        });
      }
      
      // Restore icon menu properties
      if (obj.fromIconMenu) {
        obj.set({
          fromIconMenu: true
        });
      }
      
      // Restore custom data
      if (obj.customData) {
        obj.set({
          customData: obj.customData
        });
      }
      
      // Restore identification properties
      if (obj.layerId || obj.groupId) {
        obj.set({
          layerId: obj.layerId,
          groupId: obj.groupId
        });
      }
    });
    
    canvas.renderAll();
    
    // Programmatic border recreation if needed
    if (toolbarState && toolbarState.hasBorder) {
      console.log('Border recreation needed - hasBorder:', true);
      console.log('Toolbar state for border recreation:', {
        hasBorder: toolbarState.hasBorder,
        thickness: toolbarState.thickness,
        globalColors: toolbarState.globalColors,
        currentShapeType: toolbarState.currentShapeType
      });
      
      if (window.recreateBorder) {
        console.log('Calling window.recreateBorder() with saved toolbarState');
        // Use timeout to ensure canvas is fully rendered before adding border
        setTimeout(() => {
          try {
            window.recreateBorder(toolbarState);
            console.log('Border recreation completed successfully');
          } catch (error) {
            console.error("Failed to recreate border:", error);
          }
        }, 200);
      } else {
        console.error('window.recreateBorder function not available');
      }
    } else {
      console.log('Border recreation skipped:', {
        hasToolbarState: !!toolbarState,
        hasBorder: toolbarState?.hasBorder,
        hasRecreateBorderFunction: !!window.recreateBorder
      });
    }
    
  } catch (e) {
    console.error("Failed to restore element properties:", e);
  }
}

export async function saveNewProject(name, canvas) {
  const toolbarState = window.getCurrentToolbarState?.() || {};
  const snap = exportCanvas(canvas, toolbarState);
  const now = Date.now();
  
  // Отримуємо поточний ID незбереженого знаку
  let currentUnsavedId = null;
  try { currentUnsavedId = localStorage.getItem("currentUnsavedSignId"); } catch {}
  
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
  // absorb unsaved signs if any (excluding current one to avoid duplication)
  try { await transferUnsavedSignsToProject(project.id, currentUnsavedId); } catch {}
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
  
  // Отримуємо поточний ID незбереженого знаку
  let currentUnsavedId = null;
  try { currentUnsavedId = localStorage.getItem("currentUnsavedSignId"); } catch {}
  
  const toolbarState = window.getCurrentToolbarState?.() || {};
  const snap = exportCanvas(canvas, toolbarState);
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
  try { await transferUnsavedSignsToProject(updated.id, currentUnsavedId); } catch {}
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

// Transfer all unsaved signs into the specified project (append, max 10 total). Clears unsaved store.
// excludeId - ID незбереженого знаку, який не потрібно додавати (щоб уникнути дублювання поточного полотна)
export async function transferUnsavedSignsToProject(projectId, excludeId = null) {
  if (!projectId) return null;
  const unsaved = await getAllUnsavedSigns();
  if (!unsaved.length) return null;
  const project = await getProject(projectId);
  if (!project) return null;
  const existing = Array.isArray(project.canvases) ? project.canvases : [];
  // Append unsaved entries (mapping to project canvas schema by adding ids if missing)
  // Виключаємо поточний знак, щоб уникнути дублювання
  for (const s of unsaved) {
    if (s.id === excludeId) continue; // Пропускаємо поточний знак
    if (existing.length >= 10) break; // respect limit
    existing.push({ id: uuid(), json: s.json, preview: s.preview, width: s.width, height: s.height });
  }
  project.canvases = existing;
  project.updatedAt = Date.now();
  await putProject(project);
  await clearAllUnsavedSigns();
  broadcastProjectUpdate(project.id);
  broadcastUnsavedUpdate();
  return project;
}

// Update (replace) a specific canvas snapshot in the current project by its id
export async function updateCanvasInCurrentProject(canvasId, canvas) {
  if (!canvasId) return null;
  
  console.log('Updating project canvas:', canvasId, 'with', canvas.getObjects().length, 'objects');
  
  let currentId = null;
  try { currentId = localStorage.getItem("currentProjectId"); } catch {}
  if (!currentId) {
    console.warn('No current project ID found');
    return null;
  }
  
  const project = await getProject(currentId);
  if (!project) {
    console.warn('Project not found:', currentId);
    return null;
  }
  
  try {
    const toolbarState = window.getCurrentToolbarState?.() || {};
    console.log('Capturing toolbar state for project canvas update');
    
    const snap = exportCanvas(canvas, toolbarState);
    if (!snap) {
      console.error('Failed to export canvas for project canvas update');
      return null;
    }
    
    console.log('Exported canvas snapshot with', snap.json?.objects?.length || 0, 'objects');
    
    const idx = (project.canvases || []).findIndex(c => c.id === canvasId);
    if (idx === -1) {
      console.warn('Canvas not found in project:', canvasId);
      return null;
    }
    
    project.canvases[idx] = { ...project.canvases[idx], ...snap };
    project.updatedAt = Date.now();
    
    await putProject(project);
    console.log('Successfully updated project canvas:', canvasId);
    
    broadcastProjectUpdate(project.id);
    return project;
  } catch (error) {
    console.error('Error updating project canvas:', error);
    return null;
  }
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
