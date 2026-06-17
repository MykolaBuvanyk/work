import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Link from '../Localized/LocalizedLink';
import styles from './CookieConsent.module.css';

const CookieConsent = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const cookieConsent = localStorage.getItem('cookieConsent');
    if (!cookieConsent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className={styles.cookie_overlay}>
      <div className={styles.cookie_container}>
        <div className={styles.cookie_content}>
          <h3 className={styles.cookie_title}>{t('cookieConsent.title')}</h3>
          <p className={styles.cookie_text}>
            {t('cookieConsent.descriptionBeforeLink')}{' '}
            <Link to="/privacy-policy" className={styles.cookie_link}>
              {t('cookieConsent.privacyLink')}
            </Link>
            .
          </p>
          <p className={styles.cookie_text_strong}>{t('cookieConsent.necessaryTitle')}</p>
          <p className={styles.cookie_text_gray}>
            {t('cookieConsent.necessaryDescription')}
          </p>
        </div>
        <div className={styles.cookie_buttons}>
          <button className={styles.cookie_button_accept} onClick={handleAccept}>
            {t('cookieConsent.acceptAll')}
          </button>
          <button className={styles.cookie_button_decline} onClick={handleDecline}>
            {t('cookieConsent.declineAll')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
