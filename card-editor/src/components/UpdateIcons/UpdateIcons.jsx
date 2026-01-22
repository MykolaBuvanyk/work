import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UpdateIcons.scss';

const UpdateIcons = () => {
  const [iconsData, setIconsData] = useState({});
  const [newCatName, setNewCatName] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedLangs, setExpandedLangs] = useState({});

  const API_URL = import.meta.env.VITE_LAYOUT_API_SERVER;
  const IMG_URL = import.meta.env.VITE_LAYOUT_SERVER;

  const LANGUAGES = ["ua", "de", "fr", "it", "es", "pl", "cz", "nl", "se", "no", "dk", "hu", "hr", "ru", "en"];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get(`${API_URL}icons/get`);
      setIconsData(res.data || {});
    } catch (err) {
      console.error('Помилка завантаження');
    }
  };

  const handleAddCategory = () => {
    if (!newCatName) return;
    const formattedKey = newCatName.trim().replace(/\s+/g, '_');
    if (iconsData[formattedKey]) return alert('Вже існує');
    
    const emptyTitles = {};
    LANGUAGES.forEach(lang => {
        emptyTitles[lang] = lang === 'en' ? newCatName : "";
    });

    setIconsData({
      ...iconsData,
      [formattedKey]: {
        title: emptyTitles,
        icons: []
      }
    });
    setNewCatName('');
  };

  const handleDeleteCategory = (catKey) => {
    if (window.confirm(`Ви впевнені, що хочете видалити категорію "${catKey}"?`)) {
      const newData = { ...iconsData };
      delete newData[catKey];
      setIconsData(newData);
    }
  };

  const handleTitleChange = (catKey, lang, value) => {
    setIconsData({
      ...iconsData,
      [catKey]: {
        ...iconsData[catKey],
        title: {
          ...iconsData[catKey].title,
          [lang]: value
        }
      }
    });
  };

  const toggleLangSection = (catKey) => {
    setExpandedLangs(prev => ({ ...prev, [catKey]: !prev[catKey] }));
  };

  const handleDeleteIcon = (catKey, iconName) => {
    setIconsData({
      ...iconsData,
      [catKey]: {
        ...iconsData[catKey],
        icons: iconsData[catKey].icons.filter(i => i !== iconName)
      }
    });
  };

  const handleFileUpload = async (e, categoryKey) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_URL}icons/upload`, formData);
      setIconsData(prev => ({
        ...prev,
        [categoryKey]: {
          ...prev[categoryKey],
          icons: [...new Set([...prev[categoryKey].icons, res.data.fileName])]
        }
      }));
    } catch (err) {
      alert('Помилка завантаження');
    }
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}icons/save`, iconsData);
      alert('Збережено успішно!');
    } catch (err) {
      alert('Помилка збереження');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="update-icons-cont">
      <header className="admin-header">
        <h1>Керування категоріями та іконками</h1>
        <div className="top-bar">
          <input
            type="text"
            placeholder="Назва нової категорії (напр. auto_parts)..."
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
          />
          <button className="btn-add" onClick={handleAddCategory}>+ Створити категорію</button>
          <button className="save-all" onClick={handleSaveAll} disabled={loading}>
            {loading ? 'Збереження...' : 'ЗБЕРЕГТИ ВСІ ЗМІНИ'}
          </button>
        </div>
      </header>

      <div className="categories-grid">
        {Object.entries(iconsData).sort().map(([catKey, data]) => (
          <section key={catKey} className="category-block">
            <div className="cat-head">
              <div className="cat-info">
                <h2>{catKey} <span>({data.icons?.length || 0} іконок)</span></h2>
                <button className="btn-edit-langs" onClick={() => toggleLangSection(catKey)}>
                  {expandedLangs[catKey] ? '▲ Сховати переклади' : '▼ Редагувати переклади назви'}
                </button>
              </div>
              
              <div className="cat-actions">
                <label className="upload-btn">
                  <span>+ Додати SVG</span>
                  <input type="file" accept=".svg" hidden onChange={e => handleFileUpload(e, catKey)} />
                </label>
                <button 
                  className="btn-delete-cat" 
                  onClick={() => handleDeleteCategory(catKey)}
                  title="Видалити всю категорію"
                >
                  🗑️
                </button>
              </div>
            </div>

            {expandedLangs[catKey] && (
              <div className="langs-edit-grid">
                {LANGUAGES.map(lang => (
                  <div key={lang} className="lang-field">
                    <label>{lang.toUpperCase()}</label>
                    <input
                      type="text"
                      placeholder={`Назва (${lang})`}
                      value={data.title[lang] || ''}
                      onChange={(e) => handleTitleChange(catKey, lang, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="icons-list">
              {data.icons?.length > 0 ? (
                data.icons.map(icon => (
                  <div key={icon} className="icon-card">
                    <div className="preview">
                      <img src={`${IMG_URL}images/icon/${icon}`} alt={icon} />
                    </div>
                    <p title={icon}>{icon}</p>
                    <button 
                      className="btn-del" 
                      onClick={() => handleDeleteIcon(catKey, icon)}
                      title="Видалити іконку"
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-msg">В цій категорії ще немає іконок</div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default UpdateIcons;