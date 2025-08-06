import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import paper from "paper";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import * as XLSX from "xlsx";
import UndoRedo from "../UndoRedo/UndoRedo"; // Імпорт компонента
import QRCodeGenerator from "../QRCodeGenerator/QRCodeGenerator";
import BarCodeGenerator from "../BarCodeGenerator/BarCodeGenerator";
import ShapeSelector from "../ShapeSelector/ShapeSelector";
import CutSelector from "../CutSelector/CutSelector";
import IconMenu from "../IconMenu/IconMenu";
import ShapeProperties from "../ShapeProperties/ShapeProperties";
import styles from "./Toolbar.module.css";
import {
  Icon0,
  Icon1,
  Icon2,
  Icon3,
  Icon4,
  Icon5,
  Icon6,
  Icon7,
  Icon8,
  Icon9,
  Icon10,
  Icon11,
  Icon12,
  Icon13,
  Icon14,
  A1,
  A2,
  A3,
  A4,
  A5,
  A6,
  A7,
  A8,
  A9,
  A10,
  A11,
  A12,
  A13,
  A14,
  Image,
  Upload,
  Shape,
  Border,
  Cut,
  QrCode,
  BarCode,
  Hole1,
  Hole2,
  Hole3,
  Hole4,
  Hole5,
  Hole6,
  Hole7,
} from "../../assets/Icons";

const Toolbar = () => {
  const { canvas, globalColors, updateGlobalColors } = useCanvasContext();
  const [activeObject, setActiveObject] = useState(null);
  const [sizeValues, setSizeValues] = useState({
    width: 150,
    height: 150,
    cornerRadius: 2,
  });
  const [currentShapeType, setCurrentShapeType] = useState(null); // Тип поточної фігури
  const [thickness, setThickness] = useState(1.6);
  const [isAdhesiveTape, setIsAdhesiveTape] = useState(false);
  const fileInputRef = useRef(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isBarCodeOpen, setIsBarCodeOpen] = useState(false);
  const [isShapeOpen, setIsShapeOpen] = useState(false);
  const [isCutOpen, setIsCutOpen] = useState(false);
  const [isIconMenuOpen, setIsIconMenuOpen] = useState(false);
  const [isShapePropertiesOpen, setIsShapePropertiesOpen] = useState(false);
  const [copiesCount, setCopiesCount] = useState(1);
  const [holesDiameter, setHolesDiameter] = useState(3);

  const addQrCode = () => {
    setIsQrOpen(true);
  };

  const addBarCode = () => {
    setIsBarCodeOpen(true);
  };

  const addShape = () => {
    setIsShapeOpen(true);
  };

  const openIconMenu = () => {
    setIsIconMenuOpen(true);
  };

  // Оновлення активного об'єкта та розмірів при зміні
  useEffect(() => {
    if (canvas) {
      canvas.on("selection:created", () => {
        const obj = canvas.getActiveObject();
        setActiveObject(obj);
        if (obj) {
          setSizeValues({
            width: Math.round(obj.width * obj.scaleX),
            height: Math.round(obj.height * obj.scaleY),
            cornerRadius: obj.rx || 0,
          });
        }
      });
      canvas.on("selection:updated", () => {
        const obj = canvas.getActiveObject();
        setActiveObject(obj);
        if (obj) {
          setSizeValues({
            width: Math.round(obj.width * obj.scaleX),
            height: Math.round(obj.height * obj.scaleY),
            cornerRadius: obj.rx || 0,
          });
        }
      });
      canvas.on("selection:cleared", () => {
        setActiveObject(null);
        // Коли нічого не вибрано, показуємо розміри canvas
        setSizeValues({ 
          width: canvas.getWidth(), 
          height: canvas.getHeight(), 
          cornerRadius: 0 
        });
      });
      canvas.on("object:modified", () => {
        const obj = canvas.getActiveObject();
        if (obj && !obj.isCutElement) { // Ігноруємо cut елементи
          setSizeValues({
            width: Math.round(obj.width * obj.scaleX),
            height: Math.round(obj.height * obj.scaleY),
            cornerRadius: obj.rx || 0,
          });
        }
      });
      
      // Ініціалізуємо початкові значення розмірів canvas
      setSizeValues({ 
        width: canvas.getWidth(), 
        height: canvas.getHeight(), 
        cornerRadius: 0 
      });
    }
    return () => {
      if (canvas) {
        canvas.off("selection:created");
        canvas.off("selection:updated");
        canvas.off("selection:cleared");
        canvas.off("object:modified");
      }
    };
  }, [canvas]);

  // Оновлення розмірів активного об'єкта або canvas
  const updateSize = () => {
    if (activeObject) {
      // Якщо вибрано об'єкт - змінюємо його розміри
      activeObject.set({
        width: sizeValues.width,
        height: sizeValues.height,
        rx: sizeValues.cornerRadius,
        ry: sizeValues.cornerRadius,
      });
      activeObject.scaleToWidth(sizeValues.width);
      activeObject.scaleToHeight(sizeValues.height);
      canvas.renderAll();
    } else if (canvas && currentShapeType) {
      // Змінюємо розміри canvas і оновлюємо clipPath
      const width = sizeValues.width;
      const height = sizeValues.height;
      
      // Встановлюємо нові розміри canvas
      canvas.setDimensions({ width, height });
      
      // Створюємо новий clipPath з новими розмірами
      let newClipPath = null;
      
      switch (currentShapeType) {
        case 'rectangle':
          newClipPath = new fabric.Rect({
            left: 0,
            top: 0,
            width: width,
            height: height,
            absolutePositioned: true,
          });
          break;
          
        case 'circle':
        case 'circleWithLine':
        case 'circleWithCross':
          const radius = Math.min(width, height) / 2;
          newClipPath = new fabric.Circle({
            left: width / 2,
            top: height / 2,
            radius: radius,
            originX: 'center',
            originY: 'center',
            absolutePositioned: true,
          });
          break;
          
        case 'ellipse':
          newClipPath = new fabric.Ellipse({
            left: width / 2,
            top: height / 2,
            rx: width / 2,
            ry: height / 2,
            originX: 'center',
            originY: 'center',
            absolutePositioned: true,
          });
          break;
          
        case 'lock':
          const lockScale = Math.min(width / 120, height / 108);
          newClipPath = new fabric.Path(
            `M96 42C96 21.9771 81.8823 6 60 6C38.1177 6 24 21.9771 24 42
             M27.6 36H6V102H114V36H92.4
             M60 24C69.9411 24 78 32.0589 78 42C78 51.9411 69.9411 60 60 60C50.0589 60 42 51.9411 42 42C42 32.0589 50.0589 24 60 24Z`,
            {
              left: (width - 120 * lockScale) / 2,
              top: (height - 108 * lockScale) / 2,
              absolutePositioned: true,
              scaleX: lockScale,
              scaleY: lockScale,
            }
          );
          break;
          
        case 'house':
          const houseScale = Math.min(width / 96, height / 105);
          newClipPath = new fabric.Path("M6 66V105H51H90V66L48 6L6 66Z", {
            left: (width - 96 * houseScale) / 2,
            top: (height - 105 * houseScale) / 2,
            absolutePositioned: true,
            scaleX: houseScale,
            scaleY: houseScale,
          });
          break;
          
        case 'halfCircle':
          const halfCircleScale = Math.min(width / 120, height / 60);
          newClipPath = new fabric.Path('M6 60 A54 60 0 0 1 114 60 L6 60Z', {
            left: (width - 120 * halfCircleScale) / 2,
            top: (height - 60 * halfCircleScale) / 2,
            absolutePositioned: true,
            scaleX: halfCircleScale,
            scaleY: halfCircleScale,
          });
          break;
          
        case 'arc':
          const arcScale = Math.min(width / 120, height / 84);
          newClipPath = new fabric.Path(
            'M6 54C6 65.7156 6 84 6 84H63.8574H114V54 M114 57.6129C114 27.2075 94.0836 6 59.99994 6C25.9161 6 6 28.928 6 59.3333',
            {
              left: (width - 120 * arcScale) / 2,
              top: (height - 84 * arcScale) / 2,
              absolutePositioned: true,
              scaleX: arcScale,
              scaleY: arcScale,
            }
          );
          break;
          
        case 'hexagon':
          const hexagonScale = Math.min(width / 127, height / 114);
          newClipPath = new fabric.Path(
            'M119.6862 57.15072L91.7166 105.5958L35.77014 105.5952L7.80156 57.14748L35.77128 8.70252L91.7154 8.69502L119.6862 57.15072Z',
            {
              left: (width - 127 * hexagonScale) / 2,
              top: (height - 114 * hexagonScale) / 2,
              absolutePositioned: true,
              scaleX: hexagonScale,
              scaleY: hexagonScale,
            }
          );
          break;
          
        case 'octagon':
          newClipPath = new fabric.Path(
            `M${width * 0.3} 0L${width * 0.7} 0L${width} ${height * 0.3}L${width} ${height * 0.7}L${width * 0.7} ${height}L${width * 0.3} ${height}L0 ${height * 0.7}L0 ${height * 0.3}Z`,
            { absolutePositioned: true }
          );
          break;
          
        case 'triangle':
          newClipPath = new fabric.Path(
            `M${width / 2} 0L${width} ${height}L0 ${height}Z`,
            { absolutePositioned: true }
          );
          break;
          
        case 'arrowLeft':
          newClipPath = new fabric.Path(
            `M0 ${height * 0.5625}L${width * 0.25} ${height * 0.1875}L${width * 0.25} ${height * 0.375}L${width} ${height * 0.375}L${width} ${height * 0.75}L${width * 0.25} ${height * 0.75}L${width * 0.25} ${height * 0.9375}Z`,
            { absolutePositioned: true }
          );
          break;
          
        case 'arrowRight':
          newClipPath = new fabric.Path(
            `M${width} ${height * 0.5625}L${width * 0.75} ${height * 0.1875}L${width * 0.75} ${height * 0.375}L0 ${height * 0.375}L0 ${height * 0.75}L${width * 0.75} ${height * 0.75}L${width * 0.75} ${height * 0.9375}Z`,
            { absolutePositioned: true }
          );
          break;
          
        case 'flag':
          newClipPath = new fabric.Path(
            `M0 ${height * 0.4}L0 ${height * 0.8}L${width * 0.25} ${height * 0.7}L${width * 0.5} ${height * 0.85}L${width * 0.733} ${height * 0.7}L${width * 0.733} ${height * 0.4}L${width * 0.5} ${height * 0.35}L${width * 0.292} 0L0 ${height * 0.4}Z`,
            { absolutePositioned: true }
          );
          break;
          
        case 'diamond':
          newClipPath = new fabric.Path(
            `M${width * 0.5} 0L${width} ${height * 0.5}L${width * 0.5} ${height}L0 ${height * 0.5}Z`,
            { absolutePositioned: true }
          );
          break;
          
        default:
          break;
      }
      
      // Встановлюємо новий clipPath
      if (newClipPath) {
        canvas.clipPath = newClipPath;
      }
      
      // Оновлюємо візуальний контур і обводки
      updateCanvasOutline();
      updateExistingBorders();
      canvas.renderAll();
    } else if (canvas) {
      // Якщо нічого не вибрано і немає фігури - просто змінюємо розміри canvas
      canvas.setDimensions({
        width: sizeValues.width,
        height: sizeValues.height
      });
      updateCanvasOutline();
      canvas.renderAll();
    }
  };

  // Функція для оновлення візуального контуру canvas
  const updateCanvasOutline = () => {
    if (!canvas) return;
    
    // Видаляємо попередній контур
    const existingOutline = canvas.getObjects().find(obj => obj.isCanvasOutline);
    if (existingOutline) {
      canvas.remove(existingOutline);
    }
    
    // Перевіряємо чи є користувацькі обводки
    const hasBorder = canvas.getObjects().some(obj => obj.isBorderShape);
    
    // Додаємо контур тільки якщо немає користувацьких обводок
    if (!hasBorder && canvas.clipPath) {
      let outlineShape;
      const clipPathData = canvas.clipPath.toObject();
      
      if (canvas.clipPath.type === 'rect') {
        outlineShape = new fabric.Rect(clipPathData);
      } else if (canvas.clipPath.type === 'circle') {
        outlineShape = new fabric.Circle(clipPathData);
      } else if (canvas.clipPath.type === 'ellipse') {
        outlineShape = new fabric.Ellipse(clipPathData);
      } else if (canvas.clipPath.type === 'path') {
        outlineShape = new fabric.Path(canvas.clipPath.path, clipPathData);
      }
      
      if (outlineShape) {
        outlineShape.set({
          fill: "transparent",
          stroke: "#cccccc",
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          excludeFromExport: true,
          isCanvasOutline: true,
        });
        
        canvas.add(outlineShape);
        // Переміщуємо контур на задній план
        canvas.sendObjectToBack(outlineShape);
      }
    }
  };

  // Функція для оновлення існуючих обводок при зміні розмірів
  const updateExistingBorders = () => {
    if (!canvas || !canvas.clipPath) return;
    
    const borderShapes = canvas.getObjects().filter(obj => obj.isBorderShape);
    
    borderShapes.forEach(borderShape => {
      const clipPathData = canvas.clipPath.toObject();
      
      if (canvas.clipPath.type === 'rect' && borderShape.type === 'rect') {
        borderShape.set({
          width: clipPathData.width,
          height: clipPathData.height,
          rx: sizeValues.cornerRadius,
          ry: sizeValues.cornerRadius,
        });
      } else if (canvas.clipPath.type === 'circle' && borderShape.type === 'circle') {
        borderShape.set(clipPathData);
      } else if (canvas.clipPath.type === 'ellipse' && borderShape.type === 'ellipse') {
        borderShape.set(clipPathData);
      } else if (canvas.clipPath.type === 'path' && borderShape.type === 'path') {
        borderShape.set({ path: canvas.clipPath.path });
      }
    });
  };

  // Оновлення товщини обводки
  const updateThickness = (value) => {
    if (activeObject) {
      activeObject.set({ strokeWidth: value });
      if (isAdhesiveTape) {
        activeObject.set({ stroke: "#888" });
      }
      canvas.renderAll();
    }
  };

  // Зміна кольору
  const updateColor = (color) => {
    if (activeObject) {
      activeObject.set({ fill: color });
      canvas.renderAll();
    }
  };

  // Функція для регенерації QR коду з новими кольорами
  const regenerateQRCode = async (qrObj, text, foregroundColor, backgroundColor) => {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(text, {
        width: 200,
        height: 200,
        color: {
          dark: foregroundColor,
          light: backgroundColor,
        },
      });

      const newImg = await fabric.FabricImage.fromURL(qrCodeDataURL);
      
      // Зберігаємо властивості оригінального об'єкта
      newImg.set({
        left: qrObj.left,
        top: qrObj.top,
        scaleX: qrObj.scaleX,
        scaleY: qrObj.scaleY,
        angle: qrObj.angle,
        isQRCode: true,
        qrText: text,
        selectable: true,
        hasControls: true,
        hasBorders: true,
      });

      // Замінюємо старий об'єкт новим
      const index = canvas.getObjects().indexOf(qrObj);
      if (index !== -1) {
        canvas.remove(qrObj);
        canvas.insertAt(newImg, index);
      }
    } catch (error) {
      console.error('Помилка регенерації QR коду:', error);
    }
  };

  // Функція для регенерації Bar коду з новими кольорами
  const regenerateBarCode = async (barObj, text, foregroundColor, backgroundColor) => {
    try {
      const canvas2D = document.createElement('canvas');
      const codeType = barObj.barCodeType || "CODE128"; // Використовуємо збережений тип коду
      
      JsBarcode(canvas2D, text, {
        format: codeType,
        width: 2,
        height: 100,
        displayValue: true,
        background: backgroundColor,
        lineColor: foregroundColor,
      });

      const barCodeDataURL = canvas2D.toDataURL();
      const newImg = await fabric.FabricImage.fromURL(barCodeDataURL);
      
      // Зберігаємо властивості оригінального об'єкта
      newImg.set({
        left: barObj.left,
        top: barObj.top,
        scaleX: barObj.scaleX,
        scaleY: barObj.scaleY,
        angle: barObj.angle,
        isBarCode: true,
        barCodeText: text,
        barCodeType: codeType,
        selectable: true,
        hasControls: true,
        hasBorders: true,
      });

      // Замінюємо старий об'єкт новим
      const index = canvas.getObjects().indexOf(barObj);
      if (index !== -1) {
        canvas.remove(barObj);
        canvas.insertAt(newImg, index);
      }
    } catch (error) {
      console.error('Помилка регенерації Bar коду:', error);
    }
  };

  // Оновлена функція для зміни кольору всіх текстів та фону canvas
  const updateColorScheme = (
    textColor,
    backgroundColor,
    backgroundType = "solid"
  ) => {
    if (!canvas) return;

    // Оновлюємо глобальні кольори
    updateGlobalColors({
      textColor,
      backgroundColor,
      strokeColor: textColor,
      fillColor: textColor === '#FFFFFF' ? backgroundColor : 'transparent',
      backgroundType
    });

    // Змінюємо колір всіх об'єктів на canvas (крім Cut елементів)
    const objects = canvas.getObjects();
    
    objects.forEach(obj => {
      // Пропускаємо об'єкти, які позначені як Cut елементи
      if (obj.isCutElement) return;

      if (obj.type === 'i-text' || obj.type === 'text') {
        obj.set({ fill: textColor });
      } else if (obj.type === 'rect' || obj.type === 'circle' || obj.type === 'ellipse' || 
                 obj.type === 'triangle' || obj.type === 'polygon' || obj.type === 'path') {
        // Для фігур встановлюємо stroke колір та прозору заливку або колір тексту
        obj.set({ 
          stroke: textColor,
          fill: obj.fill === 'transparent' || obj.fill === '' ? 'transparent' : textColor
        });
      } else if (obj.type === 'line') {
        obj.set({ stroke: textColor });
      }
      // QR та Bar коди залишаємо без змін - вони будуть використовувати нові кольори при створенні
    });

    // Встановлюємо фон canvas
    if (backgroundType === "solid") {
      canvas.set("backgroundColor", backgroundColor);
    } else if (backgroundType === "gradient") {
      // Місце для градієнта - буде реалізовано пізніше
      console.log("Gradient background will be implemented here");
      canvas.set("backgroundColor", backgroundColor); // Тимчасово використовуємо solid color
    } else if (backgroundType === "texture") {
      // Місце для текстури - буде реалізовано пізніше
      console.log("Texture background will be implemented here");
      canvas.set("backgroundColor", backgroundColor); // Тимчасово використовуємо solid color
    }

    // Рендеримо canvas
    canvas.renderAll();
  };

  // Додавання тексту
  const addText = () => {
    if (canvas) {
      const text = new fabric.IText("Текст", {
        left: canvas.width / 2,
        top: canvas.height / 2,
        originX: 'center',
        originY: 'center',
        fontFamily: "Arial",
        fill: globalColors.textColor,
        fontSize: 20,
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.renderAll();
    }
  };

  // Додавання зображення через IconMenu
  const addImage = () => {
    setIsIconMenuOpen(true);
  };

  // Додавання зображення через файловий діалог (для Upload кнопки)
  const addUploadImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Покращена функція завантаження зображень
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file && canvas) {
      // Перевіряємо тип файлу
      if (!file.type.startsWith("image/")) {
        alert("Будь ласка, виберіть файл зображення");
        return;
      }

      // Перевіряємо розмір файлу (максимум 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Файл занадто великий. Максимальний розмір: 5MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          // Перевіряємо чи це SVG файл
          if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith('.svg')) {
            // Обробляємо SVG файл з застосуванням кольорів
            let svgText = event.target.result;
            
            // Застосовуємо поточні кольори до SVG
            if (globalColors.strokeColor && globalColors.strokeColor !== 'transparent') {
              svgText = svgText
                .replace(/fill="[^"]*"/g, `fill="${globalColors.strokeColor}"`)
                .replace(/stroke="[^"]*"/g, `stroke="${globalColors.strokeColor}"`);
              
              // Додаємо стилі до SVG, якщо їх немає
              if (!svgText.includes('fill=') && !svgText.includes('style=')) {
                svgText = svgText.replace(
                  /<svg([^>]*)>/,
                  `<svg$1 fill="${globalColors.strokeColor}">`
                );
              }
            }
            
            try {
              // Спробуємо завантажити як SVG об'єкт
              const result = await fabric.loadSVGFromString(svgText);
              let svgObject;
              if (result.objects.length === 1) {
                svgObject = result.objects[0];
              } else {
                svgObject = fabric.util.groupSVGElements(result.objects, result.options);
              }
              
              // Застосовуємо кольори до SVG об'єктів
              const applyColorsToObject = (obj) => {
                if (obj.type === 'group') {
                  obj.forEachObject(applyColorsToObject);
                } else {
                  if (globalColors.strokeColor && globalColors.strokeColor !== 'transparent') {
                    obj.set({
                      fill: globalColors.strokeColor,
                      stroke: globalColors.strokeColor
                    });
                  }
                }
              };
              
              applyColorsToObject(svgObject);
              
              // Масштабуємо SVG, якщо воно занадто велике
              const bounds = svgObject.getBoundingRect ? svgObject.getBoundingRect() : { width: 100, height: 100 };
              const maxWidth = 300;
              const maxHeight = 300;
              
              if (bounds.width > maxWidth || bounds.height > maxHeight) {
                const scale = Math.min(maxWidth / bounds.width, maxHeight / bounds.height);
                svgObject.scale(scale);
              }
              
              svgObject.set({
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: 'center',
                originY: 'center',
                selectable: true,
                hasControls: true,
                hasBorders: true,
              });

              canvas.add(svgObject);
              canvas.setActiveObject(svgObject);
              canvas.renderAll();
            } catch (svgError) {
              console.warn("Не вдалося завантажити як SVG, спробуємо як зображення:", svgError);
              // Якщо не вдалося завантажити як SVG, завантажуємо як звичайне зображення
              const img = await fabric.FabricImage.fromURL(event.target.result, {
                crossOrigin: "anonymous",
              });
              
              const maxWidth = 300;
              const maxHeight = 300;

              if (img.width > maxWidth || img.height > maxHeight) {
                const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
                img.scale(scale);
              }

              img.set({
                left: canvas.width / 2,
                top: canvas.height / 2,
                originX: 'center',
                originY: 'center',
                selectable: true,
                hasControls: true,
                hasBorders: true,
              });

              canvas.add(img);
              canvas.setActiveObject(img);
              canvas.renderAll();
            }
          } else {
            // Обробляємо звичайні растрові зображення
            const img = await fabric.FabricImage.fromURL(event.target.result, {
              crossOrigin: "anonymous",
            });

            // Масштабуємо зображення, якщо воно занадто велике
            const maxWidth = 300;
            const maxHeight = 300;

            if (img.width > maxWidth || img.height > maxHeight) {
              const scale = Math.min(
                maxWidth / img.width,
                maxHeight / img.height
              );
              img.scale(scale);
            }

            img.set({
              left: canvas.width / 2,
              top: canvas.height / 2,
              originX: 'center',
              originY: 'center',
              selectable: true,
              hasControls: true,
              hasBorders: true,
            });

            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
          }
        } catch (error) {
          console.error("Помилка завантаження зображення:", error);
          alert("Помилка завантаження зображення");
        }
      };
      reader.onerror = () => {
        alert("Помилка завантаження файлу");
      };
      reader.readAsDataURL(file);
    }

    // Очищаємо input після завантаження
    e.target.value = "";
  };

  // Додавання рамки (border) - додає обводку до форми canvas
  const addBorder = () => {
    if (canvas && canvas.clipPath) {
      // Видаляємо візуальний контур canvas
      const existingOutline = canvas.getObjects().find(obj => obj.isCanvasOutline);
      if (existingOutline) {
        canvas.remove(existingOutline);
      }
      
      // Створюємо копію clipPath для використання як обводки
      const clipPathData = canvas.clipPath.toObject();
      
      // Створюємо новий об'єкт на основі типу clipPath
      let borderShape;
      
      if (canvas.clipPath.type === 'rect') {
        borderShape = new fabric.Rect(clipPathData);
      } else if (canvas.clipPath.type === 'circle') {
        borderShape = new fabric.Circle(clipPathData);
      } else if (canvas.clipPath.type === 'ellipse') {
        borderShape = new fabric.Ellipse(clipPathData);
      } else if (canvas.clipPath.type === 'path') {
        borderShape = new fabric.Path(canvas.clipPath.path, clipPathData);
      } else {
        // Для інших типів створюємо path
        borderShape = new fabric.Path(canvas.clipPath.path || '', clipPathData);
      }
      
      // Налаштовуємо як обводку
      borderShape.set({
        fill: "transparent",
        stroke: "black",
        strokeWidth: 4,
        selectable: false,
        evented: false,
        excludeFromExport: false,
        isBorderShape: true, // Позначаємо як користувацьку обводку
      });
      
      // Додаємо обводку на canvas
      canvas.add(borderShape);
      canvas.renderAll();
    } else if (canvas) {
      // Якщо немає clipPath, додаємо звичайний прямокутник як раніше
      const rect = new fabric.Rect({
        left: canvas.width / 2,
        top: canvas.height / 2,
        originX: 'center',
        originY: 'center',
        width: 200,
        height: 150,
        fill: "transparent",
        stroke: globalColors.strokeColor,
        strokeWidth: 2,
      });
      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.renderAll();
    }
  };

  // Cut (відкриття селектора форм вирізів)
  const cut = () => {
    setIsCutOpen(true);
  };

  // Функції для різних типів отворів

  // Тип 1 - без отворів (по дефолту)
  const addHoleType1 = () => {
    // Нічого не робимо - це тип без отворів
    console.log("Тип 1: без отворів");
  };

  // Тип 2 - отвір по центру ширини і зверху по висоті (відступ 15px)
  const addHoleType2 = () => {
    if (canvas) {
      const canvasWidth = canvas.getWidth();
      const hole = new fabric.Circle({
        left: canvasWidth / 2,
        top: 15,
        radius: 8,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });
      canvas.add(hole);
      canvas.setActiveObject(hole);
      canvas.renderAll();
    }
  };

  // Тип 3 - два отвори по середині висоти, по бокам ширини (відступ 15px)
  const addHoleType3 = () => {
    if (canvas) {
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      // Лівий отвір
      const leftHole = new fabric.Circle({
        left: 15,
        top: canvasHeight / 2,
        radius: 8,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });

      // Правий отвір
      const rightHole = new fabric.Circle({
        left: canvasWidth - 15,
        top: canvasHeight / 2,
        radius: 8,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });

      canvas.add(leftHole);
      canvas.add(rightHole);
      canvas.setActiveObject(leftHole);
      canvas.renderAll();
    }
  };

  // Тип 4 - 4 отвори по кутам (відступ 15px)
  const addHoleType4 = () => {
    if (canvas) {
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      // Верхній лівий
      const topLeft = new fabric.Circle({
        left: 15,
        top: 15,
        radius: 8,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });

      // Верхній правий
      const topRight = new fabric.Circle({
        left: canvasWidth - 15,
        top: 15,
        radius: 8,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });

      // Нижній лівий
      const bottomLeft = new fabric.Circle({
        left: 15,
        top: canvasHeight - 15,
        radius: 8,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });

      // Нижній правий
      const bottomRight = new fabric.Circle({
        left: canvasWidth - 15,
        top: canvasHeight - 15,
        radius: 8,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });

      canvas.add(topLeft);
      canvas.add(topRight);
      canvas.add(bottomLeft);
      canvas.add(bottomRight);
      canvas.setActiveObject(topLeft);
      canvas.renderAll();
    }
  };

  // Тип 5 - 4 прямокутні отвори по кутам (відступ 15px)
  const addHoleType5 = () => {
    if (canvas) {
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      // Верхній лівий
      const topLeft = new fabric.Rect({
        left: 15,
        top: 15,
        width: 12,
        height: 12,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });

      // Верхній правий
      const topRight = new fabric.Rect({
        left: canvasWidth - 15,
        top: 15,
        width: 12,
        height: 12,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });

      // Нижній лівий
      const bottomLeft = new fabric.Rect({
        left: 15,
        top: canvasHeight - 15,
        width: 12,
        height: 12,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });

      // Нижній правий
      const bottomRight = new fabric.Rect({
        left: canvasWidth - 15,
        top: canvasHeight - 15,
        width: 12,
        height: 12,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });

      canvas.add(topLeft);
      canvas.add(topRight);
      canvas.add(bottomLeft);
      canvas.add(bottomRight);
      canvas.setActiveObject(topLeft);
      canvas.renderAll();
    }
  };

  // Тип 6 - отвір по середині висоти і лівого краю ширини
  const addHoleType6 = () => {
    if (canvas) {
      const canvasHeight = canvas.getHeight();

      const leftHole = new fabric.Circle({
        left: 15,
        top: canvasHeight / 2,
        radius: 8,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });

      canvas.add(leftHole);
      canvas.setActiveObject(leftHole);
      canvas.renderAll();
    }
  };

  // Тип 7 - отвір по середині висоти і правого краю ширини
  const addHoleType7 = () => {
    if (canvas) {
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      const rightHole = new fabric.Circle({
        left: canvasWidth - 15,
        top: canvasHeight / 2,
        radius: 8,
        fill: "#FFA500", // Оранжева заливка для Cut елементів
        stroke: "#FF6600", // Темніший оранжевий для обводки
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        isCutElement: true, // Позначаємо як Cut елемент
        cutType: 'hole', // Додаємо тип cut елементу
        hasControls: false, // Забороняємо зміну розміру
        hasBorders: true,
        lockScalingX: true,
        lockScalingY: true,
        lockUniScaling: true,
      });

      canvas.add(rightHole);
      canvas.setActiveObject(rightHole);
      canvas.renderAll();
    }
  };

  // Експорт шаблону в Excel
  const exportToExcel = () => {
    if (!canvas) {
      alert("Canvas не ініціалізований");
      return;
    }

    try {
      // Збираємо дані про всі об'єкти на canvas
      const canvasData = {
        width: canvas.getWidth(),
        height: canvas.getHeight(),
        backgroundColor:
          canvas.backgroundColor || canvas.get("backgroundColor") || "#ffffff",
        objects: [],
      };

      // Проходимо по всіх об'єктах canvas
      canvas.getObjects().forEach((obj, index) => {
        const objData = {
          id: index,
          type: obj.type,
          left: obj.left || 0,
          top: obj.top || 0,
          width: obj.width || (obj.radius ? obj.radius * 2 : 0),
          height: obj.height || (obj.radius ? obj.radius * 2 : 0),
          scaleX: obj.scaleX || 1,
          scaleY: obj.scaleY || 1,
          angle: obj.angle || 0,
          fill: obj.fill || "#000000",
          stroke: obj.stroke || null,
          strokeWidth: obj.strokeWidth || 0,
          opacity: obj.opacity !== undefined ? obj.opacity : 1,
          visible: obj.visible !== undefined ? obj.visible : true,
          originX: obj.originX || "left",
          originY: obj.originY || "top",
        };

        // Додаткові властивості для тексту
        if (obj.type === "i-text" || obj.type === "text") {
          objData.text = obj.text || "";
          objData.fontSize = obj.fontSize || 20;
          objData.fontFamily = obj.fontFamily || "Arial";
          objData.fontWeight = obj.fontWeight || "normal";
          objData.fontStyle = obj.fontStyle || "normal";
          objData.textAlign = obj.textAlign || "left";
        }

        // Додаткові властивості для зображень
        if (obj.type === "image") {
          try {
            objData.src = obj.getSrc ? obj.getSrc() : obj.src;
          } catch (e) {
            console.warn("Не вдалося отримати src зображення:", e);
            objData.src = "";
          }
        }

        // Додаткові властивості для кругів
        if (obj.type === "circle") {
          objData.radius = obj.radius || 50;
        }

        // Додаткові властивості для полігонів
        if (obj.type === "polygon") {
          objData.points = obj.points || [];
        }

        // Додаткові властивості для path (включаючи halfCircle)
        if (obj.type === "path") {
          objData.path = obj.path || "";
        }

        canvasData.objects.push(objData);
      });

      console.log("Exporting data:", canvasData); // Для діагностики

      // Створюємо Excel файл
      const worksheet = XLSX.utils.json_to_sheet([
        { property: "Canvas Width", value: canvasData.width },
        { property: "Canvas Height", value: canvasData.height },
        { property: "Background Color", value: canvasData.backgroundColor },
        { property: "Objects Count", value: canvasData.objects.length },
        { property: "", value: "" }, // Порожній рядок
        { property: "=== OBJECTS DATA ===", value: "" },
        ...canvasData.objects.map((obj, index) => ({
          property: `Object ${index + 1}`,
          value: JSON.stringify(obj),
        })),
      ]);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Canvas Template");

      // Завантажуємо файл
      const fileName = `canvas-template-${Date.now()}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      alert(
        `Шаблон успішно експортовано! Збережено об'єктів: ${canvasData.objects.length}`
      );
    } catch (error) {
      console.error("Помилка експорту:", error);
      alert(`Помилка при експорті шаблону: ${error.message}`);
    }
  };

  // Імпорт шаблону з Excel
  const importFromExcel = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          // Читаємо перший лист
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          console.log("Imported data:", jsonData); // Для діагностики

          if (!jsonData || jsonData.length === 0) {
            throw new Error("Файл не містить даних");
          }

          // Очищуємо canvas
          if (canvas) {
            canvas.clear();
          }

          // Знаходимо параметри canvas (з більш гнучким пошуком)
          let canvasWidth = 800;
          let canvasHeight = 600;
          let backgroundColor = "#ffffff";

          // Шукаємо параметри canvas
          jsonData.forEach((row) => {
            if (row.property === "Canvas Width" && row.value) {
              canvasWidth = Number(row.value) || 800;
            }
            if (row.property === "Canvas Height" && row.value) {
              canvasHeight = Number(row.value) || 600;
            }
            if (row.property === "Background Color" && row.value) {
              backgroundColor = row.value || "#ffffff";
            }
          });

          // Встановлюємо розміри canvas
          if (canvas) {
            canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
            // Використовуємо правильний метод для fabric.js v6+
            canvas.set("backgroundColor", backgroundColor);
            canvas.renderAll();
          }

          // Відновлюємо об'єкти
          const objectsData = jsonData.filter(
            (row) =>
              row.property &&
              row.property.toString().startsWith("Object ") &&
              row.value &&
              row.value.toString().trim() !== ""
          );

          console.log("Objects to restore:", objectsData.length); // Для діагностики

          let restoredCount = 0;

          objectsData.forEach((row, index) => {
            try {
              let objData;

              // Спробуємо розпарсити JSON
              if (typeof row.value === "string") {
                objData = JSON.parse(row.value);
              } else {
                objData = row.value;
              }

              if (!objData || !objData.type) {
                console.warn(`Object ${index + 1} has no type:`, objData);
                return;
              }

              console.log(
                `Restoring object ${index + 1}:`,
                objData.type,
                objData
              ); // Для діагностики

              // Створюємо об'єкт відповідно до типу
              let fabricObj = null;

              switch (objData.type) {
                case "rect":
                  fabricObj = new fabric.Rect({
                    left: objData.left || 0,
                    top: objData.top || 0,
                    width: objData.width || 100,
                    height: objData.height || 100,
                    fill: objData.fill || "#000000",
                    stroke: objData.stroke || null,
                    strokeWidth: objData.strokeWidth || 0,
                    originX: objData.originX || "left",
                    originY: objData.originY || "top",
                  });
                  break;

                case "circle":
                  fabricObj = new fabric.Circle({
                    left: objData.left || 0,
                    top: objData.top || 0,
                    radius: objData.radius || 50,
                    fill: objData.fill || "#000000",
                    stroke: objData.stroke || null,
                    strokeWidth: objData.strokeWidth || 0,
                    originX: objData.originX || "left",
                    originY: objData.originY || "top",
                  });
                  break;

                case "triangle":
                  fabricObj = new fabric.Triangle({
                    left: objData.left || 0,
                    top: objData.top || 0,
                    width: objData.width || 100,
                    height: objData.height || 100,
                    fill: objData.fill || "#000000",
                    stroke: objData.stroke || null,
                    strokeWidth: objData.strokeWidth || 0,
                    originX: objData.originX || "left",
                    originY: objData.originY || "top",
                  });
                  break;

                case "i-text":
                case "text":
                  fabricObj = new fabric.IText(objData.text || "Text", {
                    left: objData.left || 0,
                    top: objData.top || 0,
                    fontSize: objData.fontSize || 20,
                    fontFamily: objData.fontFamily || "Arial",
                    fill: objData.fill || "#000000",
                    fontWeight: objData.fontWeight || "normal",
                    fontStyle: objData.fontStyle || "normal",
                    textAlign: objData.textAlign || "left",
                    originX: objData.originX || "left",
                    originY: objData.originY || "top",
                  });
                  break;

                case "polygon":
                  if (objData.points && Array.isArray(objData.points)) {
                    fabricObj = new fabric.Polygon(objData.points, {
                      left: objData.left || 0,
                      top: objData.top || 0,
                      fill: objData.fill || "#000000",
                      stroke: objData.stroke || null,
                      strokeWidth: objData.strokeWidth || 0,
                      originX: objData.originX || "left",
                      originY: objData.originY || "top",
                    });
                  }
                  break;

                case "path":
                  if (objData.path) {
                    fabricObj = new fabric.Path(objData.path, {
                      left: objData.left || 0,
                      top: objData.top || 0,
                      fill: objData.fill || "#000000",
                      stroke: objData.stroke || null,
                      strokeWidth: objData.strokeWidth || 0,
                      originX: objData.originX || "left",
                      originY: objData.originY || "top",
                    });
                  }
                  break;

                case "image":
                  if (objData.src) {
                    fabric.FabricImage.fromURL(objData.src)
                      .then((img) => {
                        img.set({
                          left: objData.left || 0,
                          top: objData.top || 0,
                          scaleX: objData.scaleX || 1,
                          scaleY: objData.scaleY || 1,
                          angle: objData.angle || 0,
                          opacity: objData.opacity || 1,
                          originX: objData.originX || "left",
                          originY: objData.originY || "top",
                        });
                        canvas.add(img);
                        canvas.renderAll();
                      })
                      .catch((err) => {
                        console.error("Помилка завантаження зображення:", err);
                      });
                  }
                  break;

                default:
                  console.warn(`Unknown object type: ${objData.type}`);
                  break;
              }

              // Додаємо об'єкт на canvas (крім зображень, які додаються асинхронно)
              if (fabricObj && canvas) {
                fabricObj.set({
                  scaleX: objData.scaleX || 1,
                  scaleY: objData.scaleY || 1,
                  angle: objData.angle || 0,
                  opacity: objData.opacity !== undefined ? objData.opacity : 1,
                  visible:
                    objData.visible !== undefined ? objData.visible : true,
                });
                canvas.add(fabricObj);
                restoredCount++;
              }
            } catch (objError) {
              console.error(
                `Помилка створення об'єкта ${index + 1}:`,
                objError,
                row
              );
            }
          });

          if (canvas) {
            canvas.renderAll();
          }

          alert(
            `Шаблон успішно імпортовано! Відновлено об'єктів: ${restoredCount}`
          );
        } catch (error) {
          console.error("Детальна помилка імпорту:", error);
          alert(
            `Помилка при імпорті шаблону: ${error.message}. Перевірте консоль для деталей.`
          );
        }
      };

      reader.onerror = (error) => {
        console.error("Помилка читання файлу:", error);
        alert("Помилка при читанні файлу");
      };

      reader.readAsArrayBuffer(file);
    };

    input.click();
  };

  // Фігури (Shape Icons) - встановлюють форму canvas

  // Icon0 - Прямокутник (задає форму canvas)
  const addRectangle = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('rectangle');
      
      // Встановлюємо розміри canvas (120x80 для прямокутника з відступами)
      const width = 120;
      const height = 80;
      canvas.setDimensions({ width, height });
      
      // Створюємо clipPath для обмеження області малювання
      const clipPath = new fabric.Rect({
        left: 0,
        top: 0,
        width: width,
        height: height,
        absolutePositioned: true,
      });
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в стані
      setSizeValues({ 
        width: width, 
        height: height, 
        cornerRadius: 0 
      });
      
      // Додаємо візуальний контур
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon1 - Коло (задає форму canvas)
  const addCircle = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('circle');
      
      // Встановлюємо розміри canvas (100x100 для кола)
      const width = 100;
      const height = 100;
      canvas.setDimensions({ width, height });
      
      // Створюємо clipPath у формі кола з правильними розмірами
      const radius = Math.min(width, height) / 2;
      const clipPath = new fabric.Circle({
        left: width / 2,
        top: height / 2,
        radius: radius,
        originX: 'center',
        originY: 'center',
        absolutePositioned: true,
      });
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в стані
      setSizeValues({ 
        width: width, 
        height: height, 
        cornerRadius: 0 
      });
      
      // Додаємо візуальний контур
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon2 - Еліпс (задає форму canvas)
  const addEllipse = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('ellipse');
      
      // Встановлюємо розміри canvas (140x80 для еліпса)
      const width = 140;
      const height = 80;
      canvas.setDimensions({ width, height });
      
      // Створюємо clipPath у формі еліпса з правильними розмірами
      const clipPath = new fabric.Ellipse({
        left: width / 2,
        top: height / 2,
        rx: width / 2,
        ry: height / 2,
        originX: 'center',
        originY: 'center',
        absolutePositioned: true,
      });
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в стані
      setSizeValues({ 
        width: width, 
        height: height, 
        cornerRadius: 0 
      });
      
      // Додаємо візуальний контур
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon3 - Замок (задає форму canvas)
  const addLock = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('lock');
      
      // Встановлюємо розміри canvas (120x108 для замка)
      canvas.setDimensions({ width: 120, height: 108 });
      
      // Створюємо clipPath у формі замка
      const clipPath = new fabric.Path(
        `M96 42C96 21.9771 81.8823 6 60 6C38.1177 6 24 21.9771 24 42
         M27.6 36H6V102H114V36H92.4
         M60 24C69.9411 24 78 32.0589 78 42C78 51.9411 69.9411 60 60 60C50.0589 60 42 51.9411 42 42C42 32.0589 50.0589 24 60 24Z`,
        {
          absolutePositioned: true,
        }
      );
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 120, height: 108 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon4 - Коло з горизонтальною лінією (задає форму canvas)
  const addCircleWithLine = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('circleWithLine');
      
      // Встановлюємо розміри canvas (100x100 для кола)
      canvas.setDimensions({ width: 100, height: 100 });
      
      // Створюємо clipPath у формі кола
      const clipPath = new fabric.Circle({
        left: 50,
        top: 50,
        radius: 50,
        originX: 'center',
        originY: 'center',
        absolutePositioned: true,
      });
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 100, height: 100 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon5 - Коло з хрестом (задає форму canvas)
  const addCircleWithCross = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('circleWithCross');
      
      // Встановлюємо розміри canvas (100x100 для кола)
      canvas.setDimensions({ width: 100, height: 100 });
      
      // Створюємо clipPath у формі кола
      const clipPath = new fabric.Circle({
        left: 50,
        top: 50,
        radius: 50,
        originX: 'center',
        originY: 'center',
        absolutePositioned: true,
      });
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 100, height: 100 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon6 - Будинок (задає форму canvas)
  const addHouse = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('house');
      
      // Встановлюємо розміри canvas (96x105 для будинка)
      canvas.setDimensions({ width: 96, height: 105 });
      
      // Створюємо clipPath у формі будинка
      const clipPath = new fabric.Path("M6 66V105H51H90V66L48 6L6 66Z", {
        absolutePositioned: true,
      });
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 96, height: 105 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon7 - Півколо (задає форму canvas)
  const addHalfCircle = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('halfCircle');
      
      // Встановлюємо розміри canvas (120x60 для півкола)
      canvas.setDimensions({ width: 120, height: 60 });
      
      // Створюємо clipPath у формі півкола
      const clipPath = new fabric.Path('M6 60 A54 60 0 0 1 114 60 L6 60Z', {
        absolutePositioned: true,
      });
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 120, height: 60 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon8 - Арка (задає форму canvas)
  const addArcWithBase = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('arc');
      
      // Встановлюємо розміри canvas (120x84 для арки)
      canvas.setDimensions({ width: 120, height: 84 });
      
      // Створюємо clipPath у формі арки
      const clipPath = new fabric.Path(
        'M6 54C6 65.7156 6 84 6 84H63.8574H114V54 M114 57.6129C114 27.2075 94.0836 6 59.99994 6C25.9161 6 6 28.928 6 59.3333',
        {
          absolutePositioned: true,
        }
      );
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 120, height: 84 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon9 - Шестикутник (задає форму canvas)
  const addHexagon = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('hexagon');
      
      // Встановлюємо розміри canvas (127x114 для шестикутника)
      canvas.setDimensions({ width: 127, height: 114 });
      
      // Створюємо clipPath у формі шестикутника
      const clipPath = new fabric.Path(
        'M119.6862 57.15072L91.7166 105.5958L35.77014 105.5952L7.80156 57.14748L35.77128 8.70252L91.7154 8.69502L119.6862 57.15072Z',
        {
          absolutePositioned: true,
        }
      );
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 127, height: 114 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon10 - Восьмикутник (задає форму canvas)
  const addOctagon = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('octagon');
      
      // Встановлюємо розміри canvas (100x100 для восьмикутника, масштабуємо path)
      canvas.setDimensions({ width: 100, height: 100 });
      
      // Створюємо clipPath у формі восьмикутника (масштабований)
      const clipPath = new fabric.Path(
        "M30 0L70 0L100 30L100 70L70 100L30 100L0 70L0 30Z",
        {
          absolutePositioned: true,
        }
      );
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 100, height: 100 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon11 - Трикутник (задає форму canvas)
  const addTriangleUp = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('triangle');
      
      // Встановлюємо розміри canvas (100x100 для трикутника, масштабуємо path)
      canvas.setDimensions({ width: 100, height: 100 });
      
      // Створюємо clipPath у формі трикутника (масштабований)
      const clipPath = new fabric.Path(
        "M50 0L100 100L0 100Z",
        {
          absolutePositioned: true,
        }
      );
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 100, height: 100 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon12 - Стрілка вліво (задає форму canvas)
  const addArrowLeft = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('arrowLeft');
      
      // Встановлюємо розміри canvas (120x80 для стрілки, масштабуємо path)
      canvas.setDimensions({ width: 120, height: 80 });
      
      // Створюємо clipPath у формі стрілки вліво (масштабований)
      const clipPath = new fabric.Path(
        "M0 45L30 15L30 30L120 30L120 60L30 60L30 75Z",
        {
          absolutePositioned: true,
        }
      );
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 120, height: 80 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon13 - Стрілка вправо (задає форму canvas)
  const addArrowRight = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('arrowRight');
      
      // Встановлюємо розміри canvas (120x80 для стрілки, масштабуємо path)
      canvas.setDimensions({ width: 120, height: 80 });
      
      // Створюємо clipPath у формі стрілки вправо (масштабований)
      const clipPath = new fabric.Path(
        "M120 45L90 15L90 30L0 30L0 60L90 60L90 75Z",
        {
          absolutePositioned: true,
        }
      );
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 120, height: 80 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon14 - Прапор (задає форму canvas)
  const addFlag = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('flag');
      
      // Встановлюємо розміри canvas
      canvas.setDimensions({ width: 720, height: 600 });
      
      // Створюємо clipPath у формі прапора
      const clipPath = new fabric.Path(
        "M0 240L0 480L180 420L360 510L528 420L528 240L360 210L210 0L0 240Z",
        {
          absolutePositioned: true,
        }
      );
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 720, height: 600 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };

  // Icon15 - Ромб (задає форму canvas)
  const addDiamond = () => {
    if (canvas) {
      // Очищуємо canvas
      canvas.clear();
      
      // Встановлюємо тип поточної фігури
      setCurrentShapeType('diamond');
      
      // Встановлюємо розміри canvas
      canvas.setDimensions({ width: 600, height: 600 });
      
      // Створюємо clipPath у формі ромба
      const clipPath = new fabric.Path(
        "M300 0L600 300L300 600L0 300Z",
        {
          absolutePositioned: true,
        }
      );
      
      // Встановлюємо clipPath для canvas
      canvas.clipPath = clipPath;
      
      // Оновлюємо розміри в state
      setSizeValues({ width: 600, height: 600 });
      
      // Оновлюємо візуальний контур canvas
      updateCanvasOutline();
      
      canvas.renderAll();
    }
  };
  const handleInputChange = (key, max, rawValue) => {
    const parsed = parseInt(rawValue);
    const value = Math.max(0, Math.min(max, isNaN(parsed) ? 0 : parsed));
    setSizeValues((prev) => ({ ...prev, [key]: value }));

    // Застосовуємо зміни відразу
    setTimeout(() => {
      if (activeObject && canvas) {
        const currentLeft = activeObject.left;
        const currentTop = activeObject.top;

        if (activeObject.type === "circle") {
          const originalRadius = activeObject.radius;
          const scaleX = value / (originalRadius * 2);
          const scaleY =
            (key === "width" ? value : sizeValues.height) /
            (originalRadius * 2);
          if (key === "height") {
            const scaleX = sizeValues.width / (originalRadius * 2);
            const scaleY = value / (originalRadius * 2);
            activeObject.set({
              scaleX,
              scaleY,
              left: currentLeft,
              top: currentTop,
            });
          } else {
            const scaleY = sizeValues.height / (originalRadius * 2);
            activeObject.set({
              scaleX,
              scaleY,
              left: currentLeft,
              top: currentTop,
            });
          }
        } else if (activeObject.type === "ellipse") {
          const originalRx = activeObject.rx;
          const originalRy = activeObject.ry;
          if (key === "width") {
            const scaleX = value / (originalRx * 2);
            activeObject.set({ scaleX, left: currentLeft, top: currentTop });
          } else if (key === "height") {
            const scaleY = value / (originalRy * 2);
            activeObject.set({ scaleY, left: currentLeft, top: currentTop });
          }
        } else {
          const originalWidth = activeObject.width;
          const originalHeight = activeObject.height;
          if (key === "width") {
            const scaleX = value / originalWidth;
            activeObject.set({ scaleX, left: currentLeft, top: currentTop });
          } else if (key === "height") {
            const scaleY = value / originalHeight;
            activeObject.set({ scaleY, left: currentLeft, top: currentTop });
          } else if (key === "cornerRadius") {
            activeObject.set({ rx: value, ry: value });
          }
        }
        canvas.renderAll();
      } else if (canvas && currentShapeType) {
        // Якщо нічого не вибрано але є фігура полотна - оновлюємо її
        updateSize();
      } else if (canvas) {
        // Якщо нічого не вибрано і немає фігури - просто оновлюємо canvas
        updateSize();
      }
    }, 0);
  };

  const changeValue = (key, delta, max) => {
    setSizeValues((prev) => {
      const newValue = Math.max(0, Math.min(max, prev[key] + delta));
      const updated = { ...prev, [key]: newValue };

      // Застосовуємо зміни відразу
      setTimeout(() => {
        if (activeObject && canvas) {
          const currentLeft = activeObject.left;
          const currentTop = activeObject.top;

          if (activeObject.type === "circle") {
            const originalRadius = activeObject.radius;
            if (key === "width" || key === "height") {
              const scaleX = updated.width / (originalRadius * 2);
              const scaleY = updated.height / (originalRadius * 2);
              activeObject.set({
                scaleX,
                scaleY,
                left: currentLeft,
                top: currentTop,
              });
            }
          } else if (activeObject.type === "ellipse") {
            const originalRx = activeObject.rx;
            const originalRy = activeObject.ry;
            if (key === "width") {
              const scaleX = newValue / (originalRx * 2);
              activeObject.set({ scaleX, left: currentLeft, top: currentTop });
            } else if (key === "height") {
              const scaleY = newValue / (originalRy * 2);
              activeObject.set({ scaleY, left: currentLeft, top: currentTop });
            }
          } else {
            const originalWidth = activeObject.width;
            const originalHeight = activeObject.height;
            if (key === "width") {
              const scaleX = newValue / originalWidth;
              activeObject.set({ scaleX, left: currentLeft, top: currentTop });
            } else if (key === "height") {
              const scaleY = newValue / originalHeight;
              activeObject.set({ scaleY, left: currentLeft, top: currentTop });
            } else if (key === "cornerRadius") {
              activeObject.set({ rx: newValue, ry: newValue });
            }
          }
          canvas.renderAll();
        } else if (canvas && currentShapeType) {
          // Якщо нічого не вибрано але є фігура полотна - оновлюємо її
          updateSize();
        } else if (canvas) {
          // Якщо нічого не вибрано і немає фігури - просто оновлюємо canvas
          updateSize();
        }
      }, 0);

      return updated;
    });
  };

  return (
    <div className={styles.toolbar}>
      {/* 1. Shape */}
      <div className={styles.section}>
        <div className={styles.numbering}>
          <p>1</p>
        </div>
        <div className={styles.icons}>
          <h3>Shape</h3>
          <span onClick={addRectangle}>{Icon0}</span>
          <span onClick={addCircle}>{Icon1}</span>
          <span onClick={addEllipse}>{Icon2}</span>
          <span onClick={addLock}>{Icon3}</span>
          <span onClick={addCircleWithLine}>{Icon4}</span>
          <span onClick={addCircleWithCross}>{Icon5}</span>
          <span onClick={addHouse}>{Icon6}</span>
          <span onClick={addHalfCircle}>{Icon7}</span>
          <span onClick={addArcWithBase}>{Icon8}</span>
          <span onClick={addHexagon}>{Icon9}</span>
          <span onClick={addOctagon}>{Icon10}</span>
          <span onClick={addTriangleUp}>{Icon11}</span>
          <span onClick={addArrowLeft}>{Icon12}</span>
          <span onClick={addArrowRight}>{Icon13}</span>
          <span onClick={addFlag}>{Icon14}</span>
        </div>
      </div>
      {/* 2. Size */}
      <div className={styles.section}>
        <div className={styles.numbering}>
          <p>2</p>
        </div>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>Width</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                value={sizeValues.width}
                onChange={(e) =>
                  handleInputChange("width", activeObject ? 300 : 1200, e.target.value)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => changeValue("width", 1, activeObject ? 300 : 1200)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => changeValue("width", -1, activeObject ? 300 : 1200)}
                />
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label>Corner radius</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                value={sizeValues.cornerRadius}
                onChange={(e) =>
                  handleInputChange("cornerRadius", 50, e.target.value)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => changeValue("cornerRadius", 1, 50)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => changeValue("cornerRadius", -1, 50)}
                />
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label>Height</label>
            <div className={styles.inputGroup}>
              <input
                type="number"
                value={sizeValues.height}
                onChange={(e) =>
                  handleInputChange("height", activeObject ? 300 : 1200, e.target.value)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => changeValue("height", 1, activeObject ? 300 : 1200)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => changeValue("height", -1, activeObject ? 300 : 1200)}
                />
              </div>
            </div>
          </div>

          <div className={styles.unitLabel}>* (mm)</div>
        </div>
      </div>
      {/* 3. Thickness */}
      <div className={styles.section}>
        <div className={styles.numbering}>
          <p>3</p>
        </div>
        <div className={styles.thicknessWrapper}>
          <div className={styles.field}>
            <h3>Thickness:</h3>
            <label>1.6</label>
            <input
              type="radio"
              name="thickness"
              value="1.6"
              checked={thickness === 1.6}
              onChange={() => {
                setThickness(1.6);
                updateThickness(1.6);
              }}
            />
          </div>
          <div className={styles.field}>
            <label>0.8</label>
            <input
              type="radio"
              name="thickness"
              value="0.8"
              checked={thickness === 0.8}
              onChange={() => {
                setThickness(0.8);
                updateThickness(0.8);
              }}
            />
          </div>
          <div className="">
            <label>3.2</label>
            <input
              type="radio"
              name="thickness"
              value="3.2"
              checked={thickness === 3.2}
              onChange={() => {
                setThickness(3.2);
                updateThickness(3.2);
              }}
            />
          </div>
          <div className="">
            <label>Adhesive Tape</label>
            <input
              type="checkbox"
              checked={isAdhesiveTape}
              onChange={(e) => {
                setIsAdhesiveTape(e.target.checked);
                updateThickness(thickness);
              }}
            />
          </div>
          <div></div>
          <div className={styles.unitLabel}>* (mm)</div>
        </div>
      </div>
      {/* 4. Colour */}
      <div className={`${styles.section} ${styles.colorSection}`}>
        <div className={styles.colorTitleWrapper}>
          <div className={styles.numbering}>
            <p>4</p>
          </div>
          <h3>Colour</h3>
        </div>
        <div className={styles.colors}>
          <span
            onClick={() => updateColorScheme("#000000", "#FFFFFF")}
            title="Чорний текст, білий фон"
          >
            {A1}
          </span>
          <span
            onClick={() => updateColorScheme("#0000FF", "#FFFFFF")}
            title="Синій текст, білий фон"
          >
            {A2}
          </span>
          <span
            onClick={() => updateColorScheme("#FF0000", "#FFFFFF")}
            title="Червоний текст, білий фон"
          >
            {A3}
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#000000")}
            title="Білий текст, чорний фон"
          >
            {A4}
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#0000FF")}
            title="Білий текст, синій фон"
          >
            {A5}
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#FF0000")}
            title="Білий текст, червоний фон"
          >
            {A6}
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#00FF00")}
            title="Білий текст, зелений фон"
          >
            {A7}
          </span>
          <span
            onClick={() => updateColorScheme("#000000", "#FFFF00")}
            title="Чорний текст, жовтий фон"
          >
            {A8}
          </span>
          <span
            onClick={() => updateColorScheme("#000000", "#F0F0F0", "gradient")}
            title="Чорний текст, градієнт фон"
          >
            {A9}
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#8B4513")}
            title="Білий текст, коричневий фон"
          >
            {A10}
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#FFA500")}
            title="Білий текст, оранжевий фон"
          >
            {A11}
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#808080")}
            title="Білий текст, сірий фон"
          >
            {A12}
          </span>
          <span
            onClick={() => updateColorScheme("#000000", "#D2B48C", "texture")}
            title="Чорний текст, фон дерева"
          >
            {A13}
          </span>
          <span
            onClick={() => updateColorScheme("#FFFFFF", "#36454F", "texture")}
            title="Білий текст, карбоновий фон"
          >
            {A14}
          </span>
        </div>
      </div>
      {/* 5. Elements & Tools */}
      <div className={`${styles.section} ${styles.colorSection}`}>
        <div className={styles.numbering}>
          <p>5</p>
        </div>
        <ul className={styles.elementsList}>
          <li className={styles.elementsEl} onClick={addText}>
            <span className={styles.elementsSpanWrapper}>
              <span style={{ fontWeight: "bold" }}>A</span>
              <span>Text</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addImage}>
            <span className={styles.elementsSpanWrapper}>
              {Image}
              <span>Image</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addUploadImage}>
            <span className={styles.elementsSpanWrapper}>
              {Upload}
              <span>Upload</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addShape}>
            <span className={styles.elementsSpanWrapper}>
              {Shape}
              <span>Shape</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addBorder}>
            <span className={styles.elementsSpanWrapper}>
              {Border}
              <span>Border</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={cut}>
            <span className={styles.elementsSpanWrapper}>
              {Cut}
              <span>Cut</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addQrCode}>
            <span className={styles.elementsSpanWrapper}>
              {QrCode}
              <span>QR Code</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={addBarCode}>
            <span className={styles.elementsSpanWrapper}>
              {BarCode}
              <span>Bar Code</span>
            </span>
          </li>
          {/* <li className={styles.elementsEl} onClick={exportToExcel}>
            <span className={styles.elementsSpanWrapper}>
              <span style={{ fontWeight: "bold" }}>📤</span>
              <span>Export</span>
            </span>
          </li>
          <li className={styles.elementsEl} onClick={importFromExcel}>
            <span className={styles.elementsSpanWrapper}>
              <span style={{ fontWeight: "bold" }}>📥</span>
              <span>Import</span>
            </span>
          </li> */}
        </ul>
      </div>
      {/* 6. Holes */}
      <div className={`${styles.section} ${styles.colorSection}`}>
        <div className={styles.colorTitleWrapper}>
          <div className={styles.numbering}>
            <p>6</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
            <h3 style={{ marginRight: "60px" }}>Holes</h3>
            <div className={styles.field} style={{ margin: 0 }}>
              <div className={styles.inputGroup}>
                <input
                  type="number"
                  min={1}
                  value={holesDiameter}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setHolesDiameter(val);
                  }}
                />
                <div className={styles.arrows}>
                  <i
                    className="fa-solid fa-chevron-up"
                    onClick={() => setHolesDiameter((prev) => prev + 1)}
                  />
                  <i
                    className="fa-solid fa-chevron-down"
                    onClick={() =>
                      setHolesDiameter((prev) => (prev > 1 ? prev - 1 : 1))
                    }
                  />
                </div>
              </div>
            </div>
            <p style={{ padding: "0", margin: "0 0 0 10px" }}>Ø mm</p>
          </div>
        </div>
        <div className={styles.holes}>
          <span onClick={addHoleType1} title="Без отворів">
            {Hole1}
          </span>
          <span onClick={addHoleType2} title="Отвір зверху по центру">
            {Hole2}
          </span>
          <span onClick={addHoleType3} title="Два отвори по бокам">
            {Hole3}
          </span>
          <span onClick={addHoleType4} title="4 круглі отвори по кутам">
            {Hole4}
          </span>
          <span onClick={addHoleType5} title="4 квадратні отвори по кутам">
            {Hole5}
          </span>
          <span onClick={addHoleType6} title="Отвір зліва по центру">
            {Hole6}
          </span>
          <span onClick={addHoleType7} title="Отвір зправа по центру">
            {Hole7}
          </span>
        </div>
      </div>
      {/* Copies */}
      <div className={`${styles.section} ${styles.colorSection}`}>
        <div className={styles.colorTitleWrapper}>
          <h3>Copies</h3>
          <div className={styles.field} style={{ margin: 0 }}>
            <div className={styles.inputGroup}>
              <input
                type="number"
                min={1}
                value={copiesCount}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setCopiesCount(val);
                }}
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => setCopiesCount((prev) => prev + 1)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() =>
                    setCopiesCount((prev) => (prev > 1 ? prev - 1 : 1))
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Undo/Redo */}
      {/* <UndoRedo /> */}
      <QRCodeGenerator isOpen={isQrOpen} onClose={() => setIsQrOpen(false)} />
      <BarCodeGenerator
        isOpen={isBarCodeOpen}
        onClose={() => setIsBarCodeOpen(false)}
      />
      <ShapeSelector
        isOpen={isShapeOpen}
        onClose={() => setIsShapeOpen(false)}
      />
      <CutSelector isOpen={isCutOpen} onClose={() => setIsCutOpen(false)} />
      <IconMenu
        isOpen={isIconMenuOpen}
        onClose={() => setIsIconMenuOpen(false)}
      />
      <ShapeProperties
        isOpen={isShapePropertiesOpen}
        onClose={() => setIsShapePropertiesOpen(false)}
      />
      {/* Прихований input для завантаження файлів через іконку камери */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        style={{ display: "none" }}
      />
    </div>
  );
};

export default Toolbar;
