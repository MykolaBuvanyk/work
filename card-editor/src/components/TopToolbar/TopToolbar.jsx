import React, { useState, useEffect } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import { useExcelImport } from "../../hooks/useExcelImport";
import * as fabric from "fabric";
import styles from "./TopToolbar.module.css";
import InfoAboutProject from "../InfoAboutProject/InfoAboutProject";
import SaveAsModal from "../SaveAsModal/SaveAsModal";
import PreviewModal from "../PreviewModal/PreviewModal";
import { saveCurrentProject, saveNewProject } from "../../utils/projectStorage";

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
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!canvas || isSaving) return;
    setIsSaving(true);
    try {
      await saveCurrentProject(canvas);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setIsSaving(false);
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

  // Додаємо підтримку клавіші Delete
  useEffect(() => {
    const handleKeyDown = (e) => {
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
  }, [canvas]);

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
          <div className={styles.topToolbarEL} onClick={handleSave} style={{cursor:"pointer", opacity: isSaving? 0.6: 1}}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g opacity="0.74" clip-path="url(#clip0_82_664)">
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M14.2992 4.29917C14.6509 3.94754 15.1278 3.75 15.6251 3.75C16.1223 3.75 16.5992 3.94754 16.9509 4.29917C17.3025 4.6508 17.5001 5.12772 17.5001 5.625V12.5C17.5001 12.8452 17.2202 13.125 16.8751 13.125C16.5299 13.125 16.2501 12.8452 16.2501 12.5V5.625C16.2501 5.45924 16.1842 5.30027 16.067 5.18306C15.9498 5.06585 15.7908 5 15.6251 5C15.4593 5 15.3003 5.06585 15.1831 5.18306C15.0659 5.30027 15.0001 5.45924 15.0001 5.625V10C15.0001 10.3452 14.7202 10.625 14.3751 10.625C14.0299 10.625 13.7501 10.3452 13.7501 10V5.625C13.7501 5.12772 13.9476 4.6508 14.2992 4.29917Z"
                  fill="#1E293B"
                />
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M11.7992 1.79917C12.1509 1.44754 12.6278 1.25 13.1251 1.25C13.6223 1.25 14.0992 1.44754 14.4509 1.79917C14.8025 2.15081 15.0001 2.62772 15.0001 3.125V10C15.0001 10.3452 14.7202 10.625 14.3751 10.625C14.0299 10.625 13.7501 10.3452 13.7501 10V3.125C13.7501 2.95924 13.6842 2.80027 13.567 2.68306C13.4498 2.56585 13.2908 2.5 13.1251 2.5C12.9593 2.5 12.8003 2.56585 12.6831 2.68306C12.5659 2.80027 12.5001 2.95924 12.5001 3.125V9.375C12.5001 9.72018 12.2202 10 11.8751 10C11.5299 10 11.2501 9.72018 11.2501 9.375V3.125C11.2501 2.62772 11.4476 2.15081 11.7992 1.79917Z"
                  fill="#1E293B"
                />
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M6.79923 2.42417C7.15086 2.07254 7.62777 1.875 8.12505 1.875C8.62233 1.875 9.09925 2.07254 9.45088 2.42417C9.80251 2.77581 10.0001 3.25272 10.0001 3.75V9.41406C10.0001 9.75924 9.72023 10.0391 9.37505 10.0391C9.02987 10.0391 8.75005 9.75924 8.75005 9.41406V3.75C8.75005 3.58424 8.6842 3.42527 8.56699 3.30806C8.44978 3.19085 8.29081 3.125 8.12505 3.125C7.95929 3.125 7.80032 3.19085 7.68311 3.30806C7.5659 3.42527 7.50005 3.58424 7.50005 3.75V12.5C7.50005 12.8452 7.22023 13.125 6.87505 13.125C6.52987 13.125 6.25005 12.8452 6.25005 12.5V3.75C6.25005 3.25272 6.4476 2.77581 6.79923 2.42417Z"
                  fill="#1E293B"
                />
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M9.29923 0.549175C9.65086 0.197544 10.1278 0 10.6251 0C11.1223 0 11.5992 0.197544 11.9509 0.549175C12.3025 0.900805 12.5001 1.37772 12.5001 1.875V9.375C12.5001 9.72018 12.2202 10 11.8751 10C11.5299 10 11.2501 9.72018 11.2501 9.375V1.875C11.2501 1.70924 11.1842 1.55027 11.067 1.43306C10.9498 1.31585 10.7908 1.25 10.6251 1.25C10.4593 1.25 10.3003 1.31585 10.1831 1.43306C10.0659 1.55027 10.0001 1.70924 10.0001 1.875V9.375C10.0001 9.72018 9.72023 10 9.37505 10C9.02987 10 8.75005 9.72018 8.75005 9.375V1.875C8.75005 1.37772 8.9476 0.900805 9.29923 0.549175Z"
                  fill="#1E293B"
                />
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M4.88552 9.33683C4.73515 9.08031 4.35992 8.96392 4.02761 9.15278C3.87059 9.24197 3.79971 9.35095 3.76901 9.47534C3.73419 9.61645 3.74156 9.82533 3.84149 10.0962L3.8421 10.0978L5.89446 15.709C6.26357 16.5853 6.7492 17.3261 7.49504 17.8556C8.24196 18.386 9.31423 18.75 10.9376 18.75C12.5136 18.75 13.8193 18.2291 14.7356 17.2339C15.6564 16.2338 16.2501 14.6824 16.2501 12.5C16.2501 12.1548 16.5299 11.875 16.8751 11.875C17.2202 11.875 17.5001 12.1548 17.5001 12.5C17.5001 14.9036 16.8437 16.7897 15.6552 18.0806C14.4621 19.3764 12.799 20 10.9376 20C9.12337 20 7.77944 19.5906 6.77137 18.8749C5.76595 18.161 5.15895 17.1877 4.73615 16.1792C4.73242 16.1703 4.7289 16.1613 4.72558 16.1522L2.66877 10.5289C2.66867 10.5286 2.66856 10.5283 2.66845 10.528C2.50846 10.094 2.4449 9.62372 2.55541 9.17587C2.67012 8.71104 2.96122 8.32096 3.41 8.06601C3.40996 8.06603 3.41004 8.06599 3.41 8.06601C4.2817 7.5707 5.48877 7.79801 6.00274 8.77455C6.01157 8.79135 6.01964 8.80853 6.02692 8.82606L7.45231 12.2604C7.58463 12.5792 7.43345 12.945 7.11464 13.0773C6.79583 13.2096 6.43011 13.0584 6.2978 12.7396L4.88552 9.33683Z"
                  fill="#1E293B"
                />
              </g>
              <defs>
                <clipPath id="clip0_82_664">
                  <rect width="20" height="20" fill="white" />
                </clipPath>
              </defs>
            </svg>
          </div>
        </div>
        <div className={styles.toolbarRow}>
          <div className={styles.topToolbarEL}>
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
            className={`${styles.topToolbarEL} ${styles.delete}`}
            onClick={handleDelete}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18.5172 12.7795L19.26 12.8829L18.5172 12.7795ZM18.2549 14.6645L18.9977 14.7679L18.2549 14.6645ZM5.74514 14.6645L6.48798 14.5611L5.74514 14.6645ZM5.4828 12.7795L4.73996 12.8829L5.4828 12.7795ZM9.18365 21.7368L8.89206 22.4278L9.18365 21.7368ZM6.47508 18.5603L7.17907 18.3017L6.47508 18.5603ZM17.5249 18.5603L18.2289 18.819V18.819L17.5249 18.5603ZM14.8164 21.7368L14.5248 21.0458H14.5248L14.8164 21.7368ZM5.74664 8.92906C5.70746 8.5167 5.34142 8.21418 4.92906 8.25336C4.5167 8.29254 4.21418 8.65858 4.25336 9.07094L5.74664 8.92906ZM19.7466 9.07094C19.7858 8.65858 19.4833 8.29254 19.0709 8.25336C18.6586 8.21418 18.2925 8.5167 18.2534 8.92906L19.7466 9.07094ZM20 7.75C20.4142 7.75 20.75 7.41421 20.75 7C20.75 6.58579 20.4142 6.25 20 6.25V7.75ZM4 6.25C3.58579 6.25 3.25 6.58579 3.25 7C3.25 7.41421 3.58579 7.75 4 7.75V6.25ZM9.25 18C9.25 18.4142 9.58579 18.75 10 18.75C10.4142 18.75 10.75 18.4142 10.75 18H9.25ZM10.75 10C10.75 9.58579 10.4142 9.25 10 9.25C9.58579 9.25 9.25 9.58579 9.25 10H10.75ZM13.25 18C13.25 18.4142 13.5858 18.75 14 18.75C14.4142 18.75 14.75 18.4142 14.75 18H13.25ZM14.75 10C14.75 9.58579 14.4142 9.25 14 9.25C13.5858 9.25 13.25 9.58579 13.25 10H14.75ZM16 7V7.75H16.75V7H16ZM8 7H7.25V7.75H8V7ZM18.5172 12.7795L17.7744 12.6761L17.512 14.5611L18.2549 14.6645L18.9977 14.7679L19.26 12.8829L18.5172 12.7795ZM5.74514 14.6645L6.48798 14.5611L6.22564 12.6761L5.4828 12.7795L4.73996 12.8829L5.0023 14.7679L5.74514 14.6645ZM12 22V21.25C10.4708 21.25 9.92544 21.2358 9.47524 21.0458L9.18365 21.7368L8.89206 22.4278C9.68914 22.7642 10.6056 22.75 12 22.75V22ZM5.74514 14.6645L5.0023 14.7679C5.282 16.7777 5.43406 17.9017 5.77109 18.819L6.47508 18.5603L7.17907 18.3017C6.91156 17.5736 6.77851 16.6488 6.48798 14.5611L5.74514 14.6645ZM9.18365 21.7368L9.47524 21.0458C8.55279 20.6566 7.69496 19.7058 7.17907 18.3017L6.47508 18.5603L5.77109 18.819C6.3857 20.4918 7.48205 21.8328 8.89206 22.4278L9.18365 21.7368ZM18.2549 14.6645L17.512 14.5611C17.2215 16.6488 17.0884 17.5736 16.8209 18.3017L17.5249 18.5603L18.2289 18.819C18.5659 17.9017 18.718 16.7777 18.9977 14.7679L18.2549 14.6645ZM12 22V22.75C13.3944 22.75 14.3109 22.7642 15.1079 22.4278L14.8164 21.7368L14.5248 21.0458C14.0746 21.2358 13.5292 21.25 12 21.25V22ZM17.5249 18.5603L16.8209 18.3017C16.305 19.7058 15.4472 20.6566 14.5248 21.0458L14.8164 21.7368L15.1079 22.4278C16.5179 21.8328 17.6143 20.4918 18.2289 18.819L17.5249 18.5603ZM5.4828 12.7795L6.22564 12.6761C6.00352 11.08 5.83766 9.88703 5.74664 8.92906L5 9L4.25336 9.07094C4.34819 10.069 4.51961 11.2995 4.73996 12.8829L5.4828 12.7795ZM18.5172 12.7795L19.26 12.8829C19.4804 11.2995 19.6518 10.069 19.7466 9.07094L19 9L18.2534 8.92906C18.1623 9.88702 17.9965 11.08 17.7744 12.6761L18.5172 12.7795ZM20 7V6.25H4V7V7.75H20V7ZM10 18H10.75V10H10H9.25V18H10ZM14 18H14.75V10H14H13.25V18H14ZM16 6H15.25V7H16H16.75V6H16ZM16 7V6.25H8V7V7.75H16V7ZM8 7H8.75V6H8H7.25V7H8ZM12 2V2.75C13.7949 2.75 15.25 4.20507 15.25 6H16H16.75C16.75 3.37665 14.6234 1.25 12 1.25V2ZM12 2V1.25C9.37665 1.25 7.25 3.37665 7.25 6H8H8.75C8.75 4.20507 10.2051 2.75 12 2.75V2Z"
                fill="#2D264B"
              />
            </svg>
            Delete
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
            Undo
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
            Redo
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
      </div>
      <div className={styles.rightSide}>
        <InfoAboutProject />
      </div>
      {/* Додати модалку */}
      {isSaveAsModalOpen && (
        <SaveAsModal onClose={() => setSaveAsModalOpen(false)} onSaveAs={async (name) => {
          try { await saveNewProject(name, canvas); } catch(e){ console.error(e);} finally { setSaveAsModalOpen(false); }
        }} />
      )}
      {isPreviewOpen && (
        <PreviewModal canvas={canvas} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
};

export default TopToolbar;
