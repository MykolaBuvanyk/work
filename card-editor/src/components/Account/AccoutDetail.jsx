import React, { useEffect, useState } from 'react';
import './AccoutDetail.scss';
import MyTextInput from '../MyInput/MyTextInput';
import AccountHeader from './AccountHeader';
import { $authHost } from '../../http';
import ChangePassword from './ChangePassword';

// Оновлені ключі, що відповідають вашій моделі Sequelize
const addressFields = [
  { label: 'Name', key: 'firstName' },
  { label: 'Company Name', key: 'company' },
  { label: 'Address 1', key: 'address' },
  { label: 'Address 2', key: 'address2' },
  { label: 'Address 3', key: 'address3' },
  { label: 'Town', key: 'city' },
  { label: 'Postal code', key: 'postcode' },
  { label: 'Country', key: 'country', isSelect: true },
  { label: 'E-Mail address', key: 'email' },
  { label: 'Mobile Phone', key: 'phone' },
  { label: 'VAT Number', key: 'vatNumber' },
];

const invoiceFields = [
  { label: 'Name', key: 'firstName2' },
  { label: 'Company Name', key: 'company2' },
  { label: 'Address 1', key: 'address4' },
  { label: 'Address 2', key: 'address5' },
  { label: 'Address 3', key: 'address6' },
  { label: 'Town', key: 'city2' },
  { label: 'Postal code', key: 'postcode2' },
  { label: '*Country', key: 'country2', isSelect: true },
  { label: 'E-Mail address', key: 'eMailInvoice' },
  { label: 'Mobile Phone', key: 'phone2' },
];

const combinedCountries = [
  { code: 'BE', label: '🇧🇪 Belgium' },
  { code: 'CH', label: '🇨🇭 Switzerland' },
  { code: 'CZ', label: '🇨🇿 Czech Republic' },
  { code: 'DK', label: '🇩🇰 Denmark' },
  { code: 'DE', label: '🇩🇪 Germany' },
  { code: 'EE', label: '🇪🇪 Estonia' },
  { code: 'FR', label: '🇫🇷 France' },
  { code: 'GB', label: '🇬🇧 United Kingdom' },
  { code: 'HU', label: '🇭🇺 Hungary' },
  { code: 'IE', label: '🇮🇪 Ireland' },
  { code: 'IT', label: '🇮🇹 Italy' },
  { code: 'LT', label: '🇱🇹 Lithuania' },
  { code: 'LU', label: '🇱🇺 Luxembourg' },
  { code: 'NL', label: '🇳🇱 Netherlands' },
  { code: 'PL', label: '🇵🇱 Poland' },
  { code: 'RO', label: '🇷🇴 Romania' },
  { code: 'SI', label: '🇸🇮 Slovenia' },
  { code: 'SK', label: '🇸🇰 Slovakia' },
  { code: 'SE', label: '🇸🇪 Sweden' },
  { code: 'HR', label: '🇭🇷 Croatia' },
  { code: 'ES', label: '🇪🇸 Spain' },
  { code: 'UA', label: '🇺🇦 Ukraine' }
];

const AccoutDetail = () => {
  const [address, setAddress] = useState({});
  const [invoice, setInvoice] = useState({});
  const [loading, setLoading] = useState(true);

  const getMy = async () => {
    try {
      const res = await $authHost.get('auth/getMy');
      const user = res.data.user;

      // Розподіляємо дані з fullUser по двох об'єктах стейту
      const addrData = {};
      addressFields.forEach(f => addrData[f.key] = user[f.key] || '');
      setAddress(addrData);

      const invData = {};
      invoiceFields.forEach(f => invData[f.key] = user[f.key] || '');
      setInvoice(invData);
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      alert("Error loading user data");
    }
  };

  useEffect(() => {
    getMy();
  }, []);

  const handleInput = (setter) => (field) => (val) => {
    setter(prev => ({ ...prev, [field]: val }));
  };

  // Метод для відправки оновлених даних
  const handleSave = async () => {
    try {
      // Об'єднуємо обидва об'єкти в один для відправки на сервер
      const updateData = { ...address, ...invoice };
      
      await $authHost.put('auth/updateProfile', updateData); // Замініть на ваш ендпоінт
      alert("Changes saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Save failed");
    }
  };

  const renderTable = (fieldsList, data, setter) => (
    <div className="registration-table">
      {fieldsList.map((f) => (
        <div className="table-row" key={f.key}>
          <div className="label-cell">{f.label}</div>
          <div className="input-cell">
            {f.isSelect ? (
              <select 
                className="table-select" 
                value={data[f.key] || ''} 
                onChange={(e) => handleInput(setter)(f.key)(e.target.value)}
              >
                {combinedCountries.map(x => (
                  <option key={x.code} value={x.code}>{x.label}</option>
                ))}
              </select>
            ) : (
              <MyTextInput 
                value={data[f.key] || ''} 
                setValue={handleInput(setter)(f.key)} 
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) return <div>Loading...</div>;

  return (
    <div className="account-detail-container">
      <AccountHeader />
      <br />
      <p className="blue-notice">
        *The invoice and Delivery Note will be included with the shipment...
      </p>

      <p className="update-text">
        If you want to update your registration details, do it here and click <strong>“Save Changes.”</strong>
      </p>

      <div className="tables-grid">
        <div className="grid-col">
          <h3>Address</h3>
          {renderTable(addressFields, address, setAddress)}
        </div>
        <div className="grid-col">
          <h3>Invoice or delivery address (if different from the left)</h3>
          {renderTable(invoiceFields, invoice, setInvoice)}
        </div>
      </div>

      <div className="action-right">
        <button className="btn-blue-rect" onClick={handleSave}>Save Changes</button>
      </div>
      <ChangePassword/>
    </div>
  );
};

export default AccoutDetail;