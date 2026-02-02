import React, { useState } from 'react';
import './LoginForm.scss';
import MyTextInput from '../MyInput/MyTextInput';
import MyTextPassword from '../MyInput/MyTextPassword';
import { $host } from '../../http';
import { useDispatch } from 'react-redux';
import { setUser } from '../../store/reducers/user';
import { useNavigate } from 'react-router-dom';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const submit = async (e) => {
    try {
      e.preventDefault();
      const res = await $host.post('auth/login', { email, password });
      dispatch(setUser({ token: res.data.token }));
      navigate('/');
    } catch (err) {
      alert('error');
    }
  };

  return (
    <div className="login-form-container">
      <div className="login-header">
        <div className="icon-wrapper">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="#006ca4"/>
          </svg>
        </div>
        <h2>Already Customer</h2>
      </div>

      <form onSubmit={submit}>
        <div className="login-table">
          <div className="table-row top-row">
            <div className="table-label">
              <label>E-Mail address or Customer number</label>
            </div>
            <div className="table-input">
              <MyTextInput value={email} setValue={setEmail} required />
            </div>
          </div>
          <div className="table-row">
            <div className="table-label">
              <label>Passport</label>
            </div>
            <div className="table-input">
              <MyTextPassword value={password} setValue={setPassword} required />
            </div>
          </div>
        </div>

        <div className="forgot-password-link">
          <a href="/forgot">Have you forgotten your password?</a>
        </div>

        <button type="submit" className="sign-in-btn">
          Sign In
        </button>
      </form>
    </div>
  );
};

export default LoginForm;