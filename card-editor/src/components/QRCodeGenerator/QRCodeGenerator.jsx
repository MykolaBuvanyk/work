import React, { useState, useEffect, useRef } from "react";
import { useCanvasContext } from "../../contexts/CanvasContext";
import qrGenerator from "qrcode-generator";
import * as fabric from "fabric";
import styles from "./QRCodeGenerator.module.css";
import { QrCode } from "../../assets/Icons";
import {
  buildQrSvgMarkup,
  computeQrVectorData,
  decorateQrGroup,
  DEFAULT_QR_CELL_SIZE,
} from "../../utils/qrFabricUtils";
import { fitObjectToCanvas } from "../../utils/canvasFit";

const QRCodeGenerator = ({ isOpen, onClose }) => {
  // Закриття по клику вне модального окна
  const dropdownRef = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        if (typeof onClose === "function") onClose();
      }
    };
    document.addEventListener("mousedown", handleOutside, true);
    document.addEventListener("touchstart", handleOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside, true);
      document.removeEventListener("touchstart", handleOutside, true);
    };
  }, [isOpen, onClose]);
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

  const { canvas, globalColors } = useCanvasContext();

  const [formData, setFormData] = useState({
    url: "",
    email: "",
    phone: "",
    wifiSSID: "",
    wifiPassword: "",
    wifiSecurity: "WPA",
    message: "",
  });

  // Допоміжні функції для перевірки та нормалізації URL
  const normalizeUrl = (value) => {
    const v = (value || "").trim();
    if (!v) return "";
    // якщо вже є схема (http:, https:, ftp:, mailto:, тощо) — не змінюємо
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v)) return v;
    return `https://${v}`;
  };
  const isLikelyDomain = (host) => {
    if (!host) return false;
    const parts = host.split(".");
    if (parts.length < 2) return false;
    const tld = parts[parts.length - 1];
    // Дозволяємо літери/цифри/дефіси для підтримки punycode (xn--)
    return /^[a-zA-Z0-9-]{2,}$/.test(tld);
  };
  const isValidUrlInput = (value) => {
    const raw = (value || "").trim();
    if (!raw) return false;
    try {
      const u = new URL(normalizeUrl(raw));
      return !!u.hostname && isLikelyDomain(u.hostname);
    } catch {
      return false;
    }
  };

  const qrTypes = [
    { id: "url", label: "URL (Website)" },
    { id: "email", label: "E-MAIL" },
    { id: "phone", label: "Call (Phone)" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "wifi", label: "Wi-Fi" },
    { id: "message", label: "Message" },
  ];

  const [selectedType, setSelectedType] = useState(qrTypes[0]?.id || null);

  // При відкритті вікна завжди активуємо URL та генеруємо дефолтний QR (якщо ще не додано або немає активного QR)
  useEffect(() => {
    if (!isOpen) return;
    setSelectedType("url");
    if (canvas) {
      const existing = canvas.getObjects()?.find((o) => o.isQRCode);
      if (!existing) {
        generateQRCode({ auto: true, keepSelection: true, mode: "new" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Генерує дані для QR-коду залежно від типу
  const generateQRData = () => {
    switch (selectedType) {
      case "url":
        return formData.url
          ? normalizeUrl(formData.url)
          : "https://example.com";
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

  // Додає QR-код на canvas без quiet zone та відступів
  // mode: 'update' (replace target qr) | 'new' (add another)
  const generateQRCode = async ({
    auto = false,
    keepSelection = false,
    mode = "update",
  } = {}) => {
    if (!canvas) return;
    const qrData = generateQRData();
    let svgText;

    const cellSize = DEFAULT_QR_CELL_SIZE;
    let generatedSize = 0;
    try {
      const qr = qrGenerator(0, "M");
      qr.addData(qrData);
      qr.make();

      const fgColor = globalColors?.textColor || "#000000";
      const { optimizedPath, displayPath, size } = computeQrVectorData(
        qr,
        cellSize
      );

      svgText = buildQrSvgMarkup({
        size,
        displayPath,
        optimizedPath,
        strokeColor: fgColor,
      });
      generatedSize = size;
    } catch (e) {
      console.error("Помилка створення QR:", e);
      if (!auto) alert("Не вдалося згенерувати QR-код");
      return;
    }

    // Пошук цільового QR для update
    const allQrs = canvas.getObjects().filter((o) => o.isQRCode);
    const active = canvas.getActiveObject();
    const target = active && active.isQRCode ? active : allQrs[0];
    let left, top, scaleX, scaleY, angle;
    let replacing = false;
    if (mode === "update" && target) {
      replacing = true;
      ({ left, top, scaleX, scaleY, angle } = target);
      canvas.__suspendUndoRedo = true;
      canvas.remove(target);
    }
    let obj;
    try {
      const result = await fabric.loadSVGFromString(svgText);
      if (result?.objects?.length === 1) obj = result.objects[0];
      else
        obj = fabric.util.groupSVGElements(
          result.objects || [],
          result.options || {}
        );
      decorateQrGroup(obj);
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();
      const fgColorUsed = globalColors?.textColor || "#000000";
      obj.set({
        left:
          left ??
          canvasWidth / 2 +
            (mode === "new" && allQrs.length ? 30 * allQrs.length : 0),
        top:
          top ??
          canvasHeight / 2 +
            (mode === "new" && allQrs.length ? 30 * allQrs.length : 0),
        scaleX: scaleX ?? 1,
        scaleY: scaleY ?? 1,
        angle: angle ?? 0,
        originX: "center",
        originY: "center",
        selectable: true,
        hasControls: true,
        hasBorders: true,
        isQRCode: true,
        qrText: qrData,
        qrSize: generatedSize || obj.width || 0,
        qrColor: fgColorUsed,
        backgroundColor: "transparent",
      });
      // Мінімальний розмір QR 10x10 мм; стандартний при створенні — 20x20 мм
      const PX_PER_MM = 72 / 25.4;
      const minPx = 10 * PX_PER_MM;
      const defaultPx = 20 * PX_PER_MM;
      // Встановлюємо стандартний розмір 20мм при створенні
      try {
        const baseW =
          obj.width ||
          (typeof obj.getScaledWidth === "function"
            ? obj.getScaledWidth()
            : 0) ||
          1;
        const baseH =
          obj.height ||
          (typeof obj.getScaledHeight === "function"
            ? obj.getScaledHeight()
            : 0) ||
          1;
        const sX = defaultPx / baseW;
        const sY = defaultPx / baseH;
        obj.set({ scaleX: sX, scaleY: sY });
      } catch {}
      const clampQrMinSize = (qr) => {
        try {
          const w =
            typeof qr.getScaledWidth === "function"
              ? qr.getScaledWidth()
              : qr.width * (qr.scaleX || 1);
          const h =
            typeof qr.getScaledHeight === "function"
              ? qr.getScaledHeight()
              : qr.height * (qr.scaleY || 1);
          const sx = (qr.scaleX || 1) * (w < minPx ? minPx / (w || 1) : 1);
          const sy = (qr.scaleY || 1) * (h < minPx ? minPx / (h || 1) : 1);
          if (sx !== qr.scaleX || sy !== qr.scaleY) {
            qr.set({ scaleX: sx, scaleY: sy });
            qr.setCoords && qr.setCoords();
          }
        } catch {}
      };
      clampQrMinSize(obj);
      canvas.add(obj);

        // Auto-fit newly added QR to canvas (max 60%).
        try {
          fitObjectToCanvas(canvas, obj, { maxRatio: 0.6 });
        } catch {}

      // Стабілізуємо координати і активуємо QR, щоб уникнути падінь при рендері контролів
      try {
        if (typeof obj.setCoords === "function") obj.setCoords();
      } catch {}
      if (keepSelection || !auto) {
        try {
          canvas.setActiveObject(obj);
        } catch {}
      }
      try {
        canvas.requestRenderAll();
      } catch {}
      // Додаткове оновлення у наступному кадрі — для SVG/Group після первинного layout
      try {
        requestAnimationFrame(() => {
          try {
            if (!canvas || !obj) return;
            if (keepSelection || !auto) canvas.setActiveObject(obj);
            if (typeof obj.setCoords === "function") obj.setCoords();
            clampQrMinSize(obj);
              try {
                fitObjectToCanvas(canvas, obj, { maxRatio: 0.6 });
              } catch {}
            canvas.requestRenderAll();
          } catch {}
        });
      } catch {}
    } catch (e) {
      console.error("Помилка створення нового QR (SVG):", e);
      if (!auto) alert("Помилка створення QR-коду");
    } finally {
      if (replacing) {
        canvas.__suspendUndoRedo = false;
        canvas.fire("object:added"); // Один запис в історії для заміни
      }
      canvas.requestRenderAll();
    }
  };

  // Глобально: забороняємо зменшувати QR менше 10мм під час масштабування
  useEffect(() => {
    if (!canvas) return;
    const PX_PER_MM = 72 / 25.4;
    const minPx = 10 * PX_PER_MM;
    const handler = (e) => {
      const t = e?.target;
      if (!t || !t.isQRCode) return;
      try {
        const w =
          typeof t.getScaledWidth === "function"
            ? t.getScaledWidth()
            : t.width * (t.scaleX || 1);
        const h =
          typeof t.getScaledHeight === "function"
            ? t.getScaledHeight()
            : t.height * (t.scaleY || 1);
        let sx = t.scaleX || 1;
        let sy = t.scaleY || 1;
        if (w < minPx) sx *= minPx / (w || 1);
        if (h < minPx) sy *= minPx / (h || 1);
        if (sx !== t.scaleX || sy !== t.scaleY) {
          t.set({ scaleX: sx, scaleY: sy });
          t.setCoords && t.setCoords();
          canvas.requestRenderAll();
        }
      } catch {}
    };
    canvas.on("object:scaling", handler);
    return () => {
      canvas.off("object:scaling", handler);
    };
  }, [canvas]);

  // Видалення поточного (active) QR або першого знайденого
  const deleteQRCode = () => {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    const target =
      active && active.isQRCode
        ? active
        : canvas.getObjects().find((o) => o.isQRCode);
    if (!target) return;
    canvas.remove(target);
    canvas.requestRenderAll();
  };

  // Дублювання активного або першого QR
  const duplicateQRCode = async () => {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    const target =
      active && active.isQRCode
        ? active
        : canvas.getObjects().find((o) => o.isQRCode);
    if (!target) return;
    try {
      const clone = await target.clone();
      clone.set({
        left: target.left + 30,
        top: target.top + 30,
        isQRCode: true,
        qrText: target.qrText,
        qrSize: target.qrSize,
        qrColor: target.qrColor,
      });
      decorateQrGroup(clone);
      canvas.add(clone);
      try {
        if (typeof clone.setCoords === "function") clone.setCoords();
      } catch {}
      try {
        canvas.setActiveObject(clone);
      } catch {}
      try {
        canvas.requestRenderAll();
      } catch {}
      try {
        requestAnimationFrame(() => {
          try {
            if (!canvas || !clone) return;
            canvas.setActiveObject(clone);
            if (typeof clone.setCoords === "function") clone.setCoords();
            canvas.requestRenderAll();
          } catch {}
        });
      } catch {}
    } catch (e) {
      console.error("Помилка дублювання QR:", e);
    }
  };

  // Створення абсолютно нового QR з поточними даними (не заміняє існуючі)
  const createNewQRCode = () =>
    generateQRCode({ keepSelection: true, mode: "new" });

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
      placeholder = "example.com або https://example.com";
      // Дозволяємо вводити без схеми; валідація через хост з TLD
      inputType = "text";
      isValid = isValidUrlInput(value);
      showBtn = isValid;
      showError = value && !isValid;
      if (!value) error = "X Empty field";
      else if (!isValid) error = "X Неправильно введені дані";
    }

    if (typeId === "email") {
      value = formData.email;
      fieldKey = "email";
      label = "Email Address";
      placeholder = "example@domain.com";
      inputType = "email";
      isValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
      showBtn = isValid;
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
      showBtn = isValid;
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
      // Для WiFi перевіряємо SSID та пароль (якщо потрібен)
      isValid =
        !!value &&
        (formData.wifiSecurity === "nopass" || !!formData.wifiPassword);
      showBtn = isValid;
      showError = submitAttempted && !value;
      if (!value) error = "X Empty field";
      else if (formData.wifiSecurity !== "nopass" && !formData.wifiPassword)
        error = "X Password required";
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
              {submitAttempted &&
                formData.wifiSecurity !== "nopass" &&
                !formData.wifiPassword && (
                  <div className={styles.formGroupError}>
                    X Password required
                  </div>
                )}
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
      if (typeId === "wifi") {
        setSubmitAttempted(true);
        // Перевіряємо валідність для WiFi
        if (
          !formData.wifiSSID ||
          (formData.wifiSecurity !== "nopass" && !formData.wifiPassword)
        ) {
          return;
        }
      }
      // Генеруємо QR код для поточного типу
      generateQRCode({ keepSelection: true, mode: "update" });
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
          className={styles.formGroupBtn + (showBtn ? " " + styles.active : "")}
          disabled={!showBtn}
          style={{
            cursor: showBtn ? "pointer" : "not-allowed",
            background: showBtn ? "rgba(0, 108, 164, 1)" : undefined,
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
      <div className={styles.dropdown} ref={dropdownRef}>
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
            <button className={styles.actionBtn} onClick={deleteQRCode}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18.5172 12.7795L19.26 12.8829L18.5172 12.7795ZM18.2549 14.6645L18.9977 14.7679L18.2549 14.6645ZM5.74514 14.6645L6.48798 14.5611L5.74514 14.6645ZM5.4828 12.7795L4.73996 12.8829L5.4828 12.7795ZM9.18365 21.7368L8.89206 22.4278L9.18365 21.7368ZM6.47508 18.5603L7.17907 18.3017L6.47508 18.5603ZM17.5249 18.5603L18.2289 18.819V18.819L17.5249 18.5603ZM14.8164 21.7368L14.5248 21.0458H14.5248L14.8164 21.7368ZM5.74664 8.92906C5.70746 8.5167 5.34142 8.21418 4.92906 8.25336C4.5167 8.29254 4.21418 8.65858 4.25336 9.07094L5.74664 8.92906ZM19.7466 9.07094C19.7858 8.65858 19.4833 8.29254 19.0709 8.25336C18.6586 8.21418 18.2925 8.5167 18.2534 9.92906L19.7466 9.07094ZM20 7.75C20.4142 7.75 20.75 7.41421 20.75 7C20.75 6.58579 20.4142 6.25 20 6.25V7.75ZM4 6.25C3.58579 6.25 3.25 6.58579 3.25 7C3.25 7.41421 3.58579 7.75 4 7.75V6.25ZM9.25 18C9.25 18.4142 9.58579 18.75 10 18.75C10.4142 18.75 10.75 18.4142 10.75 18H9.25ZM10.75 10C10.75 9.58579 10.4142 9.25 10 9.25C9.58579 9.25 9.25 9.58579 9.25 10H10.75ZM13.25 18C13.25 18.4142 13.5858 18.75 14 18.75C14.4142 18.75 14.75 18.4142 14.75 18H13.25ZM14.75 10C14.75 9.58579 14.4142 9.25 14 9.25C13.5858 9.25 13.25 9.58579 13.25 10H14.75ZM16 7V7.75H16.75V7H16ZM8 7H7.25V7.75H8V7ZM18.5172 12.7795L17.7744 12.6761L17.512 14.5611L18.2549 14.6645L18.9977 14.7679L19.26 12.8829L18.5172 12.7795ZM5.74514 14.6645L6.48798 14.5611L6.22564 12.6761L5.4828 12.7795L4.73996 12.8829L5.0023 14.7679L5.74514 14.6645ZM12 22V21.25C10.4708 21.25 9.92544 21.2358 9.47524 21.0458L9.18365 21.7368L8.89206 22.4278C9.68914 22.7642 10.6056 22.75 12 22.75V22ZM5.74514 14.6645L5.0023 14.7679C5.282 16.7777 5.43406 17.9017 5.77109 18.819L6.47508 18.5603L7.17907 18.3017C6.91156 17.5736 6.77851 16.6488 6.48798 14.5611L5.74514 14.6645ZM9.18365 21.7368L9.47524 21.0458C8.55279 20.6566 7.69496 19.7058 7.17907 18.3017L6.47508 18.5603L5.77109 18.819C6.3857 20.4918 7.48205 21.8328 8.89206 22.4278L9.18365 21.7368ZM18.2549 14.6645L17.512 14.5611C17.2215 16.6488 17.0884 17.5736 16.8209 18.3017L17.5249 18.5603L18.2289 18.819C18.5659 17.9017 18.718 16.7777 18.9977 14.7679L18.2549 14.6645ZM12 22V22.75C13.3944 22.75 14.3109 22.7642 15.1079 22.4278L14.8164 21.7368L14.5248 21.0458C14.0746 21.2358 13.5292 21.25 12 21.25V22ZM17.5249 18.5603L16.8209 18.3017C16.305 19.7058 15.4472 20.6566 14.5248 21.0458L14.8164 21.7368L15.1079 22.4278C16.5179 21.8328 17.6143 20.4918 18.2289 18.819L17.5249 18.5603ZM5.4828 12.7795L6.22564 12.6761C6.00352 11.08 5.83766 9.88703 5.74664 8.92906L5 9L4.25336 9.07094C4.34819 10.069 4.51961 11.2995 4.73996 12.8829L5.4828 12.7795ZM18.5172 12.7795L19.26 12.8829C19.4804 11.2995 19.6518 10.069 19.7466 9.07094L19 9L18.2534 8.92906C18.1623 9.88702 17.9965 11.08 17.7744 12.6761L18.5172 12.7795ZM20 7V6.25H4V7V7.75H20V7ZM10 18H10.75V10H10H9.25V18H10ZM14 18H14.75V10H14H13.25V18H14ZM16 6H15.25V7H16H16.75V6H16ZM16 7V6.25H8V7V7.75H16V7ZM8 7H8.75V6H8H7.25V7H8ZM12 2V2.75C13.7949 2.75 15.25 4.20507 15.25 6H16H16.75C16.75 3.37665 14.6234 1.25 12 1.25V2ZM12 2V1.25C9.37665 1.25 7.25 3.37665 7.25 6H8H8.75C8.75 4.20507 10.2051 2.75 12 2.75V2Z"
                  fill="#FF3B30"
                />
              </svg>
              <span className={styles.actionText}>Delete QR</span>
            </button>
            <button className={styles.actionBtn} onClick={duplicateQRCode}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 21L15 21C16.1046 21 17 20.1046 17 19L17 9C17 7.89543 16.1046 7 15 7L5 7C3.89543 7 3 7.89543 3 9L3 19C3 20.1046 3.89543 21 5 21Z"
                  stroke="black"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M7 7L7 5C7 4.46957 7.21071 3.96086 7.58579 3.58579C7.96086 3.21072 8.46957 3 9 3L19 3C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5L21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17L17 17"
                  stroke="black"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line
                  x1="10"
                  y1="10"
                  x2="10"
                  y2="18"
                  stroke="black"
                  strokeWidth="2"
                />
                <line
                  x1="6"
                  y1="14"
                  x2="14"
                  y2="14"
                  stroke="black"
                  strokeWidth="2"
                />
              </svg>
              <span className={styles.actionText}>Duplicate QR</span>
            </button>
            <button className={styles.actionBtn} onClick={createNewQRCode}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clip-path="url(#clip0_82_4965)">
                  <path
                    d="M5 -0.5H13.043L13.543 0H5C4.46957 0 3.96101 0.210865 3.58594 0.585938C3.21086 0.96101 3 1.46957 3 2V20C3 20.5304 3.21087 21.039 3.58594 21.4141C3.96101 21.7891 4.46957 22 5 22H17C17.5304 22 18.039 21.7891 18.4141 21.4141C18.7891 21.039 19 20.5304 19 20V5.45703L19.5 5.95703V20C19.5 20.663 19.2364 21.2987 18.7676 21.7676C18.2987 22.2364 17.663 22.5 17 22.5H5C4.33696 22.5 3.70126 22.2364 3.23242 21.7676C2.76358 21.2987 2.5 20.663 2.5 20V2C2.5 1.33696 2.76358 0.701263 3.23242 0.232422C3.70126 -0.236419 4.33696 -0.5 5 -0.5ZM11 9.25C11.0663 9.25 11.1299 9.27636 11.1768 9.32324C11.2236 9.37013 11.25 9.43369 11.25 9.5V12.25H14C14.0663 12.25 14.1299 12.2764 14.1768 12.3232C14.2236 12.3701 14.25 12.4337 14.25 12.5C14.25 12.5663 14.2236 12.6299 14.1768 12.6768C14.1299 12.7236 14.0663 12.75 14 12.75H11.25V15.5C11.25 15.5663 11.2236 15.6299 11.1768 15.6768C11.1299 15.7236 11.0663 15.75 11 15.75C10.9337 15.75 10.8701 15.7236 10.8232 15.6768C10.7764 15.6299 10.75 15.5663 10.75 15.5V12.75H8C7.93369 12.75 7.87013 12.7236 7.82324 12.6768C7.77636 12.6299 7.75 12.5663 7.75 12.5C7.75 12.4337 7.77636 12.3701 7.82324 12.3232C7.87013 12.2764 7.93369 12.25 8 12.25H10.75V9.5C10.75 9.4337 10.7764 9.37013 10.8232 9.32324C10.8701 9.27636 10.9337 9.25 11 9.25ZM18.793 5.25H15.5C15.0359 5.25 14.5909 5.06549 14.2627 4.7373C13.9345 4.40912 13.75 3.96413 13.75 3.5V0.207031L18.793 5.25Z"
                    fill="#34C759"
                    stroke="#017F01"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_82_4965">
                    <rect width="24" height="24" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <span className={styles.actionText}>New QR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
