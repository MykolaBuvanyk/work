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

          <div class="column">

            <label class="radio">
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