import './order-success.sass'

import { useEffect, useState } from 'react'

import ActionButton from '../ui/buttons/action-button/action-button'
import CloseIcon from '/images/icon/close.svg'
import Head from '/images/icon/head.svg'
import Star from '/images/icon/star.svg'

const SelectedStar = ({ className = '', onClick, gradientId }) => (
	<svg
		className={className}
		width='22'
		height='22'
		viewBox='0 0 22 22'
		fill='none'
		xmlns='http://www.w3.org/2000/svg'
	>
		<defs>
			<linearGradient id={gradientId} x1='10.75' y1='0.75' x2='10.75' y2='20.75' gradientUnits='userSpaceOnUse'>
				<stop offset='0' stopColor='#FFFDF0' />
				<stop offset='0.34' stopColor='#FFE878' />
				<stop offset='0.68' stopColor='#FFC326' />
				<stop offset='1' stopColor='#F09A00' />
			</linearGradient>
			<radialGradient
				id={`${gradientId}-shine`}
				cx='0'
				cy='0'
				r='1'
				gradientUnits='userSpaceOnUse'
				gradientTransform='translate(8.4 6.2) rotate(48) scale(9.5 6.8)'
			>
				<stop stopColor='#FFFFFF' stopOpacity='0.92' />
				<stop offset='1' stopColor='#FFFFFF' stopOpacity='0' />
			</radialGradient>
		</defs>
		<path
			d='M10.75 0.75L13.8375 7.33172L20.75 8.38435L15.7447 13.5145L16.9249 20.75L10.75 17.4924L4.57508 20.75L5.75527 13.5145L0.75 8.38435L7.66254 7.33172L10.75 0.75Z'
			fill={`url(#${gradientId})`}
		/>
		<path
			d='M10.75 0.75L13.8375 7.33172L20.75 8.38435L15.7447 13.5145L16.9249 20.75L10.75 17.4924L4.57508 20.75L5.75527 13.5145L0.75 8.38435L7.66254 7.33172L10.75 0.75Z'
			fill={`url(#${gradientId}-shine)`}
		/>
		<path
			d='M10.75 0.75L13.8375 7.33172L20.75 8.38435L15.7447 13.5145L16.9249 20.75L10.75 17.4924L4.57508 20.75L5.75527 13.5145L0.75 8.38435L7.66254 7.33172L10.75 0.75Z'
			stroke='#000000'
			strokeWidth='0.7'
			strokeLinejoin='round'
			fill='none'
		/>
	</svg>
)

export default function ThankYou({ onClose, setData }) {
	const [rating, setRating] = useState(0)
	const [comment,setComment]=useState('')
	useEffect(()=>{
		setData({rating,comment});
	},[rating, comment]);
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
								<button
									type='button'
									key={value}
									className='success__star-btn'
									onClick={() => setRating(value)}
									aria-label={`Rate ${value} out of 5`}
								>
									{value <= rating ? (
										<SelectedStar
											className='success__star'
											gradientId={`success-star-gradient-${value}`}
										/>
									) : (
										<img
											src={Star}
											alt=''
											className='success__star'
										/>
									)}
								</button>
							))}
						</div>
					</div>

					<div className='success__feedback'>
						<label className='success__label' htmlFor='feedback'>
							Please leave us a comment — we’d love to hear from you!
						</label>

						<textarea value={comment} onChange={(e)=>setComment(e.target.value)} className='success__textarea' id='feedback' />
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
