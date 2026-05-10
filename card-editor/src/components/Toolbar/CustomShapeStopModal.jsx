import React from "react";
import { useTranslation } from "react-i18next";
import styles from "./CustomShapeStopModal.module.css";

const CustomShapeStopModal = ({ onConfirm }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.stopModalWrapper}>
      <div className={styles.stopModal}>
        <h4 className={styles.title}>{t('toolbar.customShapeStop.title')}</h4>
        <p className={styles.desc}>{t('toolbar.customShapeStop.description')}</p>
        <div className={styles.actions}>
          <button className={styles.yesBtn} onClick={onConfirm}>
            {t('toolbar.customShapeStop.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomShapeStopModal;
