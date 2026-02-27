import React, { useEffect, useState } from 'react';
import './AccoutDetail.scss';
import MyTextInput from '../MyInput/MyTextInput';
import AccountHeader from './AccountHeader';
import { $authHost } from '../../http';
import ChangePassword from './ChangePassword';
import combinedCountries from '../Countries';
import { useDispatch } from 'react-redux';
import { mergeUser } from '../../store/reducers/user';

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


const AccoutDetail = () => {
  const [address, setAddress] = useState({});
  const [invoice, setInvoice] = useState({});
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  const getMy = async () => {
    try {
      const res = await $authHost.get('auth/getMy');
      const user = res.data.user;

      // Розподіляємо дані з fullUser по двох об'єктах стейту
      const addrData = {};
      addressFields.forEach(f => addrData[f.key] = user[f.key] || '');
      addrData.weWill = user.weWill || '';
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
      // Refresh server-side user and update redux store + local state
      try {
        const res = await $authHost.get('auth/getMy');
        const updatedUser = res?.data?.user || null;
        if (updatedUser) {
          dispatch(mergeUser(updatedUser));
          // Refresh local editable state
          await getMy();
        }
      } catch (e) {
        console.warn('Failed to refresh user after save', e);
      }

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
        *The invoice and Delivery Note will be included with the shipment and sent to the same address.
      </p>

      <p className="update-text">
        If you want to update your registration details, do it here and click “Save Changes.”
      </p>

      <div className="tables-grid">
        <div className="grid-col">
          <h3>Address</h3>
          {renderTable(addressFields, address, setAddress)}

          <div className="invoice-email-block">
            <p>We will send the invoice to the e-mail you provided.</p>
            <p>You can also add another e-mail, separated by a comma, if you wish.</p>

            <div className="invoice-input-row">
              <MyTextInput
                value={address.weWill || ''}
                setValue={handleInput(setAddress)('weWill')}
              />
            </div>
            <div className="save-changes-row">
              <button className="btn-blue-rect" onClick={handleSave}>Save Changes</button>
            </div>
          </div>
        </div>
        <div className="grid-col">
          <h3>Invoice address (if different from the left)</h3>
          {renderTable(invoiceFields, invoice, setInvoice)}
        </div>
      </div>
      <ChangePassword/>
    </div>
  );
};

export default AccoutDetail;