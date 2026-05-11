import React from "react";
import { useTranslation } from "react-i18next";
import './style.scss'
import Link from "../Localized/LocalizedLink";

const PaymentSuccess = () => {
  const { t } = useTranslation();
  return (
    <div className="success-page">
      <div className="success-card">
        <div className="icon">✔</div>

        <h1>{t("paySuccess.title")}</h1>

        <p>
          {t("paySuccess.message")}
        </p>

        <p className="sub">
          {t("paySuccess.sub")}
        </p>

        <div className="actions">
          <Link to="/account" className="btn primary">
            {t("paySuccess.goToAccount")}
          </Link>

          <Link to="/" className="btn secondary">
            {t("paySuccess.backToHome")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
