import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Сторінка, на яку Stripe редиректне після успіху
        return_url: `${window.location.origin}/completion`,
      },
    });

    // Якщо ми тут — значить сталася помилка (наприклад, карта відхилена)
    // Якщо все ок, Stripe сам зробить редирект на return_url
    if (error.type === "card_error" || error.type === "validation_error") {
      setMessage(error.message);
    } else {
      setMessage("Сталася неочікувана помилка.");
    }

    setIsProcessing(false);
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      <PaymentElement id="payment-element" />
      <button 
        disabled={isProcessing || !stripe || !elements} 
        id="submit"
        style={{ marginTop: '20px', width: '100%', padding: '10px', color:'#fff' }}
      >
        <span>{isProcessing ? "Обробка..." : "Pay now"}</span>
      </button>
      
      {message && <div id="payment-message" style={{ color: 'red', marginTop: '10px' }}>{message}</div>}
    </form>
  );
};

export default CheckoutForm;