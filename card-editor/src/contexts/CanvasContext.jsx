import { createContext, useCallback, useContext, useState } from "react";

const CanvasContext = createContext();

export const CanvasProvider = ({ children }) => {
  const [canvas, setCanvas] = useState(null);
  const [activeObject, setActiveObject] = useState(null);
  const [shapePropertiesOpen, setShapePropertiesOpen] = useState(false);
  // Глобальний стан: режим кастомної фігури (редагування вершин)
  const [isCustomShapeMode, setIsCustomShapeMode] = useState(false);
  const [canvasShapeType, setCanvasShapeType] = useState("rectangle");

  // Набір дизайнів (полотен) та активне полотно
  const [designs, setDesigns] = useState([]);
  const [currentDesignId, setCurrentDesignId] = useState(null);

  // Глобальні налаштування кольорів
  const [globalColors, setGlobalColors] = useState({
    textColor: "#000000",
    backgroundColor: "#FFFFFF",
    strokeColor: "#000000",
    fillColor: "transparent",
    backgroundType: "solid", // 'solid', 'gradient', 'texture'
  });

  // Функція для оновлення глобальних кольорів
  const updateGlobalColors = (newColors) => {
    setGlobalColors((prev) => ({ ...prev, ...newColors }));
  };

  const selectDesign = useCallback((designId) => {
    setCurrentDesignId(designId ?? null);
  }, [setCurrentDesignId]);

  const updateDesignById = useCallback((designId, updater) => {
    if (!designId) return;

    setDesigns((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;

      const next = prev.map((design) => {
        if (!design || design.id !== designId) return design;

        const patch =
          typeof updater === "function" ? updater({ ...design }) : updater;

        if (!patch || typeof patch !== "object") return design;

        return { ...design, ...patch };
      });

      return next;
    });
  }, [setDesigns]);

  return (
    <CanvasContext.Provider
      value={{
        canvas,
        setCanvas,
        activeObject,
        setActiveObject,
        shapePropertiesOpen,
        setShapePropertiesOpen,
        isCustomShapeMode,
        setIsCustomShapeMode,
  canvasShapeType,
  setCanvasShapeType,
        globalColors,
        updateGlobalColors,
        designs,
        setDesigns,
        currentDesignId,
        selectDesign,
        updateDesignById,
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvasContext = () => useContext(CanvasContext);
