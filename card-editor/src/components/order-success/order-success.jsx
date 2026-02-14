import './order-success.sass'

import { useState } from 'react'

import ActionButton from '../ui/buttons/action-button/action-button'
import CloseIcon from '/images/icon/close.svg'
import Head from '/images/icon/head.svg'
import Star from '/images/icon/star.svg'
import StarBg from '/images/icon/star-bg.svg'

export default function ThankYou({ onClose }) {
	const [rating, setRating] = useState(0)
	return (
		<div className='success-modal'>
			<div className='container'>
				{/* <header className='success__head'>
					<img src={Head} alt='' />
				</header> */}
				<section className='success'>
					<button className='success__close' onClick={onClose}>
						<img src={CloseIcon} alt='close' />
					</button>
					<h1 className='success__title'>Thank you for your order!</h1>

					<div className='success__text'>
						<p>
							We’re processing it now. As soon as your order is registered,
							you’ll receive an order confirmation by email.
						</p>
						<p>
							You can then check the status of your order anytime in your
							account.
						</p>
					</div>

					<div className='success__rating'>
						<p className='success__rating-title'>
							How was your experience with SignXpert?
						</p>

						<div className='success__stars'>
							{[1, 2, 3, 4, 5].map(value => (
								<img
									key={value}
									src={value <= rating ? StarBg : Star}
									alt=''
									className='success__star'
									onClick={() => setRating(value)}
								/>
							))}
						</div>
					</div>

					<div className='success__feedback'>
						<label className='success__label' htmlFor='feedback'>
							Please leave us a comment — we’d love to hear from you!
						</label>

						<textarea className='success__textarea' id='feedback' />
					</div>

					<ActionButton text='send' onClick={() => {}} />

					<footer className='success__footer'>
						<span>Kind regards,</span>
						<span>SignXpert</span>
					</footer>
				</section>
			</div>
		</div>
	)
}
