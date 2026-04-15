import React, { useEffect, useState } from 'react'
import './AccountSetting.scss'
import AccountHeader from './AccountHeader'
import { $authHost } from '../../http'

const extractLegacyAdditionalInformation = (rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';

    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return String(
                parsed.additionalInformation || parsed.additional || parsed.settings || ''
            ).trim();
        }
    } catch {
        // Legacy plain-string value.
    }

    return raw;
};

const AccountSetting = () => {
    const [additionalInformation, setAdditionalInformation] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const getMy = async () => {
        try {
            const res = await $authHost.get('auth/getMy');
            const user = res?.data?.user || {};
            const parsedAdditional = extractLegacyAdditionalInformation(user?.additional || '');
            setAdditionalInformation(
                String(user?.tellAbout || '').trim() ||
                parsedAdditional
            );
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
            const nextValue = String(additionalInformation || '').trim();
            await $authHost.put('auth/updateProfile', {
                additional: nextValue,
                tellAbout: nextValue,
            });
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
                Here you can write a additional information that will be included with each your order.
            </h2>

            <div className="message-box">
                <div className="message-label">
                    Additional Information
                </div>
                <div className="message-input-container">
                    <textarea
                        style={{fontFamily:'Inter'}}
                        className="message-textarea"
                        placeholder=""
                        value={additionalInformation}
                        onChange={(e) => setAdditionalInformation(e.target.value)}
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