import React from 'react';
import './ReadMoreModal.scss';
import CloseIcon from '/images/icon/close.svg';
import { useTranslation } from 'react-i18next';

const ReadMoreModal = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="rm-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="rm-modal" onClick={e => e.stopPropagation()}>
        <button className="rm-close" aria-label="Close" onClick={onClose}>
          <img src={CloseIcon} alt="close" />
        </button>
        <h2 className="rm-header">{t("ReadMoreModal.title")}</h2>
        <div className="rm-content">
          <p>{t("ReadMoreModal.description")}</p>

          <ul className="rm-list">
            <li>{t("ReadMoreModal.validVat")}</li>
            <li>{t("ReadMoreModal.invalidVat")}</li>
          </ul>

          <p>{t("ReadMoreModal.noVatNumber")}</p>

          <p>{t("ReadMoreModal.germanyVat")}</p>

          <p>{t("ReadMoreModal.outsideEu")}</p>

          <p>{t("ReadMoreModal.contactUs")}</p>
        </div>
      </div>
    </div>
  );
};

export default ReadMoreModal;
