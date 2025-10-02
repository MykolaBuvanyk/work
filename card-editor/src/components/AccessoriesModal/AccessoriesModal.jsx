import React, { useEffect, useRef } from "react";
import styles from "./AccessoriesModal.module.css";

const AccessoriesModal = ({
  isOpen,
  onClose,
  title = "Accessories",
  items,
  onToggle,
  onSetQty,
  onInc,
  onDec,
}) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose && onClose();
      }
    };
    document.addEventListener("mousedown", handleOutside, true);
    document.addEventListener("touchstart", handleOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside, true);
      document.removeEventListener("touchstart", handleOutside, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalRoot}>
      <div className={styles.dropdown} ref={ref}>
        <div className={styles.dropdownHeader}>
          <h3>{title}</h3>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6 6L18 18"
                stroke="#333"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M18 6L6 18"
                stroke="#333"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className={styles.content}>
          <ol className={styles.list}>
            {items?.map((it, idx) => (
              <li key={it.id} className={styles.row}>
                <div className={styles.colIndex}>{idx + 1}</div>
                <div className={styles.colCheckbox}>
                  <input
                    type="checkbox"
                    checked={!!it.checked}
                    onChange={() => onToggle?.(it.id)}
                  />
                </div>
                <div className={styles.colThumb}>
                  <img
                    className={`${styles.thumb} ${
                      it.id === 1 || it.id === 4 || it.id === 5 || it.id === 6
                        ? styles.thumbSm
                        : ""
                    }`}
                    src={it.img}
                    alt={`${it.name} image`}
                  />
                </div>
                <div className={styles.colName}>{it.name}</div>
                <div className={styles.colQty}>
                  <div className={styles.inputGroup}>
                    <input
                      type="number"
                      min={0}
                      value={it.qty}
                      onChange={(e) => onSetQty?.(it.id, e.target.value)}
                    />
                    <div className={styles.arrows}>
                      <i
                        className="fa-solid fa-chevron-up"
                        onClick={() => onInc?.(it.id)}
                      />
                      <i
                        className="fa-solid fa-chevron-down"
                        onClick={() => onDec?.(it.id)}
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.colPrice}>€ {it.price.toFixed(2)}</div>
                <div className={styles.colDesc}>{it.desc}</div>
                <div className={styles.colExtra}>
                  {it.hasExtra && it.extraImg ? (
                    <img
                      className={`${styles.extraThumb} ${
                        it.id === 6 ? styles.extraThumbSm : ""
                      }`}
                      src={it.extraImg}
                      alt={`${it.name} extra`}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
};

export default AccessoriesModal;
