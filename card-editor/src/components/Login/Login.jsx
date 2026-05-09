import React from 'react';
import './Login.scss';
import LoginForm from '../LoginForm/LoginForm';
import LoginRegister from '../LoginRegister/LoginRegister';
import { useTranslation } from 'react-i18next';

const Login = () => {
  const {t}=useTranslation()
  return (
    <div className="login-container">
      <h1>{t("Login.l_1")}</h1>
      <p>{t("Login.l_2")}</p>
      <div className="info" style={{ marginBottom: '46px' }}>
        {t("Login.l_3")}
      </div>
      <div className="login-main">
        <div className="form-log">
          <LoginForm />
          {
            //<PleaceTell/>
          }
        </div>
        <div className="form-log">
          <LoginRegister />
        </div>
      </div>
    </div>
  );
};

export default Login;
