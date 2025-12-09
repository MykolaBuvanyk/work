import React, { useState } from 'react';
import './RegisterBussines.scss';
import MyTextPassword from '../MyInput/MyTextPassword';
import MyTextInput from '../MyInput/MyTextInput';
import { countries, states } from './countries';
import { Link } from 'react-router-dom';
import { $host } from '../../http';

const RegisterBussines = () => {
  const [formData, setFormData] = useState({
    email: '',
    company: '',
    vatNumber: '',
    reference: '',
    firstName: '',
    surname: '',
    phone: '',
    password: '',
    address: '',
    house: '',
    postcode: '',
    city: '',
    country: '',
    state: '',
    isDifferent: false,
    firstName2: '',
    surname2: '',
    address2: '',
    postcode2: '',
    city2: '',
    country2: '',
    state2: '',
    type: 'Business',
  });
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
    <form className="register-bussines-container" onSubmit={sumbit}>
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
      <label htmlFor="company">
        Company
        <MyTextInput type="text" value={formData.company} setValue={handleInput('company')} />
      </label>
      <label htmlFor="firstName">
        VAT Number
        <MyTextInput setValue={handleInput('vatNumber')} type="text" value={formData.vatNumber} />
      </label>
      <label style={{ display: 'unset', marginTop: '-12px' }} htmlFor="row">
        Companies can only receive VAT-free orders when providing a valid VAT-number.{' '}
        <Link style={{ color: '#0374e3' }} to={'/privacy'}>
          Read more
        </Link>
      </label>
      <label htmlFor="reference">
        Reference (to be provided for all your orders)
        <MyTextInput setValue={handleInput('reference')} type="text" value={formData.reference} />
      </label>
      <label htmlFor="firstName">
        * First name
        <MyTextInput
          required
          setValue={handleInput('firstName')}
          type="text"
          value={formData.firstName}
        />
      </label>
      <label htmlFor="surname">
        * Surname
        <MyTextInput
          required
          type="text"
          value={formData.surname}
          setValue={handleInput('surname')}
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
      <label htmlFor="house">
        * House number
        <MyTextInput setValue={handleInput('house')} type="text" value={formData.house} required />
      </label>
      <label htmlFor="house">
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
            Company
            <MyTextInput setValue={handleInput('company')} type="text" value={formData.company} />
          </label>
          <label htmlFor="surname2">
            * First name
            <MyTextInput
              required
              type="text"
              value={formData.firstName2}
              setValue={handleInput('firstName2')}
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
          <label htmlFor="phone2">
            * Mobile number
            <MyTextInput
              required
              placeholder="Required for notification"
              type="text"
              value={formData.phone2}
              setValue={handleInput('phone2')}
            />
          </label>
          <label htmlFor="address">
            * Address
            <MyTextInput
              setValue={handleInput('address2')}
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

export default RegisterBussines;
