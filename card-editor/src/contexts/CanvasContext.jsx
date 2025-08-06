import { createContext, useContext, useState } from 'react';

const CanvasContext = createContext();

export const CanvasProvider = ({ children }) => {
  const [canvas, setCanvas] = useState(null);
  const [activeObject, setActiveObject] = useState(null);
  const [shapePropertiesOpen, setShapePropertiesOpen] = useState(false);
  
  // Глобальні налаштування кольорів
  const [globalColors, setGlobalColors] = useState({
    textColor: '#000000',
    backgroundColor: '#FFFFFF',
    strokeColor: '#000000',
    fillColor: 'transparent',
    backgroundType: 'solid' // 'solid', 'gradient', 'texture'
  });

  // Функція для оновлення глобальних кольорів
  const updateGlobalColors = (newColors) => {
    setGlobalColors(prev => ({ ...prev, ...newColors }));
  };

  return (
    <CanvasContext.Provider value={{ 
      canvas, 
      setCanvas, 
      activeObject, 
      setActiveObject,
      shapePropertiesOpen,
      setShapePropertiesOpen,
      globalColors,
      updateGlobalColors
    }}>
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvasContext = () => useContext(CanvasContext);