import React, { useEffect, useRef } from "react";
import baseStyles from "../AccessoriesModal/AccessoriesModal.module.css";
import styles from "./OrderTestModal.module.css";
import SimpleButton from "../ui/buttons/simple-button/simple-button";

const CloseIcon = () => (
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
);

const OrderTestModal = ({
  isOpen,
  onClose,
  onProceed,
  proceedDisabled = false,
  projectTitle = "",
  totalSigns = 0,
  accessories = [],
  signs = [],
}) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onClose?.();
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

  const accessoriesSummary = accessories.length
    ? accessories.map((item) => `${item.qty} ${item.name}`).join(", ")
    : "No accessories selected";

  return (
    <div className={baseStyles.modalRoot}>
      <div className={`${baseStyles.dropdown} ${styles.modal}`} ref={ref}>
        <div className={baseStyles.dropdownHeader}>
          <h3>Order test summary</h3>

          <div className={styles.headerActions}>
            <SimpleButton
              text={proceedDisabled ? "Preparing..." : "Proceed to accessories"}
              onClick={proceedDisabled ? undefined : onProceed}
              withIcon
            />
          </div>

          <button className={baseStyles.closeBtn} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className={`${baseStyles.content} ${styles.content}`}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Project</span>
              <strong>{projectTitle || "Untitled"}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Count Signs</span>
              <strong>{totalSigns}</strong>
            </div>
            <div className={`${styles.summaryCard} ${styles.summaryCardWide}`}>
              <span className={styles.summaryLabel}>
                Accessories: {accessories.length} Types
              </span>
              <strong>{accessoriesSummary}</strong>
            </div>
          </div>

          <div className={styles.signsList}>
            {signs.length > 0 ? (
              signs.map((sign) => (
                <article key={sign.id} className={styles.signCard}>
                  <div className={styles.signHeader}>
                    <div>
                      <h4>{sign.title}</h4>
                      <p>{sign.metaLine}</p>
                    </div>
                  </div>

                  <p className={styles.textLine}>
                    <span>Text:</span> {sign.textLine}
                  </p>

                  <div className={styles.countsRow}>
                    <span>{sign.counts.shapes} Shapes</span>
                    <span>{sign.counts.cutFigures} Cut Figures</span>
                    <span>{sign.counts.holes} Holes</span>
                    <span>{sign.counts.qrCodes} QR</span>
                    <span>{sign.counts.barcodes} Bar Codes</span>
                    <span>{sign.counts.images} Images</span>
                  </div>
                </article>
              ))
            ) : (
              <div className={styles.emptyState}>No signs found in this project snapshot.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTestModal;