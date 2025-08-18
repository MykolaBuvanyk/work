import React, { useState, useEffect } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import styles from "./ShapeProperties.module.css";

const ShapeProperties = ({
  isOpen: propIsOpen,
  activeShape: propActiveShape,
  onClose: propOnClose,
}) => {
  const { canvas, shapePropertiesOpen, setShapePropertiesOpen } =
    useCanvasContext();

  // Використовуємо пропси якщо вони передані (з ShapeSelector), інакше контекст
  const isOpen = propIsOpen !== undefined ? propIsOpen : shapePropertiesOpen;
  const activeShape = propActiveShape || null;
  const onClose = propOnClose || (() => setShapePropertiesOpen(false));

  const [properties, setProperties] = useState({
    width: 0, // mm
    height: 0, // mm
    rotation: 0,
    cornerRadius: 0,
    thickness: 2, // mm
    fill: false,
    cut: false,
  });

  const [isManuallyEditing, setIsManuallyEditing] = useState(false);

  const activeObject = activeShape || canvas?.getActiveObject();

  // Unit conversion (96 DPI)
  const PX_PER_MM = 96 / 25.4;
  const mmToPx = (mm) => (typeof mm === "number" ? mm * PX_PER_MM : 0);
  const pxToMm = (px) => (typeof px === "number" ? px / PX_PER_MM : 0);
  const roundMm = (mm) => Math.round((mm || 0) * 10) / 10;

  // Поточний радіус кутів у мм: для Rect беремо rx з урахуванням масштабу
  const getCornerRadiusMmForRounded = (obj) => {
    if (obj.type === "rect") {
      const scale = Math.min(obj.scaleX || 1, obj.scaleY || 1);
      const rPx = (obj.rx || 0) * scale;
      return roundMm(pxToMm(rPx));
    }
    // fallback
    const scale = Math.min(obj.scaleX || 1, obj.scaleY || 1);
    const rPx = (obj.baseCornerRadius || 0) * scale;
    return roundMm(pxToMm(rPx));
  };

  useEffect(() => {
    if (activeObject && (isOpen || shapePropertiesOpen)) {
      // Функція для оновлення властивостей
      const updateProperties = () => {
        // Не оновлюємо якщо користувач зараз редагує вручну
        if (!isManuallyEditing) {
          setProperties({
            width: roundMm(pxToMm(activeObject.getScaledWidth() || 0)),
            height: roundMm(pxToMm(activeObject.getScaledHeight() || 0)),
            rotation: Math.round(activeObject.angle || 0),
            cornerRadius:
              activeObject.shapeType === "roundedCorners" ||
              activeObject.type === "rect"
                ? getCornerRadiusMmForRounded(activeObject)
                : 0,
            thickness: roundMm(pxToMm(activeObject.strokeWidth || 2)),
            fill:
              activeObject.fill !== "transparent" && activeObject.fill !== "",
            cut: activeObject.stroke === "#FFA500" || activeObject.isCutElement, // Перевіряємо чи є оранжевий колір або позначка cut
          });
        }
      };

      // Оновлюємо властивості при зміні activeObject
      updateProperties();

      // Додаємо слухачі подій безпосередньо до об'єкта
      if (activeObject.on) {
        const handleObjectModified = () => updateProperties();
        const handleObjectScaling = () => updateProperties();
        const handleObjectRotating = () => updateProperties();

        activeObject.on("modified", handleObjectModified);
        activeObject.on("scaling", handleObjectScaling);
        activeObject.on("rotating", handleObjectRotating);

        // Прибираємо слухачі при розмонтуванні
        return () => {
          if (activeObject.off) {
            activeObject.off("modified", handleObjectModified);
            activeObject.off("scaling", handleObjectScaling);
            activeObject.off("rotating", handleObjectRotating);
          }
        };
      }
    }
  }, [activeObject, isOpen, shapePropertiesOpen]);

  // Додатковий useEffect для відстеження змін через canvas
  useEffect(() => {
    if (!canvas || !activeObject || !(isOpen || shapePropertiesOpen)) return;

    const updateProperties = () => {
      const currentActiveObject = canvas.getActiveObject();
      if (currentActiveObject === activeObject && !isManuallyEditing) {
        setProperties({
          width: roundMm(pxToMm(activeObject.getScaledWidth() || 0)),
          height: roundMm(pxToMm(activeObject.getScaledHeight() || 0)),
          rotation: Math.round(activeObject.angle || 0),
          cornerRadius:
            activeObject.shapeType === "roundedCorners" ||
            activeObject.type === "rect"
              ? getCornerRadiusMmForRounded(activeObject)
              : 0,
          thickness: roundMm(pxToMm(activeObject.strokeWidth || 2)),
          fill: activeObject.fill !== "transparent" && activeObject.fill !== "",
          cut: activeObject.stroke === "#FFA500" || activeObject.isCutElement,
        });
      }
    };

    const throttledAfterRender = () => {
      clearTimeout(throttledAfterRender._t);
      throttledAfterRender._t = setTimeout(updateProperties, 50);
    };

    canvas.on("object:modified", updateProperties);
    canvas.on("object:scaling", updateProperties);
    canvas.on("object:rotating", updateProperties);
    canvas.on("object:moving", updateProperties);
    canvas.on("after:render", throttledAfterRender);

    return () => {
      canvas.off("object:modified", updateProperties);
      canvas.off("object:scaling", updateProperties);
      canvas.off("object:rotating", updateProperties);
      canvas.off("object:moving", updateProperties);
      canvas.off("after:render", throttledAfterRender);
      if (throttledAfterRender._t) clearTimeout(throttledAfterRender._t);
    };
  }, [canvas, activeObject, isOpen, shapePropertiesOpen, isManuallyEditing]);

  // Оновлення властивостей активного об'єкта
  const updateProperty = (property, value) => {
    if (!canvas || !activeObject) return;

    // Локально оновлюємо стан, щоб інпут одразу відображав нове значення
    setProperties((prev) => ({ ...prev, [property]: value }));

    switch (property) {
      case "width": {
        const targetPx = Math.max(0, mmToPx(value));
        const baseW = activeObject.width || activeObject.getScaledWidth() || 1;
        const newScaleX = targetPx / baseW;
        activeObject.set({ scaleX: newScaleX });
        break;
      }
      case "height": {
        const targetPx = Math.max(0, mmToPx(value));
        const baseH =
          activeObject.height || activeObject.getScaledHeight() || 1;
        const newScaleY = targetPx / baseH;
        activeObject.set({ scaleY: newScaleY });
        break;
      }
      case "rotation": {
        activeObject.set("angle", value || 0);
        break;
      }
      case "cornerRadius": {
        if (
          activeObject.type === "rect" ||
          activeObject.shapeType === "roundedCorners"
        ) {
          const currentScale = Math.min(
            activeObject.scaleX || 1,
            activeObject.scaleY || 1
          );
          const rPxScaled = Math.max(0, mmToPx(value));
          const baseRx = rPxScaled / (currentScale || 1);
          const maxBaseRx = Math.max(
            0,
            Math.min(activeObject.width || 0, activeObject.height || 0) / 2 -
              0.001
          );
          const clampedBaseRx = Math.max(0, Math.min(baseRx, maxBaseRx));
          activeObject.set({ rx: clampedBaseRx, ry: clampedBaseRx });
        }
        break;
      }
      case "thickness": {
        activeObject.set("strokeWidth", mmToPx(value));
        break;
      }
      case "fill": {
        if (value) {
          const fillColor = properties.cut
            ? "#FFA500"
            : activeObject.stroke || "#000000";
          activeObject.set("fill", fillColor);
        } else {
          activeObject.set("fill", "transparent");
        }
        break;
      }
      case "cut": {
        if (value) {
          activeObject.set("stroke", "#FFA500");
          activeObject.set({
            isCutElement: true,
            cutType: "manual",
            hasControls: false,
            lockScalingX: true,
            lockScalingY: true,
            lockUniScaling: true,
          });
          if (properties.fill) {
            activeObject.set("fill", "#FFA500");
          }
        } else {
          activeObject.set("stroke", "#000000");
          activeObject.set({
            isCutElement: false,
            cutType: null,
            hasControls: true,
            lockScalingX: false,
            lockScalingY: false,
            lockUniScaling: false,
          });
          if (properties.fill) {
            activeObject.set("fill", "#000000");
          }
        }
        break;
      }
      default:
        break;
    }

    activeObject.setCoords();
    canvas.requestRenderAll();

    setTimeout(() => setIsManuallyEditing(false), 100);
  };

  const incrementValue = (property, increment = 1) => {
    setIsManuallyEditing(true);
    const currentValue = properties[property];
    const newValue = currentValue + increment;
    updateProperty(property, newValue);
  };

  const decrementValue = (property, decrement = 1) => {
    setIsManuallyEditing(true);
    const currentValue = properties[property];
    let newValue;

    if (property === "rotation") {
      // Для rotation дозволяємо від'ємні значення
      newValue = currentValue - decrement;
    } else {
      // Для інших властивостей не дозволяємо від'ємні значення
      newValue = Math.max(0, currentValue - decrement);
    }

    updateProperty(property, newValue);
  };

  if (!isOpen || !activeObject) return null;

  // Визначаємо, чи активна фігура є колом
  const isCircle =
    activeObject?.type === "circle" ||
    activeObject?.isCircle === true ||
    activeObject?.shapeType === "round";

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.titleWrapper}>
          <h3 className={styles.title}>Shape</h3>
          <button
            className={styles.closeIcon}
            onClick={onClose}
            aria-label="Close"
          >
            <svg
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
          </button>
        </div>
        <div className={styles.propertyGroup}>
          <label className={styles.label}>
            Width (mm):
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={properties.width}
                step={0.1}
                onChange={(e) =>
                  updateProperty("width", parseFloat(e.target.value) || 0)
                }
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={() =>
                  setTimeout(() => setIsManuallyEditing(false), 100)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue("width", 5)}
                ></i>
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue("width", 5)}
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Rotate:
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={properties.rotation}
                onChange={(e) =>
                  updateProperty("rotation", parseInt(e.target.value) || 0)
                }
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={() =>
                  setTimeout(() => setIsManuallyEditing(false), 100)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue("rotation", 15)}
                ></i>
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue("rotation", 15)}
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Height (mm):
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={properties.height}
                step={0.1}
                onChange={(e) =>
                  updateProperty("height", parseFloat(e.target.value) || 0)
                }
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={() =>
                  setTimeout(() => setIsManuallyEditing(false), 100)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue("height", 5)}
                ></i>
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue("height", 5)}
                ></i>
              </div>
            </div>
          </label>
          <label
            className={styles.label}
            style={{
              opacity: isCircle ? 0.5 : 1,
              cursor: isCircle ? "not-allowed" : "default",
            }}
          >
            Corner Radius:
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={properties.cornerRadius}
                disabled={isCircle}
                style={{ cursor: isCircle ? "not-allowed" : "text" }}
                step={0.1}
                onChange={(e) =>
                  !isCircle &&
                  updateProperty(
                    "cornerRadius",
                    Math.round((parseFloat(e.target.value) || 0) * 10) / 10
                  )
                }
                onFocus={() => !isCircle && setIsManuallyEditing(true)}
                onBlur={() =>
                  !isCircle &&
                  setTimeout(() => setIsManuallyEditing(false), 100)
                }
              />
              <div
                className={styles.arrows}
                style={{
                  pointerEvents: isCircle ? "none" : "auto",
                  opacity: isCircle ? 0.6 : 1,
                }}
              >
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => !isCircle && incrementValue("cornerRadius")}
                ></i>
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => !isCircle && decrementValue("cornerRadius")}
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Thickness (mm):
            <div className={styles.inputGroup}>
              <input
                type="number"
                className={styles.input}
                value={properties.thickness}
                step={0.1}
                onChange={(e) =>
                  updateProperty("thickness", parseFloat(e.target.value) || 1)
                }
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={() =>
                  setTimeout(() => setIsManuallyEditing(false), 100)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue("thickness")}
                ></i>
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue("thickness")}
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.cutFillWrapper}>
            <div className={styles.cutFillWrapperEl}>
              Fill
              <input
                type="checkbox"
                checked={properties.fill}
                disabled={properties.cut}
                onChange={(e) => updateProperty("fill", e.target.checked)}
              />
            </div>
            <div className={styles.cutFillWrapperEl}>
              Cut
              <input
                type="checkbox"
                checked={properties.cut}
                disabled={properties.fill}
                onChange={(e) => updateProperty("cut", e.target.checked)}
              />
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default ShapeProperties;
