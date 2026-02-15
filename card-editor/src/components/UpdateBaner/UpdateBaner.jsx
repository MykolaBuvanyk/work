import React, { useState } from 'react';
import './UpdateBaner.scss';
import { MdCloudUpload } from 'react-icons/md';
import { $authHost } from '../../http';
import combinedCountries from '../Countries';


const UpdateBaner = () => {
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const API_URL = import.meta.env.VITE_LAYOUT_API_SERVER;
  const IMG_URL = import.meta.env.VITE_LAYOUT_SERVER;

  const handleUpload = async (e, langCode) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('lang', langCode);
    formData.append('file', file);

    try {
      await $authHost.post(`${API_URL}icons/upload-baner`, formData);
      setRefreshKey(Date.now());
    } catch (err) {
      alert(err.response?.data?.message || 'Помилка завантаження. Тільки JPEG!');
    }
  };

  return (
    <div className="update-baner-container">
      <header className="header-section">
        <h1>Налаштування мовних банерів</h1>
        <p>Завантажте JPEG файли для кожного регіону. Назва файлу генерується автоматично.</p>
      </header>

      <div className="banners-grid">
        {combinedCountries.map((lang) => (
          <div key={lang.code} className="banner-card">
            <div className="card-header">
              <div className="flag-wrapper">
                {lang.flag}
              </div>
              <div className="lang-info">
                <span className="lang-name">{lang.label}</span>
                <span className="file-spec">{lang.code}.jpeg</span>
              </div>
            </div>
            
            <div className="preview-container">
              <div className="image-wrapper">
                <img 
                  src={`${IMG_URL}images/baner/${lang.code}.jpeg?t=${refreshKey}`} 
                  alt={lang.label}
                  onError={(e) => { 
                    e.target.src = 'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg'; 
                  }}
                />
              </div>
              <label className="upload-label">
                <input 
                  type="file" 
                  accept="image/jpeg" 
                  hidden 
                  onChange={(e) => handleUpload(e, lang.code)} 
                />
                <div className="upload-btn">
                  <MdCloudUpload />
                  <span>Оновити</span>
                </div>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpdateBaner;