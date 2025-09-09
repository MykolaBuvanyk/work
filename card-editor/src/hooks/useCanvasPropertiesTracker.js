import { useEffect, useRef } from 'react';

/**
 * Хук для відстеження змін властивостей полотна та автоматичного збереження історії
 */
export const useCanvasPropertiesTracker = (canvas, globalColors, saveCanvasPropertiesState, toolbarState = {}) => {
  const previousValuesRef = useRef({});
  const isInitializedRef = useRef(false);
  const timeoutRef = useRef(null);

  // Функція для безпечного збереження з дебаунсом
  const debouncedSave = (description) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (saveCanvasPropertiesState) {
        console.log('🎨 Saving state:', description);
        saveCanvasPropertiesState(description);
      }
    }, 100);
  };

  // Функція для негайного збереження (критичні зміни)
  const immediateSave = (description) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (saveCanvasPropertiesState) {
      console.log('🎨 Immediate save:', description);
      saveCanvasPropertiesState(description);
    }
  };

  // Ініціалізація початкових значень
  useEffect(() => {
    if (!canvas) return;

    if (!isInitializedRef.current) {
      // Ініціалізуємо всі початкові значення
      previousValuesRef.current = {
        width: canvas.width,
        height: canvas.height,
        shapeType: toolbarState.currentShapeType || canvas.currentShapeType,
        cornerRadius: toolbarState.cornerRadius || canvas.cornerRadius || 0,
        thickness: toolbarState.thickness,
        holesType: toolbarState.activeHolesType,
        holesDiameter: toolbarState.holesDiameter,
        hasBorder: toolbarState.hasBorder || false,
        backgroundColor: globalColors?.backgroundColor,
        textColor: globalColors?.textColor,
        backgroundType: globalColors?.backgroundType
      };

      console.log('🔧 Canvas properties tracker initialized');
      isInitializedRef.current = true;
    }
  }, [canvas, globalColors, toolbarState]);

  // Очищення при демонтажі
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Функції для ручного відстеження специфічних змін
  const trackCanvasResize = (newWidth, newHeight) => {
    if (!canvas) return;
    
    console.log('📐 Manual canvas resize tracking:', { width: newWidth, height: newHeight });
    immediateSave(`Canvas resized to ${newWidth}x${newHeight}`);
    
    previousValuesRef.current.width = newWidth;
    previousValuesRef.current.height = newHeight;
  };

  const trackViewportChange = () => {
    if (!canvas) return;
    
    debouncedSave('Viewport changed');
  };

  const trackShapeChange = (shapeType) => {
    if (!canvas) return;
    
    console.log('🔷 Manual shape change tracking:', shapeType);
    immediateSave(`Canvas shape changed to ${shapeType}`);
    
    previousValuesRef.current.shapeType = shapeType;
  };

  const trackElementAdded = (elementType) => {
    if (!canvas) return;
    
    console.log('➕ Element added:', elementType);
    immediateSave(`${elementType} added`);
  };

  const trackColorThemeChange = (changes) => {
    if (!canvas) return;
    
    console.log('🎨 Color theme changed:', changes);
    immediateSave('Color theme changed');
  };

  const trackThicknessChange = (newThickness) => {
    if (!canvas) return;
    
    console.log('📏 Thickness changed:', newThickness);
    immediateSave(`Thickness changed to ${newThickness}mm`);
  };

  const trackHolesChange = (holesType, diameter) => {
    if (!canvas) return;
    
    console.log('🕳️ Holes changed:', { type: holesType, diameter });
    immediateSave(`Holes changed: type ${holesType}, diameter ${diameter}mm`);
  };

  const trackBorderChange = (hasBorder) => {
    if (!canvas) return;
    
    console.log('🖼️ Border changed:', hasBorder);
    immediateSave(`Border ${hasBorder ? 'added' : 'removed'}`);
  };

  return {
    trackCanvasResize,
    trackViewportChange,
    trackShapeChange,
    trackElementAdded,
    trackColorThemeChange,
    trackThicknessChange,
    trackHolesChange,
    trackBorderChange,
    immediateSave,
    debouncedSave
  };
};
