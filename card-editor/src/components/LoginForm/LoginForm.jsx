import React, { useState } from 'react';
import './LoginForm.scss';
import MyTextInput from '../MyInput/MyTextInput';
import MyTextPassword from '../MyInput/MyTextPassword';
import { $host } from '../../http';
import { useDispatch } from 'react-redux';
import { setUser } from '../../store/reducers/user';
import { Link, useNavigate } from 'react-router-dom';

const LoginForm = ({toRegister=false, onSuccess}) => {
  const [email, setEmail] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isForgot,setIsForgot]=useState(false)
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const submit = async (e) => {
    try {
      e.preventDefault();
      const res = await $host.post('auth/login', { email, password });
      dispatch(setUser({ token: res.data.token }));
      onSuccess?.();
      navigate('/');
    } catch (err) {
      alert('error');
    }
  };

  const forgotPass=async()=>{
    try {
      const res=await $host.post('auth/sendNewPassword',{email:forgotEmail});
      alert('A new password has been sent to your email.');
    }catch(err){
      alert('error');
    }
  }

  return (
    <div className="login-form-container">
      <div className="login-header">
        <div className="icon-wrapper">
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M28 28.8867C29.6844 27.3283 31.0278 25.438 31.9457 23.3349C32.8636 21.2318 33.336 18.9614 33.3333 16.6667C33.3333 7.46167 25.8717 0 16.6667 0C7.46168 0 1.21812e-05 7.46167 1.21812e-05 16.6667C-0.00280092 18.9904 0.481656 21.2889 1.42211 23.4139C2.36257 25.5388 3.73813 27.4429 5.46001 29.0033C8.52341 31.7961 12.5213 33.3408 16.6667 33.3333C20.8715 33.3409 24.9223 31.7516 28 28.8867ZM26.6067 25.5533C28.3223 23.6348 29.4459 21.2606 29.842 18.7175C30.2381 16.1744 29.8897 13.5711 28.8388 11.2216C27.7879 8.87216 26.0795 6.87707 23.9198 5.47716C21.76 4.07724 19.2413 3.33233 16.6675 3.33233C14.0938 3.33233 11.575 4.07724 9.41526 5.47716C7.25552 6.87707 5.54711 8.87216 4.49623 11.2216C3.44536 13.5711 3.09693 16.1744 3.49301 18.7175C3.88909 21.2606 5.01274 23.6348 6.72835 25.5533C8.17434 23.2066 10.4026 21.4459 13.02 20.5817C11.818 19.796 10.9018 18.6432 10.4078 17.2948C9.91376 15.9465 9.86831 14.4747 10.2782 13.0984C10.6881 11.7221 11.5314 10.515 12.6826 9.65668C13.8339 8.79834 15.2315 8.33466 16.6675 8.33466C18.1035 8.33466 19.5011 8.79834 20.6524 9.65668C21.8036 10.515 22.6469 11.7221 23.0568 13.0984C23.4667 14.4747 23.4213 15.9465 22.9272 17.2948C22.4332 18.6432 21.517 19.796 20.315 20.5817C22.9327 21.4463 25.161 23.206 26.6067 25.5533ZM24.04 27.7783C23.3321 26.4364 22.2712 25.3132 20.9718 24.5299C19.6725 23.7465 18.1839 23.3328 16.6667 23.3333C15.1497 23.3331 13.6615 23.747 12.3625 24.5303C11.0634 25.3136 10.0028 26.4366 9.29501 27.7783C11.4067 29.1817 13.9417 30 16.6667 30C19.3917 30 21.9283 29.1833 24.04 27.7783ZM16.6667 18.3333C17.5507 18.3333 18.3986 17.9821 19.0237 17.357C19.6488 16.7319 20 15.8841 20 15C20 14.1159 19.6488 13.2681 19.0237 12.643C18.3986 12.0179 17.5507 11.6667 16.6667 11.6667C15.7826 11.6667 14.9348 12.0179 14.3097 12.643C13.6845 13.2681 13.3333 14.1159 13.3333 15C13.3333 15.8841 13.6845 16.7319 14.3097 17.357C14.9348 17.9821 15.7826 18.3333 16.6667 18.3333Z" fill="#006CA4"/>
          </svg>
        </div>
        <h2>Already Customer</h2>
      </div>

      <form className='form' onSubmit={submit}>
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
              <label>Password</label>
            </div>
            <div className="table-input">
              <MyTextPassword value={password} setValue={setPassword} required />
            </div>
          </div>
        </div>

        <div className="forgot-password-link">
          <div style={{cursor:'pointer'}} onClick={()=>setIsForgot(!isForgot)}>Have you forgotten your password?</div>
        </div>
        {isForgot &&
          <>
            <p style={{marginBottom:'10px'}}>You will receive an email with a new password.</p>
            <div style={{marginBottom:'15px'}} className="login-table">
              <div className="table-row top-row">
                <div className="table-label">
                  <label>E-mail address</label>
                </div>
                <div className="table-input">
                  <MyTextInput value={forgotEmail} setValue={setForgotEmail} required />
                </div>
              </div>
            </div>
            <button onClick={forgotPass} style={{marginBottom:'20px'}} type="button" className="sign-in-btn">
              send
            </button>
          </>
        }
        {!isForgot&&
          <button type="submit" className="sign-in-btn">
            Sign In
          </button>
        }
        {toRegister&&
        <div className="toReg">
          <Link to="/login">Don't have an account? Register now</Link>
        </div>
        }
      </form>
    </div>
  );
};

export default LoginForm;