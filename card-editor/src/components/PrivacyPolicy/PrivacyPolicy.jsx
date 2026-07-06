import styles from './PrivacyPolicy.module.css';
import { useTranslation } from 'react-i18next';

const PrivacyPolicy = () => {
  const { t } = useTranslation();

  const openCookie = () => {
    localStorage.removeItem('cookieConsent');
    window.location.reload();
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        
        {/* HEADER */}
        <div className={styles.header}>
          <h1 className={styles.title}>{t("privacy-policy.description_1")}</h1>
          <p className={styles.intro}>
            {t("privacy-policy.description_2")}
          </p>
        </div>

        {/* SECTIONS */}
        <div className={styles.sections}>
          
          {/* 1. Controller */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("privacy-policy.description_3")}</h2>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_4")} <strong>SignXpert</strong> {t("privacy-policy.description_5")}
              </p>
            </div>
            
            <div className={styles.infoBox}>
              <p><strong>{t("privacy-policy.description_6")}</strong> {t("privacy-policy.description_7")}</p>
              <p><strong>{t("privacy-policy.description_8")}</strong> {t("privacy-policy.description_9")}</p>
              <p><strong>VAT ID (USt-IdNr.):</strong> DE461817538</p>
              <p>
                <strong>E-mail:</strong>{' '}
                <a href="mailto:info@signxpert.com">info@signxpert.com</a>
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

          {/* 2. Collection, Processing and Use */}
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
              <strong>{t("privacy-policy.description_13")}</strong> {t("privacy-policy.description_14")}{' '}
              (<em>{t("privacy-policy.description_15")}</em> {t("privacy-policy.description_16")} <em>{t("privacy-policy.description_17")}</em>),{' '}
              {t("privacy-policy.description_18")} <strong>{t("privacy-policy.description_19")}</strong>.
            </div>

            <div className={styles.body} style={{ marginTop: '1rem' }}>
              <p>
                <strong>{t("privacy-policy.description_20")}</strong> {t("privacy-policy.description_21")}
              </p>
            </div>

            {/* 2.1 */}
            <h3 className={styles.subHeading}>
              {t("privacy-policy.description_22")}
            </h3>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_23")}
              </p>
              <ul>
                <li>{t("privacy-policy.description_24")}</li>
                <li>{t("privacy-policy.description_25")}</li>
                <li>{t("privacy-policy.description_26")}</li>
                <li>{t("privacy-policy.description_27")}</li>
                <li>{t("privacy-policy.description_28")}</li>
                <li>{t("privacy-policy.description_29")}</li>
                <li>{t("privacy-policy.description_30")}</li>
              </ul>
            </div>

            {/* 2.2 */}
            <h3 className={styles.subHeading}>{t("privacy-policy.description_31")}</h3>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_32")}
              </p>
            </div>

            {/* 2.3 */}
            <h3 className={styles.subHeading}>{t("privacy-policy.description_33")}</h3>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_34")}
              </p>
              <p>
                <strong>Stripe:</strong> {t("privacy-policy.description_35")}
              </p>
              <p>
                <strong>Sparkasse:</strong> {t("privacy-policy.description_36")}
              </p>
              <p>
                <strong>PayPal:</strong> {t("privacy-policy.description_37")}
              </p>
            </div>

            {/* 2.4 */}
            <h3 className={styles.subHeading}>{t("privacy-policy.description_38")}</h3>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_39")}
              </p>
            </div>

            {/* 2.5 */}
            <h3 className={styles.subHeading}>{t("privacy-policy.description_40")}</h3>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_41")}
              </p>
            </div>

            {/* 2.6 */}
            <h3 className={styles.subHeading}>{t("privacy-policy.description_42")}</h3>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_43")}
              </p>
            </div>
          </section>

          {/* 3. Credit Check */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("privacy-policy.description_44")}</h2>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_45")}
              </p>
            </div>
          </section>

          {/* 4. Transfer of Data */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("privacy-policy.description_46")}</h2>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_47")}
              </p>
            </div>
          </section>

          {/* 5. Your Rights */}
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
                  {t("privacy-policy.description_66")}
                </strong>
              </p>
              <p>
                {t("privacy-policy.description_67")}
              </p>
              <p>
                <strong>{t("privacy-policy.description_68")}</strong> {t("privacy-policy.description_69")}
              </p>
            </div>
          </section>

          {/* 6. Log Files */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("privacy-policy.description_70")}</h2>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_71")}
              </p>
              <p>
                {t("privacy-policy.description_72")} <strong>{t("privacy-policy.description_73")}</strong>
              </p>
            </div>
          </section>

          {/* 7. Secure Data Transmission */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("privacy-policy.description_74")}</h2>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_75")} <strong>SSL (Secure Socket Layer)</strong> {t("privacy-policy.description_76")}
              </p>
            </div>

            {/* 7.1 */}
            <h3 className={styles.subHeading}>{t("privacy-policy.description_77")}</h3>
            <div className={styles.body}>
              <p>
                {t("privacy-policy.description_78")}
              </p>
            </div>
          </section>

          {/* 8. Cookies */}
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
                <strong>{t("privacy-policy.description_84")}</strong> {t("privacy-policy.description_85")}
              </p>
              <p>
                {t("privacy-policy.description_86")}
              </p>

              {/* 8.1 Use of Google Analytics */}
              <h3 className={styles.subHeading} style={{ marginTop: '1.5rem' }}>
                {t("privacy-policy.description_87")}
              </h3>
              <p>
                {t("privacy-policy.description_88")}
              </p>
              <p>
                <strong>{t("privacy-policy.description_89")}</strong> {t("privacy-policy.description_90")}
              </p>
              <p>
                <strong>{t("privacy-policy.description_91")}</strong> {t("privacy-policy.description_92")}
              </p>
              <p>
                <strong>{t("privacy-policy.description_93")}</strong> {t("privacy-policy.description_94")}
              </p>
              <p>
                <strong>{t("privacy-policy.description_95")}</strong> {t("privacy-policy.description_96")}
              </p>
              <p>
                <strong>{t("privacy-policy.description_97")}</strong> {t("privacy-policy.description_98")}
              </p>
            </div>
          </section>

        </div>

        {/* COOKIE SETTINGS BUTTON */}
        <button id="cookie" type="button" className={styles.cookieBtn} onClick={openCookie}>
          {t("Footer.info.cookieSettings")}
        </button>

      </div>
    </div>
  );
};

export default PrivacyPolicy;