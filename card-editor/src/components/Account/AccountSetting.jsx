import React from 'react'
import './AccountSetting.scss'
import AccountHeader from './AccountHeader'

const AccountSetting = () => {
  return (
    <div className='account-setting'>
        <AccountHeader/>
        
        <div className="message-section">
            <h2 className="message-title">
                Here you can write a message that will be included with each your order.
            </h2>
            
            <div className="message-box">
                <div className="message-label">
                    Your Message to us
                </div>
                <div className="message-input-container">
                    <textarea 
                        className="message-textarea"
                        placeholder=""
                    ></textarea>
                </div>
            </div>
            
            <div className="button-container">
                <button className="send-button">Send</button>
            </div>
        </div>
    </div>
  )
}

export default AccountSetting