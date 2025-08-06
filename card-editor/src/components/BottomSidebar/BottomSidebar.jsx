import React, { useState, useEffect } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import { useExcelImport } from "../../hooks/useExcelImport";
import * as fabric from "fabric";
import styles from "./BottomSidebar.module.css";

const BottomSidebar = () => {
  return (
    <div className={styles.bottomSidebar}>

    </div>
  );
};

export default BottomSidebar;
