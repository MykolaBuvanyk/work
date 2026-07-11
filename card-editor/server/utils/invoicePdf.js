import puppeteer from 'puppeteer';
import { zugferd } from 'node-zugferd';
import { EN16931 } from 'node-zugferd/profile/en16931';
import { t } from '../i18n/index.js';
import { formatMoneyDisplay } from './formatMoneyDisplay.js';

const basicZugferdInvoicer = zugferd({
  profile: EN16931,
  strict: false,
  logger: false,
});

export const generateInvoicePdfBuffer = async ({ order, orderMongo, lang }) => {
  const cartRouter = await import('../router/CartRouter.js');
  const {
    escapeHtml,
    formatInvoiceDate,
    round2,
    toNumber,
    hasContent,
    hasAddressContent,
    buildZugferdInvoiceData,
    buildPdfFooterTemplate,
    INTER_FONT_FACE_CSS,
    waitForPdfFonts,
  } = cartRouter;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    const checkout = orderMongo?.checkout && typeof orderMongo.checkout === 'object'
      ? orderMongo.checkout
      : {};
    const hasSeparateInvoiceAddress =
      typeof checkout?.isInvoiceDifferent === 'boolean'
        ? checkout.isInvoiceDifferent
        : hasAddressContent(checkout?.invoiceAddress);
    const deliveryAddress = checkout?.deliveryAddress && typeof checkout.deliveryAddress === 'object'
      ? checkout.deliveryAddress
      : {};
    const invoiceAddress = hasSeparateInvoiceAddress && checkout?.invoiceAddress && typeof checkout.invoiceAddress === 'object'
      ? checkout.invoiceAddress
      : null;
    const invoiceAddressFromUser = {
      fullName: [order.user?.firstName2, order.user?.surname2].filter(hasContent).join(' '),
      companyName: order.user?.company2,
      address1: order.user?.address4,
      address2: order.user?.address5,
      address3: order.user?.address6,
      town: order.user?.city2,
      postalCode: order.user?.postcode2,
      country: order.user?.country2,
      state: order.user?.state2,
      email: order.user?.eMailInvoice,
      mobile: order.user?.phone2,
    };
    const hasCheckoutInvoiceAddress = hasSeparateInvoiceAddress && hasAddressContent(invoiceAddress);
    const hasUserInvoiceAddress = hasSeparateInvoiceAddress && hasAddressContent(invoiceAddressFromUser);
    const customerAddress = hasCheckoutInvoiceAddress
      ? invoiceAddress
      : hasUserInvoiceAddress
        ? invoiceAddressFromUser
        : deliveryAddress;

    const customerCompany = escapeHtml(customerAddress?.companyName || order.user?.company || '');
    const customerIdentifierRaw = String(order.user?.reference || order.userId || '').trim();
    const customerStreetLine1Raw = String(
      customerAddress?.address1
      || [order.user?.address, order.user?.house].filter(hasContent).join(' ')
      || ''
    ).trim();
    const customerStreetLine2Raw = String(customerAddress?.address2 || order.user?.address2 || '').trim();
    const customerStreetLine3Raw = String(customerAddress?.address3 || order.user?.address3 || '').trim();
    const customerPostalCodeRaw = String(customerAddress?.postalCode || order.user?.postcode || '').trim();
    const customerCityRaw = String(customerAddress?.town || order.user?.city || '').trim();
    const customerCountryRaw = String(customerAddress?.country || order.user?.country || order.country || '').trim();
    const customerCountrySubdivisionRaw = String(customerAddress?.state || order.user?.state || '').trim();
    const customerEmailRaw = String(
      checkout?.invoiceAddressEmail
      || checkout?.invoiceEmail
      || invoiceAddress?.email
      || invoiceAddressFromUser?.email
      || (!hasCheckoutInvoiceAddress && !hasUserInvoiceAddress ? deliveryAddress?.email : '')
      || customerAddress?.email
      || order.user?.eMailInvoice
      || order.user?.email
      || ''
    ).trim();
    const customerVatNumberRaw = String(checkout?.vatNumber || order.user?.vatNumber || '').trim();
    const customerName = escapeHtml(
      customerAddress?.fullName || [order.user?.firstName, order.user?.surname].filter(Boolean).join(' ')
    );
    const addressLine1 = escapeHtml(customerStreetLine1Raw);
    const addressLine2 = escapeHtml(customerStreetLine2Raw);
    const addressLine3 = escapeHtml(customerStreetLine3Raw);
    const cityLine = escapeHtml([customerPostalCodeRaw, customerCityRaw].filter(hasContent).join(' '));
    const countryLine = escapeHtml(customerCountryRaw);
    const vatNumber = escapeHtml(customerVatNumberRaw);

    const invoiceNumberRaw = String(order.id || '');
    const invoiceNumber = escapeHtml(invoiceNumberRaw);
    const orderNumberRaw = String(order?.id || '').trim().padStart(3, '0');
    const orderNumber = escapeHtml(orderNumberRaw);
    const customerNumber = escapeHtml(order.userId);
    const invoiceDate = escapeHtml(formatInvoiceDate(order.createdAt));
    const invoiceDueDateDate = new Date(new Date(order.createdAt).setMonth(new Date(order.createdAt).getMonth() + 1));
    const invoiceDueDate = escapeHtml(formatInvoiceDate(invoiceDueDateDate));
    const selectedPaymentMethod = String(checkout?.paymentMethod || 'invoice').trim().toLowerCase();
    const isPayOnline = selectedPaymentMethod === 'online';
    const paymentStatusRaw = order.user?.type === 'Admin' ? 'Admin' : order.isPaid ? 'Paid' : 'Unpaid';
    const isInvoiceUnpaidCase = selectedPaymentMethod === 'invoice' && paymentStatusRaw === 'Unpaid';
    const shouldRenderPaymentInformation = !isPayOnline && paymentStatusRaw === 'Unpaid';
    const paymentStatus = paymentStatusRaw === 'Paid'
      ? escapeHtml(t('common.statusPaid', lang))
      : paymentStatusRaw === 'Unpaid'
        ? escapeHtml(t('common.statusUnpaid', lang))
        : escapeHtml(paymentStatusRaw);
    const projectNameRaw = String(order.orderName || orderMongo?.projectName || '');
    const projectName = escapeHtml(projectNameRaw);
    const signsCountRaw = Math.max(0, Number(order.signs || 0));
    const signsCount = escapeHtml(signsCountRaw);
    const deliveryLabel = escapeHtml(order?.deliveryType || checkout?.deliveryLabel || '');

    const netAmount = Number.isFinite(Number(order?.netAfterDiscount))
      ? Number(order.netAfterDiscount)
      : Number.isFinite(Number(orderMongo?.price))
        ? Number(orderMongo.price)
        : 0;
    const discountAmount = toNumber(orderMongo?.discountAmount, 0);
    const discountPercent = toNumber(orderMongo?.discountPercent, 0);
    const subtotal = round2(netAmount + discountAmount);
    const checkoutBaseDiscountPercent = toNumber(checkout?.baseDiscountPercent, 0);
    const checkoutCouponDiscountPercent = toNumber(checkout?.coupon?.discount, 0);
    const checkoutCouponDiscountAmount = toNumber(checkout?.coupon?.discountAmount, 0);
    const derivedBaseDiscountPercent = subtotal > 0
      ? Math.round((Math.max(0, discountAmount - checkoutCouponDiscountAmount) / subtotal) * 100)
      : 0;
    const displayDiscountPercent = checkoutCouponDiscountPercent > 0
      ? (checkoutBaseDiscountPercent > 0 ? checkoutBaseDiscountPercent : derivedBaseDiscountPercent) + checkoutCouponDiscountPercent
      : discountPercent;
    const shippingCost = Number.isFinite(Number(checkout?.deliveryPrice))
      ? Number(checkout.deliveryPrice)
      : 0;
    const vatPercent = toNumber(checkout?.vatPercent, 0);
    const totalAmount = Number.isFinite(Number(order?.sum))
      ? Number(order.sum)
      : Number.isFinite(Number(orderMongo?.totalPrice))
        ? Number(orderMongo.totalPrice)
        : round2(netAmount + shippingCost);
    const totalAmountFormatted = formatMoneyDisplay(totalAmount);
    const vatAmount = Number.isFinite(Number(checkout?.vatAmount))
      ? Number(checkout.vatAmount)
      : Math.max(0, round2(totalAmount - netAmount - shippingCost));
    const customerReferenceRaw = String(checkout?.customerReference || '').trim();
    const pdfText = (key, vars) => escapeHtml(t(key, lang, vars));
    const invoiceReferenceLabel = `${pdfText('pdf.invoice.referenceOrderNo')} ${orderNumber}`;
    const logoPng = process.env.VITE_LAYOUT_SERVER + 'images/images/logo.png';

    const htmlContent = `
<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pdfText('pdf.invoice.documentTitle')}</title>
    <style>
      ${INTER_FONT_FACE_CSS}
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
      body {
        font-family: 'Inter', sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
        color: #000;
        font-size: 10.5pt;
        line-height: 1.2;
      }
      .page {
        width: 210mm;
        height: 297mm;
        padding: 10mm 15mm 10mm 15mm;
        margin: 10mm auto;
        background: white;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        position: relative;
        display: flex;
        flex-direction: column;
      }
      @media print { body { background: none; } .page { margin: 0; box-shadow: none; } }
      .nowrap { white-space: nowrap; }
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
      .logo { font-weight: 800; font-size: 22pt; letter-spacing: 0.5px; }
      .logo span { color: #0056b3; }
      .logo-sub { font-size: 7.5pt; display: block; margin-top: -4px; }
      .logo-sub span { background: #1a4a8d; color: white; padding: 0 4px; border-radius: 1px; }
      .invoice-title { font-size: 26pt; font-weight: 700; text-decoration: underline; text-underline-offset: 6px; }
      .info-section { display: flex; margin-bottom: 35px; }
      .address-block { width: 52%; line-height: 1.3; }
      .details-block { width: 48%; padding-left: 35px; }
      .details-table { width: 100%; border-collapse: collapse; }
      .details-table td { padding: 1px 0; vertical-align: top; font-weight: 400; }
      .details-table td:first-child { width: 140px; }
      .details-table td:last-child { width: 95px; text-align: right; white-space: nowrap; }
      .details-table tr:first-child td { font-weight: 700; }
      .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
      .items-table th, .items-table td { border: 0.5pt solid #000; padding: 4px 8px; text-align: left; }
      .items-table th { font-weight: 400; }
      .col-order { width: 12%; }
      .col-desc { width: 68%; }
      .col-total { width: 20%; }
      .items-table th.col-order { white-space: nowrap; }
      .calc-section { display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 25px; }
      .calc-table { width: 38%; border-collapse: collapse; }
      .calc-table td { padding: 2px 0; }
      .calc-table td:last-child { text-align: right; }
      .money-cell { white-space: nowrap; text-align: right; }
      .total-row { border-top: 1px solid #000; font-weight: 700; }
      .payment-info { margin-top: 25px; }
      .payment-info h3 { font-size: 10.5pt; text-decoration: underline; margin-bottom: 5px; font-weight: 700; }
      .payment-grid { display: grid; grid-template-columns: 140px auto; gap: 1px; }
      .payment-value { white-space: nowrap; text-align: left; font-weight: 700; }
      .online-payment-note { margin-top: 15px; font-size: 11px; line-height: 1.25; }
      .svg-logo { display: inline-block; width: 83mm; max-width: 95mm; height: auto; }
      .svg-logo img { width: 100%; height: auto; display:block; }
      .header .logo, .header .logo-sub { display: none; }
      .company-name { font-weight: 400; }
      .online-payment-note .first-line { white-space: nowrap; }
      .footer-col-right div { margin-bottom: 2px; }
      .footer-info-table { border-collapse: collapse; width: 100%; }
      .footer-info-table td { padding: 0 8px 4px 0; vertical-align: top; }
      .footer-info-table td:first-child { white-space: nowrap; width: 66px; }
      .footer-info-table .footer-value-cell { width: 100%; }
      .footer-wrapper { margin-top: auto; margin-bottom: 6mm; }
    </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="svg-logo"><img src="${logoPng}" alt="SignXpert"></div>
        <div class="logo">SIGN<span>X</span>PERT</div>
        <div class="logo-sub">Smart <span>Sign & Label</span> Solution</div>
      </div>
      <div class="invoice-title">${pdfText('pdf.invoice.title')}</div>
    </div>

    <div class="info-section">
      <div class="address-block">
        <span class="company-name">${customerCompany}</span><br>
        ${customerName ? `${customerName}<br>` : ''}
        ${addressLine1 ? `${addressLine1}<br>` : ''}
        ${addressLine2 ? `${addressLine2}<br>` : ''}
        ${addressLine3 ? `${addressLine3}<br>` : ''}
        ${cityLine ? `${cityLine}<br>` : ''}
        ${countryLine ? `${countryLine}<br>` : ''}
      </div>
      <div class="details-block">
        <table class="details-table">
          <tr><td><strong>${pdfText('pdf.invoice.invoiceNoLabel')}</strong></td><td><strong>${invoiceNumber}</strong></td></tr>
          <tr><td>${pdfText('pdf.invoice.customerNoLabel')}</td><td>${customerNumber}</td></tr>
          ${vatNumber ? `<tr><td>${pdfText('common.vatIdLabel')}</td><td>${vatNumber}</td></tr>` : ''}
          <tr><td>${pdfText('pdf.invoice.dateLabel')}</td><td>${invoiceDate}</td></tr>
          ${isInvoiceUnpaidCase
            ? `<tr><td>${pdfText('pdf.invoice.invoiceDueDateLabel')}</td><td>${invoiceDueDate}</td></tr>
            <tr><td>${pdfText('pdf.invoice.paymentTermsLabel')}</td><td>${t('common.thirtyDaysNet', lang)}</td></tr>`
            : `<tr><td>${pdfText('pdf.invoice.paymentStatusLabel')}</td><td>${paymentStatus}</td></tr>`}
            <tr><td>${pdfText('pdf.invoice.paymentReferenceLabel')}</td><td>${invoiceReferenceLabel}</td></tr>
            ${customerReferenceRaw ? `<tr><td>${pdfText('pdf.invoice.customerReferenceLabel')}</td><td>${escapeHtml(customerReferenceRaw)}</td></tr>` : ''}
        </table>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th class="col-order nowrap">${pdfText('pdf.invoice.colOrderNo')}</th>
          <th class="col-desc">${pdfText('pdf.invoice.colDescription')}</th>
          <th class="col-total">${pdfText('pdf.invoice.colNetTotal')}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${invoiceNumber}</td>
          <td>${pdfText('pdf.invoice.countSigns')}${signsCount} (${projectName})</td>
          <td class="money-cell">${formatMoneyDisplay(subtotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="calc-section">
      <table class="calc-table">
        <tr><td>${pdfText('pdf.invoice.subtotalLabel')}</td><td class="money-cell">${formatMoneyDisplay(subtotal)}</td></tr>
        <tr><td>${pdfText('pdf.invoice.discountLabel')} (${displayDiscountPercent.toFixed(0)} %)</td><td class="money-cell">${formatMoneyDisplay(discountAmount)}</td></tr>
        <tr><td>${pdfText('pdf.invoice.shippingAndPackaging')}${deliveryLabel ? ` (${deliveryLabel})` : ''}</td><td class="money-cell">${formatMoneyDisplay(shippingCost)}</td></tr>
        <tr class="total-row">
          <td style="padding-top: 15px; padding-bottom: 6px;"><u>${pdfText('pdf.invoice.totalAmount')}</u></td>
          <td class="money-cell" style="padding-top: 12px; padding-bottom: 6px;">${totalAmountFormatted}</td>
        </tr>
      </table>
    </div>

    ${shouldRenderPaymentInformation ? `
    <div class="payment-info">
      <h3><u>${pdfText('pdf.invoice.paymentInformationHeading')}</u></h3>
      <div class="payment-grid">
        <div>${pdfText('pdf.invoice.amountDue')}</div><div class="payment-value">${totalAmountFormatted}</div>
        <div>${pdfText('pdf.invoice.accountHolder')}</div><div>Kostyantyn Utvenko</div>
        <div>${pdfText('pdf.invoice.ibanLabel')}</div><div>DE78 6535 1260 0134 0819 40</div>
        <div>${pdfText('pdf.invoice.bicSwiftLabel')}</div><div>SOLADES1BAL</div>
        <div>${pdfText('pdf.invoice.paymentReferenceLabel')}</div><div>${invoiceReferenceLabel}</div>
      </div>
    </div>

    <div class="online-payment-note">
      <span class="first-line">${pdfText('pdf.invoice.onlinePaymentLine1')} <span class="nowrap">sign-xpert.com</span></span><br>
      ${pdfText('pdf.invoice.onlinePaymentLine2')} <span class="nowrap">${t('common.myAccountArrowMyOrders', lang)}</span><br>
      ${pdfText('pdf.invoice.onlinePaymentLine3')}
    </div>
    ` : ''}

    <div class="footer-wrapper">
      <div class="footer-thanks" style="text-align:center;margin-bottom:10px;font-weight:700;"><strong>${pdfText('pdf.invoice.footerThanks')}</strong></div>
      <div class="footer-box" style="border:0.5pt solid #000;padding:6px 10px;display:flex;justify-content:space-between;font-size:8pt;line-height:1.05;">
        <div class="footer-col-left">
          <table class="footer-info-table">
            <tr><td><strong>SignXpert</strong></td><td class="footer-value-cell"></td></tr>
            <tr><td>${pdfText('pdf.invoice.footerOwnerLabel')}</td><td class="footer-value-cell">Kostyantyn Utvenko</td></tr>
            <tr><td>${pdfText('pdf.invoice.footerAddressLabel')}</td><td class="footer-value-cell">${pdfText('pdf.invoice.footerAddressValue2')}</td></tr>
            <tr><td>IBAN:</td><td class="footer-value-cell">DE78 6535 1260 0134 0819 40</td></tr>
            <tr><td>BIC / SWIFT:</td><td class="footer-value-cell">SOLADES1BAL</td></tr>
            <tr><td>${pdfText('pdf.invoice.footerUstIdLabel')}</td><td class="footer-value-cell">${pdfText('common.germanVatLine')}</td></tr>
            <tr><td></td><td class="footer-value-cell">${pdfText('common.noVatSmallBusiness')}</td></tr>
          </table>
        </div>
        <div class="footer-col-right" style="text-align:right;display:flex;flex-direction:column;justify-content:flex-end;">
          <div>sign-xpert.com</div>
          <div>info@sign-xpert.com</div>
          <div>+49 157 766 25 125</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await waitForPdfFonts(page);

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: buildPdfFooterTemplate(10, 20, 2),
      margin: { top: '20px', right: '20px', bottom: '28px', left: '20px' },
    });

    const zugferdData = buildZugferdInvoiceData({
      order,
      invoiceNumber: invoiceNumberRaw,
      customerIdentifier: customerIdentifierRaw,
      customerCompany: customerAddress?.companyName || order.user?.company || '',
      customerName: customerAddress?.fullName || [order.user?.firstName, order.user?.surname].filter(Boolean).join(' '),
      customerEmail: customerEmailRaw,
      customerStreetLine1: customerStreetLine1Raw,
      customerStreetLine2: customerStreetLine2Raw,
      customerStreetLine3: customerStreetLine3Raw,
      customerPostalCode: customerPostalCodeRaw,
      customerCity: customerCityRaw,
      customerCountryCode: customerCountryRaw,
      customerCountrySubdivision: customerCountrySubdivisionRaw,
      customerVatNumber: customerVatNumberRaw,
      buyerReference: String(checkout?.customerReference || order.user?.reference || order.userId || order.id || ''),
      // BT-83 / Verwendungszweck must always identify the order, not the buyer's reference.
      remittanceInformation: `${t('pdf.invoice.referenceOrderNo', 'de')} ${orderNumberRaw}`,
      paymentDueDate: invoiceDueDateDate,
      signsCount: signsCountRaw,
      projectName: projectNameRaw,
      subtotal,
      discountAmount,
      shippingCost,
      vatAmount,
      vatPercent,
      totalAmount,
    });

    const invoice = basicZugferdInvoicer.create(zugferdData);
    const zugferdPdf = await invoice.embedInPdf(pdfBuffer, {
      metadata: {
        title: `${t('pdf.invoice.title', lang)} ${invoiceNumber}`,
        subject: `${t('pdf.invoice.title', lang)} ${invoiceNumber}`,
        author: 'SignXpert',
        creator: 'SignXpert backend',
        producer: 'SignXpert backend',
        keywords: ['ZUGFeRD', 'Factur-X', 'Invoice'],
        language: lang,
      },
    });

    return Buffer.from(zugferdPdf);
  } finally {
    if (browser) await browser.close();
  }
};
