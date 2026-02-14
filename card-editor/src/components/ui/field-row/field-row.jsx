import './field-row.sass'

export default function FieldRow({ id, label, children, required = false }) {
	return (
		<div className='field-row'>
			<label className='field-row__label' htmlFor={id}>
				{label}
				{required && <span aria-hidden='true'> *</span>}
			</label>

			<div className='field-row__control'>{children}</div>
		</div>
	)
}
