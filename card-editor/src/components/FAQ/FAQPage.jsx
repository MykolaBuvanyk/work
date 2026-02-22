import React from 'react'
import { Link } from 'react-router-dom'
import FAQ from './FAQ'

const items = [
  {
    question: 'Is it easy to design a custom sign online?',
    answer: (
      <>
        <p>
          Yes — the process is designed to be simple, intuitive, and step-by-step.
        </p>
        <p>
          In our online editor, you first choose the shape of your sign. Then you set the
          dimensions, material thickness, and material color. After that, you can add
          text, images, QR codes, barcodes, create holes, make the required number of
          copies, and customize all other features — literally everything you need.
        </p>
        <p>Each step comes with a live preview, so no special skills or design experience are required.</p>
        <p>
          If you need additional guidance, you can use our <Link to="/quick-guide">Quick Guide</Link>, which explains
          the entire process step by step.
        </p>
        <p>
          If you still have questions after that, go to the <Link to="/contacts">Contacts</Link> page and get in touch with
          our managers — they will be happy to assist you.
        </p>
        <p>
          With <Link to="/">SignXpert</Link>, creating a professional sign online is simple, convenient, and
          efficient.
        </p>
      </>
    ),
  },
  {
    question: 'How can I pay for my order?',
    answer: (
      <>
        <p>
          You can easily pay for your order using a variety of payment methods available on
          our website. We accept Visa, MasterCard, PayPal, and several other options.
        </p>
        <p>
          You can choose to pay immediately during checkout, or choose to pay by invoice. If
          you select the invoice option, we will issue a bill, which must be paid within 30 days.
        </p>
        <p>
          All payments are processed securely, and you will receive confirmation once your
          payment is completed. This ensures your order is quickly confirmed and ready for production.
        </p>
      </>
    ),
  },
  {
    question: 'How can I get my order VAT-free?',
    answer: (
      <>
        <p>
          If you are placing an order on behalf of a company, you may be eligible to receive
          your order VAT-free. To do this, enter your VAT number in the designated field on
          the registration page and click the “Check” button. The system will verify your
          number and inform you whether it has passed validation.
        </p>
        <ul>
          <li>If your VAT number is valid, you will not be charged VAT for orders within the EU (except Germany).</li>
          <li>If the check fails, first make sure your number is entered correctly. Sometimes waiting a short time and trying again helps.</li>
        </ul>
        <p>
          If no VAT number is entered or the validation fails, VAT will be charged at the rate
          applicable in your country. For consumers and for companies located in Germany, regardless
          of whether they have a valid VAT number, the standard 19% VAT applies. If you are
          outside the European Union, for example in Switzerland, the UK, or other countries, a 0% VAT
          rate will apply for exported goods.
        </p>
        <p>If you still have questions or encounter any issues, please contact us, and our team will be happy to assist you.</p>
      </>
    ),
  },
  {
    question: 'Can I return my order and what does your Satisfaction Guarantee include?',
    answer: (
      <>
        <p>
          At <Link to="/">SignXpert</Link>, we believe that every customer should be completely satisfied with their order.
          If for any reason your product does not meet your expectations, we are ready to make it right —
          this is our Full Satisfaction Guarantee.
        </p>
        <p>What the guarantee includes:</p>
        <ul>
          <li>It applies to all custom products.</li>
          <li>If your order contains an error or does not meet your expectations, we will first correct the issue and send replacement items.</li>
          <li>If this does not resolve the problem, we offer a full refund.</li>
        </ul>
        <p>Tips to ensure complete satisfaction:</p>
        <ul>
          <li>Before placing your order, carefully check all details in the editor: text, element placement, and selected options.</li>
          <li>Review our <Link to="/quick-guide">Quick Guide</Link> page to understand how to use our online editor.</li>
          <li>Double-check your order confirmation to make sure everything is correct.</li>
        </ul>
        <p>If you are still not satisfied:</p>
        <ul>
          <li><Link to="/contacts">Contact us</Link> as soon as possible so we can assist you promptly.</li>
          <li>The guarantee is valid for 30 days after delivery, so please reach out within this period.</li>
        </ul>
        <p>With <Link to="/">SignXpert</Link>, creating a custom product is easy, safe, and enjoyable, and we are always ready to help if anything goes wrong.</p>
      </>
    ),
  },
  {
    question: 'How much does shipping cost, and what are the delivery options and their delivery times?',
    answer: (
      <>
        <p>
          Shipping costs at <Link to="/">SignXpert</Link> depend on the size, weight, and value of your order, as well as
          the destination country.
        </p>
        <p>We mainly ship via UPS, with several delivery options available at checkout:</p>
        <ul>
          <li>Standard shipping – usually takes 1–3 days.</li>
          <li>Express shipping – available for more urgent orders (Next Day Delivery).</li>
          <li>Saturday delivery – available in some areas if you need your order over the weekend.</li>
        </ul>
        <p>
          All options and their costs are clearly displayed during checkout, so you can choose the delivery
          method that suits you best. Every package is shipped with a tracking number, which you can always
          check in your <Link to="/account">My Account</Link> dashboard to monitor the delivery status.
        </p>
      </>
    ),
  },
  {
    question: 'Where can I find information about my orders and payments?',
    answer: (
      <>
        <p>
          If you already have an account, first <Link to="/login">Log in</Link>, and then go to the <Link to="/account">My Account</Link> tab to view all the
          orders you have ever placed with <Link to="/">SignXpert</Link>.
        </p>
        <p>In this section, you can find and manage important details about your orders:</p>
        <ul>
          <li>Order date and order number</li>
          <li>Project name</li>
          <li>Order total</li>
          <li>Order status</li>
          <li>Download your Delivery Note</li>
          <li>Track your shipment via the tracking number link</li>
          <li>Download your Invoice</li>
          <li>Check payment status — if your order is not yet paid, you can pay directly via the provided link</li>
          <li>Open your project and view its details</li>
        </ul>
        <p>All of these features are available in the <Link to="/account">My Account</Link> section, giving you full control over your orders and payments.</p>
      </>
    ),
  },
  {
    question: 'What should I do if I provided incorrect information?',
    answer: (
      <>
        <p>
          If you provided incorrect details, such as your shipping address, invoice address, email, or phone
          number, please <Link to="/contacts">Contact us</Link> immediately with the correct information.
        </p>
        <p>
          You can also update your information yourself in <Link to="/account">My Account</Link> → My Details. Once you make the changes
          and notify us, we will do our best to ensure your order is sent to the correct address.
        </p>
      </>
    ),
  },
  {
    question: 'What should I do if I have not received my order?',
    answer: (
      <>
        <p>If you have not received your order, please follow these steps:</p>
        <ul>
          <li>Check the recipient details — make sure you provided the correct shipping address, email, and phone number.</li>
          <li>Track your package using the Tracking number link to see where your shipment is and any updates.</li>
          <li>Check the delivery timeframe — your order may still be in transit.</li>
        </ul>
        <p>
          If the details are correct, the package is being tracked, and the delivery time has already passed,
          please <Link to="/contacts">Contact us</Link>, and we will assist you as soon as possible.
        </p>
      </>
    ),
  },
  {
    question: 'How can I track my delivery?',
    answer: (
      <>
        <p>Most orders at <Link to="/">SignXpert</Link> are shipped via UPS and come with a tracking number so you can monitor your package.</p>
        <ul>
          <li>You can go to <Link to="/account">My Account</Link>, find your tracking number, and click on it. A new window will open showing the location of your package and the tracking number itself.</li>
          <li>The tracking number will also be sent to your email once your order has been shipped.</li>
        </ul>
        <p>This way, you can always stay informed about the location and status of your package.</p>
      </>
    ),
  },
  {
    question: 'Why haven’t I received my invoice?',
    answer: (
      <>
        <p>We send your invoice via the email you provided during registration. If you haven’t received it, please check your spam folder.</p>
        <p>
          You can also download your invoice at any time: go to <Link to="/account">My Account</Link> and click the Invoice button. By clicking it, you can download your invoice in PDF format.
        </p>
        <p>The paper invoice is always included with your ordered products. If you provided a separate address for the invoice, it will be sent by mail to that address.</p>
      </>
    ),
  },
  {
    question: 'What should I do if my sign is broken or made incorrectly?',
    answer: (
      <>
        <p>
          Our top priority is that you are completely satisfied with your products. We carefully craft each order to meet your expectations.
        </p>
        <p>
          If you receive an incorrect product, a defect, a design error, or any other issue, please contact us as soon as possible.
        </p>
        <p>Use our email: <a href="mailto:info@sign-xpert.com">info@sign-xpert.com</a>. In your message, please include:</p>
        <ul>
          <li>The email address you used to register</li>
          <li>Customer number</li>
          <li>Order number</li>
          <li>Attach a photo of the damaged or incorrect product</li>
          <li>Provide a brief description of the issue</li>
        </ul>
        <p>We will get back to you as quickly as possible to resolve the issue and send the correct product.</p>
      </>
    ),
  },
]

export default function FAQPage() {
  return <FAQ title="Frequently asked questions" items={items} />
}

