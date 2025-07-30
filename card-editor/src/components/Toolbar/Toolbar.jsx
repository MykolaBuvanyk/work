import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
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
  const { canvas } = useCanvasContext();
  const [activeObject, setActiveObject] = useState(null);
  const [sizeValues, setSizeValues] = useState({
    width: 150,
    height: 150,
    cornerRadius: 2,
  });
  const [thickness, setThickness] = useState(1.6);
  const [isAdhesiveTape, setIsAdhesiveTape] = useState(false);
  const fileInputRef = useRef(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isBarCodeOpen, setIsBarCodeOpen] = useState(false);
  const [isShapeOpen, setIsShapeOpen] = useState(false);
  const [isCutOpen, setIsCutOpen] = useState(false);
  const [isIconMenuOpen, setIsIconMenuOpen] = useState(false);
  const [isShapePropertiesOpen, setIsShapePropertiesOpen] = useState(false);

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
        setSizeValues({ width: 150, height: 150, cornerRadius: 2 });
      });
      canvas.on("object:modified", () => {
        const obj = canvas.getActiveObject();
        if (obj) {
          setSizeValues({
            width: Math.round(obj.width * obj.scaleX),
            height: Math.round(obj.height * obj.scaleY),
            cornerRadius: obj.rx || 0,
          });
        }
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

  // Оновлення розмірів активного об'єкта
  const updateSize = () => {
    if (activeObject) {
      activeObject.set({
        width: sizeValues.width,
        height: sizeValues.height,
        rx: sizeValues.cornerRadius,
        ry: sizeValues.cornerRadius,
      });
      activeObject.scaleToWidth(sizeValues.width);
      activeObject.scaleToHeight(sizeValues.height);
      canvas.renderAll();
    }
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

  // Додавання тексту
  const addText = () => {
    if (canvas) {
      const text = new fabric.IText("Текст", {
        left: 100,
        top: 100,
        fontFamily: "Arial",
        fill: "#000000",
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
          // Використовуємо новий API для fabric.js v6+
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
            left: 100,
            top: 100,
            selectable: true,
            hasControls: true,
            hasBorders: true,
          });

          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
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

  // Додавання рамки (border)
  const addBorder = () => {
    if (canvas) {
      const rect = new fabric.Rect({
        left: 50,
        top: 50,
        width: 200,
        height: 150,
        fill: "transparent",
        stroke: "#000",
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
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
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
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
      });

      // Правий отвір
      const rightHole = new fabric.Circle({
        left: canvasWidth - 15,
        top: canvasHeight / 2,
        radius: 8,
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
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
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
      });

      // Верхній правий
      const topRight = new fabric.Circle({
        left: canvasWidth - 15,
        top: 15,
        radius: 8,
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
      });

      // Нижній лівий
      const bottomLeft = new fabric.Circle({
        left: 15,
        top: canvasHeight - 15,
        radius: 8,
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
      });

      // Нижній правий
      const bottomRight = new fabric.Circle({
        left: canvasWidth - 15,
        top: canvasHeight - 15,
        radius: 8,
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
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
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
      });

      // Верхній правий
      const topRight = new fabric.Rect({
        left: canvasWidth - 15,
        top: 15,
        width: 12,
        height: 12,
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
      });

      // Нижній лівий
      const bottomLeft = new fabric.Rect({
        left: 15,
        top: canvasHeight - 15,
        width: 12,
        height: 12,
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
      });

      // Нижній правий
      const bottomRight = new fabric.Rect({
        left: canvasWidth - 15,
        top: canvasHeight - 15,
        width: 12,
        height: 12,
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
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
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
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
        fill: "#fff",
        stroke: "#000",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
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

  // Фігури (Shape Icons)

  // Icon0 - Прямокутник
  const addRectangle = () => {
    if (canvas) {
      const rect = new fabric.Rect({
        left: 100,
        top: 100,
        width: 100,
        height: 60,
        fill: "transparent",
        stroke: "#000",
        strokeWidth: 1,
      });
      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.renderAll();
    }
  };

  // Icon1 - Коло
  const addCircle = () => {
    if (canvas) {
      const circle = new fabric.Circle({
        left: 100,
        top: 100,
        radius: 50,
        fill: "transparent",
        stroke: "#000",
        strokeWidth: 1,
      });
      canvas.add(circle);
      canvas.setActiveObject(circle);
      canvas.renderAll();
    }
  };

  // Icon2 - Еліпс
  const addEllipse = () => {
    if (canvas) {
      const ellipse = new fabric.Ellipse({
        left: 100,
        top: 100,
        rx: 60,
        ry: 35,
        fill: "transparent",
        stroke: "#000",
        strokeWidth: 1,
      });
      canvas.add(ellipse);
      canvas.setActiveObject(ellipse);
      canvas.renderAll();
    }
  };

  // Icon3 - Замок (складна фігура з кругом та прямокутником)
  const addLock = () => {
    if (canvas) {
      const shape = new fabric.Path(
        `M16 7C16 3.68629 13.3137 1 10 1C6.68629 1 4 3.68629 4 7
   M4.6 6H1V17H19V6H15.4
   M10 4C11.6569 4 13 5.34315 13 7C13 8.65685 11.6569 10 10 10C8.34315 10 7 8.65685 7 7C7 5.34315 8.34315 4 10 4Z`,
        {
          left: 0,
          top: 0,
          stroke: "black",
          strokeWidth: 1,
          fill: "",
          originX: "left",
          originY: "top",
        }
      );
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
    }
  };

  // Icon4 - Коло з горизонтальною лінією (мінус)
  const addCircleWithLine = () => {
    if (canvas) {
      const shape = new fabric.Path(
        `M10 0.5
   A9.5 9.5 0 1 1 9.999 0.5Z
   M4.5 9.5
   H15.5
   A0.5 0.5 0 0 1 16 10
   A0.5 0.5 0 0 1 15.5 10.5
   H4.5
   A0.5 0.5 0 0 1 4 10
   A0.5 0.5 0 0 1 4.5 9.5Z`,
        {
          left: 0,
          top: 0,
          stroke: "black",
          strokeWidth: 1,
          fill: "", // без заливки, як у SVG
          originX: "left",
          originY: "top",
        }
      );

      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
    }
  };

  // Icon5 - Коло з хрестом (плюс)
  const addCircleWithCross = () => {
    if (canvas) {
      const shape = new fabric.Path(
        `M10 0.5
        A9.5 9.5 0 1 1 9.999 0.5Z

        M3.5 9
        H16.5
        A0.5 0.5 0 0 1 17 9.5
        A0.5 0.5 0 0 1 16.5 10
        H3.5
        A0.5 0.5 0 0 1 3 9.5
        A0.5 0.5 0 0 1 3.5 9Z

        M10.5 10.5
        V15.5
        A0.5 0.5 0 0 1 10 16
        A0.5 0.5 0 0 1 9.5 15.5
        V10.5
        A0.5 0.5 0 0 1 10 10
        A0.5 0.5 0 0 1 10.5 10.5Z`,
        {
          left: 0,
          top: 0,
          stroke: "black",
          strokeWidth: 1,
          fill: "",
          originX: "left",
          originY: "top",
        }
      );
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
    }
  };

  // Icon6 - Будинок з дахом
  const addHouse = () => {
    if (canvas) {
      const shape = new fabric.Path("M1 11V17.5H8.5H15V11L8 1L1 11Z", {
        left: 0,
        top: 0,
        stroke: "black",
        fill: "",
        strokeWidth: 1.5,
        originX: "left",
        originY: "top",
      });

      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
    }
  };

  // Icon7 - Півколо з основою (дуга)
  const addHalfCircle = () => {
    if (canvas) {
      // Створюємо групу для об'єднання всіх елементів
      const group = new fabric.Group([], {
        left: 0,
        top: 0,
        originX: "left",
        originY: "top",
      });

      // Напівколо
      const semicircle = new fabric.Path("M1 10 A9 10 0 0 1 19 10", {
        left: 0,
        top: 0,
        stroke: "black",
        strokeWidth: 1,
        fill: "",
        originX: "left",
        originY: "top",
      });

      // Лінія діаметра
      const diameterLine = new fabric.Line([0.05, 10, 18.95, 10], {
        stroke: "black",
        strokeWidth: 1,
        originX: "left",
        originY: "top",
      });

      // Додаємо елементи до групи
      group.add(semicircle);
      group.add(diameterLine);

      // Додаємо групу на канвас
      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.renderAll();
    }
  };

  // Icon8 - Арка з основою
  const addArcWithBase = () => {
    if (canvas) {
      // Створюємо фігуру одним path
      const shape = new fabric.Path(
        "M1 9C1 10.9526 1 14 1 14H10.6429H19V9 M19 9.60215C19 4.53459 15.6806 1 9.99999 1C4.31935 1 1 4.82133 1 9.88889",
        {
          left: 0,
          top: 0,
          stroke: "black",
          strokeWidth: 1,
          fill: "",
          originX: "left",
          originY: "top",
        }
      );

      // Додаємо фігуру на канвас
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
    }
  };

  // Icon9 - Шестикутник
  const addHexagon = () => {
    if (canvas) {
      // Створюємо шестикутник одним path
      const hexagon = new fabric.Path(
        "M19.9477 9.52512L15.2861 17.5993L5.96169 17.5992L1.30026 9.52458L5.96188 1.45042L15.2859 1.44917L19.9477 9.52512Z",
        {
          left: 0,
          top: 0,
          stroke: "black",
          strokeWidth: 1,
          fill: "",
          originX: "left",
          originY: "top",
        }
      );

      // Додаємо шестикутник на канвас
      canvas.add(hexagon);
      canvas.setActiveObject(hexagon);
      canvas.renderAll();
    }
  };

  // Icon10 - Восьмикутник
  const addOctagon = () => {
    if (canvas) {
      const octagon = new fabric.Polygon(
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
          fill: "transparent",
          stroke: "#000",
          strokeWidth: 1,
        }
      );
      canvas.add(octagon);
      canvas.setActiveObject(octagon);
      canvas.renderAll();
    }
  };

  // Icon11 - Трикутник вгору
  const addTriangleUp = () => {
    if (canvas) {
      const triangle = new fabric.Polygon(
        [
          { x: 50, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        {
          left: 100,
          top: 100,
          fill: "transparent",
          stroke: "#000",
          strokeWidth: 1,
        }
      );
      canvas.add(triangle);
      canvas.setActiveObject(triangle);
      canvas.renderAll();
    }
  };

  // Icon12 - Стрілка вліво
  const addArrowLeft = () => {
    if (canvas) {
      const arrow = new fabric.Polygon(
        [
          { x: 0, y: 30 },
          { x: 20, y: 10 },
          { x: 20, y: 20 },
          { x: 80, y: 20 },
          { x: 80, y: 40 },
          { x: 20, y: 40 },
          { x: 20, y: 50 },
        ],
        {
          left: 100,
          top: 100,
          fill: "transparent",
          stroke: "#000",
          strokeWidth: 1,
        }
      );
      canvas.add(arrow);
      canvas.setActiveObject(arrow);
      canvas.renderAll();
    }
  };

  // Icon13 - Стрілка вправо
  const addArrowRight = () => {
    if (canvas) {
      const arrow = new fabric.Polygon(
        [
          { x: 80, y: 30 },
          { x: 60, y: 10 },
          { x: 60, y: 20 },
          { x: 0, y: 20 },
          { x: 0, y: 40 },
          { x: 60, y: 40 },
          { x: 60, y: 50 },
        ],
        {
          left: 100,
          top: 100,
          fill: "transparent",
          stroke: "#000",
          strokeWidth: 1,
        }
      );
      canvas.add(arrow);
      canvas.setActiveObject(arrow);
      canvas.renderAll();
    }
  };

  // Icon14 - Прапор
  const addFlag = () => {
    if (canvas) {
      const flag = new fabric.Polygon(
        [
          { x: 0, y: 40 }, // Початок прапора
          { x: 0, y: 80 }, // Низ лівої сторони
          { x: 30, y: 70 }, // Точка на прапорі
          { x: 60, y: 85 }, // Кінець прапора
          { x: 88, y: 70 }, // Верх правої сторони
          { x: 88, y: 40 }, // Верх правої сторони
          { x: 60, y: 35 }, // Середина верху
          { x: 35, y: 0 }, // Верхня точка
          { x: 0, y: 40 }, // Повернення до початку
        ],
        {
          left: 100,
          top: 100,
          fill: "transparent",
          stroke: "#000",
          strokeWidth: 1,
        }
      );
      canvas.add(flag);
      canvas.setActiveObject(flag);
      canvas.renderAll();
    }
  };

  // Icon15 - Ромб (якщо є)
  const addDiamond = () => {
    if (canvas) {
      const diamond = new fabric.Polygon(
        [
          { x: 50, y: 0 },
          { x: 100, y: 50 },
          { x: 50, y: 100 },
          { x: 0, y: 50 },
        ],
        {
          left: 100,
          top: 100,
          fill: "transparent",
          stroke: "#000",
          strokeWidth: 1,
        }
      );
      canvas.add(diamond);
      canvas.setActiveObject(diamond);
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
                  handleInputChange("width", 300, e.target.value)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => changeValue("width", 1, 300)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => changeValue("width", -1, 300)}
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
                  handleInputChange("cornerRadius", 10, e.target.value)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => changeValue("cornerRadius", 1, 10)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => changeValue("cornerRadius", -1, 10)}
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
                  handleInputChange("height", 300, e.target.value)
                }
              />
              <div className={styles.arrows}>
                <i
                  className="fa-solid fa-chevron-up"
                  onClick={() => changeValue("height", 1, 300)}
                />
                <i
                  className="fa-solid fa-chevron-down"
                  onClick={() => changeValue("height", -1, 300)}
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
          <span onClick={() => updateColor("#FF0000")}>{A1}</span>
          <span onClick={() => updateColor("#00FF00")}>{A2}</span>
          <span onClick={() => updateColor("#0000FF")}>{A3}</span>
          <span onClick={() => updateColor("#FFFF00")}>{A4}</span>
          <span onClick={() => updateColor("#FF00FF")}>{A5}</span>
          <span onClick={() => updateColor("#00FFFF")}>{A6}</span>
          <span onClick={() => updateColor("#FFA500")}>{A7}</span>
          <span onClick={() => updateColor("#800080")}>{A8}</span>
          <span onClick={() => updateColor("#FFC0CB")}>{A9}</span>
          <span onClick={() => updateColor("#A52A2A")}>{A10}</span>
          <span onClick={() => updateColor("#808080")}>{A11}</span>
          <span onClick={() => updateColor("#000000")}>{A12}</span>
          <span onClick={() => updateColor("#FFFFFF")}>{A13}</span>
          <span onClick={() => updateColor("#90EE90")}>{A14}</span>
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
          <h3>Holes</h3>
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

      {/* Undo/Redo */}
      <UndoRedo />
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
