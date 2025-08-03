import React from "react";
import styles from "./ShapeProperties.module.css";

const ShapeProperties = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

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
              <input type="number" className={styles.input} />
              <div className={styles.arrows}>
                <i className="fa-solid fa-chevron-up"></i>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Rotate:
            <div className={styles.inputGroup}>
              <input type="number" className={styles.input} />
              <div className={styles.arrows}>
                <i className="fa-solid fa-chevron-up"></i>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Height:
            <div className={styles.inputGroup}>
              <input type="number" className={styles.input} />
              <div className={styles.arrows}>
                <i className="fa-solid fa-chevron-up"></i>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Corner Radius:
            <div className={styles.inputGroup}>
              <input type="number" className={styles.input} />
              <div className={styles.arrows}>
                <i className="fa-solid fa-chevron-up"></i>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
          </label>
          <label className={styles.label}>
            Thickness:
            <div className={styles.inputGroup}>
              <input type="number" className={styles.input} />
              <div className={styles.arrows}>
                <i className="fa-solid fa-chevron-up"></i>
                <i className="fa-solid fa-chevron-down"></i>
              </div>
            </div>
          </label>
          <label className={styles.cutFillWrapper}>
            <div className={styles.cutFillWrapperEl}>
              Fill
              <input type="checkbox" />
            </div>
            <div className={styles.cutFillWrapperEl}>
              Cut
              <input type="checkbox" />
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default ShapeProperties;
