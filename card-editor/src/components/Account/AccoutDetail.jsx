import React, { useEffect, useState } from 'react';
import './AccoutDetail.scss';
import MyTextInput from '../MyInput/MyTextInput';
import AccountHeader from './AccountHeader';
import { $authHost } from '../../http';
import ChangePassword from './ChangePassword';
import combinedCountries from '../Countries';
import { useDispatch } from 'react-redux';
import { mergeUser } from '../../store/reducers/user';

const AUTO_EMAIL_PREFS_KEY = 'account-detail-invoice-email-sync';

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
    result.push(email.trim());
  });

  return result;
};

const defaultAutoEmailSyncState = {
  initialized: false,
  linked: {
    address: false,
    invoice: false,
  },
  sourceValues: {
    address: '',
    invoice: '',
  },
};

const loadAutoEmailSyncState = (userId) => {
  if (!userId) return defaultAutoEmailSyncState;

  try {
    const raw = localStorage.getItem(AUTO_EMAIL_PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      initialized: !!parsed?.[userId]?.initialized,
      linked: {
        address: !!parsed?.[userId]?.linked?.address,
        invoice: !!parsed?.[userId]?.linked?.invoice,
      },
      sourceValues: {
        address: String(parsed?.[userId]?.sourceValues?.address || ''),
        invoice: String(parsed?.[userId]?.sourceValues?.invoice || ''),
      },
    };
  } catch {
    return defaultAutoEmailSyncState;
  }
};

const saveAutoEmailSyncState = (userId, syncState) => {
  if (!userId) return;

  try {
    const raw = localStorage.getItem(AUTO_EMAIL_PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[userId] = {
      initialized: !!syncState?.initialized,
      linked: {
        address: !!syncState?.linked?.address,
        invoice: !!syncState?.linked?.invoice,
      },
      sourceValues: {
        address: String(syncState?.sourceValues?.address || ''),
        invoice: String(syncState?.sourceValues?.invoice || ''),
      },
    };
    localStorage.setItem(AUTO_EMAIL_PREFS_KEY, JSON.stringify(parsed));
  } catch {}
};

const replaceEmailInList = (emails, previousEmail, nextEmail) => {
  const normalizedPrevious = normalizeEmail(previousEmail);
  if (!normalizedPrevious) return { emails, replaced: false };

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

const syncManagedInvoiceEmails = ({ currentValue, syncState, nextSourceValues }) => {
  let nextEmails = parseEmailList(currentValue);
  const nextLinked = {
    address: !!syncState?.linked?.address,
    invoice: !!syncState?.linked?.invoice,
  };

  ['address', 'invoice'].forEach((key) => {
    if (!nextLinked[key]) return;

    const previousEmail = syncState?.sourceValues?.[key] || '';
    const nextEmail = nextSourceValues?.[key] || '';
    const replacement = replaceEmailInList(nextEmails, previousEmail, nextEmail);
    nextEmails = replacement.emails;

    if (!replacement.replaced) {
      nextLinked[key] = false;
      return;
    }

    if (!String(nextEmail || '').trim()) {
      nextLinked[key] = false;
    }
  });

  return {
    value: dedupeEmails(nextEmails).join(', '),
    syncState: {
      initialized: true,
      linked: nextLinked,
      sourceValues: {
        address: String(nextSourceValues?.address || ''),
        invoice: String(nextSourceValues?.invoice || ''),
      },
    },
  };
};

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
  const [currentUserId, setCurrentUserId] = useState(null);
  const [autoEmailSyncState, setAutoEmailSyncState] = useState(defaultAutoEmailSyncState);
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();

  const getMy = async () => {
    try {
      const res = await $authHost.get('auth/getMy');
      const user = res.data.user;
      const addressEmail = String(user.email || '').trim();
      const invoiceEmail = String(user.eMailInvoice || '').trim();
      const nextSourceValues = {
        address: addressEmail,
        invoice: invoiceEmail,
      };
      const savedAutoEmailSyncState = loadAutoEmailSyncState(user.id);
      const savedInvoiceEmails = parseEmailList(user.weWill || '');
      const normalizedSavedEmails = new Set(savedInvoiceEmails.map(normalizeEmail));
      let nextAutoEmailSyncState = {
        initialized: !!savedAutoEmailSyncState.initialized,
        linked: {
          address: !!savedAutoEmailSyncState.linked?.address,
          invoice: !!savedAutoEmailSyncState.linked?.invoice,
        },
        sourceValues: {
          address: String(savedAutoEmailSyncState.sourceValues?.address || ''),
          invoice: String(savedAutoEmailSyncState.sourceValues?.invoice || ''),
        },
      };
      let combinedInvoiceEmails = String(user.weWill || '');

      if (!savedAutoEmailSyncState.initialized) {
        if (savedInvoiceEmails.length === 0) {
          combinedInvoiceEmails = dedupeEmails([addressEmail, invoiceEmail]).join(', ');
          nextAutoEmailSyncState = {
            initialized: true,
            linked: {
              address: !!addressEmail,
              invoice: !!invoiceEmail,
            },
            sourceValues: nextSourceValues,
          };
        } else {
          nextAutoEmailSyncState = {
            initialized: true,
            linked: {
              address: !!addressEmail && normalizedSavedEmails.has(normalizeEmail(addressEmail)),
              invoice: !!invoiceEmail && normalizedSavedEmails.has(normalizeEmail(invoiceEmail)),
            },
            sourceValues: nextSourceValues,
          };
        }
      } else {
        const syncResult = syncManagedInvoiceEmails({
          currentValue: user.weWill || '',
          syncState: savedAutoEmailSyncState,
          nextSourceValues,
        });
        combinedInvoiceEmails = syncResult.value;
        nextAutoEmailSyncState = syncResult.syncState;
      }

      setCurrentUserId(user.id);
      setAutoEmailSyncState(nextAutoEmailSyncState);

      // Розподіляємо дані з fullUser по двох об'єктах стейту
      const addrData = {};
      addressFields.forEach(f => addrData[f.key] = user[f.key] || '');
      addrData.weWill = combinedInvoiceEmails;
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

  useEffect(() => {
    if (!autoEmailSyncState.initialized) return;

    const nextSourceValues = {
      address: String(address.email || '').trim(),
      invoice: String(invoice.eMailInvoice || '').trim(),
    };

    const sourcesChanged =
      normalizeEmail(nextSourceValues.address) !==
        normalizeEmail(autoEmailSyncState?.sourceValues?.address || '') ||
      normalizeEmail(nextSourceValues.invoice) !==
        normalizeEmail(autoEmailSyncState?.sourceValues?.invoice || '');

    // Do not touch manual input in "weWill" unless source address/invoice emails changed.
    if (!sourcesChanged) return;

    const syncResult = syncManagedInvoiceEmails({
      currentValue: address.weWill || '',
      syncState: autoEmailSyncState,
      nextSourceValues,
    });

    setAddress((prev) => {
      if ((prev?.weWill || '') === syncResult.value) return prev;
      return { ...prev, weWill: syncResult.value };
    });

    setAutoEmailSyncState((prev) => {
      const prevSerialized = JSON.stringify(prev);
      const nextSerialized = JSON.stringify(syncResult.syncState);
      return prevSerialized === nextSerialized ? prev : syncResult.syncState;
    });
  }, [address.email, invoice.eMailInvoice, autoEmailSyncState]);

  useEffect(() => {
    saveAutoEmailSyncState(currentUserId, autoEmailSyncState);
  }, [currentUserId, autoEmailSyncState]);

  const handleInput = (setter) => (field) => (val) => {
    setter(prev => ({ ...prev, [field]: val }));
  };

  const handleInvoiceEmailsInput = (value) => {
    const parsedEmails = parseEmailList(value);
    const normalizedEmails = new Set(parsedEmails.map(normalizeEmail));
    const nextSourceValues = {
      address: String(address.email || '').trim(),
      invoice: String(invoice.eMailInvoice || '').trim(),
    };

    setAddress((prev) => ({ ...prev, weWill: value }));
    setAutoEmailSyncState((prev) => ({
      initialized: true,
      linked: {
        address:
          !!prev?.linked?.address &&
          !!nextSourceValues.address &&
          normalizedEmails.has(normalizeEmail(nextSourceValues.address)),
        invoice:
          !!prev?.linked?.invoice &&
          !!nextSourceValues.invoice &&
          normalizedEmails.has(normalizeEmail(nextSourceValues.invoice)),
      },
      sourceValues: nextSourceValues,
    }));
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
                setValue={handleInvoiceEmailsInput}
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