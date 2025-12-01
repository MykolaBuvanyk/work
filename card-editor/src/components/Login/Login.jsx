import React from 'react';
import './Login.css';
import LoginForm from '../LoginForm/LoginForm';
import LoginRegister from '../LoginRegister/LoginRegister';

const Login = () => {
  return (
    <div className="login-container">
      <div className="form-log">
        <LoginForm />
      </div>
      <LoginRegister />
    </div>
  );
};

export default Login;
