import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import CircleWithCut from "../../utils/CircleWithCut";
// Fallback for environments where fabric is default-exported
const FabricNS = (fabric && (fabric.fabric || fabric)) || null;
import styles from "./CutSelector.module.css";

const CutSelector = ({ isOpen, onClose }) => {
  const { canvas, setActiveObject } = useCanvasContext();
  const dropdownRef = useRef(null);
  const [activeTab, setActiveTab] = useState("cut"); // 'cut' | 'shape'

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

  if (!isOpen) return null;

  // Функція для отримання координат центру полотна
  const getCenterCoordinates = () => {
    if (!canvas) return { centerX: 100, centerY: 100 };
    return {
      centerX: canvas.getWidth() / 2,
      centerY: canvas.getHeight() / 2,
    };
  };

  // Функції для додавання різних форм вирізів (тут ви додасте свою логіку)
  // --- SHAPE tab adders (regular editable shapes, NOT cut elements) ---
  const addShapeObject = (obj) => {
    if (!canvas || !obj) return;
    // Debug: ensure click is firing
    // eslint-disable-next-line no-console
    console.debug("Add shape to canvas", {
      hasCanvas: !!canvas,
      type: obj?.type,
    });

    // Disable theme color following for shapes from CutSelector
    if (typeof obj.set === "function") {
      obj.set({
        followThemeStroke: false,
        useThemeColor: false,
      });
    }

    // Set default properties for ShapeProperties modal: Cut enabled, Fill disabled
    obj.pendingShapePropsDefaults = { fill: false, cut: true };

    // Помечаем объект как добавленный из вкладки SHAPE, чтобы не показывать Shape Properties
    try {
      obj.fromShapeTab = true;
      obj.data = { ...(obj.data || {}), fromShapeTab: true };
    } catch {}
    canvas.add(obj);
    if (typeof obj.setCoords === "function") obj.setCoords();
    canvas.setActiveObject(obj);
    if (typeof setActiveObject === "function") setActiveObject(obj);
    if (obj.bringToFront) obj.bringToFront();
    // Ensure path has bbox for controls
    if (obj.type === "path" && (!obj.width || !obj.height)) {
      obj.set({ width: 80, height: 80 });
    }
    canvas.requestRenderAll();
    setTimeout(() => {
      if (!canvas || !obj) return;
      canvas.setActiveObject(obj);
      if (obj.bringToFront) obj.bringToFront();
      if (typeof obj.setCoords === "function") obj.setCoords();
      canvas.requestRenderAll();
    }, 0);
  };

  const shapeBase = () => {
    const { centerX, centerY } = getCenterCoordinates();
    return {
      left: centerX || 200,
      top: centerY || 200,
      originX: "center",
      originY: "center",
      fill: "#FFFFFF",
      stroke: "#FD7714",
      strokeWidth: 1.5,
      strokeUniform: true,
      selectable: true,
      hasControls: true,
      lockScalingFlip: true,
    };
  };

  const addShapeHexagon = () => {
    if (!canvas) return;
    const opts = shapeBase();
    const d = "M59 27 45 51H16L2 27 16 2h29l14 25Z";
    const path = new (FabricNS?.Path || fabric.Path)(d, {
      ...opts,
      width: 61,
      height: 53,
      scaleX: 1,
      scaleY: 1,
    });
    addShapeObject(path);
  };

  const addShapeOctagon = () => {
    if (!canvas) return;
    const opts = shapeBase();
    const d = "M39 1L55 17V39L39 55H17L1 39V17L17 1H39Z";
    const path = new (FabricNS?.Path || fabric.Path)(d, {
      ...opts,
      width: 56,
      height: 56,
      scaleX: 1,
      scaleY: 1,
    });
    addShapeObject(path);
  };

  const addShapeRightTriangle = () => {
    if (!canvas) return;
    const opts = shapeBase();
    // Прямий кут знизу-зліва
    const d = "M2 51H59L2 2Z";
    const path = new (FabricNS?.Path || fabric.Path)(d, {
      ...opts,
      width: 61,
      height: 53,
      scaleX: 1,
      scaleY: 1,
    });
    addShapeObject(path);
  };

  const addShapeQuarterCircleTR = () => {
    if (!canvas) return;
    const opts = shapeBase();
    // Чверть кола (верхня права)
    const d = "M10 10H70V70A60 60 0 0 1 10 10Z";
    const path = new (FabricNS?.Path || fabric.Path)(d, {
      ...opts,
      width: 70,
      height: 70,
      scaleX: 1,
      scaleY: 1,
    });
    addShapeObject(path);
  };

  const addShapeArch = () => {
    if (!canvas) return;
    const opts = shapeBase();
    // Висока півовальна арка
    const d = "M10 95 A40 90 0 0 1 90 95 L10 95 Z";
    const path = new (FabricNS?.Path || fabric.Path)(d, {
      ...opts,
      width: 100,
      height: 100,
      scaleX: 0.8,
      scaleY: 0.8,
    });
    addShapeObject(path);
  };

  const addShapeCircleWithCut = () => {
    if (!canvas) return;
    const opts = shapeBase();
    const obj = new CircleWithCut({
      ...opts,
      width: 60,
      height: 74,
      orientation: "vertical",
    });
    addShapeObject(obj);
  };

  const addCut1 = () => {
    if (canvas) {
      const { centerX, centerY } = getCenterCoordinates();
      // Замкнута фігура: коло з впадиною зверху
      const path = new fabric.Path(
        // Створюємо замкнений контур: від точки впадинки по колу і назад через впадинку
        "M32.4331.75C14.2622 2.2694.5213 17.8471 1.2818 36.066 2.0421 54.2846 17.0333 68.663 35.2678 68.663 53.5025 68.6633 68.4935 54.2849 69.254 36.066 70.0146 17.8475 56.2739 2.2696 38.1027.75L38.1028 3.5846 32.4331 3.5847Z",
        {
          left: centerX,
          top: centerY,
          originX: "center",
          originY: "center",
          fill: "#FFFFFF",
          stroke: "#FD7714",
          strokeWidth: 1.5,
          strokeLineCap: "round",
          strokeLineJoin: "bevel",
          selectable: true,
          hasControls: false, // Забороняємо зміну розміру
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: "shape", // Додаємо тип cut елементу
        }
      );

      canvas.add(path);
      canvas.setActiveObject(path);
      canvas.renderAll();
      onClose();
    }
  };

  const addCut2 = () => {
    if (canvas) {
      const { centerX, centerY } = getCenterCoordinates();
      // Напівкруглі вирізи з боків - робимо замкнену фігуру
      const path = new fabric.Path(
        "M15.8443.7545h42.2514L58.0957.7545a36.2155 36.2155 90 010 58.0957L58.0957 58.8502h-42.2514L15.8443 58.8502a36.2155 36.2155 90 010-58.0957ZM15.8443.7471h42.2514L58.0957.7471a36.2155 35.8606 0 010 57.5264L58.0957 58.2735h-42.2514L15.8443 58.2735a36.2155 35.8606 0 010-57.5264Z",
        {
          left: centerX,
          top: centerY,
          originX: "center",
          originY: "center",
          fill: "#FFFFFF",
          stroke: "#FD7714",
          strokeWidth: 1.5,
          strokeLineCap: "round",
          strokeLineJoin: "bevel",
          selectable: true,
          hasControls: false,
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: "shape", // Додаємо тип cut елементу
        }
      );
      canvas.add(path);
      canvas.setActiveObject(path);
      canvas.renderAll();
      onClose();
    }
  };

  const addCut3 = () => {
    if (canvas) {
      const { centerX, centerY } = getCenterCoordinates();
      // Напівколо з прямою лінією внизу
      const path = new fabric.Path(
        "M7.8525 53.4221h49.2375M57.09 53.4221a31.8943 31.89 90 10-49.2375 0",
        {
          left: centerX,
          top: centerY,
          originX: "center",
          originY: "center",
          fill: "#FFFFFF",
          stroke: "#FD7714",
          strokeWidth: 1.5,
          strokeLineCap: "round",
          strokeLineJoin: "bevel",
          selectable: true,
          hasControls: false,
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: "shape", // Додаємо тип cut елементу
        }
      );
      canvas.add(path);
      canvas.setActiveObject(path);
      canvas.renderAll();
      onClose();
    }
  };

  const addCut4 = () => {
    if (canvas) {
      const { centerX, centerY } = getCenterCoordinates();
      // Вертикальні напівкруглі вирізи - робимо замкнену фігуру
      const path = new fabric.Path(
        "M1.514 20.0408v28.5196L1.514 48.5604a33.1444 32.551 90 0057.532 0L59.046 48.5604v-28.5196L59.046 20.0408a33.1444 32.551 90 00-57.532 0Z",
        {
          left: centerX,
          top: centerY,
          originX: "center",
          originY: "center",
          fill: "#FFFFFF",
          stroke: "#FD7714",
          strokeWidth: 1.5,
          strokeLineCap: "round",
          strokeLineJoin: "bevel",
          selectable: true,
          hasControls: false,
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          isCutElement: true, // Позначаємо як Cut елемент
          cutType: "shape", // Додаємо тип cut елементу
        }
      );
      canvas.add(path);
      canvas.setActiveObject(path);
      canvas.renderAll();
      onClose();
    }
  };

  const addCut5 = () => {
    if (canvas) {
      const { centerX, centerY } = getCenterCoordinates();
      // Великі вертикальні напівкруглі вирізи - робимо замкнену фігуру
      const path = new fabric.Path(
        "M.754 25.146v28.956L.754 54.102a38.862 38.454 90 0070.876 0L71.63 54.102v-28.956L71.63 25.146a38.862 38.454 90 00-70.876 0Z",
        {
          left: centerX,
          top: centerY,
          originX: "center",
          originY: "center",
          fill: "#FFFFFF",
          stroke: "#FD7714",
          strokeWidth: 1.5,
          strokeLineCap: "round",
          strokeLineJoin: "bevel",
          selectable: true,
          hasControls: false,
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          isCutElement: true,
          cutType: "shape",
        }
      );
      canvas.add(path);
      canvas.setActiveObject(path);
      canvas.renderAll();
      onClose();
    }
  };

  const addCut6 = () => {
    if (canvas) {
      const { centerX, centerY } = getCenterCoordinates();

      // Створюємо замкнений path тільки для областей, які мають бути білими (виключаємо всі впадини)
      // const filledPath = new fabric.Path(
      //   "M39 3L46 3L46 1C66 3 81 18 83 38L81 38L81 46L83 46C81 66 66 81 46 83L46 81L39 81L39 83C19 81 4 66 2 46L4 46L4 38L2 38C4 18 19 3 39 1L39 3Z",
      //   {
      //     left: centerX,
      //     top: centerY,
      //     originX: "center",
      //     originY: "center",
      //     fill: "#FFFFFF",
      //     stroke: "transparent",
      //     strokeWidth: 0,
      //     selectable: false,
      //     evented: false,
      //   }
      // );

      // Оригінальний бордер з впадинами
      const border = new fabric.Path(
        "M32.7773 2.5213 38.6604 2.5213 38.6604.8404C55.4692 2.5213 68.0759 15.128 69.7568 31.9368L68.0759 31.9368 68.0759 38.6604 69.7568 38.6604C68.0759 55.4692 55.4692 68.0759 38.6604 69.7568L38.6604 68.0759 32.7773 68.0759 32.7773 69.7568C15.9684 68.0759 3.3618 55.4692 1.6809 38.6604L3.3618 38.6604 3.3618 31.9368 1.6809 31.9368C3.3618 15.128 15.9684 2.5213 32.7773.8404L32.7773 2.5213Z",
        {
          left: centerX,
          top: centerY,
          originX: "center",
          originY: "center",
          fill: "white",
          stroke: "#FD7714",
          strokeWidth: 1.5,
          strokeLineCap: "round",
          strokeLineJoin: "bevel",
          selectable: false,
          evented: false,
        }
      );

      const group = new fabric.Group([border], {
        left: centerX,
        top: centerY,
        originX: "center",
        originY: "center",
        selectable: true,
        hasControls: false,
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        isCutElement: true,
        cutType: "shape",
      });

      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
      onClose();
    }
  };
  const addCut7 = () => {
    if (canvas) {
      const { centerX, centerY } = getCenterCoordinates();

      // Коло з вирізаною впадиною знизу
      const path = new fabric.Path(
        "M39.39 68.9325a34.0875 34.0875 90 10-9.09 0M39.39 68.9325a4.545 4.545 90 00-9.09 0",
        {
          left: centerX,
          top: centerY,
          originX: "center",
          originY: "center",
          fill: "#FFFFFF",
          fillRule: "evenodd", // Для вирізання впадини
          stroke: "#FD7714",
          strokeWidth: 1.5,
          strokeLineCap: "round",
          strokeLineJoin: "bevel",
          selectable: true,
          hasControls: false,
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          isCutElement: true,
          cutType: "shape",
        }
      );

      canvas.add(path);
      canvas.setActiveObject(path);
      canvas.renderAll();
      onClose();
    }
  };

  const addCut8 = () => {
    if (canvas) {
      const { centerX, centerY } = getCenterCoordinates();
      // Маленькі вертикальні напівкруглі вирізи - робимо замкнену фігуру
      const path = new fabric.Path(
        "M.7557 13.6134v29.4957L.7557 43.1091a27.2268 27.2052 90 0045.342 0L46.0977 43.1091v-29.4957L46.0977 13.6134a27.2268 27.2052 90 00-45.342 0Z",
        {
          left: centerX,
          top: centerY,
          originX: "center",
          originY: "center",
          fill: "#FFFFFF",
          stroke: "#FD7714",
          strokeWidth: 1.5,
          strokeLineCap: "round",
          strokeLineJoin: "bevel",
          selectable: true,
          hasControls: false,
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          isCutElement: true,
          cutType: "shape",
        }
      );
      canvas.add(path);
      canvas.setActiveObject(path);
      canvas.renderAll();
      onClose();
    }
  };

  const addCut9 = () => {
    if (canvas) {
      const { centerX, centerY } = getCenterCoordinates();
      // Коло з прямокутним вирізом знизу - використовуємо evenodd як для addCut1
      const path = new fabric.Path(
        "M26.964 44.94a22.47 22.47 90 10-8.239 0L18.725 42.693h8.239L26.964 42.693ZM18.725 44.94v-2.247M18.725 42.693h8.239M26.964 42.693v2.247",
        {
          left: centerX,
          top: centerY,
          originX: "center",
          originY: "center",
          fill: "#FFFFFF",
          fillRule: "evenodd", // Для прозорої впадини
          stroke: "#FD7714",
          strokeWidth: 1.5,
          strokeLineCap: "round",
          strokeLineJoin: "bevel",
          selectable: true,
          hasControls: false,
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          isCutElement: true,
          cutType: "shape",
        }
      );
      canvas.add(path);
      canvas.setActiveObject(path);
      canvas.renderAll();
      onClose();
    }
  };

  const addCut10 = () => {
    if (canvas) {
      // Коло з трикутним вирізом знизу
      const { centerX, centerY } = getCenterCoordinates();
      // const filledPath = new fabric.Path(
      //   // Круг, описаний кубічними кривими (той самий, що й бордер), + трикутник для вирізу
      //   // Використовуємо точні координати, щоб заповнення і бордер співпадали.
      //   "M41.3126 91.8812C17.387 89.22 -0.291335 68.3305 1.04133 44.2942C2.37399 20.258 22.2531 1.45068 46.3265 1.45068C70.3994 1.45068 90.2786 20.2583 91.6109 44.2942C92.9436 68.3305 75.2652 89.2204 51.3397 91.8812Z M41.3126 91.8813L46.3257 86.8682L51.3397 91.8813L41.3126 91.8813Z",
      //   {
      //     left: centerX,
      //     top: centerY,
      //     originX: "center",
      //     originY: "center",
      //     fill: "#FFFFFF",
      //     fillRule: "evenodd",
      //     stroke: "transparent",
      //     strokeWidth: 0,
      //     selectable: false,
      //     evented: false,
      //   }
      // );

      const borderPath = new fabric.Path(
        // Бордер скопійований за формою з наданого SVG: дві короткі лінії + довга дуга кола
        "M30.7951 69.1012C13.0594 67.0131-.2188 51.323.7821 33.2694 1.7831 15.2158 16.7143 1.0896 34.7958 1.0896c18.0812 0 33.0124 14.1264 34.0131 32.1798 1.001 18.0537-12.2773 33.7441-30.5028 35.8318L34.5506 65.3457Z",
        {
          left: centerX,
          top: centerY,
          originX: "center",
          originY: "center",
          fill: "#FFFFFF",
          stroke: "#FD7714",
          strokeWidth: 1.5,
          strokeLineCap: "round",
          strokeLineJoin: "bevel",
          selectable: false,
          evented: false,
        }
      );

      const group = new fabric.Group([borderPath], {
        left: centerX,
        top: centerY,
        originX: "center",
        originY: "center",
        selectable: true,
        hasControls: false,
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        isCutElement: true,
        cutType: "shape",
      });

      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
      onClose();
    }
  };

  const addCut11 = () => {
    if (canvas) {
      const { centerX, centerY } = getCenterCoordinates();
      // Компактні вертикальні напівкруглі вирізи — робимо тільки білий фон (без stroke)
      // Основна форма (бордер + прозоре всередині) залишаємо як path
      const path = new fabric.Path(
        "M.6378 11.4647v24.8402L.6378 36.3049a22.9599 22.9294 0 0038.2665 0L38.9043 36.3049v-24.8402L38.9043 11.4647a22.9599 22.9294 0 00-38.2665 0Z",
        {
          left: centerX,
          top: centerY,
          originX: "center",
          originY: "center",
          fill: "#FFFFFF",
          stroke: "#FD7714",
          strokeWidth: 1.5,
          strokeLineCap: "round",
          strokeLineJoin: "bevel",
          selectable: true,
          hasControls: false,
          hasBorders: true,
          lockScalingX: true,
          lockScalingY: true,
          lockUniScaling: true,
          isCutElement: true,
          cutType: "shape",
        }
      );

      // Додаємо окремий прямокутник-підкладку, щоб весь центр був білим
      // Розміри прямокутника підібрані приблизно під іконку; можна підправити
      // const bgRect = new fabric.Path(
      //   // Прямокутник шириною ~56 і висотою ~36, розміщений відносно центру іконки (збільшена ширина)
      //   "M2 26h50v36H2z",
      //   {
      //     left: centerX,
      //     top: centerY,
      //     originX: "center",
      //     originY: "center",
      //     fill: "#FFFFFF",
      //     stroke: "transparent",
      //     selectable: false,
      //     evented: false,
      //   }
      // );

      // Групуємо фон і бордер разом (фон буде внизу завдяки порядку)
      const group = new fabric.Group([path], {
        left: centerX,
        top: centerY,
        originX: "center",
        originY: "center",
        selectable: true,
        hasControls: false,
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
        isCutElement: true,
        cutType: "shape",
      });

      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
      onClose();
    }
  };

  // Функція для рендерингу іконки
  // Закриваємо модалку одразу при кліку, потім виконуємо додавання на canvas
  const renderCutIcon = (svgIcon, onClick, title) => {
    const handleTrigger = (e) => {
      e?.stopPropagation?.();
      try {
        if (typeof onClick === "function") onClick();
      } finally {
        if (typeof onClose === "function") setTimeout(onClose, 0);
      }
    };
    const handleKey = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        handleTrigger(e);
      }
    };
    // Массив названий для первых 11 фигур
    const cutNames = [
      "R=12mm\u200B\nKey=1x2mm",
      "W=25.2mm\u200B\nH=20.3mm",
      "W=22.5mm\u200B\nH=18.4mm",
      "H=22.5mm\u200B\nW=20.3mm",
      "H=27mm\u200B\nW=25mm",
      "W=H=21.7mm\u200B\nKey=2x0.6",
      "W=H=24mm\u200B\nKey=R1.6",
      "H=19mm\u200B\nW=16mm",
      "W=H=15.8mm\u200B\nKey=3x0.8",
      "W=H=24mm\u200B\nKey=1.4",
      "H=16mm\u200B\nW=13.5mm",
    ];
    // Названия для вкладки SHAPE (в указанном порядке)
    const shapeLabelByTitle = {
      Arch: "180° arc",
      "Quarter Circle TR": "90° arc",
      Hexagon: "Hexagon",
      Octagon: "Octagon",
      "Right Triangle": "Triangle",
      "Circle with Cut": "Circle with cut off",
    };
    // Определяем индекс фигуры по названию title
    let cutIndex = null;
    if (title && title.startsWith("Cut Shape ")) {
      const num = parseInt(title.replace("Cut Shape ", ""), 10);
      if (!isNaN(num)) cutIndex = num - 1;
    }
    return (
      <div
        className={styles.cutOption}
        role="button"
        tabIndex={0}
        onMouseDown={handleTrigger}
        onClick={handleTrigger}
        onKeyDown={handleKey}
        title={title}
      >
        {svgIcon}
        {cutIndex !== null && cutIndex < cutNames.length && (
          <div
            style={{
              fontWeight: 400,
              fontSize: "12px",
              color: "#333",
              textAlign: "center",
              marginTop: "6px",
              whiteSpace: "pre-line",
              lineHeight: "1.2",
            }}
          >
            {cutNames[cutIndex]
              .replace(/\u200B\n/g, "\n")
              .replace(/\n/g, "\u000A")}
          </div>
        )}
        {activeTab === "shape" && title && shapeLabelByTitle[title] && (
          <div
            style={{
              fontWeight: 400,
              fontSize: "12px",
              color: "#333",
              textAlign: "center",
              marginTop: "6px",
              whiteSpace: "pre-line",
              lineHeight: "1.2",
            }}
          >
            {shapeLabelByTitle[title]}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.cutSelector}>
      <div className={styles.dropdown} ref={dropdownRef}>
        <div className={styles.dropdownHeader}>
          <div className={styles.tabSwitch}>
            <button
              className={`${styles.tabBtn} ${
                activeTab === "cut" ? styles.tabBtnActive : ""
              }`}
              onClick={() => setActiveTab("cut")}
              type="button"
            >
              CUT
            </button>
            <button
              className={`${styles.tabBtn} ${
                activeTab === "shape" ? styles.tabBtnActive : ""
              }`}
              onClick={() => setActiveTab("shape")}
              type="button"
            >
              SHAPE
            </button>
          </div>
          <h3>Cut Shapes</h3>
          <button className={styles.closeBtn} onClick={onClose} type="button">
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

        {activeTab === "cut" ? (
          <div className={styles.cutGrid}>
            {/* Ряд 1 */}
            {renderCutIcon(
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="94"
                height="93"
                fill="none"
              >
                <path
                  stroke="#FD7714"
                  stroke-linecap="round"
                  stroke-linejoin="bevel"
                  strokeMiterlimit="22.9"
                  stroke-width="1.5"
                  d="M43 1a45 45 0 1 0 8 0M43 5h8M51 5V1M43 5V1"
                />
              </svg>,
              addCut1,
              "Cut Shape 1"
            )}
            {renderCutIcon(
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="98"
                height="79"
                fill="none"
              >
                <path
                  stroke="#FD7714"
                  stroke-linecap="round"
                  stroke-linejoin="bevel"
                  strokeMiterlimit="22.9"
                  stroke-width="1.5"
                  d="M21 1h56M21 78h56M21 1a48 48 0 0 0 0 77M77 78a48 48 0 0 0 0-77"
                />
              </svg>,
              addCut2,
              "Cut Shape 2"
            )}
            {renderCutIcon(
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="87"
                height="72"
                fill="none"
              >
                <path
                  stroke="#FD7714"
                  stroke-linecap="round"
                  stroke-linejoin="bevel"
                  strokeMiterlimit="22.93"
                  stroke-width="1.5"
                  d="M10.47 71.22h65.65M76.12 71.22a42.52 42.52 0 1 0-65.65 0"
                />
              </svg>,
              addCut3,
              "Cut Shape 3"
            )}
            {renderCutIcon(
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="79"
                height="88"
                fill="none"
              >
                <path
                  stroke="#FD7714"
                  stroke-linecap="round"
                  stroke-linejoin="bevel"
                  strokeMiterlimit="22.9"
                  stroke-width="1.5"
                  d="M2 26v37M78 26v37M78 26a43 43 0 0 0-76 0M2 63a43 43 0 0 0 76 0"
                />
              </svg>,
              addCut4,
              "Cut Shape 4"
            )}

            {/* Ряд 2 */}
            {renderCutIcon(
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="97"
                height="104"
                fill="none"
              >
                <path
                  stroke="#FD7714"
                  stroke-linecap="round"
                  stroke-linejoin="bevel"
                  strokeMiterlimit="22.9"
                  stroke-width="1.5"
                  d="M1 33v38M95 33v38M1 71a51 51 0 0 0 94 0M95 33a51 51 0 0 0-94 0"
                />
              </svg>,
              addCut5,
              "Cut Shape 5"
            )}
            {renderCutIcon(
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="85"
                height="84"
                fill="none"
              >
                <path
                  stroke="#FD7714"
                  stroke-linecap="round"
                  stroke-linejoin="bevel"
                  strokeMiterlimit="22.9"
                  stroke-width="1.5"
                  d="M39 3h7M39 3V1M46 3V1M39 1C19 3 3 18 2 38M84 38C82 18 66 3 46 1M46 83c20-2 36-17 38-37M2 46c1 20 17 35 37 37M4 46v-8M4 46H2M4 38H2M46 81h-7M46 81v2M39 81v2M81 38v8M81 38h3M81 46h3"
                />
              </svg>,
              addCut6,
              "Cut Shape 6"
            )}
            {renderCutIcon(
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="93"
                height="92"
                fill="none"
              >
                <path
                  stroke="#FD7714"
                  stroke-linecap="round"
                  stroke-linejoin="bevel"
                  strokeMiterlimit="22.9"
                  stroke-width="1.5"
                  d="M52 91a45 45 0 1 0-12 0"
                />
                <path
                  stroke="#FD7714"
                  stroke-linecap="round"
                  stroke-linejoin="bevel"
                  strokeMiterlimit="22.9"
                  stroke-width="1.5"
                  d="M52 91a6 6 0 0 0-12 0"
                />
              </svg>,
              addCut7,
              "Cut Shape 7"
            )}
            {renderCutIcon(
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="63"
                height="74"
                fill="none"
              >
                <path
                  stroke="#FD7714"
                  stroke-linecap="round"
                  stroke-linejoin="bevel"
                  strokeMiterlimit="22.9"
                  stroke-width="1.5"
                  d="M1 18v39M61 18v39M61 18a36 36 0 0 0-60 0M1 57a36 36 0 0 0 60 0"
                />
              </svg>,
              addCut8,
              "Cut Shape 8"
            )}

            {/* Ряд 3 */}
            {renderCutIcon(
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="62"
                height="62"
                fill="none"
              >
                <path
                  stroke="#FD7714"
                  stroke-linecap="round"
                  stroke-linejoin="bevel"
                  strokeMiterlimit="22.9"
                  stroke-width="1.5"
                  d="M25 60v-3M25 57h11M36 60v-3M36 60a30 30 0 1 0-11 0"
                />
              </svg>,
              addCut9,
              "Cut Shape 9"
            )}
            {renderCutIcon(
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="93"
                height="93"
                fill="none"
              >
                <path
                  stroke="#FD7714"
                  stroke-linecap="round"
                  stroke-linejoin="bevel"
                  strokeMiterlimit="22.9"
                  stroke-width="1.5"
                  d="m41 92 5-5M51 92l-5-5M51 92a45 45 0 1 0-10 0"
                />
              </svg>,
              addCut10,
              "Cut Shape 10"
            )}
            {renderCutIcon(
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="54"
                height="63"
                fill="none"
              >
                <path
                  stroke="#FD7714"
                  stroke-linecap="round"
                  stroke-linejoin="bevel"
                  strokeMiterlimit="22.9"
                  stroke-width="1.5"
                  d="M1 15v33M52 48V15M52 15a30 30 0 0 0-51 0M1 48a30 30 0 0 0 51 0"
                />
              </svg>,
              addCut11,
              "Cut Shape 11"
            )}
          </div>
        ) : (
          <div className={styles.shapeGrid}>
            {/* Round Top (replaces Parabola) */}
            {renderCutIcon(
              <svg
                width="70"
                height="70"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Adjusted strokeWidth (2.14) so visual thickness ~= 1.5px at 70px display width */}
                <path
                  d="M10 95 A40 90 0 0 1 90 95 L90 95 L10 95 Z"
                  fill="none"
                  stroke="#FD7714"
                  strokeWidth="2.14"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>,
              addShapeArch,
              "Arch"
            )}
            {/* Quarter circle (top-right) */}
            {renderCutIcon(
              <svg
                width="70"
                height="70"
                viewBox="0 0 70 70"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 9h52v52A52 52 0 0 1 9 9Z"
                  stroke="#FD7714"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="bevel"
                />
              </svg>,
              addShapeQuarterCircleTR,
              "Quarter Circle TR"
            )}
            {/* Hexagon */}
            {renderCutIcon(
              <svg
                width="70"
                height="70"
                viewBox="0 0 61 53"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* strokeWidth 1.30 => visual ~1.5px (1.30 * 70/61) */}
                <path
                  d="M59 27 45 51H16L2 27 16 2h29l14 25Z"
                  stroke="#FD7714"
                  strokeWidth="1.30"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>,
              addShapeHexagon,
              "Hexagon"
            )}
            {/* Octagon */}
            {renderCutIcon(
              <svg
                width="70"
                height="70"
                viewBox="0 0 56 56"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* strokeWidth 1.20 => visual ~1.5px (1.20 * 70/56) */}
                <path
                  d="M39 1L55 17V39L39 55H17L1 39V17L17 1H39Z"
                  stroke="#FD7714"
                  strokeWidth="1.20"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>,
              addShapeOctagon,
              "Octagon"
            )}
            {/* Right triangle */}
            {renderCutIcon(
              <svg
                width="70"
                height="70"
                viewBox="0 0 61 53"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* strokeWidth 1.30 => visual ~1.5px (1.30 * 70/61) */}
                <path
                  d="M2 51H59L2 2Z"
                  stroke="#FD7714"
                  strokeWidth="1.30"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>,
              addShapeRightTriangle,
              "Right Triangle"
            )}
            {/* Circle with cut (same as CUT tab 'Cut Shape 8') */}
            {renderCutIcon(
              <svg
                width="70"
                height="70"
                viewBox="0 0 63 74"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  stroke="#FD7714"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="bevel"
                  strokeMiterlimit="22.9"
                  d="M1 18v39M61 18v39M61 18a36 36 0 0 0-60 0M1 57a36 36 0 0 0 60 0"
                />
              </svg>,
              addShapeCircleWithCut,
              "Circle with Cut"
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CutSelector;

