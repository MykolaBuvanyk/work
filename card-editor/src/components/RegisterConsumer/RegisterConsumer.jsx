import React, { useState } from 'react';
import './RegisterConsumer.scss';
import MyTextPassword from '../MyInput/MyTextPassword';
import MyTextInput from '../MyInput/MyTextInput';
import { countries, states } from './countries';
import { Link, useNavigate } from 'react-router-dom';
import { $host } from '../../http';
import { useDispatch } from 'react-redux';
import { setUser } from '../../store/reducers/user';

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
    firstName2:'',phone2:'',company2:'',address2:'',address3:'',address4:'',
    city:'',country2:"",postcode2:'',eMailInvoice:'',phone2:''
  });

  const [isInvoice,setIsInvoice]=useState(false);

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
              {combinedCountries.map(x => <option key={x.code} value={x.code}>{x.label}</option>)}
            </select>
            <select className="short-select"><option>Dropdown</option></select>
          </div>
        </div>
      </div>

      <div className="checkbox-section">
        <label className="radio-style">
          <input 
            type="checkbox" 
            checked={isInvoice} 
            onChange={e => setIsInvoice(e.target.checked)} 
          />
          <span className="checkmark"></span>
          Invoice or delivery address (if different from above)
        </label>
        {isInvoice&&

        <div className="registration-table">
          <div className="table-row">
            <div className="label-cell">*First name and Surname</div>
            <div className="input-cell">
              <MyTextInput value={formData.firstName2} setValue={handleInput('firstName2')} required />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">*Company Name</div>
            <div className="input-cell">
              <MyTextInput value={formData.company2} setValue={handleInput('company2')} required />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">*Company Name</div>
            <div className="input-cell">
              <MyTextInput value={formData.company2} setValue={handleInput('company2')} required />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">*Address 1</div>
            <div className="input-cell">
              <MyTextInput value={formData.address2} setValue={handleInput('address2')} required />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">Address 2</div>
            <div className="input-cell">
              <MyTextInput value={formData.address3} setValue={handleInput('address3')} />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">Address 3</div>
            <div className="input-cell">
              <MyTextInput value={formData.address4} setValue={handleInput('address4')} />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">*Town</div>
            <div className="input-cell">
              <MyTextInput value={formData.city2} setValue={handleInput('city2')} required />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">*Postal code </div>
            <div className="input-cell">
              <MyTextInput value={formData.postcode2} setValue={handleInput('postcode2')} required />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">*Country</div>
            <div className="input-cell country-row">
              <select onChange={e => handleInput('country2')(e.target.value)} value={formData.country2}>
                {combinedCountries.map(x => <option key={x.code} value={x.code}>{x.label}</option>)}
              </select>
              <select className="short-select"><option>Dropdown</option></select>
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">*E-Mail address</div>
            <div className="input-cell">
              <MyTextInput value={formData.eMailInvoice} setValue={handleInput('eMailInvoice')} required />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">*Mobile Phone</div>
            <div className="input-cell">
              <MyTextInput value={formData.phone2} setValue={handleInput('phone2')} required />
            </div>
          </div>
        </div>}

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