import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { $authHost } from '../../http';
import CheckoutForm from './CheckoutForm'; // Імпортуємо форму нижче
import './CheckoutPage.scss'

// Ініціалізуємо Stripe за межами компонента, щоб не створювати дублікати при рендері
const stripePromise = loadStripe(import.meta.env.VITE_LAYOUT_PUBLICH_KEY);

const CheckoutPage = () => {
  const { orderId } = useParams();
  const [clientSecret, setClientSecret] = useState('');

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

  // Налаштування зовнішнього вигляду (опціонально)
  const options = {
    clientSecret,
    appearance: { theme: 'stripe' },
  };

  return (
    <div class="overlay">
      <div class="modal">

        <Link to="/account/detail" class="back-btn">Back to Proceed to Payment</Link>

        <div class="modal-header">
          <h2>Choose your payment option</h2>
          <p>You can complete your order using one of the following payment methods:</p>
        </div>

        <div class="divider"></div>

        <div class="grid">

          <div class="column">

            <label class="radio">
              <input type="radio" name="pay" value="invoice" checked/>
              <span class="circle"></span>
              <span class="title">Pay by Invoice</span>
            </label>

            <div class="text-block">
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
    

            <button class="place-btn active">PLACE ORDER</button>

          </div>

          <div class="column">

            <label class="radio">
              <input type="radio" name="pay" value="online"/>
              <span class="circle"></span>
              <span class="title">Pay Online</span>
            </label>
            {clientSecret ? (
              <Elements stripe={stripePromise} options={options}>
                <CheckoutForm />
              </Elements>
            ) : (
              <p>Завантаження платіжного шлюзу...</p>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};

export default CheckoutPage;

/*
 <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px' }}>
      <h2>Pay order #{orderId}</h2>
      
      {clientSecret ? (
        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm />
        </Elements>
      ) : (
        <p>Завантаження платіжного шлюзу...</p>
      )}
    </div>
*/