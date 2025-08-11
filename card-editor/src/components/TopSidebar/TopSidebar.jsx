import React, { useState, useEffect } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import { useExcelImport } from "../../hooks/useExcelImport";
import * as fabric from "fabric";
import styles from "./TopSidebar.module.css";
import YourProjectsModal from "../YourProjectsModal/YourProjectsModal";

const TopSidebar = () => {
  const [isProjectsModalOpen, setProjectsModalOpen] = useState(false);

  return (
    <div className={styles.topSidebar}>
      <div className={styles.buttonWrapper}>
        <button className={styles.button}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 4.75C1 3.784 1.784 3 2.75 3H7.721C8.301 3 8.841 3.286 9.168 3.765L10.572 5.828C10.618 5.897 10.696 5.938 10.779 5.938H19.25C20.216 5.938 21 6.721 21 7.688V19.25C21 19.7141 20.8156 20.1592 20.4874 20.4874C20.1592 20.8156 19.7141 21 19.25 21H2.75C2.28587 21 1.84075 20.8156 1.51256 20.4874C1.18437 20.1592 1 19.7141 1 19.25V4.75ZM2.75 4.5C2.6837 4.5 2.62011 4.52634 2.57322 4.57322C2.52634 4.62011 2.5 4.6837 2.5 4.75V19.25C2.5 19.388 2.612 19.5 2.75 19.5H19.25C19.3163 19.5 19.3799 19.4737 19.4268 19.4268C19.4737 19.3799 19.5 19.3163 19.5 19.25V7.687C19.5 7.6207 19.4737 7.55711 19.4268 7.51022C19.3799 7.46334 19.3163 7.437 19.25 7.437H10.779C10.4937 7.43709 10.2128 7.36743 9.96055 7.2341C9.70835 7.10076 9.49257 6.9078 9.332 6.672L7.928 4.61C7.9049 4.57613 7.87387 4.5484 7.83763 4.52923C7.80138 4.51006 7.761 4.50003 7.72 4.5H2.75Z"
              fill="white"
            />
          </svg>
          New project
        </button>
        <button
          className={styles.button}
          onClick={() => setProjectsModalOpen(true)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 4.75C1 3.784 1.784 3 2.75 3H7.721C8.301 3 8.841 3.286 9.168 3.765L10.572 5.828C10.618 5.897 10.696 5.938 10.779 5.938H19.25C20.216 5.938 21 6.721 21 7.688V19.25C21 19.7141 20.8156 20.1592 20.4874 20.4874C20.1592 20.8156 19.7141 21 19.25 21H2.75C2.28587 21 1.84075 20.8156 1.51256 20.4874C1.18437 20.1592 1 19.7141 1 19.25V4.75ZM2.75 4.5C2.6837 4.5 2.62011 4.52634 2.57322 4.57322C2.52634 4.62011 2.5 4.6837 2.5 4.75V19.25C2.5 19.388 2.612 19.5 2.75 19.5H19.25C19.3163 19.5 19.3799 19.4737 19.4268 19.4268C19.4737 19.3799 19.5 19.3163 19.5 19.25V7.687C19.5 7.6207 19.4737 7.55711 19.4268 7.51022C19.3799 7.46334 19.3163 7.437 19.25 7.437H10.779C10.4937 7.43709 10.2128 7.36743 9.96055 7.2341C9.70835 7.10076 9.49257 6.9078 9.332 6.672L7.928 4.61C7.9049 4.57613 7.87387 4.5484 7.83763 4.52923C7.80138 4.51006 7.761 4.50003 7.72 4.5H2.75Z"
              fill="white"
            />
          </svg>
          Your project
        </button>
      </div>
      <div className={styles.textWrapper}>
        <p className={styles.bold}>Material</p>
        <p>Engraved Plastic</p>
      </div>
      {isProjectsModalOpen && (
        <YourProjectsModal onClose={() => setProjectsModalOpen(false)} />
      )}
    </div>
  );
};

export default TopSidebar;
