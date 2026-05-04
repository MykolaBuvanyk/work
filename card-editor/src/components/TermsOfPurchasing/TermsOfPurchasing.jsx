import React from 'react';
import './TermsOfPurchasing.scss'

const TermsOfPurchasing = () => {
  return (
    <div className="TermsOfPurchasing max-w-4xl mx-auto px-4 py-12 text-gray-800 font-sans leading-relaxed">
      {/* Заголовок */}
      <h1 className="text-2xl font-bold mb-8 text-gray-900 border-b pb-4">
        Terms of Purchasing
      </h1>

      {/* Company Information */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          Company Information
        </h2>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm space-y-2">
          <p><strong>Legal name:</strong> Kostyantyn Utvenko, SignXpert</p>
          <p><strong>VAT ID:</strong> DE461817538</p>
          <p><strong>Address:</strong> Kostyantyn Utvenko, SignXpert Baumwiesen 2, 72401 Haigerloch, Germany</p>
          <p><strong>Email:</strong> <a href="mailto:info@sign-xpert.com" className="text-blue-600 hover:underline">info@sign-xpert.com</a></p>
        </div>
      </section>

      {/* 1. General */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          1. General
        </h2>
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            The following purchase terms apply to all orders placed by customers via the website <strong>sign-xpert.com</strong>.
          </p>
          <p>
            By submitting a paid order, you enter into a legally binding purchase contract with <strong>SignXpert</strong> (hereinafter "we" or "us").
          </p>
          <p>
            Once we have received your order, an automated confirmation will be sent to the email address provided. Please ensure the email address is correct. We do not enter into binding agreements with individuals who lack legal capacity (minors) without consent from legal guardians.
          </p>
          <p>
            We reserve the right to reject or cancel orders containing inappropriate content, including pornographic, racist, or extremist content.
          </p>
          <p>
            The customer is responsible for ensuring their designs do not violate any applicable laws or third-party rights (e.g., trademarks).
          </p>
        </div>
      </section>

      {/* 2. Prices and Small Business Status (VAT) */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          2. Prices and Small Business Status (VAT)
        </h2>
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            All prices on our website are shown in Euro (€).
          </p>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-yellow-800">
            <p className="font-semibold mb-1">Important Tax Information:</p>
            <p className="mb-2">
              According to § 19 UStG (German Value Added Tax Act), we operate as a small business (<em>Kleinunternehmer</em>). Therefore, we do not charge VAT (<em>Umsatzsteuer</em>), and VAT is not displayed on our invoices.
            </p>
            <p className="italic">
              "All prices are final prices plus shipping costs. No VAT is charged in accordance with § 19 UStG."
            </p>
          </div>
          <p>
            Shipping costs are clearly displayed in the cart and during the final step of checkout. We reserve the right to adjust prices for future orders without prior notice.
          </p>
        </div>
      </section>

      {/* 3. Delivery */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          3. Delivery
        </h2>
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            SignXpert ships orders via <strong>UPS</strong> and <strong>DHL</strong>.
          </p>
          <p>
            <strong>Shipping Methods:</strong> Depending on the dimensions and weight of the order, delivery is made by parcel or registered mail.
          </p>
          <p>
            <strong>Delivery Times:</strong> We strive to meet stated delivery times. However, delays may occur due to circumstances beyond our control. If a delay exceeds 30 days, you have the statutory right to cancel your order.
          </p>
          <p>
            <strong>Transfer of Risk:</strong> For consumers (private individuals), the risk of loss or damage during transport lies with SignXpert until the goods are delivered to you. For business customers, the risk transfers to the customer once the goods are handed over to the carrier (UPS or DHL).
          </p>
        </div>
      </section>

      {/* 4. Right of Withdrawal */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          4. Right of Withdrawal (Widerrufsrecht)
        </h2>
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm space-y-3">
          <p className="font-semibold text-gray-900">
            Exclusion of the Right of Withdrawal:
          </p>
          <p className="text-gray-700">
            According to § 312g para. 2 no. 1 BGB (German Civil Code), the right of withdrawal (right to return) <strong>does not apply</strong> to contracts for the delivery of goods that are not prefabricated and for whose production an individual selection or determination by the consumer is decisive, or which are clearly tailored to the personal needs of the consumer (custom-made signs).
          </p>
          <p className="text-gray-700">
            Since our products are manufactured according to your individual specifications, <strong>cancellation or return is not possible</strong> once production has started or after the items have been delivered.
          </p>
        </div>
      </section>

      {/* 5. Satisfaction Guarantee & Warranty */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          5. Satisfaction Guarantee & Warranty
        </h2>
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            Despite the exclusion of the legal right of return, we offer a <strong>30-day Satisfaction Guarantee</strong>: If you are unhappy with your product, please contact us. We will first attempt to provide a replacement. If the issue cannot be resolved, we will issue a credit or refund.
          </p>
          <p>
            This guarantee applies for 30 days from delivery and does not limit your statutory warranty rights.
          </p>
          <p>
            <strong>Statutory Warranty (Gewährleistung):</strong> Statutory warranty rights apply to all products. Additionally, SignXpert provides a 1-year warranty on product durability and function.
          </p>
        </div>
      </section>

      {/* 6. Payment */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          6. Payment
        </h2>
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            Orders are confirmed upon completion of the checkout process. We offer the following payment methods via <strong>Stripe</strong> and <strong>Sparkasse</strong>:
          </p>
          <p>
            <strong>Credit/Debit Card (VISA/MasterCard):</strong> Securely processed via Stripe. Your data is encrypted (SSL) and sent directly to the payment provider.
          </p>
          <p>
            <strong>Bank Transfer:</strong> Orders enter production once payment has been received on our Sparkasse account.
          </p>
        </div>
      </section>

      {/* 7. Privacy Policy */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          7. Privacy Policy
        </h2>
        <p className="text-sm text-gray-700 leading-normal">
          We process your personal data (name, address, email) to fulfill your order and manage customer service. All processing is compliant with the GDPR (DSGVO) and the German BDSG. For full details, please refer to our Privacy Policy.
        </p>
      </section>

      {/* 8. Complaints and Transport Damage */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          8. Complaints and Transport Damage
        </h2>
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            Please inspect your shipment upon arrival. If the product is damaged during transport or is defective:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Contact us at <a href="mailto:info@sign-xpert.com" className="text-blue-600 hover:underline">info@sign-xpert.com</a></li>
            <li>Provide your order number, a description of the defect, and a photo</li>
          </ul>
          <p>
            If the complaint is accepted, we will repair, replace, or refund the item at our expense.
          </p>
        </div>
      </section>

      {/* 9. Disputes and Severability */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          9. Disputes and Severability
        </h2>
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            <strong>Online Dispute Resolution:</strong> The European Commission provides a platform for Online Dispute Resolution (ODR), available at:{' '}
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              https://ec.europa.eu/consumers/odr/
            </a>.
          </p>
          <p>
            We are neither obligated nor willing to participate in dispute resolution proceedings before a consumer arbitration board.
          </p>
          <p>
            <strong>Severability Clause:</strong> If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.
          </p>
        </div>
      </section>

      {/* 10. Force Majeure */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          10. Force Majeure
        </h2>
        <p className="text-sm text-gray-700 leading-normal">
          SignXpert is not liable for delays or damages caused by circumstances beyond our reasonable control (e.g., natural disasters, war, strikes, or severe disruptions in transport infrastructure).
        </p>
      </section>
    </div>
  );
};

export default TermsOfPurchasing;