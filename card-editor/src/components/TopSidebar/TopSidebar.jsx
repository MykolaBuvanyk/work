import React, { useState, useEffect } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import { useExcelImport } from "../../hooks/useExcelImport";
import * as fabric from "fabric";
import styles from "./TopSidebar.module.css";
// Project buttons and modals moved to TopToolbar.

const TopSidebar = () => {
  const { canvas } = useCanvasContext();

  return (
    <div className={styles.topSidebar}>
      {/* Project buttons moved to TopToolbar */}
      <div className={styles.textWrapper}>
        <p className={styles.bold}>Material</p>
        <p>Engraved Plastic</p>
      </div>
    </div>
  );
};

export default TopSidebar;
