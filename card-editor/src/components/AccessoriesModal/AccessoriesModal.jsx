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
  console.log(832843284,items);
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

  // Динамічно вмикаємо внутрішній скрол лише коли модалка вища за доступну висоту екрана
  useEffect(() => {
    if (!isOpen) return;
    const el = ref.current;
    if (!el) return;

    const updateScrollable = () => {
      // Враховуємо top: 5% для .modalRoot -> даємо ~90% висоти екрана під модалку
      const available = Math.floor(window.innerHeight * 0.9);
      // scrollHeight дає природну висоту контенту модалки
      const natural = el.scrollHeight;
      if (natural > available) {
        el.style.maxHeight = available + "px";
        el.style.overflowY = "auto";
      } else {
        el.style.maxHeight = "";
        el.style.overflowY = "visible";
      }
    };

    // Оновлюємо одразу, на ресайзі і коли завантажуються зображення
    updateScrollable();
    window.addEventListener("resize", updateScrollable);

    const imgs = el.querySelectorAll("img");
    const onImgLoad = () => updateScrollable();
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener("load", onImgLoad);
    });

    const mo = new MutationObserver(() => updateScrollable());
    mo.observe(el, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("resize", updateScrollable);
      imgs.forEach((img) => img.removeEventListener("load", onImgLoad));
      mo.disconnect();
    };
  }, [isOpen]);

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
                d="M12.0008 12.0001L14.8292 14.8285M9.17236 14.8285L12.0008 12.0001L9.17236 14.8285ZM14.8292 9.17163L12.0008 12.0001L14.8292 9.17163ZM12.0008 12.0001L9.17236 9.17163L12.0008 12.0001Z"
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
                    className={styles.thumb}
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
                <div className={styles.colPrice}>€ {it.price}</div>
                <div className={styles.colDesc}>{it.desc}</div>
                <div className={styles.colExtra}>
                  {it.hasExtra && it.extraImg ? (
                    <div className={styles.extraWrap}>
                      {it.id === 4 ? (
                        <div className={styles.extraLabel}>Example use</div>
                      ) : null}
                      <img
                        className={styles.extraThumb}
                        src={it.extraImg}
                        alt={`${it.name} extra`}
                        style={{
                          // Фіксовані розміри додаткових картинок без наведення
                          width:
                            it.id === 4
                              ? 117
                              : it.id === 5
                              ? 96
                              : it.id === 6
                              ? 85
                              : undefined,
                          height:
                            it.id === 4
                              ? 113
                              : it.id === 5
                              ? 130
                              : it.id === 6
                              ? 145
                              : undefined,
                        }}
                      />
                      {/* Збільшене превʼю при наведенні */}
                      <div
                        className={styles.extraPreviewOverlay}
                        aria-hidden="true"
                      >
                        <img
                          className={styles.extraPreviewImage}
                          src={it.extraImg}
                          alt=""
                        />
                      </div>
                    </div>
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
