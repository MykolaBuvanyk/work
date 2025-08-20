import React, { useEffect, useState, useCallback } from "react";
import styles from "./PreviewModal.module.css";

// Modal to show current Fabric canvas snapshot
const PreviewModal = ({ canvas, onClose }) => {
  const [dataUrl, setDataUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  const makeSnapshot = useCallback(() => {
    if (!canvas) return;
    try {
      setLoading(true);
      canvas.renderAll();
      const url = canvas.toDataURL({ format: "png", multiplier: 1 });
      setDataUrl(url);
    } finally {
      setLoading(false);
    }
  }, [canvas]);

  useEffect(() => {
    makeSnapshot();
  }, [makeSnapshot]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.headerWrapper}>
          <div className={styles.headerWrapperText}>
            <p className={styles.para}>Preview</p>
          </div>
          <svg
            onClick={onClose}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={styles.closeBtn}
          >
            <path
              d="M12.0003 12L14.8287 14.8284M9.17188 14.8284L12.0003 12L9.17188 14.8284ZM14.8287 9.17157L12.0003 12L14.8287 9.17157ZM12.0003 12L9.17188 9.17157L12.0003 12Z"
              stroke="#006CA4"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
              stroke="#006CA4"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className={styles.actions}>
          <button onClick={makeSnapshot} disabled={loading}>
            {loading ? "Updating..." : "Refresh"}
          </button>
          {dataUrl && (
            <a
              href={dataUrl}
              download={`canvas-preview-${Date.now()}.png`}
              className={styles.downloadBtn}
            >
              Download PNG
            </a>
          )}
        </div>
        <div className={styles.previewArea}>
          {dataUrl ? (
            <img src={dataUrl} alt="Canvas preview" />
          ) : (
            <div className={styles.placeholder}>No data</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
