import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./UploadPreview.module.css";
import { vectorizeDataURLToSVG } from "../../utils/vectorizeImage";

// Map precision slider (0..100) to vectorization options
const mapVectorOpts = (detail) => {
  const d = Math.max(0, Math.min(100, Number(detail) || 0));
  const mapRange = (min, max) => min + (max - min) * (d / 100);
  const pathomit = Math.max(2, Math.round(mapRange(30, 2)));
  const simplifyTolerance = Number(mapRange(3.0, 0.5).toFixed(2));
  const pointStep = d >= 75 ? 1 : d >= 40 ? 2 : 3;
  const quantize = d >= 60 ? 0 : d >= 30 ? 1 : 2;
  const roundDecimals = d >= 60 ? 1 : 0;
  const maxSize = Math.round(mapRange(200, 520));
  return {
    pathomit,
    simplifyTolerance,
    pointStep,
    quantize,
    roundDecimals,
    maxSize,
  };
};

const applyStrokeOnlyToSVG = (svgString, theme = "#000") => {
  try {
    const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
    doc.querySelectorAll("path,polygon,polyline,rect,circle,ellipse").forEach((el) => {
      el.setAttribute("fill", "transparent");
      el.setAttribute("stroke", theme);
      el.setAttribute("stroke-width", "1");
    });
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svgString;
  }
};

// Ensure SVG scales to fit the preview box (preview-only; do not use for final add)
const makeSVGContain = (svgString) => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgString;

    // 1) Ensure we have a viewBox. If missing, derive from width/height numbers (allow units like px, mm)
    const hasViewBox = svg.hasAttribute("viewBox");
    const wAttr = svg.getAttribute("width") || "";
    const hAttr = svg.getAttribute("height") || "";
    const wNum = /^[0-9]+(\.[0-9]+)?/.test(wAttr) ? parseFloat(wAttr) : null;
    const hNum = /^[0-9]+(\.[0-9]+)?/.test(hAttr) ? parseFloat(hAttr) : null;
    if (!hasViewBox && wNum && hNum) {
      svg.setAttribute("viewBox", `0 0 ${wNum} ${hNum}`);
    }

    // 2) Reframe viewBox to the actual content bounding box so it fills preview
    try {
      // Clone and measure off-DOM
      const temp = svg.cloneNode(true);
      temp.setAttribute("visibility", "hidden");
      temp.setAttribute("style", "position:absolute;left:-10000px;top:-10000px;opacity:0;pointer-events:none;");
      // Some SVGs rely on width/height for layout; ensure they have some size
      if (!temp.getAttribute("width")) temp.setAttribute("width", "1000");
      if (!temp.getAttribute("height")) temp.setAttribute("height", "1000");
      document.body.appendChild(temp);
      try {
        const bbox = temp.getBBox();
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          svg.setAttribute("viewBox", `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
        }
      } finally {
        document.body.removeChild(temp);
      }
    } catch {}

    // 3) Enforce responsive sizing for preview box
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svgString;
  }
};

const UploadPreview = ({
  isOpen,
  mode, // 'raster' | 'svg'
  dataURL, // for raster
  svgText, // for svg
  themeColor = "#000",
  onClose,
  onConfirm, // ({ svg: string, strokeOnly: boolean }) => void
}) => {
  const [detail, setDetail] = useState(60);
  const [strokeOnly, setStrokeOnly] = useState(false);
  const [brightness, setBrightness] = useState(0); // -100..100 (maps to -255..255)
  const [invert, setInvert] = useState(false); // two-state switch: Off (default) / On
  const [processing, setProcessing] = useState(false);
  const [svgOut, setSvgOut] = useState("");
  const debounceRef = useRef();

  const canAdjustPrecision = mode === "raster";

  // Recompute preview when inputs change
  useEffect(() => {
    if (!isOpen) return;
    const run = async () => {
      setProcessing(true);
      try {
        let resultSVG = "";
    if (mode === "raster" && dataURL) {
          const tuned = mapVectorOpts(detail);
          resultSVG = await vectorizeDataURLToSVG(dataURL, {
            threshold: 120,
      autoThreshold: true,
      autoInvert: false,
      invert: !!invert,
      brightness: Math.round((brightness || 0) * 2.55),
            pathomit: tuned.pathomit,
            maxSize: tuned.maxSize,
            simplifyTolerance: tuned.simplifyTolerance,
            pointStep: tuned.pointStep,
            quantize: tuned.quantize,
            roundDecimals: tuned.roundDecimals,
            fillRule: "evenodd",
            combineToSinglePath: true,
            scale: 2,
            fillColor: "black",
          });
        } else if (mode === "svg" && svgText) {
          resultSVG = svgText;
        }
        if (strokeOnly && resultSVG) {
          resultSVG = applyStrokeOnlyToSVG(resultSVG, themeColor);
        }
        setSvgOut(resultSVG);
      } catch (e) {
        console.warn("Preview generation failed:", e);
        setSvgOut("");
      } finally {
        setProcessing(false);
      }
    };

    // debounce rapid slider updates
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(run, 200);
    return () => clearTimeout(debounceRef.current);
  }, [isOpen, mode, dataURL, svgText, detail, brightness, invert, strokeOnly, themeColor]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.headerWrapper}>
          <div className={styles.headerWrapperText}>
            <p className={styles.para}>Upload preview</p>
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

        <div className={styles.controls}>
          {canAdjustPrecision && (
            <div className={styles.row}>
              <label htmlFor="prec">Precision</label>
              <input
                id="prec"
                type="range"
                min={0}
                max={100}
                step={1}
                value={detail}
                onChange={(e) => setDetail(parseInt(e.target.value) || 0)}
              />
              <span className={styles.val}>{detail}</span>
            </div>
          )}
          {canAdjustPrecision && (
            <div className={styles.row}>
              <label htmlFor="bright">Brightness</label>
              <input
                id="bright"
                type="range"
                min={-100}
                max={100}
                step={1}
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value) || 0)}
              />
              <span className={styles.val}>{brightness}</span>
            </div>
          )}
          {canAdjustPrecision && (
            <div className={styles.row}>
              <label style={{ minWidth: 80 }}>Invert</label>
              <button
                type="button"
                role="switch"
                aria-checked={invert}
                className={`${styles.toggle} ${invert ? styles.on : ''}`}
                onClick={() => setInvert((v) => !v)}
                title={invert ? 'On' : 'Off'}
              >
                <span className={styles.toggleTrack}>
                  <span className={styles.toggleThumb} />
                </span>
                <span className={styles.toggleLabel}>{invert ? 'On' : 'Off'}</span>
              </button>
            </div>
          )}
          <div className={styles.row}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={strokeOnly}
                onChange={(e) => setStrokeOnly(e.target.checked)}
              />
              Stroke only (lines)
            </label>
          </div>
        </div>

        <div className={styles.previewWrap}>
          <div className={styles.previewCol}>
            <div className={styles.previewTitle}>Original</div>
            <div className={styles.previewBox}>
              {mode === "raster" && dataURL && (
                <img src={dataURL} alt="original" />
              )}
        {mode === "svg" && svgText && (
                <div
                  className={styles.svgBox}
          dangerouslySetInnerHTML={{ __html: makeSVGContain(svgText) }}
                />
              )}
            </div>
          </div>
          <div className={styles.previewCol}>
            <div className={styles.previewTitle}>Result</div>
            <div className={styles.previewBox}>
        {processing ? (
                <div className={styles.spinner}>Processing…</div>
              ) : svgOut ? (
                <div
                  className={styles.svgBox}
          dangerouslySetInnerHTML={{ __html: makeSVGContain(svgOut) }}
                />
              ) : (
                <div className={styles.placeholder}>No preview</div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.secondary} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.primary}
            disabled={processing || !svgOut}
            onClick={() => svgOut && onConfirm && onConfirm({ svg: svgOut, strokeOnly })}
          >
            Add to canvas
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadPreview;
