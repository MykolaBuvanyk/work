import React from 'react';
import './impressum.scss'

const Impressum = () => {
  return (
    <div className="impressum max-w-4xl mx-auto px-4 py-12 text-gray-800 font-sans leading-relaxed">
      {/* Заголовок */}
      <h1 style={{fontSize:'26px'}} className="text-2xl font-bold mb-8 text-gray-900 border-b pb-4">
        Impressum (Imprint)
      </h1>

      {/* Основна інформація */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          Information according to § 5 TDDDG
        </h2>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm space-y-2">
          <p><strong>Company / Owner:</strong> Kostyantyn Utvenko, SignXpert</p>
          <p><strong>Address:</strong> Baumwiesen 2, 72401 Haigerloch, Germany</p>
        </div>
      </section>

      {/* Контакти */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          Contact
        </h2>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm space-y-2">
          <p><strong>Phone:</strong> <a href="tel:+4915776625125" className="text-blue-600 hover:underline">+49 157 766 25 125</a></p>
          <p><strong>E-mail:</strong> <a href="mailto:info@sign-xpert.com" className="text-blue-600 hover:underline">info@sign-xpert.com</a></p>
          <p><strong>Contact form:</strong> <a href="https://sign-xpert.com/contacts" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">https://sign-xpert.com/contacts</a></p>
        </div>
      </section>

      {/* VAT та Редакційна відповідальність */}
      <section className="mb-12 space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">
            VAT Identification Number (USt-IdNr.)
          </h2>
          <p className="text-sm text-gray-700">
            According to § 27 a of the German Value Added Tax Act: <strong>DE461817538</strong>
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">
            Person responsible for editorial content
          </h2>
          <p className="text-sm text-gray-700 mb-1">
            According to § 18 Abs. 2 MStV:
          </p>
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm space-y-1">
            <p><strong>Kostyantyn Utvenko</strong></p>
            <p>Baumwiesen 2, 72401 Haigerloch, Germany</p>
          </div>
        </div>
      </section>

      {/* Dispute Resolution */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          EU Dispute Resolution
        </h2>
        <p className="text-sm text-gray-700 leading-normal mb-4">
          The European Commission provides a platform for online dispute resolution (ODR):{' '}
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            https://ec.europa.eu/consumers/odr/
          </a>.
        </p>
        <p className="text-sm text-gray-700 leading-normal">
          Our e-mail address can be found above in the Impressum.
        </p>
      </section>

      {/* Consumer Dispute Resolution */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          Consumer Dispute Resolution / Universal Arbitration Board
        </h2>
        <p className="text-sm text-gray-700 leading-normal">
          We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.
        </p>
      </section>
    </div>
  );
};

export default Impressum;