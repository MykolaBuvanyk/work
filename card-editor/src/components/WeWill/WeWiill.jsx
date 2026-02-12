import React, { useState } from 'react';
import './WeWiill.scss';

const WeWiill = () => {
  const [email, setEmail] = useState('');

  const handleSend = () => {
    console.log("Invoice email sent to:", email);
    // Додайте тут логіку відправки
  };

  return (
    <div className="we-will-container">
      <div className="text-content">
        <p>We will send the invoice to the e-mail you provided.</p>
        <p>You can also add another e-mail, separated by a comma, if you wish.</p>
      </div>
      
      <div className="input-group">
        <input 
          type="text" 
          className="email-input" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder=""
        />
      </div>
    </div>
  );
};

export default WeWiill;