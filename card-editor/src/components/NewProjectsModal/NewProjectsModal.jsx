import React from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { getProject, deleteProject, saveCurrentProject } from "../../utils/projectStorage";
import styles from "./NewProjectsModal.module.css";

const NewProjectsModal = ({ onClose, onRequestSaveAs }) => {
  const { canvas } = useCanvasContext();

  const handleSave = async () => {
    let currentProjectId = null;
    try { currentProjectId = localStorage.getItem("currentProjectId"); } catch {}
    if (!canvas) { onClose && onClose(); return; }
    if (currentProjectId) {
      // Update existing project only
      try { await saveCurrentProject(canvas); } catch (e) { console.error("Update project failed", e); }
      // Auto clear canvas after saving (user requested)
      try {
        canvas.__suspendUndoRedo = true;
        canvas.discardActiveObject && canvas.discardActiveObject();
        canvas.clear();
        canvas.renderAll();
        canvas.__suspendUndoRedo = false;
        window.dispatchEvent(new CustomEvent("project:afterSaveCleared", { detail: { projectId: currentProjectId } }));
      } catch {}
      onClose && onClose();
    } else {
      // Need name -> open Save As
      if (onRequestSaveAs) onRequestSaveAs(); else onClose && onClose();
    }
  };

  const handleDiscard = () => {
    let currentProjectId = null;
    try { currentProjectId = localStorage.getItem("currentProjectId"); } catch {}
    // Delete entire project if present
    if (currentProjectId) {
      getProject(currentProjectId).then(p => {
        if (p) deleteProject(currentProjectId).catch(()=>{});
      }).catch(()=>{});
    }
    try { localStorage.removeItem("currentProjectId"); localStorage.removeItem("currentProjectName"); localStorage.removeItem("currentCanvasId"); } catch {}
    if (canvas) {
      try { canvas.__suspendUndoRedo = true; canvas.clear(); canvas.renderAll(); canvas.__suspendUndoRedo = false; } catch {}
    }
    try { window.dispatchEvent(new CustomEvent("project:reset")); } catch {}
    onClose && onClose();
  };
  const handleCancel = () => onClose && onClose();

  return (
    <div className={styles.newProjectsModal}>
      <p>
        Before creating a <strong>New Project</strong>, please <strong>Save</strong> or <strong>Discard</strong> your current work.
      </p>
      <div className={styles.buttonContainer}>
        <button className={styles.active} onClick={handleSave}>Save</button>
        <button onClick={handleDiscard}>Discard</button>
        <button onClick={handleCancel}>Cancel</button>
      </div>
    </div>
  );
};

export default NewProjectsModal;
