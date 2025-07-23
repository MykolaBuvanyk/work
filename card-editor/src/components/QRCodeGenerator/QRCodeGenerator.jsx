import React, { useState } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import QRCode from "qrcode";
import * as fabric from "fabric";
import styles from "./QRCodeGenerator.module.css";
import { QrCode } from "../../assets/Icons";

const QRCodeGenerator = ({ isOpen, onClose }) => {
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

  const wifiSecurityTypes = [
    { value: "WPA", label: "WPA" },
    { value: "WPA2-EAP", label: "WPA2-EAP" },
    { value: "nopass", label: "Without Password" },
  ];

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setFormData({
      url: "",
      email: "",
      phone: "",
      wifiSSID: "",
      wifiPassword: "",
      wifiSecurity: "WPA",
      message: "",
    });
  };

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

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Рендер формы для каждого типа
  const renderTypeForm = (typeId) => {
    switch (typeId) {
      case "url":
        return (
          <div className={styles.formGroup}>
            <label>Website - Link</label>
            <input
              type="url"
              placeholder="https://example.com"
              value={formData.url}
              onChange={(e) => handleInputChange("url", e.target.value)}
            />
          </div>
        );
      case "email":
        return (
          <div className={styles.formGroup}>
            <label>Email Address</label>
            <input
              type="email"
              placeholder="example@domain.com"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
            />
          </div>
        );
      case "phone":
        return (
          <div className={styles.formGroup}>
            <label>Phone Number</label>
            <input
              type="tel"
              placeholder="+380123456789"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
            />
          </div>
        );
      case "whatsapp":
        return (
          <div className={styles.formGroup}>
            <label>WhatsApp Number</label>
            <input
              type="tel"
              placeholder="+380123456789"
              value={formData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
            />
          </div>
        );
      case "wifi":
        return (
          <div className={styles.formGroup}>
            <label>Network Name (SSID)</label>
            <input
              type="text"
              placeholder="WiFi Network Name"
              value={formData.wifiSSID}
              onChange={(e) => handleInputChange("wifiSSID", e.target.value)}
            />
            <label>Security Type</label>
            <select
              value={formData.wifiSecurity}
              onChange={(e) =>
                handleInputChange("wifiSecurity", e.target.value)
              }
            >
              {wifiSecurityTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {formData.wifiSecurity !== "nopass" && (
              <>
                <label>Password</label>
                <input
                  type="password"
                  placeholder="WiFi Password"
                  value={formData.wifiPassword}
                  onChange={(e) =>
                    handleInputChange("wifiPassword", e.target.value)
                  }
                />
              </>
            )}
          </div>
        );
      case "message":
        return (
          <div className={styles.formGroup}>
            <label>Custom Message</label>
            <textarea
              placeholder="Enter your message here..."
              value={formData.message}
              onChange={(e) => handleInputChange("message", e.target.value)}
              rows={3}
            />
          </div>
        );
      default:
        return null;
    }
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
                {selectedType === type.id && (
                  <div style={{ width: "100%", marginTop: 8 }}>
                    {renderTypeForm(type.id)}
                  </div>
                )}
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
