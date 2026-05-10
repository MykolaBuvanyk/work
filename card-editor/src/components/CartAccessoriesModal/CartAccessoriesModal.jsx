import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import baseStyles from "../AccessoriesModal/AccessoriesModal.module.css";
import styles from "./CartAccessoriesModal.module.css";
import SimpleButton from "../ui/buttons/simple-button/simple-button";

const CartAccessoriesModal = ({
  isOpen,
  onClose,
  onProceed,
  proceedDisabled = false,
  title,
  items,
  onToggle,
  onSetQty,
  onInc,
  onDec,
}) => {
  const { t } = useTranslation();
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

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
  const orderedItems = Array.isArray(items)
    ? items
        .map((item, originalIndex) => ({ item, originalIndex }))
        .sort((a, b) => {
          const aChecked = a.item?.checked ? 1 : 0;
          const bChecked = b.item?.checked ? 1 : 0;
          if (aChecked !== bChecked) return bChecked - aChecked;
          return a.originalIndex - b.originalIndex;
        })
        .map(({ item }) => item)
    : [];

  const parseNumber = (raw) => {
    if (raw === "") return 0;
    const n = parseFloat(String(raw).replace(",", "."));
    return isNaN(n) || n < 0 ? 0 : Math.floor(n);
  };

  const formatPrice = (val) => `€ ${Number(val || 0).toFixed(2)}`;
  const getAccessoryName = (item) => (item?.nameKey ? t(item.nameKey) : item.name);
  const getAccessoryDesc = (item) => (item?.descKey ? t(item.descKey) : item.desc);

  return (
    <div className={baseStyles.modalRoot}>
      <div className={baseStyles.dropdown} ref={ref}>
        <div className={baseStyles.dropdownHeader}>
          <h3>{title || t("infoAboutProject.accessoriesSelected")}</h3>
          <div className={styles.headerActions}>
            <SimpleButton
              text={proceedDisabled ? t("cartAccessoriesModal.processing") : t("cartAccessoriesModal.continueToCheckout")}
              onClick={proceedDisabled ? undefined : onProceed}
              withIcon={true}
            />
          </div>
          <button className={baseStyles.closeBtn} onClick={onClose} aria-label={t("cartAccessoriesModal.close")}>
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
            {orderedItems.map((it, idx) => (
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
                  <img className={baseStyles.thumb} src={it.img} alt={t("accessoriesModal.itemImageAlt", { name: getAccessoryName(it) })} />
                </div>
                <div className={baseStyles.colName}>{getAccessoryName(it)}</div>
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
                <div className={baseStyles.colPrice}>{formatPrice(it.price * parseNumber(it.qty))}</div>
                <div className={baseStyles.colDesc}>{getAccessoryDesc(it)}</div>
                <div className={baseStyles.colExtra}>
                  {it.hasExtra && it.extraImg ? (
                    <div className={baseStyles.extraWrap}>
                      {it.id === 4 ? <div className={baseStyles.extraLabel}>{t("cartAccessoriesModal.exampleUse")}</div> : null}
                      <img
                        className={baseStyles.extraThumb}
                        src={it.extraImg}
                        alt={t("accessoriesModal.itemExtraAlt", { name: getAccessoryName(it) })}
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
