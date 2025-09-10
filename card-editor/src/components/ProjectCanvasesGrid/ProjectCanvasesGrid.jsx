import React, { useEffect, useMemo, useState } from "react";
import styles from "./ProjectCanvasesGrid.module.css";
import { getProject } from "../../utils/projectStorage";
import { useCanvasContext } from "../../contexts/CanvasContext";

// Renders 4x2 grid of canvases for the current project (from localStorage currentProjectId)
// Pagination similar to YourProjectsModal: ranges of 8 (1–8, 9–16, ...)
const PAGE_SIZE = 8;

const ProjectCanvasesGrid = () => {
  const { canvas } = useCanvasContext();
  const [project, setProject] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const load = () => {
      let id = null;
      try { id = localStorage.getItem("currentProjectId"); } catch {}
      if (!id) { setProject({ id: null, canvases: [] }); return; }
      getProject(id).then(setProject).catch(() => setProject({ id, canvases: [] }));
    };
    load();
    const updated = (e) => {
      const pid = e?.detail?.projectId;
      const currentId = (()=>{ try { return localStorage.getItem("currentProjectId"); } catch { return null; } })();
      if (!pid || pid === currentId) load();
    };
    const switched = () => load();
    const reset = () => load();
    window.addEventListener("project:canvasesUpdated", updated);
    window.addEventListener("project:switched", switched);
    window.addEventListener("project:reset", reset);
    return () => {
      window.removeEventListener("project:canvasesUpdated", updated);
      window.removeEventListener("project:switched", switched);
      window.removeEventListener("project:reset", reset);
    };
  }, []);

  const canvases = project?.canvases || [];
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
    try {
      const state = canvasEntry.json;
      // Use undo/redo restore if available; fallback to loadFromJSON
      if (typeof canvas.loadFromJSON === "function") {
        canvas.__suspendUndoRedo = true;
        canvas.loadFromJSON(state, () => {
          try { canvas.renderAll(); canvas.requestRenderAll(); } catch {}
          canvas.__suspendUndoRedo = false;
        });
      }
      setSelectedId(canvasEntry.id);
  try { localStorage.setItem("currentCanvasId", canvasEntry.id); } catch {}
    } catch (e) {
      console.error("Failed to open canvas", e);
    }
  };

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
          {current.map((c) => (
            <div key={c.id} className={`${styles.item} ${selectedId === c.id ? styles.selected : ""}`} onClick={() => openCanvas(c)}>
              <div className={styles.thumb}>
                {c.preview ? (
                  <img src={c.preview} alt="preview" />
                ) : (
                  <span>Preview</span>
                )}
              </div>
              <div className={styles.meta}>
                <span>{pxToMm(c.width)} × {pxToMm(c.height)} (mm)</span>
                <span>{/* optionally qty or index */}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectCanvasesGrid;
