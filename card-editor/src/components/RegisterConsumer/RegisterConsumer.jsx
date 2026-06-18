import React, { useState } from 'react';
import './RegisterConsumer.scss';
import MyTextPassword from '../MyInput/MyTextPassword';
import MyTextInput from '../MyInput/MyTextInput';
import { $host } from '../../http';
import combinedCountries from '../Countries';
import { useTranslation } from 'react-i18next';
import Link from '../Localized/LocalizedLink';
import useNavigate from '../Localized/useLocalizedNavigate';

const tellAboutList=[
  { value: 'Online / Internet', labelKey: 'RegisterConsumer.tellAbout.onlineInternet' },
  { value: 'Through samples', labelKey: 'RegisterConsumer.tellAbout.throughSamples' },
  { value: 'Via flyer', labelKey: 'RegisterConsumer.tellAbout.viaFlyer' },
  { value: 'Colleague', labelKey: 'RegisterConsumer.tellAbout.colleague' },
  { value: 'Social media', labelKey: 'RegisterConsumer.tellAbout.socialMedia' },
  { value: 'Event / exhibition', labelKey: 'RegisterConsumer.tellAbout.eventExhibition' },
  { value: 'Newsletter', labelKey: 'RegisterConsumer.tellAbout.newsletter' },
  { value: 'E-Mail', labelKey: 'RegisterConsumer.tellAbout.email' },
  { value: 'Other', labelKey: 'RegisterConsumer.tellAbout.other' }
]

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const parseEmailList = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const dedupeEmails = (emails) => {
  const seen = new Set();
  const result = [];

  emails.forEach((email) => {
    const key = normalizeEmail(email);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(String(email).trim());
  });

  return result;
};

const replaceEmailInList = (emails, previousEmail, nextEmail) => {
  const normalizedPrevious = normalizeEmail(previousEmail);
  if (!normalizedPrevious) return { emails: [...emails], replaced: false };

  const nextEmails = [...emails];
  const index = nextEmails.findIndex((item) => normalizeEmail(item) === normalizedPrevious);

  if (index === -1) {
    return { emails: nextEmails, replaced: false };
  }

  if (String(nextEmail || '').trim()) {
    nextEmails[index] = String(nextEmail).trim();
  } else {
    nextEmails.splice(index, 1);
  }

  return { emails: nextEmails, replaced: true };
};

const RegisterConsumer = () => {
  const {t}=useTranslation()
  const navigate = useNavigate();
  const [tellAboutSelection, setTellAboutSelection] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '', address: '', address2: '', address3: '',
    city: '', postcode: '', country: 'DE', state: '', email: '',
    phone: '', password: '', confirmPassword: '', additional: '',
    isDifferent: false, isSubscribe: false, firstName2: '', surname2: '',
    phone2: '', postcode2: '', city2: '',
    country2: '', state2: '', type: 'Consumer',
    company2:'',address4:'',address5:'', address6:'',
    eMailInvoice:'', weWill:'',tellAbout:''
  });

  console.log(4324,formData);

  const [isInvoice,setIsInvoice]=useState(false);
  const [invoiceEmailSync, setInvoiceEmailSync] = useState({
    linked: true,
    sourceValue: '',
  });

  const sumbit = async e => {
    if(formData.password!=formData.confirmPassword){
      e.preventDefault()
      alert(t("RegisterConsumer.passwordMustMatch"));
      formData.password='';
      formData.confirmPassword='';
      return;
    }
    try {
      e.preventDefault();
      const res = await $host.post('auth/register', formData);
      //dispatch(setUser({ token: res.data.token }));
      console.log(234324,res);
      navigate(`/login/enter/${res.data.newUser.id}`);
    } catch (err) {
      console.log(4324,err);
      const message = err?.response?.data?.message || t("RegisterConsumer.registrationFailed");
      alert(message);
    }
  };

  const handleInput = fieldName => value => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handlePrimaryEmailInput = (value) => {
    const nextPrimaryEmail = String(value || '').trim();

    setFormData((prev) => {
      let nextInvoiceList = parseEmailList(prev.weWill);
      let nextLinked = invoiceEmailSync.linked;

      if (invoiceEmailSync.linked) {
        const previousPrimaryEmail = String(invoiceEmailSync.sourceValue || '').trim();
        if (previousPrimaryEmail) {
          const replacement = replaceEmailInList(
            nextInvoiceList,
            previousPrimaryEmail,
            nextPrimaryEmail
          );
          nextInvoiceList = replacement.emails;

          if (!replacement.replaced) {
            nextLinked = false;
          }
        } else if (nextPrimaryEmail) {
          nextInvoiceList = [nextPrimaryEmail, ...nextInvoiceList];
        }

        if (!nextPrimaryEmail) {
          nextLinked = false;
        }
      }

      const nextWeWill = dedupeEmails(nextInvoiceList).join(', ');

      setInvoiceEmailSync({
        linked: nextLinked,
        sourceValue: nextPrimaryEmail,
      });

      return {
        ...prev,
        email: value,
        weWill: nextWeWill,
      };
    });
  };

  const handleInvoiceEmailsInput = (value) => {
    const currentPrimaryEmail = String(formData.email || '').trim();
    const normalizedEmails = new Set(parseEmailList(value).map(normalizeEmail));

    setFormData((prev) => ({ ...prev, weWill: value }));
    setInvoiceEmailSync(() => ({
      linked: !!currentPrimaryEmail && normalizedEmails.has(normalizeEmail(currentPrimaryEmail)),
      sourceValue: currentPrimaryEmail,
    }));
  };

  const handleTellAboutSelect = value => {
    setTellAboutSelection(value);
    setFormData(prev => ({
      ...prev,
      tellAbout:
        value === 'Other'
          ? (tellAboutList.some((item) => item.value === prev.tellAbout) ? '' : prev.tellAbout)
          : value
    }));
  };

  return (
    <form className="register-consumer-container" onSubmit={sumbit}>
      <div className="registration-table">
        <div className="table-row">
          <div className="label-cell">{t("RegisterConsumer.rr_1")}</div>
          <div className="input-cell"><MyTextInput required value={formData.firstName} setValue={handleInput('firstName')} /></div>
        </div>
        {/* Row: Address 1 */}
        <div className="table-row">
          <div className="label-cell">{t("RegisterConsumer.rr_2")}</div>
          <div className="input-cell"><MyTextInput required value={formData.address} setValue={handleInput('address')} /></div>
        </div>
        {/* Rows: Address 2 & 3 */}
        <div className="table-row">
          <div className="label-cell">{t("RegisterConsumer.rr_3")}</div>
          <div className="input-cell"><MyTextInput trq value={formData.address2} setValue={handleInput('address2')} /></div>
        </div>
        <div className="table-row">
          <div className="label-cell">{t("RegisterConsumer.rr_4")}</div>
          <div className="input-cell"><MyTextInput value={formData.address3} setValue={handleInput('address3')} /></div>
        </div>
        {/* Town & Postal */}
        <div className="table-row">
          <div className="label-cell">{t("RegisterConsumer.rr_5")}</div>
          <div className="input-cell"><MyTextInput required value={formData.city} setValue={handleInput('city')} /></div>
        </div>
        <div className="table-row">
          <div className="label-cell">{t("RegisterConsumer.rr_6")}</div>
          <div className="input-cell"><MyTextInput required value={formData.postcode} setValue={handleInput('postcode')} /></div>
        </div>
        {/* Country Select */}
        <div className="table-row">
          <div className="label-cell">{t("RegisterConsumer.rr_7")}</div>
          <div className="input-cell country-row">
            <select onChange={e => handleInput('country')(e.target.value)} value={formData.country}>
              {combinedCountries.map(x => <option key={x.code} value={x.code}>{x.label}</option>)}
            </select>
            <select value={formData.country} onChange={e => handleInput('country')(e.target.value)} className="short-select">{combinedCountries.map(x=><option key={x.code} value={x.code}>{x.code}</option>)}</select>
          </div>
        </div>
        {/* E-mail & Phone */}
        <div className="table-row">
          <div className="label-cell">{t("RegisterConsumer.rr_8")}</div>
          <div className="input-cell"><MyTextInput required value={formData.email} setValue={handlePrimaryEmailInput} /></div>
        </div>
        <div className="table-row">
          <div className="label-cell">{t("RegisterConsumer.rr_9")}</div>
          <div className="input-cell"><MyTextInput required value={formData.phone} setValue={handleInput('phone')} /></div>
        </div>
        {/* Password Fields */}
        <div className="table-row">
          <div className="label-cell">{t("RegisterConsumer.rr_10")}</div>
          <div className="input-cell"><MyTextPassword required value={formData.password} setValue={handleInput('password')} /></div>
        </div>
        <div className="table-row">
          <div className="label-cell">{t("RegisterConsumer.rr_11")}</div>
          <div className="input-cell"><MyTextPassword required value={formData.confirmPassword} setValue={handleInput('confirmPassword')} /></div>
        </div>
        {/* Additional Info */}
        <div className="table-row">
          <div className="label-cell">{t("RegisterConsumer.rr_12")}</div>
          <div className="input-cell"><MyTextInput value={formData.additional} setValue={handleInput('additional')} /></div>
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
          {t("RegisterConsumer.rr_13")}
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
            <div className="label-cell">{t("RegisterConsumer.rr_2")}</div>
            <div className="input-cell">
              <MyTextInput value={formData.address4} setValue={handleInput('address4')} required />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">{t("RegisterConsumer.rr_3")}</div>
            <div className="input-cell">
              <MyTextInput value={formData.address5} setValue={handleInput('address5')} />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">{t("RegisterConsumer.rr_4")}</div>
            <div className="input-cell">
              <MyTextInput value={formData.address6} setValue={handleInput('address6')} />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">{t("RegisterConsumer.rr_5")}</div>
            <div className="input-cell">
              <MyTextInput value={formData.city2} setValue={handleInput('city2')} required />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">{t("RegisterConsumer.rr_6")} </div>
            <div className="input-cell">
              <MyTextInput value={formData.postcode2} setValue={handleInput('postcode2')} required />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">{t("RegisterConsumer.rr_7")}</div>
            <div className="input-cell country-row">
              <select onChange={e => handleInput('country2')(e.target.value)} value={formData.country2}>
                {combinedCountries.map(x => <option key={x.code} value={x.code}>{x.label}</option>)}
              </select>
              <select value={formData.country2} onChange={e => handleInput('country2')(e.target.value)} className="short-select">{combinedCountries.map(x=><option key={x.code} value={x.code}>{x.code}</option>)}</select>
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">{t("RegisterConsumer.rr_8")}</div>
            <div className="input-cell">
              <MyTextInput value={formData.eMailInvoice} setValue={handleInput('eMailInvoice')} required />
            </div>
          </div>
          <div className="table-row">
            <div className="label-cell">{t("RegisterConsumer.rr_9")}</div>
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
          {t("RegisterConsumer.rr_14")}
        </label>
        <div className="we-will-container">
          <div className="text-content">
            <p>{t("RegisterConsumer.rr_15")}</p>
            <p>{t("RegisterConsumer.rr_16")}</p>
          </div>
          
          <div className="input-group">
              <MyTextInput value={formData.weWill} setValue={handleInvoiceEmailsInput} />
          </div>
        </div>
        <div style={{marginTop:'7.5px'}} className="we-will-container we-will-container2">
          <div className="text-content">
            <p>{t("RegisterConsumer.rr_17")}</p>
          </div>
          {tellAboutSelection === 'Other' ? (
            <div className="tell-about-combo">
              <input
                value={formData.tellAbout}
                onChange={e => handleInput('tellAbout')(e.target.value)}
                placeholder={t("RegisterConsumer.pleaseSpecify")}
              />
              <select
                className="tell-about-switch"
                onChange={e => handleTellAboutSelect(e.target.value)}
                value=""
              >
                <option value="" disabled></option>
                {tellAboutList.map(x => <option key={x.value} value={x.value}>{t(x.labelKey)}</option>)}
              </select>
            </div>
          ) : (
            <select onChange={e => handleTellAboutSelect(e.target.value)} value={tellAboutSelection}>
              <option value="" disabled>{t("RegisterConsumer.rr_18")}</option>
              {tellAboutList.map(x => <option key={x.value} value={x.value}>{t(x.labelKey)}</option>)}
            </select>
          )}
        </div>
      </div>

      <button className="register-btn" type="submit">{t("RegisterConsumer.rr_19")}</button>

      <div className="footer-info">
        {t("RegisterConsumer.rr_20")} <Link to="/privacy-policy">{t("RegisterConsumer.rr_21")}</Link>
      </div>
    </form>
  );
};

export default RegisterConsumer;
