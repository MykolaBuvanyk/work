import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { useCanvasContext } from "../../contexts/CanvasContext";
import {
  getProject,
  deleteProject,
  saveCurrentProject,
  clearAllUnsavedSigns,
  addBlankUnsavedSign,
} from "../../utils/projectStorage";
import styles from "./NewProjectsModal.module.css";

const DEFAULT_SHAPE_WIDTH_MM = 120;
const DEFAULT_SHAPE_HEIGHT_MM = 80;

const NewProjectsModal = ({
  onClose,
  onRequestSaveAs,
  onSave,
  onDiscard,
  message,
}) => {
  const { t } = useTranslation();
  const { canvas } = useCanvasContext();

  const handleSave = async () => {
    if (typeof onSave === "function") {
      try {
        await onSave();
      } finally {
        onClose && onClose();
      }
      return;
    }

    let currentProjectId = null;
    try {
      currentProjectId = localStorage.getItem("currentProjectId");
    } catch {
      // Ignore unavailable localStorage.
    }
    if (!canvas) {
      onClose && onClose();
      return;
    }
    if (currentProjectId) {
      // Update existing project only
      try {
        await saveCurrentProject(canvas);
      } catch (e) {
        console.error("Update project failed", e);
      }

      // Auto clear canvas after saving (user requested)
      try {
        canvas.__suspendUndoRedo = true;
        canvas.discardActiveObject && canvas.discardActiveObject();
        canvas.clear();
        canvas.renderAll();
        canvas.__suspendUndoRedo = false;
        window.dispatchEvent(
          new CustomEvent("project:afterSaveCleared", {
            detail: { projectId: currentProjectId },
          })
        );
      } catch {
        // Best-effort reset after saving.
      }

      // Скидаємо toolbar state до дефолтних значень
      if (window.restoreToolbarState) {
        try {
          window.restoreToolbarState({
            currentShapeType: "rectangle",
            cornerRadius: 0,
            sizeValues: {
              width: DEFAULT_SHAPE_WIDTH_MM,
              height: DEFAULT_SHAPE_HEIGHT_MM,
              cornerRadius: 0,
            },
            globalColors: {
              textColor: "#000000",
              backgroundColor: "#FFFFFF",
              strokeColor: "#000000",
              fillColor: "transparent",
              backgroundType: "solid",
            },
            selectedColorIndex: 0,
            thickness: 1.6,
            isAdhesiveTape: true,
            activeHolesType: 1,
            holesDiameter: 2.5,
            isHolesSelected: false,
            isCustomShapeMode: false,
            isCustomShapeApplied: false,
            hasUserPickedShape: false,
            copiesCount: 1,
            hasBorder: false,
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

      try {
        localStorage.removeItem("pendingOpenedProjectAccessories");
        sessionStorage.removeItem("pendingOpenedProjectAccessories");
      } catch {
        // Ignore unavailable storage.
      }

      // Створюємо нове полотно за замовчуванням після збереження
      try {
        // Розміри прямокутника за замовчуванням (120x80 мм при 96 DPI)
  const PX_PER_MM = 72 / 25.4;
        const DEFAULT_WIDTH = Math.round(120 * PX_PER_MM); // ~453 px
        const DEFAULT_HEIGHT = Math.round(80 * PX_PER_MM); // ~302 px

        const newSign = await addBlankUnsavedSign(
          DEFAULT_WIDTH,
          DEFAULT_HEIGHT
        );

        // Встановлюємо новий sign як активний
        try {
          localStorage.setItem("currentUnsavedSignId", newSign.id);
        } catch {
          // Ignore unavailable localStorage.
        }

        // Відправляємо подію про оновлення unsaved signs
        window.dispatchEvent(new CustomEvent("unsaved:signsUpdated"));
        window.dispatchEvent(new CustomEvent("project:reset"));
        window.dispatchEvent(new CustomEvent("accessories:reset"));

        // Даємо час на оновлення state і автоматично відкриваємо полотно
        setTimeout(() => {
          console.log("Dispatching canvas:autoOpen for new sign:", newSign.id);
          window.dispatchEvent(
            new CustomEvent("canvas:autoOpen", {
              detail: { canvasId: newSign.id, isUnsaved: true },
            })
          );
        }, 500);
      } catch (e) {
        console.error("Failed to create default canvas after save", e);
      }

      onClose && onClose();
    } else {
      // Need name -> open Save As
      if (onRequestSaveAs) onRequestSaveAs();
      else onClose && onClose();
    }
  };

  const handleDiscard = async () => {
    if (typeof onDiscard === "function") {
      try {
        await onDiscard();
      } finally {
        onClose && onClose();
      }
      return;
    }

    let currentProjectId = null;
    try {
      currentProjectId = localStorage.getItem("currentProjectId");
    } catch {
      // Ignore unavailable localStorage.
    }

    // Delete entire project if present
    if (currentProjectId) {
      getProject(currentProjectId)
        .then((p) => {
          if (p) {
            deleteProject(currentProjectId).catch(() => {
              // Ignore project deletion errors.
            });
          }
        })
        .catch(() => {
          // Ignore project lookup errors.
        });
    }

    // Очищаємо localStorage
    try {
      localStorage.removeItem("currentProjectId");
      localStorage.removeItem("currentProjectName");
      localStorage.removeItem("currentCanvasId");
      localStorage.removeItem("currentProjectCanvasId");
      localStorage.removeItem("currentProjectCanvasIndex");
      localStorage.removeItem("currentUnsavedSignId");
    } catch {
      // Ignore unavailable localStorage.
    }
    try {
      if (typeof window !== "undefined") {
        window.__currentProjectCanvasId = null;
        window.__currentProjectCanvasIndex = null;
      }
    } catch {
      // Ignore unavailable window state.
    }

    // Очищаємо canvas
    if (canvas) {
      try {
        canvas.__suspendUndoRedo = true;
        canvas.clear();
        canvas.renderAll();
        canvas.__suspendUndoRedo = false;
      } catch {
        // Best-effort canvas cleanup.
      }
    }

    // Скидаємо toolbar state до дефолтних значень
    if (window.restoreToolbarState) {
      try {
        window.restoreToolbarState({
          currentShapeType: "rectangle",
          cornerRadius: 0,
          sizeValues: {
            width: DEFAULT_SHAPE_WIDTH_MM,
            height: DEFAULT_SHAPE_HEIGHT_MM,
            cornerRadius: 0,
          },
          globalColors: {
            textColor: "#000000",
            backgroundColor: "#FFFFFF",
            strokeColor: "#000000",
            fillColor: "transparent",
            backgroundType: "solid",
          },
          selectedColorIndex: 0,
          thickness: 1.6,
          isAdhesiveTape: true,
          activeHolesType: 1,
          holesDiameter: 2.5,
          isHolesSelected: false,
          isCustomShapeMode: false,
          isCustomShapeApplied: false,
          hasUserPickedShape: false,
          copiesCount: 1,
          hasBorder: false,
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

    try {
      localStorage.removeItem("pendingOpenedProjectAccessories");
      sessionStorage.removeItem("pendingOpenedProjectAccessories");
    } catch {
      // Ignore unavailable storage.
    }

    // Створюємо нове полотно за замовчуванням
    try {
      // Розміри прямокутника за замовчуванням (120x80 мм при 96 DPI)
  const PX_PER_MM = 72 / 25.4;
      const DEFAULT_WIDTH = Math.round(120 * PX_PER_MM); // ~453 px
      const DEFAULT_HEIGHT = Math.round(80 * PX_PER_MM); // ~302 px

      const newSign = await addBlankUnsavedSign(DEFAULT_WIDTH, DEFAULT_HEIGHT);

      // Встановлюємо новий sign як активний
      try {
        localStorage.setItem("currentUnsavedSignId", newSign.id);
        localStorage.removeItem("currentProjectCanvasId");
        localStorage.removeItem("currentProjectCanvasIndex");
      } catch {
        // Ignore unavailable localStorage.
      }
      try {
        if (typeof window !== "undefined") {
          window.__currentProjectCanvasId = null;
          window.__currentProjectCanvasIndex = null;
        }
      } catch {
        // Ignore unavailable window state.
      }

      // Відправляємо подію про оновлення unsaved signs
      window.dispatchEvent(new CustomEvent("unsaved:signsUpdated"));

      // Відправляємо подію про reset проекту (після створення нового полотна)
      window.dispatchEvent(new CustomEvent("project:reset"));
      window.dispatchEvent(new CustomEvent("accessories:reset"));

      // Даємо час на оновлення state і автоматично відкриваємо полотно
      setTimeout(() => {
        console.log(
          "Dispatching canvas:autoOpen after discard for new sign:",
          newSign.id
        );
        window.dispatchEvent(
          new CustomEvent("canvas:autoOpen", {
            detail: { canvasId: newSign.id, isUnsaved: true },
          })
        );
      }, 500);
    } catch (e) {
      console.error("Failed to create default canvas after discard", e);
    }

    onClose && onClose();
  };
  const handleCancel = () => onClose && onClose();

  return (
    <div className={styles.newProjectsModal}>
      <p>
        {message || (
          <Trans
            i18nKey="NewProjectsModal.message"
            components={{ strong: <strong /> }}
          />
        )}
      </p>
      <div className={styles.buttonContainer}>
        <button className={styles.active} onClick={handleSave}>
          {t("NewProjectsModal.save")}
        </button>
        <button onClick={handleDiscard}>{t("NewProjectsModal.discard")}</button>
        <button onClick={handleCancel}>{t("NewProjectsModal.cancel")}</button>
      </div>
    </div>
  );
};

export default NewProjectsModal;
