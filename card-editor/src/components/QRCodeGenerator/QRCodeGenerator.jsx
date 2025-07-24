import React, { useState } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import QRCode from "qrcode";
import * as fabric from "fabric";
import styles from "./QRCodeGenerator.module.css";
import { QrCode } from "../../assets/Icons";

const QRCodeGenerator = ({ isOpen, onClose }) => {
  // Типи безпеки WiFi для селектора
  const wifiSecurityTypes = [
    { value: "WPA", label: "WPA" },
    { value: "WPA2-EAP", label: "WPA2-EAP" },
    { value: "nopass", label: "Without Password" },
  ];

  // Функція для зміни значень інпутів
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const { canvas } = useCanvasContext();
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({
    url: "",
    email: "",
    phone: "",
    wifiSSID: "",
    wifiPassword: "",
    wifiSecurity: "WPA",
    message: "",
  });

  const qrTypes = [
    { id: "url", label: "URL (Website)" },
    { id: "email", label: "E-MAIL" },
    { id: "phone", label: "Call (Phone)" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "wifi", label: "Wi-Fi" },
    { id: "message", label: "Message" },
  ];

  // Генерує дані для QR-коду залежно від типу
  const generateQRData = () => {
    switch (selectedType) {
      case "url":
        return formData.url || "https://example.com";
      case "email":
        return `mailto:${formData.email}`;
      case "phone":
        return `tel:${formData.phone}`;
      case "whatsapp":
        return `https://wa.me/${formData.phone.replace(/[^0-9]/g, "")}`;
      case "wifi":
        if (formData.wifiSecurity === "nopass") {
          return `WIFI:T:nopass;S:${formData.wifiSSID};;`;
        }
        return `WIFI:T:${formData.wifiSecurity};S:${formData.wifiSSID};P:${formData.wifiPassword};;`;
      case "message":
        return formData.message || "Default message";
      default:
        return "https://example.com";
    }
  };

  // Додає QR-код на canvas
  const generateQRCode = async () => {
    if (!canvas) return;

    const qrData = generateQRData();

    try {
      // Генеруємо QR-код як Data URL
      const qrDataURL = await QRCode.toDataURL(qrData, {
        width: 150,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      // Створюємо зображення з QR-коду
      const img = await fabric.FabricImage.fromURL(qrDataURL);
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
      if (onClose) onClose();
      setSelectedType(null);
    } catch (error) {
      console.error("Помилка генерації QR-коду:", error);
      alert("Помилка генерації QR-коду");
    }
  };

  // Локальний стейт для показу помилки тільки після спроби сабміту (wifi)
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const renderTypeForm = (typeId) => {
    let value = "";
    let label = "";
    let placeholder = "";
    let error = "";
    let isValid = false;
    let inputType = "text";
    let showBtn = false;
    let showError = false;
    let extra = null;
    let fieldKey = typeId; // Додано для правильного mapping ключів

    if (typeId === "url") {
      value = formData.url;
      fieldKey = "url";
      label = "Website - Link";
      placeholder = "https://example.com";
      inputType = "url";
      isValid = /^https?:\/\/.+\..+/.test(value);
      showBtn = !!value;
      showError = value && !isValid;
      if (!value) error = "X Empty field";
      else if (!isValid) error = "X Empty field";
    }

    if (typeId === "email") {
      value = formData.email;
      fieldKey = "email";
      label = "Email Address";
      placeholder = "example@domain.com";
      inputType = "email";
      isValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
      showBtn = !!value;
      showError = value && !isValid;
      if (!value) error = "X Empty field";
      else if (!isValid) error = "X Incorrect email";
    }

    if (typeId === "phone" || typeId === "whatsapp") {
      value = formData.phone;
      fieldKey = "phone";
      label = typeId === "phone" ? "Phone Number" : "WhatsApp Number";
      placeholder = "+380123456789";
      inputType = "tel";
      isValid = /^\+?\d{10,15}$/.test(value);
      showBtn = !!value;
      showError = value && !isValid;
      if (!value) error = "X Empty field";
      else if (!isValid) error = "X Incorrect phone number";
    }

    if (typeId === "wifi") {
      value = formData.wifiSSID;
      fieldKey = "wifiSSID";
      label = "Network Name (SSID)";
      placeholder = "WiFi Network Name";
      inputType = "text";
      isValid = !!value;
      showBtn = !!value;
      showError = submitAttempted && !value;
      if (!value) error = "X Empty field";
      extra = (
        <div>
          {formData.wifiSecurity !== "nopass" && (
            <div>
              <label style={{ position: "static" }}>Password</label>
              <input
                type="password"
                placeholder="WiFi Password"
                value={formData.wifiPassword}
                onChange={(e) =>
                  handleInputChange("wifiPassword", e.target.value)
                }
                className={styles.formInput}
                style={{
                  marginBottom: 0,
                  color: formData.wifiPassword ? "#000" : undefined,
                }}
              />
            </div>
          )}
          <label style={{ position: "static" }}>Security Type</label>
          <select
            value={formData.wifiSecurity}
            onChange={(e) => handleInputChange("wifiSecurity", e.target.value)}
            className={styles.formInput}
          >
            {wifiSecurityTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (typeId === "message") {
      value = formData.message;
      fieldKey = "message";
      label = "Custom Message";
      placeholder = "Enter your message here...";
      inputType = "textarea";
      isValid = !!value;
      showBtn = !!value;
      showError = false; // Никогда не показываем ошибку
    }

    const handleBtnClick = (e) => {
      e.preventDefault();
      if (typeId === "wifi") setSubmitAttempted(true);
    };

    // Обробник для телефону: заборонити букви
    const handlePhoneInput = (e) => {
      let val = e.target.value.replace(/[^\d+]/g, "");
      handleInputChange("phone", val);
    };

    return (
      <div className={styles.formGroup}>
        <div className={styles.inputWrapper}>
          {/* Лейбл зникає якщо є значення */}
          {!value && <label className={styles.floatingLabel}>{label}</label>}
          {inputType !== "textarea" ? (
            typeId === "phone" || typeId === "whatsapp" ? (
              <input
                type={inputType}
                placeholder={placeholder}
                value={value}
                onChange={handlePhoneInput}
                className={styles.formInput}
                style={{
                  marginBottom: 0,
                  color: value ? "#000" : undefined,
                }}
              />
            ) : (
              <input
                type={inputType}
                placeholder={placeholder}
                value={value}
                onChange={(e) => handleInputChange(fieldKey, e.target.value)}
                className={styles.formInput}
                style={{
                  marginBottom: 0,
                  color: value ? "#000" : undefined,
                }}
              />
            )
          ) : (
            <textarea
              placeholder={placeholder}
              value={value}
              onChange={(e) => handleInputChange(fieldKey, e.target.value)}
              rows={3}
              className={styles.formInput}
              style={{
                marginBottom: 0,
                color: value ? "#000" : undefined,
              }}
            />
          )}
        </div>
        {extra}
        <button
          className={styles.formGroupBtn + (value ? " " + styles.active : "")}
          disabled={!value}
          style={{
            cursor: value ? "pointer" : "not-allowed",
            background: value ? "rgba(0, 108, 164, 1)" : undefined,
          }}
          onClick={handleBtnClick}
        >
          Update
        </button>
        {showError && <div className={styles.formGroupError}>{error}</div>}
      </div>
    );
  };

  if (!isOpen) return null;
  return (
    <div className={styles.qrGenerator}>
      <div className={styles.dropdown}>
        <div className={styles.dropdownHeader}>
          <h3>QR Code</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12.0005 12.0001L14.8289 14.8285M9.17212 14.8285L12.0005 12.0001L9.17212 14.8285ZM14.8289 9.17163L12.0005 12.0001L14.8289 9.17163ZM12.0005 12.0001L9.17212 9.17163L12.0005 12.0001Z"
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
        <div className={styles.content}>
          <p>The minimum size of QR Code is 20 x 20 mm</p>
          <div className={styles.typesList}>
            {qrTypes.map((type) => (
              <div key={type.id} className={styles.typeItem}>
                <div className={styles.typeHeader}>
                  <input
                    type="checkbox"
                    checked={selectedType === type.id}
                    onChange={() =>
                      setSelectedType(type.id === selectedType ? null : type.id)
                    }
                    style={{ marginRight: 8 }}
                  />
                  <span className={styles.typeLabel}>{type.label}</span>
                  <span className={styles.description}>
                    {type.id === "url" && "* Scan to visit Website"}
                    {type.id === "email" && "* Scan to send an Email"}
                    {type.id === "phone" && "* Scan to call directly"}
                    {type.id === "whatsapp" && "* Scan to send Message"}
                    {type.id === "wifi" && "* Scan to connect to Network"}
                    {type.id === "message" && "* Scan to read Custom Message"}
                  </span>
                </div>
                <div
                  className={
                    selectedType === type.id
                      ? styles.typeFormWrapper + " " + styles.active
                      : styles.typeFormWrapper
                  }
                  style={{ width: "100%", marginTop: 8 }}
                >
                  {selectedType === type.id && renderTypeForm(type.id)}
                </div>
              </div>
            ))}
          </div>
          <div className={styles.actions}>
            <button
              className={styles.updateBtn}
              onClick={generateQRCode}
              disabled={!selectedType}
            >
              Generate QR Code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
