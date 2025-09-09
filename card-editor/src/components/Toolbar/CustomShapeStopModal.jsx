import React from "react";
import styles from "./CustomShapeStopModal.module.css";

const CustomShapeStopModal = ({ onConfirm }) => {
  return (
    <div className={styles.stopModalWrapper}>
      <div className={styles.stopModal}>
        <h4 className={styles.title}>Stop shape customization</h4>
        <p className={styles.desc}>Finish editing current shape?</p>
        <div className={styles.actions}>
          <button className={styles.yesBtn} onClick={onConfirm}>
            Yes
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomShapeStopModal;
