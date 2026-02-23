import React from 'react';
import './ReadMoreModal.scss';
import CloseIcon from '/images/icon/close.svg';

const ReadMoreModal = ({ onClose }) => {
  return (
    <div className="rm-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="rm-modal" onClick={e => e.stopPropagation()}>
        <button className="rm-close" aria-label="Close" onClick={onClose}>
          <img src={CloseIcon} alt="close" />
        </button>
        <h2 className="rm-header">How can I get my order VAT-free?</h2>
        <div className="rm-content">
          <p>
            If you are placing an order on behalf of a company, you may be eligible to receive your order VAT-free. To do this, enter your VAT number in the designated field on the registration page and click the "Check" button. The system will verify your number and inform you whether it has passed validation.
          </p>

          <ul className="rm-list">
            <li>If your VAT number is valid, you will not be charged VAT for orders within the EU (except Germany).</li>
            <li>If the check fails, first make sure your number is entered correctly. Sometimes waiting a short time and trying again helps.</li>
          </ul>

          <p>
            If no VAT number is entered or the validation fails, VAT will be charged at the rate applicable in your country.
          </p>

          <p>
            For consumers and for companies located in Germany, regardless of whether they have a valid VAT number, the standard 19% VAT applies.
          </p>

          <p>
            If you are outside the European Union, for example in Switzerland, the UK, or other countries, a 0% VAT rate will apply for exported goods.
          </p>

          <p>
            If you still have questions or encounter any issues, please contact us, and our team will be happy to assist you.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReadMoreModal;
