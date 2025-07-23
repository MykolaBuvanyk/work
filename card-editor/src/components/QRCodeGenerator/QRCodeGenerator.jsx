import React, { useState } from 'react';
import { useCanvasContext } from '../../contexts/CanvasContext';
import QRCode from 'qrcode';
import * as fabric from "fabric";
import styles from './QRCodeGenerator.module.css';

const QRCodeGenerator = () => {
  const { canvas } = useCanvasContext();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({
    url: '',
    email: '',
    phone: '',
    wifiSSID: '',
    wifiPassword: '',
    wifiSecurity: 'WPA',
    message: ''
  });

  const qrTypes = [
    { id: 'url', label: 'URL (Website)', icon: '🌐' },
    { id: 'email', label: 'E-MAIL', icon: '📧' },
    { id: 'phone', label: 'Call (Phone)', icon: '📞' },
    { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
    { id: 'wifi', label: 'Wi-Fi', icon: '📶' },
    { id: 'message', label: 'Message', icon: '💭' }
  ];

  const wifiSecurityTypes = [
    { value: 'WPA', label: 'WPA' },
    { value: 'WPA2-EAP', label: 'WPA2-EAP' },
    { value: 'nopass', label: 'Without Password' }
  ];

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    // Очищуємо форму при зміні типу
    setFormData({
      url: '',
      email: '',
      phone: '',
      wifiSSID: '',
      wifiPassword: '',
      wifiSecurity: 'WPA',
      message: ''
    });
  };

  const generateQRData = () => {
    switch (selectedType) {
      case 'url':
        return formData.url || 'https://example.com';
      
      case 'email':
        return `mailto:${formData.email}`;
      
      case 'phone':
        return `tel:${formData.phone}`;
      
      case 'whatsapp':
        return `https://wa.me/${formData.phone.replace(/[^0-9]/g, '')}`;
      
      case 'wifi':
        if (formData.wifiSecurity === 'nopass') {
          return `WIFI:T:nopass;S:${formData.wifiSSID};;`;
        }
        return `WIFI:T:${formData.wifiSecurity};S:${formData.wifiSSID};P:${formData.wifiPassword};;`;
      
      case 'message':
        return formData.message || 'Default message';
      
      default:
        return 'https://example.com';
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
          dark: '#000000',
          light: '#FFFFFF'
        }
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
      setIsOpen(false);
      setSelectedType(null);
      
    } catch (error) {
      console.error('Помилка генерації QR-коду:', error);
      alert('Помилка генерації QR-коду');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const renderForm = () => {
    if (!selectedType) return null;

    switch (selectedType) {
      case 'url':
        return (
          <div className={styles.formGroup}>
            <label>Website - Link</label>
            <input
              type="url"
              placeholder="https://example.com"
              value={formData.url}
              onChange={(e) => handleInputChange('url', e.target.value)}
            />
          </div>
        );

      case 'email':
        return (
          <div className={styles.formGroup}>
            <label>Email Address</label>
            <input
              type="email"
              placeholder="example@domain.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
            />
          </div>
        );

      case 'phone':
        return (
          <div className={styles.formGroup}>
            <label>Phone Number</label>
            <input
              type="tel"
              placeholder="+380123456789"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
            />
          </div>
        );

      case 'whatsapp':
        return (
          <div className={styles.formGroup}>
            <label>WhatsApp Number</label>
            <input
              type="tel"
              placeholder="+380123456789"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
            />
          </div>
        );

      case 'wifi':
        return (
          <div className={styles.formGroup}>
            <label>Network Name (SSID)</label>
            <input
              type="text"
              placeholder="WiFi Network Name"
              value={formData.wifiSSID}
              onChange={(e) => handleInputChange('wifiSSID', e.target.value)}
            />
            
            <label>Security Type</label>
            <select
              value={formData.wifiSecurity}
              onChange={(e) => handleInputChange('wifiSecurity', e.target.value)}
            >
              {wifiSecurityTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            
            {formData.wifiSecurity !== 'nopass' && (
              <>
                <label>Password</label>
                <input
                  type="password"
                  placeholder="WiFi Password"
                  value={formData.wifiPassword}
                  onChange={(e) => handleInputChange('wifiPassword', e.target.value)}
                />
              </>
            )}
          </div>
        );

      case 'message':
        return (
          <div className={styles.formGroup}>
            <label>Custom Message</label>
            <textarea
              placeholder="Enter your message here..."
              value={formData.message}
              onChange={(e) => handleInputChange('message', e.target.value)}
              rows={3}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.qrGenerator}>
      <div 
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>📱</span>
        <span>QR Code</span>
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <h3>QR Code</h3>
            <button 
              className={styles.closeBtn}
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          <div className={styles.content}>
            <p>The minimum size of QR Code is 20 x 20 mm</p>
            
            {!selectedType ? (
              <div className={styles.typesList}>
                {qrTypes.map(type => (
                  <div
                    key={type.id}
                    className={styles.typeItem}
                    onClick={() => handleTypeSelect(type.id)}
                  >
                    <span className={styles.typeIcon}>{type.icon}</span>
                    <span className={styles.typeLabel}>{type.label}</span>
                    <span className={styles.description}>
                      {type.id === 'url' && '* Scan to visit Website'}
                      {type.id === 'email' && '* Scan to send an Email'}
                      {type.id === 'phone' && '* Scan to call directly'}
                      {type.id === 'whatsapp' && '* Scan to send Message'}
                      {type.id === 'wifi' && '* Scan to connect to Network'}
                      {type.id === 'message' && '* Scan to read Custom Message'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.formContainer}>
                <div className={styles.selectedType}>
                  <button
                    className={styles.backBtn}
                    onClick={() => setSelectedType(null)}
                  >
                    ← Back
                  </button>
                  <h4>{qrTypes.find(t => t.id === selectedType)?.label}</h4>
                </div>
                
                {renderForm()}
                
                <div className={styles.actions}>
                  <button 
                    className={styles.updateBtn}
                    onClick={generateQRCode}
                  >
                    Generate QR Code
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QRCodeGenerator;
