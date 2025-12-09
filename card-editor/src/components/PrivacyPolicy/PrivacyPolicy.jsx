import React from 'react';
import { Link } from 'react-router-dom';
import styles from './PrivacyPolicy.module.css';

const PrivacyPolicy = () => {
  return (
    <div className={styles.terms_page}>
      <div className={styles.terms_page_wrapper}>
        <div className={styles.terms_page_title}>
          <h1>Privacy Policy</h1>
        </div>

        <div className={styles.term_page_content}>
          <p>
            Your trust is important to us. To ensure you feel confident when visiting our website,
            we comply with all legal requirements regarding the processing of personal data. Below
            you’ll find information about how we collect, manage, and use your data. This privacy
            policy explains what information we collect, how we process it, and who you can contact
            if you have any questions regarding our data management.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>1. Responsible party</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            The responsible party for the collection, processing, and use of personal data is
            SignXpert, organization number 556756-8760, owner of the SignXpert brand.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            <strong>E-mail:</strong> info@sign-xpert.com
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            <strong>Mail:</strong>
          </p>
          <p>SignXpert</p>
          <p>Baumwiesen 2</p>
          <p>Haigerloch</p>
          <p>72401 Germany</p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            <strong>URL:</strong> https://sign-xpert.com
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            <strong>A contact form is also available on the following page:</strong>{' '}
            https://sign-xpert.com/contact
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>2. Collection, processing and use of personal data</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            We are personally responsible for all information you share directly with us. Personal
            data refers to information that can be traced back to an identifiable person, such as
            name, phone number, address, and email.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            We collect, store, and process your information to handle your order. Personal data will
            only be shared with third parties when permitted by law—for example, for contract
            processing or debt collection—or if you have given prior consent. Your data will not be
            shared with third parties for marketing purposes without your approval.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            To process orders, our service providers (such as logistics companies, payment services,
            and banks) may need access to the information required for fulfilling your order. These
            partners may only use the transmitted data for their assigned tasks.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            We store customer and order information for seven years, in accordance with the Swedish
            Accounting Act.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            We also collect information about your site usage through cookies. For detailed
            information about what we collect and why, see section 8.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>2.1 Registration of customer account and when ordering</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            Visitors who create a customer account receive password-protected access to their stored
            data. You can also view previously placed orders and manage subscriptions.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            To place an order or create a customer account, the following information must be
            provided. This data is required in order for us to fulfill our obligations when
            processing your order:
          </p>
        </div>
        <div className={styles.term_page_content}>
          <ul>
            <li>Your email address</li>
            <li>Your name</li>
            <li>Your address</li>
            <li>Your phone number (used only for delivery notifications on traceable shipments)</li>
            <li>Your password</li>
          </ul>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>2.2 Creation of signs</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            When you design a sign, we save the content you add, along with other necessary
            information required to process your order. We never share sign content with other
            accounts or third parties for marketing purposes.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>2.3 Managing payments</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            You can pay securely by card. Card payments are handled by Adyen B.V. using secure
            encryption and strict banking standards. Your card details are sent directly to Adyen
            B.V. We only have access to the cardholder’s name, card type, the last 4 digits of the
            card number, the IP address used at payment, and transaction details. This information
            is used solely to process refunds or investigate incorrect charges. Only staff
            responsible for such tasks have access to this data.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            PayPal payments are handled by PayPal, who act as the data controller for their own
            processing. We receive necessary information from PayPal to manage payments or
            investigate incorrect transactions. For more details, see PayPal’s Privacy Policy:
            https://www.paypal.com/us/legalhub/paypal/privacy-full
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            For other direct payment methods, and where required, we may handle your email, IP
            address, phone number, account number, and name. For invoice payments, personal data
            included on the invoice is processed and stored according to the Accounting Act
            (1999:1078) and kept for the tax year plus 7 years.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>2.4 Newsletter</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            We use the email address you provide to send you news and offers. Your consent is
            required to subscribe as a private individual. If you no longer wish to receive our
            newsletter, you can unsubscribe via the link in each email, via the contact details in
            section 1, or through the settings in your customer account.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            Your information is not shared with third parties for other purposes and is used solely
            for sending our news, products, and offers.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>2.5 Web tracking</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            We collect information about how you use and navigate our website based on our
            legitimate interest in improving quality. For more information, see section 8.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>2.6 Customer reviews</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            Your contact details may be shared with trusted third parties for the purpose of
            collecting customer reviews, based on our legitimate interest. Your data will not be
            shared with third parties for marketing.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>2.7 Customer service issues</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            When contacting customer service, we process the personal data you provide in order to
            handle your case. Your information will not be used for other purposes and will be
            deleted within 12 months.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>2.8 Social media</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            Personal data shared with us through social media is processed according to each
            platform’s privacy policy. We manage and remove illegal content. If communication on
            social media becomes customer service-related, we handle it according to the policy in
            section 2.7.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>2.9 Competitions</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>For competitions, we use your information solely to announce any winnings.</p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>3. Credit control</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            We reserve the right to perform a credit check before manufacturing or delivering your
            order. For this purpose, personal data necessary for a credit check may be transferred
            to a credit reporting company.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>3.1 Recruitment</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            When applying for a position—either vacant or spontaneously—we collect only the
            information needed to conduct the recruitment process. Your data will not be used for
            other purposes and will be deleted within 24 months unless you have agreed to remain in
            our candidate database.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>4. Transfer of personal data to third countries</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            We strive to process all personal data within the EU/EEA. In some cases, however, data
            may be transferred to or processed in non-EU/EEA countries by one of our suppliers or
            subcontractors. We take all necessary legal, technical, and organizational measures to
            ensure your data is handled securely and with an adequate level of protection comparable
            to EU/EEA standards.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>4.1 Marketing and Profiling</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            To provide the best possible information and offers, we sometimes use customer matching
            for advertising on third-party platforms. Using contact details you have provided (e.g.,
            email or phone number), third parties such as Google or Meta may match your data with
            information they already have. Once matched, you may receive relevant messages or offers
            from us.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>5. Your rights</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            You have the right to access the information we store about you. You can request details
            about all or part of your stored data within a reasonable time and free of charge. To do
            so, contact us using the details in section 1.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            You also have the right to request corrections or deletion of your data. If you object
            to how we collect or use your personal data, you may submit your objection to us in
            writing. You may withdraw your consent to marketing at any time via the unsubscribe link
            in our emails, the contact details in section 1, or your customer account settings.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>6. Log files</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            When you visit Signomatic pages, certain data is automatically transferred by your
            browser and stored in server log files. These records include: date and time of access,
            page name, IP address, data volume transferred, and browser version information. Order
            and customer information may also be logged.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            These log files are used primarily to detect and fix errors. They are accessible only to
            our developers and deleted automatically after 30 days.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>No passwords or sensitive payment details are logged or stored.</p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>7. Secure data transfer</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            Your personal information is securely transmitted through encryption. This applies to
            ordering, payment, and customer login. We use SSL (Secure Socket Layer) encryption. We
            also work continuously to keep our website, systems, and organization protected from
            loss, destruction, unauthorized access, modification, or distribution of your data.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>8. Cookies</h2>
        </div>
        <div className={styles.term_page_content}>
          <p>
            We want you to have the best experience on our website. In accordance with GDPR Article
            6.1.f, we use cookies, analytics tools, and social media plugins. Accepting cookies is
            not required to visit the website, but disabling them may limit certain
            functions—including the ability to place an order.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            Cookies are small text files stored on your device that save certain settings and
            information for communication with our system. They help enable website functionality,
            improve user experience, collect visitor statistics, personalize offers, measure ad
            performance, and support customer service.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            We use both our own cookies and third-party cookies (including Google) for analytics,
            advertising, and personalization.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            Some cookies may share personal data with third parties such as Google, for purposes
            like ad personalization and analytics.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            To comply with the law, we require your active consent before placing any non-essential
            cookies. You can change or withdraw your consent at any time through our cookie
            settings.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            We do not store sensitive or directly identifiable personal information in our own
            cookies.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            If you wish to disable cookies, you can adjust your browser settings or use opt-out
            tools. Note that this must be done on each browser you use. Some website functions may
            stop working if cookies are disabled.
          </p>
        </div>
        <div className={styles.term_page_content}>
          <p>
            You can change your cookie preferences at any time via the “Cookie Settings” link at the
            bottom of the page.
          </p>
        </div>
        <div className={styles.terms_page_subtitle}>
          <h2>8.1 Which cookies are used?</h2>
        </div>
        <div className={styles.term_page_btn}>
          <button>Cookie settings</button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
