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
          <h3>Bar Code</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.formContainer}>
            <div className={styles.inputRow}>
              <div className={styles.selectGroup}>
                <label>Type</label>
                <select
                  value={formData.codeType}
                  onChange={(e) => handleInputChange("codeType", e.target.value)}
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
                <label>Text</label>
                <input
                  type="text"
                  placeholder="Enter text or numbers"
                  value={formData.text}
                  onChange={(e) => handleInputChange("text", e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.updateBtn} onClick={generateBarCode}>
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
