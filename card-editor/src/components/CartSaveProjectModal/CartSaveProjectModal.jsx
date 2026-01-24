import React from "react";
import styles from "../NewProjectsModal/NewProjectsModal.module.css";

const CartSaveProjectModal = ({ isOpen, onSave, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.newProjectsModal} role="dialog" aria-modal="true">
      <p>
        Please save your project before adding it to the cart.
      </p>
      <div className={styles.buttonContainer}>
        <button className={styles.active} onClick={onSave} type="button">
          Save
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default CartSaveProjectModal;
