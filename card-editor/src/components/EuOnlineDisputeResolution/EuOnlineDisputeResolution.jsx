import styles from './EUOnlineDisputeResolution.module.css';
import { useTranslation } from 'react-i18next';

const EUOnlineDisputeResolution = () => {
  const {t}=useTranslation()
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t("EUOnlineDisputeResolution.u_1")}</h1>

      <section className={styles.section}>
        <p className={styles.body}>
          {t("EUOnlineDisputeResolution.u_2")}{' '}
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer">
            https://ec.europa.eu/consumers/odr/
          </a>
          .
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>{t("EUOnlineDisputeResolution.u_3")}</h2>
        <p className={styles.body}>
          {t("EUOnlineDisputeResolution.u_4")}
        </p>
      </section>
    </div>
  );
};

export default EUOnlineDisputeResolution;
