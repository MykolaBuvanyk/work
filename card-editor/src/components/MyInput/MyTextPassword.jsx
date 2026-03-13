import React, { useState } from 'react';
import './MyTextPassword.scss';
import { FaEyeSlash } from 'react-icons/fa';
import { FaEye } from 'react-icons/fa';

const MyTextPassword = ({ value, setValue, name, required = false }) => {
  const [isPass, setIsPass] = useState(true);
  const EyeIcon = isPass ? FaEyeSlash : FaEye;

  return (
    <div className="pass-input-container">
      <input
        type={isPass ? 'password' : 'text'}
        required={required}
        name={name}
        value={value}
        onChange={e => setValue(e.target.value)}
      />
      <div onClick={() => setIsPass(prev => !prev)} className="svg-cont" aria-label="Toggle password visibility">
        <EyeIcon key={isPass ? 'hidden' : 'visible'} />
      </div>
    </div>
  );
};

export default MyTextPassword;
