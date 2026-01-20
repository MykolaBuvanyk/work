import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UpdateIcons.scss';

const UpdateIcons = () => {
  const [iconsData, setIconsData] = useState({});
  const [newCatName, setNewCatName] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_LAYOUT_API_SERVER;
  const IMG_URL = import.meta.env.VITE_LAYOUT_SERVER;

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
    const formattedCatName = newCatName.trim().replace(/\s+/g, '_');
    if (iconsData[formattedCatName]) return alert('Вже існує');
    setIconsData({ ...iconsData, [formattedCatName]: [] });
    setNewCatName('');
  };

  // --- НОВА ФУНКЦІЯ ВИДАЛЕННЯ КАТЕГОРІЇ ---
  const handleDeleteCategory = categoryName => {
    if (
      window.confirm(
        `Ви впевнені, що хочете видалити категорію "${categoryName}" та всі іконки в ній?`
      )
    ) {
      const updatedData = { ...iconsData };
      delete updatedData[categoryName];
      setIconsData(updatedData);
    }
  };

  const handleDeleteIcon = (cat, name) => {
    setIconsData({
      ...iconsData,
      [cat]: iconsData[cat].filter(i => i !== name),
    });
  };

  const handleFileUpload = async (e, category) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_URL}icons/upload`, formData);
      const fileName = res.data.fileName;

      setIconsData(prev => ({
        ...prev,
        [category]: [...new Set([...prev[category], fileName])],
      }));
    } catch (err) {
      alert('Помилка завантаження файлу');
    }
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}icons/save`, iconsData);
      alert('Конфігурацію іконок оновлено!');
    } catch (err) {
      alert('Помилка збереження');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="update-icons-cont">
      <header className="admin-header">
        <h1>Керування іконками</h1>
        <div className="top-bar">
          <input
            type="text"
            placeholder="Назва нової категорії..."
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
          />
          <button onClick={handleAddCategory}>+ Створити категорію</button>
          <button className="save-all" onClick={handleSaveAll} disabled={loading}>
            {loading ? 'Збереження...' : 'ЗБЕРЕГТИ ЗМІНИ (JSON)'}
          </button>
        </div>
      </header>

      <div className="categories-grid">
        {Object.entries(iconsData).map(([cat, icons]) => (
          <section key={cat} className="category-block">
            <div className="cat-head">
              <div className="cat-title">
                <h2>
                  {cat.replace(/_/g, ' ')} <span>({icons.length})</span>
                </h2>
              </div>
              <div className="cat-actions">
                <label className="upload-btn">
                  + Завантажити SVG
                  <input
                    type="file"
                    accept=".svg"
                    hidden
                    onChange={e => handleFileUpload(e, cat)}
                  />
                </label>
                {/* КНОПКА ВИДАЛЕННЯ КАТЕГОРІЇ */}
                <button
                  className="delete-cat-btn"
                  onClick={() => handleDeleteCategory(cat)}
                  title="Видалити всю категорію"
                >
                  Видалити
                </button>
              </div>
            </div>

            <div className="icons-list">
              {icons.map(icon => (
                <div key={icon} className="icon-card">
                  <div className="preview">
                    <img src={`${IMG_URL}images/icon/${icon}`} alt="" />
                  </div>
                  <p title={icon}>{icon}</p>
                  <button className="btn-del" onClick={() => handleDeleteIcon(cat, icon)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default UpdateIcons;
