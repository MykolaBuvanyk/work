import React, { useState } from 'react';
import './ForgotPass.scss';
import MyTextInput from '../MyInput/MyTextInput';

const ForgotPass = ({ setIsForgotPassword }) => {
  return (
    <div className="forgot-pass-container">
      <div onClick={setIsForgotPassword} className="title">
        Have you forgotten your password?
      </div>
    </div>
  );
};

export default ForgotPass;
