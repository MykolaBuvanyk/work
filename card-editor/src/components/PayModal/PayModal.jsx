import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next';
import { $authHost } from '../../http';
import CheckoutForm from '../Account/CheckoutForm';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import './PayModal.scss'


const stripePromise = loadStripe(import.meta.env.VITE_LAYOUT_PUBLICH_KEY);

const PayModal = ({isPayOpen,onClose,backToPayment,orderId,onPlaceOrder}) => {
    const { t } = useTranslation();
    const [clientSecret, setClientSecret] = useState('');
    const [paymentOption, setPaymentOption] = useState('invoice');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

    useEffect(() => {
        const getClientSecret = async () => {
        try {
            const res = await $authHost.post('cart/create-payment-intent/' + orderId);
            setClientSecret(res.data.clientSecret);
        } catch (err) {
            console.error(err);
            alert(t('payModal.alerts.paymentDataFailed'));
        }
        };
        if (orderId) getClientSecret();
    }, [orderId, t]);

    const savePaymentMethod = async (paymentMethod) => {
      if (!orderId) return;
      try {
        await $authHost.post('cart/set-payment-method/' + orderId, {
          paymentMethod,
        });
      } catch (err) {
        console.error(err);
      }
    };

    // Налаштування зовнішнього вигляду (опціонально)
    const options = {
        clientSecret,
        appearance: { theme: 'stripe' },
    };
    const payTrue=async()=>{
        await savePaymentMethod('online');
        onClose();
    }

    const handlePlaceOrderClick = async () => {
      if (isSubmittingOrder || paymentOption === 'online') return;
      if (typeof onPlaceOrder === 'function') {
        setIsSubmittingOrder(true);
        try {
          await savePaymentMethod('invoice');
          const placed = await Promise.resolve(onPlaceOrder());
          if (!placed) return;
        } finally {
          setIsSubmittingOrder(false);
        }
      }
      onClose();
    };

    if(!isPayOpen)return null;
  return (
    <div className='pay-modal'>
        <div className="modal">

        <button onClick={backToPayment} className="back-btn">{t('payModal.backToPayment')}</button>

        <div className="modal-header">
          <h2>{t('payModal.title')}</h2>
          <p>{t('payModal.description')}</p>
        </div>

        <div className="divider"></div>

        <div className="grid">

          <div className="column">

            <label className="radio">
              <input
                type="radio"
                name="pay"
                value="invoice"
                checked={paymentOption === 'invoice'}
                onChange={() => setPaymentOption('invoice')}
              />
              <span className="circle"></span>
              <span className="title">{t('payModal.invoice.title')}</span>
            </label>

            <div className="text-block">
              <p>{t('payModal.invoice.placeOrder')}</p>

              <p>{t('payModal.invoice.shipped')}</p>

              <p>{t('payModal.invoice.optionsIntro')}</p>

              <p>
                {t('payModal.invoice.onlinePrefix')}{' '}
                <a href="https://sign-xpert.com/account" target="_blank" rel="noopener noreferrer">{t('payModal.invoice.myAccount')}</a>
                {' -> '}
                <a href="https://sign-xpert.com/account/detail" target="_blank" rel="noopener noreferrer">{t('payModal.invoice.myOrders')}</a>
                {t('payModal.invoice.onlineSuffix')}{' '}
                <a href="https://sign-xpert.com/account" target="_blank" rel="noopener noreferrer">{t('payModal.invoice.pay')}</a>
              </p>
              <p>{t('payModal.invoice.bankTransfer')}</p>

              <p>{t('payModal.invoice.received')}</p>

              <p><strong><em>{t('payModal.invoice.preferred')}</em></strong></p>
            </div>
    

            <button
              onClick={handlePlaceOrderClick}
              className={`place-btn ${paymentOption === 'online' ? 'disabled' : 'active'}`}
              disabled={paymentOption === 'online' || isSubmittingOrder}
            >
              {t('payModal.placeOrder')}
            </button>

          </div>

          <div className="column">

            <label className="radio">
              <input
                type="radio"
                name="pay"
                value="online"
                checked={paymentOption === 'online'}
                onChange={() => setPaymentOption('online')}
              />
              <span className="circle"></span>
              <span className="title">{t('payModal.online.title')}</span>
            </label>
            {clientSecret ? (
              <Elements stripe={stripePromise} options={options}>
                <CheckoutForm payTrue={payTrue} isModal={true} />
              </Elements>
            ) : (
              <p>{t('payModal.online.loadingGateway')}</p>
            )}

          </div>

        </div>

      </div>
    </div>
  )
}

export default PayModal
