import './action-button.sass'

import { useState } from 'react'

export default function ActionButton({ text, onClick }) {
	const [disabled, setDisabled] = useState(false)

	const handleClick = e => {
		if (disabled) return

		onClick?.(e)
		setDisabled(true)
	}

	return (
		<button className='action-btn' disabled={disabled} onClick={handleClick}>
			{text}
		</button>
	)
}
