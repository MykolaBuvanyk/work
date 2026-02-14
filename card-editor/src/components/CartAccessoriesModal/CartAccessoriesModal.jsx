import React, { useEffect, useRef } from "react";
import baseStyles from "../AccessoriesModal/AccessoriesModal.module.css";
import styles from "./CartAccessoriesModal.module.css";
import SimpleButton from "../ui/buttons/simple-button/simple-button";

const CartAccessoriesModal = ({
  isOpen,
  onClose,
  onProceed,
  proceedDisabled = false,
  title = "The Accessories you selected:",
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

  useEffect(() => {
    if (!isOpen) return;
    const el = ref.current;
    if (!el) return;

    const updateScrollable = () => {
      const available = Math.floor(window.innerHeight * 0.9);
      const natural = el.scrollHeight;
      if (natural > available) {
        el.style.maxHeight = available + "px";
        el.style.overflowY = "auto";
      } else {
        el.style.maxHeight = "";
        el.style.overflowY = "visible";
      }
    };

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
    <div className={baseStyles.modalRoot}>
      <div className={baseStyles.dropdown} ref={ref}>
        <div className={baseStyles.dropdownHeader}>
          <h3>{title}</h3>
          <div className={styles.headerActions}>
            <SimpleButton
              text={proceedDisabled ? "Processing..." : "Proceed to checkout"}
              onClick={proceedDisabled ? undefined : onProceed}
              withIcon={true}
            />
          </div>
          <button className={baseStyles.closeBtn} onClick={onClose} aria-label="Close">
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
        <div className={baseStyles.content}>
          <ol className={baseStyles.list}>
            {items?.map((it, idx) => (
              <li key={it.id} className={baseStyles.row}>
                <div className={baseStyles.colIndex}>{idx + 1}</div>
                <div className={baseStyles.colCheckbox}>
                  <input
                    type="checkbox"
                    checked={!!it.checked}
                    onChange={() => onToggle?.(it.id)}
                  />
                </div>
                <div className={baseStyles.colThumb}>
                  <img className={baseStyles.thumb} src={it.img} alt={`${it.name} image`} />
                </div>
                <div className={baseStyles.colName}>{it.name}</div>
                <div className={baseStyles.colQty}>
                  <div className={baseStyles.inputGroup}>
                    <input
                      type="number"
                      min={0}
                      value={it.qty}
                      onChange={(e) => onSetQty?.(it.id, e.target.value)}
                    />
                    <div className={baseStyles.arrows}>
                      <i className="fa-solid fa-chevron-up" onClick={() => onInc?.(it.id)} />
                      <i className="fa-solid fa-chevron-down" onClick={() => onDec?.(it.id)} />
                    </div>
                  </div>
                </div>
                <div className={baseStyles.colPrice}>€ {it.price}</div>
                <div className={baseStyles.colDesc}>{it.desc}</div>
                <div className={baseStyles.colExtra}>
                  {it.hasExtra && it.extraImg ? (
                    <div className={baseStyles.extraWrap}>
                      {it.id === 4 ? <div className={baseStyles.extraLabel}>Example use</div> : null}
                      <img
                        className={baseStyles.extraThumb}
                        src={it.extraImg}
                        alt={`${it.name} extra`}
                        style={{
                          width: it.id === 4 ? 117 : it.id === 5 ? 96 : it.id === 6 ? 85 : undefined,
                          height: it.id === 4 ? 113 : it.id === 5 ? 130 : it.id === 6 ? 145 : undefined,
                        }}
                      />
                      <div className={baseStyles.extraPreviewOverlay} aria-hidden="true">
                        <img className={baseStyles.extraPreviewImage} src={it.extraImg} alt="" />
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

export default CartAccessoriesModal;
