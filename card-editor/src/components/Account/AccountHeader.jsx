import React from 'react'
import './AccountHeader.scss'
import Link from '../Localized/LocalizedLink'
import { useTranslation } from 'react-i18next'

const AccountHeader = () => {
    const { t } = useTranslation()
    const urls=[
        {
            name:'MyAccount.header.orders',
            url:'/account'
        },
        {
            name:'MyAccount.header.details',
            url:'/account/detail'
        },
        {
            name:'MyAccount.header.settings',
            url:'/account/setting'
        },
    ]
  return (
    <div className='account-header'>
        <ul>
            {urls.map(x=>(
                <li key={x.url}>
                    <Link
                      className={x.url==location.pathname?'active':""}
                      to={x.url}
                    >
                        {t(x.name)}
                    </Link>
                </li>
                )
            )}
        </ul>
    </div>
  )
}

export default AccountHeader
