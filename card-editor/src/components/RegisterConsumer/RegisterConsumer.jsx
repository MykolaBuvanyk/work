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
  const disptach = useDispatch();
  const [formData, setFormData] = useState({
    firstName: '',
    surname: '',
    phone: '',
    email: '',
    IsEmailInvoice: '',
    eMailInvoice: '',
    password: '',
    address: '',
    postcode: '',
    city: '',
    country: '',
    state: '',
    isDifferent: false,
    firstName2: '',
    surname2: '',
    company: '',
    phone2: '',
    address2: '',
    postcode2: '',
    city2: '',
    country2: '',
    state2: '',
    isSubscribe: false,
    type: 'Consumer',
  });

  const navigate = useNavigate();

  const sumbit = async e => {
    try {
      e.preventDefault();
      const res = await $host.post('auth/register', formData);
      disptach(setUser({ token: res.data.token }));
      navigate('/');
    } catch (err) {
      alert('error');
    }
  };
  const handleInput = fieldName => value => {
    console.log('Field:', fieldName, 'Value:', value);
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  return (
    <form className="register-consumer-container" onSubmit={sumbit}>
      <label htmlFor="firstName">
        * First name
        <MyTextInput
          setValue={handleInput('firstName')}
          type="text"
          value={formData.firstName}
          required
        />
      </label>
      <label htmlFor="surname">
        * Surname
        <MyTextInput
          setValue={handleInput('surname')}
          type="text"
          value={formData.surname}
          required
        />
      </label>
      <label htmlFor="phone">
        * Mobile number
        <MyTextInput
          placeholder="Required for notification"
          required
          setValue={handleInput('phone')}
          type="text"
          value={formData.phone}
        />
      </label>
      <label htmlFor="email">
        * E-mail address
        <MyTextInput
          placeholder="Used for receipts and order information"
          setValue={handleInput('email')}
          type="text"
          value={formData.email}
          required
        />
      </label>
      <label className="row" htmlFor="isEmailInvoci">
        <input
          onChange={e => handleInput('IsEmailInvoice')(e.target.checked)}
          type="checkbox"
          value={formData.IsEmailInvoice}
        />
        <span>Use different email for invoices</span>
      </label>
      {formData.IsEmailInvoice && (
        <label htmlFor="password">
          E-mail invoice
          <MyTextInput
            setValue={handleInput('eMailInvoice')}
            type="text"
            value={formData.eMailInvoice}
          />
        </label>
      )}
      <label htmlFor="password">
        * Enter new password
        <MyTextPassword required setValue={handleInput('password')} value={formData.password} />
      </label>
      <label htmlFor="address">
        * Address
        <MyTextInput
          setValue={handleInput('address')}
          type="text"
          value={formData.address}
          required
        />
      </label>
      <label htmlFor="postcode">
        * Postcode
        <MyTextInput
          setValue={handleInput('postcode')}
          type="text"
          value={formData.postcode}
          required
        />
      </label>
      <label htmlFor="city">
        * City
        <MyTextInput required setValue={handleInput('city')} type="text" value={formData.city} />
      </label>
      <label htmlFor="country">
        * Country
        <select onChange={e => handleInput('country')(e.target.value)} value={formData.country}>
          {countries.map(x => (
            <option value={x} key={x}>
              {x}
            </option>
          ))}
        </select>
      </label>
      {formData.country == 'United States' && (
        <label htmlFor="state">
          * State
          <select onChange={e => handleInput('state')(e.target.value)} value={formData.state}>
            {states.map(x => (
              <option value={x} key={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="row">
        <input
          onChange={e => handleInput('isDifferent')(e.target.checked)}
          type="checkbox"
          value={formData.isDifferent}
        />
        <span>Different delivery address</span>
      </label>
      {formData.isDifferent && (
        <>
          <label style={{ marginTop: '-15px' }} htmlFor="">
            <span>Delivery Address</span>
          </label>
          <label htmlFor="firstName2">
            * First name
            <MyTextInput
              required
              setValue={handleInput('firstName2')}
              type="text"
              value={formData.firstName2}
            />
          </label>
          <label htmlFor="surname2">
            * Surname
            <MyTextInput
              required
              type="text"
              value={formData.surname2}
              setValue={handleInput('surname2')}
            />
          </label>
          <label htmlFor="company">
            Company
            <MyTextInput type="text" value={formData.company} setValue={handleInput('company')} />
          </label>
          <label htmlFor="phone2">
            * Mobile number
            <MyTextInput
              required
              type="text"
              value={formData.phone2}
              setValue={handleInput('phone2')}
              placeholder="Required for notification"
            />
          </label>
          <label htmlFor="address">
            * Address
            <MyTextInput
              setValue={handleInput('address3')}
              type="text"
              value={formData.address2}
              required
            />
          </label>
          <label htmlFor="postcode2">
            * Postcode
            <MyTextInput
              required
              type="text"
              value={formData.postcode2}
              setValue={handleInput('postcode2')}
            />
          </label>
          <label htmlFor="city2">
            * City
            <MyTextInput
              required
              type="text"
              value={formData.city2}
              setValue={handleInput('city2')}
            />
          </label>

          <label htmlFor="country">
            * Country
            <select
              onChange={e => handleInput('country2')(e.target.value)}
              value={formData.country2}
            >
              {countries.map(x => (
                <option value={x} key={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          {formData.country2 == 'United States' && (
            <label htmlFor="state">
              * State
              <select onChange={e => handleInput('state2')(e.target.value)} value={formData.state2}>
                {states.map(x => (
                  <option value={x} key={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      <label style={{ marginTop: '-10px' }} htmlFor="">
        Want to subscribe to our newsletter?
      </label>
      <label style={{ marginTop: '-10px' }} className="row">
        <input
          onChange={e => handleInput('isSubscribe')(e.target.checked)}
          type="checkbox"
          value={formData.isSubscribe}
        />
        <span>
          Yes please. I would like to subscribe to your mailings and receive news and offers.
        </span>
      </label>
      <button>Register</button>
      <div className="info">
        SignXpert gathers your personal information when you set up an account, using it for
        advertising purposes and to handle and complete any future orders. You can learn more in our{' '}
        <Link to="/privay">privacy policy.</Link>
      </div>
    </form>
  );
};

export default RegisterConsumer;
