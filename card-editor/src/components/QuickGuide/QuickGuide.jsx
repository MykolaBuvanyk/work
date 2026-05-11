import React from 'react'
import './QuickGuide.scss'
import { useTranslation } from 'react-i18next';
import Link from '../Localized/LocalizedLink';

const QuickGuide = () => {
    const {t}=useTranslation()
  return (
    <div className='quick-guide-container'>
        <h1>{t("QuickGuide.d_1")}</h1>
        <ul>
            <li>
                <div className="svg">
                    <svg width="31" height="23" viewBox="0 0 31 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.79861 9.49495L10.7986 18.8175L28.7986 1.81754" stroke="#0BC944" stroke-width="5"/>
                    </svg>
                </div>
                <div className="a">{t("QuickGuide.d_2")}</div>
                <p>{t("QuickGuide.d_3")}</p>
                <span>{t("QuickGuide.d_4")}</span>
            </li>
            <li>
                <div className="svg">
                    <svg width="31" height="23" viewBox="0 0 31 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.79861 9.49495L10.7986 18.8175L28.7986 1.81754" stroke="#0BC944" stroke-width="5"/>
                    </svg>
                </div>
                <div className="a">{t("QuickGuide.d_5")}</div>
                <p>{t("QuickGuide.d_6")}</p>
                <span>{t("QuickGuide.d_7")}</span>
            </li>
            <li>
                <div className="svg">
                    <svg width="31" height="23" viewBox="0 0 31 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.79861 9.49495L10.7986 18.8175L28.7986 1.81754" stroke="#0BC944" stroke-width="5"/>
                    </svg>
                </div>
                <div className="a">{t("QuickGuide.d_8")}</div>
                <p>{t("QuickGuide.d_9")}</p>
                <span>{t("QuickGuide.d_10")}</span>
            </li>
        </ul>
        <div className="how-start">
            <img src='/images/quick1.png'/>
        </div>
        <h2>{t("QuickGuide.d_11")}</h2>
        <div className="instruction">
            <img src='/images/quick3.png'/>
        </div>
        <div className="butons-url">
            <Link to='/online-sign-editor'>{t("QuickGuide.d_12")}</Link>
            <Link to='/contacts'>{t("QuickGuide.d_13")}</Link>
        </div>

    </div>
  )
}

export default QuickGuide