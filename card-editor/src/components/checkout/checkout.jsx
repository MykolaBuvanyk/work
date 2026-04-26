import './checkout.sass'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'

import SimpleButton from '../ui/buttons/simple-button/simple-button'
import ActionButton from '../ui/buttons/action-button/action-button'
import FieldRow from '../ui/field-row/field-row'
import Radio from '../ui/radio/radio'
import { $authHost, $host } from '../../http'
import { useCanvasContext } from '../../contexts/CanvasContext'

import CloseIcon from '/images/icon/close.svg'

const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100

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

const hasInvoiceProfileData = user => {
	if (!user || typeof user !== 'object') return false

	const invoiceKeys = [
		'firstName2',
		'company2',
		'address4',
		'address5',
		'address6',
		'city2',
		'postcode2',
		'eMailInvoice',
		'phone2',
	]

	return invoiceKeys.some(key => String(user[key] || '').trim() !== '')
}

const hasInvoiceAddressContent = invoice => {
	if (!invoice || typeof invoice !== 'object') return false
	const meaningfulKeys = [
		'fullName',
		'companyName',
		'address1',
		'address2',
		'address3',
		'town',
		'postalCode',
		'email',
		'mobile',
	]
	return meaningfulKeys.some(key => String(invoice[key] || '').trim() !== '')
}

const hasBusinessProfileHint = user => {
	if (!user || typeof user !== 'object') return false
	const company = String(user.company || '').trim()
	const vatNumber = String(user.vatNumber || '').trim()
	return company.length > 0 || vatNumber.length > 0
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

const INITIAL_INVOICE_ADDRESS = {
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

const CHECKOUT_COUNTRY_STORAGE_KEY = 'checkout:selected-country'
const CHECKOUT_EMAILS_DRAFT_STORAGE_KEY = 'checkout:emails-draft'

const readStoredCountrySelection = () => {
	try {
		const raw = localStorage.getItem(CHECKOUT_COUNTRY_STORAGE_KEY)
		if (!raw) return { country: '', region: '' }
		const parsed = JSON.parse(raw)
		if (!parsed || typeof parsed !== 'object') return { country: '', region: '' }
		const normalized = normalizeCountrySelection(parsed.country || parsed.region)
		return {
			country: normalized.country,
			region: normalized.region,
		}
	} catch {
		return { country: '', region: '' }
	}
}

const readCheckoutEmailsDraft = () => {
	try {
		const raw = localStorage.getItem(CHECKOUT_EMAILS_DRAFT_STORAGE_KEY)
		if (!raw) return { invoiceEmail: '', invoiceAddressEmail: '', isInvoiceDifferent: false }
		const parsed = JSON.parse(raw)
		if (!parsed || typeof parsed !== 'object') {
			return { invoiceEmail: '', invoiceAddressEmail: '', isInvoiceDifferent: false }
		}
		return {
			invoiceEmail: String(parsed.invoiceEmail || ''),
			invoiceAddressEmail: String(parsed.invoiceAddressEmail || ''),
			isInvoiceDifferent: Boolean(parsed.isInvoiceDifferent),
		}
	} catch {
		return { invoiceEmail: '', invoiceAddressEmail: '', isInvoiceDifferent: false }
	}
}

const persistCheckoutEmailsDraft = ({ invoiceEmail, invoiceAddressEmail, isInvoiceDifferent }) => {
	try {
		localStorage.setItem(
			CHECKOUT_EMAILS_DRAFT_STORAGE_KEY,
			JSON.stringify({
				invoiceEmail: String(invoiceEmail || ''),
				invoiceAddressEmail: String(invoiceAddressEmail || ''),
				isInvoiceDifferent: Boolean(isInvoiceDifferent),
			})
		)
	} catch {
		// no-op
	}
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
	8: 'Silver / Black',
	9: 'Brown / White',
	10: 'Orange / White',
	11: 'Gray / White',
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
	const emailDraft = readCheckoutEmailsDraft()
	const [delivery, setDelivery] = useState(DELIVERY_LABELS[0])
	const [deliveryAddress, setDeliveryAddress] = useState(() => ({
		...INITIAL_DELIVERY_ADDRESS,
		...readStoredCountrySelection(),
	}))
	const [invoiceAddress, setInvoiceAddress] = useState(() => ({
		...INITIAL_INVOICE_ADDRESS,
		email: emailDraft.invoiceAddressEmail || '',
	}))
	const [deliveryConfig, setDeliveryConfig] = useState({ deliveryDE: [], deliveryOther: [] })
	const [vatConfig, setVatConfig] = useState({})
	const [isPhoneOk, setIsPhoneOk] = useState(false)
	const [isInvoiceDifferent, setIsInvoiceDifferent] = useState(Boolean(emailDraft.isInvoiceDifferent))
	const [invoiceEmail, setInvoiceEmail] = useState(String(emailDraft.invoiceEmail || ''))
	const [deliveryComment, setDeliveryComment] = useState('')
	const [productionComment, setProductionComment] = useState('')
	const [isPlacingOrder, setIsPlacingOrder] = useState(false)
	const [profileUserType, setProfileUserType] = useState('')
	const [profileBusinessHint, setProfileBusinessHint] = useState(false)
	const touchedDeliveryFieldsRef = useRef({})
	const touchedInvoiceFieldsRef = useRef({})
	const touchedInvoiceEmailRef = useRef(false)
	const { designs } = useCanvasContext()
	const userType = useSelector(state => state?.user?.user?.type)
	const reduxUser = useSelector(state => state?.user?.user)
	const normalizedUserType = useMemo(() => {
		const rawType = profileUserType || userType || reduxUser?.type || ''
		return String(rawType).trim().toLowerCase()
	}, [profileUserType, reduxUser?.type, userType])
	const isBusiness =
		normalizedUserType === 'business' || normalizedUserType === 'admin' ||
		profileBusinessHint ||
		String(reduxUser?.company || '').trim().length > 0

	useEffect(() => {
		let active = true

		const keepIfTouched = (touchedRef, field, current, fallback) =>
			touchedRef.current?.[field] ? String(current || '') : String(fallback || '')

		const setFromProfile = user => {
			if (!active || !user) return
			setProfileUserType(String(user.type || '').trim())
			setProfileBusinessHint(hasBusinessProfileHint(user))
			const profileDeliveryEmail = String(user.email || '')
			const profileInvoiceAddressEmail = String(user.eMailInvoice || '')
			const profileInvoiceEmails = String(user.weWill || '')
			const firstName = String(user.firstName || '').trim()
			const surname = String(user.surname || '').trim()
			const fullName = [firstName, surname].filter(Boolean).join(' ')
			const profileCountry = normalizeCountrySelection(user.country)
			const invoiceCountry = normalizeCountrySelection(user.country2)
			const hasProfileCountry = String(profileCountry.country || profileCountry.region || '').trim().length > 0
			const hasInvoiceCountry = String(invoiceCountry.country || invoiceCountry.region || '').trim().length > 0
			const preferredInvoiceCountry = hasInvoiceCountry ? invoiceCountry : profileCountry

			setDeliveryAddress(prev => ({
				...prev,
				...(hasProfileCountry && !touchedDeliveryFieldsRef.current.country && !touchedDeliveryFieldsRef.current.region
					? profileCountry
					: {}),
				fullName: keepIfTouched(touchedDeliveryFieldsRef, 'fullName', prev.fullName, fullName),
				companyName: keepIfTouched(touchedDeliveryFieldsRef, 'companyName', prev.companyName, user.company),
				address1: keepIfTouched(touchedDeliveryFieldsRef, 'address1', prev.address1, user.address),
				address2: keepIfTouched(touchedDeliveryFieldsRef, 'address2', prev.address2, user.address2),
				address3: keepIfTouched(touchedDeliveryFieldsRef, 'address3', prev.address3, user.address3),
				town: keepIfTouched(touchedDeliveryFieldsRef, 'town', prev.town, user.city),
				postalCode: keepIfTouched(touchedDeliveryFieldsRef, 'postalCode', prev.postalCode, user.postcode),
				email: keepIfTouched(touchedDeliveryFieldsRef, 'email', prev.email, profileDeliveryEmail),
				mobile: keepIfTouched(touchedDeliveryFieldsRef, 'mobile', prev.mobile, user.phone),
			}))

			setInvoiceAddress(prev => ({
				...prev,
				...(String(preferredInvoiceCountry.country || preferredInvoiceCountry.region || '').trim() &&
					!touchedInvoiceFieldsRef.current.country && !touchedInvoiceFieldsRef.current.region
					? preferredInvoiceCountry
					: {}),
				fullName: keepIfTouched(touchedInvoiceFieldsRef, 'fullName', prev.fullName, user.firstName2),
				companyName: keepIfTouched(touchedInvoiceFieldsRef, 'companyName', prev.companyName, user.company2),
				address1: keepIfTouched(touchedInvoiceFieldsRef, 'address1', prev.address1, user.address4),
				address2: keepIfTouched(touchedInvoiceFieldsRef, 'address2', prev.address2, user.address5),
				address3: keepIfTouched(touchedInvoiceFieldsRef, 'address3', prev.address3, user.address6),
				town: keepIfTouched(touchedInvoiceFieldsRef, 'town', prev.town, user.city2),
				postalCode: keepIfTouched(touchedInvoiceFieldsRef, 'postalCode', prev.postalCode, user.postcode2),
				email: keepIfTouched(touchedInvoiceFieldsRef, 'email', prev.email, profileInvoiceAddressEmail),
				mobile: keepIfTouched(touchedInvoiceFieldsRef, 'mobile', prev.mobile, user.phone2),
			}))

			if (!touchedInvoiceEmailRef.current) {
				setInvoiceEmail(profileInvoiceEmails)
			}
			setIsInvoiceDifferent(prev => prev || hasInvoiceProfileData(user))
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
		persistCheckoutEmailsDraft({
			invoiceEmail,
			invoiceAddressEmail: invoiceAddress?.email,
			isInvoiceDifferent,
		})
	}, [invoiceEmail, invoiceAddress?.email, isInvoiceDifferent])

	useEffect(() => {
		try {
			const country = String(deliveryAddress?.country || '').trim()
			const region = String(deliveryAddress?.region || '').trim().toUpperCase()
			if (!country && !region) {
				localStorage.removeItem(CHECKOUT_COUNTRY_STORAGE_KEY)
				return
			}

			const normalized = normalizeCountrySelection(country || region)
			localStorage.setItem(
				CHECKOUT_COUNTRY_STORAGE_KEY,
				JSON.stringify({
					country: normalized.country,
					region: normalized.region,
				})
			)
		} catch {
			// no-op
		}
	}, [deliveryAddress?.country, deliveryAddress?.region])

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
		touchedDeliveryFieldsRef.current = {
			...touchedDeliveryFieldsRef.current,
			[field]: true,
			...(field === 'country' ? { region: true } : {}),
		}
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

	const updateInvoiceField = (field, value) => {
		touchedInvoiceFieldsRef.current = {
			...touchedInvoiceFieldsRef.current,
			[field]: true,
			...(field === 'country' ? { region: true } : {}),
		}
		setInvoiceAddress(prev => {
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

	const handlePlaceOrder = async e => {
		e?.preventDefault?.()
		if (isPlacingOrder) return
		if (!String(deliveryAddress?.country || '').trim()) {
			alert('Please select a country')
			return
		}
		const shouldIncludeInvoiceAddress =
			isInvoiceDifferent && hasInvoiceAddressContent(invoiceAddress)
		if (typeof onPlaceOrder === 'function') {
			setIsPlacingOrder(true)
			try {
				await Promise.resolve(onPlaceOrder({
					sum: Number(sumForOrder || 0),
					totalSum: Number(totalAmount || 0),
					deliveryPrice: Number(deliveryPrice || 0),
					deliveryLabel: String(delivery || ''),
					isInvoiceDifferent: Boolean(shouldIncludeInvoiceAddress),
					phoneOk: Boolean(isPhoneOk),
					vatPercent: Number(vatPercentForCheckout || 0),
					vatAmount: Number(vatAmountForCheckout || 0),
					vatNumber: String(reduxUser?.vatNumber || '').trim(),
					deliveryAddress,
					invoiceAddress: shouldIncludeInvoiceAddress ? invoiceAddress : null,
					invoiceEmail: String(invoiceEmail || ''),
					invoiceAddressEmail: String(invoiceAddress?.email || '').trim(),
					deliveryComment: String(deliveryComment || '').trim(),
				}))
			} finally {
				setIsPlacingOrder(false)
			}
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

	const handleInvoiceEmailChange = e => {
		touchedInvoiceEmailRef.current = true
		setInvoiceEmail(e.target.value)
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

	const deliveryHintText =
		delivery === 'UPS Saturday Delivery'
			? 'Available on Fridays only.'
			: 'Delivery from Monday to Friday.'

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
	const priceExclVat = round2(Number(orderSubtotal || 0) - Number(discountAmount || 0))
	const sumForOrder = round2(priceExclVat + Number(accessoriesPrice || 0))
	const subtotalExclVat = round2(sumForOrder + Number(deliveryPrice || 0))

	const vatPercentForCheckout = useMemo(() => {
		const rawCode = String(deliveryAddress.region || '').toUpperCase()
		const code = rawCode === 'UK' ? 'GB' : rawCode
		const isConsumer = normalizedUserType === 'consumer'
		const key = isConsumer ? `${code}_CONS` : code
		const value = Number(vatConfig?.[key])
		return Number.isFinite(value) ? value : 0
	}, [deliveryAddress.region, normalizedUserType, vatConfig])

	const vatAmountForCheckout = round2(subtotalExclVat * (Number(vatPercentForCheckout || 0) / 100))
	const totalAmount = round2(subtotalExclVat + vatAmountForCheckout)

	return (
		<div className='checkout'>
			<div className='checkout__container'>
				<section className='checkout__sheet'>
					<header className='checkout__header'>
						<SimpleButton text={'Back to accessories'} onClick={onBackToAccessories || onClose} />

						<div className='checkout__proceed-group'>
							<SimpleButton
								text={'Proceed to Payment'}
								onClick={handlePlaceOrder}
								withIcon
								disabled={isPlacingOrder}
								className='checkout__proceed-btn'
							/>
							{isPlacingOrder && (
								<p className='checkout__loading-hint'>
									Processing your request... Please wait, this may take some time.
								</p>
							)}
						</div>

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

											{(isBusiness) && (
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
														required
												>
														<option value='' disabled>
															Select country
														</option>
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
											<label
												className={`address-extra__note ${isPhoneOk ? 'address-extra__note--checked' : ''}`}
											>
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
												type='text'
												name='invoiceEmail'
												id='invoiceEmail'
												value={invoiceEmail}
												onChange={handleInvoiceEmailChange}
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

										{isInvoiceDifferent && (
											<fieldset className='address-card'>
												<legend className='address-card__legend'>
													Invoice address
												</legend>

												<div className='field-row-wrap'>
													<FieldRow id='invoiceFullName' label='First name and surname'>
														<input
															id='invoiceFullName'
															name='invoiceFullName'
															type='text'
															value={invoiceAddress.fullName}
															onChange={e => updateInvoiceField('fullName', e.target.value)}
														/>
													</FieldRow>

													<FieldRow id='invoiceCompanyName' label='Company Name'>
														<input
															id='invoiceCompanyName'
															name='invoiceCompanyName'
															type='text'
															value={invoiceAddress.companyName}
															onChange={e => updateInvoiceField('companyName', e.target.value)}
														/>
													</FieldRow>

													<FieldRow id='invoiceAddress1' label='Address 1'>
														<input
															id='invoiceAddress1'
															name='invoiceAddress1'
															type='text'
															value={invoiceAddress.address1}
															onChange={e => updateInvoiceField('address1', e.target.value)}
														/>
													</FieldRow>

													<FieldRow id='invoiceAddress2' label='Address 2'>
														<input
															id='invoiceAddress2'
															name='invoiceAddress2'
															type='text'
															value={invoiceAddress.address2}
															onChange={e => updateInvoiceField('address2', e.target.value)}
														/>
													</FieldRow>

													<FieldRow id='invoiceAddress3' label='Address 3'>
														<input
															id='invoiceAddress3'
															name='invoiceAddress3'
															type='text'
															value={invoiceAddress.address3}
															onChange={e => updateInvoiceField('address3', e.target.value)}
														/>
													</FieldRow>

													<FieldRow id='invoiceTown' label='Town'>
														<input
															id='invoiceTown'
															name='invoiceTown'
															type='text'
															value={invoiceAddress.town}
															onChange={e => updateInvoiceField('town', e.target.value)}
														/>
													</FieldRow>

													<FieldRow id='invoicePostalCode' label='Postal code'>
														<input
															id='invoicePostalCode'
															name='invoicePostalCode'
															type='text'
															value={invoiceAddress.postalCode}
															onChange={e => updateInvoiceField('postalCode', e.target.value)}
														/>
													</FieldRow>

													<FieldRow id='invoiceCountry' label='Country'>
														<select
															className='select-country'
															id='invoiceCountry'
															name='invoiceCountry'
															value={invoiceAddress.country}
															onChange={e => updateInvoiceField('country', e.target.value)}
															required
														>
															<option value='' disabled>
																Select country
															</option>
															{COUNTRY_OPTIONS.map(country => (
																<option key={`invoice-${country.code}`} value={country.name}>
																	{country.name}
																</option>
															))}
														</select>

														<select
															className='select-region'
															id='invoiceRegion'
															name='invoiceRegion'
															aria-label='Invoice region'
															value={invoiceAddress.region}
															onChange={e => updateInvoiceField('region', e.target.value)}
															disabled
														>
															<option value=''></option>
															{COUNTRY_OPTIONS.map(country => (
																<option key={`invoice-${country.code}-region`} value={country.code}>
																	{country.code}
																</option>
															))}
														</select>
													</FieldRow>

													<FieldRow id='invoiceEmailAddress' label='E-Mail address'>
														<input
															id='invoiceEmailAddress'
															name='invoiceEmailAddress'
															type='text'
															value={invoiceAddress.email}
															onChange={e => {
																updateInvoiceField('email', e.target.value)
															}}
														/>
													</FieldRow>

													<FieldRow id='invoiceMobile' label='Mobile Phone'>
														<input
															id='invoiceMobile'
															name='invoiceMobile'
															type='tel'
															value={invoiceAddress.mobile}
															onChange={e => updateInvoiceField('mobile', e.target.value)}
														/>
													</FieldRow>
												</div>
											</fieldset>
										)}
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
														<td>Price: {Number(priceExclVat || 0).toFixed(2)} €</td>
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
														<td>Price: {Number(accessoriesPrice || 0).toFixed(2)} €</td>
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
														Del. Price: {deliveryPrice.toFixed(2)} €
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
												value={deliveryComment}
												onChange={e => setDeliveryComment(e.target.value)}
											/>

											<div className='delivery-comment__hint'>
												{deliveryHintText}
											</div>
										</div>

										<table className='summary-table' aria-label='VAT and total'>
											<tbody>
												{/* <tr>
													<td>VAT {Number(vatPercentForCheckout || 0).toFixed(0)}%</td>
													<td>{Number(vatAmountForCheckout || 0).toFixed(2)} €</td>
												</tr> */}
												<tr>
													<td>
														<strong>Total amount</strong>
													</td>
													<td>{Number(totalAmount || 0).toFixed(2)} €</td>
												</tr>
											</tbody>
										</table>
											<p className='checkout__vat-note'>No VAT is charged according to § 19 UStG.</p>
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
												Orders placed before 4:00 PM are usually shipped the
												same day.
											</p>
											<p>
												For next-day delivery, please select UPS Next Day
												Package.
											</p>
											<p>All prices are in Euros.</p>
										</div>

										<div className='summary-actions'>
											<div className='checkout__proceed-group'>
												<SimpleButton text='Proceed to Payment' onClick={handlePlaceOrder} withIcon disabled={isPlacingOrder} className='checkout__proceed-btn'/>
												{isPlacingOrder && (
													<p className='checkout__loading-hint'>
														Processing your request... Please wait, this may take some time.
													</p>
												)}
											</div>
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
