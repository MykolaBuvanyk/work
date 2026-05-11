import React, { useEffect, useState } from 'react'
import MyTextPassword from '../MyInput/MyTextPassword';
import { $authHost } from '../../http';
import { useTranslation } from 'react-i18next';

const ChangePassword = () => {
    const { t } = useTranslation();
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
            alert(t('MyAccount.password.passwordsDoNotMatch'));
            return;
        }
        try{
            await $authHost.post('auth/update-password',{oldPassword:oldPassowrd,newPassword:newPassowrd});
            alert(t('MyAccount.password.passwordUpdated'))
        }catch{
            alert(t('MyAccount.password.incorrectPassword'));
        }
    }

    const sendForgotPassword = async () => {
        if (isSendingReset) return;
        try {
            setIsSendingReset(true);
            const me = await $authHost.get('auth/getMy');
            const email = String(me?.data?.user?.email || '').trim().toLowerCase();

            if (!email) {
                alert(t('MyAccount.password.emailNotFound'));
                return;
            }

            await $authHost.post('auth/sendNewPassword', { email });
            alert(t('MyAccount.password.newPasswordSent'));
        } catch (err) {
            const message = err?.response?.data?.message || t('MyAccount.password.sendPasswordFailed');
            alert(message);
        } finally {
            setIsSendingReset(false);
        }
    }
  return (
    <div className="password-section">
        <h3>{t('MyAccount.password.title')}</h3>
        <div className="password-flex-row">
            <div style={{display:'flex',flexDirection:'column',justifyContent:'right',alignItems:'flex-end'}}>
                <div className="registration-table pass-table">
                    <div className="table-row">
                        <div className="label-cell">{t('MyAccount.password.existingPassword')}</div>
                        <div className="input-cell"><MyTextPassword name="existing-password" autoComplete="new-password" value={oldPassowrd} setValue={setOldPassword} /></div>
                    </div>
                    <div className="table-row">
                        <div className="label-cell">{t('MyAccount.password.newPassword')}</div>
                        <div className="input-cell"><MyTextPassword name="new-password" autoComplete="new-password" value={newPassowrd} setValue={setNewPassowrd} /></div>
                    </div>
                    <div className="table-row">
                        <div className="label-cell">{t('MyAccount.password.confirmNewPassword')}</div>
                        <div className="input-cell"><MyTextPassword name="confirm-new-password" autoComplete="new-password" value={newPassowrd2} setValue={setNewPassowrd2}/></div>
                    </div>
                </div>
                <div className="action-center">
                    <button  onClick={updatePassword} className="btn-blue-rect">{t('MyAccount.common.saveChanges')}</button>
                </div>
            </div>
            <div className="pass-forgot-block">
                <p>{t('MyAccount.password.forgotPasswordText')}</p>
                <button className="btn-blue-oval" onClick={sendForgotPassword} disabled={isSendingReset}>
                    {isSendingReset ? t('MyAccount.common.sending') : t('MyAccount.common.send')}
                </button>
            </div>
        </div>
    </div>
  )
}

export default ChangePassword
