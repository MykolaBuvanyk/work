import React from 'react'
import './AccountHeader.scss'
import { Link } from 'react-router-dom'

const AccountHeader = () => {
    const urls=[
        {
            name:'My Orders',
            url:'/account'
        },
        {
            name:'My Details',
            url:'/account/detail'
        },
        {
            name:'My Settings',
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
                        {x.name}
                    </Link>
                </li>
                )
            )}
        </ul>
    </div>
  )
}

export default AccountHeader