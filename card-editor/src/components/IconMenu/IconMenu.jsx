import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import * as fabric from "fabric";
import styles from "./IconMenu.module.css";
import { fitObjectToCanvas } from "../../utils/canvasFit";

const IconMenu = ({ isOpen, onClose }) => {
  const { canvas, globalColors } = useCanvasContext();
  const [selectedCategory, setSelectedCategory] = useState("Animals");
  const [isLoading, setIsLoading] = useState(false);
  const [availableIcons, setAvailableIcons] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const dropdownRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
    "Building",
    "Celebrations",
    "Chapter_Calendar",
    "Children",
    "Electronics",
    "Emoji",
    "Fire_Safety",
    "First_Aid",
    "Food",
    "Frames",
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

  const allIcons = {
    Animals: Array.from({ length: 43 }, (_, i) => i === 27 ? null : `Animals_${i}.svg`).filter(Boolean),
    Arrows: Array.from({ length: 7 }, (_, i) => `Arrows_${i}.svg`),
    Basic_Shapes: Array.from({ length: 20 }, (_, i) => `Basic_Shapes_${i}.svg`),
    Building: ["building_1.svg", "building_2.svg", "building_3.svg", "building_4.svg", "building_5.svg", "building_6.svg", "building_7.svg"],
    Celebrations: Array.from({ length: 50 }, (_, i) => `Celebrations_${i}.svg`),
    Chapter_Calendar: ["Chapter_Calendar_2.svg", "Chapter_Calendar_3.svg", "Chapter_Calendar_4.svg", "Chapter_Calendar_5.svg", "Chapter_Calendar_6.svg"],
    Children: Array.from({ length: 11 }, (_, i) => `Children_${i}.svg`),
    Electronics: Array.from({ length: 34 }, (_, i) => `Electronics_${i}.svg`),
    Emoji: Array.from({ length: 50 }, (_, i) => `Emoji_${i}.svg`),
    Fire_Safety: Array.from({ length: 17 }, (_, i) => `Fire_Safety_${i}.svg`),
    First_Aid: Array.from({ length: 33 }, (_, i) => `First_Aid_${i}.svg`),
    Food: Array.from({ length: 50 }, (_, i) => `Food_${i}.svg`),
    Frames: ["frame_1.svg", "frames_2.svg", "frames_3.svg", "frames_4.svg", "frames_5.svg", "frames_6.svg", "frames_7.svg", "frames_8.svg", "frames_9.svg", "frames_12.svg", "frames_13.svg", "frames_14.svg", "frames_15.svg", "frames_16.svg", "frames_17.svg", "frames_18.svg", "frames_19.svg", "frames_20.svg", "frames_22.svg", "frames_23.svg", "frames_24.svg", "frames_26.svg", "frames_27.svg", "frames_28.svg", "frames_29.svg", "frames_30.svg", "frames_31.svg", "frames_32.svg", "frames_33.svg", "frames_34.svg", "frames_35.svg", "frames_36.svg", "frames_37.svg", "frames_38.svg", "frames_39.svg", "frames_40.svg", "frames_41.svg", "frames_42.svg", "frames_43.svg", "frames_44.svg", "frames_45.svg", "frames_46.svg", "frames_47.svg", "frames_48.svg", "frames_49.svg"],
    Horoscope: Array.from({ length: 12 }, (_, i) => `Horoscope_${i + 1}.svg`),
    Mandatory: Array.from({ length: 34 }, (_, i) => `Mandatory_${i}.svg`),
    Maritime: Array.from({ length: 20 }, (_, i) => `Maritime_${i + 1}.svg`),
    Nature: Array.from({ length: 50 }, (_, i) => `Nature_${i}.svg`),
    People: Array.from({ length: 44 }, (_, i) => `People_${i}.svg`),
    Prohibition: Array.from({ length: 5 }, (_, i) => `Prohibition_${i}.svg`),
    Tools: Array.from({ length: 50 }, (_, i) => `Tools_${i}.svg`),
    Transport: Array.from({ length: 22 }, (_, i) => `Transport_${i}.svg`),
    Warning: ["Warning_0.svg", "Warning_1.svg", "Warning_2.svg", "Warning_3.svg", "Warning_4.svg", "Warning_5.svg", "Warning_6.svg", "Warning_7.svg", "Warning_8.svg", "Warning_9.svg", "Warning_10.svg", "Warning_11.svg", "Warning_12.svg", "Warning_13.svg", "Warning_14.svg", "Warning_15.svg", "Warning_16.svg", "Warning_17.svg", "Warning_18.svg", "Warning_19.svg", "Warning_20.svg", "Warning_21.svg", "Warning_22.svg", "Warning_23.svg", "Warning_24.svg", "Warning_25.svg", "Warning_26.svg", "Warning_27.svg", "Warning_28.svg", "Warning_29.svg", "Warning_30.svg", "Warning_31.svg", "Warning_32.svg", "Warning_33.svg", "Warning_34.svg", "Warning_35.svg", "Warning_36.svg", "Warning_37.svg", "Warning_38.svg", "Warning_39.svg", "Warning_40.svg", "Warning_41.svg", "Warning_42.svg", "Warning_43.svg", "Warning_44.svg", "Warning_45.svg", "Warning_46.svg", "Warning_47.svg"],
    Work_and_School: Array.from({ length: 19 }, (_, i) => `Work_and_School_${i}.svg`),
  };

  // Функція для форматування назв категорій для відображення
  const formatCategoryName = (category) => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Функція для переключення розгортання категорії
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Просто використовуємо всі іконки без перевірки доступності
  useEffect(() => {
    setAvailableIcons(allIcons);
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
            globalColors.textColor &&
            globalColors.textColor !== "transparent"
          ) {
            obj.set({
              fill: globalColors.textColor,
              stroke: globalColors.textColor,
            });
          }
        }
      };

      applyColorsToObject(svgObject);

      // Позначаємо, що об'єкт має слідувати кольору теми
      try {
        svgObject.set && svgObject.set({ useThemeColor: true });
        if (
          svgObject.type === "group" &&
          typeof svgObject.forEachObject === "function"
        ) {
          svgObject.forEachObject((child) => {
            try {
              child.set && child.set({ useThemeColor: true });
            } catch {}
          });
        }
      } catch {}

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

      try {
        fitObjectToCanvas(canvas, svgObject, { maxRatio: 0.6 });
      } catch {}
      return svgObject;
    } catch (error) {
      throw new Error(`Не вдалося розпарсити SVG: ${error.message}`);
    }
  };

  const createImageFromSVG = async (svgText, iconName) => {
    // Застосовуємо глобальні кольори до SVG тексту перед створенням зображення
    let modifiedSvgText = svgText;
    if (globalColors.textColor && globalColors.textColor !== "transparent") {
      modifiedSvgText = svgText
        .replace(/fill="[^"]*"/g, `fill="${globalColors.textColor}"`)
        .replace(/stroke="[^"]*"/g, `stroke="${globalColors.textColor}"`);

      // Додаємо стилі до SVG, якщо їх немає
      if (
        !modifiedSvgText.includes("fill=") &&
        !modifiedSvgText.includes("style=")
      ) {
        modifiedSvgText = modifiedSvgText.replace(
          /<svg([^>]*)>/,
          `<svg$1 fill="${globalColors.textColor}">`
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
            try {
              fitObjectToCanvas(canvas, imgObj, { maxRatio: 0.6 });
            } catch {}
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
    // Закриваємо модалку одразу після вибору іконки
    try {
      if (typeof onClose === "function") onClose();
    } catch {}
    if (mountedRef.current) setIsLoading(true);
    try {
      const response = await fetch(`/images/icon/${iconName}`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const svgText = await response.text();
      try {
        const svgObject = await createSVGFromText(svgText, iconName);
        try {
          svgObject.set && svgObject.set({ fromIconMenu: true });
        } catch {}
        canvas.add(svgObject);
        try {
          fitObjectToCanvas(canvas, svgObject, { maxRatio: 0.6 });
        } catch {}
        try {
          if (typeof svgObject.setCoords === "function") svgObject.setCoords();
        } catch {}
        try {
          canvas.setActiveObject(svgObject);
        } catch {}
        try {
          canvas.requestRenderAll();
        } catch {}
        try {
          requestAnimationFrame(() => {
            try {
              if (!canvas || !svgObject) return;
              canvas.setActiveObject(svgObject);
              if (typeof svgObject.setCoords === "function")
                svgObject.setCoords();
              canvas.requestRenderAll();
            } catch {}
          });
        } catch {}
      } catch (svgError) {
        console.warn(`SVG error for ${iconName}:`, svgError);
        const imageObject = await createImageFromSVG(svgText, iconName);
        try {
          imageObject.set && imageObject.set({ fromIconMenu: true });
        } catch {}
        canvas.add(imageObject);
        try {
          fitObjectToCanvas(canvas, imageObject, { maxRatio: 0.6 });
        } catch {}
        try {
          if (typeof imageObject.setCoords === "function")
            imageObject.setCoords();
        } catch {}
        try {
          canvas.setActiveObject(imageObject);
        } catch {}
        try {
          canvas.requestRenderAll();
        } catch {}
        try {
          requestAnimationFrame(() => {
            try {
              if (!canvas || !imageObject) return;
              canvas.setActiveObject(imageObject);
              if (typeof imageObject.setCoords === "function")
                imageObject.setCoords();
              canvas.requestRenderAll();
            } catch {}
          });
        } catch {}
      }
    } catch (error) {
      console.error(`Error loading ${iconName}:`, error);
      createPlaceholder(iconName);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  };

  const createPlaceholder = (iconName) => {
    const fillColor =
      globalColors.textColor && globalColors.textColor !== "transparent"
        ? globalColors.textColor
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
    try {
      group.set && group.set({ fromIconMenu: true, useThemeColor: true });
      rect.set && rect.set({ useThemeColor: true });
      text.set && text.set({ useThemeColor: true });
    } catch {}

    try {
      fitObjectToCanvas(canvas, group, { maxRatio: 0.6 });
    } catch {}

    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
  };

  const getPreviewUrl = (iconName) => `/images/icon/${iconName}`;

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
        <div className={styles.categoriesContainer}>
          {categories.map((category) => (
            <div key={category} className={styles.categorySection}>
              <div 
                className={styles.categoryHeader}
                onClick={() => toggleCategory(category)}
              >
                <span className={styles.categoryName}>
                  {formatCategoryName(category)} ({availableIcons[category]?.length || 0})
                </span>
                <span className={`${styles.categoryArrow} ${expandedCategories[category] ? styles.expanded : ''}`}>
                  ▼
                </span>
              </div>
              {expandedCategories[category] && (
                <div className={styles.iconGrid}>
                  {(availableIcons[category] || []).map((icon) => (
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
                          <span>{icon.split(".")[0].replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                      <span className={styles.iconName}>
                        {icon.replace(".svg", "").replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {expandedCategories[category] && (!availableIcons[category] || availableIcons[category].length === 0) && (
                <div className={styles.noIcons}>
                  Іконки в цій категорії недоступні
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IconMenu;
