import React, { useState } from 'react';
import './RegisterConsumer.scss';
import MyTextPassword from '../MyInput/MyTextPassword';
import MyTextInput from '../MyInput/MyTextInput';
import { countries, states } from './countries';
import { Link, useNavigate } from 'react-router-dom';
import { $host } from '../../http';
import { useDispatch } from 'react-redux';
import { setUser } from '../../store/reducers/user';

const RegisterConsumer = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    firstName: '', surname: '', phone: '', email: '',
    IsEmailInvoice: false, eMailInvoice: '', password: '',
    address: '', postcode: '', city: '', country: '', state: '',
    isDifferent: false, firstName2: '', surname2: '', company: '',
    phone2: '', address2: '', postcode2: '', city2: '',
    country2: '', state2: '', isSubscribe: false, type: 'Consumer',
  });

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

  const handleInput = fieldName => value => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  return (
    <form className="register-consumer-container" onSubmit={sumbit}>
      <div className="registration-table">
        {/* Row: First Name */}
        <div className="table-row">
          <div className="label-cell">*First name and Surname</div>
          <div className="input-cell">
            <MyTextInput value={formData.firstName} setValue={handleInput('firstName')} required />
          </div>
        </div>

        {/* Row: Mobile Phone */}
        <div className="table-row">
          <div className="label-cell">*Mobile Phone</div>
          <div className="input-cell">
            <MyTextInput value={formData.phone} setValue={handleInput('phone')} required placeholder="Required for notification" />
          </div>
        </div>

        {/* Row: Email */}
        <div className="table-row">
          <div className="label-cell">*E-Mail address</div>
          <div className="input-cell">
            <MyTextInput value={formData.email} setValue={handleInput('email')} required />
          </div>
        </div>

        {/* Row: Password */}
        <div className="table-row">
          <div className="label-cell">*Password</div>
          <div className="input-cell">
            <MyTextPassword value={formData.password} setValue={handleInput('password')} required />
          </div>
        </div>

        {/* Row: Address */}
        <div className="table-row">
          <div className="label-cell">*Address</div>
          <div className="input-cell">
            <MyTextInput value={formData.address} setValue={handleInput('address')} required />
          </div>
        </div>

        {/* Row: Postcode */}
        <div className="table-row">
          <div className="label-cell">*Postal code</div>
          <div className="input-cell">
            <MyTextInput value={formData.postcode} setValue={handleInput('postcode')} required />
          </div>
        </div>

        {/* Row: City/Town */}
        <div className="table-row">
          <div className="label-cell">*Town</div>
          <div className="input-cell">
            <MyTextInput value={formData.city} setValue={handleInput('city')} required />
          </div>
        </div>

        {/* Row: Country */}
        <div className="table-row">
          <div className="label-cell">*Country</div>
          <div className="input-cell country-row">
            <select onChange={e => handleInput('country')(e.target.value)} value={formData.country}>
              {countries.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <select className="short-select"><option>Dropdown</option></select>
          </div>
        </div>
      </div>

      <div className="checkbox-section">
        <label className="radio-style">
          <input 
            type="checkbox" 
            checked={formData.isDifferent} 
            onChange={e => handleInput('isDifferent')(e.target.checked)} 
          />
          <span className="checkmark"></span>
          Invoice or delivery address (if different from above)
        </label>

        <label className="radio-style">
          <input 
            type="checkbox" 
            checked={formData.isSubscribe} 
            onChange={e => handleInput('isSubscribe')(e.target.checked)} 
          />
          <span className="checkmark"></span>
          Yes please. I would like to subscribe to your mailings and receive news and offers.
        </label>
      </div>

      <button className="register-btn" type="submit">Register</button>

      <div className="footer-info">
        SignXpert gathers your personal information when you set up an account, using it for
        advertising purposes and to handle and complete any future orders. You can learn more in our <Link to="/privacy">privacy policy.</Link>
      </div>
    </form>
  );
};

export default RegisterConsumer;