import React, { useState } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import styles from "./CutSelector.module.css";

const CutSelector = ({ isOpen, onClose }) => {
    const { canvas } = useCanvasContext();

    if (!isOpen) return null;

    // Функції для додавання різних форм вирізів (тут ви додасте свою логіку)

    const addCut1 = () => {
        if (canvas) {
            // Коло з вирізом зверху
            const path = new fabric.Path("M43 1a45 45 0 1 0 8 0M43 5h8M51 5V1M43 5V1", {
                left: 100,
                top: 100,
                fill: "transparent",
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
            });
            canvas.add(path);
            canvas.setActiveObject(path);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut2 = () => {
        if (canvas) {
            // Напівкруглі вирізи з боків
            const path = new fabric.Path("M21 1h56M21 78h56M21 1a48 48 0 0 0 0 77M77 78a48 48 0 0 0 0-77", {
                left: 100,
                top: 100,
                fill: "transparent",
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
            });
            canvas.add(path);
            canvas.setActiveObject(path);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut3 = () => {
        if (canvas) {
            // Напівколо з прямою лінією внизу
            const path = new fabric.Path("M10.47 71.22h65.65M76.12 71.22a42.52 42.52 0 1 0-65.65 0", {
                left: 100,
                top: 100,
                fill: "transparent",
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
            });
            canvas.add(path);
            canvas.setActiveObject(path);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut4 = () => {
        if (canvas) {
            // Вертикальні напівкруглі вирізи
            const path = new fabric.Path("M2 26v37M78 26v37M78 26a43 43 0 0 0-76 0M2 63a43 43 0 0 0 76 0", {
                left: 100,
                top: 100,
                fill: "transparent",
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
            });
            canvas.add(path);
            canvas.setActiveObject(path);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut5 = () => {
        if (canvas) {
            // Великі вертикальні напівкруглі вирізи
            const path = new fabric.Path("M1 33v38M95 33v38M1 71a51 51 0 0 0 94 0M95 33a51 51 0 0 0-94 0", {
                left: 100,
                top: 100,
                fill: "transparent",
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
            });
            canvas.add(path);
            canvas.setActiveObject(path);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut6 = () => {
        if (canvas) {
            // Коло з хрестом
            const path = new fabric.Path("M39 3h7M39 3V1M46 3V1M39 1C19 3 3 18 2 38M84 38C82 18 66 3 46 1M46 83c20-2 36-17 38-37M2 46c1 20 17 35 37 37M4 46v-8M4 46H2M4 38H2M46 81h-7M46 81v2M39 81v2M81 38v8M81 38h3M81 46h3", {
                left: 100,
                top: 100,
                fill: "transparent",
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
            });
            canvas.add(path);
            canvas.setActiveObject(path);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut7 = () => {
        if (canvas) {
            // Коло з маленьким півколом знизу
            const path = new fabric.Path("M52 91a45 45 0 1 0-12 0M52 91a6 6 0 0 0-12 0", {
                left: 100,
                top: 100,
                fill: "transparent",
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
            });
            canvas.add(path);
            canvas.setActiveObject(path);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut8 = () => {
        if (canvas) {
            // Маленькі вертикальні напівкруглі вирізи
            const path = new fabric.Path("M1 18v39M61 18v39M61 18a36 36 0 0 0-60 0M1 57a36 36 0 0 0 60 0", {
                left: 100,
                top: 100,
                fill: "transparent",
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
            });
            canvas.add(path);
            canvas.setActiveObject(path);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut9 = () => {
        if (canvas) {
            // Коло з прямокутним вирізом знизу
            const path = new fabric.Path("M25 60v-3M25 57h11M36 60v-3M36 60a30 30 0 1 0-11 0", {
                left: 100,
                top: 100,
                fill: "transparent",
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
            });
            canvas.add(path);
            canvas.setActiveObject(path);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut10 = () => {
        if (canvas) {
            // Коло з трикутним вирізом знизу
            const path = new fabric.Path("m41 92 5-5M51 92l-5-5M51 92a45 45 0 1 0-10 0", {
                left: 100,
                top: 100,
                fill: "transparent",
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
            });
            canvas.add(path);
            canvas.setActiveObject(path);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut11 = () => {
        if (canvas) {
            // Компактні вертикальні напівкруглі вирізи
            const path = new fabric.Path("M1 15v33M52 48V15M52 15a30 30 0 0 0-51 0M1 48a30 30 0 0 0 51 0", {
                left: 100,
                top: 100,
                fill: "transparent",
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
            });
            canvas.add(path);
            canvas.setActiveObject(path);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut12 = () => {
        if (canvas) {
            // Просте коло
            const circle = new fabric.Circle({
                left: 100,
                top: 100,
                radius: 43,
                fill: "transparent",
                stroke: "#FD7714",
                strokeWidth: 1.5,
                selectable: true,
                hasControls: false,
                hasBorders: true,
                lockScalingX: true,
                lockScalingY: true,
                lockUniScaling: true,
            });
            canvas.add(circle);
            canvas.setActiveObject(circle);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut13 = () => {
        if (canvas) {
            // Маленьке коло
            const circle = new fabric.Circle({
                left: 100,
                top: 100,
                radius: 30,
                fill: "transparent",
                stroke: "#FD7714",
                strokeWidth: 1.5,
                selectable: true,
                hasControls: false,
                hasBorders: true,
                lockScalingX: true,
                lockScalingY: true,
                lockUniScaling: true,
            });
            canvas.add(circle);
            canvas.setActiveObject(circle);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut14 = () => {
        if (canvas) {
            // Середнє коло
            const circle = new fabric.Circle({
                left: 100,
                top: 100,
                radius: 35,
                fill: "transparent",
                stroke: "#FD7714",
                strokeWidth: 1.5,
                selectable: true,
                hasControls: false,
                hasBorders: true,
                lockScalingX: true,
                lockScalingY: true,
                lockUniScaling: true,
            });
            canvas.add(circle);
            canvas.setActiveObject(circle);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut15 = () => {
        if (canvas) {
            // Велике коло
            const circle = new fabric.Circle({
                left: 100,
                top: 100,
                radius: 48,
                fill: "transparent",
                stroke: "#FD7714",
                strokeWidth: 1.5,
                selectable: true,
                hasControls: false,
                hasBorders: true,
                lockScalingX: true,
                lockScalingY: true,
                lockUniScaling: true,
            });
            canvas.add(circle);
            canvas.setActiveObject(circle);
            canvas.renderAll();
            onClose();
        }
    };

    const addCut16 = () => {
        if (canvas) {
            // Дуже велике коло
            const circle = new fabric.Circle({
                left: 100,
                top: 100,
                radius: 56,
                fill: "transparent",
                stroke: "#FD7714",
                strokeWidth: 1.5,
                selectable: true,
                hasControls: false,
                hasBorders: true,
                lockScalingX: true,
                lockScalingY: true,
                lockUniScaling: true,
            });
            canvas.add(circle);
            canvas.setActiveObject(circle);
            canvas.renderAll();
            onClose();
        }
    };

    // Функція для рендерингу іконки
    const renderCutIcon = (svgIcon, onClick, title) => (
        <div className={styles.cutOption} onClick={onClick} title={title}>
            {svgIcon}
        </div>
    );

    return (
        <div className={styles.cutSelector}>
            <div className={styles.dropdown}>
                <div className={styles.dropdownHeader}>
                    <h3>Cut Shapes</h3>
                    <button className={styles.closeBtn} onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className={styles.cutGrid}>
                    {/* Ряд 1 */}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="94" height="93" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.9" stroke-width="1.5" d="M43 1a45 45 0 1 0 8 0M43 5h8M51 5V1M43 5V1" /></svg>
                        , addCut1, "Cut Shape 1")}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="98" height="79" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.9" stroke-width="1.5" d="M21 1h56M21 78h56M21 1a48 48 0 0 0 0 77M77 78a48 48 0 0 0 0-77" /></svg>
                        , addCut2, "Cut Shape 2")}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="87" height="72" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.93" stroke-width="1.5" d="M10.47 71.22h65.65M76.12 71.22a42.52 42.52 0 1 0-65.65 0"/></svg>
                        , addCut3, "Cut Shape 3")}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="79" height="88" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.9" stroke-width="1.5" d="M2 26v37M78 26v37M78 26a43 43 0 0 0-76 0M2 63a43 43 0 0 0 76 0" /></svg>
                        , addCut4, "Cut Shape 4")}

                    {/* Ряд 2 */}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="97" height="104" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.9" stroke-width="1.5" d="M1 33v38M95 33v38M1 71a51 51 0 0 0 94 0M95 33a51 51 0 0 0-94 0" /></svg>
                        , addCut5, "Cut Shape 5")}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="85" height="84" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.9" stroke-width="1.5" d="M39 3h7M39 3V1M46 3V1M39 1C19 3 3 18 2 38M84 38C82 18 66 3 46 1M46 83c20-2 36-17 38-37M2 46c1 20 17 35 37 37M4 46v-8M4 46H2M4 38H2M46 81h-7M46 81v2M39 81v2M81 38v8M81 38h3M81 46h3" /></svg>
                        , addCut6, "Cut Shape 6")}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="93" height="92" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.9" stroke-width="1.5" d="M52 91a45 45 0 1 0-12 0" /><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.9" stroke-width="1.5" d="M52 91a6 6 0 0 0-12 0" /></svg>
                        , addCut7, "Cut Shape 7")}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="63" height="74" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.9" stroke-width="1.5" d="M1 18v39M61 18v39M61 18a36 36 0 0 0-60 0M1 57a36 36 0 0 0 60 0" /></svg>
                        , addCut8, "Cut Shape 8")}

                    {/* Ряд 3 */}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="62" height="62" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.9" stroke-width="1.5" d="M25 60v-3M25 57h11M36 60v-3M36 60a30 30 0 1 0-11 0" /></svg>
                        , addCut9, "Cut Shape 9")}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="93" height="93" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.9" stroke-width="1.5" d="m41 92 5-5M51 92l-5-5M51 92a45 45 0 1 0-10 0" /></svg>
                        , addCut10, "Cut Shape 10")}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="54" height="63" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.9" stroke-width="1.5" d="M1 15v33M52 48V15M52 15a30 30 0 0 0-51 0M1 48a30 30 0 0 0 51 0" /></svg>
                        , addCut11, "Cut Shape 11")}
                    {renderCutIcon(<svg width="89" height="90" viewBox="0 0 87 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M85.9754 43.9736C85.9754 20.4906 66.939 1.45386 43.4561 1.45386C19.9731 1.45386 0.936413 20.4906 0.936035 43.9732C0.936035 67.4562 19.9728 86.4933 43.4557 86.4933C66.9387 86.4933 85.9754 67.4565 85.9754 43.9736Z" stroke="#FD7714" stroke-width="1.5" stroke-miterlimit="22.9256" stroke-linecap="round" stroke-linejoin="bevel" />
                    </svg>, addCut12, "Cut Shape 12")}

                    {/* Ряд 4 */}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="63" height="63" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.9" stroke-width="1.5" d="M62 31a30 30 0 1 0-61 0 30 30 0 0 0 61 0v0Z" clip-rule="evenodd"/></svg>
                        , addCut13, "Cut Shape 13")}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="75" height="74" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.93" stroke-width="1.5" d="M73.34 36.8a35.9 35.9 0 1 0-71.81 0 35.9 35.9 0 0 0 71.8 0v0Z" clip-rule="evenodd"/></svg>
                        , addCut14, "Cut Shape 14")}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="99" height="99" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.93" stroke-width="1.5" d="M97.86 49.33a48.19 48.19 0 1 0-96.38 0 48.19 48.19 0 0 0 96.38 0Z" clip-rule="evenodd"/></svg>
                        , addCut15, "Cut Shape 15")}
                    {renderCutIcon(<svg xmlns="http://www.w3.org/2000/svg" width="116" height="116" fill="none"><path stroke="#FD7714" stroke-linecap="round" stroke-linejoin="bevel" stroke-miterlimit="22.93" stroke-width="1.5" d="M114.73 58.08a56.7 56.7 0 1 0-113.38 0 56.7 56.7 0 0 0 113.38 0v0Z" clip-rule="evenodd"/></svg>
                        , addCut16, "Cut Shape 16")}
                </div>
            </div>
        </div>
    );
};

export default CutSelector;
