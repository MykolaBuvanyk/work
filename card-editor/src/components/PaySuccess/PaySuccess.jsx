import React from "react";
import { Link } from "react-router-dom"; // або next/link
import './style.scss'

const PaymentSuccess = () => {
  return (
    <div className="success-page">
      <div className="success-card">
        <div className="icon">✔</div>

        <h1>Payment Successful</h1>

        <p>
          Thank you for your purchase! Your payment has been successfully
          processed.
        </p>

        <p className="sub">
          You can view your order details in your account.
        </p>

        <div className="actions">
          <Link to="/account" className="btn primary">
            Go to Account
          </Link>

          <Link to="/" className="btn secondary">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;