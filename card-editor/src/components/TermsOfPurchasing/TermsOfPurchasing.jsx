import React from 'react';
import './TermsOfPurchasing.scss'
import { useTranslation } from 'react-i18next';

const TermsOfPurchasing = () => {
  const {t}=useTranslation()
  return (
    <div className="TermsOfPurchasing max-w-4xl mx-auto px-4 py-12 text-gray-800 font-sans leading-relaxed overflow-x-hidden w-full">
      {/* Заголовок */}
      <h1 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 text-gray-900 border-b pb-4">
        {t("TermsOfPurchasing.t_1")}
      </h1>

      {/* Company Information */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("TermsOfPurchasing.t_2")}
        </h2>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm space-y-2">
          <p><strong>{t("TermsOfPurchasing.t_3")}</strong> {t("TermsOfPurchasing.t_4")}</p>
          <p><strong>VAT ID:</strong> DE461817538</p>
          <p><strong>{t("TermsOfPurchasing.t_5")}</strong> Kostyantyn Utvenko, SignXpert Baumwiesen 2, 72401 Haigerloch, Germany</p>
          <p><strong>Email:</strong> <a href="mailto:info@sign-xpert.com" className="text-blue-600 hover:underline">info@sign-xpert.com</a></p>
        </div>
      </section>

      {/* 1. General */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("TermsOfPurchasing.t_6")}
        </h2>
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            {t("TermsOfPurchasing.t_7")} <strong>sign-xpert.com</strong>.
          </p>
          <p>
            {t("TermsOfPurchasing.t_8")} <strong>SignXpert</strong> {t("TermsOfPurchasing.t_9")}
          </p>
          <p>
            {t("TermsOfPurchasing.t_10")}
          </p>
          <p>
            {t("TermsOfPurchasing.t_11")}
          </p>
          <p>
            {t("TermsOfPurchasing.t_12")}
          </p>
        </div>
      </section>

      {/* 2. Prices and Small Business Status (VAT) */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("TermsOfPurchasing.t_13")}
        </h2>
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            {t("TermsOfPurchasing.t_14")}
          </p>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-yellow-800">
            <p className="font-semibold mb-1">{t("TermsOfPurchasing.t_15")}</p>
            <p className="mb-2">
             {t("TermsOfPurchasing.t_16")}
            </p>
            <p className="italic">
              {t("TermsOfPurchasing.t_17")}
            </p>
          </div>
          <p>
            {t("TermsOfPurchasing.t_18")}
          </p>
        </div>
      </section>

      {/* 3. Delivery */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
        {t("TermsOfPurchasing.t_19")}
        </h2>
        <div className="space-y-4 text-sm text-gray-700">
          <p>
          {t("TermsOfPurchasing.t_20")}
 <strong>UPS</strong>{t("TermsOfPurchasing.t_21")} <strong>DHL</strong>.
          </p>
          <p>
            <strong>{t("TermsOfPurchasing.t_22")}</strong> {t("TermsOfPurchasing.t_23")}
          </p>
          <p>
            <strong>{t("TermsOfPurchasing.t_24")}</strong> {t("TermsOfPurchasing.t_25")}
          </p>
          <p>
            <strong>{t("TermsOfPurchasing.t_26")}</strong> {t("TermsOfPurchasing.t_27")}
          </p>
        </div>
      </section>

      {/* 4. Right of Withdrawal */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("TermsOfPurchasing.t_28")}
        </h2>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm space-y-3">
          <p className="font-semibold text-gray-900">
            {t("TermsOfPurchasing.t_29")}
          </p>
          <p className="text-gray-700">
           {t("TermsOfPurchasing.t_30")} <strong>{t("TermsOfPurchasing.t_31")}</strong> {t("TermsOfPurchasing.t_32")}
          </p>
          <p className="text-gray-700">
            {t("TermsOfPurchasing.t_33")} <strong>{t("TermsOfPurchasing.t_34")}</strong> {t("TermsOfPurchasing.t_35")}
          </p>
        </div>
      </section>

      {/* 5. Satisfaction Guarantee & Warranty */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("TermsOfPurchasing.t_36")}
        </h2>
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            {t("TermsOfPurchasing.t_37")} <strong>{t("TermsOfPurchasing.t_38")}</strong> {t("TermsOfPurchasing.t_39")}
          </p>
          <p>
            {t("TermsOfPurchasing.t_40")}
          </p>
          <p>
            <strong>{t("TermsOfPurchasing.t_41")}</strong> {t("TermsOfPurchasing.t_42")}
          </p>
        </div>
      </section>

      {/* 6. Payment */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("TermsOfPurchasing.t_43")}
        </h2>
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            {t("TermsOfPurchasing.t_44")} <strong>{t("TermsOfPurchasing.t_45")}</strong> {t("TermsOfPurchasing.t_21")} <strong>{t("TermsOfPurchasing.t_46")}</strong>:
          </p>
          <p>
            <strong>Credit/Debit Card (VISA/MasterCard):</strong> {t("TermsOfPurchasing.t_47")}
          </p>
          <p>
            <strong>{t("TermsOfPurchasing.t_48")}</strong> {t("TermsOfPurchasing.t_49")}
          </p>
        </div>
      </section>

      {/* 7. Privacy Policy */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("TermsOfPurchasing.t_50")}
        </h2>
        <p className="text-sm text-gray-700 leading-normal">
         {t("TermsOfPurchasing.t_51")}
        </p>
      </section>

      {/* 8. Complaints and Transport Damage */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("TermsOfPurchasing.t_52")}
        </h2>
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            {t("TermsOfPurchasing.t_53")}
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>{t("TermsOfPurchasing.t_54")} <a href="mailto:info@sign-xpert.com" className="text-blue-600 hover:underline">info@sign-xpert.com</a></li>
            <li>{t("TermsOfPurchasing.t_55")}</li>
          </ul>
          <p>
           {t("TermsOfPurchasing.t_56")}
          </p>
        </div>
      </section>

      {/* 9. Disputes and Severability */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("TermsOfPurchasing.t_57")}
        </h2>
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            <strong>{t("TermsOfPurchasing.t_58")}</strong> {t("TermsOfPurchasing.t_59")} {' '}
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              https://ec.europa.eu/consumers/odr/
            </a>.
          </p>
          <p>
            {t("TermsOfPurchasing.t_60")}
          </p>
          <p>
            <strong>{t("TermsOfPurchasing.t_61")}</strong> {t("TermsOfPurchasing.t_62")}
          </p>
        </div>
      </section>

      {/* 10. Force Majeure */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {t("TermsOfPurchasing.t_63")}
        </h2>
        <p className="text-sm text-gray-700 leading-normal">
          {t("TermsOfPurchasing.t_64")}
        </p>
      </section>
    </div>
  );
};

export default TermsOfPurchasing;