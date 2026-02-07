import React, { useState } from 'react';
import './RegisterBussines.scss';
import MyTextPassword from '../MyInput/MyTextPassword';
import MyTextInput from '../MyInput/MyTextInput';
import { countries, states } from './countries';
import { Link } from 'react-router-dom';
import { $host } from '../../http';

const RegisterBussines = () => {
  const [formData, setFormData] = useState({
    firstName: '', company: '', address1: '', address2: '', address3: '',
    town: '', postcode: '', country: '', state: '', email: '',
    phone: '', vatNumber: '', password: '', confirmPassword: '', additional: '',
    isDifferent: false, isSubscribe: false
  });

  const handleInput = fieldName => value => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const sumbit = async e => {
    try {
      e.preventDefault();
      const res = await $host.post('auth/register', formData);
      //dispatch(setUser({ token: res.data.token }));
      navigate(`/login/enter/${res.data.newUser.id}`);
    } catch (err) {
      alert('error');
    }
  };

  return (
    <form onSubmit={sumbit} className="register-bussines-container">
      <div className="registration-table">
        {/* Row: First Name */}
        <div className="table-row">
          <div className="label-cell">*First name and Surname</div>
          <div className="input-cell"><MyTextInput value={formData.firstName} setValue={handleInput('firstName')} /></div>
        </div>
        {/* Row: Company Name */}
        <div className="table-row">
          <div className="label-cell">*Company Name</div>
          <div className="input-cell"><MyTextInput value={formData.company} setValue={handleInput('company')} /></div>
        </div>
        {/* Row: Address 1 */}
        <div className="table-row">
          <div className="label-cell">*Address 1</div>
          <div className="input-cell"><MyTextInput value={formData.address1} setValue={handleInput('address1')} /></div>
        </div>
        {/* Rows: Address 2 & 3 */}
        <div className="table-row">
          <div className="label-cell">Address 2</div>
          <div className="input-cell"><MyTextInput value={formData.address2} setValue={handleInput('address2')} /></div>
        </div>
        <div className="table-row">
          <div className="label-cell">Address 3</div>
          <div className="input-cell"><MyTextInput value={formData.address3} setValue={handleInput('address3')} /></div>
        </div>
        {/* Town & Postal */}
        <div className="table-row">
          <div className="label-cell">*Town</div>
          <div className="input-cell"><MyTextInput value={formData.town} setValue={handleInput('town')} /></div>
        </div>
        <div className="table-row">
          <div className="label-cell">*Postal code</div>
          <div className="input-cell"><MyTextInput value={formData.postcode} setValue={handleInput('postcode')} /></div>
        </div>
        {/* Country Select */}
        <div className="table-row">
          <div className="label-cell">*Country</div>
          <div className="input-cell country-row">
            <select onChange={e => handleInput('country')(e.target.value)} value={formData.country}>
              {countries.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <select className="short-select"><option>Dropdown</option></select>
          </div>
        </div>
        {/* E-mail & Phone */}
        <div className="table-row">
          <div className="label-cell">*E-Mail address</div>
          <div className="input-cell"><MyTextInput value={formData.email} setValue={handleInput('email')} /></div>
        </div>
        <div className="table-row">
          <div className="label-cell">*Mobile Phone</div>
          <div className="input-cell"><MyTextInput value={formData.phone} setValue={handleInput('phone')} /></div>
        </div>
        <div className="table-row">
          <div className="label-cell">VAT Number</div>
          <div className="input-cell"><MyTextInput value={formData.vatNumber} setValue={handleInput('vatNumber')} /></div>
        </div>
        {/* Password Fields */}
        <div className="table-row">
          <div className="label-cell">*Password</div>
          <div className="input-cell"><MyTextPassword value={formData.password} setValue={handleInput('password')} /></div>
        </div>
        <div className="table-row">
          <div className="label-cell">*Confirm *Password</div>
          <div className="input-cell"><MyTextPassword value={formData.confirmPassword} setValue={handleInput('confirmPassword')} /></div>
        </div>
        {/* Additional Info */}
        <div className="table-row">
          <div className="label-cell">Additional Information</div>
          <div className="input-cell"><MyTextInput value={formData.additional} setValue={handleInput('additional')} /></div>
        </div>
      </div>

      <p className="vat-notice">
        *Companies can only receive VAT-free orders when providing a valid VAT-number. <Link to="/read-more">Read more</Link>
      </p>

      <div className="checkbox-section">
        <label className="radio-style">
          <input type="checkbox" checked={formData.isDifferent} onChange={e => handleInput('isDifferent')(e.target.checked)} />
          <span className="checkmark"></span>
          Invoice or delivery address (if different from above)
        </label>

        <label className="radio-style">
          <input type="checkbox" checked={formData.isSubscribe} onChange={e => handleInput('isSubscribe')(e.target.checked)} />
          <span className="checkmark"></span>
          Yes please. I would like to subscribe to your mailings and receive news and offers.
        </label>
      </div>

      <button className="register-btn">Register</button>

      <div className="footer-info">
        SignXpert gathers your personal information when you set up an account, using it for
        advertising purposes and to handle and complete any future orders. You can learn more in our <Link to="/privacy">privacy policy.</Link>
      </div>
    </form>
  );
};

export default RegisterBussines;