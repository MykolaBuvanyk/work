import React, { useState } from 'react';
import './FormFogotPass.scss';

const FormFogotPass = ({ isForgotPass }) => {
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const sumbit = () => {
    try {
    } catch (err) {}
  };
  return (
    <form onSubmit={sumbit} className={`form-fogot-pass ${isForgotPass ? 'show' : 'close'}`}>
      <input
        style={{ borderColor: error ? '#FF0000' : '#006CA4', color: error ? '#FF0000' : '#006CA4' }}
        type="text"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="E-mail"
        required
      />
      <div className="message">{error}</div>
      <button>Request a new password</button>
    </form>
  );
};

export default FormFogotPass;
