import styles from './PrivacyPolicy.module.css';

const PrivacyPolicy = () => {
  const openCookie = () => {
    localStorage.removeItem('cookieConsent');
    window.location.reload()
  }
  return (
    <div className={styles.terms_page}>
      <div className="max-w-4xl mx-auto px-4 py-12 text-gray-800 font-sans leading-relaxed">
        {/* Заголовок */}
        <h1 style={{fontSize:'28px',marginBottom:'20px'}} className="text-2xl font-bold mb-8 text-gray-900 border-b pb-4">
          Privacy Policy
        </h1>
        
        <p className="mb-8 text-sm text-gray-600">
          Your trust is important to us. To ensure you feel confident when visiting our website, we comply with all legal requirements of Germany and the EU regarding the processing of personal data (GDPR/DSGVO, BDSG, TDDDG). Below you’ll find information about how we collect, manage, and use your data.
        </p>

        {/* 1. Responsible Party */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            1. Responsible Party (Verantwortlicher)
          </h2>
          <p className="mb-3">
            The responsible party for the collection, processing, and use of personal data is the owner of the <strong>SignXpert</strong> brand:
          </p>
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm space-y-2">
            <p><strong>Name:</strong> Kostyantyn Utvenko</p>
            <p><strong>VAT ID (USt-IdNr.):</strong> DE461817538</p>
            <p><strong>E-mail:</strong> <a href="mailto:info@sign-xpert.com" className="text-blue-600 hover:underline">info@sign-xpert.com</a></p>
            <p><strong>Mail:</strong> Kostyantyn Utvenko, SignXpert Baumwiesen 2 72401 Haigerloch Germany</p>
            <p><strong>URL:</strong> <a href="https://sign-xpert.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">https://sign-xpert.com</a></p>
            <p><strong>Contact form:</strong> <a href="https://sign-xpert.com/contacts" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">https://sign-xpert.com/contacts</a></p>
          </div>
        </section>

        {/* 2. Collection, Processing, and Use of Personal Data */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            2. Collection, Processing, and Use of Personal Data
          </h2>
          <p className="mb-5">
            We are personally responsible for the information you share with us. Personal data refers to any information that can be traced back to an identifiable person. We collect and process your information to handle your orders. Data is only shared with third parties when permitted by law (e.g., for logistics or payment processing).
          </p>
          <p className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800">
            <strong>Retention Periods:</strong> In accordance with German commercial and tax laws (<em>Handelsgesetzbuch — HGB</em> and <em>Abgabenordnung — AO</em>), we store customer and order information, including accounting documents and invoices, for <strong>10 years</strong>.
          </p>

          {/* 2.1 Registration */}
          <h3 className="text-lg font-medium mt-8 mb-3 text-gray-900">2.1 Registration of Customer Account and Ordering</h3>
          <p className="mb-3 text-sm text-gray-700">
            To fulfill our contractual obligations (Art. 6 para. 1 lit. b GDPR), the following information must be provided when creating an account or placing an order:
          </p>
          <ul className="list-disc pl-5 mb-6 space-y-1.5 text-sm text-gray-700">
            <li>Your email address</li>
            <li>Your full name</li>
            <li>Company name (if applicable)</li>
            <li>Company VAT ID (USt-IdNr.)</li>
            <li>Your address (shipping and billing)</li>
            <li>Your phone number (used only for delivery notifications and logistics coordination)</li>
            <li>Your password (stored in encrypted form)</li>
          </ul>

          {/* 2.2 Creation of Signs */}
          <h3 className="text-lg font-medium mt-6 mb-3 text-gray-900">2.2 Creation of Signs</h3>
          <p className="mb-6 text-sm text-gray-700">
            When you design a sign, we save the content you add to process your order. We never share sign content with third parties for marketing purposes.
          </p>

          {/* 2.3 Managing Payments */}
          <h3 className="text-lg font-medium mt-6 mb-3 text-gray-900">2.3 Managing Payments</h3>
          <p className="mb-4 text-sm text-gray-700">
            We use modern encryption standards to ensure the security of your transactions.
          </p>
          <div className="space-y-4 mb-6 text-sm text-gray-700">
            <p>
              <strong>Stripe:</strong> Card payments and other online methods are handled by the payment provider <em>Stripe</em>. Your full card details are sent directly to Stripe. We only have access to the cardholder's name, card type, last 4 digits, and transaction details to process refunds.
            </p>
            <p>
              <strong>Sparkasse:</strong> For direct bank transfers (e.g., payment by invoice or prepayment), your payment data (name, IBAN, amount) is processed through our bank, <em>Sparkasse</em>.
            </p>
            <p>
              <strong>PayPal:</strong> Payments via PayPal are subject to PayPal’s own privacy policy. We receive only the information necessary to identify the payment.
            </p>
          </div>

          {/* 2.4 Newsletter */}
          <h3 className="text-lg font-medium mt-6 mb-3 text-gray-900">2.4 Newsletter</h3>
          <p className="text-sm text-gray-700">
            Your email address is used to send news and offers only if you have provided explicit consent. You can unsubscribe at any time via the link in the email or through your account settings.
          </p>
        </section>

        {/* 3. Credit Control */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">3. Credit Control</h2>
          <p className="text-sm text-gray-700 leading-normal">
            We reserve the right to perform a credit check before manufacturing or delivering your order. For this purpose, necessary data may be transferred to credit reporting agencies (e.g., SCHUFA).
          </p>
        </section>

        {/* 4. Transfer to Third Countries */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">4. Transfer of Data to Third Countries</h2>
          <p className="text-sm text-gray-700 leading-normal">
            We strive to process all data within the EU/EEA. When using global services (e.g., Stripe), data may be transferred to countries outside the EEA. In such cases, we ensure a level of protection comparable to EU standards through Standard Contractual Clauses (SCC).
          </p>
        </section>

        {/* 5. Your Rights */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">5. Your Rights</h2>
          <p className="mb-4 text-sm text-gray-700">
            Under the GDPR, you have the following rights regarding your personal data:
          </p>
          <ul className="list-disc pl-5 mb-6 space-y-3 text-sm text-gray-700">
            <li><strong>Right to access:</strong> You have the right to request information about your stored data and receive a copy (Art. 15 GDPR).</li>
            <li><strong>Right to rectification:</strong> You have the right to request correction of inaccurate or incomplete data (Art. 16 GDPR).</li>
            <li><strong>Right to erasure:</strong> You have the right to request the deletion of your data, provided legal retention periods (like the 10-year tax record requirement) do not apply (Art. 17 GDPR).</li>
            <li><strong>Right to restriction:</strong> You have the right to request the restriction of processing under certain conditions (Art. 18 GDPR).</li>
            <li><strong>Right to data portability:</strong> You have the right to receive your data in a structured, commonly used format (Art. 20 GDPR).</li>
            <li><strong>Right to object:</strong> You have the right to object to the processing of your data based on legitimate interests or for direct marketing purposes (Art. 21 GDPR).</li>
            <li><strong>Right to withdraw consent:</strong> You may withdraw your consent for marketing at any time via the unsubscribe link in our emails or your account settings.</li>
            <li><strong>Right to lodge a complaint:</strong> In accordance with Art. 77 GDPR, you have the right to lodge a complaint with a competent data protection supervisory authority if you believe that the processing of your personal data violates the GDPR.</li>
          </ul>
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 text-sm">
            <p className="font-semibold text-gray-900 mb-2">The competent authority for us is located in the state of Baden-Württemberg:</p>
            <p>Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg</p>
            <p><strong>Address:</strong> Lautenschlagerstraße 20, 70173 Stuttgart, Germany</p>
          </div>
        </section>

        {/* 6. Log Files */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">6. Log Files</h2>
          <p className="mb-3 text-sm text-gray-700">
            When you visit <strong>SignXpert</strong> pages, your browser automatically transfers data that is stored in server log files:
          </p>
          <p className="mb-3 text-sm text-gray-600 italic">
            Date and time of access, page name, IP address, data volume, and browser version.
          </p>
          <p className="text-sm text-gray-700">
            These files are used exclusively to ensure technical security and fix errors. They are accessible only to developers and are automatically deleted after <strong>30 days</strong>. No passwords or sensitive payment details are logged.
          </p>
        </section>

        {/* 7. Secure Data Transfer */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">7. Secure Data Transfer</h2>
          <p className="text-sm text-gray-700 leading-normal">
            Your personal information is securely transmitted using <strong>SSL (Secure Socket Layer)</strong> encryption. This applies to ordering, payment, and customer login. We continuously update our systems to protect your data from unauthorized access or loss.
          </p>
        </section>

        {/* 8. Cookies */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">8. Cookies</h2>
          <p className="mb-4 text-sm text-gray-700">
            We use cookies to improve your experience in accordance with the <em>TDDDG</em> and Art. 6 para. 1 lit. f GDPR.
          </p>
          <div className="space-y-4 text-sm text-gray-700">
            <p>
              <strong>Essential Cookies:</strong> Required for the website to function (e.g., shopping cart).
            </p>
            <p>
              <strong>Analytical and Marketing Cookies (e.g., Google):</strong> Used only with your <em>active consent</em> via the cookie banner.
            </p>
            <p>
              You can change your preferences or withdraw consent at any time by clicking the "Cookie Settings" link at the bottom of any page on the website.
            </p>
          </div>
        </section>
        <div id='cookie' className={styles.term_page_btn}>
          <button onClick={openCookie}>Cookie settings</button>
        </div>
        <br/>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
