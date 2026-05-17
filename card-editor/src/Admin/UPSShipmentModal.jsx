import React, { useState } from 'react';
import { $authHost } from '../http';
import combinedCountries from '../components/Countries';

function resolveCountryCode(raw) {
  if (!raw) return '';
  const s = raw.trim();
  if (s.length === 2) return s.toUpperCase();
  const found = combinedCountries.find(
    c => c.label.toLowerCase() === s.toLowerCase()
  );
  return found ? found.code : s.toUpperCase().slice(0, 2);
}

const UPS_SERVICES = [
  { code: 'ENV', label: 'UPS Envelope' },
  { code: 'NDA', label: 'UPS Next Day Package' },
  { code: 'E12', label: 'UPS Express before 12 PM' },
  { code: 'SAT', label: 'UPS Saturday Delivery' },
  { code: '65', label: 'UPS Worldwide Saver' },
  { code: '07', label: 'UPS Worldwide Express' },
  { code: '08', label: 'UPS Worldwide Expedited' },
  { code: '11', label: 'UPS Standard' },
  { code: '54', label: 'UPS Express Plus' },
];

export default function UPSShipmentModal({ order, deliverySectionData, onClose, onSuccess }) {
  const countryRaw =
    order?.country ||
    order?.user?.country ||
    order?.orderMongo?.checkout?.deliveryAddress?.country ||
    '';

  const [form, setForm] = useState({
    name: deliverySectionData?.fullName || '',
    company: deliverySectionData?.companyName || '',
    address: deliverySectionData?.address1 || '',
    address2: deliverySectionData?.address2 || '',
    address3: deliverySectionData?.address3 || '',
    city: deliverySectionData?.town || '',
    postalCode: deliverySectionData?.postalCode || '',
    country: resolveCountryCode(countryRaw),
    phone: deliverySectionData?.mobile || order?.user?.phone || '',
    email: deliverySectionData?.email || order?.user?.email || '',
    weight: '1.0',
    length: '',
    width: '',
    height: '',
    declaredValue: '',
    serviceCode: '11',
  });

  const today = new Date().toISOString().split('T')[0];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdTracking, setCreatedTracking] = useState(null);
  const [pickupConfirmation, setPickupConfirmation] = useState(null);
  const [voiding, setVoiding] = useState(false);
  const [rates, setRates] = useState(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [schedulePickup, setSchedulePickup] = useState(false);
  const [pickupDate, setPickupDate] = useState(today);

  const set = (field) => (e) => { setForm((prev) => ({ ...prev, [field]: e.target.value })); setRates(null); };

  const getRates = async () => {
    if (!form.city || !form.postalCode || !form.country) {
      setError('Fill in City, Postal Code and Country to get rates.');
      return;
    }
    setRatesLoading(true);
    setRates(null);
    setError('');
    try {
      const res = await $authHost.post('ups/get-rates', {
        address: form.address,
        city: form.city,
        postalCode: form.postalCode,
        country: form.country,
        weight: form.weight,
        length: form.length,
        width: form.width,
        height: form.height,
      });
      setRates(res.data.rates);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to get rates.');
    } finally {
      setRatesLoading(false);
    }
  };

  const adjustWeight = (delta) => {
    setForm((prev) => {
      const next = Math.max(0.1, parseFloat(prev.weight || 1) + delta);
      return { ...prev, weight: parseFloat(next.toFixed(2)).toString() };
    });
  };


  const submit = async () => {
    setError('');
    if (!form.name || !form.address || !form.city || !form.postalCode || !form.country) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    try {
      const res = await $authHost.post('ups/create-shipment', {
        orderId: order.id,
        ...form,
        schedulePickup,
        pickupDate,
      });
      setCreatedTracking(res.data.trackingNumber);
      setPickupConfirmation(res.data.pickupConfirmation || null);
      onSuccess(res.data.trackingNumber);
    } catch (err) {
      setError(err?.response?.data?.message || 'UPS shipment creation failed.');
    } finally {
      setLoading(false);
    }
  };

  const voidAndEdit = async () => {
    setVoiding(true);
    try {
      await $authHost.post('ups/void-shipment', { trackingNumber: createdTracking });
      setCreatedTracking(null);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to void shipment. Try voiding on UPS.com manually.');
      setCreatedTracking(null);
    } finally {
      setVoiding(false);
    }
  };

  if (createdTracking) {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <h3 style={{...styles.title, color:'#1a7a1a'}}>✓ Shipment Created</h3>
          <p style={{fontSize:'14px', marginBottom:'8px'}}>Tracking number saved to order:</p>
          <div style={{background:'#f0f7ff', border:'1px solid #0073bc', borderRadius:'6px', padding:'12px 16px', marginBottom:'16px'}}>
            <span style={{fontSize:'18px', fontWeight:'700', color:'#0073bc', letterSpacing:'1px'}}>{createdTracking}</span>
          </div>
          {pickupConfirmation && (
            <div style={{background:'#f0fff0', border:'1px solid #4caf50', borderRadius:'6px', padding:'10px 14px', marginBottom:'12px'}}>
              <div style={{fontSize:'13px', color:'#1a7a1a', fontWeight:600}}>✓ Pickup Scheduled</div>
              <div style={{fontSize:'13px', color:'#333'}}>Confirmation (PRN): <strong>{pickupConfirmation}</strong></div>
              <div style={{fontSize:'12px', color:'#555'}}>Date: {pickupDate}</div>
            </div>
          )}
          {schedulePickup && !pickupConfirmation && (
            <div style={{background:'#f5f5f5', border:'1px solid #ccc', borderRadius:'6px', padding:'8px 12px', marginBottom:'12px', fontSize:'13px', color:'#555'}}>
              ℹ️ To schedule pickup for <strong>{pickupDate}</strong>:{' '}
              <a href="https://www.ups.com/ipr/schedule-pickup" target="_blank" rel="noreferrer" style={{color:'#0073bc'}}>
                Open UPS Schedule Pickup →
              </a>{' '}enter tracking number from above, fill address and date.
            </div>
          )}
          <p style={{fontSize:'13px', color:'#555', marginBottom:'16px'}}>
            To edit data — void this shipment and create a new one with corrected details.
          </p>
          <div style={{display:'flex', gap:'10px', flexDirection:'column'}}>
            <a
              href={`https://www.ups.com/track?tracknum=${createdTracking}`}
              target="_blank"
              rel="noreferrer"
              style={{...styles.submitBtn, textDecoration:'none', textAlign:'center', display:'block'}}
            >
              View on UPS.com →
            </a>
            <button
              style={{...styles.cancelBtn, borderColor:'#d00', color:'#d00'}}
              onClick={voidAndEdit}
              disabled={voiding}
            >
              {voiding ? 'Voiding...' : '✕ Void & Edit data'}
            </button>
            <button style={styles.cancelBtn} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.title}>Create UPS Shipment</h3>

        <Field label="Name" value={form.name} onChange={set('name')} required />
        <Field label="Company" value={form.company} onChange={set('company')} />
        <Field label="Address Line 1" value={form.address} onChange={set('address')} required />
        <Field label="Address Line 2" value={form.address2} onChange={set('address2')} />
        <Field label="Address Line 3" value={form.address3} onChange={set('address3')} />
        <Field label="City" value={form.city} onChange={set('city')} required />
        <Field label="Postal Code" value={form.postalCode} onChange={set('postalCode')} required />
        <Field label="Country (2-letter)" value={form.country} onChange={set('country')} required maxLength={2} />
        <Field label="Phone" value={form.phone} onChange={set('phone')} />
        <Field label="Email" value={form.email} onChange={set('email')} />

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Weight (kg)</label>
          <div style={styles.weightRow}>
            <button style={styles.weightBtn} onClick={() => adjustWeight(-0.5)}>−0.5</button>
            <input
              style={{ ...styles.input, width: '70px', textAlign: 'center' }}
              value={form.weight}
              onChange={set('weight')}
              type="number"
              min="0.1"
              step="0.1"
            />
            <button style={styles.weightBtn} onClick={() => adjustWeight(0.5)}>+0.5</button>
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Dimensions (cm) — optional for parcel</label>
          <div style={{display:'flex', gap:'8px'}}>
            <input style={{...styles.input, width:'80px'}} placeholder="L" type="number" min="1" value={form.length} onChange={set('length')} />
            <input style={{...styles.input, width:'80px'}} placeholder="W" type="number" min="1" value={form.width} onChange={set('width')} />
            <input style={{...styles.input, width:'80px'}} placeholder="H" type="number" min="1" value={form.height} onChange={set('height')} />
          </div>
          <span style={{fontSize:'11px', color:'#888'}}>Length × Width × Height</span>
        </div>

        <Field label="Declared Value (EUR) — optional" value={form.declaredValue} onChange={set('declaredValue')} />

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Service</label>
          <button
            style={{...styles.cancelBtn, borderColor:'#0073bc', color:'#0073bc', width:'100%', marginBottom:'8px'}}
            onClick={getRates}
            disabled={ratesLoading}
          >
            {ratesLoading ? 'Getting rates...' : '💰 Get Rates from UPS'}
          </button>
          {rates && rates.length > 0 && (
            <div style={{fontSize:'11px', color:'#888', marginBottom:'4px'}}>
              * Account rates (excl. fuel surcharges)
            </div>
          )}
          {rates && rates.length > 0 && (
            <div style={{display:'flex', flexDirection:'column', gap:'6px', marginBottom:'8px'}}>
              {rates.map(r => (
                <div
                  key={r.serviceCode}
                  onClick={() => setForm(p => ({...p, serviceCode: r.serviceCode}))}
                  style={{
                    border: `2px solid ${form.serviceCode === r.serviceCode ? '#0073bc' : '#ddd'}`,
                    borderRadius:'6px', padding:'8px 12px', cursor:'pointer',
                    background: form.serviceCode === r.serviceCode ? '#f0f7ff' : '#fff',
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                  }}
                >
                  <div>
                    <div style={{fontWeight:600, fontSize:'13px'}}>{r.serviceName || r.serviceCode}</div>
                    {r.deliveryDate && <div style={{fontSize:'12px', color:'#555'}}>{r.deliveryDate}</div>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700, fontSize:'16px', color:'#0073bc'}}>
                      {r.currency} {parseFloat(r.amount).toFixed(2)}
                    </div>
                    {r.publishedAmount && (
                      <div style={{fontSize:'11px', color:'#999', textDecoration:'line-through'}}>
                        {r.currency} {parseFloat(r.publishedAmount).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {rates && rates.length === 0 && (
            <div style={{fontSize:'13px', color:'#888', marginBottom:'8px'}}>No rates available for this destination.</div>
          )}
          <select style={styles.select} value={form.serviceCode} onChange={e => setForm(p => ({...p, serviceCode: e.target.value}))}>
            {UPS_SERVICES.map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </select>
        </div>

        <div style={styles.fieldGroup}>
          <label style={{...styles.label, fontWeight:600, marginBottom:'8px'}}>Do you need to schedule a pickup?</label>
          <label style={styles.radioLabel}>
            <input
              type="radio"
              name="pickup"
              checked={!schedulePickup}
              onChange={() => setSchedulePickup(false)}
              style={{marginRight:'8px'}}
            />
            I'll drop off my shipment or include it in another pickup.
          </label>
          <label style={{...styles.radioLabel, marginTop:'6px'}}>
            <input
              type="radio"
              name="pickup"
              checked={schedulePickup}
              onChange={() => setSchedulePickup(true)}
              style={{marginRight:'8px'}}
            />
            Schedule a new pickup.
          </label>
          <div style={{marginTop:'10px'}}>
            <label style={styles.label}>Pickup Date *</label>
            <input
              type="date"
              style={styles.input}
              value={pickupDate}
              min={today}
              onChange={e => setPickupDate(e.target.value)}
            />
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose} disabled={loading}>Cancel</button>
          <button style={styles.submitBtn} onClick={submit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Shipment'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required, maxLength }) {
  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{label}{required && ' *'}</label>
      <input
        style={styles.input}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
      />
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  },
  modal: {
    background: '#fff', borderRadius: '8px', padding: '24px',
    width: '420px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  title: {
    margin: '0 0 18px 0', fontSize: '18px', fontWeight: 700, color: '#000',
  },
  fieldGroup: { marginBottom: '12px' },
  label: { display: 'block', fontSize: '13px', color: '#333', marginBottom: '4px' },
  input: {
    width: '100%', boxSizing: 'border-box', height: '34px',
    border: '1px solid #ccc', borderRadius: '4px', padding: '0 8px', fontSize: '14px',
  },
  weightRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  weightBtn: {
    background: '#3e73a0', color: '#fff', border: 'none', borderRadius: '4px',
    padding: '4px 10px', cursor: 'pointer', fontSize: '13px',
  },
  select: {
    width: '100%', height: '34px', border: '1px solid #ccc',
    borderRadius: '4px', padding: '0 8px', fontSize: '14px', background: '#fff',
  },
  radioLabel: {
    display: 'flex', alignItems: 'center', fontSize: '13px', color: '#333', cursor: 'pointer',
  },
  error: {
    color: '#d00', fontSize: '13px', marginBottom: '10px',
    background: '#fff0f0', padding: '8px', borderRadius: '4px',
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' },
  cancelBtn: {
    padding: '6px 18px', border: '1px solid #ccc', borderRadius: '4px',
    background: '#fff', cursor: 'pointer', fontSize: '14px',
  },
  submitBtn: {
    padding: '6px 18px', border: 'none', borderRadius: '4px',
    background: '#0095e2', color: '#fff', cursor: 'pointer', fontSize: '14px',
  },
};
