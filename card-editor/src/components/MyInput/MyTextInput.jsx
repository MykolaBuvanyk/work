import React from 'react';
import './MyTextInput.scss';

const MyTextInput = ({ value, setValue, name, required = false, placeholder = '' }) => {
  return (
    <div className="text-input-container">
      <input
        type="text"
        required={required}
        name={name}
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
};

export default MyTextInput;
