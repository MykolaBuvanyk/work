import React, { useState } from 'react';
import './RegisterBussines.scss';
import MyTextPassword from '../MyInput/MyTextPassword';
import MyTextInput from '../MyInput/MyTextInput';
import { countries, states } from './countries';
import { Link, useNavigate } from 'react-router-dom';
import { $host } from '../../http';
import WeWiill from '../WeWill/WeWiill';

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

const tellAboutList=[
  'Online / Internet',
  'Through samples',
  'Via flyer',
  'Colleague',
  'Social media',
  'Event / exhibition',
  'Newsletter',
  'E-Mail',
  'Other'
]

const RegisterBussines = () => {
    const [isInvoice,setIsInvoice]=useState(false);
  const [tellAboutSelection, setTellAboutSelection] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',company:'', address: '', address2: '', address3: '',
    town: '', postcode: '', country: 'BE', state: '', email: '',
    phone: '',vatNumber:'', password: '', confirmPassword: '', additional: '',
    isDifferent: false, isSubscribe: false,firstName2: '', surname2: '',
    phone2: '', postcode2: '', city2: '',
    country2: '', state2: '', type: 'Consumer', company2:'',address4:'',
    address5:'',address6:'', city:'',eMailInvoice:'',tellAbout:''
  });

  const handleInput = fieldName => value => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleTellAboutSelect = value => {
    setTellAboutSelection(value);
    setFormData(prev => ({
      ...prev,
      tellAbout:
        value === 'Other'
          ? (tellAboutList.includes(prev.tellAbout) ? '' : prev.tellAbout)
          : value
    }));
  };

  const navigate=useNavigate();

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
        <div className="table-row">
          <div className="label-cell">*Company Name</div>
          <div className="input-cell"><MyTextInput value={formData.company} setValue={handleInput('company')} /></div>
        </div>
        {/* Row: Address 1 */}
        <div className="table-row">
          <div className="label-cell">*Address 1</div>
          <div className="input-cell"><MyTextInput value={formData.address} setValue={handleInput('address')} /></div>
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
          <div className="input-cell"><MyTextInput value={formData.city} setValue={handleInput('city')} /></div>
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
              {combinedCountries.map(x => <option key={x.code} value={x.code}>{x.label}</option>)}
            </select>
            <select value={formData.country} onChange={e => handleInput('country')(e.target.value)} className="short-select">{combinedCountries.map(x=><option key={x.code} value={x.code}>{x.code}</option>)}</select>
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
          <div className="label-cell">Vat Number</div>
          <div className="input-cell"><MyTextInput value={formData.vatNumber} setValue={handleInput('vatNumber')} /></div>
        </div>
        {/* Password Fields */}
        <div className="table-row">
          <div className="label-cell">*Password</div>
          <div className="input-cell"><MyTextPassword value={formData.password} setValue={handleInput('password')} /></div>
        </div>
        <div className="table-row">
          <div className="label-cell">*Confirm Password</div>
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
            <div className="label-cell">*Address 1</div>
            <div className="input-cell">
              <MyTextInput value={formData.address4} setValue={handleInput('address4')} required />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">Address 2</div>
            <div className="input-cell">
              <MyTextInput value={formData.address5} setValue={handleInput('address5')} />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">Address 3</div>
            <div className="input-cell">
              <MyTextInput value={formData.address6} setValue={handleInput('address6')} />
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
              <select value={formData.country2} onChange={e => handleInput('country2')(e.target.value)} className="short-select">{combinedCountries.map(x=><option key={x.code} value={x.code}>{x.code}</option>)}</select>
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
          <input type="checkbox" checked={formData.isSubscribe} onChange={e => handleInput('isSubscribe')(e.target.checked)} />
          <span className="checkmark"></span>
          Yes please. I would like to subscribe to your mailings and receive news and offers.
        </label>
        <div className="we-will-container">
          <div className="text-content">
            <p>We will send the invoice to the e-mail you provided.</p>
            <p>You can also add another e-mail, separated by a comma, if you wish.</p>
          </div>
          
          <div className="input-group">
            <MyTextInput value={formData.weWill} setValue={handleInput('weWill')} required />
          </div>
        </div>
        <div style={{marginTop:'7.5px'}} className="we-will-container we-will-container2">
          <div className="text-content">
            <p style={{fontWeight:600,fontSize:'16px',color:'#006CA4',marginTop:0}}>Please tell us where you heard about us — it will help us improve!</p>
          </div>
          {tellAboutSelection === 'Other' ? (
            <div className="tell-about-combo">
              <input
                value={formData.tellAbout}
                onChange={e => handleInput('tellAbout')(e.target.value)}
                placeholder="Please specify"
              />
              <select
                className="tell-about-switch"
                onChange={e => handleTellAboutSelect(e.target.value)}
                value=""
              >
                <option value="" disabled></option>
                {tellAboutList.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          ) : (
            <select onChange={e => handleTellAboutSelect(e.target.value)} value={tellAboutSelection}>
              <option value="" disabled>Choose the answer</option>
              {tellAboutList.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          )}
        </div>
      </div>

      <button className="register-btn">Register</button>

      <div className="footer-info">
        SignXpert gathers your personal information when you set up an account, using it for
        advertising purposes and to handle and complete any future orders. You can learn more in our <Link to="/privacy-policy">privacy policy.</Link>
      </div>
    </form>
  );
};

export default RegisterBussines;