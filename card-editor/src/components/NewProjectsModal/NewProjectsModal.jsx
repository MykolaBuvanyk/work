import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import { useExcelImport } from "../../hooks/useExcelImport";
import * as fabric from "fabric";
import styles from "./NewProjectsModal.module.css";

const NewProjectsModal = ({ onClose }) => {
  return (
    <div className={styles.newProjectsModal}>
      Are you sure you want to delete this project?
      <div className={styles.buttonContainer}>
        <button className={styles.active} onClick={onClose}>
          Yes
        </button>
        <button onClick={onClose}>No</button>
      </div>
    </div>
  );
};

export default NewProjectsModal;
