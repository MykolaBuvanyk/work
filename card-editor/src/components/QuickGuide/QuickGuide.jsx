import React from 'react'
import './QuickGuide.scss'
import { Link } from 'react-router-dom'

const QuickGuide = () => {
  return (
    <div className='quick-guide-container'>
        <h1>We provide</h1>
        <ul>
            <li>
                <div className="svg">
                    <svg width="31" height="23" viewBox="0 0 31 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.79861 9.49495L10.7986 18.8175L28.7986 1.81754" stroke="#0BC944" stroke-width="5"/>
                    </svg>
                </div>
                <div className="a">Easy</div>
                <p>Design by</p>
                <span>your Self</span>
            </li>
            <li>
                <div className="svg">
                    <svg width="31" height="23" viewBox="0 0 31 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.79861 9.49495L10.7986 18.8175L28.7986 1.81754" stroke="#0BC944" stroke-width="5"/>
                    </svg>
                </div>
                <div className="a">Fast</div>
                <p>Manufacturing</p>
                <span>Within 8h</span>
            </li>
            <li>
                <div className="svg">
                    <svg width="31" height="23" viewBox="0 0 31 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1.79861 9.49495L10.7986 18.8175L28.7986 1.81754" stroke="#0BC944" stroke-width="5"/>
                    </svg>
                </div>
                <div className="a">Quick</div>
                <p>Delivery</p>
                <span>Yours in 24–48h</span>
            </li>
        </ul>
        <div className="how-start">
            <h2>How to start</h2>
            <img src='/images/quick.avif'/>
        </div>
        <h2>How to use the editor</h2>
        <div className="instruction">
            <img src='/images/quick2.avif'/>
        </div>
        <div className="butons-url">
            <Link to='/'>New Project</Link>
            <Link to='/templates'>Templates</Link>
            <Link to='/contacts'>Contact us</Link>
        </div>

    </div>
  )
}

export default QuickGuide