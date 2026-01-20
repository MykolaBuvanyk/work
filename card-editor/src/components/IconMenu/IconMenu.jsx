import React, { useState, useEffect, useRef } from 'react';
import { useCanvasContext } from '../../contexts/CanvasContext';
import * as fabric from 'fabric';
import styles from './IconMenu.module.css';
import { fitObjectToCanvas } from '../../utils/canvasFit';
import axios from 'axios';

const IconMenu = ({ isOpen, onClose }) => {
  const { canvas, globalColors } = useCanvasContext();
  const [selectedCategory, setSelectedCategory] = useState('Animals');
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
    const handleOutside = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        if (typeof onClose === 'function') onClose();
      }
    };
    document.addEventListener('mousedown', handleOutside, true);
    document.addEventListener('touchstart', handleOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside, true);
      document.removeEventListener('touchstart', handleOutside, true);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Завантажуємо JSON з вашого сервера
        const response = await fetch(`${import.meta.env.VITE_LAYOUT_API_SERVER}icons/get`);
        const data = await response.json();
        console.log(9423432443243, data);
        setAvailableIcons(data);
      } catch (err) {
        console.error('Помилка завантаження конфігу:', err);
      }
    };

    fetchConfig();
  }, []);

  // Категорії беремо прямо з ключів завантаженого JSON
  const categories = Object.keys(availableIcons).sort();

  // Функція для форматування назв категорій для відображення
  const formatCategoryName = category => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Функція для переключення розгортання категорії
  const toggleCategory = category => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const createSVGFromText = async (svgText, iconName) => {
    try {
      const result = await fabric.loadSVGFromString(svgText);
      let svgObject;
      if (result.objects.length === 1) {
        svgObject = result.objects[0];
      } else {
        svgObject = fabric.util.groupSVGElements(result.objects, result.options);
      }

      // Застосовуємо глобальні кольори до SVG об'єкта
      const applyColorsToObject = obj => {
        if (obj.type === 'group') {
          obj.forEachObject(applyColorsToObject);
        } else {
          if (globalColors.textColor && globalColors.textColor !== 'transparent') {
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
        if (svgObject.type === 'group' && typeof svgObject.forEachObject === 'function') {
          svgObject.forEachObject(child => {
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
        originX: 'center',
        originY: 'center',
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
    if (globalColors.textColor && globalColors.textColor !== 'transparent') {
      modifiedSvgText = svgText
        .replace(/fill="[^"]*"/g, `fill="${globalColors.textColor}"`)
        .replace(/stroke="[^"]*"/g, `stroke="${globalColors.textColor}"`);

      // Додаємо стилі до SVG, якщо їх немає
      if (!modifiedSvgText.includes('fill=') && !modifiedSvgText.includes('style=')) {
        modifiedSvgText = modifiedSvgText.replace(
          /<svg([^>]*)>/,
          `<svg$1 fill="${globalColors.textColor}">`
        );
      }
    }

    const blob = new Blob([modifiedSvgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas2D = document.createElement('canvas');
        const ctx = canvas2D.getContext('2d');
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
          imgObj => {
            imgObj.set({
              left: canvas.getWidth() / 2,
              top: canvas.getHeight() / 2,
              originX: 'center',
              originY: 'center',
            });
            try {
              fitObjectToCanvas(canvas, imgObj, { maxRatio: 0.6 });
            } catch {}
            resolve(imgObj);
          },
          { crossOrigin: 'anonymous' }
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Не вдалося завантажити зображення'));
      };
      img.src = url;
    });
  };

  const addIcon = async iconName => {
    if (!canvas) return;
    // Закриваємо модалку одразу після вибору іконки
    try {
      if (typeof onClose === 'function') onClose();
    } catch {}
    if (mountedRef.current) setIsLoading(true);
    try {
      const svgText = await getPreviewUrl(iconName);

      //const svgText = await response.text();
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
          if (typeof svgObject.setCoords === 'function') svgObject.setCoords();
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
              if (typeof svgObject.setCoords === 'function') svgObject.setCoords();
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
          if (typeof imageObject.setCoords === 'function') imageObject.setCoords();
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
              if (typeof imageObject.setCoords === 'function') imageObject.setCoords();
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

  const createPlaceholder = iconName => {
    const fillColor =
      globalColors.textColor && globalColors.textColor !== 'transparent'
        ? globalColors.textColor
        : '#6c757d';

    const rect = new fabric.Rect({
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      width: 80,
      height: 80,
      fill: '#f8f9fa',
      stroke: fillColor,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      rx: 8,
      ry: 8,
    });

    const text = new fabric.Text(iconName.replace('.svg', ''), {
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      fontSize: 12,
      fill: fillColor,
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
    });

    const group = new fabric.Group([rect, text], {
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      originX: 'center',
      originY: 'center',
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

  const getPreviewUrl = async iconName => {
    try {
      const res = await fetch(`${import.meta.env.VITE_LAYOUT_SERVER}images/icon/${iconName}`);
      if (!res.ok) throw new Error('Файл не знайдено');

      // SVG — це текстовий формат, тому беремо .text()
      const svgCode = await res.text();
      return svgCode;
    } catch (err) {
      console.error('Помилка завантаження SVG:', err);
    }
  };

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
          {categories.map(category => (
            <div key={category} className={styles.categorySection}>
              <div className={styles.categoryHeader} onClick={() => toggleCategory(category)}>
                <span className={styles.categoryName}>
                  {formatCategoryName(category)} ({availableIcons[category]?.length || 0})
                </span>
                <span
                  className={`${styles.categoryArrow} ${expandedCategories[category] ? styles.expanded : ''}`}
                >
                  ▼
                </span>
              </div>
              {expandedCategories[category] && (
                <div className={styles.iconGrid}>
                  {(availableIcons[category] || []).map(icon => (
                    <div
                      key={icon}
                      className={styles.iconItem}
                      onClick={() => addIcon(icon)}
                      title={icon}
                    >
                      <div className={styles.iconPreview}>
                        <img
                          src={`${import.meta.env.VITE_LAYOUT_SERVER}images/icon/${icon}`}
                          alt={icon}
                          onError={e => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className={styles.iconPlaceholder}>
                          <span>{icon.split('.')[0].replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                      <span className={styles.iconName}>
                        {icon
                          .replace('.svg', '')
                          .replace(/_/g, ' ')
                          .split(' ')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {expandedCategories[category] &&
                (!availableIcons[category] || availableIcons[category].length === 0) && (
                  <div className={styles.noIcons}>Іконки в цій категорії недоступні</div>
                )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IconMenu;
