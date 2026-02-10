import React, { useState } from 'react'
import MyTextPassword from '../MyInput/MyTextPassword';
import { $authHost } from '../../http';

const ChangePassword = () => {
    const [oldPassowrd,setOldPassword]=useState('');
    const [newPassowrd,setNewPassowrd]=useState('');
    const [newPassowrd2,setNewPassowrd2]=useState('')
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
  return (
    <div className="password-section">
        <h3>Change Password</h3>
        <div className="password-flex-row">
            <div style={{display:'flex',flexDirection:'column',justifyContent:'right',alignItems:'flex-end'}}>
                <div className="registration-table pass-table">
                    <div className="table-row">
                        <div className="label-cell">Existing Password</div>
                        <div className="input-cell"><MyTextPassword value={oldPassowrd} setValue={setOldPassword} /></div>
                    </div>
                    <div className="table-row">
                        <div className="label-cell">New Password</div>
                        <div className="input-cell"><MyTextPassword value={newPassowrd} setValue={setNewPassowrd} /></div>
                    </div>
                    <div className="table-row">
                        <div className="label-cell">Confirm New Password</div>
                        <div className="input-cell"><MyTextPassword value={newPassowrd2} setValue={setNewPassowrd2}/></div>
                    </div>
                </div>
                <div className="action-center">
                    <button  onClick={updatePassword} className="btn-blue-rect">Save Changes</button>
                </div>
            </div>
            <div className="pass-forgot-block">
                <p>* Forgot Password? Click here and we'll email your current Password to you.</p>
                <button className="btn-blue-oval">Send</button>
            </div>
        </div>
    </div>
  )
}

export default ChangePassword