import React from 'react';
import './Contacts.scss';
import { Link } from 'react-router-dom';
import { $host } from '../../http';

const Contacts = () => {
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

      alert('Message sent successfully');

      form.reset(); // очищення форми
    } catch (err) {
      alert('Error sending message');
    }
  };

  return (
    <div className='contacts-container'>
      <h1>Contacts</h1>

      <div className="contact-grid">
        <div className="info-column">
          <section>
            <div className="section-title2">Customer Service</div>

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
            <div className="section-title2">Registered Address</div>
            <div className="contact-text address-box">
              Baumwiesen 2<br />
              Haigerloch<br />
              72401 Germany
            </div>
          </section>

          <section>
            <div className="section-title2">Opening Times</div>
            <div className="contact-text">Monday - Friday, 08:00 - 19:00</div>
          </section>
        </div>

        <div className="form-column">
          <div className="form-title2">
            Or use this form to contact us
          </div>

          <form onSubmit={sendWithContact}>
            <div className="input-group">
              <label htmlFor="name">Name</label>
              <input type="text" id="name" name="name" required />
            </div>

            <div className="input-group">
              <label htmlFor="email">*E-mail</label>
              <input type="email" id="email" name="email" required />
            </div>

            <div className="input-group">
              <label htmlFor="question">*Question</label>
              <textarea
                id="question"
                name="question"
                rows={5}
                required
              />
            </div>

            <button type="submit" className="send-btn">
              SEND
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contacts;