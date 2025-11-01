// Hook to manage and extract current toolbar state for persistence
import { useContext } from "react";
import { useCanvasContext } from "../contexts/CanvasContext";

const DEFAULT_SHAPE_WIDTH_MM = 120;
const DEFAULT_SHAPE_HEIGHT_MM = 80;

export const useToolbarState = () => {
  const { globalColors, isCustomShapeMode } = useCanvasContext();

  // Function to get current toolbar state from component refs/state
  const getToolbarState = (componentState = {}) => {
    return {
      // Shape settings
      currentShapeType: componentState.currentShapeType || null,
      cornerRadius: componentState.cornerRadius || 0,
      // Size values (in mm)
      sizeValues: componentState.sizeValues || {
        width: DEFAULT_SHAPE_WIDTH_MM,
        height: DEFAULT_SHAPE_HEIGHT_MM,
        cornerRadius: 0,
      },
      // Color settings from context
      globalColors: globalColors || {
        textColor: "#000000",
        backgroundColor: "#FFFFFF",
        strokeColor: "#000000",
        fillColor: "transparent",
        backgroundType: "solid",
      },
      selectedColorIndex: componentState.selectedColorIndex || 0,
      // Material settings
      thickness: componentState.thickness || 1.6,
      isAdhesiveTape: componentState.isAdhesiveTape || false,
      // Holes settings
      activeHolesType: componentState.activeHolesType || 1,
      holesDiameter: componentState.holesDiameter || 2.5,
      isHolesSelected: componentState.isHolesSelected || false,
      // Shape customization from context
      isCustomShapeMode: isCustomShapeMode || false,
      isCustomShapeApplied: componentState.isCustomShapeApplied || false,
      hasUserPickedShape: componentState.hasUserPickedShape || false,
      // Copy settings
      copiesCount: componentState.copiesCount || 1,
      // Border settings
      hasBorder: componentState.hasBorder || false,
    };
  };

  return { getToolbarState };
};
