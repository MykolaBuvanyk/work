import React, { useState } from 'react';
import './AccoutDetail.scss';
import MyTextInput from '../MyInput/MyTextInput';
import MyTextPassword from '../MyInput/MyTextPassword';
import AccountHeader from './AccountHeader';

const AccoutDetail = () => {
  const [address, setAddress] = useState({});
  const [invoice, setInvoice] = useState({});

  const handleInput = (setter) => (field) => (val) => {
    setter(prev => ({ ...prev, [field]: val }));
  };

  const fields = [
    { label: 'Name', key: 'name' },
    { label: 'Company Name', key: 'company' },
    { label: 'Address 1', key: 'addr1' },
    { label: 'Address 2', key: 'addr2' },
    { label: 'Address 3', key: 'addr3' },
    { label: 'Town', key: 'town' },
    { label: 'Postal code', key: 'postcode' },
    { label: '*Country', key: 'country', isSelect: true },
    { label: 'E-Mail address', key: 'email' },
    { label: 'Mobile Phone', key: 'phone' },
    { label: 'VAT Number', key: 'vat' },
  ];

  const renderTable = (data, setter) => (
    <div className="registration-table">
      {fields.map((f) => (
        <div className="table-row" key={f.key}>
          <div className="label-cell">{f.label}</div>
          <div className="input-cell">
            {f.isSelect ? (
              <select className="table-select">
                <option value="">Select country</option>
              </select>
            ) : (
              <MyTextInput value={data[f.key]} setValue={handleInput(setter)(f.key)} />
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="account-detail-container">
      <AccountHeader/>
      <br/>
      <p className="blue-notice">
        *The invoice and Delivery Note will be included with the shipment and sent to the same delivery address.
      </p>
      
      <p className="update-text">
        If you want to update your registration details, do it here and click <strong>“Save Changes.”</strong>
      </p>

      <div className="tables-grid">
        <div className="grid-col">
          <h3>Address</h3>
          {renderTable(address, setAddress)}
        </div>
        <div className="grid-col">
          <h3>Invoice Address</h3>
          {renderTable(invoice, setInvoice)}
        </div>
      </div>

      <div className="action-right">
        <button className="btn-blue-rect">Save Changes</button>
      </div>

      <div className="password-section">
        <h3>Change Password</h3>
        <div className="password-flex-row">
          <div style={{display:'flex',flexDirection:'column',justifyContent:'right',alignItems:'flex-end'}}>
            <div className="registration-table pass-table">
              <div className="table-row">
                <div className="label-cell">Existing Password</div>
                <div className="input-cell"><MyTextPassword /></div>
              </div>
              <div className="table-row">
                <div className="label-cell">New Passport</div>
                <div className="input-cell"><MyTextPassword /></div>
              </div>
              <div className="table-row">
                <div className="label-cell">Confirm New Passport</div>
                <div className="input-cell"><MyTextPassword /></div>
              </div>
            </div>

            <div className="action-center">
              <button className="btn-blue-rect">Save Changes</button>
            </div>
          </div>

          <div className="pass-forgot-block">
            <p>* Forgot Passport? Click here and we'll email your current passport to you.</p>
            <button className="btn-blue-oval">Send</button>
          </div>
        </div>
      </div>  
    </div>
  );
};

export default AccoutDetail;