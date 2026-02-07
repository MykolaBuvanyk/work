import React from 'react'
import LoginForm from '../LoginForm/LoginForm'
import './Enter.scss'
import { useLocation } from 'react-router-dom'

const Enter = () => {
    const location=useLocation();
    console.log(location)
  return (
    <div className='enter-container'>
        <h1>Welcome to SignXpert — we’re glad to have you with us!</h1>
        <p>Your personal customer number is: {location.pathname.split('/').pop().padStart(3,'0')}</p>
        <p>To make things easy, we’ve also sent your customer number directly to your email address.</p>
        <p>You can now Log in below to start creating projects and placing orders.</p>
        <p>If you need any assistance, our team is always happy to support you.</p>
        <p>Kind regards,</p>
        <p>SignXpert</p>
        <br/>
        <br/>
        <LoginForm/>
    </div>
  )
}

export default Enter