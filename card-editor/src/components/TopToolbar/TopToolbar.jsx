import React, { useState, useEffect } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
  import { useUndoRedo } from "../../hooks/useUndoRedo";
import { useExcelImport } from "../../hooks/useExcelImport";
import * as fabric from "fabric";
import styles from "./TopToolbar.module.css";
import InfoAboutProject from "../InfoAboutProject/InfoAboutProject";
import SaveAsModal from "../SaveAsModal/SaveAsModal";
import YourProjectsModal from "../YourProjectsModal/YourProjectsModal";
import NewProjectsModal from "../NewProjectsModal/NewProjectsModal";
import PreviewModal from "../PreviewModal/PreviewModal";
import { 
  saveCurrentProject, 
  saveNewProject,
  clearAllUnsavedSigns,
  addBlankUnsavedSign
} from "../../utils/projectStorage";

const TopToolbar = ({ className }) => {
  const { 
    undo, 
    redo, 
    canUndo, 
    canRedo
  } = useUndoRedo();
  const { importFromExcel, exportToExcel } = useExcelImport();
  const { canvas } = useCanvasContext();
  const [zoom, setZoom] = useState(100); // legacy fabric zoom (kept for compatibility)
  const [displayScale, setDisplayScale] = useState(100); // viewport scale (auto-fit or CSS scaling) relative to design size
  const [zoomInput, setZoomInput] = useState("100"); // editable input string
  const [isSaveAsModalOpen, setSaveAsModalOpen] = useState(false);
  const [isProjectsModalOpen, setProjectsModalOpen] = useState(false);
  const [isNewProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!canvas || isSaving) return;
    
    // Перевіряємо чи проект вже збережений
    let currentProjectId = null;
    try {
      currentProjectId = localStorage.getItem("currentProjectId");
    } catch {}
    
    // Якщо проект не збережений - відкриваємо SaveAsModal
    if (!currentProjectId) {
      setSaveAsModalOpen(true);
      return;
    }
    
    // Якщо збережений - оновлюємо проект
    setIsSaving(true);
    try {
      await saveCurrentProject(canvas);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewProject = async () => {
    if (!canvas) return;
    
    // Перевіряємо чи є збережений проект
    let currentProjectId = null;
    try {
      currentProjectId = localStorage.getItem("currentProjectId");
    } catch {}
    
    // Якщо проект вже збережений - просто створюємо новий без модалки
    if (currentProjectId) {
      // Очищуємо localStorage
      try {
        localStorage.removeItem("currentProjectId");
        localStorage.removeItem("currentProjectName");
        localStorage.removeItem("currentCanvasId");
        localStorage.removeItem("currentUnsavedSignId");
      } catch {}
      
      // Очищуємо canvas
      try {
        canvas.__suspendUndoRedo = true;
        canvas.discardActiveObject && canvas.discardActiveObject();
        canvas.clear();
        canvas.renderAll();
        canvas.__suspendUndoRedo = false;
      } catch {}
      
      // Скидаємо toolbar state до дефолтних значень
      if (window.restoreToolbarState) {
        try {
          window.restoreToolbarState({
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
          });
        } catch (e) {
          console.error("Failed to reset toolbar state", e);
        }
      }
      
      // Очищаємо всі unsaved signs перед створенням нового
      try {
        await clearAllUnsavedSigns();
      } catch (e) {
        console.error("Failed to clear unsaved signs", e);
      }
      
      // Створюємо нове полотно за замовчуванням
      try {
        // Розміри прямокутника за замовчуванням (120x80 мм при 96 DPI)
        const PX_PER_MM = 96 / 25.4;
        const DEFAULT_WIDTH = Math.round(120 * PX_PER_MM); // ~453 px
        const DEFAULT_HEIGHT = Math.round(80 * PX_PER_MM); // ~302 px
        
        const newSign = await addBlankUnsavedSign(DEFAULT_WIDTH, DEFAULT_HEIGHT);
        
        // Встановлюємо новий sign як активний
        try {
          localStorage.setItem("currentUnsavedSignId", newSign.id);
        } catch {}
        
        // Відправляємо подію про оновлення unsaved signs
        window.dispatchEvent(new CustomEvent("unsaved:signsUpdated"));
        
        // Відправляємо подію про reset проекту (після створення нового полотна)
        window.dispatchEvent(new CustomEvent("project:reset"));
        
        // Даємо час на оновлення state і автоматично відкриваємо полотно
        setTimeout(() => {
          console.log('Dispatching canvas:autoOpen from TopToolbar for new sign:', newSign.id);
          window.dispatchEvent(new CustomEvent("canvas:autoOpen", { 
            detail: { canvasId: newSign.id, isUnsaved: true } 
          }));
        }, 500);
      } catch (e) {
        console.error("Failed to create default canvas", e);
      }
    } else {
      // Якщо проект не збережений - показуємо модалку
      setNewProjectModalOpen(true);
    }
  };

  const handleDelete = () => {
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      // Якщо обраний об'єкт є групою (кілька елементів)
      if (activeObject.type === "activeSelection") {
        const objects = activeObject.getObjects();
        canvas.discardActiveObject();
        objects.forEach((obj) => canvas.remove(obj));
      } else {
        // Видаляємо один елемент
        canvas.remove(activeObject);
      }
      canvas.renderAll();
    }
  };

  const handleZoomIn = () => {
    if (!canvas) return;
    // Work in effective scale units; apply via CSS scaling API
    const effective = Math.round(displayScale);
    const dynamicMax = typeof canvas.getMaxDisplayScalePercent === "function"
      ? canvas.getMaxDisplayScalePercent()
      : 500;
    const next = Math.min(effective + 1, dynamicMax);
    const applied = typeof canvas.setDisplayScale === "function"
      ? canvas.setDisplayScale(next)
      : next;
    setZoomInput(String(applied));
  };

  const handleZoomOut = () => {
    if (!canvas) return;
  const effective = Math.round(displayScale);
  const dynamicMin = typeof canvas.getMinDisplayScalePercent === "function"
    ? canvas.getMinDisplayScalePercent()
    : 10;
  const next = Math.max(effective - 1, dynamicMin);
    const applied = typeof canvas.setDisplayScale === "function"
      ? canvas.setDisplayScale(next)
      : next;
    setZoomInput(String(applied));
  };

  const handleZoomInputChange = (e) => {
    // Free-typing: keep only digits, allow empty while editing; no clamping here
    const raw = e.target.value;
    const digits = (raw || "").replace(/[^0-9]/g, "");
    setZoomInput(digits);
  };

  const commitZoomInput = () => {
    const digits = (zoomInput || "").replace(/[^0-9]/g, "");
    if (!digits) {
      setZoomInput(String(Math.round(displayScale)));
      return;
    }
    let value = parseInt(digits, 10);
    if (isNaN(value)) value = Math.round(displayScale);
    const dynamicMax = canvas && typeof canvas.getMaxDisplayScalePercent === "function"
      ? canvas.getMaxDisplayScalePercent()
      : 500;
    const dynamicMin = canvas && typeof canvas.getMinDisplayScalePercent === "function"
      ? canvas.getMinDisplayScalePercent()
      : 10;
    value = Math.min(dynamicMax, Math.max(dynamicMin, value));
    if (canvas && typeof canvas.setDisplayScale === "function") {
      const applied = canvas.setDisplayScale(value);
      setZoomInput(String(applied));
    } else {
      setZoomInput(String(value));
    }
  };

  const handleZoomInputBlur = () => {
    commitZoomInput();
  };

  const handleZoomInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitZoomInput();
      e.currentTarget.blur();
    }
  };

  // Додаємо підтримку клавіші Delete та Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Обробка Ctrl+S для збереження проекту
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }
      
      // Обробка Delete для видалення об'єктів
      if (e.key === "Delete" || e.key === "Backspace") {
        // Якщо фокус в полі вводу або активний текст в режимі редагування — не видаляти
        const tag = (e.target && e.target.tagName) || "";
        const isFormInput = /INPUT|TEXTAREA|SELECT/.test(tag);
        let isEditingText = false;
        try {
          const obj = canvas?.getActiveObject?.();
          isEditingText = !!(
            obj &&
            (obj.type === "i-text" ||
              obj.type === "textbox" ||
              obj.type === "text") &&
            obj.isEditing
          );
        } catch {}
        if (!isFormInput && !isEditingText) {
          e.preventDefault();
          handleDelete();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [canvas, isSaving]);

  // Синхронізуємо zoom state з canvas при ініціалізації
  useEffect(() => {
    if (canvas) {
      const currentZoom = canvas.getZoom();
      setZoom(Math.round(currentZoom * 100));
    }
  }, [canvas]);

  // Listen for custom display:scale events fired by Canvas (auto-fit scale changes)
  useEffect(() => {
    if (!canvas) return;
    const handler = (e) => {
      if (e?.scale) {
  const pct = Math.round(e.scale * 100);
  setDisplayScale(pct);
  setZoomInput(String(pct));
      }
    };
    canvas.on("display:scale", handler);
    // Try initial computation if methods exist
    try {
      if (
        typeof canvas.getCssSize === "function" &&
        typeof canvas.getDesignSize === "function"
      ) {
        const css = canvas.getCssSize();
        const design = canvas.getDesignSize();
        if (css?.width && design?.width) {
          const pct = Math.round((css.width / design.width) * 100);
          setDisplayScale(pct);
          setZoomInput(String(pct));
        }
      }
    } catch {}
    return () => canvas.off("display:scale", handler);
  }, [canvas]);
  return (
    <div className={`${styles.topToolbar} ${className}`}>
      <div className={styles.leftSide}>
        <div className={styles.toolbarRow}>
          <ul className={styles.toolbarList}>
            <li className={styles.toolbarItem} onClick={importFromExcel}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clip-path="url(#clip0_82_562)">
                  <path
                    d="M21 21V6.75L14.25 0H6C5.20435 0 4.44129 0.316071 3.87868 0.87868C3.31607 1.44129 3 2.20435 3 3V21C3 21.7956 3.31607 22.5587 3.87868 23.1213C4.44129 23.6839 5.20435 24 6 24H18C18.7956 24 19.5587 23.6839 20.1213 23.1213C20.6839 22.5587 21 21.7956 21 21ZM14.25 4.5C14.25 5.09674 14.4871 5.66903 14.909 6.09099C15.331 6.51295 15.9033 6.75 16.5 6.75H19.5V13.5H4.5V3C4.5 2.60218 4.65804 2.22064 4.93934 1.93934C5.22064 1.65804 5.60218 1.5 6 1.5H14.25V4.5ZM4.5 18V15H7.5V18H4.5ZM4.5 19.5H7.5V22.5H6C5.60218 22.5 5.22064 22.342 4.93934 22.0607C4.65804 21.7794 4.5 21.3978 4.5 21V19.5ZM9 22.5V19.5H13.5V22.5H9ZM15 22.5V19.5H19.5V21C19.5 21.3978 19.342 21.7794 19.0607 22.0607C18.7794 22.342 18.3978 22.5 18 22.5H15ZM19.5 18H15V15H19.5V18ZM9 18V15H13.5V18H9Z"
                    fill="#009951"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_82_562">
                    <rect width="24" height="24" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              Import via Excel
            </li>
            <li className={styles.toolbarItem}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 19V5C3 3.89543 3.89543 3 5 3H16.1716C16.702 3 17.2107 3.21071 17.5858 3.58579L20.4142 6.41421C20.7893 6.78929 21 7.29799 21 7.82843V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19Z"
                  stroke="#007AFF"
                  stroke-width="1.5"
                />
                <path
                  d="M8.6 9H15.4C15.7314 9 16 8.73137 16 8.4V3.6C16 3.26863 15.7314 3 15.4 3H8.6C8.26863 3 8 3.26863 8 3.6V8.4C8 8.73137 8.26863 9 8.6 9Z"
                  stroke="#007AFF"
                  stroke-width="1.5"
                />
                <path
                  d="M6 13.6V21H18V13.6C18 13.2686 17.7314 13 17.4 13H6.6C6.26863 13 6 13.2686 6 13.6Z"
                  stroke="#007AFF"
                  stroke-width="1.5"
                />
              </svg>
              Save as Template
            </li>
            <li className={styles.toolbarItem}>
              <svg
                width="21"
                height="24"
                viewBox="0 0 21 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M17.118 21.8578V15.4348H19.26V23.9998H0V15.4348H2.142V21.8578H17.118Z"
                  fill="#007AFF"
                />
                <path
                  d="M4.28613 19.7173H14.9916V17.5753H4.28613V19.7173ZM13.8816 -0.000244141L12.1626 1.27776L18.5526 9.86827L20.2716 8.59027L13.8816 -0.000244141ZM8.57163 5.06526L16.7976 11.9158L18.1671 10.2703L9.94113 3.41976L8.57013 5.06526H8.57163ZM5.88363 9.82477L15.5886 14.3443L16.4931 12.4033L6.78813 7.88377L5.88363 9.82477ZM4.49613 14.8408L14.9736 17.0443L15.4146 14.9473L4.93713 12.7453L4.49613 14.8408Z"
                  fill="#007AFF"
                />
              </svg>
              Templates
            </li>
          </ul>
          <div
            className={styles.topToolbarEL}
            onClick={() => setPreviewOpen(true)}
            style={{ cursor: "pointer" }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g clip-path="url(#clip0_82_269)">
                <path
                  d="M15 13V17"
                  stroke="#0F172A"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M13 15H17"
                  stroke="#0F172A"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M15 20C17.7614 20 20 17.7614 20 15C20 12.2386 17.7614 10 15 10C12.2386 10 10 12.2386 10 15C10 17.7614 12.2386 20 15 20Z"
                  stroke="#0F172A"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M22 22L19 19"
                  stroke="#0F172A"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M6 18H5C4.46957 18 3.96086 17.7893 3.58579 17.4142C3.21071 17.0391 3 16.5304 3 16V15"
                  stroke="#0F172A"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M3 11V10"
                  stroke="#0F172A"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M3 6V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H6"
                  stroke="#0F172A"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M10 3H11"
                  stroke="#0F172A"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M15 3H16C16.5304 3 17.0391 3.21071 17.4142 3.58579C17.7893 3.96086 18 4.46957 18 5V6"
                  stroke="#0F172A"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </g>
              <defs>
                <clipPath id="clip0_82_269">
                  <rect width="24" height="24" fill="white" />
                </clipPath>
              </defs>
            </svg>
            Preview
          </div>
          <div className={styles.topToolbarEL}>
            <div className={styles.fontSizeControl}>
              <button className={styles.sizeButton} onClick={handleZoomOut}>
                -
              </button>
              <input
                type="text"
                className={styles.fontSizeInput}
                value={zoomInput}
                onChange={handleZoomInputChange}
                onBlur={handleZoomInputBlur}
                onKeyDown={handleZoomInputKeyDown}
                title="Масштаб відносно макету, % (10–500)"
                inputMode="numeric"
                placeholder="100"
              />
              <span className={styles.fontSizePercent}>%</span>
              <button className={styles.sizeButton} onClick={handleZoomIn}>
                +
              </button>
            </div>
          </div>
        </div>
        <div className={styles.toolbarRow}>
          <div className={styles.buttonWrapper}>
            <button
              className={styles.blueButton}
              onClick={handleNewProject}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
                  stroke="white"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M14 2V8H20"
                  stroke="white"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M12 18V12"
                  stroke="white"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M9 15H15"
                  stroke="white"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              New project
            </button>
            <button
              className={styles.blueButton}
              onClick={() => setProjectsModalOpen(true)}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 4.75C1 3.784 1.784 3 2.75 3H7.721C8.301 3 8.841 3.286 9.168 3.765L10.572 5.828C10.618 5.897 10.696 5.938 10.779 5.938H19.25C20.216 5.938 21 6.721 21 7.688V19.25C21 19.7141 20.8156 20.1592 20.4874 20.4874C20.1592 20.8156 19.7141 21 19.25 21H2.75C2.28587 21 1.84075 20.8156 1.51256 20.4874C1.18437 20.1592 1 19.7141 1 19.25V4.75ZM2.75 4.5C2.6837 4.5 2.62011 4.52634 2.57322 4.57322C2.52634 4.62011 2.5 4.6837 2.5 4.75V19.25C2.5 19.388 2.612 19.5 2.75 19.5H19.25C19.3163 19.5 19.3799 19.4737 19.4268 19.4268C19.4737 19.3799 19.5 19.3163 19.5 19.25V7.687C19.5 7.6207 19.4737 7.55711 19.4268 7.51022C19.3799 7.46334 19.3163 7.437 19.25 7.437H10.779C10.4937 7.43709 10.2128 7.36743 9.96055 7.2341C9.70835 7.10076 9.49257 6.9078 9.332 6.672L7.928 4.61C7.9049 4.57613 7.87387 4.5484 7.83763 4.52923C7.80138 4.51006 7.761 4.50003 7.72 4.5H2.75Z"
                  fill="white"
                />
              </svg>
              Your project
            </button>
          </div>
          <div className={styles.topToolbarEL} onClick={handleSave}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 19V5C3 3.89543 3.89543 3 5 3H16.1716C16.702 3 17.2107 3.21071 17.5858 3.58579L20.4142 6.41421C20.7893 6.78929 21 7.29799 21 7.82843V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19Z"
                stroke="#0F172A"
                stroke-width="1.5"
              />
              <path
                d="M8.6 9H15.4C15.7314 9 16 8.73137 16 8.4V3.6C16 3.26863 15.7314 3 15.4 3H8.6C8.26863 3 8 3.26863 8 3.6V8.4C8 8.73137 8.26863 9 8.6 9Z"
                stroke="#0F172A"
                stroke-width="1.5"
              />
              <path
                d="M6 13.6V21H18V13.6C18 13.2686 17.7314 13 17.4 13H6.6C6.26863 13 6 13.2686 6 13.6Z"
                stroke="#0F172A"
                stroke-width="1.5"
              />
            </svg>
            {isSaving ? "Saving..." : "Save Project"}
          </div>
          <div
            className={styles.topToolbarEL}
            onClick={() => setSaveAsModalOpen(true)}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 7.5V5C3 3.89543 3.89543 3 5 3H16.1716C16.702 3 17.2107 3.21071 17.5858 3.58579L20.4142 6.41421C20.7893 6.78929 21 7.29799 21 7.82843V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V16.5"
                stroke="#0F172A"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M6 21V17"
                stroke="#0F172A"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M18 21V13.6C18 13.2686 17.7314 13 17.4 13H15"
                stroke="#0F172A"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M16 3V8.4C16 8.73137 15.7314 9 15.4 9H13.5"
                stroke="#0F172A"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M8 3V6"
                stroke="#0F172A"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M12 12L9 15M1 12H12H1ZM12 12L9 9L12 12Z"
                stroke="#009951"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Save Project as
          </div>
          <div
            className={`${styles.topToolbarEL} ${
              !canUndo ? styles.disabled : ""
            }`}
            onClick={canUndo ? undo : undefined}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5.00005 9L5.00005 9.75H5.00005V9ZM6.00005 18.25C5.58584 18.25 5.25005 18.5858 5.25005 19C5.25005 19.4142 5.58584 19.75 6.00005 19.75V18.25ZM6.67204 13.5327C6.96624 13.8243 7.44111 13.8222 7.73269 13.528C8.02427 13.2338 8.02216 12.7589 7.72796 12.4673L6.67204 13.5327ZM5.78962 11.6022L5.26167 12.1348H5.26167L5.78962 11.6022ZM5.78962 6.39785L5.26167 5.86516L5.26167 5.86516L5.78962 6.39785ZM7.72796 5.53269C8.02216 5.24111 8.02427 4.76624 7.73269 4.47204C7.44111 4.17784 6.96624 4.17573 6.67204 4.46731L7.72796 5.53269ZM4.01591 9.25067L3.27193 9.34549L3.27193 9.3455L4.01591 9.25067ZM4.01591 8.74933L3.27193 8.6545L3.27193 8.65451L4.01591 8.74933ZM5.00005 9V9.75H14V9V8.25H5.00005V9ZM14 19V18.25H6.00005V19V19.75H14V19ZM19 14H18.25C18.25 16.3472 16.3473 18.25 14 18.25V19V19.75C17.1757 19.75 19.75 17.1756 19.75 14H19ZM14 9V9.75C16.3473 9.75 18.25 11.6528 18.25 14H19H19.75C19.75 10.8244 17.1757 8.25 14 8.25V9ZM7.2 13L7.72796 12.4673L6.31758 11.0695L5.78962 11.6022L5.26167 12.1348L6.67204 13.5327L7.2 13ZM5.78962 6.39785L6.31758 6.93054L7.72796 5.53269L7.2 5L6.67204 4.46731L5.26167 5.86516L5.78962 6.39785ZM5.78962 11.6022L6.31758 11.0695C5.74268 10.4997 5.35733 10.1161 5.09823 9.79351C4.84863 9.48272 4.77852 9.302 4.75989 9.15584L4.01591 9.25067L3.27193 9.3455C3.33989 9.87869 3.59427 10.3163 3.92869 10.7328C4.25361 11.1373 4.71182 11.5899 5.26167 12.1348L5.78962 11.6022ZM5.78962 6.39785L5.26167 5.86516C4.71182 6.41012 4.25362 6.86265 3.92869 7.26724C3.59427 7.68366 3.33989 8.12131 3.27193 8.6545L4.01591 8.74933L4.75989 8.84416C4.77852 8.698 4.84863 8.51728 5.09823 8.20649C5.35733 7.88386 5.74268 7.50033 6.31758 6.93054L5.78962 6.39785ZM4.01591 9.25067L4.75989 9.15584C4.7533 9.10409 4.75 9.05204 4.75 9H4H3.25C3.25 9.1154 3.25731 9.23079 3.27193 9.34549L4.01591 9.25067ZM4 9H4.75C4.75 8.94796 4.7533 8.89591 4.75989 8.84416L4.01591 8.74933L3.27193 8.65451C3.25731 8.76921 3.25 8.8846 3.25 9H4ZM5.00005 9L5.00005 8.25L4 8.25L4 9L4 9.75L5.00005 9.75L5.00005 9Z"
                fill={canUndo ? "#2D264B" : "#CCCCCC"}
              />
            </svg>
          </div>
          <div
            className={`${styles.topToolbarEL} ${
              !canRedo ? styles.disabled : ""
            }`}
            onClick={canRedo ? redo : undefined}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 9L19 9.75H19V9ZM18 18.25C18.4142 18.25 18.75 18.5858 18.75 19C18.75 19.4142 18.4142 19.75 18 19.75V18.25ZM17.328 13.5327C17.0338 13.8243 16.5589 13.8222 16.2673 13.528C15.9757 13.2338 15.9778 12.7589 16.272 12.4673L17.328 13.5327ZM18.2104 11.6022L18.7383 12.1348H18.7383L18.2104 11.6022ZM18.2104 6.39785L18.7383 5.86516L18.7383 5.86516L18.2104 6.39785ZM16.272 5.53269C15.9778 5.24111 15.9757 4.76624 16.2673 4.47204C16.5589 4.17784 17.0338 4.17573 17.328 4.46731L16.272 5.53269ZM19.9841 9.25067L20.7281 9.34549L20.7281 9.3455L19.9841 9.25067ZM19.9841 8.74933L20.7281 8.6545L20.7281 8.65451L19.9841 8.74933ZM19 9V9.75H9.99995V9V8.25H19V9ZM9.99995 19V18.25H18V19V19.75H9.99995V19ZM4.99995 14H5.74995C5.74995 16.3472 7.65274 18.25 9.99995 18.25V19V19.75C6.82432 19.75 4.24995 17.1756 4.24995 14H4.99995ZM9.99995 9V9.75C7.65274 9.75 5.74995 11.6528 5.74995 14H4.99995H4.24995C4.24995 10.8244 6.82432 8.25 9.99995 8.25V9ZM16.8 13L16.272 12.4673L17.6824 11.0695L18.2104 11.6022L18.7383 12.1348L17.328 13.5327L16.8 13ZM18.2104 6.39785L17.6824 6.93054L16.272 5.53269L16.8 5L17.328 4.46731L18.7383 5.86516L18.2104 6.39785ZM18.2104 11.6022L17.6824 11.0695C18.2573 10.4997 18.6427 10.1161 18.9018 9.79351C19.1514 9.48272 19.2215 9.302 19.2401 9.15584L19.9841 9.25067L20.7281 9.3455C20.6601 9.87869 20.4057 10.3163 20.0713 10.7328C19.7464 11.1373 19.2882 11.5899 18.7383 12.1348L18.2104 11.6022ZM18.2104 6.39785L18.7383 5.86516C19.2882 6.41012 19.7464 6.86265 20.0713 7.26724C20.4057 7.68366 20.6601 8.12131 20.7281 8.6545L19.9841 8.74933L19.2401 8.84416C19.2215 8.698 19.1514 8.51728 18.9018 8.20649C18.6427 7.88386 18.2573 7.50033 17.6824 6.93054L18.2104 6.39785ZM19.9841 9.25067L19.2401 9.15584C19.2467 9.10409 19.25 9.05204 19.25 9H20H20.75C20.75 9.1154 20.7427 9.23079 20.7281 9.34549L19.9841 9.25067ZM20 9H19.25C19.25 8.94796 19.2467 8.89591 19.2401 8.84416L19.9841 8.74933L20.7281 8.65451C20.7427 8.76921 20.75 8.8846 20.75 9H20ZM19 9L18.9999 8.25L20 8.25L20 9L20 9.75L19 9.75L19 9Z"
                fill={canRedo ? "#2D264B" : "#CCCCCC"}
              />
            </svg>
          </div>
        </div>
      </div>
      <div className={styles.rightSide}>
        <InfoAboutProject />
      </div>
      {/* Додати модалку */}
      {isSaveAsModalOpen && (
        <SaveAsModal
          onClose={() => setSaveAsModalOpen(false)}
          onSaveAs={async (name) => {
            if (!name || !name.trim()) {
              alert("Please enter a project name");
              return;
            }
            setIsSaving(true);
            try {
              const savedProject = await saveNewProject(name, canvas);
              // Оновлюємо currentProjectId після збереження
              if (savedProject && savedProject.id) {
                localStorage.setItem("currentProjectId", savedProject.id);
                // Відправляємо подію для автоматичного відкриття полотна
                window.dispatchEvent(new CustomEvent("project:opened", { detail: { projectId: savedProject.id } }));
              }
              // Не закриваємо модалку після збереження - користувач може захотіти зберегти ще проекти
            } catch (e) {
              console.error("Save as failed:", e);
              alert("Failed to save project. Please try again.");
            } finally {
              setIsSaving(false);
            }
          }}
        />
      )}
      {isPreviewOpen && (
        <PreviewModal canvas={canvas} onClose={() => setPreviewOpen(false)} />
      )}
      {isProjectsModalOpen && (
        <YourProjectsModal onClose={() => setProjectsModalOpen(false)} />
      )}
      {isNewProjectModalOpen && (
        <NewProjectsModal
          onClose={() => setNewProjectModalOpen(false)}
          onRequestSaveAs={() => {
            setNewProjectModalOpen(false);
            setSaveAsModalOpen(true);
          }}
        />
      )}
    </div>
  );
};

export default TopToolbar;
