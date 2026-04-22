import React, { useEffect, useState } from 'react'
import MyTextPassword from '../MyInput/MyTextPassword';
import { $authHost } from '../../http';

const ChangePassword = () => {
    const [oldPassowrd,setOldPassword]=useState('');
    const [newPassowrd,setNewPassowrd]=useState('');
    const [newPassowrd2,setNewPassowrd2]=useState('')
    const [isSendingReset, setIsSendingReset] = useState(false);

    useEffect(() => {
        setOldPassword('');
        setNewPassowrd('');
        setNewPassowrd2('');
    }, []);

    const updatePassword=async()=>{
        if(newPassowrd!=newPassowrd2){
            alert('passwords do not match');
            return;
        }
        try{
            const res=await $authHost.post('auth/update-password',{oldPassword:oldPassowrd,newPassword:newPassowrd});
            alert('password updated')
        }catch(err){
            alert("incorrect password");
        }
    }

    const sendForgotPassword = async () => {
        if (isSendingReset) return;
        try {
            setIsSendingReset(true);
            const me = await $authHost.get('auth/getMy');
            const email = String(me?.data?.user?.email || '').trim().toLowerCase();

            if (!email) {
                alert('Unable to find your email in profile.');
                return;
            }

            await $authHost.post('auth/sendNewPassword', { email });
            alert('A new password has been sent to your email.');
        } catch (err) {
            const message = err?.response?.data?.message || 'Failed to send password email.';
            alert(message);
        } finally {
            setIsSendingReset(false);
        }
    }
  return (
    <div className="password-section">
        <h3>Change Password</h3>
        <div className="password-flex-row">
            <div style={{display:'flex',flexDirection:'column',justifyContent:'right',alignItems:'flex-end'}}>
                <div className="registration-table pass-table">
                    <div className="table-row">
                        <div className="label-cell">Existing Password</div>
                        <div className="input-cell"><MyTextPassword name="existing-password" autoComplete="new-password" value={oldPassowrd} setValue={setOldPassword} /></div>
                    </div>
                    <div className="table-row">
                        <div className="label-cell">New Password</div>
                        <div className="input-cell"><MyTextPassword name="new-password" autoComplete="new-password" value={newPassowrd} setValue={setNewPassowrd} /></div>
                    </div>
                    <div className="table-row">
                        <div className="label-cell">Confirm New Password</div>
                        <div className="input-cell"><MyTextPassword name="confirm-new-password" autoComplete="new-password" value={newPassowrd2} setValue={setNewPassowrd2}/></div>
                    </div>
                </div>
                <div className="action-center">
                    <button  onClick={updatePassword} className="btn-blue-rect">Save Changes</button>
                </div>
            </div>
            <div className="pass-forgot-block">
                <p>* Forgot Password? Click send and we will email you a new temporary password.</p>
                <button className="btn-blue-oval" onClick={sendForgotPassword} disabled={isSendingReset}>
                    {isSendingReset ? 'Sending...' : 'Send'}
                </button>
            </div>
        </div>
    </div>
  )
}

export default ChangePassword