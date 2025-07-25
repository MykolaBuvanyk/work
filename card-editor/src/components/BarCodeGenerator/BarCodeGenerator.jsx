import React, { useState } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import JsBarcode from "jsbarcode";
import * as fabric from "fabric";
import styles from "./BarCodeGenerator.module.css";

const BarCodeGenerator = ({ isOpen, onClose }) => {
  const { canvas } = useCanvasContext();
  const [formData, setFormData] = useState({
    text: "",
    codeType: "CODE128",
  });

  const barcodeTypes = [
    { value: "CODE128", label: "Code 128" },
    { value: "CODE39", label: "Code 39" },
  ];

  const generateBarCode = async () => {
    if (!canvas || !formData.text.trim()) {
      alert("Please enter text for the barcode");
      return;
    }

    try {
      // Створюємо canvas для генерації бар-коду
      const barcodeCanvas = document.createElement("canvas");

      // Генеруємо бар-код
      JsBarcode(barcodeCanvas, formData.text, {
        format: formData.codeType,
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 14,
        textMargin: 5,
        margin: 10,
      });

      // Конвертуємо в Data URL
      const barcodeDataURL = barcodeCanvas.toDataURL();

      // Створюємо зображення з бар-коду
      const img = await fabric.FabricImage.fromURL(barcodeDataURL);

      img.set({
        left: 100,
        top: 100,
        selectable: true,
        hasControls: true,
        hasBorders: true,
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();

      // Закриваємо меню після створення
      onClose();
    } catch (error) {
      console.error("Помилка генерації бар-коду:", error);
      alert("Помилка генерації бар-коду. Перевірте введений текст.");
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className={styles.barGenerator}>
      <div className={styles.dropdown}>
        <div className={styles.dropdownHeader}>
          <div className={styles.titleWrapper}>
            <h3>Bar Code</h3>
            <p>Enter text or numbers to encode</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12.0005 12L14.8289 14.8284M9.17212 14.8284L12.0005 12L9.17212 14.8284ZM14.8289 9.17157L12.0005 12L14.8289 9.17157ZM12.0005 12L9.17212 9.17157L12.0005 12Z"
                stroke="#006CA4"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="#006CA4"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.formContainer}>
            <div className={styles.inputRow}>
              <div className={styles.selectGroup}>
                <select
                  value={formData.codeType}
                  onChange={(e) =>
                    handleInputChange("codeType", e.target.value)
                  }
                  className={styles.select}
                >
                  {barcodeTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.inputGroup}>
                <input
                  type="text"
                  placeholder="ABC - 123"
                  value={formData.text}
                  onChange={(e) => handleInputChange("text", e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.actions}>
              <button
                className={`${styles.updateBtn} ${
                  formData.text.trim() ? styles.active : ""
                }`}
                onClick={formData.text.trim() ? generateBarCode : undefined}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarCodeGenerator;
