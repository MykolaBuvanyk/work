import React from 'react';
import './AccoutDetail.scss';
import AccountHeader from './AccountHeader';

const AccoutDetail = () => {
  const renderInputRow = (label, isRequired = false, type = "text") => (
    <div className="input-row">
      <div className="label-cell">
        {isRequired && <span className="required">*</span>}
        {label}
      </div>
      <div className="input-cell">
        {type === "select" ? (
          <select className="custom-select">
            <option value="DE">Germany</option>
          </select>
        ) : (
          <input type={type} />
        )}
      </div>
    </div>
  );

  return (
    <div className='account-detail-container'>
      <AccountHeader />

      <div className="account-content">
        <p className="top-notice">
          *The invoice and Delivery Note will be included with the shipment and sent to the same delivery address.
        </p>
        <p className="instruction">
          If you want to update your registration details, do it here and click “Save Changes.”
        </p>

        <div className="address-grid">
          {/* Секція Address */}
          <div className="form-section">
            <h2 className="section-title">Address</h2>
            <div className="table-form">
              {renderInputRow("Name")}
              {renderInputRow("Company Name")}
              {renderInputRow("Address 1")}
              {renderInputRow("Address 2")}
              {renderInputRow("Address 3")}
              {renderInputRow("Town")}
              {renderInputRow("Postal code")}
              {renderInputRow("Country", false, "select")}
              {renderInputRow("E-Mail address")}
              {renderInputRow("Mobile Phone")}
              {renderInputRow("VAT Number")}
            </div>
          </div>

          {/* Секція Delivery Address */}
          <div className="form-section">
            <h2 className="section-title">Delivery Address</h2>
            <div className="table-form">
              {renderInputRow("Name")}
              {renderInputRow("Company Name")}
              {renderInputRow("Address 1")}
              {renderInputRow("Address 2")}
              {renderInputRow("Address 3")}
              {renderInputRow("Town")}
              {renderInputRow("Postal code")}
              {renderInputRow("Country", false, "select")}
              {renderInputRow("E-Mail address")}
              {renderInputRow("Mobile Phone")}
              {renderInputRow("VAT Number")}
            </div>
            <div className="button-wrapper right">
              <button className="btn-save">Save Changes</button>
            </div>
          </div>
        </div>

        {/* Секція Change Passport */}
        <div className="password-section">
          <h2 className="section-title">Change Passport</h2>
          <div className="password-flex">
            <div className="table-form password-table">
              {renderInputRow("Existing Passport", false, "password")}
              {renderInputRow("New Passport", false, "password")}
              {renderInputRow("Confirm New Passport", false, "password")}
            </div>
            
            <div className="password-help">
              <p>* Forgot Passport?  Click here and we’ll email your current passport to you.</p>
              <div style={{display:'flex',justifyContent:'right',alignItems:'flex-end'}} className="right">
                <button className="btn-send">Send</button>
              </div>
            </div>
          </div>
          <div className="button-wrapper center">
            <button className="btn-save">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccoutDetail;