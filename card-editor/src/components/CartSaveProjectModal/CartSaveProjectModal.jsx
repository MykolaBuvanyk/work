import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../NewProjectsModal/NewProjectsModal.module.css";

const CartSaveProjectModal = ({ isOpen, onSave, onCancel }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className={styles.newProjectsModal} role="dialog" aria-modal="true">
      <p>
        {t("cartSaveProjectModal.message")}
      </p>
      <div className={styles.buttonContainer}>
        <button className={styles.active} onClick={onSave} type="button">
          {t("cartSaveProjectModal.save")}
        </button>
        <button onClick={onCancel} type="button">
          {t("cartSaveProjectModal.cancel")}
        </button>
      </div>
    </div>
  );
};

export default CartSaveProjectModal;
