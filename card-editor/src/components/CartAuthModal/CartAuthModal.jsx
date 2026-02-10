import React, { useEffect, useState } from 'react';
import './CartAuthModal.scss';
import MyTextInput from '../MyInput/MyTextInput';
import MyTextPassword from '../MyInput/MyTextPassword';
import ForgotPass from '../ForgotPass/ForgotPass';
import FormFogotPass from '../FormFogotPass/FormFogotPass';
import { $host } from '../../http';
import { useDispatch } from 'react-redux';
import { setUser } from '../../store/reducers/user';
import { Link, useNavigate } from 'react-router-dom';
import LoginForm from '../LoginForm/LoginForm';

const CartAuthModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotPass, setIsForgotPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = e => {
      if (e.key === 'Escape') onClose?.();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const submit = async e => {
    try {
      e.preventDefault();
      if (isSubmitting) return;

      setIsSubmitting(true);
      const res = await $host.post('auth/login', { email, password });
      dispatch(setUser({ token: res.data.token }));
      onClose?.();
      navigate('/');
    } catch (err) {
      alert('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleForgotPass = () => {
    setIsForgotPass(prev => !prev);
  };

  return (
    <div className="cart-auth-modal__overlay" onMouseDown={onClose} role="dialog" aria-modal>
      <LoginForm/>
    </div>
  );
};

export default CartAuthModal;
