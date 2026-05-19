import React from "react";
import { useTranslation } from "react-i18next";
import styles from "./TopSidebar.module.css";
// Project buttons and modals moved to TopToolbar.

const TopSidebar = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.topSidebar}>
      {/* Project buttons moved to TopToolbar */}
      <div className={styles.textWrapper}>
        <p className={styles.bold}>{t("TopSidebar.material")}</p>
        <p>{t("TopSidebar.engravedPlastic")}</p>
      </div>
    </div>
  );
};

export default TopSidebar;
