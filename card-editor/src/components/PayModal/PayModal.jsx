import React, { useEffect, useState } from 'react'
import { $authHost } from '../../http';
import CheckoutForm from '../Account/CheckoutForm';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import './PayModal.scss'


const stripePromise = loadStripe(import.meta.env.VITE_LAYOUT_PUBLICH_KEY);

const PayModal = ({isPayOpen,onClose,backToPayment,orderId}) => {
    const [clientSecret, setClientSecret] = useState('');
    const [paymentOption, setPaymentOption] = useState('invoice');

    useEffect(() => {
        const getClientSecret = async () => {
        try {
            const res = await $authHost.post('cart/create-payment-intent/' + orderId);
            setClientSecret(res.data.clientSecret);
        } catch (err) {
            console.error(err);
            alert('Помилка при отриманні даних для оплати');
        }
        };
        if (orderId) getClientSecret();
    }, [orderId]);

    useEffect(() => {
      const savePaymentMethod = async () => {
        try {
          await $authHost.post('cart/set-payment-method/' + orderId, {
            paymentMethod: paymentOption,
          });
        } catch (err) {
          console.error(err);
        }
      };

      if (isPayOpen && orderId) {
        savePaymentMethod();
      }
    }, [isPayOpen, orderId, paymentOption]);

    // Налаштування зовнішнього вигляду (опціонально)
    const options = {
        clientSecret,
        appearance: { theme: 'stripe' },
    };
    const payTrue=()=>{
        onClose();
    }
    if(!isPayOpen)return null;
  return (
    <div className='pay-modal'>
        <div className="modal">

        <button onClick={backToPayment} className="back-btn">Back to Proceed to Payment</button>

        <div className="modal-header">
          <h2>Choose your payment option</h2>
          <p>You can complete your order using one of the following payment methods:</p>
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
              <span className="title">Pay by Invoice</span>
            </label>

            <div className="text-block">
              <p>Place your order and pay the invoice within 30 days.</p>

              <p>Once your order has been shipped, the invoice will be sent to your email and will also be included with your shipment.</p>

              <p>You can pay the invoice using one of the following options:</p>

            • Online in your account – log in to 
            <a href="https://sign-xpert.com/account" target="_blank" rel="noopener noreferrer"> My Account</a> →
            <a href="https://sign-xpert.com/account/detail" target="_blank" rel="noopener noreferrer">My Orders</a>,
    find your order and click 
        <a href="https://sign-xpert.com/account" target="_blank" rel="noopener noreferrer"> Pay</a>
              <p>• Bank transfer – you can also pay manually using the bank details provided.</p>

              <p>Once the payment has been received, the order will be marked as paid.</p>

    <p><strong><em>(Preferred by many of our business customers.)</em></strong></p>        </div>
    

            <button
              onClick={onClose}
              className={`place-btn ${paymentOption === 'online' ? 'disabled' : 'active'}`}
              disabled={paymentOption === 'online'}
            >
              PLACE ORDER
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
              <span className="title">Pay Online</span>
            </label>
            {clientSecret ? (
              <Elements stripe={stripePromise} options={options}>
                <CheckoutForm payTrue={payTrue} isModal={true} />
              </Elements>
            ) : (
              <p>Завантаження платіжного шлюзу...</p>
            )}

          </div>

        </div>

      </div>
    </div>
  )
}

export default PayModal