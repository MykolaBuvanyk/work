import React, { useEffect, useState } from "react";
import styles from "./SaveAsTemplateModal.module.css";
import { fetchTemplateCategories } from "../../http/templates";

const SaveAsTemplateModal = ({ onClose, onSave, isAdmin }) => {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!isAdmin) return;

    fetchTemplateCategories()
      .then((data) => {
        if (!mounted) return;
        setCategories(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        console.warn("Failed to fetch template categories", e);
        if (!mounted) return;
        setCategories([]);
      });

    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  const handleSave = async () => {
    if (!onSave || isSaving) return;
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      alert("Please enter a template name");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmed, selectedCategoryId || null);
      onClose && onClose();
    } catch (e) {
      console.error("Save template failed", e);
      alert("Failed to save template. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.modal}>
      <div className={styles.header}>
        <p className={styles.title}>Save Template as</p>
        <svg
          onClick={onClose}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12.0003 12L14.8287 14.8284M9.17188 14.8284L12.0003 12L9.17188 14.8284ZM14.8287 9.17157L12.0003 12L14.8287 9.17157ZM12.0003 12L9.17188 9.17157L12.0003 12Z"
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

        <div className={styles.field}>
          <div className={styles.label}>(Name)</div>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
          />
        </div>

        {isAdmin ? (
          <div className={styles.field}>
            <div className={styles.label}>(Category)</div>
            <select
              className={styles.input}
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className={styles.buttons}>
        <button onClick={handleSave} disabled={isSaving}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 19V5C3 3.89543 3.89543 3 5 3H16.1716C16.702 3 17.2107 3.21071 17.5858 3.58579L20.4142 6.41421C20.7893 6.78929 21 7.29799 21 7.82843V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19Z"
              stroke="#0BC944"
              strokeWidth="1.5"
            />
            <path
              d="M8.6 9H15.4C15.7314 9 16 8.73137 16 8.4V3.6C16 3.26863 15.7314 3 15.4 3H8.6C8.26863 3 8 3.26863 8 3.6V8.4C8 8.73137 8.26863 9 8.6 9Z"
              stroke="#0BC944"
              strokeWidth="1.5"
            />
            <path
              d="M6 13.6V21H18V13.6C18 13.2686 17.7314 13 17.4 13H6.6C6.26863 13 6 13.2686 6 13.6Z"
              stroke="#0BC944"
              strokeWidth="1.5"
            />
          </svg>
          {isSaving ? "Saving..." : "Save"}
        </button>

        <button onClick={onClose} disabled={isSaving}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.0003 12L14.8287 14.8284M9.17188 14.8284L12.0003 12L9.17188 14.8284ZM14.8287 9.17157L12.0003 12L14.8287 9.17157ZM12.0003 12L9.17188 9.17157L12.0003 12Z"
              stroke="#FF0000"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
              stroke="#FF0000"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SaveAsTemplateModal;
