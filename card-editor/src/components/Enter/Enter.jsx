import React from 'react'
import LoginForm from '../LoginForm/LoginForm'
import './Enter.scss'
import { useLocation } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'

const Enter = () => {
    const { t } = useTranslation()
    const location=useLocation();
    const customerNumber = location.pathname.split('/').pop().padStart(3,'0')
  return (
    <div className='enter-container'>
        <h1>{t("Enter.e_1")}</h1>
        <p>
          <Trans
            i18nKey="Enter.e_2"
            values={{ customerNumber }}
            components={{ strong: <b /> }}
          />
        </p>
        <p>{t("Enter.e_3")}</p>
        <p>
          <Trans
            i18nKey="Enter.e_4"
            components={{ strong: <b /> }}
          />
        </p>
        <p>{t("Enter.e_7")}</p>
        <p>{t("Enter.e_8")}</p>
        <p>{t("Enter.e_9")}</p>
        <br/>
        <br/>
        <LoginForm/>
    </div>
  )
}

export default Enter
