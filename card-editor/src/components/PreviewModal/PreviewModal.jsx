import React, { useEffect, useState, useCallback, useRef } from "react";
import styles from "./PreviewModal.module.css";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;
const ZOOM_OUT_FACTOR = 0.85;
const ZOOM_IN_FACTOR = 1.15;

// Modal to show current Fabric canvas snapshot
const PreviewModal = ({ canvas, onClose }) => {
  const [dataUrl, setDataUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef(null);
  const dragStateRef = useRef(null);

  const clampZoom = useCallback(
    (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(value) ? value : 1)),
    []
  );

  const makeSnapshot = useCallback(() => {
    if (!canvas) return;
    try {
      setLoading(true);
      try { canvas.requestRenderAll(); } catch {}
      const svg = typeof canvas.toSVG === "function" ? canvas.toSVG() : "";
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg || "<svg xmlns='http://www.w3.org/2000/svg'/>"
      );
      setDataUrl(url);
    } finally {
      setLoading(false);
    }
  }, [canvas]);

  useEffect(() => {
    makeSnapshot();
  }, [makeSnapshot]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [dataUrl]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleZoomChange = useCallback((factor) => {
    setZoom((prev) => clampZoom(prev * factor));
  }, [clampZoom]);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handlePointerDown = useCallback((event) => {
    if (!dataUrl) return;
    if (event.button !== undefined && event.button !== 0 && event.pointerType !== "touch") return;

    event.preventDefault();
    const target = viewportRef.current;
    target?.setPointerCapture?.(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y
    };
    setIsDragging(true);
  }, [dataUrl, offset.x, offset.y]);

  const handlePointerMove = useCallback((event) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    event.preventDefault();
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    setOffset({ x: state.originX + deltaX, y: state.originY + deltaY });
  }, []);

  const finishDrag = useCallback((event) => {
    const state = dragStateRef.current;
    if (!state || (event && state.pointerId !== event.pointerId)) return;

    const target = viewportRef.current;
    if (event?.pointerId != null) {
      try {
        target?.releasePointerCapture?.(event.pointerId);
      } catch (err) {
        // ignore release errors
      }
    }
    dragStateRef.current = null;
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((event) => {
    if (!dataUrl) return;
    event.preventDefault();
    event.stopPropagation();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => clampZoom(prev * factor));
  }, [clampZoom, dataUrl]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node || !dataUrl) return;

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel, dataUrl]);

  const zoomPercent = `${Math.round(zoom * 100)}%`;
  const canZoomOut = zoom > MIN_ZOOM + 0.01;
  const canZoomIn = zoom < MAX_ZOOM - 0.01;
  const canResetView = zoom !== 1 || offset.x !== 0 || offset.y !== 0;

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
          <div className={styles.actionsLeft}>
            <button onClick={makeSnapshot} disabled={loading}>
              {loading ? "Updating..." : "Refresh"}
            </button>
            {dataUrl && (
              <a
                href={dataUrl}
                download={`canvas-export-${Date.now()}.svg`}
                className={styles.downloadBtn}
              >
                Download SVG
              </a>
            )}
          </div>
          {dataUrl && (
            <div className={styles.zoomControls}>
              <button onClick={() => handleZoomChange(ZOOM_OUT_FACTOR)} disabled={!canZoomOut}>
                −
              </button>
              <span className={styles.zoomReadout}>{zoomPercent}</span>
              <button onClick={() => handleZoomChange(ZOOM_IN_FACTOR)} disabled={!canZoomIn}>
                +
              </button>
              <button onClick={handleZoomReset} disabled={!canResetView}>
                Reset
              </button>
            </div>
          )}
        </div>
        <div className={styles.previewArea}>
          {dataUrl ? (
            <div
              ref={viewportRef}
              className={`${styles.previewViewport} ${isDragging ? styles.previewViewportDragging : ""}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerLeave={finishDrag}
              onPointerCancel={finishDrag}
              onDoubleClick={handleZoomReset}
            >
              <img
                src={dataUrl}
                alt="Canvas preview"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transition: isDragging ? "none" : "transform 0.15s ease-out"
                }}
              />
            </div>
          ) : (
            <div className={styles.placeholder}>No data</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
