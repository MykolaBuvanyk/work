import './simple-button.sass'

import BuyIcon from '/images/icon/buy.svg'

export default function SimpleButton({ text, withIcon = false, onClick, className = '', disabled = false }) {
	return (
		<button
			className={`simple-btn ${withIcon ? 'btn--icon' : ''} ${className}`.trim()}
			onClick={disabled ? undefined : onClick}
			disabled={disabled}
		>
			{withIcon && <img src={BuyIcon} alt='' />}
			{text}
		</button>
	)
}
