import React, { useEffect, useMemo, useState, useRef } from "react";
import styles from "./ProjectCanvasesGrid.module.css";
import { getProject, getAllUnsavedSigns, updateUnsavedSignFromCanvas, extractToolbarState, restoreElementProperties, addBlankUnsavedSign, updateCanvasInCurrentProject } from "../../utils/projectStorage";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useFabricCanvas } from "../../hooks/useFabricCanvas";

// Renders 4x2 grid of canvases for the current project (from localStorage currentProjectId)
// Pagination similar to YourProjectsModal: ranges of 8 (1–8, 9–16, ...)
const PAGE_SIZE = 8;
const DEFAULT_DESIGN_SIZE = { width: 1200, height: 800 };

const mapEntryToDesign = (entry) => {
  if (!entry) return null;

  const jsonTemplate = entry.jsonTemplate || entry.json || null;
  const widthFromJson = jsonTemplate?.width;
  const heightFromJson = jsonTemplate?.height;

  return {
    id: entry.id,
    name: entry.name,
    width: entry.width || widthFromJson || DEFAULT_DESIGN_SIZE.width,
    height: entry.height || heightFromJson || DEFAULT_DESIGN_SIZE.height,
    jsonTemplate,
    backgroundColor: entry.backgroundColor,
    toolbarState: entry.toolbarState || null,
    meta: {
      isUnsaved: !!entry._unsaved,
      sourceType: entry._unsaved ? "unsaved" : "project",
    },
  };
};

const ProjectCanvasesGrid = () => {
  const { setDesigns: setContextDesigns } = useCanvasContext();
  const { canvas, loadDesign, selectDesign } = useFabricCanvas();
  const [project, setProject] = useState(null);
  const [unsavedSigns, setUnsavedSigns] = useState([]); // persisted unsaved signs from dedicated store
  const updateDebounceRef = useRef();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const currentUnsavedIdRef = useRef(null); // track which unsaved sign is currently loaded
  const currentProjectCanvasIdRef = useRef(null); // track which project canvas is currently loaded
  const createdInitialRef = useRef(false); // guard to avoid duplicate initial creation
  const initialCanvasLoadRef = useRef(false);
  const openCanvasRef = useRef(null);
  console.log('ProjectCanvasesGrid: Component initialized, createdInitialRef:', createdInitialRef.current);
  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  const [isUnsavedLoaded, setIsUnsavedLoaded] = useState(false);
  // ВИДАЛЕНО: livePreview state - тепер використовуємо тільки збережені preview

  useEffect(() => {
    const load = () => {
      let id = null;
      try { id = localStorage.getItem("currentProjectId"); } catch {}
      if (!id) { setProject({ id: null, canvases: [] }); setIsProjectLoaded(true); return; }
  getProject(id).then((p)=>{ setProject(p || { id, canvases: [] }); setIsProjectLoaded(true); }).catch(() => { setProject({ id, canvases: [] }); setIsProjectLoaded(true); });
    };
    const loadUnsaved = () => { 
      getAllUnsavedSigns().then(list => {
        const mapped = list.map(s => ({ ...s, _unsaved: true }));
        setUnsavedSigns(mapped);
        setIsUnsavedLoaded(true);
        // Maintain selection of current unsaved after refresh
        try {
          const active = localStorage.getItem("currentUnsavedSignId");
          if (active) {
            const exists = mapped.find(x => x.id === active);
            if (exists) {
              setSelectedId(active);
            }
          }
        } catch {}
      }).catch(()=> { setUnsavedSigns([]); setIsUnsavedLoaded(true); }); 
    };
    loadUnsaved();
    load();
    const updated = (e) => {
      const pid = e?.detail?.projectId;
      const currentId = (()=>{ try { return localStorage.getItem("currentProjectId"); } catch { return null; } })();
      if (!pid || pid === currentId) load();
    };
    const switched = () => load();
    const reset = () => load();
    const unsavedUpdated = () => loadUnsaved();
    window.addEventListener("project:canvasesUpdated", updated);
    window.addEventListener("project:switched", switched);
    window.addEventListener("project:reset", reset);
    window.addEventListener("unsaved:signsUpdated", unsavedUpdated);
    
    // Listen for toolbar/canvas property changes
    const handleToolbarChange = () => {
      if (!canvas) return;
      const activeUnsaved = currentUnsavedIdRef.current;
      const activeProjectCanvas = currentProjectCanvasIdRef.current;
      
      if (activeUnsaved || activeProjectCanvas) {
        console.log('Toolbar change detected, triggering auto-save with preview update');
        
        // ВИПРАВЛЕННЯ: Замість live preview, одразу тригеримо auto-save з новим preview
        if (updateDebounceRef.current) {
          clearTimeout(updateDebounceRef.current);
        }
        
        updateDebounceRef.current = setTimeout(async () => {
          try {
            if (activeUnsaved) {
              await updateUnsavedSignFromCanvas(activeUnsaved, canvas);
              console.log('Auto-saved with new preview for unsaved sign');
              
              // Оновлюємо локальний state з новим preview
              const newPreview = canvas.toDataURL?.({ format: "png", multiplier: 0.5 }) || "";
              const newPreviewSvg = canvas.toSVG?.() || "";
              
              setUnsavedSigns(prev => prev.map(sign => 
                sign.id === activeUnsaved 
                  ? { 
                      ...sign, 
                      preview: newPreview,
                      previewSvg: newPreviewSvg
                    }
                  : sign
              ));
              
            } else if (activeProjectCanvas) {
              await updateCanvasInCurrentProject(activeProjectCanvas, canvas);
              console.log('Auto-saved with new preview for project canvas');
              
              // Оновлюємо локальний project state з новим preview
              const newPreview = canvas.toDataURL?.({ format: "png", multiplier: 0.5 }) || "";
              const newPreviewSvg = canvas.toSVG?.() || "";
              
              setProject(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  canvases: prev.canvases?.map(canv => 
                    canv.id === activeProjectCanvas 
                      ? { 
                          ...canv, 
                          preview: newPreview,
                          previewSvg: newPreviewSvg
                        }
                      : canv
                  ) || []
                };
              });
            }
          } catch (error) {
            console.error('Auto-save failed after toolbar change:', error);
          }
        }, 1000); // Debounce для уникнення занадто частих updates
      }
    };
    
    // Listen for various canvas/toolbar change events
    window.addEventListener('canvas:propertyChanged', handleToolbarChange);
    window.addEventListener('toolbar:changed', handleToolbarChange);
    window.addEventListener('canvas:backgroundChanged', handleToolbarChange);
    window.addEventListener('canvas:dimensionsChanged', handleToolbarChange);
    window.addEventListener('canvas:shapeChanged', handleToolbarChange);
    
    // Save current canvas when component unmounts or page unloads
    const handleBeforeUnload = async () => {
      if (!canvas) return;
      const currentUnsavedId = currentUnsavedIdRef.current;
      const currentProjectCanvasId = currentProjectCanvasIdRef.current;
      
      try {
        if (currentUnsavedId) {
          await updateUnsavedSignFromCanvas(currentUnsavedId, canvas);
        } else if (currentProjectCanvasId) {
          await updateCanvasInCurrentProject(currentProjectCanvasId, canvas);
        }
      } catch (e) {
        console.error('Failed to save before unload:', e);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener("project:canvasesUpdated", updated);
      window.removeEventListener("project:switched", switched);
      window.removeEventListener("project:reset", reset);
      window.removeEventListener("unsaved:signsUpdated", unsavedUpdated);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('canvas:propertyChanged', handleToolbarChange);
      window.removeEventListener('toolbar:changed', handleToolbarChange);
      window.removeEventListener('canvas:backgroundChanged', handleToolbarChange);
      window.removeEventListener('canvas:dimensionsChanged', handleToolbarChange);
      window.removeEventListener('canvas:shapeChanged', handleToolbarChange);
      
      // Save current state when component unmounts
      handleBeforeUnload();
    };
  }, [canvas]);

  // Create an initial blank unsaved sign on first load if nothing exists
  useEffect(() => {
    if (!canvas) {
      console.log('Auto-create check: no canvas yet');
      return;
    }
    if (createdInitialRef.current) {
      console.log('Auto-create check: already created initial canvas');
      return;
    }
    if (!isProjectLoaded || !isUnsavedLoaded) {
      console.log('Auto-create check: waiting for data load', { isProjectLoaded, isUnsavedLoaded });
      return;
    }
    
    const projectCanvasCount = (project?.canvases?.length || 0);
    const unsavedSignsCount = (unsavedSigns?.length || 0);
    const hasAny = projectCanvasCount > 0 || unsavedSignsCount > 0;
    
    // ВИПРАВЛЕННЯ: Додаємо перевірку localStorage для існуючих активних canvas
    let hasActiveCanvas = false;
    try {
      const currentUnsavedId = localStorage.getItem("currentUnsavedSignId");
      const currentCanvasId = localStorage.getItem("currentCanvasId");
      hasActiveCanvas = !!(currentUnsavedId || currentCanvasId);
    } catch (e) {
      console.warn('Failed to check localStorage for active canvas:', e);
    }
    
    console.log('Auto-create check:', {
      projectCanvasCount,
      unsavedSignsCount,
      hasAny,
      hasActiveCanvas,
      createdInitialRef: createdInitialRef.current
    });
    
    // ВИПРАВЛЕННЯ: Не створюємо нове полотно якщо є будь-які існуючі або активні
    if (hasAny || hasActiveCanvas) {
      console.log('Auto-create check: canvases already exist or active canvas found, not creating new one');
      // Встановлюємо флаг, щоб уникнути повторних перевірок
      createdInitialRef.current = true;
      return;
    }

    console.log('Auto-create: Creating initial blank canvas');
    // Розміри прямокутника за замовчуванням (120x80 мм при 96 DPI)
    const PX_PER_MM = 96 / 25.4;
    const width = Math.round(120 * PX_PER_MM);  // ~453 px
    const height = Math.round(80 * PX_PER_MM);  // ~302 px
    createdInitialRef.current = true;
    
    (async () => {
      try {
        const entry = await addBlankUnsavedSign(width, height);
        const unsavedEntry = { ...entry, _unsaved: true };
        // Optimistically update local state so it shows immediately
        setUnsavedSigns((prev) => [unsavedEntry, ...prev]);
        try { localStorage.setItem("currentUnsavedSignId", unsavedEntry.id); } catch {}
        setSelectedId(unsavedEntry.id);
        // Load it into the working canvas right away
        await openCanvas(unsavedEntry);
        console.log('Auto-create: Successfully created and opened initial canvas');
      } catch (e) {
        console.error("Failed to create initial unsaved sign", e);
        createdInitialRef.current = false; // Reset on error
      }
    })();
  }, [canvas, isProjectLoaded, isUnsavedLoaded, project, unsavedSigns]);

  // Simple canvas list: unsaved signs -> project canvases
  const storedCanvases = project?.canvases || [];
  const canvases = [...unsavedSigns, ...storedCanvases];
  const designPayloads = useMemo(
    () => canvases.map(mapEntryToDesign).filter(Boolean),
    [canvases]
  );

  useEffect(() => {
    if (typeof setContextDesigns !== "function") return;

    setContextDesigns((prev) => {
      const prevArray = Array.isArray(prev) ? prev : [];
      if (prevArray.length === designPayloads.length) {
        const identical = prevArray.every(
          (design, index) => design?.id === designPayloads[index]?.id
        );
        if (identical) {
          return prevArray;
        }
      }

      return designPayloads;
    });
  }, [designPayloads, setContextDesigns]);
  const totalPages = Math.max(1, Math.ceil(canvases.length / PAGE_SIZE));

  const ranges = useMemo(() => {
    const arr = [];
    for (let i = 0; i < totalPages; i++) {
      const start = i * PAGE_SIZE + 1;
      const end = Math.min((i + 1) * PAGE_SIZE, canvases.length);
      arr.push({ page: i + 1, start, end });
    }
    return arr;
  }, [totalPages, canvases.length]);

  const startIndex = (page - 1) * PAGE_SIZE;
  const current = canvases.slice(startIndex, startIndex + PAGE_SIZE);

  const PX_PER_MM = 96 / 25.4;
  const pxToMm = (px) => {
    const mm = (Number(px) || 0) / PX_PER_MM;
    return Math.round(mm);
  };

  const openCanvas = async (canvasEntry) => {
    if (!canvasEntry || !canvas) return;
    
    // Check if this canvas is already active - don't reload it
    const currentUnsavedId = currentUnsavedIdRef.current;
    const currentProjectCanvasId = currentProjectCanvasIdRef.current;
    
    const isAlreadyActive = (
      (canvasEntry._unsaved && currentUnsavedId === canvasEntry.id) ||
      (!canvasEntry._unsaved && currentProjectCanvasId === canvasEntry.id)
    );
    
    if (isAlreadyActive) {
      console.log('Canvas already active, skipping reload:', canvasEntry.id);
      setSelectedId(canvasEntry.id); // Just update the selection UI
      return;
    }
    
    console.log('Opening canvas:', canvasEntry.id, 'Type:', canvasEntry._unsaved ? 'unsaved' : 'project');
    
    try {
      // First, save current canvas state before switching
      const currentUnsavedId = currentUnsavedIdRef.current;
      const currentProjectCanvasId = currentProjectCanvasIdRef.current;
      
      // Cancel any pending auto-save to avoid conflicts
      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current);
        updateDebounceRef.current = null;
      }
      
      // ВИПРАВЛЕННЯ: Встановлюємо флаг переключення
      canvas.__switching = true;
      canvas.__suspendUndoRedo = true;
      
      // Save current canvas if it's different from the one we're opening
      if (currentUnsavedId && currentUnsavedId !== canvasEntry.id) {
        console.log('Saving current unsaved sign before switch:', currentUnsavedId, 'with', canvas.getObjects().length, 'objects');
        try { 
          await updateUnsavedSignFromCanvas(currentUnsavedId, canvas);
          console.log('Saved unsaved sign successfully');
        } catch (e) { 
          console.error('Failed to save unsaved sign:', e);
        }
      }
      
      if (currentProjectCanvasId && currentProjectCanvasId !== canvasEntry.id) {
        console.log('Saving current project canvas before switch:', currentProjectCanvasId, 'with', canvas.getObjects().length, 'objects');
        try { 
          await updateCanvasInCurrentProject(currentProjectCanvasId, canvas);
          console.log('Saved project canvas successfully');
        } catch (e) { 
          console.error('Failed to save project canvas:', e);
        }
      }

      // Always fetch the latest state from database to avoid stale data
      let canvasToLoad = null;
      
      if (canvasEntry._unsaved) {
        console.log('Fetching fresh unsaved sign from database');
        const unsavedList = await getAllUnsavedSigns();
        const freshUnsaved = unsavedList.find(x => x.id === canvasEntry.id);
        if (freshUnsaved) {
          canvasToLoad = { ...freshUnsaved, _unsaved: true };
          console.log('Found fresh unsaved sign with', freshUnsaved.json?.objects?.length || 0, 'objects');
        } else {
          console.warn('Unsaved sign not found in database:', canvasEntry.id);
          canvasToLoad = canvasEntry;
        }
      } else {
        console.log('Fetching fresh project canvas from database');
        let projectId = null;
        try { projectId = localStorage.getItem("currentProjectId"); } catch {}
        if (projectId) {
          const project = await getProject(projectId);
          const freshCanvas = project?.canvases?.find(c => c.id === canvasEntry.id);
          if (freshCanvas) {
            canvasToLoad = freshCanvas;
            console.log('Found fresh project canvas with', freshCanvas.json?.objects?.length || 0, 'objects');
          } else {
            console.warn('Project canvas not found in database:', canvasEntry.id);
            canvasToLoad = canvasEntry;
          }
        } else {
          canvasToLoad = canvasEntry;
        }
      }
      
      // Completely reset canvas state
      console.log('Resetting canvas state...');

      const mappedDesign =
        mapEntryToDesign(canvasToLoad) || {
          id: canvasEntry.id,
          width: canvasToLoad.width || DEFAULT_DESIGN_SIZE.width,
          height: canvasToLoad.height || DEFAULT_DESIGN_SIZE.height,
          jsonTemplate: canvasToLoad.json || null,
          backgroundColor: canvasToLoad.backgroundColor,
        };

      const registerDesignInContext = () => {
        if (typeof setContextDesigns !== "function") return;
        setContextDesigns((prev) => {
          const prevArray = Array.isArray(prev) ? prev : [];
          const existingIndex = prevArray.findIndex(
            (design) => design?.id === mappedDesign.id
          );
          if (existingIndex === -1) {
            return [...prevArray, mappedDesign];
          }
          const existing = prevArray[existingIndex] || {};
          const merged = { ...existing, ...mappedDesign };
          const next = [...prevArray];
          next[existingIndex] = merged;
          return next;
        });
      };

      try {
        if (canvas.setViewportTransform) {
          canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        }

        if (typeof window !== "undefined" && window.ensureInnerStrokeClasses) {
          try {
            window.ensureInnerStrokeClasses();
          } catch (e) {
            console.warn('Failed to ensure inner stroke classes', e);
          }
        }

        registerDesignInContext();
        selectDesign?.(mappedDesign.id);

        await loadDesign(mappedDesign);

        if (canvasToLoad.backgroundColor) {
          canvas.set("backgroundColor", canvasToLoad.backgroundColor);
        }

        try {
          restoreElementProperties(canvas);
          console.log('Element properties restored');
        } catch (e) {
          console.error('Failed to restore element properties:', e);
        }

        canvas.__suspendUndoRedo = false;
        canvas.__switching = false;

        console.log('Canvas loading completed successfully, objects:', canvas.getObjects().length);

        setTimeout(() => {
          const toolbarState = extractToolbarState(canvasToLoad);
          console.log('Restoring toolbar state (delayed):', toolbarState);

          if (window.restoreToolbarState) {
            window.restoreToolbarState(toolbarState);
            console.log('Toolbar state restored successfully');
          } else {
            console.warn('window.restoreToolbarState not available');
          }

          window.dispatchEvent(
            new CustomEvent('canvas:loaded', {
              detail: { canvasId: canvasEntry.id, toolbarState },
            })
          );
        }, 100);
      } catch (error) {
        console.error('Error loading canvas via fabric loader:', error);
        canvas.__suspendUndoRedo = false;
        canvas.__switching = false;
      }

      if (!canvas.__suspendUndoRedo && !canvas.__switching) {
        canvas.requestRenderAll?.();
      }
      
      // Update tracking state
      setSelectedId(canvasEntry.id);
      try { localStorage.setItem("currentCanvasId", canvasEntry.id); } catch {}
      
      if (canvasEntry._unsaved) {
        currentUnsavedIdRef.current = canvasEntry.id;
        currentProjectCanvasIdRef.current = null;
        try { localStorage.setItem("currentUnsavedSignId", canvasEntry.id); } catch {}
        console.log('Set current unsaved sign to:', canvasEntry.id);
      } else {
        currentUnsavedIdRef.current = null;
        currentProjectCanvasIdRef.current = canvasEntry.id;
        try { localStorage.removeItem("currentUnsavedSignId"); } catch {}
        console.log('Set current project canvas to:', canvasEntry.id);
      }
      
    } catch (error) {
      console.error("Failed to open canvas:", error);
      canvas.__suspendUndoRedo = false;
      canvas.__switching = false;
    }
  };

  openCanvasRef.current = openCanvas;

  // If user clicks save button outside this component, unsaved signs will be transferred.
  // Example: <button onClick={()=> transferUnsavedSignsToProject(project?.id)}>Commit unsaved to project</button>

  useEffect(() => {
    if (initialCanvasLoadRef.current) return;
    if (!canvas || !isProjectLoaded || !isUnsavedLoaded) return;

    let storedUnsavedId = null;
    let storedProjectCanvasId = null;

    try {
      storedUnsavedId = localStorage.getItem("currentUnsavedSignId");
    } catch {}

    try {
      storedProjectCanvasId = localStorage.getItem("currentCanvasId");
    } catch {}

    const unsavedEntry = storedUnsavedId
      ? unsavedSigns.find((entry) => entry.id === storedUnsavedId)
      : null;
    const projectEntry = storedProjectCanvasId
      ? storedCanvases.find((entry) => entry.id === storedProjectCanvasId)
      : null;

    const fallbackEntry = canvases[0] || null;
    const entryToOpen = unsavedEntry || projectEntry || fallbackEntry;

    if (!entryToOpen) {
      initialCanvasLoadRef.current = true;
      return;
    }

    initialCanvasLoadRef.current = true;

    const loadInitial = async () => {
      try {
        setSelectedId(entryToOpen.id);
      } catch {}

      if (typeof openCanvasRef.current === "function") {
        try {
          await openCanvasRef.current(entryToOpen);
        } catch (error) {
          console.error("Failed to auto-load initial canvas", error);
        }
      }
    };

    loadInitial();
  }, [canvas, isProjectLoaded, isUnsavedLoaded, unsavedSigns, storedCanvases, canvases]);

  // Auto-save current canvas when objects change
  useEffect(() => {
    if (!canvas) return;
    
    const events = ["object:added", "object:modified", "object:removed", "object:skewing", "object:scaling", "object:rotating", "object:moving", "path:created", "selection:cleared", "selection:created"];
    
    // Canvas property change events
    const canvasEvents = ["canvas:background-changed", "canvas:resized", "canvas:shape-changed"];
    
    const handleCanvasChange = () => {
      const activeUnsaved = currentUnsavedIdRef.current;
      const activeProjectCanvas = currentProjectCanvasIdRef.current;
      
      // ВИПРАВЛЕННЯ: Додаємо перевірку, чи справді є зміни
      if (!activeUnsaved && !activeProjectCanvas) {
        console.log('Skipping auto-save - no active canvas');
        return; // Немає активного полотна для збереження
      }
      
      // ВИПРАВЛЕННЯ: Перевіряємо чи полотно не в процесі переключення
      if (canvas.__suspendUndoRedo || canvas.__switching) {
        console.log('Skipping auto-save - canvas switching in progress');
        return; // Не зберігаємо під час переключення
      }
      
      // Clear any existing timeout
      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current);
      }
      
      // ВИПРАВЛЕННЯ: Debounced save з оновленням preview в базі даних
      updateDebounceRef.current = setTimeout(async () => {
        // Подвійна перевірка перед збереженням
        if (canvas.__suspendUndoRedo || canvas.__switching) {
          console.log('Skipping delayed auto-save - canvas switching detected');
          return;
        }
        
        const currentObjects = canvas.getObjects().length;
        console.log('Auto-saving with', currentObjects, 'objects');
        
        try {
          if (activeUnsaved && currentUnsavedIdRef.current === activeUnsaved) {
            console.log('Auto-saving unsaved sign:', activeUnsaved, 'with', currentObjects, 'objects');
            await updateUnsavedSignFromCanvas(activeUnsaved, canvas);
            console.log('Auto-save completed for unsaved sign');
            
              // НОВЕ: Оновлюємо локальний state з новим preview
              const newPreview = canvas.toDataURL?.({ format: "png", multiplier: 0.5 }) || "";
              const newPreviewSvg = canvas.toSVG?.() || "";
              
              setUnsavedSigns(prev => prev.map(sign => 
                sign.id === activeUnsaved 
                  ? { 
                      ...sign, 
                      preview: newPreview,
                      previewSvg: newPreviewSvg
                    }
                  : sign
              ));          } else if (activeProjectCanvas && currentProjectCanvasIdRef.current === activeProjectCanvas) {
            console.log('Auto-saving project canvas:', activeProjectCanvas, 'with', currentObjects, 'objects');
            await updateCanvasInCurrentProject(activeProjectCanvas, canvas);
            console.log('Auto-save completed for project canvas');
            
            // НОВЕ: Оновлюємо локальний project state з новим preview
            const newPreview = canvas.toDataURL?.({ format: "png", multiplier: 0.5 }) || "";
            const newPreviewSvg = canvas.toSVG?.() || "";
            
            setProject(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                canvases: prev.canvases?.map(canv => 
                  canv.id === activeProjectCanvas 
                    ? { 
                        ...canv, 
                        preview: newPreview,
                        previewSvg: newPreviewSvg
                      }
                    : canv
                ) || []
              };
            });
          }
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, 1000); // Increased debounce time to 1 second
    };
    
    // Handle canvas property changes
    const handleCanvasPropertyChange = () => {
      console.log('Canvas property changed, updating preview and saving');
      handleCanvasChange(); // Use same logic as object changes
    };
    
    events.forEach(event => canvas.on(event, handleCanvasChange));
    canvasEvents.forEach(event => canvas.on(event, handleCanvasPropertyChange));
    
    // Watch for canvas dimension changes
    const originalSetWidth = canvas.setWidth;
    const originalSetHeight = canvas.setHeight;
    const originalSetBackgroundColor = canvas.setBackgroundColor;
    const originalSet = canvas.set;
    
    canvas.setWidth = function(value) {
      const result = originalSetWidth.call(this, value);
      console.log('Canvas width changed to:', value);
      handleCanvasPropertyChange();
      return result;
    };
    
    canvas.setHeight = function(value) {
      const result = originalSetHeight.call(this, value);
      console.log('Canvas height changed to:', value);
      handleCanvasPropertyChange();
      return result;
    };
    
    if (originalSetBackgroundColor) {
      canvas.setBackgroundColor = function(color, callback) {
        const result = originalSetBackgroundColor.call(this, color, callback);
        console.log('Canvas background color changed to:', color);
        handleCanvasPropertyChange();
        return result;
      };
    }
    
    canvas.set = function(property, value) {
      const result = originalSet.call(this, property, value);
      if (property === 'backgroundColor') {
        console.log('Canvas background color set to:', value);
        handleCanvasPropertyChange();
      }
      return result;
    };
    
    // Watch canvas element for attribute changes (size, style, etc.)
    let observer = null;
    if (canvas.getElement && canvas.getElement()) {
      observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes') {
            const attrName = mutation.attributeName;
            if (attrName === 'width' || attrName === 'height' || attrName === 'style') {
              console.log('Canvas DOM attribute changed:', attrName);
              shouldUpdate = true;
            }
          }
        });
        if (shouldUpdate) {
          handleCanvasPropertyChange();
        }
      });
      
      observer.observe(canvas.getElement(), {
        attributes: true,
        attributeFilter: ['width', 'height', 'style']
      });
    }
    
    return () => {
      events.forEach(event => canvas.off(event, handleCanvasChange));
      canvasEvents.forEach(event => canvas.off(event, handleCanvasPropertyChange));
      
      // Restore original methods
      canvas.setWidth = originalSetWidth;
      canvas.setHeight = originalSetHeight;
      if (originalSetBackgroundColor) {
        canvas.setBackgroundColor = originalSetBackgroundColor;
      }
      canvas.set = originalSet;
      
      // Disconnect observer
      if (observer) {
        observer.disconnect();
      }
      
      if (updateDebounceRef.current) {
        clearTimeout(updateDebounceRef.current);
      }
    };
  }, [canvas]);

  if (!project) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <button className={styles.navBtn} disabled={page === 1} onClick={() => setPage((p)=> Math.max(1, p-1))}>&lt;&lt;</button>
        {ranges.map((r) => (
          <button key={r.page} className={`${styles.rangesBtn} ${page === r.page ? styles.rangesBtnActive : ""}`} onClick={()=> setPage(r.page)}>
            {r.start}–{r.end}
          </button>
        ))}
        <button className={styles.navBtn} disabled={page === totalPages} onClick={() => setPage((p)=> Math.min(totalPages, p+1))}>&gt;&gt;</button>
      </div>

      {current.length === 0 ? (
        <div className={styles.empty}>No canvases in current project.</div>
      ) : (
        <div className={styles.grid}>
          {current.map((c) => {
            // ВИПРАВЛЕННЯ: Використовуємо тільки збережені preview (SVG або PNG) з безпечною перевіркою
            const hasSvgPreview = c.previewSvg && typeof c.previewSvg === 'string' && c.previewSvg.trim().length > 0;
            const hasPngPreview = c.preview && typeof c.preview === 'string' && c.preview.trim().length > 0;
            
            return (
              <div key={c.id} className={`${styles.item} ${selectedId === c.id ? styles.selected : ""}`} onClick={() => openCanvas(c)}>
                <div className={styles.thumb}>
                  {(hasSvgPreview || hasPngPreview) ? (
                    hasSvgPreview ? (
                      // ВИПРАВЛЕННЯ: Використовуємо URL encoding для SVG замість btoa
                      <img 
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(c.previewSvg)}`} 
                        alt="preview" 
                        onError={(e) => {
                          // Fallback на PNG якщо SVG не завантажується
                          if (hasPngPreview) {
                            e.target.src = c.preview;
                          }
                        }}
                      />
                    ) : (
                      // Fallback на PNG preview
                      <img src={c.preview} alt="preview" />
                    )
                  ) : (
                    <span>Preview</span>
                  )}
                </div>
                <div className={styles.meta}>
                  <span>{pxToMm(c.width)} × {pxToMm(c.height)} (mm)</span>
                  <span>{/* optionally qty or index */}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectCanvasesGrid;
