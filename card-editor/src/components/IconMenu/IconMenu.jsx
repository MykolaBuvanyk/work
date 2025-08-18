import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import styles from "./IconMenu.module.css";

const IconMenu = ({ isOpen, onClose }) => {
  const { canvas, globalColors } = useCanvasContext();
  const [selectedCategory, setSelectedCategory] = useState("Animals");
  const [isLoading, setIsLoading] = useState(false);
  const [availableIcons, setAvailableIcons] = useState({});
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

  const categories = [
    "Animals",
    "Arrows",
    "Basic_Shapes",
    "building",
    "Celebrations",
    "Chapter_Calendar",
    "Children",
    "Electronics",
    "Emoji",
    "Fire_Safety",
    "First_Aid",
    "Food",
    "frame",
    "frames",
    "Horoscope",
    "Mandatory",
    "Maritime",
    "Nature",
    "People",
    "Prohibition",
    "Tools",
    "Transport",
    "Warning",
    "Work_and_School",
  ];

  const potentialIcons = {
    Animals: Array.from({ length: 43 }, (_, i) => `Animals_${i}.svg`),
    Arrows: Array.from({ length: 7 }, (_, i) => `Arrows_${i}.svg`),
    Basic_Shapes: Array.from({ length: 20 }, (_, i) => `Basic_Shapes_${i}.svg`),
    building: Array.from({ length: 8 }, (_, i) => `building_${i + 1}.svg`),
    Celebrations: Array.from({ length: 50 }, (_, i) => `Celebrations_${i}.svg`),
    Chapter_Calendar: Array.from(
      { length: 5 },
      (_, i) => `Chapter_Calendar_${i + 2}.svg`
    ),
    Children: Array.from({ length: 11 }, (_, i) => `Children_${i}.svg`),
    Electronics: Array.from({ length: 34 }, (_, i) => `Electronics_${i}.svg`),
    Emoji: Array.from({ length: 50 }, (_, i) => `Emoji_${i}.svg`),
    Fire_Safety: Array.from({ length: 17 }, (_, i) => `Fire_Safety_${i}.svg`),
    First_Aid: Array.from({ length: 33 }, (_, i) => `First_Aid_${i}.svg`),
    Food: Array.from({ length: 50 }, (_, i) => `Food_${i}.svg`),
    frame: ["frame_1.svg"],
    frames: Array.from({ length: 49 }, (_, i) => `frames_${i + 1}.svg`).filter(
      (n) =>
        !["frames_10", "frames_11", "frames_21", "frames_25"].some((m) =>
          n.includes(m)
        )
    ),
    Horoscope: Array.from({ length: 12 }, (_, i) => `Horoscope_${i + 1}.svg`),
    Mandatory: Array.from({ length: 34 }, (_, i) => `Mandatory_${i}.svg`),
    Maritime: Array.from({ length: 20 }, (_, i) => `Maritime_${i + 1}.svg`),
    Nature: Array.from({ length: 50 }, (_, i) => `Nature_${i}.svg`),
    People: Array.from({ length: 44 }, (_, i) => `People_${i}.svg`),
    Prohibition: Array.from({ length: 5 }, (_, i) => `Prohibition_${i}.svg`),
    Tools: Array.from({ length: 50 }, (_, i) => `Tools_${i}.svg`),
    Transport: Array.from({ length: 22 }, (_, i) => `Transport_${i}.svg`),
    Warning: Array.from({ length: 47 }, (_, i) => `Warning_${i}.svg`),
    Work_and_School: Array.from(
      { length: 19 },
      (_, i) => `Work_and_School_${i}.svg`
    ),
  };

  useEffect(() => {
    const checkAvailableIcons = async () => {
      const available = {};
      for (const [category, icons] of Object.entries(potentialIcons)) {
        available[category] = [];
        for (const icon of icons) {
          try {
            const response = await fetch(`/src/assets/images/icon/${icon}`);
            if (response.ok) available[category].push(icon);
          } catch (error) {
            console.warn(`Іконка ${icon} недоступна:`, error);
          }
        }
      }
      setAvailableIcons(available);
    };
    checkAvailableIcons();
  }, []);

  const createSVGFromText = async (svgText, iconName) => {
    try {
      const result = await fabric.loadSVGFromString(svgText);
      let svgObject;
      if (result.objects.length === 1) {
        svgObject = result.objects[0];
      } else {
        svgObject = fabric.util.groupSVGElements(
          result.objects,
          result.options
        );
      }

      // Застосовуємо глобальні кольори до SVG об'єкта
      const applyColorsToObject = (obj) => {
        if (obj.type === "group") {
          obj.forEachObject(applyColorsToObject);
        } else {
          if (
            globalColors.strokeColor &&
            globalColors.strokeColor !== "transparent"
          ) {
            obj.set({
              fill: globalColors.strokeColor,
              stroke: globalColors.strokeColor,
            });
          }
        }
      };

      applyColorsToObject(svgObject);

      const bounds = svgObject.getBoundingRect
        ? svgObject.getBoundingRect()
        : { width: 100, height: 100 };
      const scale = 80 / Math.max(bounds.width, bounds.height);
      svgObject.set({
        left: canvas.getWidth() / 2,
        top: canvas.getHeight() / 2,
        originX: "center",
        originY: "center",
        scaleX: scale,
        scaleY: scale,
      });
      return svgObject;
    } catch (error) {
      throw new Error(`Не вдалося розпарсити SVG: ${error.message}`);
    }
  };

  const createImageFromSVG = async (svgText, iconName) => {
    // Застосовуємо глобальні кольори до SVG тексту перед створенням зображення
    let modifiedSvgText = svgText;
    if (
      globalColors.strokeColor &&
      globalColors.strokeColor !== "transparent"
    ) {
      modifiedSvgText = svgText
        .replace(/fill="[^"]*"/g, `fill="${globalColors.strokeColor}"`)
        .replace(/stroke="[^"]*"/g, `stroke="${globalColors.strokeColor}"`);

      // Додаємо стилі до SVG, якщо їх немає
      if (
        !modifiedSvgText.includes("fill=") &&
        !modifiedSvgText.includes("style=")
      ) {
        modifiedSvgText = modifiedSvgText.replace(
          /<svg([^>]*)>/,
          `<svg$1 fill="${globalColors.strokeColor}">`
        );
      }
    }

    const blob = new Blob([modifiedSvgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas2D = document.createElement("canvas");
        const ctx = canvas2D.getContext("2d");
        canvas2D.width = canvas2D.height = 80;
        const scale = Math.min(80 / img.width, 80 / img.height);
        ctx.drawImage(
          img,
          (80 - img.width * scale) / 2,
          (80 - img.height * scale) / 2,
          img.width * scale,
          img.height * scale
        );
        URL.revokeObjectURL(url);
        fabric.Image.fromURL(
          canvas2D.toDataURL(),
          (imgObj) => {
            imgObj.set({
              left: canvas.getWidth() / 2,
              top: canvas.getHeight() / 2,
              originX: "center",
              originY: "center",
            });
            resolve(imgObj);
          },
          { crossOrigin: "anonymous" }
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Не вдалося завантажити зображення"));
      };
      img.src = url;
    });
  };

  const addIcon = async (iconName) => {
    if (!canvas) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/src/assets/images/icon/${iconName}`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const svgText = await response.text();
      try {
        const svgObject = await createSVGFromText(svgText, iconName);
        canvas.add(svgObject);
        canvas.setActiveObject(svgObject);
        canvas.renderAll();
      } catch (svgError) {
        console.warn(`SVG error for ${iconName}:`, svgError);
        const imageObject = await createImageFromSVG(svgText, iconName);
        canvas.add(imageObject);
        canvas.setActiveObject(imageObject);
        canvas.renderAll();
      }
    } catch (error) {
      console.error(`Error loading ${iconName}:`, error);
      createPlaceholder(iconName);
    } finally {
      setIsLoading(false);
      onClose(); // Використовуємо пропс onClose замість setIsOpen(false)
    }
  };

  const createPlaceholder = (iconName) => {
    const fillColor =
      globalColors.strokeColor && globalColors.strokeColor !== "transparent"
        ? globalColors.strokeColor
        : "#6c757d";

    const rect = new fabric.Rect({
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      width: 80,
      height: 80,
      fill: "#f8f9fa",
      stroke: fillColor,
      strokeWidth: 2,
      originX: "center",
      originY: "center",
      rx: 8,
      ry: 8,
    });

    const text = new fabric.Text(iconName.replace(".svg", ""), {
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      fontSize: 12,
      fill: fillColor,
      textAlign: "center",
      originX: "center",
      originY: "center",
    });

    const group = new fabric.Group([rect, text], {
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      originX: "center",
      originY: "center",
    });

    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
  };

  const getPreviewUrl = (iconName) => `/src/assets/images/icon/${iconName}`;

  if (!isOpen) return null;

  return (
    <div className={styles.iconMenu}>
      <div className={styles.dropdown} ref={dropdownRef}>
        <div className={styles.header}>
          <h3>Виберіть іконку</h3>
          <button className={styles.closeButton} onClick={onClose}>
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
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className={styles.categorySelect}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category} ({availableIcons[category]?.length || 0})
            </option>
          ))}
        </select>
        <div className={styles.iconGrid}>
          {(availableIcons[selectedCategory] || []).map((icon) => (
            <div
              key={icon}
              className={styles.iconItem}
              onClick={() => addIcon(icon)}
              title={icon}
            >
              <div className={styles.iconPreview}>
                <img
                  src={getPreviewUrl(icon)}
                  alt={icon}
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex";
                  }}
                />
                <div className={styles.iconPlaceholder}>
                  <span>{icon.split(".")[0]}</span>
                </div>
              </div>
              <span className={styles.iconName}>
                {icon.replace(".svg", "")}
              </span>
            </div>
          ))}
        </div>
        {(!availableIcons[selectedCategory] ||
          availableIcons[selectedCategory].length === 0) && (
          <div className={styles.noIcons}>
            Іконки в цій категорії недоступні
          </div>
        )}
      </div>
    </div>
  );
};

export default IconMenu;
