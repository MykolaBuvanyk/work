import React from 'react'
import './AccountHeader.scss'
import Link from '../Localized/LocalizedLink'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

const LANGUAGE_PREFIXES = new Set(['de', 'en', 'fr', 'ua'])

const getAccountPath = pathname => {
    const parts = String(pathname || '').split('/').filter(Boolean)
    const pathParts = LANGUAGE_PREFIXES.has(parts[0]) ? parts.slice(1) : parts
    return `/${pathParts.join('/')}`.replace(/\/$/, '') || '/'
}

const AccountHeader = () => {
    const { t } = useTranslation()
    const location = useLocation()
    const currentPath = getAccountPath(location.pathname)
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
                      className={x.url === currentPath || (x.url === '/account' && currentPath.startsWith('/account/pay/')) ? 'active' : ''}
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
