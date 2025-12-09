import { useState, useEffect } from 'react';
import styles from './CookieConsent.module.css';

const CookieConsent = () => {
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
          <h3 className={styles.cookie_title}>Data improves your experience</h3>
          <p className={styles.cookie_text}>
            In order to enhance your experience across our platforms and show you more relevant
            information, we use cookies and similar technologies, both SignXpert owned and third
            party owned, as well as data sent directly from our servers. You can manage your
            preferences anytime in{' '}
            <a href="/privacy-policy" className={styles.cookie_link}>
              {' '}
              Privacy & Cookie Settings
            </a>
            .
          </p>
          <p className={styles.cookie_text_strong}>Strictly necessary (always on)</p>
          <p className={styles.cookie_text_gray}>
            Enables core functionality to power your language, region, and shopping preferences.
          </p>
        </div>
        <div className={styles.cookie_buttons}>
          <button className={styles.cookie_button_accept} onClick={handleAccept}>
            Accept all
          </button>
          <button className={styles.cookie_button_decline} onClick={handleDecline}>
            Decline all
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
