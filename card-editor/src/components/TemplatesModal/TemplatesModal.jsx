import React, { useEffect, useState } from "react";
import styles from "./TemplatesModal.module.css";
import {
  fetchTemplates,
  fetchTemplateCategories,
  fetchTemplateById,
  updateTemplate,
  deleteTemplate,
  createTemplateCategory,
  updateTemplateCategory,
  deleteTemplateCategory,
} from "../../http/templates";
import { useSelector } from "react-redux";
import useFabricCanvas from "../../hooks/useFabricCanvas";
import {
  collectFontFamiliesFromJson,
  ensureFontsLoaded,
  restoreElementProperties,
} from "../../utils/projectStorage";
import { deleteTemplate as deleteLocalTemplate, getAllTemplates, getTemplateById, renameTemplate, saveTemplateSnapshot } from "../../utils/templateStorage";
import * as fabric from "fabric";

const MY_TEMPLATES_KEY = "__my_templates__";
const UNCATEGORIZED_KEY = "__uncategorized__";

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
  const [templates, setTemplates] = useState([]);
  const [myTemplates, setMyTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(null); // null => categories step
  const [loading, setLoading] = useState(true);

  const applyTemplateToCurrentDesign = async (templateId, opts = {}) => {
    if (!templateId) return;
    if (!canvas || !currentDesignId || typeof loadDesign !== "function") {
      alert("Canvas is not ready yet");
      return;
    }

    const snapshot = opts?.isMy
      ? (await getTemplateById(templateId))?.canvas || null
      : (await fetchTemplateById(templateId))?.canvas || null;
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

  const reloadAll = async () => {
    const local = await getAllTemplates().catch(() => []);
    const mappedLocal = (Array.isArray(local) ? local : []).map((t) => {
      const canvas = t?.canvas || {};
      return {
        id: t.id,
        name: t.name,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        preview: canvas.preview || null,
        previewSvg: canvas.previewSvg || null,
      };
    });
    setMyTemplates(mappedLocal);

    // Server templates/categories are optional: still allow My Templates without backend.
    try {
      const [tpls, cats] = await Promise.all([
        fetchTemplates(),
        fetchTemplateCategories(),
      ]);
      setTemplates(Array.isArray(tpls) ? tpls : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (e) {
      console.warn("Templates/categories server fetch failed", e);
      setTemplates([]);
      setCategories([]);
    }
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const local = await getAllTemplates().catch(() => []);
        const mappedLocal = (Array.isArray(local) ? local : []).map((t) => {
          const canvas = t?.canvas || {};
          return {
            id: t.id,
            name: t.name,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            preview: canvas.preview || null,
            previewSvg: canvas.previewSvg || null,
          };
        });
        if (mounted) setMyTemplates(mappedLocal);

        const [tpls, cats] = await Promise.all([
          fetchTemplates(),
          fetchTemplateCategories(),
        ]);
        if (!mounted) return;
        setTemplates(Array.isArray(tpls) ? tpls : []);
        setCategories(Array.isArray(cats) ? cats : []);
      } catch (e) {
        console.error("Failed to fetch templates/categories", e);
        if (!mounted) return;
        setTemplates([]);
        setCategories([]);
        // My Templates may still be available even if server failed.
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const categoryKeyForTemplate = (tpl) =>
    tpl?.categoryId ? String(tpl.categoryId) : UNCATEGORIZED_KEY;

  const categoryNameByKey = (key) => {
    if (key === UNCATEGORIZED_KEY) return "Uncategorized";
    const found = categories.find((c) => String(c.id) === String(key));
    return found?.name || "Category";
  };

  const templatesByCategoryKey = templates.reduce((acc, tpl) => {
    const key = categoryKeyForTemplate(tpl);
    acc[key] = acc[key] || [];
    acc[key].push(tpl);
    return acc;
  }, {});

  const isMyView = selectedCategoryKey === MY_TEMPLATES_KEY;
  const visibleTemplates =
    selectedCategoryKey === null
      ? []
      : isMyView
        ? myTemplates
        : templatesByCategoryKey[selectedCategoryKey] || [];

  const renderTrashIcon = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 6H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 6V4H16V6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 6L7 21H17L18 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );

  const renderEditIcon = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 20H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );

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
      ) : selectedCategoryKey === null ? (
        <div className={styles.categoriesWrap}>
          <div className={styles.subtitle}>
            You can choose from various templates here or use your previously saved ones.
          </div>

          <button
            type="button"
            className={styles.sectionTitleBtn}
            onClick={() => setSelectedCategoryKey(MY_TEMPLATES_KEY)}
          >
            My Templates
          </button>

          <ul className={styles.categoryList}>
            <li className={styles.categoryItem}>
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    className={`${styles.iconOnlyBtn} ${styles.iconDanger}`}
                    title="Delete"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      alert("Uncategorized can't be deleted");
                    }}
                  >
                    {renderTrashIcon()}
                  </button>
                  <button
                    type="button"
                    className={styles.iconOnlyBtn}
                    title="Edit"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      alert("Uncategorized can't be renamed");
                    }}
                  >
                    {renderEditIcon()}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className={styles.categoryLink}
                onClick={() => setSelectedCategoryKey(UNCATEGORIZED_KEY)}
              >
                Uncategorized
              </button>
            </li>

            {categories.map((c) => {
              const key = String(c.id);
              return (
                <li key={c.id} className={styles.categoryItem}>
                  {isAdmin ? (
                    <>
                      <button
                        type="button"
                        className={`${styles.iconOnlyBtn} ${styles.iconDanger}`}
                        title="Delete"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const ok = window.confirm(
                            `Delete category "${c.name}"? Templates will become Uncategorized.`
                          );
                          if (!ok) return;
                          try {
                            await deleteTemplateCategory(c.id);
                            await reloadAll();
                          } catch (err) {
                            console.error("Category delete failed", err);
                            alert("Failed to delete category");
                          }
                        }}
                      >
                        {renderTrashIcon()}
                      </button>
                      <button
                        type="button"
                        className={styles.iconOnlyBtn}
                        title="Edit"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const nextName = window.prompt(
                            "New category name",
                            c.name || ""
                          );
                          if (nextName === null) return;
                          const trimmed = String(nextName || "").trim();
                          if (!trimmed) {
                            alert("Please enter a category name");
                            return;
                          }
                          try {
                            await updateTemplateCategory(c.id, trimmed);
                            await reloadAll();
                          } catch (err) {
                            console.error("Category update failed", err);
                            alert("Failed to update category");
                          }
                        }}
                      >
                        {renderEditIcon()}
                      </button>
                    </>
                  ) : null}

                  <button
                    type="button"
                    className={styles.categoryLink}
                    onClick={() => setSelectedCategoryKey(key)}
                  >
                    {c.name}
                  </button>
                </li>
              );
            })}
          </ul>

          {isAdmin ? (
            <div className={styles.addRow}>
              <button
                type="button"
                className={styles.addIconBtn}
                onClick={async () => {
                  const nextName = window.prompt("Category name");
                  if (nextName === null) return;
                  const trimmed = String(nextName || "").trim();
                  if (!trimmed) {
                    alert("Please enter a category name");
                    return;
                  }
                  try {
                    await createTemplateCategory(trimmed);
                    await reloadAll();
                  } catch (err) {
                    console.error("Category create failed", err);
                    alert("Failed to create category");
                  }
                }}
                title="Add New"
              >
                <span className={styles.plusCircle}>+</span>
              </button>
              <button
                type="button"
                className={styles.addNewBtn}
                onClick={async () => {
                  const nextName = window.prompt("Category name");
                  if (nextName === null) return;
                  const trimmed = String(nextName || "").trim();
                  if (!trimmed) {
                    alert("Please enter a category name");
                    return;
                  }
                  try {
                    await createTemplateCategory(trimmed);
                    await reloadAll();
                  } catch (err) {
                    console.error("Category create failed", err);
                    alert("Failed to create category");
                  }
                }}
              >
                Add New
              </button>
            </div>
          ) : null}
        </div>
      ) : visibleTemplates.length === 0 ? (
        <div className={styles.empty}>
          <button
            type="button"
            className={styles.sectionTitleBtn}
            onClick={() => setSelectedCategoryKey(null)}
          >
            Back
          </button>
          <div className={styles.emptyInner}>
            {isMyView ? "No templates yet" : "No templates in this category"}
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={styles.sectionTitleBtn}
            onClick={() => setSelectedCategoryKey(null)}
          >
            Back
          </button>
          <div className={styles.grid}>
          {visibleTemplates.map((tpl, index) => {
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
                        await applyTemplateToCurrentDesign(tpl.id, {
                          isMy: isMyView,
                        });
                      } catch (e) {
                        console.error("Apply template failed", e);
                        alert("Failed to apply template");
                      }
                    }}
                  >
                    Edit
                  </button>

                  {isMyView ? (
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
                            await renameTemplate(tpl.id, trimmed);
                            await reloadAll();
                          } catch (e) {
                            console.error("Local template rename failed", e);
                            alert("Failed to rename template");
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
                            await deleteLocalTemplate(tpl.id);
                            await reloadAll();
                          } catch (e) {
                            console.error("Local template delete failed", e);
                            alert("Failed to delete template");
                          }
                        }}
                      >
                        Delete
                      </button>
                    </>
                  ) : isAdmin ? (
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
                            await reloadAll();
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
                            await reloadAll();
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
        </>
      )}
    </div>
  );
};

export default TemplatesModal;
