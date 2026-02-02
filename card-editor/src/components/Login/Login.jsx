import React from 'react';
import './Login.scss';
import LoginForm from '../LoginForm/LoginForm';
import LoginRegister from '../LoginRegister/LoginRegister';
import PleaceTell from '../PleaceTell/PleaceTell';
import WeWiill from '../WeWill/WeWiill';

const Login = () => {
  return (
    <div className="login-container">
      <h1>Register a new account</h1>
      <p>To place an order with us, you first need to create an account. It’s quick and easy!</p>
      <div className="info">
        Fields marked with an asterisk (*) are required. Choose a password, and we’ll send you a confirmation email shortly.
      </div>
      <div className="login-main">
        <div className="form-log">
           <LoginForm />
           <PleaceTell/>
        </div>
        <div className="form-log">
          <LoginRegister />
          <WeWiill/>
        </div>
      </div>
    </div>
  );
};

export default Login;
