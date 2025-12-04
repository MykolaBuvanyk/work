import React from 'react';
import { Link } from 'react-router-dom';
import styles from './TermsOfPurchasing.module.css';

const TermsOfPurchasing = () => {
    return (
        <div className={styles.terms_page}>
            <div className={styles.terms_page_wrapper}>
                <div className={styles.terms_page_title}>
                    <h1>Terms of Purchasing</h1>
                </div>
                <div className={styles.terms_page_subtitle}>
                    <h2>Company Information</h2>
                </div>
                <div className={styles.term_page_content}>
                    <p><strong>Legal name:</strong> SignXpert</p>
                    <p><strong>VAT Number:</strong> </p>
                    <p><strong>Address:</strong></p>
                    <p>SignXpert</p>
                    <p>Baumwiesen 2</p>
                    <p>Haigerloch</p>
                    <p>72401 Germany</p>
                    <p><strong>Email:</strong> info@sign-xpert.com</p>
                </div>
                <div className={styles.terms_page_subtitle}>
                    <h2>General</h2>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        The following purchase terms apply to all orders placed by customers with SignXpert (hereinafter referred to as “we”, “us”, or “SignXpert”) via the website sign-xpert.com. Once you submit a paid order, you enter into a purchase contract. The following terms govern your purchase with us and constitute an agreement between you and SignXpert. This agreement applies to your order, including all questions or disputes arising from your purchase.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        The version of the Terms and Conditions applicable to your order is the version available at sign-xpert.com at the time of purchase. Once we have received your order, a confirmation will be sent to the email address you provided. Please ensure that the email address given during checkout is correct, as this confirmation may be required for future customer service inquiries. Contact us as soon as possible if you do not receive the confirmation.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>We do not enter into binding purchase agreements with individuals who lack legal capacity or have limited legal capacity without the consent of their parents or legal guardians. We reserve the right to reject orders containing inappropriate or offensive content. This includes orders with pornographic, racist, or Nazi-related content. It is your responsibility to ensure that the content of your sign does not violate any regulations or applicable laws.</p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        We reserve the right to cancel orders if the images provided by the customer are of insufficient quality or contain technical errors.
                    </p>
                </div>
                <div className={styles.terms_page_subtitle}>
                    <h2>Prices</h2>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        All prices on this website are shown in Euro (€). For private customers, prices include VAT. For business customers, prices are shown excluding VAT. In the final step of checkout, you can see the final total of your order. Shipping costs are displayed both in the cart and before completing the order.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        Private individuals are charged 20% VAT. Businesses providing a valid VAT number receive VAT-exempt deliveries. Businesses without a valid VAT number will be charged 20% non-deductible VAT.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        We reserve the right to change our prices without prior notice. The price valid for your purchase is the price displayed at sign-xpert.com at the time of ordering.
                    </p>
                </div>
                <div className={styles.terms_page_subtitle}>
                    <h2>Delivery</h2>
                </div>
                <div className={styles.term_page_content}>
                    <p>SignXpert ships orders via Österreichische Post and DHL, which handle the delivery. Most orders are shipped as standard letters.</p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        If the value of the shipment exceeds €455, the weight exceeds 2 kg, or the product dimensions exceed 485 × 320 mm, the order will be shipped as a parcel. For orders not meeting these criteria, parcel shipping can still be selected at an additional cost.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        For business customers, parcels are delivered directly to the specified delivery address without prior notice.
                    </p>
                </div>
                <div className={styles.terms_page_subtitle}>
                    <h2>Delivery Conditions – Germany</h2>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        We always strive to meet the stated delivery times. However, delays may occur due to unforeseen circumstances. If a delay occurs, we will inform you via phone or email as soon as possible and provide a new estimated delivery time. Please contact us if the goods do not arrive within 14 days of the scheduled delivery.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        You have the right to cancel your purchase if the delay causes significant inconvenience. You may always cancel your order if the delivery time exceeds 30 days.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        Packages delivered to the nearest post office and not collected within 14 days will be returned to us. If the parcel is not collected on time, the customer is responsible for the return shipping costs. However, the customer bears the transport risk for all returns, while SignXpert bears the transport risk for deliveries to the customer.
                    </p>
                </div>
                <div className={styles.terms_page_subtitle}>
                    <h2>Privacy Policy</h2>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        SignXpert is responsible for the personal data collected and processed in connection with your order. We process all personal information in accordance with applicable data protection laws. When you place an order, you provide personal information such as your name, address, email address, and telephone number. This information is necessary for us to deliver your order, handle complaints, and manage any future orders.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        If you need to change your shipping and/or billing address, please log in to your customer account and update the information. You are responsible for ensuring that shipping and billing addresses are correct. Your email address may be used to send newsletters if you have given your consent. You can unsubscribe at any time. You can also subscribe to our newsletter during checkout.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        As a customer, you have the right to access the information we store about you. You also have the right to request corrections, deletion, restriction of processing, and the right to data portability.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        If you wish to exercise your rights, please contact us at <a href="mailto:info@sign-xpert.com">info@sign-xpert.com</a>
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        Comprehensive information about how we process your personal data and your rights can be found in our <Link to="/privacy-policy">Privacy Policy</Link>.
                    </p>
                </div>
                <div className={styles.terms_page_subtitle}>
                    <h2>Payment</h2>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        <strong>
                            Your order is confirmed when you click "Complete Purchase." If your payment fails, you may try again or choose a different payment method. We offer the following payment methods:
                        </strong>
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        <strong>Invoice:</strong> For invoice payments, a fee of €4 (incl. VAT) applies. Payment must be made within 20 days. If payment is late, a reminder fee of €5 and statutory interest charges will apply. If payment is still not received, the case will be forwarded to our collection agency.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        <strong>Credit/Debit Card:</strong> You may make secure payments via credit or debit card. We accept VISA and MasterCard. Your payment is processed by Adyen B.V. using secure encryption and strict banking standards. Adyen B.V. complies with PCI DSS requirements. The website sign-xpert.com uses SSL encryption, and your card details are sent directly to the bank and cannot be read or accessed by anyone else.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        <strong>Cancellation:</strong> You may cancel your order before it leaves our warehouse by contacting us at info@sign-xpert.com. Once the order has been shipped, cancellation is no longer possible.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        <strong>Right of Return & Customer Satisfaction Guarantee:</strong> The right of return does not apply to custom-made products or items clearly personalized according to the customer’s specifications. Once your order leaves our warehouse, it cannot be returned, as all our products are made individually.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        Although returns are not permitted, we aim to provide you with a worry-free shopping experience at sign-xpert.com. If you are not satisfied with your product, our “Satisfaction Guarantee” applies to our entire product range. This guarantee means that you may contact us if you are unhappy with your product. First, we will address the issue and send you a replacement. If the problem cannot be resolved, we will issue a full refund/credit.
                    </p>
                </div>
                <div className='term_page_content'>
                    <p>
                        To use the “Satisfaction Guarantee,” please contact us as soon as possible via email. We require your order number and a description of the issue.
                    </p>
                </div>
                <div className='term_page_content'>
                    <p>
                        Our “Satisfaction Guarantee” is valid for 30 days from the date the product was delivered to you. You must inform us within 30 days of receiving the product. This guarantee is in addition to your statutory rights and does not affect them.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        In addition to statutory rights and the satisfaction guarantee, SignXpert provides a 1-year warranty on all products.
                    </p>
                </div>
                <div className={styles.terms_page_subtitle}>
                    <h2>Complaints</h2>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        If you need to file a complaint about our product, please contact customer service at info@sign-xpert.com. You may also contact us via any other methods listed above.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        Please provide your order number, a description of the defect, and preferably a photo of the defective product. A return of the product may be required for further inspection. If the complaint is accepted, return shipping costs will be reimbursed. We accept complaints regarding product defects, manufacturing errors, and transport damage.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        Complaints must be submitted within a reasonable timeframe (two (2) months is considered reasonable), but no later than three (3) years after receiving the goods. If the complaint is accepted, compensation will be provided according to legal requirements by repairing the product, replacing it, providing a price reduction, or refunding the full amount including shipping costs.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        Refunds are issued within 10 days from the date the contract is lawfully terminated. Refunds are made using the same payment method used during checkout. If product return is required, a full refund is issued provided the item is returned in the same condition as delivered.
                    </p>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        If the returned item has been used more than necessary to determine its nature and function, SignXpert is entitled to apply a deduction for the reduced value. This deduction may equal the full product price.
                    </p>
                </div>
                <div className={styles.terms_page_subtitle}>
                    <h2>In Case of Disputes</h2>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        We always aim to resolve issues directly with our customers. If you purchased a product from SignXpert and a dispute cannot be resolved with us, you may submit a complaint through the EU Online Dispute Resolution (ODR) platform.
                    </p>
                </div>
                <div className={styles.terms_page_subtitle}>
                    <h2>Severability Clause</h2>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        If any part of these Terms and Conditions is found to be invalid or unenforceable by a court or authority, this does not affect the validity of the remaining provisions.
                    </p>
                </div>
                <div className={styles.terms_page_subtitle}>
                    <h2>Force Majeure</h2>
                </div>
                <div className={styles.term_page_content}>
                    <p>
                        SignXpert is exempt from responsibility for damages or delays caused by circumstances beyond our control. Examples include floods, fires, operational disruptions, prohibitions, restrictions, sabotage, poor transport conditions, severe weather, or war.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TermsOfPurchasing;
