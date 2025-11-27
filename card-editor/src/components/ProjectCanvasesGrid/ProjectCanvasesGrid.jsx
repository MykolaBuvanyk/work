import React, { useEffect, useMemo, useState, useRef } from "react";
import styles from "./ProjectCanvasesGrid.module.css";
import {
  getProject,
  getAllUnsavedSigns,
  updateUnsavedSignFromCanvas,
  extractToolbarState,
  restoreElementProperties,
  addBlankUnsavedSign,
  updateCanvasInCurrentProject,
  deleteUnsavedSign,
  generateCanvasPreviews,
  loadCanvasFontsAndRerender,
  reapplyTextAttributes,
  ensureFontsLoaded,
  collectFontFamiliesFromJson,
} from "../../utils/projectStorage";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useFabricCanvas } from "../../hooks/useFabricCanvas";
import * as fabric from "fabric";
import LayoutPlannerModal from "./LayoutPlannerModal/LayoutPlannerModal";

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
    preview: entry.preview || null,
    previewSvg: entry.previewSvg || null,
    copiesCount: entry.copiesCount ?? entry.toolbarState?.copiesCount ?? null,
    meta: {
      isUnsaved: !!entry._unsaved,
      sourceType: entry._unsaved ? "unsaved" : "project",
    },
  };
};

const ProjectCanvasesGrid = () => {
  const { setDesigns: setContextDesigns, updateGlobalColors } =
    useCanvasContext();
  const { canvas, loadDesign, selectDesign } = useFabricCanvas();
  const [project, setProject] = useState(null);
  const [unsavedSigns, setUnsavedSigns] = useState([]); // persisted unsaved signs from dedicated store
  const updateDebounceRef = useRef();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const currentUnsavedIdRef = useRef(null); // track which unsaved sign is currently loaded
  const currentProjectCanvasIdRef = useRef(null); // track which project canvas is currently loaded
  const initialCanvasLoadRef = useRef(false);
  const openCanvasRef = useRef(null);
  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  const [isUnsavedLoaded, setIsUnsavedLoaded] = useState(false);
  // ВИДАЛЕНО: livePreview state - тепер використовуємо тільки збережені preview

  useEffect(() => {
    const load = () => {
      let id = null;
      try {
        id = localStorage.getItem("currentProjectId");
      } catch {}
      if (!id) {
        setProject({ id: null, canvases: [] });
        setIsProjectLoaded(true);
        return;
      }
      getProject(id)
        .then((p) => {
          setProject(p || { id, canvases: [] });
          setIsProjectLoaded(true);
        })
        .catch(() => {
          setProject({ id, canvases: [] });
          setIsProjectLoaded(true);
        });
    };
    const loadUnsaved = () => {
      getAllUnsavedSigns()
        .then((list) => {
          const mapped = list.map((s) => ({ ...s, _unsaved: true }));
          setUnsavedSigns(mapped);
          setIsUnsavedLoaded(true);
          // Maintain selection of current unsaved after refresh
          try {
            const active = localStorage.getItem("currentUnsavedSignId");
            if (active) {
              const exists = mapped.find((x) => x.id === active);
              if (exists) {
                setSelectedId(active);
              }
            }
          } catch {}
        })
        .catch(() => {
          setUnsavedSigns([]);
          setIsUnsavedLoaded(true);
        });
    };
    loadUnsaved();
    load();
    const updated = (e) => {
      const pid = e?.detail?.projectId;
      const currentId = (() => {
        try {
          return localStorage.getItem("currentProjectId");
        } catch {
          return null;
        }
      })();
      if (!pid || pid === currentId) {
        load();
      }

      const detail = e?.detail || {};
      const activeId = detail.activeCanvasId ?? null;
      const activeIndex =
        typeof detail.activeCanvasIndex === "number" &&
        detail.activeCanvasIndex >= 0
          ? detail.activeCanvasIndex
          : null;

      try {
        if (activeId) {
          window.__currentProjectCanvasId = activeId;
          localStorage.setItem("currentProjectCanvasId", activeId);
        }
        if (activeIndex !== null) {
          window.__currentProjectCanvasIndex = activeIndex;
          localStorage.setItem(
            "currentProjectCanvasIndex",
            String(activeIndex)
          );
        }
      } catch {}
    };
    const switched = () => {
      // Скидаємо флаг при переключенні проекту
      initialCanvasLoadRef.current = false;
      load();
    };
    const reset = () => {
      // Скидаємо флаг при reset проекту
      initialCanvasLoadRef.current = false;
      load();
    };
    const unsavedUpdated = () => loadUnsaved();

    // Новий обробник для відкриття проекту
    const handleProjectOpened = async (e) => {
      console.log("Project opened event received, resetting canvas load flag");
      const projectIdFromEvent = e?.detail?.projectId;
      initialCanvasLoadRef.current = false;

      // Відкриваємо перше полотно проекту
      setTimeout(async () => {
        try {
          const projectId =
            projectIdFromEvent || localStorage.getItem("currentProjectId");
          if (!projectId) {
            console.log("No project ID found after project opened");
            return;
          }

          const currentProject = await getProject(projectId);
          if (!currentProject) {
            console.log("Project not found:", projectId);
            return;
          }

          const canvases = currentProject.canvases || [];
          console.log("Project loaded, canvases count:", canvases.length);

          // Оновлюємо локальний state
          setProject(currentProject);
          setIsProjectLoaded(true);

          // Також завантажуємо unsaved signs
          try {
            const unsavedList = await getAllUnsavedSigns();
            const mapped = unsavedList.map((s) => ({ ...s, _unsaved: true }));
            setUnsavedSigns(mapped);
            setIsUnsavedLoaded(true);
          } catch (err) {
            console.error("Failed to load unsaved signs:", err);
            setUnsavedSigns([]);
            setIsUnsavedLoaded(true);
          }

          if (canvases.length > 0) {
            const firstCanvas = canvases[0];
            console.log(
              "Auto-opening first project canvas after save:",
              firstCanvas.id
            );

            // Встановлюємо його як активний
            try {
              localStorage.setItem("currentCanvasId", firstCanvas.id);
              localStorage.setItem("currentProjectCanvasId", firstCanvas.id);
              localStorage.setItem("currentProjectCanvasIndex", "0");
              localStorage.removeItem("currentUnsavedSignId");
            } catch {}
            try {
              if (typeof window !== "undefined") {
                window.__currentProjectCanvasId = firstCanvas.id;
                window.__currentProjectCanvasIndex = 0;
              }
            } catch {}

            // Даємо час на оновлення state
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Відкриваємо його
            if (openCanvasRef.current && canvas) {
              await openCanvasRef.current(firstCanvas);
              console.log("Canvas opened successfully");
            } else {
              console.log("openCanvasRef or canvas not available");
            }
          } else {
            console.log("No canvases in project");
            try {
              localStorage.removeItem("currentProjectCanvasId");
              localStorage.removeItem("currentProjectCanvasIndex");
            } catch {}
            try {
              if (typeof window !== "undefined") {
                window.__currentProjectCanvasId = null;
                window.__currentProjectCanvasIndex = null;
              }
            } catch {}
          }
        } catch (error) {
          console.error(
            "Failed to auto-open canvas after project opened:",
            error
          );
        }
      }, 200); // Даємо час на оновлення після події
    };

    // Новий обробник для автоматичного відкриття полотна
    const handleCanvasAutoOpen = async (e) => {
      const canvasId = e?.detail?.canvasId;
      const isUnsaved = e?.detail?.isUnsaved;

      if (!canvasId) {
        console.log("No canvas ID provided for auto-open");
        return;
      }

      console.log(
        "Canvas auto-open event received:",
        canvasId,
        "isUnsaved:",
        isUnsaved
      );

      // Чекаємо поки canvas буде готовий
      if (!canvas) {
        console.log("Canvas not ready yet, waiting...");
        // Повторюємо спробу через 100мс
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("canvas:autoOpen", {
              detail: { canvasId, isUnsaved },
            })
          );
        }, 100);
        return;
      }

      try {
        let canvasToOpen = null;
        let attempts = 0;
        const maxAttempts = 10;

        // Пробуємо знайти полотно, робимо кілька спроб
        while (!canvasToOpen && attempts < maxAttempts) {
          if (isUnsaved) {
            // Завантажуємо свіжі unsaved signs
            const unsavedList = await getAllUnsavedSigns();
            const mapped = unsavedList.map((s) => ({ ...s, _unsaved: true }));

            canvasToOpen = mapped.find((s) => s.id === canvasId);

            if (canvasToOpen) {
              console.log("Found unsaved sign to open:", canvasId);
              setUnsavedSigns(mapped);
              setIsUnsavedLoaded(true);
            }
          } else {
            // Завантажуємо проект
            const projectId = localStorage.getItem("currentProjectId");
            if (projectId) {
              const currentProject = await getProject(projectId);
              if (currentProject) {
                canvasToOpen = currentProject.canvases?.find(
                  (c) => c.id === canvasId
                );

                if (canvasToOpen) {
                  console.log("Found project canvas to open:", canvasId);
                  setProject(currentProject);
                  setIsProjectLoaded(true);
                }
              }
            }
          }

          if (!canvasToOpen) {
            console.log(
              `Canvas not found yet, attempt ${attempts + 1}/${maxAttempts}`
            );
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
          }
        }

        if (canvasToOpen && openCanvasRef.current) {
          console.log("Auto-opening canvas:", canvasId);

          // Чекаємо ще трохи щоб state оновився
          await new Promise((resolve) => setTimeout(resolve, 150));

          await openCanvasRef.current(canvasToOpen);
          console.log("Canvas auto-opened successfully");
        } else {
          console.log("Canvas not found after all attempts:", canvasId);
        }
      } catch (error) {
        console.error("Failed to auto-open canvas:", error);
      }
    };

    window.addEventListener("project:canvasesUpdated", updated);
    window.addEventListener("project:switched", switched);
    window.addEventListener("project:reset", reset);
    window.addEventListener("project:opened", handleProjectOpened);
    window.addEventListener("canvas:autoOpen", handleCanvasAutoOpen);
    window.addEventListener("unsaved:signsUpdated", unsavedUpdated);

    // Listen for toolbar/canvas property changes
    const handleToolbarChange = () => {
      if (!canvas) return;
      const activeUnsaved = currentUnsavedIdRef.current;
      const activeProjectCanvas = currentProjectCanvasIdRef.current;

      if (activeUnsaved || activeProjectCanvas) {
        console.log(
          "Toolbar change detected, triggering auto-save with preview update"
        );

        // ВИПРАВЛЕННЯ: Замість live preview, одразу тригеримо auto-save з новим preview
        if (updateDebounceRef.current) {
          clearTimeout(updateDebounceRef.current);
        }

        updateDebounceRef.current = setTimeout(async () => {
          try {
            if (activeUnsaved) {
              await updateUnsavedSignFromCanvas(activeUnsaved, canvas);
              console.log("Auto-saved with new preview for unsaved sign");

              const previews = await generateCanvasPreviews(canvas);
              const newPreview = previews.previewPng;
              const newPreviewSvg = previews.previewSvg;
              setUnsavedSigns((prev) =>
                prev.map((sign) =>
                  sign.id === activeUnsaved
                    ? {
                        ...sign,
                        preview: newPreview,
                        previewSvg: newPreviewSvg,
                      }
                    : sign
                )
              );
            } else if (activeProjectCanvas) {
              await updateCanvasInCurrentProject(activeProjectCanvas, canvas);
              console.log("Auto-saved with new preview for project canvas");

              const previews = await generateCanvasPreviews(canvas);
              const newPreview = previews.previewPng;
              const newPreviewSvg = previews.previewSvg;
              setProject((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  canvases:
                    prev.canvases?.map((canv) =>
                      canv.id === activeProjectCanvas
                        ? {
                            ...canv,
                            preview: newPreview,
                            previewSvg: newPreviewSvg,
                          }
                        : canv
                    ) || [],
                };
              });
            }
          } catch (error) {
            console.error("Auto-save failed after toolbar change:", error);
          }
        }, 1000); // Debounce для уникнення занадто частих updates
      }
    };

    // Listen for various canvas/toolbar change events
    window.addEventListener("canvas:propertyChanged", handleToolbarChange);
    window.addEventListener("toolbar:changed", handleToolbarChange);
    window.addEventListener("canvas:backgroundChanged", handleToolbarChange);
    window.addEventListener("canvas:dimensionsChanged", handleToolbarChange);
    window.addEventListener("canvas:shapeChanged", handleToolbarChange);

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
        console.error("Failed to save before unload:", e);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("project:canvasesUpdated", updated);
      window.removeEventListener("project:switched", switched);
      window.removeEventListener("project:reset", reset);
      window.removeEventListener("project:opened", handleProjectOpened);
      window.removeEventListener("canvas:autoOpen", handleCanvasAutoOpen);
      window.removeEventListener("unsaved:signsUpdated", unsavedUpdated);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("canvas:propertyChanged", handleToolbarChange);
      window.removeEventListener("toolbar:changed", handleToolbarChange);
      window.removeEventListener(
        "canvas:backgroundChanged",
        handleToolbarChange
      );
      window.removeEventListener(
        "canvas:dimensionsChanged",
        handleToolbarChange
      );
      window.removeEventListener("canvas:shapeChanged", handleToolbarChange);

      // Save current state when component unmounts
      handleBeforeUnload();
    };
  }, [canvas]);

  // Simple canvas list: project canvases -> unsaved signs (sorted by creation time)
  const storedCanvases = project?.canvases || [];

  // ВИПРАВЛЕННЯ: Сортуємо unsaved signs за датою створення (найстаріші спочатку)
  const sortedUnsavedSigns = useMemo(() => {
    return [...unsavedSigns].sort((a, b) => {
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      return timeA - timeB; // ascending order (oldest first)
    });
  }, [unsavedSigns]);

  // ВИПРАВЛЕННЯ: Проектні полотна спочатку, потім unsaved (нові в кінці)
  const canvases = useMemo(() => {
    return [...storedCanvases, ...sortedUnsavedSigns];
  }, [storedCanvases, sortedUnsavedSigns]);

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

  const PX_PER_MM = 72 / 25.4;
  const pxToMm = (px) => {
    const mm = (Number(px) || 0) / PX_PER_MM;
    return Math.round(mm);
  };

  const openCanvas = async (canvasEntry) => {
    if (!canvasEntry || !canvas) return;

    // Check if this canvas is already active - don't reload it
    const currentUnsavedId = currentUnsavedIdRef.current;
    const currentProjectCanvasId = currentProjectCanvasIdRef.current;

    const isAlreadyActive =
      (canvasEntry._unsaved && currentUnsavedId === canvasEntry.id) ||
      (!canvasEntry._unsaved && currentProjectCanvasId === canvasEntry.id);

    if (isAlreadyActive) {
      console.log("Canvas already active, skipping reload:", canvasEntry.id);
      setSelectedId(canvasEntry.id); // Just update the selection UI
      return;
    }

    const entryIndex = canvases.findIndex((c) => c.id === canvasEntry.id);

    console.log(
      "Opening canvas:",
      canvasEntry.id,
      "Type:",
      canvasEntry._unsaved ? "unsaved" : "project"
    );
    console.log("Canvas entry details:", {
      id: canvasEntry.id,
      canvasType: canvasEntry.canvasType,
      width: canvasEntry.width,
      height: canvasEntry.height,
      hasJson: !!canvasEntry.json,
      objectCount: canvasEntry.json?.objects?.length || 0,
      hasToolbarState: !!canvasEntry.toolbarState,
      shapeType:
        canvasEntry.toolbarState?.currentShapeType || canvasEntry.canvasType,
    });

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
        console.log(
          "Saving current unsaved sign before switch:",
          currentUnsavedId,
          "with",
          canvas.getObjects().length,
          "objects"
        );
        try {
          await updateUnsavedSignFromCanvas(currentUnsavedId, canvas);
          console.log("Saved unsaved sign successfully");
          if (!canvasEntry._unsaved) {
            try {
              await deleteUnsavedSign(currentUnsavedId);
              setUnsavedSigns((prev) =>
                prev.filter((sign) => sign.id !== currentUnsavedId)
              );
              try {
                localStorage.removeItem("currentUnsavedSignId");
              } catch {}
              try {
                window.dispatchEvent(new CustomEvent("unsaved:signsUpdated"));
              } catch {}
              console.log(
                "Removed unsaved sign after switching to project canvas:",
                currentUnsavedId
              );
            } catch (cleanupError) {
              console.error(
                "Failed to remove unsaved sign after switch:",
                cleanupError
              );
            }
            try {
              if (typeof window !== "undefined") {
                window.__pendingUnsavedCleanupId = null;
              }
            } catch {}
          } else {
            if (typeof window !== "undefined") {
              try {
                window.__pendingUnsavedCleanupId = currentUnsavedId;
              } catch {}
            }
          }
        } catch (e) {
          console.error("Failed to save unsaved sign:", e);
        }
      }

      if (currentProjectCanvasId && currentProjectCanvasId !== canvasEntry.id) {
        console.log(
          "Saving current project canvas before switch:",
          currentProjectCanvasId,
          "with",
          canvas.getObjects().length,
          "objects"
        );
        try {
          await updateCanvasInCurrentProject(currentProjectCanvasId, canvas);
          console.log("Saved project canvas successfully");
        } catch (e) {
          console.error("Failed to save project canvas:", e);
        }
      }

      // Always fetch the latest state from database to avoid stale data
      let canvasToLoad = null;

      if (canvasEntry._unsaved) {
        console.log("Fetching fresh unsaved sign from database");
        const unsavedList = await getAllUnsavedSigns();
        const freshUnsaved = unsavedList.find((x) => x.id === canvasEntry.id);
        if (freshUnsaved) {
          canvasToLoad = { ...freshUnsaved, _unsaved: true };
          console.log(
            "Found fresh unsaved sign with",
            freshUnsaved.json?.objects?.length || 0,
            "objects"
          );
        } else {
          console.warn("Unsaved sign not found in database:", canvasEntry.id);
          canvasToLoad = canvasEntry;
        }
      } else {
        console.log("Fetching fresh project canvas from database");
        let projectId = null;
        try {
          projectId = localStorage.getItem("currentProjectId");
        } catch {}
        if (projectId) {
          const project = await getProject(projectId);
          const freshCanvas = project?.canvases?.find(
            (c) => c.id === canvasEntry.id
          );
          if (freshCanvas) {
            canvasToLoad = freshCanvas;
            console.log(
              "Found fresh project canvas with",
              freshCanvas.json?.objects?.length || 0,
              "objects"
            );
          } else {
            console.warn(
              "Project canvas not found in database:",
              canvasEntry.id
            );
            canvasToLoad = canvasEntry;
          }
        } else {
          canvasToLoad = canvasEntry;
        }
      }

      // Completely reset canvas state
      console.log("Resetting canvas state...");

      const mappedDesign = mapEntryToDesign(canvasToLoad) || {
        id: canvasEntry.id,
        width: canvasToLoad.width || DEFAULT_DESIGN_SIZE.width,
        height: canvasToLoad.height || DEFAULT_DESIGN_SIZE.height,
        jsonTemplate: canvasToLoad.json || null,
        backgroundColor: canvasToLoad.backgroundColor,
        toolbarState: canvasToLoad.toolbarState || null, // ВИПРАВЛЕННЯ: додано toolbarState
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

        registerDesignInContext();
        selectDesign?.(mappedDesign.id);

        // ВИПРАВЛЕННЯ: Відновлюємо shapeType на canvas ПЕРЕД завантаженням design
        if (canvasToLoad.canvasType) {
          canvas.set("shapeType", canvasToLoad.canvasType);
          console.log(
            "Set canvas shapeType BEFORE loadDesign:",
            canvasToLoad.canvasType
          );
        }

        // Preload fonts found in JSON before loading to avoid initial fallback
        try {
          const fontFamilies = collectFontFamiliesFromJson(
            mappedDesign.jsonTemplate || canvasToLoad.json || null
          );
          if (fontFamilies && fontFamilies.length) {
            await ensureFontsLoaded(fontFamilies);
            if (document && document.fonts && document.fonts.ready) {
              try {
                await document.fonts.ready;
              } catch {}
            }
          }
        } catch {}

        await loadDesign(mappedDesign);

        // FIX: Aggressively reapply fonts and attributes to ensure they render correctly
        // This handles cases where the browser loads the font slightly after the initial render
        const forceFontUpdate = async (attempt) => {
          if (!canvas || canvas.__switching) return;
          try {
            await loadCanvasFontsAndRerender(canvas);
            reapplyTextAttributes(canvas);
            canvas.calcOffset();
            canvas.requestRenderAll();
          } catch (e) {
            console.warn("Font update failed:", e);
          }
        };

        await forceFontUpdate(0);

        // Retry sequence to catch late font loads
        [100, 300, 600, 1000].forEach((delay, i) => {
          setTimeout(() => forceFontUpdate(i + 1), delay);
        });

        // ВИПРАВЛЕННЯ: Відновлюємо фон з урахуванням текстур
        // Для нових карток завжди встановлюємо білий фон
        const isNewCanvas =
          !canvasToLoad.json ||
          !canvasToLoad.json.objects ||
          canvasToLoad.json.objects.length === 0;
        const bgColor = canvasToLoad.backgroundColor || "#FFFFFF";
        const bgType = canvasToLoad.backgroundType || "solid";

        // ВИПРАВЛЕННЯ: Завжди встановлюємо білий фон для нових карток або якщо збережений фон білий
        if (isNewCanvas || (bgColor === "#FFFFFF" && bgType === "solid")) {
          console.log(
            "New canvas or white background detected, forcing white background",
            {
              isNewCanvas,
              bgColor,
              bgType,
            }
          );
          canvas.set("backgroundColor", "#FFFFFF");
          canvas.set("backgroundTextureUrl", null);
          canvas.set("backgroundType", "solid");
          canvas.renderAll();

          // ВИПРАВЛЕННЯ: Синхронізуємо globalColors для нової картки
          if (updateGlobalColors) {
            updateGlobalColors({
              backgroundColor: "#FFFFFF",
              backgroundType: "solid",
            });
            console.log("Set globalColors to white for new canvas");
          }
        } else if (bgColor && bgColor !== "#FFFFFF") {
          console.log("Restoring canvas background:", {
            backgroundColor: bgColor,
            backgroundType: bgType,
            canvasId: canvasToLoad.id,
          });

          if (bgType === "texture") {
            // Якщо це текстура, завантажуємо її через ту саму логіку
            const img = document.createElement("img");
            img.crossOrigin = "anonymous";
            img.onload = () => {
              try {
                const scaleX = canvas.width / img.width;
                const scaleY = canvas.height / img.height;

                const patternCanvas = document.createElement("canvas");
                const ctx = patternCanvas.getContext("2d");

                patternCanvas.width = img.width * scaleX;
                patternCanvas.height = img.height * scaleY;

                ctx.drawImage(
                  img,
                  0,
                  0,
                  patternCanvas.width,
                  patternCanvas.height
                );

                const pattern = new fabric.Pattern({
                  source: patternCanvas,
                  repeat: "repeat",
                });

                canvas.set("backgroundColor", pattern);
                canvas.set(
                  "backgroundTextureUrl",
                  canvasToLoad.backgroundColor
                );
                canvas.set("backgroundType", "texture");
                canvas.renderAll();

                console.log(
                  "Texture background restored successfully:",
                  canvasToLoad.backgroundColor
                );

                // ВИПРАВЛЕННЯ: Синхронізуємо globalColors з фактичним станом canvas
                if (updateGlobalColors) {
                  updateGlobalColors({
                    backgroundColor: canvasToLoad.backgroundColor,
                    backgroundType: "texture",
                  });
                  console.log(
                    "Synchronized globalColors with canvas texture:",
                    {
                      backgroundColor: canvasToLoad.backgroundColor,
                      backgroundType: "texture",
                    }
                  );
                }
              } catch (error) {
                console.error("Error restoring texture pattern:", error);
                canvas.set("backgroundColor", "#FFFFFF");
                canvas.renderAll();
              }
            };
            img.onerror = () => {
              console.error(
                "Error loading texture image:",
                canvasToLoad.backgroundColor
              );
              canvas.set("backgroundColor", "#FFFFFF");
              canvas.renderAll();
            };
            img.src = canvasToLoad.backgroundColor;
          } else {
            // Звичайний колір
            canvas.set("backgroundColor", bgColor);
            canvas.set("backgroundTextureUrl", null);
            canvas.set("backgroundType", bgType);
            canvas.renderAll();

            console.log("Solid background restored successfully:", bgColor);

            // ВИПРАВЛЕННЯ: Синхронізуємо globalColors з фактичним станом canvas
            if (updateGlobalColors) {
              updateGlobalColors({
                backgroundColor: bgColor,
                backgroundType: bgType,
              });
              console.log("Synchronized globalColors with canvas background:", {
                backgroundColor: bgColor,
                backgroundType: bgType,
              });
            }
          }
        } else {
          // Якщо немає збереженого кольору, встановлюємо білий за замовчуванням
          console.log(
            "No background color in saved data, setting white default"
          );
          canvas.set("backgroundColor", "#FFFFFF");
          canvas.set("backgroundTextureUrl", null);
          canvas.set("backgroundType", "solid");
          canvas.renderAll();

          if (updateGlobalColors) {
            updateGlobalColors({
              backgroundColor: "#FFFFFF",
              backgroundType: "solid",
            });
            console.log("Set default white background in globalColors");
          }
        }

        // НОВЕ: Відновлюємо фон-картинку, якщо збережено backgroundImage
        try {
          const bgImgData = canvasToLoad.backgroundImage;
          if (bgImgData && bgImgData.src) {
            console.log("Restoring canvas background image", bgImgData);
            fabric.FabricImage.fromURL(bgImgData.src)
              .then((img) => {
                try {
                  img.set({
                    opacity: bgImgData.opacity ?? 1,
                    originX: bgImgData.originX ?? "left",
                    originY: bgImgData.originY ?? "top",
                    scaleX: bgImgData.scaleX ?? 1,
                    scaleY: bgImgData.scaleY ?? 1,
                    left: bgImgData.left ?? 0,
                    top: bgImgData.top ?? 0,
                    angle: bgImgData.angle ?? 0,
                  });
                  canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
                  // Не змінюємо backgroundType, щоб текстури/solid могли співіснувати як резервний фон
                } catch (e) {
                  console.warn("Failed to apply background image:", e);
                }
              })
              .catch((e) => {
                console.warn("Failed to load background image:", e);
              });
          }
        } catch (bgImgErr) {
          console.warn("Background image restore error:", bgImgErr);
        }

        try {
          // ВИПРАВЛЕННЯ: Викликаємо restoreElementProperties з затримкою,
          // щоб дочекатись завершення loadFromJSON
          const waitForObjects = () => {
            return new Promise((resolve) => {
              const checkObjects = () => {
                const objects = canvas.getObjects();
                console.log('[waitForObjects] Перевірка об\'єктів:', objects.length);
                if (objects.length > 0 || !canvasToLoad.json?.objects?.length) {
                  resolve();
                } else {
                  setTimeout(checkObjects, 50);
                }
              };
              // Почекаємо мінімум 100мс
              setTimeout(checkObjects, 100);
            });
          };
          
          await waitForObjects();
          await restoreElementProperties(canvas);
          console.log("Element properties restored, objects:", canvas.getObjects().length);
        } catch (e) {
          console.error("Failed to restore element properties:", e);
        }

        canvas.__suspendUndoRedo = false;
        canvas.__switching = false;

        console.log(
          "Canvas loading completed successfully, objects:",
          canvas.getObjects().length
        );

        // ВИПРАВЛЕННЯ: restoreToolbarState вже викликається в loadDesign через canvas:loaded event
        // Тому тут ми лише додатково налаштовуємо canvas та логуємо інформацію
        setTimeout(() => {
          const toolbarState = extractToolbarState(canvasToLoad);

          // ВИПРАВЛЕННЯ: Синхронізуємо backgroundColor в toolbarState з фактичним станом canvas
          // Це потрібно, щоб уникнути перезапису фону при застосуванні toolbar state
          const actualCanvasBg = canvas.get("backgroundColor");
          const actualCanvasBgType = canvas.get("backgroundType") || "solid";
          const actualCanvasBgUrl = canvas.get("backgroundTextureUrl");

          // Якщо на canvas вже є фон, використовуємо його замість збереженого в toolbarState
          if (actualCanvasBg) {
            let bgColorToUse = actualCanvasBg;

            // Якщо це Pattern (текстура), використовуємо URL
            if (actualCanvasBgType === "texture" && actualCanvasBgUrl) {
              bgColorToUse = actualCanvasBgUrl;
            } else if (
              typeof actualCanvasBg === "object" &&
              actualCanvasBg !== null
            ) {
              // Якщо backgroundColor - це об'єкт Pattern, але немає URL
              bgColorToUse = canvasToLoad.backgroundColor || "#FFFFFF";
            }

            // Оновлюємо toolbarState, щоб він відповідав фактичному стану canvas
            toolbarState.globalColors = {
              ...(toolbarState.globalColors || {}),
              backgroundColor: bgColorToUse,
              backgroundType: actualCanvasBgType,
            };

            console.log(
              "Synchronized toolbarState backgroundColor with canvas:",
              {
                canvasBg: actualCanvasBg,
                canvasBgType: actualCanvasBgType,
                canvasBgUrl: actualCanvasBgUrl,
                finalBg: bgColorToUse,
              }
            );
          }

          console.log("Canvas loaded, toolbar state:", toolbarState);
          console.log("Canvas data loaded:", {
            canvasType: canvasToLoad.canvasType,
            width: canvasToLoad.width,
            height: canvasToLoad.height,
            backgroundColor: canvasToLoad.backgroundColor,
            objectCount: canvasToLoad.json?.objects?.length || 0,
            toolbarState: toolbarState,
          });

          // ВИПРАВЛЕННЯ: Переконуємося, що shapeType на canvas відповідає збереженому
          const actualShapeType =
            canvasToLoad.canvasType || toolbarState.currentShapeType;
          if (actualShapeType && canvas.get("shapeType") !== actualShapeType) {
            canvas.set("shapeType", actualShapeType);
            console.log("Corrected canvas shapeType:", actualShapeType);
          }

          // НОВИЙ: Примусово відновлюємо форму canvas
          if (window.forceRestoreCanvasShape) {
            console.log("Force restoring canvas shape with toolbarState");
            window.forceRestoreCanvasShape(toolbarState);
          }

          // Після відновлення форми — синхронізуємо інпуты тулбара з фактичними значеннями canvas
          setTimeout(() => {
            try {
              if (typeof window.syncToolbarSizeFromCanvas === "function") {
                window.syncToolbarSizeFromCanvas();
              }
            } catch {}
          }, 120);

          window.dispatchEvent(
            new CustomEvent("canvas:loaded", {
              detail: { canvasId: canvasEntry.id, toolbarState },
            })
          );
        }, 150); // Збільшили таймаут для надійності
      } catch (error) {
        console.error("Error loading canvas via fabric loader:", error);
        canvas.__suspendUndoRedo = false;
        canvas.__switching = false;
      }

      if (!canvas.__suspendUndoRedo && !canvas.__switching) {
        canvas.requestRenderAll?.();
      }

      // Update tracking state
      setSelectedId(canvasEntry.id);
      try {
        localStorage.setItem("currentCanvasId", canvasEntry.id);
      } catch {}

      if (canvasEntry._unsaved) {
        currentUnsavedIdRef.current = canvasEntry.id;
        currentProjectCanvasIdRef.current = null;
        try {
          localStorage.setItem("currentUnsavedSignId", canvasEntry.id);
          localStorage.removeItem("currentProjectCanvasId");
          localStorage.removeItem("currentProjectCanvasIndex");
        } catch {}
        try {
          if (typeof window !== "undefined") {
            window.__currentProjectCanvasId = null;
            window.__currentProjectCanvasIndex = null;
          }
        } catch {}
        console.log("Set current unsaved sign to:", canvasEntry.id);
      } else {
        currentUnsavedIdRef.current = null;
        currentProjectCanvasIdRef.current = canvasEntry.id;
        try {
          localStorage.removeItem("currentUnsavedSignId");
          localStorage.setItem("currentProjectCanvasId", canvasEntry.id);
          if (entryIndex !== -1) {
            localStorage.setItem(
              "currentProjectCanvasIndex",
              String(entryIndex)
            );
          }
        } catch {}
        try {
          if (typeof window !== "undefined") {
            window.__currentProjectCanvasId = canvasEntry.id;
            window.__currentProjectCanvasIndex =
              entryIndex !== -1 ? entryIndex : null;
            if (!canvasEntry._unsaved) {
              window.__pendingUnsavedCleanupId = null;
            }
          }
        } catch {}
        console.log("Set current project canvas to:", canvasEntry.id);
      }
    } catch (error) {
      console.error("Failed to open canvas:", error);
      canvas.__suspendUndoRedo = false;
      canvas.__switching = false;
    }
  };

  openCanvasRef.current = openCanvas;

  // Expose navigation helpers for ToolbarFooter
  useEffect(() => {
    // Open canvas by id and scroll page if needed
    window.openCanvasById = async (id) => {
      if (!id) return;
      const idx = canvases.findIndex((c) => c.id === id);
      if (idx === -1) return;
      const targetPage = Math.floor(idx / PAGE_SIZE) + 1;
      if (targetPage !== page) setPage(targetPage);
      const entry = canvases[idx];
      if (typeof openCanvasRef.current === "function") {
        try {
          await openCanvasRef.current(entry);
        } catch (e) {
          console.error(e);
        }
      }
    };

    // Get ordered list and selection index for footer
    window.getCanvasOrderInfo = () => {
      const order = canvases.map((c) => c.id);
      const idx = order.findIndex(
        (id) =>
          id ===
          (currentUnsavedIdRef.current || currentProjectCanvasIdRef.current)
      );
      return { order, index: idx, total: order.length };
    };

    // Notify listeners that grid navigation helpers are ready
    try {
      window.dispatchEvent(new CustomEvent("grid:navigationReady"));
    } catch {}

    return () => {
      try {
        delete window.openCanvasById;
      } catch {}
      try {
        delete window.getCanvasOrderInfo;
      } catch {}
    };
  }, [canvases, page]);

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
      ? sortedUnsavedSigns.find((entry) => entry.id === storedUnsavedId)
      : null;
    const projectEntry = storedProjectCanvasId
      ? storedCanvases.find((entry) => entry.id === storedProjectCanvasId)
      : null;

    // ВИПРАВЛЕННЯ: Пріоритет - проектні полотна, потім unsaved, потім fallback
    let entryToOpen = null;

    // Якщо є збережений проект, пріоритет віддаємо його полотнам
    const hasProject = project?.id && storedCanvases.length > 0;

    if (hasProject) {
      // Якщо є збережене полотно проекту - відкриваємо його
      entryToOpen = projectEntry || storedCanvases[0];
      console.log("Auto-loading project canvas:", entryToOpen?.id);
    } else if (unsavedEntry) {
      // Інакше беремо unsaved sign
      entryToOpen = unsavedEntry;
      console.log("Auto-loading unsaved sign:", entryToOpen?.id);
    } else {
      // Fallback - перше доступне полотно
      entryToOpen = canvases[0] || null;
      console.log("Auto-loading fallback canvas:", entryToOpen?.id);
    }

    if (!entryToOpen) {
      initialCanvasLoadRef.current = true;
      console.log("No canvas to auto-load");
      return;
    }

    initialCanvasLoadRef.current = true;

    const loadInitial = async () => {
      try {
        setSelectedId(entryToOpen.id);
      } catch {}

      if (typeof openCanvasRef.current === "function") {
        try {
          console.log("Auto-opening canvas:", entryToOpen.id);
          await openCanvasRef.current(entryToOpen);
        } catch (error) {
          console.error("Failed to auto-load initial canvas", error);
        }
      }
    };

    loadInitial();
  }, [
    canvas,
    isProjectLoaded,
    isUnsavedLoaded,
    sortedUnsavedSigns,
    storedCanvases,
    canvases,
    project,
  ]);

  // Auto-save current canvas when objects change
  useEffect(() => {
    if (!canvas) return;

    const events = [
      "object:added",
      "object:modified",
      "object:removed",
      "object:skewing",
      "object:scaling",
      "object:rotating",
      "object:moving",
      "path:created",
      "selection:cleared",
      "selection:created",
    ];

    // Canvas property change events
    const canvasEvents = [
      "canvas:background-changed",
      "canvas:resized",
      "canvas:shape-changed",
    ];

    const handleCanvasChange = () => {
      const activeUnsaved = currentUnsavedIdRef.current;
      const activeProjectCanvas = currentProjectCanvasIdRef.current;

      // ВИПРАВЛЕННЯ: Додаємо перевірку, чи справді є зміни
      if (!activeUnsaved && !activeProjectCanvas) {
        console.log("Skipping auto-save - no active canvas");
        return; // Немає активного полотна для збереження
      }

      // ВИПРАВЛЕННЯ: Перевіряємо чи полотно не в процесі переключення
      if (canvas.__suspendUndoRedo || canvas.__switching) {
        console.log("Skipping auto-save - canvas switching in progress");
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
          console.log("Skipping delayed auto-save - canvas switching detected");
          return;
        }

        const currentObjects = canvas.getObjects().length;
        console.log("Auto-saving with", currentObjects, "objects");

        try {
          if (activeUnsaved && currentUnsavedIdRef.current === activeUnsaved) {
            console.log(
              "Auto-saving unsaved sign:",
              activeUnsaved,
              "with",
              currentObjects,
              "objects"
            );
            await updateUnsavedSignFromCanvas(activeUnsaved, canvas);
            console.log("Auto-save completed for unsaved sign");

            // НОВЕ: Оновлюємо локальний state з новим preview
            const previews = await generateCanvasPreviews(canvas);
            const newPreview = previews.previewPng;
            const newPreviewSvg = previews.previewSvg;

            setUnsavedSigns((prev) =>
              prev.map((sign) =>
                sign.id === activeUnsaved
                  ? {
                      ...sign,
                      preview: newPreview,
                      previewSvg: newPreviewSvg,
                    }
                  : sign
              )
            );
          } else if (
            activeProjectCanvas &&
            currentProjectCanvasIdRef.current === activeProjectCanvas
          ) {
            console.log(
              "Auto-saving project canvas:",
              activeProjectCanvas,
              "with",
              currentObjects,
              "objects"
            );
            await updateCanvasInCurrentProject(activeProjectCanvas, canvas);
            console.log("Auto-save completed for project canvas");

            // НОВЕ: Оновлюємо локальний project state з новим preview
            const previews = await generateCanvasPreviews(canvas);
            const newPreview = previews.previewPng;
            const newPreviewSvg = previews.previewSvg;

            setProject((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                canvases:
                  prev.canvases?.map((canv) =>
                    canv.id === activeProjectCanvas
                      ? {
                          ...canv,
                          preview: newPreview,
                          previewSvg: newPreviewSvg,
                        }
                      : canv
                  ) || [],
              };
            });
          }
        } catch (error) {
          console.error("Auto-save failed:", error);
        }
      }, 1000); // Increased debounce time to 1 second
    };

    // Handle canvas property changes
    const handleCanvasPropertyChange = () => {
      console.log("Canvas property changed, updating preview and saving");
      handleCanvasChange(); // Use same logic as object changes
    };

    events.forEach((event) => canvas.on(event, handleCanvasChange));
    canvasEvents.forEach((event) =>
      canvas.on(event, handleCanvasPropertyChange)
    );

    // Watch for canvas dimension changes
    const originalSetWidth = canvas.setWidth;
    const originalSetHeight = canvas.setHeight;
    const originalSetBackgroundColor = canvas.setBackgroundColor;
    const originalSet = canvas.set;

    canvas.setWidth = function (value) {
      const result = originalSetWidth.call(this, value);
      console.log("Canvas width changed to:", value);
      handleCanvasPropertyChange();
      return result;
    };

    canvas.setHeight = function (value) {
      const result = originalSetHeight.call(this, value);
      console.log("Canvas height changed to:", value);
      handleCanvasPropertyChange();
      return result;
    };

    if (originalSetBackgroundColor) {
      canvas.setBackgroundColor = function (color, callback) {
        const result = originalSetBackgroundColor.call(this, color, callback);
        console.log("Canvas background color changed to:", color);
        handleCanvasPropertyChange();
        return result;
      };
    }

    canvas.set = function (property, value) {
      const result = originalSet.call(this, property, value);
      if (property === "backgroundColor") {
        console.log("Canvas background color set to:", value);
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
          if (mutation.type === "attributes") {
            const attrName = mutation.attributeName;
            if (
              attrName === "width" ||
              attrName === "height" ||
              attrName === "style"
            ) {
              console.log("Canvas DOM attribute changed:", attrName);
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
        attributeFilter: ["width", "height", "style"],
      });
    }

    return () => {
      events.forEach((event) => canvas.off(event, handleCanvasChange));
      canvasEvents.forEach((event) =>
        canvas.off(event, handleCanvasPropertyChange)
      );

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

  const handleNewSign = async () => {
    try {
      let currentUnsavedId = null;
      try {
        currentUnsavedId = localStorage.getItem("currentUnsavedSignId");
      } catch {}
      if (currentUnsavedId && canvas) {
        await updateUnsavedSignFromCanvas(currentUnsavedId, canvas).catch(
          () => {}
        );
      }

      // Розміри прямокутника за замовчуванням (120x80 мм при 96 DPI)
      const PX_PER_MM = 72 / 25.4;
      const DEFAULT_WIDTH = Math.round(120 * PX_PER_MM); // ~453 px
      const DEFAULT_HEIGHT = Math.round(80 * PX_PER_MM); // ~302 px

      const newSign = await addBlankUnsavedSign(DEFAULT_WIDTH, DEFAULT_HEIGHT);

      try {
        window.dispatchEvent(new CustomEvent("unsaved:signsUpdated"));
      } catch {}

      // Автоматично відкриваємо новостворене полотно
      setTimeout(() => {
        try {
          window.dispatchEvent(
            new CustomEvent("canvas:autoOpen", {
              detail: { canvasId: newSign.id, isUnsaved: true },
            })
          );
          console.log("Auto-opening new canvas:", newSign.id);
        } catch (err) {
          console.error("Failed to auto-open new canvas:", err);
        }
      }, 300);
    } catch (e) {
      console.error("New Sign failed", e);
    }
  };

  if (!project) return null;

  return (
    <>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <button
            className={styles.navBtn}
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            &lt;&lt;
          </button>
          {ranges.map((r) => (
            <button
              key={r.page}
              className={`${styles.rangesBtn} ${
                page === r.page ? styles.rangesBtnActive : ""
              }`}
              onClick={() => setPage(r.page)}
            >
              <div className={styles.layoutControls}>
                <button
                  type="button"
                  className={styles.layoutPlannerBtn}
                  onClick={() => setIsLayoutModalOpen(true)}
                >
                  PDF
                </button>
              </div>
              {r.start}–{r.end}
            </button>
          ))}
          <button
            className={styles.navBtn}
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            &gt;&gt;
          </button>
        </div>

        {current.length === 0 ? (
          <div className={styles.empty}>No canvases in current project.</div>
        ) : (
          <div className={styles.grid}>
            {current.map((c, index) => {
              // Обчислюємо глобальний індекс елемента
              const globalIndex = startIndex + index + 1;

              // ВИПРАВЛЕННЯ: Використовуємо тільки збережені preview (SVG або PNG) з безпечною перевіркою
              const hasSvgPreview =
                c.previewSvg &&
                typeof c.previewSvg === "string" &&
                c.previewSvg.trim().length > 0;
              const hasPngPreview =
                c.preview &&
                typeof c.preview === "string" &&
                c.preview.trim().length > 0;
              const preferPngPreview = Boolean(
                c.toolbarState?.hasBorder && hasPngPreview
              );

              const previewSrc = preferPngPreview
                ? c.preview
                : hasSvgPreview
                ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
                    c.previewSvg
                  )}`
                : hasPngPreview
                ? c.preview
                : null;

              return (
                <div
                  key={c.id}
                  className={`${styles.item} ${
                    selectedId === c.id ? styles.selected : ""
                  }`}
                  onClick={() => openCanvas(c)}
                >
                  {/* Нумерація слайду */}
                  <div
                    className={styles.slideNumber}
                    style={{
                      backgroundColor:
                        selectedId === c.id ? "#159DFF" : "#ffffff",
                      color: selectedId === c.id ? "#ffffff" : "#000000",
                    }}
                  >
                    {globalIndex}
                  </div>

                  <div className={styles.thumb}>
                    {previewSrc ? (
                      <img
                        src={previewSrc}
                        alt="preview"
                        onError={(e) => {
                          if (hasSvgPreview && hasPngPreview) {
                            e.target.onerror = null;
                            e.target.src = c.preview;
                          }
                        }}
                      />
                    ) : (
                      <span>Preview</span>
                    )}
                  </div>
                  <div className={styles.meta}>
                    <span>
                      {pxToMm(c.width)} × {pxToMm(c.height)} (mm)
                    </span>
                    <span>
                      {c.copiesCount || c.toolbarState?.copiesCount || 1} pcs
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Кнопка створення нового полотна */}
            <div
              className={styles.newSignButton}
              onClick={handleNewSign}
              title="Create new canvas (sign)"
            >
              <div className={styles.newSignButtonContent}>
                <svg
                  width="102"
                  height="102"
                  viewBox="0 0 102 102"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g style={{ mixBlendMode: "plus-darker" }}>
                    <path
                      d="M12.75 85V17C12.75 13.6185 14.0943 10.3764 16.4854 7.98535C18.8764 5.59426 22.1185 4.25 25.5 4.25H59.5L59.9192 4.27075C60.8924 4.36718 61.8073 4.79751 62.5049 5.49512L88.0049 30.9951C88.8019 31.7922 89.25 32.8728 89.25 34V85C89.25 88.3815 87.9057 91.6236 85.5146 94.0147C83.1236 96.4057 79.8815 97.75 76.5 97.75H25.5C22.1185 97.75 18.8764 96.4057 16.4854 94.0147C14.0943 91.6236 12.75 88.3815 12.75 85ZM21.25 85C21.25 86.1272 21.6981 87.2079 22.4951 88.0049C23.2921 88.8019 24.3728 89.25 25.5 89.25H76.5C77.6272 89.25 78.7078 88.8019 79.5049 88.0049C80.3019 87.2079 80.75 86.1272 80.75 85V35.7598L57.7402 12.75H25.5C24.3728 12.75 23.2921 13.1981 22.4951 13.9951C21.6981 14.7921 21.25 15.8728 21.25 17V85Z"
                      fill="#138E32"
                    />
                    <path
                      d="M55.25 8.5C55.25 6.15279 57.1528 4.25 59.5 4.25C61.8472 4.25 63.75 6.15279 63.75 8.5V29.75H85C87.3472 29.75 89.25 31.6528 89.25 34C89.25 36.3472 87.3472 38.25 85 38.25H59.5C57.1528 38.25 55.25 36.3472 55.25 34V8.5Z"
                      fill="#138E32"
                    />
                    <path
                      d="M46.75 76.5V51C46.75 48.6528 48.6528 46.75 51 46.75C53.3472 46.75 55.25 48.6528 55.25 51V76.5C55.25 78.8472 53.3472 80.75 51 80.75C48.6528 80.75 46.75 78.8472 46.75 76.5Z"
                      fill="#138E32"
                    />
                    <path
                      d="M63.75 59.5C66.0972 59.5 68 61.4028 68 63.75C68 66.0972 66.0972 68 63.75 68H38.25C35.9028 68 34 66.0972 34 63.75C34 61.4028 35.9028 59.5 38.25 59.5H63.75Z"
                      fill="#138E32"
                    />
                  </g>
                </svg>
              </div>
              <div className={styles.newSignButtonLabel}>
                Create the new sign
              </div>
            </div>
          </div>
        )}
      </div>

      <LayoutPlannerModal
        isOpen={isLayoutModalOpen}
        onClose={() => setIsLayoutModalOpen(false)}
        designs={designPayloads}
        spacingMm={5}
      />
    </>
  );
};

export default ProjectCanvasesGrid;
