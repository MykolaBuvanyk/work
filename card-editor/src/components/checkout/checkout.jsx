import './checkout.sass'

import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'

import SimpleButton from '../ui/buttons/simple-button/simple-button'
import ActionButton from '../ui/buttons/action-button/action-button'
import FieldRow from '../ui/field-row/field-row'
import Radio from '../ui/radio/radio'
import { $authHost, $host } from '../../http'
import { useCanvasContext } from '../../contexts/CanvasContext'

import CloseIcon from '/images/icon/close.svg'

const DELIVERY_LABELS = [
	'UPS Envelope',
	'UPS Next Day Package',
	'UPS Express before 12 PM',
	'UPS Saturday Delivery',
]

const COUNTRY_OPTIONS = [
	{ name: 'Austria', code: 'AT' },
	{ name: 'Belgium', code: 'BE' },
	{ name: 'Croatia', code: 'HR' },
	{ name: 'Czech Republic', code: 'CZ' },
	{ name: 'Denmark', code: 'DK' },
	{ name: 'Estonia', code: 'EE' },
	{ name: 'France', code: 'FR' },
	{ name: 'Germany', code: 'DE' },
	{ name: 'Hungary', code: 'HU' },
	{ name: 'Ireland', code: 'IE' },
	{ name: 'Italy', code: 'IT' },
	{ name: 'Lithuania', code: 'LT' },
	{ name: 'Luxembourg', code: 'LU' },
	{ name: 'Netherlands', code: 'NL' },
	{ name: 'Poland', code: 'PL' },
	{ name: 'Romania', code: 'RO' },
	{ name: 'Slovakia', code: 'SK' },
	{ name: 'Slovenia', code: 'SI' },
	{ name: 'Spain', code: 'ES' },
	{ name: 'Sweden', code: 'SE' },
	{ name: 'Switzerland', code: 'CH' },
	{ name: 'Ukraine', code: 'UA' },
	{ name: 'United Kingdom', code: 'UK' },
]

const COUNTRY_BY_NAME = Object.fromEntries(
	COUNTRY_OPTIONS.map(item => [String(item.name).toLowerCase(), item])
)
const COUNTRY_BY_CODE = Object.fromEntries(
	COUNTRY_OPTIONS.map(item => [String(item.code).toUpperCase(), item])
)

const normalizeCountrySelection = rawCountry => {
	const value = String(rawCountry || '').trim()
	if (!value) return { country: '', region: '' }
	const normalizedCode = value.toUpperCase() === 'GB' ? 'UK' : value.toUpperCase()

	const byCode = COUNTRY_BY_CODE[normalizedCode]
	if (byCode) {
		return { country: byCode.name, region: byCode.code }
	}

	const byName = COUNTRY_BY_NAME[value.toLowerCase()]
	if (byName) {
		return { country: byName.name, region: byName.code }
	}

	return { country: value, region: '' }
}

const INITIAL_DELIVERY_ADDRESS = {
	fullName: '',
	companyName: '',
	address1: '',
	address2: '',
	address3: '',
	town: '',
	postalCode: '',
	country: '',
	region: '',
	email: '',
	mobile: '',
}

const COLOR_THEME_BY_INDEX = {
	0: 'White / Black',
	1: 'White / Blue',
	2: 'White / Red',
	3: 'Black / White',
	4: 'Blue / White',
	5: 'Red / White',
	6: 'Green / White',
	7: 'Yellow / Black',
	8: 'Gray / White',
	9: 'Orange / White',
	10: 'Brown / White',
	11: 'Silver / Black',
	12: 'Wood / Black',
	13: 'Carbon / White',
}

const resolveCanvasTypeLabel = design => {
	const idx = Number(design?.toolbarState?.selectedColorIndex)
	if (Number.isFinite(idx) && COLOR_THEME_BY_INDEX[idx]) {
		return COLOR_THEME_BY_INDEX[idx]
	}

	const raw =
		design?.ColorTheme ||
		design?.backgroundColor ||
		design?.toolbarState?.backgroundColor ||
		design?.toolbarState?.globalColors?.backgroundColor ||
		'Unknown'

	return String(raw)
		.replace(/[“”]/g, '')
		.trim()
		.toLowerCase()
		.split(' ')
		.filter(Boolean)
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ')
}

export default function Checkout({
	onClose,
	onPlaceOrder,
	onBackToAccessories,
	projectTitle = 'Water Sings 23',
	discountPercent = 0,
	discountAmount = 0,
	netAfterDiscount = 0,
	orderSubtotal = 0,
	accessoriesPrice = 0,
	selectedAccessories = [],
}) {
	const [delivery, setDelivery] = useState(DELIVERY_LABELS[0])
	const [deliveryAddress, setDeliveryAddress] = useState(INITIAL_DELIVERY_ADDRESS)
	const [deliveryConfig, setDeliveryConfig] = useState({ deliveryDE: [], deliveryOther: [] })
	const [vatConfig, setVatConfig] = useState({})
	const [isPhoneOk, setIsPhoneOk] = useState(false)
	const [isInvoiceDifferent, setIsInvoiceDifferent] = useState(false)
	const [invoiceEmail, setInvoiceEmail] = useState('')
	const [productionComment, setProductionComment] = useState('')
	const { designs } = useCanvasContext()
	const userType = useSelector(state => state?.user?.user?.type)
	const reduxUser = useSelector(state => state?.user?.user)
	const isBusiness = String(userType || '').toLowerCase() === 'business'

	useEffect(() => {
		let active = true

		const setFromProfile = user => {
			if (!active || !user) return
			const firstName = String(user.firstName || '').trim()
			const surname = String(user.surname || '').trim()
			const fullName = [firstName, surname].filter(Boolean).join(' ')

			setDeliveryAddress(prev => ({
				...prev,
				...normalizeCountrySelection(user.country),
				fullName,
				companyName: String(user.company || ''),
				address1: String(user.address || ''),
				address2: String(user.address2 || ''),
				address3: String(user.address3 || ''),
				town: String(user.city || ''),
				postalCode: String(user.postcode || ''),
				email: String(user.email || ''),
				mobile: String(user.phone || ''),
			}))
		}

		const loadProfile = async () => {
			try {
				const { data } = await $authHost.get('auth/getMy')
				setFromProfile(data?.user || {})
			} catch {
				setFromProfile(reduxUser || {})
			}
		}

		loadProfile()

		return () => {
			active = false
		}
	}, [reduxUser])

	useEffect(() => {
		try {
			const getter = typeof window !== 'undefined' ? window.getManufacturerNote : null
			if (typeof getter === 'function') {
				setProductionComment(String(getter() || ''))
			}
		} catch {
			// no-op
		}

		try {
			setProductionComment(String(window._manufacturerNote || ''))
		} catch {
			setProductionComment('')
		}

		const handleManufacturerNoteChanged = event => {
			const nextValue = String(event?.detail?.value || '')
			setProductionComment(nextValue)
		}

		window.addEventListener('manufacturerNote:changed', handleManufacturerNoteChanged)

		return () => {
			window.removeEventListener('manufacturerNote:changed', handleManufacturerNoteChanged)
		}
	}, [])

	useEffect(() => {
		let active = true

		const normalizeDeliveryArray = array => {
			const list = Array.isArray(array) ? array : []
			return DELIVERY_LABELS.map((label, index) => {
				const byIndex = list[index]
				const byName = list.find(item => String(item?.name || item?.text || '') === label)
				const source = byIndex || byName || {}
				const valueNum = Number(source?.value)
				return {
					label,
					price: Number.isFinite(valueNum) ? valueNum : 0,
				}
			})
		}

		const parseVatValue = raw => {
			const normalized = String(raw ?? '')
				.trim()
				.replace('%', '')
				.replace(',', '.')
			const value = Number(normalized)
			return Number.isFinite(value) ? value : 0
		}

		const buildVatConfig = data => {
			const result = {}
			Object.keys(data || {}).forEach(key => {
				if (!key || typeof key !== 'string') return
				if (/^[A-Z]{2}$/.test(key) || /^[A-Z]{2}_CONS$/.test(key)) {
					result[key] = parseVatValue(data[key])
				}
			})
			return result
		}

		const loadDeliveryConfig = async () => {
			try {
				const { data } = await $host.get('auth/getDate')
				if (!active) return
				setDeliveryConfig({
					deliveryDE: normalizeDeliveryArray(data?.deliveryDE),
					deliveryOther: normalizeDeliveryArray(data?.deliveryOther),
				})
				setVatConfig(buildVatConfig(data))
			} catch {
				if (!active) return
				setDeliveryConfig({
					deliveryDE: DELIVERY_LABELS.map(label => ({ label, price: 0 })),
					deliveryOther: DELIVERY_LABELS.map(label => ({ label, price: 0 })),
				})
				setVatConfig({})
			}
		}

		loadDeliveryConfig()

		return () => {
			active = false
		}
	}, [])

	const updateDeliveryField = (field, value) => {
		setDeliveryAddress(prev => {
			if (field === 'country') {
				const selected = COUNTRY_OPTIONS.find(item => item.name === value)
				return {
					...prev,
					country: value,
					region: selected?.code || '',
				}
			}
			return { ...prev, [field]: value }
		})
	}

	const handlePlaceOrder = e => {
		e?.preventDefault?.()
		if (typeof onPlaceOrder === 'function') {
			onPlaceOrder({
				sum: Number(sumForOrder || 0),
				totalSum: Number(totalAmount || 0),
				deliveryPrice: Number(deliveryPrice || 0),
				deliveryLabel: String(delivery || ''),
				vatPercent: Number(vatPercentForCheckout || 0),
				vatAmount: Number(vatAmountForCheckout || 0),
				deliveryAddress,
			})
		}
	}

	const handleProductionCommentChange = e => {
		const value = String(e?.target?.value || '')
		setProductionComment(value)

		try {
			const setter = typeof window !== 'undefined' ? window.setManufacturerNote : null
			if (typeof setter === 'function') {
				setter(value)
				return
			}
		} catch {
			// no-op
		}

		try {
			window._manufacturerNote = value
		} catch {
			// no-op
		}
	}

	const deliveryOptions = useMemo(() => {
		const code = String(deliveryAddress.region || '').toUpperCase()
		const source = code === 'DE' ? deliveryConfig.deliveryDE : deliveryConfig.deliveryOther
		const list = Array.isArray(source) && source.length > 0
			? source
			: DELIVERY_LABELS.map(label => ({ label, price: 0 }))
		return list
	}, [deliveryAddress.region, deliveryConfig])

	const deliveryPrice = useMemo(() => {
		return deliveryOptions.find(o => o.label === delivery)?.price ?? 0
	}, [delivery, deliveryOptions])

	useEffect(() => {
		if (!Array.isArray(deliveryOptions) || deliveryOptions.length === 0) return
		const exists = deliveryOptions.some(option => option.label === delivery)
		if (!exists) {
			setDelivery(deliveryOptions[0].label)
		}
	}, [delivery, deliveryOptions])

	const groupedCanvasTypes = useMemo(() => {
		const list = Array.isArray(designs) ? designs : []
		const map = new Map()

		for (const design of list) {
			const label = resolveCanvasTypeLabel(design)
			const rawQty = Number(design?.copiesCount ?? design?.toolbarState?.copiesCount ?? 1)
			const qty = Number.isFinite(rawQty) && rawQty > 0 ? Math.floor(rawQty) : 1
			map.set(label, (map.get(label) || 0) + qty)
		}

		return Array.from(map.entries()).map(([label, qty]) => ({ label, qty }))
	}, [designs])

	const totalSignsFromDesigns = useMemo(() => {
		if (!Array.isArray(designs) || designs.length === 0) return 0

		return designs.reduce((sum, design) => {
			const raw = design?.copiesCount ?? design?.toolbarState?.copiesCount ?? 1
			const n = Math.floor(Number(raw))
			const safe = Number.isFinite(n) && n > 0 ? n : 1
			return sum + safe
		}, 0)
	}, [designs])

	const totalSigns = useMemo(() => {
		try {
			if (typeof window.getToolbarFooterTotalSigns === 'function') {
				const value = Number(window.getToolbarFooterTotalSigns())
				if (Number.isFinite(value) && value >= 0) return value
			}
		} catch {
			// no-op
		}

		return totalSignsFromDesigns
	}, [totalSignsFromDesigns])

	const selectedAccessoriesNormalized = useMemo(() => {
		const list = Array.isArray(selectedAccessories) ? selectedAccessories : []
		return list
			.filter(item => item && item.checked)
			.map(item => {
				const qtyNum = Number(item?.qty)
				const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? Math.floor(qtyNum) : 0
				return {
					id: item?.id,
					name: String(item?.name || '—'),
					qty,
				}
			})
			.filter(item => item.qty > 0)
	}, [selectedAccessories])

	const accessoriesTypesCount = selectedAccessoriesNormalized.length
	const priceExclVat = Number(orderSubtotal || 0) - Number(discountAmount || 0)
	const sumForOrder = Number(priceExclVat || 0) + Number(accessoriesPrice || 0)
	const subtotalExclVat = Number(sumForOrder || 0) + Number(deliveryPrice || 0)

	const vatPercentForCheckout = useMemo(() => {
		const rawCode = String(deliveryAddress.region || '').toUpperCase()
		const code = rawCode === 'UK' ? 'GB' : rawCode
		const normalizedType = String(userType || '').toLowerCase()
		const isConsumer = normalizedType === 'consumer'
		const key = isConsumer ? `${code}_CONS` : code
		const value = Number(vatConfig?.[key])
		return Number.isFinite(value) ? value : 0
	}, [deliveryAddress.region, userType, vatConfig])

	const vatAmountForCheckout = Number(subtotalExclVat || 0) * (Number(vatPercentForCheckout || 0) / 100)
	const totalAmount = Number(subtotalExclVat || 0) + Number(vatAmountForCheckout || 0)

	return (
		<div className='checkout'>
			<div className='checkout__container'>
				<section className='checkout__sheet'>
					<header className='checkout__header'>
						<SimpleButton text={'Back to accessories'} onClick={onBackToAccessories || onClose} />

						<SimpleButton text={'Place order'} onClick={handlePlaceOrder} withIcon />

						<button className='checkout__close' onClick={onClose}>
							<img src={CloseIcon} alt='close' />
						</button>
					</header>

					<div className='checkout__content'>
						<form className='checkout-form' onSubmit={handlePlaceOrder}>
							<div className='checkout__layout'>
								<section
									className='checkout__left'
									aria-label='Delivery address'
								>
									<div className='checkout__title-row'>
										<h2 className='checkout__title'>
											Update or add a Delivery address
										</h2>

										<ActionButton text='Change' onClick={() => {}} />
									</div>

									<fieldset className='address-card'>
										<legend className='address-card__legend'>
											Delivery address
										</legend>

										<div className='field-row-wrap'>
											<FieldRow id='fullName' label='First name and surname'>
												<input
													id='fullName'
													name='fullName'
													type='text'
													value={deliveryAddress.fullName}
													onChange={e =>
														updateDeliveryField('fullName', e.target.value)
													}
												/>
											</FieldRow>

											{isBusiness && (
												<FieldRow id='companyName' label='Company Name'>
													<input
														id='companyName'
														name='companyName'
														type='text'
														value={deliveryAddress.companyName}
														onChange={e =>
															updateDeliveryField('companyName', e.target.value)
														}
													/>
												</FieldRow>
											)}

											<FieldRow id='address1' label='Address 1'>
												<input
													id='address1'
													name='address1'
													type='text'
													value={deliveryAddress.address1}
													onChange={e =>
														updateDeliveryField('address1', e.target.value)
													}
												/>
											</FieldRow>

											<FieldRow id='address2' label='Address 2'>
												<input
													id='address2'
													name='address2'
													type='text'
													value={deliveryAddress.address2}
													onChange={e =>
														updateDeliveryField('address2', e.target.value)
													}
												/>
											</FieldRow>

											<FieldRow id='address3' label='Address 3'>
												<input
													id='address3'
													name='address3'
													type='text'
													value={deliveryAddress.address3}
													onChange={e =>
														updateDeliveryField('address3', e.target.value)
													}
												/>
											</FieldRow>

											<FieldRow id='town' label='Town'>
												<input
													id='town'
													name='town'
													type='text'
													value={deliveryAddress.town}
													onChange={e =>
														updateDeliveryField('town', e.target.value)
													}
												/>
											</FieldRow>

											<FieldRow id='postalCode' label='Postal code'>
												<input
													id='postalCode'
													name='postalCode'
													type='text'
													value={deliveryAddress.postalCode}
													onChange={e =>
														updateDeliveryField('postalCode', e.target.value)
													}
												/>
											</FieldRow>

											<FieldRow id='country' label='Country'>
												<select
													className='select-country'
													id='country'
													name='country'
													value={deliveryAddress.country}
													onChange={e => updateDeliveryField('country', e.target.value)}
												>
													<option value=''></option>
													{COUNTRY_OPTIONS.map(country => (
														<option key={country.code} value={country.name}>
															{country.name}
														</option>
													))}
												</select>

												<select
													className='select-region'
													id='region'
													name='region'
													aria-label='Region'
													value={deliveryAddress.region}
													onChange={e => updateDeliveryField('region', e.target.value)}
													disabled
												>
													<option value=''></option>
													{COUNTRY_OPTIONS.map(country => (
														<option key={`${country.code}-region`} value={country.code}>
															{country.code}
														</option>
													))}
												</select>
											</FieldRow>

											<FieldRow id='email' label='E-Mail address'>
												<input
													id='email'
													name='email'
													type='email'
													value={deliveryAddress.email}
													onChange={e => updateDeliveryField('email', e.target.value)}
												/>
											</FieldRow>

											<FieldRow id='mobile' label='Mobile Phone'>
												<input
													id='mobile'
													name='mobile'
													type='tel'
													value={deliveryAddress.mobile}
													onChange={e => updateDeliveryField('mobile', e.target.value)}
												/>
											</FieldRow>
										</div>
									</fieldset>

									<div className='address-extra'>
										<div className='address-extra__row'>
											<label className='address-extra__note'>
												This phone number may be used for any questions
											</label>

											<Radio
												name='phoneOk'
												inputType='checkbox'
												value='yes'
												checked={isPhoneOk}
												onChange={e => setIsPhoneOk(e.target.checked)}
												label='YES'
											/>
										</div>

										<div className='address-extra__row address-extra__row--invoice'>
											<label
												htmlFor='invoiceEmail'
												className='address-extra__invoice-text'
											>
												This email will be used to send you the invoice
											</label>

											<input
												className='address-extra__invoice-input'
												type='email'
												name='invoiceEmail'
												id='invoiceEmail'
												value={invoiceEmail}
												onChange={e => setInvoiceEmail(e.target.value)}
												disabled={!isInvoiceDifferent}
											/>
										</div>

										<Radio
											name='invoiceDifferent'
											inputType='checkbox'
											value='yes'
											checked={isInvoiceDifferent}
											onChange={e => setIsInvoiceDifferent(e.target.checked)}
											label='Invoice address (if different from above)'
											strong
										/>
									</div>
								</section>

								<aside className='checkout__right' aria-label='Order summary'>
									<h3 className='summary-title'>
										My Order:{' '}
										<span className='summary-title__muted'>{projectTitle}</span>
									</h3>

									<div className='summary-stack'>
										<div className='summary-row'>
											<table
												className='summary-table summary-table--order'
												aria-label='My order'
											>
												<thead>
													<tr>
														<th>Description:</th>
														<th>Quantity:</th>
													</tr>
												</thead>

												<tbody>
													{groupedCanvasTypes.length > 0 ? (
														groupedCanvasTypes.map(item => (
															<tr key={item.label}>
																<td>{item.label}</td>
																<td>{item.qty}</td>
															</tr>
														))
													) : (
														<tr>
															<td>—</td>
															<td>0</td>
														</tr>
													)}
													<tr>
														<td className='summary-table__blank'></td>
														<td>Total Signs: {totalSigns}</td>
													</tr>
													<tr>
														<td className='summary-table__blank'></td>
														<td>
															Discount ({Number(discountPercent || 0).toFixed(0)}%): {Number(discountAmount || 0).toFixed(2)} €
														</td>
													</tr>
													<tr>
														<td className='summary-table__blank'></td>
														<td>Price (excl. VAT): {Number(priceExclVat || 0).toFixed(2)} €</td>
													</tr>
												</tbody>
											</table>
										</div>

										<div className='summary-subtitle'>
											Accessories: {accessoriesTypesCount} Types:
										</div>

										<div className='summary-row'>
											<table className='summary-table' aria-label='Accessories'>
												<tbody>
													{selectedAccessoriesNormalized.length > 0 ? (
														selectedAccessoriesNormalized.map(item => (
															<tr key={item.id ?? item.name}>
																<td>{item.name}</td>
																<td>{item.qty}</td>
															</tr>
														))
													) : (
														<tr>
															<td>—</td>
															<td>0</td>
														</tr>
													)}
													<tr>
														<td className='summary-table__blank'></td>
														<td>Price (excl. VAT): {Number(accessoriesPrice || 0).toFixed(2)} €</td>
													</tr>
												</tbody>
											</table>
										</div>

										<table
											className='summary-table summary-table__delivery'
											aria-label='Delivery'
										>
											<tbody>
												<tr>
													<td>Delivery</td>
													<td>
														<select
															className='summary-select'
															name='delivery'
															value={delivery}
															onChange={e => setDelivery(e.target.value)}
														>
															{deliveryOptions.map(opt => (
																<option key={opt.label} value={opt.label}>
																	{opt.label}
																</option>
															))}
														</select>
													</td>
												</tr>
												<tr>
													<td className='summary-table__blank'></td>
													<td>
														Del. Price (excl. VAT): {deliveryPrice.toFixed(2)} €
													</td>
												</tr>
											</tbody>
										</table>

										<div className='delivery-comment'>
											<label
												className='delivery-comment__label'
												htmlFor='deliveryComment'
											>
												Delivery comment
											</label>

											<input
												id='deliveryComment'
												name='deliveryComment'
												type='text'
												className='delivery-comment__input'
											/>

											<div className='delivery-comment__hint'>
												Delivery from Monday to Friday.
											</div>
										</div>

										<table className='summary-table' aria-label='VAT and total'>
											<tbody>
												<tr>
													<td>VAT {Number(vatPercentForCheckout || 0).toFixed(0)}%</td>
													<td>{Number(vatAmountForCheckout || 0).toFixed(2)} €</td>
												</tr>
												<tr>
													<td>
														<strong>Total amount</strong>
													</td>
													<td>{Number(totalAmount || 0).toFixed(2)} €</td>
												</tr>
											</tbody>
										</table>

										<div className='production-comment'>
											<label
												className='production-comment__label'
												htmlFor='productionComment'
											>
												Leave a comment for production here:
											</label>

											<textarea
												id='productionComment'
												name='productionComment'
												className='production-comment__textarea'
												value={productionComment}
												onChange={handleProductionCommentChange}
											/>
										</div>

										<div className='summary-notes' aria-label='Shipping notes'>
											<p>
												Orders placed before 3:00 PM are usually shipped the
												same day.
											</p>
											<p>
												For next-day delivery, please select UPS Next Day
												Package.
											</p>
											<p>All prices are in Euros.</p>
										</div>

										<div className='summary-actions'>
											<SimpleButton text='Place order' onClick={handlePlaceOrder} withIcon />
										</div>
									</div>
								</aside>
							</div>
						</form>
					</div>
				</section>
			</div>
		</div>
	)
}
