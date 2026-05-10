import React, { useState } from 'react';
import { $authHost } from '../http';

const UPS_SERVICES = [
  { code: '65', label: 'UPS Worldwide Saver' },
  { code: '07', label: 'UPS Worldwide Express' },
  { code: '08', label: 'UPS Worldwide Expedited' },
  { code: '11', label: 'UPS Standard' },
  { code: '54', label: 'UPS Express Plus' },
];

export default function UPSShipmentModal({ order, deliverySectionData, onClose, onSuccess }) {
  const countryRaw =
    order?.orderMongo?.checkout?.deliveryAddress?.country ||
    order?.country ||
    order?.user?.country ||
    '';

  const [form, setForm] = useState({
    name: deliverySectionData?.fullName || '',
    company: deliverySectionData?.companyName || '',
    address: deliverySectionData?.address1 || '',
    city: deliverySectionData?.town || '',
    postalCode: deliverySectionData?.postalCode || '',
    country: countryRaw.toUpperCase().slice(0, 2),
    phone: deliverySectionData?.mobile || order?.user?.phone || '',
    email: deliverySectionData?.email || order?.user?.email || '',
    weight: '1.0',
    serviceCode: '11',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

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
      });
      onSuccess(res.data.trackingNumber);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'UPS shipment creation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.title}>Create UPS Shipment</h3>

        <Field label="Name" value={form.name} onChange={set('name')} required />
        <Field label="Company" value={form.company} onChange={set('company')} />
        <Field label="Address" value={form.address} onChange={set('address')} required />
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
          <label style={styles.label}>Service</label>
          <select style={styles.select} value={form.serviceCode} onChange={set('serviceCode')}>
            {UPS_SERVICES.map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </select>
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
