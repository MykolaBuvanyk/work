import React from 'react';
import './Contacts.scss';
import { Link } from 'react-router-dom';
import { $host } from '../../http';
import { useTranslation } from 'react-i18next';

const Contacts = () => {
  const {t}=useTranslation()
  const sendWithContact = async (e) => {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);

    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      question: formData.get('question'),
    };

    try {
      await $host.post('email/contact', data);

      alert('Thank you for contacting SignXpert. We have received your message and will get back to you as soon as possible.');

      form.reset(); // очищення форми
    } catch (err) {
      alert('Error sending message');
    }
  };

  return (
    <div className='contacts-container'>
      <h1>{t("contacts.description_90")}</h1>

      <div className="contact-grid">
        <div className="info-column">
          <section>
            <div className="section-title2">{t("contacts.description_91")}</div>

            <div className="whatsapp-link">
              <span>Whats App</span>
            </div>

            <div className='contact-text'>+49 157 766 25 125</div>
          </section>

          <section>
            <div className="section-title2">E-mail</div>
            <Link to={'mailto:info@sign-xpert.com'} className="email-link">
              info@sign-xpert.com
            </Link>
          </section>

          <section>
            <div className="section-title2">{t("contacts.description_92")}</div>
            <div className="contact-text address-box">
              Baumwiesen 2<br />
              Haigerloch<br />
              72401 Germany
            </div>
          </section>

          <section>
            <div className="section-title2">{t("contacts.description_93")}</div>
            <div className="contact-text">{t("contacts.description_94")}</div>
          </section>
        </div>

        <div className="form-column">
          <div className="form-title2">
           {t("contacts.description_95")}
          </div>

          <form onSubmit={sendWithContact}>
            <div className="input-group">
              <label htmlFor="name">{t("contacts.description_96")}</label>
              <input type="text" id="name" name="name" required />
            </div>

            <div className="input-group">
              <label htmlFor="email">*E-mail</label>
              <input type="email" id="email" name="email" required />
            </div>

            <div className="input-group">
              <label htmlFor="question">{t("contacts.description_97")}</label>
              <textarea
                id="question"
                name="question"
                rows={5}
                required
              />
            </div>

            <button type="submit" className="send-btn">
              {t("contacts.description_98")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contacts;