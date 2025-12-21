import React, { useEffect, useState } from "react";
import styles from "./TemplatesModal.module.css";
import {
  fetchTemplates,
  fetchTemplateById,
  updateTemplate,
  deleteTemplate,
} from "../../http/templates";
import { useSelector } from "react-redux";
import useFabricCanvas from "../../hooks/useFabricCanvas";
import {
  collectFontFamiliesFromJson,
  ensureFontsLoaded,
  restoreElementProperties,
} from "../../utils/projectStorage";
import * as fabric from "fabric";

const buildPreviewSrc = (tpl) => {
  const hasSvg = tpl?.previewSvg && String(tpl.previewSvg).trim().length > 0;
  const hasPng = tpl?.preview && String(tpl.preview).trim().length > 0;
  // Prefer PNG to match how project canvases usually look in previews.
  // SVG preview is closer to export/PDF (border tweaks, font embedding) and can look different.
  if (hasPng) return tpl.preview;
  if (hasSvg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tpl.previewSvg)}`;
  }
  return null;
};

const TemplatesModal = ({ onClose }) => {
  const isAdmin = useSelector((state) => state?.user?.isAdmin);
  const { canvas, currentDesignId, loadDesign } = useFabricCanvas();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const applyTemplateToCurrentDesign = async (templateId) => {
    if (!templateId) return;
    if (!canvas || !currentDesignId || typeof loadDesign !== "function") {
      alert("Canvas is not ready yet");
      return;
    }

    const tpl = await fetchTemplateById(templateId);
    const snapshot = tpl?.canvas || null;
    const json = snapshot?.json || snapshot?.jsonTemplate || null;

    if (!json || typeof json !== "object") {
      alert("Template canvas is empty or invalid");
      return;
    }

    try {
      const shapeType = snapshot?.canvasType || json?.shapeType || null;
      if (shapeType) {
        canvas.set?.("shapeType", shapeType);
      }
    } catch {}

    try {
      const fontFamilies = collectFontFamiliesFromJson(json);
      await ensureFontsLoaded(fontFamilies);
      if (document && document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {}
      }
    } catch {}

    await loadDesign({
      id: currentDesignId,
      width: snapshot?.width,
      height: snapshot?.height,
      jsonTemplate: json,
      toolbarState: snapshot?.toolbarState || null,
      backgroundColor: snapshot?.backgroundColor,
      backgroundType: snapshot?.backgroundType,
    });

    // IMPORTANT: when opening canvases from IndexedDB, ProjectCanvasesGrid restores
    // background/texture + backgroundImage and runs restoreElementProperties.
    // For templates we must do the same, otherwise some designs will behave differently.
    try {
      canvas.__ignoreNextBackgroundUpdate = true;

      const bgType = snapshot?.backgroundType || "solid";
      const bgColor = snapshot?.backgroundColor || "#FFFFFF";

      if (bgType === "texture" && typeof bgColor === "string" && bgColor) {
        const img = document.createElement("img");
        img.crossOrigin = "anonymous";
        await new Promise((resolve) => {
          img.onload = () => {
            try {
              const scaleX = canvas.width / img.width;
              const scaleY = canvas.height / img.height;

              const patternCanvas = document.createElement("canvas");
              const ctx = patternCanvas.getContext("2d");
              patternCanvas.width = img.width * scaleX;
              patternCanvas.height = img.height * scaleY;
              ctx.drawImage(img, 0, 0, patternCanvas.width, patternCanvas.height);

              const pattern = new fabric.Pattern({
                source: patternCanvas,
                repeat: "repeat",
              });

              canvas.set("backgroundColor", pattern);
              canvas.set("backgroundTextureUrl", bgColor);
              canvas.set("backgroundType", "texture");
              canvas.renderAll();
            } catch (e) {
              console.warn("Failed to restore texture background", e);
              canvas.set("backgroundColor", "#FFFFFF");
              canvas.set("backgroundTextureUrl", null);
              canvas.set("backgroundType", "solid");
              canvas.renderAll();
            }
            resolve();
          };
          img.onerror = () => {
            canvas.set("backgroundColor", "#FFFFFF");
            canvas.set("backgroundTextureUrl", null);
            canvas.set("backgroundType", "solid");
            canvas.renderAll();
            resolve();
          };
          img.src = bgColor;
        });
      } else {
        canvas.set("backgroundColor", bgColor);
        canvas.set("backgroundTextureUrl", null);
        canvas.set("backgroundType", bgType);
        canvas.renderAll();
      }

      const bgImgData = snapshot?.backgroundImage;
      if (bgImgData && bgImgData.src) {
        try {
          const bgImg = await fabric.FabricImage.fromURL(bgImgData.src);
          bgImg.set({
            opacity: bgImgData.opacity ?? 1,
            originX: bgImgData.originX ?? "left",
            originY: bgImgData.originY ?? "top",
            scaleX: bgImgData.scaleX ?? 1,
            scaleY: bgImgData.scaleY ?? 1,
            left: bgImgData.left ?? 0,
            top: bgImgData.top ?? 0,
            angle: bgImgData.angle ?? 0,
          });
          canvas.setBackgroundImage(bgImg, canvas.renderAll.bind(canvas));
        } catch (e) {
          console.warn("Failed to restore background image", e);
        }
      }

      try {
        await restoreElementProperties(canvas, snapshot?.toolbarState || null);
      } catch (e) {
        console.warn("restoreElementProperties failed for template", e);
      }
    } finally {
      setTimeout(() => {
        try {
          canvas.__ignoreNextBackgroundUpdate = false;
        } catch {}
      }, 100);
    }

    onClose?.();
  };

  const reload = async () => {
    const data = await fetchTemplates();
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchTemplates()
      .then((data) => {
        if (!mounted) return;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        console.error("Failed to fetch templates", e);
        if (!mounted) return;
        setItems([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className={styles.modal}>
      <div className={styles.header}>
        <p className={styles.title}>Templates</p>
        <svg
          onClick={onClose}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
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

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>No templates</div>
      ) : (
        <div className={styles.grid}>
          {items.map((tpl, index) => {
            const previewSrc = buildPreviewSrc(tpl);
            return (
              <div key={tpl.id || index} className={styles.card}>
                <div className={styles.previewWrap}>
                  {previewSrc ? (
                    <img
                      className={styles.previewImg}
                      src={previewSrc}
                      alt="preview"
                    />
                  ) : (
                    <div className={styles.previewEmpty}>—</div>
                  )}
                </div>

                <div className={styles.cardName}>{tpl.name}</div>

                <div className={styles.actions}>
                  <button
                    className={styles.actionBtn}
                    onClick={async () => {
                      try {
                        await applyTemplateToCurrentDesign(tpl.id);
                      } catch (e) {
                        console.error("Apply template failed", e);
                        alert("Failed to apply template");
                      }
                    }}
                  >
                    Edit
                  </button>

                  {isAdmin ? (
                    <>
                      <button
                        className={styles.actionBtn}
                        onClick={async () => {
                          const nextName = window.prompt(
                            "New template name",
                            tpl.name || ""
                          );
                          if (nextName === null) return;
                          const trimmed = String(nextName || "").trim();
                          if (!trimmed) {
                            alert("Please enter a template name");
                            return;
                          }
                          try {
                            await updateTemplate(tpl.id, trimmed);
                            await reload();
                          } catch (e) {
                            console.error("Template update failed", e);
                            alert("Failed to update template");
                          }
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.dangerBtn}`}
                        onClick={async () => {
                          const ok = window.confirm(
                            `Delete template "${tpl.name}"?`
                          );
                          if (!ok) return;
                          try {
                            await deleteTemplate(tpl.id);
                            await reload();
                          } catch (e) {
                            console.error("Template delete failed", e);
                            alert("Failed to delete template");
                          }
                        }}
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TemplatesModal;
