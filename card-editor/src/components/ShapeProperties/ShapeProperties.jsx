import React, { useState, useEffect } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import styles from "./ShapeProperties.module.css";

const ShapeProperties = ({ isOpen: propIsOpen, activeShape: propActiveShape, onClose: propOnClose }) => {
  const { canvas, shapePropertiesOpen, setShapePropertiesOpen } = useCanvasContext();
  
  // Використовуємо пропси якщо вони передані (з ShapeSelector), інакше контекст
  const isOpen = propIsOpen !== undefined ? propIsOpen : shapePropertiesOpen;
  const activeShape = propActiveShape || null;
  const onClose = propOnClose || (() => setShapePropertiesOpen(false));
  
  const [properties, setProperties] = useState({
    width: 0,
    height: 0,
    rotation: 0,
    cornerRadius: 0,
    thickness: 2,
    fill: false,
    cut: false
  });

  const [isManuallyEditing, setIsManuallyEditing] = useState(false);

  const activeObject = activeShape || canvas?.getActiveObject();

  useEffect(() => {
    if (activeObject && (isOpen || shapePropertiesOpen)) {
      // Функція для оновлення властивостей
      const updateProperties = () => {
        // Не оновлюємо якщо користувач зараз редагує вручну
        if (!isManuallyEditing) {
          setProperties({
            width: Math.round(activeObject.getScaledWidth() || 0),
            height: Math.round(activeObject.getScaledHeight() || 0),
            rotation: Math.round(activeObject.angle || 0),
            cornerRadius: 0, // Для Path об'єктів це не застосовується напряму
            thickness: activeObject.strokeWidth || 2,
            fill: activeObject.fill !== 'transparent' && activeObject.fill !== '',
            cut: activeObject.stroke === '#FFA500' // Перевіряємо чи є оранжевий колір
          });
        }
      };

      // Оновлюємо властивості при зміні activeObject
      updateProperties();

      // Додаємо слухачі подій безпосередньо до об'єкта
      if (activeObject.on) {
        const handleObjectModified = () => updateProperties();
        const handleObjectScaling = () => updateProperties();
        const handleObjectRotating = () => updateProperties();
        
        activeObject.on('modified', handleObjectModified);
        activeObject.on('scaling', handleObjectScaling);
        activeObject.on('rotating', handleObjectRotating);

        // Прибираємо слухачі при розмонтуванні
        return () => {
          if (activeObject.off) {
            activeObject.off('modified', handleObjectModified);
            activeObject.off('scaling', handleObjectScaling);
            activeObject.off('rotating', handleObjectRotating);
          }
        };
      }
    }
  }, [activeObject, isOpen, shapePropertiesOpen]);

  // Додатковий useEffect для відстеження змін через canvas
  useEffect(() => {
    if (canvas && activeObject && (isOpen || shapePropertiesOpen)) {
      const updateProperties = () => {
        // Перевіряємо, чи це той самий об'єкт і чи не редагуємо вручну
        const currentActiveObject = canvas.getActiveObject();
        if (currentActiveObject === activeObject && !isManuallyEditing) {
          setProperties({
            width: Math.round(activeObject.getScaledWidth() || 0),
            height: Math.round(activeObject.getScaledHeight() || 0),
            rotation: Math.round(activeObject.angle || 0),
            cornerRadius: 0,
            thickness: activeObject.strokeWidth || 2,
            fill: activeObject.fill !== 'transparent' && activeObject.fill !== '',
            cut: activeObject.stroke === '#FFA500'
          });
        }
      };

      // Слухачі подій canvas
      canvas.on('object:modified', updateProperties);
      canvas.on('object:scaling', updateProperties);
      canvas.on('object:rotating', updateProperties);
      canvas.on('object:moving', updateProperties);
      
      // Реал-тайм оновлення під час трансформації
      canvas.on('object:scaling', updateProperties);
      canvas.on('object:rotating', updateProperties);
      
      // Додаткові події для більш точного відстеження
      canvas.on('after:render', () => {
        const currentActiveObject = canvas.getActiveObject();
        if (currentActiveObject === activeObject) {
          // Обмежуємо частоту оновлень
          clearTimeout(updateProperties.timeout);
          updateProperties.timeout = setTimeout(updateProperties, 50);
        }
      });

      return () => {
        canvas.off('object:modified', updateProperties);
        canvas.off('object:scaling', updateProperties);
        canvas.off('object:rotating', updateProperties);
        canvas.off('object:moving', updateProperties);
        canvas.off('after:render', updateProperties);
        clearTimeout(updateProperties.timeout);
      };
    }
  }, [canvas, activeObject, isOpen, shapePropertiesOpen]);

  const updateProperty = (property, value) => {
    if (!activeObject) return;

    setIsManuallyEditing(true);
    setProperties(prev => ({ ...prev, [property]: value }));

    switch (property) {
      case 'width':
        const currentWidth = activeObject.getScaledWidth();
        const widthScale = value / currentWidth;
        activeObject.scaleX = activeObject.scaleX * widthScale;
        break;
      
      case 'height':
        const currentHeight = activeObject.getScaledHeight();
        const heightScale = value / currentHeight;
        activeObject.scaleY = activeObject.scaleY * heightScale;
        break;
      
      case 'rotation':
        activeObject.set('angle', value);
        break;
      
      case 'thickness':
        activeObject.set('strokeWidth', value);
        break;
      
      case 'fill':
        if (value) {
          // Заповнити фігуру кольором stroke або чорним, якщо cut активний то оранжевим
          const fillColor = properties.cut ? '#FFA500' : (activeObject.stroke || '#000000');
          activeObject.set('fill', fillColor);
        } else {
          activeObject.set('fill', 'transparent');
        }
        break;
      
      case 'cut':
        if (value) {
          // Заповнити контур оранжевим кольором
          activeObject.set('stroke', '#FFA500');
          // Якщо fill також активний, то fill теж оранжевий
          if (properties.fill) {
            activeObject.set('fill', '#FFA500');
          }
        } else {
          // Повернути до звичайного чорного кольору
          activeObject.set('stroke', '#000000');
          if (properties.fill) {
            activeObject.set('fill', '#000000');
          }
        }
        break;
    }

    canvas.renderAll();
    
    // Знімаємо флаг ручного редагування через невеликий таймаут
    setTimeout(() => setIsManuallyEditing(false), 100);
  };

  const incrementValue = (property, increment = 1) => {
    setIsManuallyEditing(true);
    const currentValue = properties[property];
    const newValue = currentValue + increment;
    updateProperty(property, newValue);
  };

  const decrementValue = (property, decrement = 1) => {
    setIsManuallyEditing(true);
    const currentValue = properties[property];
    let newValue;
    
    if (property === 'rotation') {
      // Для rotation дозволяємо від'ємні значення
      newValue = currentValue - decrement;
    } else {
      // Для інших властивостей не дозволяємо від'ємні значення
      newValue = Math.max(0, currentValue - decrement);
    }
    
    updateProperty(property, newValue);
  };

  if (!isOpen || !activeObject || activeObject.type !== 'path') return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.titleWrapper}>
          <h3 className={styles.title}>Shape</h3>
          <button
            className={styles.closeIcon}
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12.0003 12L14.8287 14.8284M9.17188 14.8284L12.0003 12L9.17188 14.8284ZM14.8287 9.17157L12.0003 12L14.8287 9.17157ZM12.0003 12L9.17188 9.17157L12.0003 12Z"
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
        <div className={styles.propertyGroup}>
          <label className={styles.label}>
            Width:
            <div className={styles.inputGroup}>
              <input 
                type="number" 
                className={styles.input} 
                value={properties.width}
                onChange={(e) => updateProperty('width', parseInt(e.target.value) || 0)}
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={() => setTimeout(() => setIsManuallyEditing(false), 100)}
              />
              <div className={styles.arrows}>
                <i 
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue('width', 5)}
                ></i>
                <i 
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue('width', 5)}
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Rotate:
            <div className={styles.inputGroup}>
              <input 
                type="number" 
                className={styles.input} 
                value={properties.rotation}
                onChange={(e) => updateProperty('rotation', parseInt(e.target.value) || 0)}
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={() => setTimeout(() => setIsManuallyEditing(false), 100)}
              />
              <div className={styles.arrows}>
                <i 
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue('rotation', 15)}
                ></i>
                <i 
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue('rotation', 15)}
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Height:
            <div className={styles.inputGroup}>
              <input 
                type="number" 
                className={styles.input} 
                value={properties.height}
                onChange={(e) => updateProperty('height', parseInt(e.target.value) || 0)}
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={() => setTimeout(() => setIsManuallyEditing(false), 100)}
              />
              <div className={styles.arrows}>
                <i 
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue('height', 5)}
                ></i>
                <i 
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue('height', 5)}
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Corner Radius:
            <div className={styles.inputGroup}>
              <input 
                type="number" 
                className={styles.input} 
                value={properties.cornerRadius}
                onChange={(e) => updateProperty('cornerRadius', parseInt(e.target.value) || 0)}
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={() => setTimeout(() => setIsManuallyEditing(false), 100)}
              />
              <div className={styles.arrows}>
                <i 
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue('cornerRadius')}
                ></i>
                <i 
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue('cornerRadius')}
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Thickness:
            <div className={styles.inputGroup}>
              <input 
                type="number" 
                className={styles.input} 
                value={properties.thickness}
                onChange={(e) => updateProperty('thickness', parseInt(e.target.value) || 1)}
                onFocus={() => setIsManuallyEditing(true)}
                onBlur={() => setTimeout(() => setIsManuallyEditing(false), 100)}
              />
              <div className={styles.arrows}>
                <i 
                  className="fa-solid fa-chevron-up"
                  onClick={() => incrementValue('thickness')}
                ></i>
                <i 
                  className="fa-solid fa-chevron-down"
                  onClick={() => decrementValue('thickness')}
                ></i>
              </div>
            </div>
          </label>
          <label className={styles.cutFillWrapper}>
            <div className={styles.cutFillWrapperEl}>
              Fill
              <input 
                type="checkbox" 
                checked={properties.fill}
                onChange={(e) => updateProperty('fill', e.target.checked)}
              />
            </div>
            <div className={styles.cutFillWrapperEl}>
              Cut
              <input 
                type="checkbox" 
                checked={properties.cut}
                onChange={(e) => updateProperty('cut', e.target.checked)}
              />
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default ShapeProperties;
