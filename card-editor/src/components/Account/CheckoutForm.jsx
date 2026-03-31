import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

const CheckoutForm = ({isModal=false,payTrue}) => {
  const stripe = useStripe();
  const elements = useElements();
  
  const [message, setMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment(
      isModal
        ? {
            elements,
            redirect: 'if_required',
          }
        : {
            elements,
            confirmParams: {
              return_url: `/account`,
            },
          }
    );

    if (error) {
      if (!isModal) {
        if (error.type === "card_error" || error.type === "validation_error") {
          setMessage(error.message);
        } else {
          console.log(33,error);
          setMessage("Сталася неочікувана помилка.");
        }
      }
    } else {
      // ✔ тільки тут вважаємо оплату успішною (для modal)
      if (isModal) {
        payTrue();
      }
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