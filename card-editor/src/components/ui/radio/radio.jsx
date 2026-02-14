import './radio.sass'

export default function Radio({
	name,
	value,
	checked,
	defaultChecked,
	onChange,
	label,
	strong,
	inputType = 'radio',
}) {
	return (
		<label className={`radio ${strong ? 'radio-strong' : ''}`}>
			<input
				className='radio__input'
				type={inputType}
				name={name}
				value={value}
				checked={checked}
				defaultChecked={defaultChecked}
				onChange={onChange}
			/>
			<span className='radio__ui' aria-hidden='true' />
			{label ? <span className='radio__label'>{label}</span> : null}
		</label>
	)
}
