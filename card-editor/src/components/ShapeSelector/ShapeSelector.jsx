import React from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import styles from "./ShapeSelector.module.css";

const ShapeSelector = ({ isOpen, onClose }) => {
  const { canvas, globalColors } = useCanvasContext();

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

  // const addShape = (shapeType) => {
  //   if (!canvas) return;

  //   let shape = null;

  //   switch (shapeType) {
  //     case "rectangle":
  //       shape = new fabric.Rect({
  //         left: 100,
  //         top: 100,
  //         width: 100,
  //         height: 60,
  //         fill: "#000000",
  //       });
  //       break;

  //     case "roundedCorners":
  //       shape = new fabric.Rect({
  //         left: 100,
  //         top: 100,
  //         width: 100,
  //         height: 60,
  //         fill: "#000000",
  //         rx: 15,
  //         ry: 15,
  //       });
  //       break;

  //     case "round":
  //       shape = new fabric.Circle({
  //         left: 100,
  //         top: 100,
  //         radius: 40,
  //         fill: "#000000",
  //       });
  //       break;

  //     case "oval":
  //       shape = new fabric.Ellipse({
  //         left: 100,
  //         top: 100,
  //         rx: 60,
  //         ry: 30,
  //         fill: "#000000",
  //       });
  //       break;

  //     case "hexagon":
  //       shape = new fabric.Polygon(
  //         [
  //           { x: 50, y: 0 },
  //           { x: 100, y: 25 },
  //           { x: 100, y: 75 },
  //           { x: 50, y: 100 },
  //           { x: 0, y: 75 },
  //           { x: 0, y: 25 },
  //         ],
  //         {
  //           left: 100,
  //           top: 100,
  //           fill: "#000000",
  //         }
  //       );
  //       break;

  //     case "octagon":
  //       shape = new fabric.Path(
  //         "M39 1L55 17V39L39 55H17L1 39V17L17 1H39Z",
  //         {
  //           left: 0,
  //           top: 0,
  //           fill: "black",
  //           stroke: "black",
  //           strokeWidth: 2,
  //           originX: 'left',
  //           originY: 'top',
  //         }
  //       );
  //       break;


  //     case "triangle":
  //       shape = new fabric.Path(
  //         "M59 51H2L31 2L59 51Z",
  //         {
  //           left: 0,
  //           top: 0,
  //           fill: "black",
  //           stroke: "black",
  //           strokeWidth: 2,
  //           originX: 'left',
  //           originY: 'top',
  //         }
  //       );
  //       break;


  //     case "warningTriangle":
  //       shape = new fabric.Path("M1 32V51.5H23.5H43V32L22 2L1 32Z", {
  //         left: 0,
  //         top: 0,
  //         fill: "black",
  //         stroke: "black",
  //         strokeWidth: 2,
  //         originX: 'left',
  //         originY: 'top',
  //       });
  //       break;

  //     case "semiround":
  //       shape = new fabric.Path(
  //         "M57 28.5C57 24.7573 56.2628 21.0513 54.8306 17.5935C53.3983 14.1357 51.299 10.9939 48.6525 8.34746C46.0061 5.70099 42.8643 3.60169 39.4065 2.16943C35.9487 0.737174 32.2427 -1.63597e-07 28.5 0C24.7573 1.63597e-07 21.0513 0.737175 17.5935 2.16943C14.1357 3.60169 10.9939 5.70099 8.34746 8.34746C5.70099 10.9939 3.60169 14.1357 2.16943 17.5935C0.737174 21.0513 -3.27195e-07 24.7573 0 28.5L28.5 28.5H57Z",
  //         {
  //           left: 0,
  //           top: 0,
  //           fill: "black",
  //           stroke: null,
  //           strokeWidth: 0,
  //           originX: 'left',
  //           originY: 'top',
  //         }
  //       );
  //       break;

  //     case "roundTop":
  //       shape = new fabric.Path("M 0 100 L 0 50 Q 0 0 50 0 Q 100 0 100 50 L 100 100 Z", {
  //         left: 100,
  //         top: 100,
  //         fill: "#000000",
  //       });
  //       break;
  //     case "leftArrow":
  //       shape = new fabric.Path(
  //         "M56 34V10H18V3L2 22L18 41V34H56Z",
  //         {
  //           left: 0,
  //           top: 0,
  //           fill: "black",
  //           stroke: "black",
  //           strokeWidth: 2,
  //           originX: 'left',
  //           originY: 'top',
  //         }
  //       );
  //       break;

  //     case "rightArrow":
  //       shape = new fabric.Path(
  //         "M1 34V10H39V3L55 22L39 41V34H1Z",
  //         {
  //           left: 0,
  //           top: 0,
  //           fill: "black",
  //           stroke: "black",
  //           strokeWidth: 2,
  //           originX: 'left',
  //           originY: 'top',
  //         }
  //       );
  //       break;


  //     case "turnLeft":
  //       shape = new fabric.Path(
  //         "M14 45H43V1H13L2 23L14 45Z",
  //         {
  //           left: 0,
  //           top: 0,
  //           fill: "black",
  //           stroke: "black",
  //           strokeWidth: 2,
  //           originX: 'left',
  //           originY: 'top',
  //         }
  //       );
  //       break;


  //     case "turnRight":
  //       shape = new fabric.Path(
  //         "M30 45H1V1H31L42 23L30 45Z",
  //         {
  //           left: 0,
  //           top: 0,
  //           fill: "black",
  //           stroke: "black",
  //           strokeWidth: 2,
  //           originX: 'left',
  //           originY: 'top',
  //         }
  //       );
  //       break;


  //     case "customShape":
  //       shape = new fabric.Path(
  //         "M1 16V48L17 43L38 52L53 43V16H38L21 2L1 16Z",
  //         {
  //           left: 0,
  //           top: 0,
  //           fill: "black",
  //           stroke: "black",
  //           strokeWidth: 2,
  //           originX: 'left',
  //           originY: 'top',
  //         }
  //       );
  //       break;


  //     case "line":
  //       shape = new fabric.Line([0, 0, 100, 0], {
  //         left: 100,
  //         top: 100,
  //         stroke: "#000000",
  //         strokeWidth: 3,
  //       });
  //       break;

  //     case "dashedLine":
  //       shape = new fabric.Line([0, 0, 100, 0], {
  //         left: 100,
  //         top: 100,
  //         stroke: "#000000",
  //         strokeWidth: 3,
  //         strokeDashArray: [5, 5],
  //       });
  //       break;

  //     default:
  //       return;
  //   }

  //   if (shape) {
  //     canvas.add(shape);
  //     canvas.setActiveObject(shape);
  //     canvas.renderAll();
  //     onClose();
  //   }
  // };
  const addShape = (shapeType) => {
    if (!canvas) return;

    let shape = null;

    switch (shapeType) {
      case "rectangle":
        shape = new fabric.Path("M1 1h52v52H1z", {
          left: 0,
          top: 0,
          fill: globalColors.fillColor || "transparent",
          stroke: globalColors.strokeColor || "#000000",
          strokeWidth: 2,
          originX: "left",
          originY: "top",
        });
        break;

      case "roundedCorners":
        shape = new fabric.Path(
          "M13 1H41C47.6274 1 53 6.37258 53 13V41C53 47.6274 47.6274 53 41 53H13C6.37258 53 1 47.6274 1 41V13C1 6.37258 6.37258 1 13 1Z",
          {
            left: 0,
            top: 0,
            fill: globalColors.fillColor || "transparent",
            stroke: globalColors.strokeColor || "#000000",
            strokeWidth: 2,
            originX: "left",
            originY: "top",
          }
        );
        break;

      case "round":
        shape = new fabric.Path(
          "M30 1a29 29 0 1 1 0 58 29 29 0 0 1 0-58Z",
          {
            left: 0,
            top: 0,
            fill: globalColors.fillColor || "transparent",
            stroke: globalColors.strokeColor || "#000000",
            strokeWidth: 2,
            originX: "left",
            originY: "top",
          }
        );
        break;

      case "oval":
        shape = new fabric.Path(
          "M30 1c8 0 15 2 21 6 5 4 8 9 8 14s-3 10-8 14c-6 4-13 6-21 6s-15-2-21-6c-5-4-8-9-8-14S4 11 9 7c6-4 13-6 21-6Z",
          {
            left: 0,
            top: 0,
            fill: globalColors.fillColor || "transparent",
            stroke: globalColors.strokeColor || "#000000",
            strokeWidth: 2,
            originX: "left",
            originY: "top",
          }
        );
        break;

      case "hexagon":
        shape = new fabric.Path(
          "M59 27 45 51H16L2 27 16 2h29l14 25Z",
          {
            left: 0,
            top: 0,
            fill: globalColors.fillColor || "transparent",
            stroke: globalColors.strokeColor || "#000000",
            strokeWidth: 2,
            originX: "left",
            originY: "top",
          }
        );
        break;

      case "octagon":
        shape = new fabric.Path(
          "M39 1L55 17V39L39 55H17L1 39V17L17 1H39Z",
          {
            left: 0,
            top: 0,
            fill: globalColors.fillColor || "transparent",
            stroke: globalColors.strokeColor || "#000000",
            strokeWidth: 2,
            originX: "left",
            originY: "top",
          }
        );
        break;

      case "triangle":
        shape = new fabric.Path("M59 51H2L31 2L59 51Z", {
          left: 0,
          top: 0,
          fill: globalColors.fillColor || "transparent",
          stroke: globalColors.strokeColor || "#000000",
          strokeWidth: 2,
          originX: "left",
          originY: "top",
        });
        break;

      case "warningTriangle":
        shape = new fabric.Path("M1 32V51.5H23.5H43V32L22 2L1 32Z", {
          left: 0,
          top: 0,
          fill: globalColors.fillColor || "transparent",
          stroke: globalColors.strokeColor || "#000000",
          strokeWidth: 2,
          originX: "left",
          originY: "top",
        });
        break;

      case "semiround":
        shape = new fabric.Path(
          "M57 28.5C57 24.7573 56.2628 21.0513 54.8306 17.5935C53.3983 14.1357 51.299 10.9939 48.6525 8.34746C46.0061 5.70099 42.8643 3.60169 39.4065 2.16943C35.9487 0.737174 32.2427 -1.63597e-07 28.5 0C24.7573 1.63597e-07 21.0513 0.737175 17.5935 2.16943C14.1357 3.60169 10.9939 5.70099 8.34746 8.34746C5.70099 10.9939 3.60169 14.1357 2.16943 17.5935C0.737174 21.0513 -3.27195e-07 24.7573 0 28.5L28.5 28.5H57Z",
          {
            left: 0,
            top: 0,
            fill: globalColors.fillColor || "transparent",
            stroke: globalColors.strokeColor || "#000000",
            strokeWidth: 2,
            originX: "left",
            originY: "top",
          }
        );
        break;

      case "roundTop":
        shape = new fabric.Path("M 0 100 L 0 50 Q 0 0 50 0 Q 100 0 100 50 L 100 100 Z", {
          left: 0,
          top: 0,
          fill: globalColors.fillColor || "transparent",
          stroke: globalColors.strokeColor || "#000000",
          strokeWidth: 2,
          originX: "left",
          originY: "top",
        });
        break;

      case "leftArrow":
        shape = new fabric.Path(
          "M56 34V10H18V3L2 22L18 41V34H56Z",
          {
            left: 0,
            top: 0,
            fill: globalColors.fillColor || "transparent",
            stroke: globalColors.strokeColor || "#000000",
            strokeWidth: 2,
            originX: "left",
            originY: "top",
          }
        );
        break;

      case "rightArrow":
        shape = new fabric.Path(
          "M1 34V10H39V3L55 22L39 41V34H1Z",
          {
            left: 0,
            top: 0,
            fill: globalColors.fillColor || "transparent",
            stroke: globalColors.strokeColor || "#000000",
            strokeWidth: 2,
            originX: "left",
            originY: "top",
          }
        );
        break;

      case "turnLeft":
        shape = new fabric.Path(
          "M14 45H43V1H13L2 23L14 45Z",
          {
            left: 0,
            top: 0,
            fill: globalColors.fillColor || "transparent",
            stroke: globalColors.strokeColor || "#000000",
            strokeWidth: 2,
            originX: "left",
            originY: "top",
          }
        );
        break;

      case "turnRight":
        shape = new fabric.Path(
          "M30 45H1V1H31L42 23L30 45Z",
          {
            left: 0,
            top: 0,
            fill: globalColors.fillColor || "transparent",
            stroke: globalColors.strokeColor || "#000000",
            strokeWidth: 2,
            originX: "left",
            originY: "top",
          }
        );
        break;

      case "customShape":
        shape = new fabric.Path(
          "M1 16V48L17 43L38 52L53 43V16H38L21 2L1 16Z",
          {
            left: 0,
            top: 0,
            fill: globalColors.fillColor || "transparent",
            stroke: globalColors.strokeColor || "#000000",
            strokeWidth: 2,
            originX: "left",
            originY: "top",
          }
        );
        break;

      case "line":
        shape = new fabric.Path("M0 0L100 0", {
          left: 0,
          top: 0,
          stroke: globalColors.strokeColor || "#000000",
          strokeWidth: 3,
          fill: "",
          originX: "left",
          originY: "top",
        });
        break;

      case "dashedLine":
        shape = new fabric.Path("M0 0L100 0", {
          left: 0,
          top: 0,
          stroke: globalColors.strokeColor || "#000000",
          strokeWidth: 3,
          strokeDashArray: [5, 5],
          fill: "",
          originX: "left",
          originY: "top",
        });
        break;

      default:
        return;
    }

    if (shape) {
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
      onClose();
    }
  };

  const renderShapeIcon = (shapeType) => {

    switch (shapeType) {
      case "rectangle":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" fill="none"><path fill="#000" stroke="#000" stroke-width="2" d="M1 1h52v52H1z" /></svg>
        );

      case "roundedCorners":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" fill="none"><rect width="52" height="52" x="1" y="1" fill="#000" stroke="#000" stroke-width="2" rx="12" /></svg>
        );

      case "round":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" fill="none"><path fill="#000" stroke="#000" stroke-width="2" d="M30 1a29 29 0 1 1 0 58 29 29 0 0 1 0-58Z" /></svg>
        );

      case "oval":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="60" height="42" fill="none"><path fill="#000" stroke="#000" stroke-width="2" d="M30 1c8 0 15 2 21 6 5 4 8 9 8 14s-3 10-8 14c-6 4-13 6-21 6s-15-2-21-6c-5-4-8-9-8-14S4 11 9 7c6-4 13-6 21-6Z" /></svg>
        );

      case "hexagon":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="61" height="53" fill="none"><path fill="#000" stroke="#000" stroke-width="2" d="M59 27 45 51H16L2 27 16 2h29l14 25Z" /></svg>
        );

      case "octagon":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" fill="none"><path fill="#000" stroke="#000" stroke-width="2" d="m39 1 16 16v22L39 55H17L1 39V17L17 1h22Z" /></svg>
        );

      case "triangle":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="61" height="52" fill="none"><path fill="#000" stroke="#000" stroke-width="2" d="M59 51H2L31 2l28 49Z" /></svg>
        );

      case "warningTriangle":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="53" fill="none"><path fill="#000" stroke="#000" stroke-width="2" d="M1 32v20h42V32L22 2 1 32Z" /></svg>
        );

      case "semiround":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="57" height="29" fill="none"><path fill="#000" d="M57 29a29 29 0 0 0-57 0h57Z" /></svg>
        );

      case "roundTop":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" fill="none"><path fill="#000" d="M44 22a22 22 0 1 0-44 0h44ZM0 22h44v20H0z" /></svg>
        );
      case "leftArrow":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="57" height="44" fill="none"><path fill="#000" stroke="#000" stroke-width="2" d="M56 34V10H18V3L2 22l16 19v-7h38Z" /></svg>
        );
      case "rightArrow":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="57" height="44" fill="none"><path fill="#000" stroke="#000" stroke-width="2" d="M1 34V10h38V3l16 19-16 19v-7H1Z" /></svg>
        );

      case "turnLeft":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="46" fill="none"><path fill="#000" stroke="#000" stroke-width="2" d="M14 45h29V1H13L2 23l12 22Z" /></svg>
        );

      case "turnRight":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="46" fill="none"><path fill="#000" stroke="#000" stroke-width="2" d="M30 45H1V1h30l11 22-12 22Z" /></svg>
        );

      case "customShape":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="54" height="53" fill="none"><path fill="#000" stroke="#000" stroke-width="2" d="M1 16v32l16-5 21 9 15-9V16H38L21 2 1 16Z" /></svg>
        );

      case "line":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="62" height="2" fill="none"><path stroke="#000" stroke-width="2" d="M0 1h62" /></svg>
        );

      case "dashedLine":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="62" height="2" fill="none"><path stroke="#000" stroke-dasharray="10.5 4.5" stroke-width="2" d="M0 1h62" /></svg>
        );

      default:
        return <div></div>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.shapeSelector}>
      <div className={styles.dropdown}>
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
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="#006CA4"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
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
  );
};

export default ShapeSelector;
