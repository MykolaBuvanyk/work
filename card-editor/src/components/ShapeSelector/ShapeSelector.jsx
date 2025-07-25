import React from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import styles from "./ShapeSelector.module.css";

const ShapeSelector = ({ isOpen, onClose }) => {
  const { canvas } = useCanvasContext();

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
    { id: "rightArrow", name: "Right arrow" },
    { id: "turnLeft", name: "Turn left" },
    { id: "turnRight", name: "Turn right" },
    { id: "customShape", name: "Custom shape" },
    { id: "line", name: "Line" },
    { id: "dashedLine", name: "Dashed Line" },
  ];

  const addShape = (shapeType) => {
    if (!canvas) return;

    let shape = null;

    switch (shapeType) {
      case "rectangle":
        shape = new fabric.Rect({
          left: 100,
          top: 100,
          width: 100,
          height: 60,
          fill: "#000000",
        });
        break;

      case "roundedCorners":
        shape = new fabric.Rect({
          left: 100,
          top: 100,
          width: 100,
          height: 60,
          fill: "#000000",
          rx: 15,
          ry: 15,
        });
        break;

      case "round":
        shape = new fabric.Circle({
          left: 100,
          top: 100,
          radius: 40,
          fill: "#000000",
        });
        break;

      case "oval":
        shape = new fabric.Ellipse({
          left: 100,
          top: 100,
          rx: 60,
          ry: 30,
          fill: "#000000",
        });
        break;

      case "hexagon":
        shape = new fabric.Polygon(
          [
            { x: 50, y: 0 },
            { x: 100, y: 25 },
            { x: 100, y: 75 },
            { x: 50, y: 100 },
            { x: 0, y: 75 },
            { x: 0, y: 25 },
          ],
          {
            left: 100,
            top: 100,
            fill: "#000000",
          }
        );
        break;

      case "octagon":
        shape = new fabric.Polygon(
          [
            { x: 30, y: 0 },
            { x: 70, y: 0 },
            { x: 100, y: 30 },
            { x: 100, y: 70 },
            { x: 70, y: 100 },
            { x: 30, y: 100 },
            { x: 0, y: 70 },
            { x: 0, y: 30 },
          ],
          {
            left: 100,
            top: 100,
            fill: "#000000",
          }
        );
        break;

      case "triangle":
        shape = new fabric.Polygon(
          [
            { x: 50, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
          {
            left: 100,
            top: 100,
            fill: "#000000",
          }
        );
        break;

      case "warningTriangle":
        shape = new fabric.Polygon(
          [
            { x: 50, y: 0 },
            { x: 100, y: 80 },
            { x: 0, y: 80 },
          ],
          {
            left: 100,
            top: 100,
            fill: "#000000",
          }
        );
        break;

      case "semiround":
        shape = new fabric.Path("M 0 50 Q 50 0 100 50 L 100 100 L 0 100 Z", {
          left: 100,
          top: 100,
          fill: "#000000",
        });
        break;

      case "roundTop":
        shape = new fabric.Path("M 0 100 L 0 50 Q 0 0 50 0 Q 100 0 100 50 L 100 100 Z", {
          left: 100,
          top: 100,
          fill: "#000000",
        });
        break;

      case "rightArrow":
        shape = new fabric.Polygon(
          [
            { x: 0, y: 25 },
            { x: 60, y: 25 },
            { x: 60, y: 10 },
            { x: 100, y: 40 },
            { x: 60, y: 70 },
            { x: 60, y: 55 },
            { x: 0, y: 55 },
          ],
          {
            left: 100,
            top: 100,
            fill: "#000000",
          }
        );
        break;

      case "turnLeft":
        shape = new fabric.Polygon(
          [
            { x: 20, y: 40 },
            { x: 0, y: 20 },
            { x: 20, y: 0 },
            { x: 30, y: 10 },
            { x: 80, y: 10 },
            { x: 80, y: 30 },
            { x: 30, y: 30 },
          ],
          {
            left: 100,
            top: 100,
            fill: "#000000",
          }
        );
        break;

      case "turnRight":
        shape = new fabric.Polygon(
          [
            { x: 80, y: 40 },
            { x: 100, y: 20 },
            { x: 80, y: 0 },
            { x: 70, y: 10 },
            { x: 20, y: 10 },
            { x: 20, y: 30 },
            { x: 70, y: 30 },
          ],
          {
            left: 100,
            top: 100,
            fill: "#000000",
          }
        );
        break;

      case "customShape":
        shape = new fabric.Polygon(
          [
            { x: 20, y: 0 },
            { x: 80, y: 0 },
            { x: 100, y: 30 },
            { x: 80, y: 60 },
            { x: 60, y: 80 },
            { x: 40, y: 80 },
            { x: 20, y: 60 },
            { x: 0, y: 30 },
          ],
          {
            left: 100,
            top: 100,
            fill: "#000000",
          }
        );
        break;

      case "line":
        shape = new fabric.Line([0, 0, 100, 0], {
          left: 100,
          top: 100,
          stroke: "#000000",
          strokeWidth: 3,
        });
        break;

      case "dashedLine":
        shape = new fabric.Line([0, 0, 100, 0], {
          left: 100,
          top: 100,
          stroke: "#000000",
          strokeWidth: 3,
          strokeDashArray: [5, 5],
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
    const iconStyle = {
      width: "40px",
      height: "40px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    };

    switch (shapeType) {
      case "rectangle":
        return <div style={{...iconStyle, backgroundColor: "#000000"}}></div>;
      
      case "roundedCorners":
        return <div style={{...iconStyle, backgroundColor: "#000000", borderRadius: "8px"}}></div>;
      
      case "round":
        return <div style={{...iconStyle, backgroundColor: "#000000", borderRadius: "50%"}}></div>;
      
      case "oval":
        return <div style={{...iconStyle, backgroundColor: "#000000", borderRadius: "50%", width: "50px", height: "30px"}}></div>;
      
      case "hexagon":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <polygon points="20,2 35,12 35,28 20,38 5,28 5,12" fill="#000000"/>
          </svg>
        );
      
      case "octagon":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <polygon points="12,2 28,2 38,12 38,28 28,38 12,38 2,28 2,12" fill="#000000"/>
          </svg>
        );
      
      case "triangle":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <polygon points="20,2 38,35 2,35" fill="#000000"/>
          </svg>
        );
      
      case "warningTriangle":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <polygon points="20,5 35,32 5,32" fill="#000000"/>
          </svg>
        );
      
      case "semiround":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <path d="M 2 20 Q 20 2 38 20 L 38 38 L 2 38 Z" fill="#000000"/>
          </svg>
        );
      
      case "roundTop":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <path d="M 2 38 L 2 20 Q 2 2 20 2 Q 38 2 38 20 L 38 38 Z" fill="#000000"/>
          </svg>
        );
      
      case "rightArrow":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <polygon points="2,15 25,15 25,8 38,20 25,32 25,25 2,25" fill="#000000"/>
          </svg>
        );
      
      case "turnLeft":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <polygon points="15,20 2,10 15,2 20,6 30,6 30,14 20,14" fill="#000000"/>
          </svg>
        );
      
      case "turnRight":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <polygon points="25,20 38,10 25,2 20,6 10,6 10,14 20,14" fill="#000000"/>
          </svg>
        );
      
      case "customShape":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <polygon points="20,2 30,8 38,15 30,25 25,35 15,35 10,25 2,15 10,8" fill="#000000"/>
          </svg>
        );
      
      case "line":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <line x1="5" y1="20" x2="35" y2="20" stroke="#000000" strokeWidth="3"/>
          </svg>
        );
      
      case "dashedLine":
        return (
          <svg width="40" height="40" viewBox="0 0 40 40">
            <line x1="5" y1="20" x2="35" y2="20" stroke="#000000" strokeWidth="3" strokeDasharray="3,3"/>
          </svg>
        );
      
      default:
        return <div style={iconStyle}></div>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.shapeSelector}>
      <div className={styles.dropdown}>
        <div className={styles.dropdownHeader}>
          <h3>Shapes</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
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
