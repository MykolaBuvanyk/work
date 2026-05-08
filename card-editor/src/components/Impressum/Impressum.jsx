import React from 'react';
import './impressum.scss'
import { useTranslation } from 'react-i18next';


const Impressum = () => {
    const {t}=useTranslation()
  return (
    <div className="impressum max-w-4xl mx-auto px-4 py-12 text-gray-800 font-sans leading-relaxed">
      {/* Заголовок */}
      <h1 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 text-gray-900 border-b pb-4">
       {t("Impressum.i_1")}
      </h1>

      {/* Основна інформація */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
         {t("Impressum.i_2")}
        </h2>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm space-y-2">
          <p><strong>{t("Impressum.i_3")}</strong> {t("Impressum.i_4")}</p>
          <p><strong>{t("Impressum.i_5")}</strong> Baumwiesen 2, 72401 Haigerloch, Germany</p>
        </div>
      </section>

      {/* Контакти */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("Impressum.i_7")}
        </h2>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm space-y-2">
          <p><strong>{t("Impressum.i_8")}</strong> <a href="tel:+4915776625125" className="text-blue-600 hover:underline">+49 157 766 25 125</a></p>
          <p><strong>E-mail:</strong> <a href="mailto:info@sign-xpert.com" className="text-blue-600 hover:underline">info@sign-xpert.com</a></p>
          <p><strong>{t("Impressum.i_9")}</strong> <a href="https://sign-xpert.com/contacts" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">https://sign-xpert.com/contacts</a></p>
        </div>
      </section>

      {/* VAT та Редакційна відповідальність */}
      <section className="mb-12 space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">
            {t("Impressum.i_10")}
          </h2>
          <p className="text-sm text-gray-700">
            {t("Impressum.i_11")} <strong>DE461817538</strong>
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">
            {t("Impressum.i_12")}
          </h2>
          <p className="text-sm text-gray-700 mb-1">
            {t("Impressum.i_13")}
          </p>
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm space-y-1">
            <p><strong>{t("Impressum.i_14")}</strong></p>
            <p>Baumwiesen 2, 72401 Haigerloch, Germany</p>
          </div>
        </div>
      </section>

      {/* Dispute Resolution */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("Impressum.i_15")}
        </h2>
        <p className="text-sm text-gray-700 leading-normal mb-4">
          {t("Impressum.i_16")}{' '}
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            https://ec.europa.eu/consumers/odr/
          </a>.
        </p>
        <p className="text-sm text-gray-700 leading-normal">
          {t("Impressum.i_17")}
        </p>
      </section>

      {/* Consumer Dispute Resolution */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("Impressum.i_18")}
        </h2>
        <p className="text-sm text-gray-700 leading-normal">
          {t("Impressum.i_19")}
        </p>
      </section>
    </div>
  );
};

export default Impressum;