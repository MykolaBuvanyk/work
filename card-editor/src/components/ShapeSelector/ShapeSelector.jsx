import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import styles from "./ShapeSelector.module.css";

const ShapeSelector = ({ isOpen, onClose }) => {
  const { canvas, globalColors, setActiveObject, setShapePropertiesOpen } =
    useCanvasContext();
  const [selectedShape, setSelectedShape] = useState(null);
  const dropdownRef = useRef(null);

  // Закрытие по клику вне модального окна
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        if (typeof onClose === "function") onClose();
      }
    };
    document.addEventListener("mousedown", handleOutside, true);
    document.addEventListener("touchstart", handleOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside, true);
      document.removeEventListener("touchstart", handleOutside, true);
    };
  }, [isOpen, onClose]);

  const shapes = [
    { id: "rectangle", name: "Rectangle" },
    { id: "roundedCorners", name: "Rounded Corners" },
    { id: "round", name: "Round" },
    { id: "oval", name: "Oval" },
    { id: "hexagon", name: "Hexagon" },
    { id: "octagon", name: "Octagon" },
    { id: "triangle", name: "Triangle" },
    { id: "warningTriangle", name: "Warning Triangle" },
    { id: "semiround", name: "Semi round" },
    { id: "roundTop", name: "Round Top" },
    { id: "leftArrow", name: "Left arrow" },
    { id: "rightArrow", name: "Right arrow" },
    { id: "turnLeft", name: "Turn left" },
    { id: "turnRight", name: "Turn right" },
    { id: "customShape", name: "Custom shape" },
    { id: "line", name: "Line" },
    { id: "dashedLine", name: "Dashed Line" },
  ];

  const addShape = (shapeType) => {
    // Закриваємо модалку одразу після вибору фігури
    if (typeof onClose === "function") onClose();
    if (!canvas) return;

    let shape = null;
    const canvasW =
      typeof canvas.getWidth === "function"
        ? canvas.getWidth()
        : canvas?.width || 0;
    const canvasH =
      typeof canvas.getHeight === "function"
        ? canvas.getHeight()
        : canvas?.height || 0;
    const centerX = (canvasW || 0) / 2;
    const centerY = (canvasH || 0) / 2;

    const baseOptions = {
      left: centerX,
      top: centerY,
      fill: globalColors.fillColor || "transparent",
      stroke: globalColors.strokeColor || "#000000",
      strokeWidth: 2,
      originX: "center",
      originY: "center",
      strokeUniform: true, // утримує товщину контуру при масштабуванні
      strokeLineJoin: "round",
      strokeMiterLimit: 2,
    };

    const createPath = (d, opts) => {
      try {
        return new fabric.Path(d, opts);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to create Path for", shapeType, err);
        return null;
      }
    };

    switch (shapeType) {
      case "rectangle":
        shape = new fabric.Rect({
          ...baseOptions,
          width: 52,
          height: 52,
          rx: 0,
          ry: 0,
        });
        break;

      case "roundedCorners":
        shape = new fabric.Rect({
          ...baseOptions,
          width: 52,
          height: 52,
          rx: 12,
          ry: 12,
        });
        break;

      case "round":
        shape = new fabric.Circle({
          ...baseOptions,
          radius: 29,
        });
        break;

      case "oval":
        shape = new fabric.Ellipse({
          ...baseOptions,
          rx: 30,
          ry: 21,
        });
        break;

      case "hexagon":
        shape = createPath("M59 27 45 51H16L2 27 16 2h29l14 25Z", baseOptions);
        break;

      case "octagon":
        shape = createPath(
          "M39 1L55 17V39L39 55H17L1 39V17L17 1H39Z",
          baseOptions
        );
        break;

      case "triangle":
        shape = createPath("M59 51H2L31 2L59 51Z", baseOptions);
        break;

      case "warningTriangle":
        shape = createPath("M1 32V51.5H23.5H43V32L22 2L1 32Z", baseOptions);
        break;

      case "semiround":
        // Семикруг: безопасный путь без експонентиальной нотации
        shape = createPath(
          "M0 28.5 C0 12.76 12.76 0 28.5 0 C44.24 0 57 12.76 57 28.5 L57 28.5 H0 Z",
          baseOptions
        );
        break;

      case "roundTop":
        shape = createPath(
          "M 0 100 L 0 50 Q 0 0 50 0 Q 100 0 100 50 L 100 100 Z",
          baseOptions
        );
        break;

      case "leftArrow":
        shape = createPath("M56 34V10H18V3L2 22L18 41V34H56Z", baseOptions);
        break;

      case "rightArrow":
        shape = createPath("M1 34V10H39V3L55 22L39 41V34H1Z", baseOptions);
        break;

      case "turnLeft":
        shape = createPath("M14 45H43V1H13L2 23L14 45Z", baseOptions);
        break;

      case "turnRight":
        shape = createPath("M30 45H1V1H31L42 23L30 45Z", baseOptions);
        break;

      case "customShape":
        shape = createPath(
          "M1 16V48L17 43L38 52L53 43V16H38L21 2L1 16Z",
          baseOptions
        );
        break;

      case "line":
        shape = createPath("M0 0L100 0", {
          ...baseOptions,
          fill: "",
          strokeWidth: 3,
          strokeLineCap: "round",
        });
        break;

      case "dashedLine":
        shape = createPath("M0 0L100 0", {
          ...baseOptions,
          fill: "",
          strokeWidth: 3,
          strokeDashArray: [5, 5],
          strokeLineCap: "round",
        });
        break;

      default:
        return;
    }

    if (shape) {
      // Позначаємо тип фігури для подальшої логіки UI
      shape.set({ shapeType: shapeType });
      if (shapeType === "round") {
        // Спеціальний прапорець для кола, навіть якщо це Path
        shape.set({ isCircle: true });
      }
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();

      // Встановлюємо активний об'єкт і відкриваємо властивості
      setActiveObject(shape);
      setShapePropertiesOpen(true);
    }
  };

  const renderShapeIcon = (shapeType) => {
    switch (shapeType) {
      case "rectangle":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="54"
            height="54"
            fill="none"
          >
            <path fill="none" stroke="#000" strokeWidth="2" d="M1 1h52v52H1z" />
          </svg>
        );

      case "roundedCorners":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="54"
            height="54"
            fill="none"
          >
            <rect
              width="52"
              height="52"
              x="1"
              y="1"
              fill="none"
              stroke="#000"
              strokeWidth="2"
              rx="12"
            />
          </svg>
        );

      case "round":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="60"
            height="60"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M30 1a29 29 0 1 1 0 58 29 29 0 0 1 0-58Z"
            />
          </svg>
        );

      case "oval":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="60"
            height="42"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M30 1c8 0 15 2 21 6 5 4 8 9 8 14s-3 10-8 14c-6 4-13 6-21 6s-15-2-21-6c-5-4-8-9-8-14S4 11 9 7c6-4 13-6 21-6Z"
            />
          </svg>
        );

      case "hexagon":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="61"
            height="53"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M59 27 45 51H16L2 27 16 2h29l14 25Z"
            />
          </svg>
        );

      case "octagon":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="56"
            height="56"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="m39 1 16 16v22L39 55H17L1 39V17L17 1h22Z"
            />
          </svg>
        );

      case "triangle":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="61"
            height="52"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M59 51H2L31 2l28 49Z"
            />
          </svg>
        );

      case "warningTriangle":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="53"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M1 32v20h42V32L22 2 1 32Z"
            />
          </svg>
        );

      case "semiround":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="57"
            height="53"
            fill="none"
          >
            <path stroke="#000" d="M57 29a29 29 0 0 0-57 0h57Z" />
          </svg>
        );

      case "roundTop":
        return (
          <svg
            width="57"
            height="53"
            viewBox="0 0 20 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M1 9C1 10.9526 1 14 1 14H10.6429H19V9" stroke="black" />
            <path
              d="M19 9.60215C19 4.53459 15.6806 1 9.99999 1C4.31935 1 1 4.82133 1 9.88889"
              stroke="black"
            />
          </svg>
        );
      case "leftArrow":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="57"
            height="44"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M56 34V10H18V3L2 22l16 19v-7h38Z"
            />
          </svg>
        );
      case "rightArrow":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="57"
            height="44"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M1 34V10h38V3l16 19-16 19v-7H1Z"
            />
          </svg>
        );

      case "turnLeft":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="46"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M14 45h29V1H13L2 23l12 22Z"
            />
          </svg>
        );

      case "turnRight":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="46"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M30 45H1V1h30l11 22-12 22Z"
            />
          </svg>
        );

      case "customShape":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="54"
            height="53"
            fill="none"
          >
            <path
              fill="none"
              stroke="#000"
              strokeWidth="2"
              d="M1 16v32l16-5 21 9 15-9V16H38L21 2 1 16Z"
            />
          </svg>
        );

      case "line":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="62"
            height="2"
            fill="none"
          >
            <path stroke="#000" strokeWidth="2" d="M0 1h62" />
          </svg>
        );

      case "dashedLine":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="62"
            height="2"
            fill="none"
          >
            <path
              stroke="#000"
              strokeDasharray="10.5 4.5"
              strokeWidth="2"
              d="M0 1h62"
            />
          </svg>
        );

      default:
        return <div></div>;
    }
  };

  return (
    <>
      {isOpen && (
        <div className={styles.shapeSelector}>
          <div className={styles.dropdown} ref={dropdownRef}>
            <div className={styles.dropdownHeader}>
              <h3>Shapes</h3>
              <button className={styles.closeBtn} onClick={onClose}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12.0008 12.0001L14.8292 14.8285M9.17236 14.8285L12.0008 12.0001L9.17236 14.8285ZM14.8292 9.17163L12.0008 12.0001L14.8292 9.17163ZM12.0008 12.0001L9.17236 9.17163L12.0008 12.0001Z"
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

            <div className={styles.content}>
              <div className={styles.shapesGrid}>
                {shapes.map((shape) => (
                  <div
                    key={shape.id}
                    className={styles.shapeItem}
                    onClick={() => addShape(shape.id)}
                    title={shape.name}
                  >
                    <div className={styles.shapeIcon}>
                      {renderShapeIcon(shape.id)}
                    </div>
                    <span className={styles.shapeName}>{shape.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ShapeSelector;
