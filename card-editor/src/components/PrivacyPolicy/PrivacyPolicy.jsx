import styles from './PrivacyPolicy.module.css';
import { useTranslation } from 'react-i18next';

const PrivacyPolicy = () => {
  const {t}=useTranslation()
  const openCookie = () => {
    localStorage.removeItem('cookieConsent');
    window.location.reload();
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t("privacy-policy.description_3")}</h1>
          <p className={styles.intro}>
            {t("privacy-policy.description_1")}
          </p>
        </div>

        <div className={styles.sections}>
          {/* 1 */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("privacy-policy.description_2")}</h2>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_4")} <strong>SignXpert</strong> {t("privacy-policy.description_5")}
              </p>
            </div>
            <div className={styles.infoBox}>
              <p><strong>{t("privacy-policy.description_6")}</strong> {t("privacy-policy.description_7")}</p>
              <p><strong>VAT ID (USt-IdNr.):</strong> DE461817538</p>
              <p>
                <strong>E-mail:</strong>{' '}
                <a href="mailto:info@sign-xpert.com">info@sign-xpert.com</a>
              </p>
              <p>
                <strong>{t("privacy-policy.description_8")}</strong> {t("privacy-policy.description_9")}
              </p>
              <p>
                <strong>URL:</strong>{' '}
                <a href="https://sign-xpert.com" target="_blank" rel="noreferrer">
                  https://sign-xpert.com
                </a>
              </p>
              <p>
                <strong>{t("privacy-policy.description_10")}</strong>{' '}
                <a href="https://sign-xpert.com/contacts" target="_blank" rel="noreferrer">
                  https://sign-xpert.com/contacts
                </a>
              </p>
            </div>
          </section>

          {/* 2 */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>
              {t("privacy-policy.description_11")}
            </h2>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_12")}
              </p>
            </div>
            <div className={styles.warningBox}>
              <strong>{t("privacy-policy.description_13")}</strong> {t("privacy-policy.description_14")}
              (<em>{t("privacy-policy.description_15")}</em> {t("privacy-policy.description_16")} <em>{t("privacy-policy.description_17")}</em>), {t("privacy-policy.description_18")}{' '}
              <strong>{t("privacy-policy.description_19")}</strong>.
            </div>

            <h3 className={styles.subHeading}>
              {t("privacy-policy.description_20")}
            </h3>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_21")}
              </p>
              <ul>
                <li>{t("privacy-policy.description_22")}</li>
                <li>{t("privacy-policy.description_23")}</li>
                <li>{t("privacy-policy.description_24")}</li>
                <li>{t("privacy-policy.description_25")}</li>
                <li>{t("privacy-policy.description_26")}</li>
                <li>
                  {t("privacy-policy.description_27")}
                </li>
                <li>{t("privacy-policy.description_28")}</li>
              </ul>
            </div>

            <h3 className={styles.subHeading}>{t("privacy-policy.description_29")}</h3>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_30")}
              </p>
            </div>

            <h3 className={styles.subHeading}>{t("privacy-policy.description_31")}</h3>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_32")}
              </p>
              <p>
                <strong>{t("privacy-policy.description_33")}</strong> {t("privacy-policy.description_34")} <em>{t("privacy-policy.description_35")}</em>. {t("privacy-policy.description_36")}
              </p>
              <p>
                <strong>{t("privacy-policy.description_37")}</strong> {t("privacy-policy.description_38")}{' '}
                <em>{t("privacy-policy.description_39")}</em>.
              </p>
              <p>
                <strong>{t("privacy-policy.description_40")}</strong> {t("privacy-policy.description_41")}
              </p>
            </div>

            <h3 className={styles.subHeading}>{t("privacy-policy.description_42")}</h3>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_43")}
              </p>
            </div>
          </section>

          {/* 3 */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("privacy-policy.description_44")}</h2>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_45")}
              </p>
            </div>
          </section>

          {/* 4 */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("privacy-policy.description_46")}</h2>
            <div className={styles.body}>
              <p>
               {t("privacy-policy.description_47")}
              </p>
            </div>
          </section>

          {/* 5 */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("privacy-policy.description_48")}</h2>
            <div className={styles.body}>
              <p>{t("privacy-policy.description_49")}</p>
              <ul>
                <li>
                  <strong>{t("privacy-policy.description_50")}</strong> {t("privacy-policy.description_51")}
                </li>
                <li>
                  <strong>{t("privacy-policy.description_52")}</strong> {t("privacy-policy.description_53")}
                </li>
                <li>
                  <strong>{t("privacy-policy.description_54")}</strong> {t("privacy-policy.description_55")}
                </li>
                <li>
                  <strong>{t("privacy-policy.description_56")}</strong> {t("privacy-policy.description_57")}
                </li>
                <li>
                  <strong>{t("privacy-policy.description_58")}</strong> {t("privacy-policy.description_59")}
                </li>
                <li>
                  <strong>{t("privacy-policy.description_60")}</strong> {t("privacy-policy.description_61")}
                </li>
                <li>
                  <strong>{t("privacy-policy.description_62")}</strong> {t("privacy-policy.description_63")}
                </li>
                <li>
                  <strong>{t("privacy-policy.description_64")}</strong> {t("privacy-policy.description_65")}
                </li>
              </ul>
            </div>
            <div className={styles.infoBox}>
              <p>
                <strong>
                  The competent authority for us is located in the state of Baden-Württemberg:
                </strong>
              </p>
              <p>
                {t("privacy-policy.description_66")}
              </p>
              <p>
                <strong>{t("privacy-policy.description_67")}</strong> {t("privacy-policy.description_68")}
              </p>
            </div>
          </section>

          {/* 6 */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("privacy-policy.description_69")}</h2>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_70")} <strong>SignXpert</strong> {t("privacy-policy.description_71")}
              </p>
              <p>
                <em>
                  {t("privacy-policy.description_72")}
                </em>
              </p>
              <p>
                {t("privacy-policy.description_73")}{' '}
                <strong>{t("privacy-policy.description_74")}</strong>. {t("privacy-policy.description_75")}
              </p>
            </div>
          </section>

          {/* 7 */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("privacy-policy.description_76")}</h2>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_77")}{' '}
                <strong>SSL (Secure Socket Layer)</strong> {t("privacy-policy.description_78")}
              </p>
            </div>
          </section>

          {/* 8 */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("privacy-policy.description_79")}</h2>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_80")} <em>TDDDG</em> {t("privacy-policy.description_81")}
              </p>
              <p>
                <strong>{t("privacy-policy.description_82")}</strong> {t("privacy-policy.description_83")}
              </p>
              <p>
                <strong>{t("privacy-policy.description_84")}</strong> {t("privacy-policy.description_85")} <em>{t("privacy-policy.description_86")}</em> {t("privacy-policy.description_87")}
              </p>
              <p>
                {t("privacy-policy.description_88")}
              </p>
            </div>
          </section>
        </div>

        <button id="cookie" type="button" className={styles.cookieBtn} onClick={openCookie}>
          Cookie settings
        </button>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
