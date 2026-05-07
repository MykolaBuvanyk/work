import { Link } from 'react-router-dom';
import styles from './Contacts.module.css';

const Contacts = () => {
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Contacts</h1>

      <div className={styles.contact}>
        <div className={styles.info}>
          <p className={styles.infoLabel}>Customer Service</p>

          <div className={styles.infoSection}>
            <p className={styles.infoLabel}>Whats App</p>
            <p className={styles.infoValue}>+49 157 766 25 125</p>
          </div>

          <div className={styles.infoSection}>
            <p className={styles.infoLabel}>E-mail</p>
            <a className={styles.emailLink} href="mailto:info@sign-xpert.com">
              info@sign-xpert.com
            </a>
          </div>

          <div className={styles.infoSection}>
            <p className={styles.infoLabel}>Registered Address</p>
            <p className={styles.infoValue}>
              Baumwiesen 2<br />
              Haigerloch<br />
              72401 Germany
            </p>
          </div>

          <div className={styles.infoSection}>
            <p className={styles.infoLabel}>Opening Times</p>
            <p className={styles.infoValue}>Monday - Friday, 08:00 - 19:00</p>
          </div>
        </div>

        <div className={styles.formSection}>
          <p className={styles.formTitle}>Or use this form to contact us</p>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="contact-name">Name</label>
            <input id="contact-name" className={styles.input} type="text" />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="contact-email">*E-mail</label>
            <input id="contact-email" className={styles.input} type="email" required />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="contact-question">*Question</label>
            <textarea id="contact-question" className={styles.textarea} required />
          </div>

          <button type="submit" className={styles.sendBtn}>SEND</button>
        </div>
      </div>
    </div>
  );
};

export default Contacts;
