import React, { useEffect, useState } from 'react'
import './AccountSetting.scss'
import AccountHeader from './AccountHeader'
import { $authHost } from '../../http'

const AccountSetting = () => {
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const getMy = async () => {
        try {
            const res = await $authHost.get('auth/getMy');
            setMessage(res?.data?.user?.additional || '');
        } catch (err) {
            console.error(err);
            alert('Error loading your message');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        getMy();
    }, []);

    const handleSend = async () => {
        if (isSaving) return;
        try {
            setIsSaving(true);
            await $authHost.put('auth/updateProfile', { additional: message });
            alert('Message saved successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to save message');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className='account-setting'>
                <AccountHeader/>
            </div>
        );
    }

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
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    ></textarea>
                </div>
            </div>
            
            <div className="button-container">
                <button className="send-button" onClick={handleSend} disabled={isSaving}>Send</button>
            </div>
        </div>
    </div>
  )
}

export default AccountSetting