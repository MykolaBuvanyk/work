import { useCanvasContext } from "../contexts/CanvasContext";
import * as fabric from "fabric";
import qrGenerator from "qrcode-generator";
import JsBarcode from "jsbarcode";
import * as XLSX from "xlsx";

const resolveFillColor = (object) => {
  if (!object) return null;
  const directFill = object.fill;
  if (typeof directFill === "string" && directFill !== "") {
    return directFill;
  }
  if (typeof object.barCodeColor === "string" && object.barCodeColor) {
    return object.barCodeColor;
  }
  if (typeof object.getObjects === "function") {
    try {
      const children = object.getObjects();
      if (Array.isArray(children)) {
        for (const child of children) {
          const candidate = resolveFillColor(child);
          if (candidate) return candidate;
        }
      }
    } catch {}
  }
  return null;
};

export const useExcelImport = () => {
  const { canvas } = useCanvasContext();

  // Експорт шаблону в Excel
  const exportToExcel = async () => {
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

      // Додаємо тип фігури полотна та корнер радіус
      const toolbarState =
        typeof window !== "undefined" && window.getCurrentToolbarState
          ? window.getCurrentToolbarState() || {}
          : {};
      const canvasShapeType =
        canvas.get("shapeType") || toolbarState.currentShapeType || "rectangle";
      const canvasCornerRadius =
        canvas.get("cornerRadius") ||
        toolbarState.cornerRadius ||
        toolbarState.sizeValues?.cornerRadius ||
        0;

      // Проходимо по всіх об'єктах canvas (з урахуванням асинхронного отримання src для зображень)
      const objects = canvas.getObjects();
      const exported = await Promise.all(
        objects.map(async (obj, index) => {
          // Не експортуємо службові бордери
          if (obj.isBorderShape) {
            return null;
          }
          const rawFill =
            typeof obj.fill === "string" && obj.fill !== ""
              ? obj.fill
              : undefined;
          const inferredFill = rawFill ?? resolveFillColor(obj);
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
            fill:
              inferredFill !== undefined && inferredFill !== null
                ? inferredFill
                : "#000000",
            stroke: obj.stroke || null,
            strokeWidth: obj.strokeWidth || 0,
            opacity: obj.opacity !== undefined ? obj.opacity : 1,
            visible: obj.visible !== undefined ? obj.visible : true,
            originX: obj.originX || "left",
            originY: obj.originY || "top",
            // маркери, які допоможуть імпорту
            isBorderShape: !!obj.isBorderShape,
          };

          if (obj.isQRCode) {
            objData.isQRCode = true;
            if (typeof obj.qrText === "string" && obj.qrText.length > 0) {
              objData.qrText = obj.qrText;
            }
          }
          if (obj.isBarCode) {
            objData.isBarCode = true;
            if (typeof obj.barCodeText === "string") {
              objData.barCodeText = obj.barCodeText;
            }
            if (typeof obj.barCodeType === "string") {
              objData.barCodeType = obj.barCodeType;
            }
            if (typeof obj.suppressBarText === "boolean") {
              objData.suppressBarText = obj.suppressBarText;
            }
            if (typeof obj.barCodeColor === "string" && obj.barCodeColor) {
              objData.barCodeColor = obj.barCodeColor;
            } else if (
              typeof objData.fill === "string" &&
              objData.fill !== ""
            ) {
              objData.barCodeColor = objData.fill;
            }
          }

          // Зберігаємо форму та радіуси кутів, щоб ShapeProperties могла працювати після імпорту
          if (obj.shapeType) {
            objData.shapeType = obj.shapeType;
          }
          if (typeof obj.baseCornerRadius === "number") {
            objData.baseCornerRadius = obj.baseCornerRadius;
          }
          if (typeof obj.cornerRadiusMm === "number") {
            objData.cornerRadiusMm = obj.cornerRadiusMm;
          }
          if (typeof obj.displayCornerRadiusMm === "number") {
            objData.displayCornerRadiusMm = obj.displayCornerRadiusMm;
          }
          if (typeof obj.cornerRadius === "number") {
            objData.cornerRadius = obj.cornerRadius;
          }
          if (typeof obj.rx === "number") {
            objData.rx = obj.rx;
          }
          if (typeof obj.ry === "number") {
            objData.ry = obj.ry;
          }
          if (obj.fromShapeTab) {
            objData.fromShapeTab = true;
          }
          if (typeof obj.useThemeColor === "boolean") {
            objData.useThemeColor = obj.useThemeColor;
          }
          if (typeof obj.followThemeStroke === "boolean") {
            objData.followThemeStroke = obj.followThemeStroke;
          }
          if (obj.isCustomEdited) {
            objData.isCustomEdited = true;
          }
          if (Array.isArray(obj.__baseCustomCorners)) {
            objData.__baseCustomCorners = obj.__baseCustomCorners;
          }

          // Додаткові властивості для тексту
          if (obj.type === "i-text" || obj.type === "text") {
            objData.text = obj.text || "";
            objData.fontSize = obj.fontSize || 20;
            objData.fontFamily = obj.fontFamily || "Arial";
            objData.fontWeight = obj.fontWeight || "normal";
            objData.fontStyle = obj.fontStyle || "normal";
            objData.textAlign = obj.textAlign || "left";
          }

          // Додаткові властивості для зображень (з підстраховкою: вбудувати base64, якщо можливо)
          if (obj.type === "image") {
            let src = "";
            try {
              src = obj.getSrc ? obj.getSrc() : obj.src || "";
            } catch (e) {
              // ігноруємо, спробуємо інші методи
            }
            try {
              if (!src && obj._element && obj._element.src) {
                src = obj._element.src;
              }
            } catch {}

            // Якщо src є blob: або порожній — спробуємо вбудувати PNG через offscreen canvas
            const needsEmbed = !src || /^blob:/i.test(src);
            if (needsEmbed && obj._element && obj._element.naturalWidth) {
              try {
                const off = document.createElement("canvas");
                off.width = obj._element.naturalWidth;
                off.height = obj._element.naturalHeight;
                const ctx = off.getContext("2d");
                ctx.drawImage(obj._element, 0, 0);
                src = off.toDataURL("image/png");
              } catch (embedErr) {
                console.warn(
                  "Не вдалося вбудувати зображення як base64:",
                  embedErr
                );
              }
            }

            objData.src = src || "";
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

          return objData;
        })
      );

      // Відфільтруємо порожні (бордери) після async-мапи
      canvasData.objects = exported.filter(Boolean);

      console.log("Exporting data:", canvasData); // Для діагностики

      // Створюємо Excel файл
      const worksheet = XLSX.utils.json_to_sheet([
        { property: "Canvas Width", value: canvasData.width },
        { property: "Canvas Height", value: canvasData.height },
        { property: "Background Color", value: canvasData.backgroundColor },
        { property: "Canvas Shape Type", value: canvasShapeType },
        { property: "Corner Radius", value: canvasCornerRadius },
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

  const importFromExcel = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
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
          let shapeType = "rectangle";
          let cornerRadius = 0;

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
            if (row.property === "Canvas Shape Type" && row.value) {
              shapeType = String(row.value || "rectangle");
            }
            if (row.property === "Corner Radius" && row.value !== undefined) {
              const v = Number(row.value);
              if (!Number.isNaN(v)) cornerRadius = v;
            }
          });

          // Встановлюємо розміри canvas
          if (canvas) {
            canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
            // Використовуємо правильний метод для fabric.js v6+
            canvas.set("backgroundColor", backgroundColor);
            canvas.renderAll();
          }

          // Встановлюємо тип фігури полотна та корнер радіус і відновлюємо форму
          try {
            if (canvas) {
              canvas.set && canvas.set("shapeType", shapeType || "rectangle");
              canvas.set && canvas.set("cornerRadius", cornerRadius || 0);
              // Спроба примусово відновити форму через тулбарну функцію, якщо вона доступна
              const mmFromPx = (px) => Math.round((px * 25.4) / 72);
              const toolbarPayload = {
                currentShapeType: shapeType || "rectangle",
                cornerRadius: cornerRadius || 0,
                sizeValues: {
                  width: mmFromPx(canvasWidth),
                  height: mmFromPx(canvasHeight),
                  cornerRadius: cornerRadius || 0,
                },
                globalColors: {
                  backgroundColor,
                  backgroundType: "solid",
                },
              };
              if (
                typeof window !== "undefined" &&
                typeof window.forceRestoreCanvasShape === "function"
              ) {
                // Невелика затримка, щоб застосовані розміри/фон устаканилися
                setTimeout(() => {
                  try {
                    window.forceRestoreCanvasShape(toolbarPayload);
                  } catch (e) {
                    console.warn("forceRestoreCanvasShape failed", e);
                  }
                  // І одразу синхронізуємо інпуты тулбара з фактичними значеннями canvas
                  try {
                    if (
                      typeof window.syncToolbarSizeFromCanvas === "function"
                    ) {
                      window.syncToolbarSizeFromCanvas();
                    }
                  } catch {}
                }, 50);
              }
            }
          } catch (shapeErr) {
            console.warn(
              "Failed to set shapeType/cornerRadius during Excel import",
              shapeErr
            );
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

          // Допоміжна функція для фільтрації дублюючого фону (великі прямокутники того ж кольору, що й фон)
          const isBackgroundLikeRect = (o) => {
            try {
              if (!o || o.type !== "rect") return false;
              // колір має співпадати з фоном (без урахування регістру)
              const fill = (o.fill || "").toString().trim().toLowerCase();
              const bg = (backgroundColor || "")
                .toString()
                .trim()
                .toLowerCase();
              if (!fill || !bg || fill !== bg) return false;

              // ефективні розміри з урахуванням scale
              const effW = (o.width || 0) * (o.scaleX || 1);
              const effH = (o.height || 0) * (o.scaleY || 1);
              // покриття >= 95% полотна
              const coverW = effW >= canvasWidth * 0.95;
              const coverH = effH >= canvasHeight * 0.95;
              if (!(coverW && coverH)) return false;

              // позиція близько до (0,0) з невеликим відступом
              const near = (v) =>
                Math.abs(v || 0) <= Math.max(canvasWidth, canvasHeight) * 0.02; // 2%
              if (!near(o.left) || !near(o.top)) return false;

              return true;
            } catch {
              return false;
            }
          };

          for (let index = 0; index < objectsData.length; index++) {
            const row = objectsData[index];
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
                continue;
              }

              // Пропускаємо службові бордери, якщо флаг збережено
              if (objData.isBorderShape) {
                console.log("Пропущено isBorderShape під час імпорту", objData);
                continue;
              }

              console.log(
                `Restoring object ${index + 1}:`,
                objData.type,
                objData
              ); // Для діагностики

              // Створюємо об'єкт відповідно до типу
              let fabricObj = null;

              if (objData.isQRCode && objData.qrText) {
                try {
                  const qr = qrGenerator(0, "M");
                  qr.addData(objData.qrText);
                  qr.make();

                  const moduleCount = qr.getModuleCount();
                  const cellSize = 4;
                  const size = moduleCount * cellSize;
                  const foreground =
                    (typeof objData.fill === "string" && objData.fill) ||
                    "#000000";

                  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">`;
                  let pathData = "";
                  for (let rowIdx = 0; rowIdx < moduleCount; rowIdx++) {
                    for (let colIdx = 0; colIdx < moduleCount; colIdx++) {
                      if (qr.isDark(rowIdx, colIdx)) {
                        const x = colIdx * cellSize;
                        const y = rowIdx * cellSize;
                        pathData += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z`;
                      }
                    }
                  }
                  if (pathData) {
                    svg += `<path d="${pathData}" fill="${foreground}" fill-rule="evenodd"/>`;
                  }
                  svg += "</svg>";

                  const result = await fabric.loadSVGFromString(svg);
                  if (result?.objects?.length === 1) {
                    fabricObj = result.objects[0];
                  } else {
                    fabricObj = fabric.util.groupSVGElements(
                      result.objects || [],
                      result.options || {}
                    );
                  }

                  if (fabricObj) {
                    fabricObj.set({
                      left: objData.left || 0,
                      top: objData.top || 0,
                      originX: objData.originX || "center",
                      originY: objData.originY || "center",
                      selectable: true,
                      hasControls: true,
                      hasBorders: true,
                      isQRCode: true,
                      qrText: objData.qrText,
                      backgroundColor: "transparent",
                    });
                  }
                } catch (qrErr) {
                  console.error(
                    "Помилка відновлення QR-коду з Excel:",
                    qrErr,
                    objData
                  );
                }
              } else if (objData.isBarCode && objData.barCodeText) {
                try {
                  const barColor =
                    (typeof objData.barCodeColor === "string" &&
                      objData.barCodeColor) ||
                    (typeof objData.fill === "string" && objData.fill) ||
                    "#000000";
                  const svgEl = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "svg"
                  );
                  JsBarcode(svgEl, objData.barCodeText, {
                    format: objData.barCodeType || "CODE128",
                    width: 2,
                    height: 100,
                    displayValue: false,
                    fontSize: 14,
                    textMargin: 5,
                    margin: 0,
                    background: "transparent",
                    lineColor: barColor,
                  });
                  const serializer = new XMLSerializer();
                  const svgText = serializer.serializeToString(svgEl);

                  const result = await fabric.loadSVGFromString(svgText);
                  if (result?.objects?.length === 1) {
                    fabricObj = result.objects[0];
                  } else {
                    fabricObj = fabric.util.groupSVGElements(
                      result.objects || [],
                      result.options || {}
                    );
                  }

                  if (fabricObj) {
                    fabricObj.set({
                      left: objData.left || 0,
                      top: objData.top || 0,
                      originX: objData.originX || "center",
                      originY: objData.originY || "center",
                      selectable: true,
                      hasControls: true,
                      hasBorders: true,
                      isBarCode: true,
                      barCodeText: objData.barCodeText,
                      barCodeType: objData.barCodeType || "CODE128",
                      fill: barColor,
                      barCodeColor: barColor,
                      suppressBarText:
                        typeof objData.suppressBarText === "boolean"
                          ? objData.suppressBarText
                          : true,
                    });
                  }
                } catch (barErr) {
                  console.error(
                    "Помилка відновлення бар-коду з Excel:",
                    barErr,
                    objData
                  );
                }
              } else {
                switch (objData.type) {
                  case "rect":
                    // Пропускаємо прямокутник, якщо він дуже схожий на дублюючий фон
                    if (isBackgroundLikeRect(objData)) {
                      console.log("Пропущено дублюючий фон (rect)", objData);
                      break;
                    }
                    // Також фільтруємо бордероподобні прямокутники: прозорий fill, великий stroke, покриває майже все полотно
                    const isTransparent =
                      !objData.fill ||
                      objData.fill === "transparent" ||
                      /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/i.test(
                        String(objData.fill)
                      );
                    const effWRect =
                      (objData.width || 0) * (objData.scaleX || 1);
                    const effHRect =
                      (objData.height || 0) * (objData.scaleY || 1);
                    const coversCanvas =
                      effWRect >= canvasWidth * 0.95 &&
                      effHRect >= canvasHeight * 0.95;
                    const strokeIsThick = (objData.strokeWidth || 0) >= 2; // евристика
                    const nearOrigin =
                      Math.abs(objData.left || 0) <=
                        Math.max(canvasWidth, canvasHeight) * 0.02 &&
                      Math.abs(objData.top || 0) <=
                        Math.max(canvasWidth, canvasHeight) * 0.02;
                    if (
                      isTransparent &&
                      objData.stroke &&
                      strokeIsThick &&
                      coversCanvas &&
                      nearOrigin
                    ) {
                      console.log("Пропущено бордероподібний rect", objData);
                      break;
                    }
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
                      rx: typeof objData.rx === "number" ? objData.rx : 0,
                      ry: typeof objData.ry === "number" ? objData.ry : 0,
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
                            opacity:
                              objData.opacity !== undefined
                                ? objData.opacity
                                : 1,
                            originX: objData.originX || "left",
                            originY: objData.originY || "top",
                          });
                          canvas.add(img);
                          canvas.renderAll();
                        })
                        .catch((err) => {
                          console.error(
                            "Помилка завантаження зображення:",
                            err,
                            objData.src
                          );
                        });
                    } else {
                      console.warn("Image object без src пропущено", objData);
                    }
                    break;

                  default:
                    console.warn(`Unknown object type: ${objData.type}`);
                    break;
                }
              }

              // Додаємо об'єкт на canvas (крім зображень, які додаються асинхронно)
              if (fabricObj && canvas) {
                if (!objData.shapeType) {
                  if (objData.type === "rect") {
                    objData.shapeType = "rectangle";
                  } else if (objData.type === "triangle") {
                    objData.shapeType = "triangle";
                  }
                }
                if (objData.shapeType) {
                  fabricObj.shapeType = objData.shapeType;
                }
                if (objData.fromShapeTab) {
                  fabricObj.fromShapeTab = true;
                }
                if (typeof objData.useThemeColor === "boolean") {
                  fabricObj.useThemeColor = objData.useThemeColor;
                }
                if (typeof objData.followThemeStroke === "boolean") {
                  fabricObj.followThemeStroke = objData.followThemeStroke;
                }
                if (
                  typeof objData.barCodeColor === "string" &&
                  objData.barCodeColor &&
                  (fabricObj.isBarCode || objData.isBarCode)
                ) {
                  fabricObj.barCodeColor = objData.barCodeColor;
                }
                if (objData.isBarCode) {
                  fabricObj.isBarCode = true;
                }
                if (typeof objData.baseCornerRadius === "number") {
                  fabricObj.baseCornerRadius = objData.baseCornerRadius;
                }
                if (typeof objData.cornerRadiusMm === "number") {
                  fabricObj.cornerRadiusMm = objData.cornerRadiusMm;
                }
                if (typeof objData.displayCornerRadiusMm === "number") {
                  fabricObj.displayCornerRadiusMm =
                    objData.displayCornerRadiusMm;
                }
                if (typeof objData.cornerRadius === "number") {
                  fabricObj.cornerRadius = objData.cornerRadius;
                }
                if (objData.isCustomEdited) {
                  fabricObj.isCustomEdited = true;
                }
                if (Array.isArray(objData.__baseCustomCorners)) {
                  // Копіюємо масив, щоб зберегти структуру точок для ShapeProperties
                  fabricObj.__baseCustomCorners =
                    objData.__baseCustomCorners.map((pt) =>
                      pt && typeof pt === "object" ? { ...pt } : pt
                    );
                }
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
          }

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

  return { importFromExcel, exportToExcel };
};
