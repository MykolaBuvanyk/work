import { createContext, useContext, useState } from 'react';

const CanvasContext = createContext();

export const CanvasProvider = ({ children }) => {
  const [canvas, setCanvas] = useState(null);
  const [activeObject, setActiveObject] = useState(null);

  return (
    <CanvasContext.Provider value={{ canvas, setCanvas, activeObject, setActiveObject }}>
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvasContext = () => useContext(CanvasContext);