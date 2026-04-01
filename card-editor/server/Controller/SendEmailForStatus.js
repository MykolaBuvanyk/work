import ErrorApi from "../error/ErrorApi.js";
import sendEmail from "./utils/sendEmail.js";
import 'dotenv/config'; // для ES модулів
import puppeteer from 'puppeteer';
import { zugferd } from 'node-zugferd';
import { EN16931 } from 'node-zugferd/profile/en16931';
import { 
    escapeHtml, 
    formatInvoiceDate, 
    formatMoney, 
    round2, 
    toNumber, 
    hasContent, 
    hasAddressContent,
    findCartProjectForOrder,
    buildZugferdInvoiceData,
    buildPdfFooterTemplate
} from '../router/CartRouter.js';

const basicZugferdInvoicer = zugferd({
  profile: EN16931,
  // xsd-schema-validator may be unavailable on some deployments.
  strict: false,
  logger: false,
});

const formatDate = (date) => {
  const d = new Date(date);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);

  return `${day}.${month}.${year}`;
};

const parseEmailList = (value) =>
    String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const getInvoiceRecipients = (user) => {
    const seen = new Set();
    const result = [];

    parseEmailList(user?.weWill).forEach((email) => {
        const key = normalizeEmail(email);
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push(email);
    });

    return result;
};

class SendEmailForStatus {
    
    static SendAdminStatusPaid=async(order)=>{
        const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
        const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
      
        const subject=`SignXpert Order Paid – #${String(order.id).padStart(3, '0')} ${nameOrCompany}`;
        const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
        const ADMIN_EMAIL=process.env.ADMIN_EMAIL;

        const messageHtml=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Paid Notification - SignXpert</title>
</head>
<body style="margin: 0; padding: п0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #dddddd; border-radius: 4px; overflow: hidden;">
                    
                    <tr>
                        <td align="center" style="padding: 30px 40px 10px 40px;">
                            <img src="${logoPng}" alt="SignXpert" width="200" style="display: block; border: 0;">
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 20px 40px;">
                            <h2 style="margin: 0; color: #000000; font-size: 20px; font-weight: bold;">Order Paid – #${String(order.id).padStart(3, '0')}</h2>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 10px 60px; color: #000000; font-size: 15px; line-height: 1.6;">
                            
                            <p style="margin: 0 0 20px 0;">Hello,</p>
                            
                            <p style="margin: 0 0 30px 0;">Payment has been received for the following order on SignXpert.</p>
                            
                            <div style="margin: 0 0 30px 0;">
                                <p style="margin: 0 0 5px 0;">Order Number: #${String(order.id).padStart(3, '0')}</p>
                                <p style="margin: 0 0 5px 0;">Customer Name: ${order.user.firstName}</p>
                                <p style="margin: 0 0 5px 0;">Customer Email: ${order.user.email}</p>
                                ${//<p style="margin: 0 0 5px 0;">Payment Method: [${paymentMethod}]</p>
                                ''}
                                <p style="margin: 0 0 5px 0;">Order Total: ${order.sum}</p>
                            </div>

                            <p style="margin: 0 0 30px 0;">The customer completed the payment through their My Orders page.</p>
                            
                            <p style="margin: 0 0 30px 0;">Please proceed with order processing.</p>
                            
                            <p style="margin: 0 0 40px 0; font-style: italic; color: #888; font-size: 14px;">SignXpert System Notification</p>
                            
                            <p style="margin: 0 0 5px 0;">Best regards,</p>
                            <p style="margin: 0 0 40px 0;">SignXpert Team</p>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="padding: 0 60px 40px 60px;">
                            <a href="https://sign-xpert.com" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">sign-xpert.com</a>
                            <a href="mailto:info@sign-xpert.com" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">info@sign-xpert.com</a>
                            <p style="margin: 0; font-size: 14px; color: #000000;">+49 157 766 25 125</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
        sendEmail(ADMIN_EMAIL, messageHtml, subject)
    }

    static SendStatusPaid=async(order)=>{
        const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
        const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
        const user=order.user;
        const subject=`SignXpert - Payment Received  #${String(order.id).padStart(3, '0')} (${nameOrCompany})`;
        const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
      
        const messageHtml=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Received - SignXpert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #dddddd; border-radius: 4px; overflow: hidden;">
                    
                    <tr>
                        <td align="center" style="padding: 30px 40px 10px 40px;">
                            <img src="${logoPng}" alt="SignXpert" width="200" style="display: block; border: 0;">
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 20px 40px;">
                            <h2 style="margin: 0; color: #000000; font-size: 20px; font-weight: normal;">Payment has been received – #${String(order.id).padStart(3, '0')}</h2>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 10px 60px; color: #000000; font-size: 15px; line-height: 1.5;">
                            
                            <p style="margin: 0 0 25px 0;">Hello, ${user.firstName}, ${user.company?`(${user.company})`:''}</p>
                            
                            <p style="margin: 0 0 10px 0;">Thank you for your payment.</p>
                            <p style="margin: 0 0 25px 0;">We have successfully received it for Order #${String(order.id).padStart(3, '0')}.</p>
                            
                            <p style="margin: 0 0 5px 0;">Total amount: <strong>€${order.sum}</strong></p>
                        
                            <p style="margin: 0 0 25px 0;">
                                You can check the detailed status of your order anytime in your account.<br>
                                Simply log in to <a href="${urlFrontend+'account'}" style="color: #0073bc; text-decoration: underline;">My Account</a> &rarr; <a href="${urlFrontend+'account/detail'}" style="color: #0073bc; text-decoration: underline;">My Orders</a>
                            </p>
                            
                            <p style="margin: 40px 0 5px 0;">Best regards,</p>
                            <p style="margin: 0 0 40px 0;">SignXpert Team</p>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="padding: 0 60px 40px 60px;">
                            <a href="https://sign-xpert.com" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">sign-xpert.com</a>
                            <a href="mailto:info@sign-xpert.com" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">info@sign-xpert.com</a>
                            <p style="margin: 0; font-size: 14px; color: #000000;">+49 157 766 25 125</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
        sendEmail(order.user.email, messageHtml, subject)
    }

    static SendUserNewPassword=async(user,newPassword)=>{
        const nameOrCompany=user.company?user.company:user.firstName;
        const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
        const subjectAdmin=`SignXpert - Password Recovery for ${nameOrCompany}`;
        const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
        const messageHtml=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Recovery for SignXpert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #dddddd; border-radius: 4px; overflow: hidden;">
                    
                    <tr>
                        <td align="center" style="padding: 30px 40px 10px 40px;">
                            <img src="${logoPng}" alt="SignXpert" width="200" style="display: block; border: 0;">
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 20px 40px;">
                            <h2 style="margin: 0; color: #000000; font-size: 20px; font-weight: normal;">Password Recovery for SignXpert</h2>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 10px 60px; color: #000000; font-size: 15px; line-height: 1.5;">
                            
                            <p style="margin: 0 0 25px 0;">Hello, ${user.firstName}, ${user.company?`(${user.company})`:''}</p>
                            
                            <p style="margin: 0 0 25px 0;">Customer number: ${String(user.id).padStart(3, '0')}</p>
                            
                            <p style="margin: 0 0 25px 0;">We received a request to reset your password on SignXpert.</p>
                            
                            <p style="margin: 0 0 25px 0;">
                                Your temporary password is:<br>
                                ${newPassword}
                            </p>

                            <p style="margin: 0 0 25px 0;">
                                For security, we recommend changing it to a new password immediately after logging in.<br>
                                Simply log in to <a href="${urlFrontend+'account'}" style="color: #0073bc; text-decoration: underline;">My Account</a> &rarr; <a href="${urlFrontend+'account/detail'}" style="color: #0073bc; text-decoration: underline;">My Details</a> in your account to update your password.
                            </p>
                            
                            <p style="margin: 0 0 25px 0;">If you didn't request a password reset, please ignore this email.</p>
                            
                            <p style="margin: 0 0 35px 0;">Thank you for using SignXpert!</p>
                            
                            <p style="margin: 0 0 5px 0;">Best regards,</p>
                            <p style="margin: 0 0 40px 0;">SignXpert Team</p>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="padding: 0 60px 40px 60px;">
                            <a href="https://sign-xpert.com" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">sign-xpert.com</a>
                            <a href="mailto:info@sign-xpert.com" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">info@sign-xpert.com</a>
                            <p style="margin: 0; font-size: 14px; color: #000000;">+49 157 766 25 125</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
        sendEmail(user.email,messageHtml,subjectAdmin)
    }
    static SendUserRegister=async(user)=>{
        const nameOrCompany=user.company?user.company:user.firstName;
        const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
        const ADMIN_EMAIL=process.env.ADMIN_EMAIL;
        const subjectAdmin=`SignXpert | Cust. ID #${String(user.id).padStart(3, '0')} | New Cust. Reg. ${nameOrCompany}`;
        const currentDate = new Date().toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'long',
  year: 'numeric'
});
        const messageHtmlToAdmin = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Нова реєстрація клієнта</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #dddddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    
                    <tr>
                        <td align="center" style="padding: 30px 40px 10px 40px;">
                            <img src="${logoPng}" alt="SignXpert" width="200" style="display: block; border: 0;">
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 20px 40px;">
                            <h2 style="margin: 0; color: #000000; font-size: 20px; font-weight: bold;">A new customer has registered</h2>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 10px 60px; color: #000000; font-size: 15px; line-height: 1.5;">
                            <p style="margin: 0 0 20px 0;">Hello,</p>
                            <p style="margin: 0 0 25px 0;">A new customer has registered on the SignXpert website.</p>
                            
                            <div style="margin: 0 0 25px 0;">
                                <p style="margin: 0 0 5px 0;">Customer details:</p>
                                <p style="margin: 0 0 5px 0;">Customer number: ${String(user.id).padStart(3, '0')}</p>
                                <p style="margin: 0 0 5px 0;">Name: ${user.firstName} ${user.lastName || ''}</p>
                                <p style="margin: 0 0 5px 0;">Company: ${user.company || '-'}</p>
                                <p style="margin: 0 0 5px 0;">Email: <a href="mailto:${user.email}" style="color: #0073bc; text-decoration: underline;">${user.email}</a></p>
                                <p style="margin: 0 0 5px 0;">Phone: ${user.phone}</p>
                                <p style="margin: 0 0 5px 0;">Country: ${user.country}</p>
                            </div>

                            <p style="margin: 0 0 25px 0;">Registration date: ${currentDate}</p>
                            
                            <div style="margin: 0 0 25px 0;">
                                <p style="margin: 0 0 5px 0; color: #0073bc; font-weight: bold;">Please tell us where you heard about us:</p>
                                <p style="margin: 0;">${user.tellAbout || '------'}</p>
                            </div>
                            
                            <p style="margin: 0 0 25px 0;">You can view the full customer profile in the admin panel.</p>
                            
                            <p style="margin: 0 0 35px 0; font-style: italic; color: #888; font-size: 14px;">SignXpert System Notification</p>
                            
                            <p style="margin: 0 0 5px 0;">Best regards,</p>
                            <p style="margin: 0 0 40px 0;">SignXpert Team</p>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="padding: 0 60px 40px 60px;">
                            <a href="https://sign-xpert.com" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">sign-xpert.com</a>
                            <a href="mailto:info@sign-xpert.com" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">info@sign-xpert.com</a>
                            <p style="margin: 0; font-size: 14px; color: #000000;">+49 157 766 25 125</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
        await sendEmail(ADMIN_EMAIL,messageHtmlToAdmin,subjectAdmin)
    }

    static SendToAdminNewOrder = async (newOrder, comment, countStar, typeDelivery) => {
        try {
            const order=newOrder;
            const orderNumber=String(order.id || '').padStart(3, '0');
            const nameOrCompany = order.user?.company || order.user?.firstName || 'Customer';
            const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
            const subjectAdmin = `SignXpert | New Order #${orderNumber} | Cust. ID #${String(order.user?.id || '').padStart(3, '0')} ${nameOrCompany}`;
            const logoPng = process.env.VITE_LAYOUT_SERVER + 'images/images/logo.png';
            const currentDateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

            const messageHtmlToAdmin = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Order Received</title></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center" style="padding: 20px 0;">
            <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #dddddd; border-radius: 8px; overflow: hidden;">
                <tr><td align="center" style="padding: 30px 40px 10px 40px;"><img src="${logoPng}" width="200"></td></tr>
                <tr><td align="center" style="padding: 10px 40px 20px 40px;"><h2 style="margin: 0; color: #000;">New Order Received #${orderNumber}</h2></td></tr>
                <tr><td style="padding: 0 40px; color: #444; font-size: 15px; line-height: 1.6;">
                    <p>Hello,</p><p>A new order has been placed on the SignXpert website.</p>
                    <div style="margin: 20px 0; border-top: 1px solid #eee; padding-top: 15px;">
                        <p>Order number: <strong>${orderNumber}</strong><br>Order date: <strong>${currentDateStr}</strong></p>
                    </div>
                    <div>
                        <p>Customer details:<br>Name: ${order.user.firstName}<br>Email: ${order.user.email}<br>Phone: ${order.user.phone}</p>
                    </div>
                    <div style="margin: 20px 0; padding: 15px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee;">
                        <p>Total amount: <strong>€${order.sum}</strong></p>
                        <p>Payment status: <strong>€${order.isPaid?'pay':'un paid'}</strong></p>
                        <p>Delivery type: <strong>€${order.deliveryType}</strong></p>
                    </div>
                    <div style="margin: 25px 0;">
                        <p>Rating: <span style="color: #FFD700; font-size: 20px;">${'★'.repeat(countStar || 0)}</span></p>
                        <p>Comment: <span>${comment || '-'}</span></p>
                    </div>
                    <p style="font-style: italic; color: #888;">SignXpert System Notification</p>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>`;

            
            await sendEmail(ADMIN_EMAIL, messageHtmlToAdmin, subjectAdmin);
            return true;
        }
        catch(err){
            console.error('Error in SendToAdminNewOrder Final Step:', err);
            return false;
        }
    }

    static SendEmailWithFile = async (newOrder, textHTML, subject, to) => {
        let browser;
        let outputPdfBuffer = null;
        const order = newOrder; // Для сумісності з логікою з getPdfs3
        const orderNumber = String(order.id).padStart(3, '0');

        try {
            const orderMongo = await findCartProjectForOrder(order);

            // 1. Запуск Puppeteer
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
        
            const checkout = orderMongo?.checkout && typeof orderMongo.checkout === 'object'
                ? orderMongo.checkout
                : {};
            const deliveryAddress = checkout?.deliveryAddress && typeof checkout.deliveryAddress === 'object'
                ? checkout.deliveryAddress
                : {};
            const invoiceAddress = checkout?.invoiceAddress && typeof checkout.invoiceAddress === 'object'
                ? checkout.invoiceAddress
                : null;
            const customerAddress = hasAddressContent(invoiceAddress) ? invoiceAddress : deliveryAddress;
        
            const customerCompany = escapeHtml(
                customerAddress?.companyName || order.user?.company || 'Water Design Solution GmbH'
            );
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
                || deliveryAddress?.email
                || customerAddress?.email
                || order.user?.eMailInvoice
                || order.user?.email
                || ''
            ).trim();
            const customerPhoneRaw = String(
                invoiceAddress?.mobile
                || deliveryAddress?.mobile
                || customerAddress?.mobile
                || order.user?.phone2
                || order.user?.phone
                || ''
            ).trim();
            const customerVatNumberRaw = String(checkout?.vatNumber || order.user?.vatNumber || '').trim();
            const customerName = escapeHtml(
                customerAddress?.fullName || [order.user?.firstName, order.user?.surname].filter(Boolean).join(' ')
            );
            const addressLine1 = escapeHtml(
                [customerStreetLine1Raw, customerStreetLine2Raw, customerStreetLine3Raw]
                .filter(hasContent)
                .join(', ')
            );
            const addressLine2 = escapeHtml(
                [customerPostalCodeRaw, customerCityRaw].filter(hasContent).join(' ')
            );
            const countryLine = escapeHtml(customerCountryRaw);
            const phoneLine = escapeHtml(customerPhoneRaw);
            const vatNumber = escapeHtml(customerVatNumberRaw);
        
            const invoiceNumberRaw = String(order.id || '');
            const invoiceNumber = escapeHtml(invoiceNumberRaw);
            const customerNumber = escapeHtml(order.userId);
            const invoiceDate = escapeHtml(formatInvoiceDate(order.createdAt));
            const invoiceDueDateDate = new Date(new Date(order.createdAt).setMonth(new Date(order.createdAt).getMonth() + 1));
            const invoiceDueDate = escapeHtml(formatInvoiceDate(invoiceDueDateDate));
            const selectedPaymentMethod = String(checkout?.paymentMethod || 'invoice').trim().toLowerCase();
            const isPayOnline = selectedPaymentMethod === 'online';
            const paymentStatusRaw = order.user?.type === 'Admin' ? 'Admin' : order.isPaid ? 'Paid' : 'Unpaid';
            const isInvoiceUnpaidCase = selectedPaymentMethod === 'invoice' && paymentStatusRaw === 'Unpaid';
            const shouldRenderPaymentInformation = !isPayOnline && paymentStatusRaw === 'Unpaid';
            const paymentStatus = escapeHtml(paymentStatusRaw);
            const projectNameRaw = String(order.orderName || orderMongo?.projectName || 'Water Sings 23');
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
            const shippingCost = Number.isFinite(Number(checkout?.deliveryPrice))
                ? Number(checkout.deliveryPrice)
                : 0;
            const vatPercent = toNumber(checkout?.vatPercent, 0);
            const totalAmount = Number.isFinite(Number(order?.sum))
                ? Number(order.sum)
                : Number.isFinite(Number(orderMongo?.totalPrice))
                ? Number(orderMongo.totalPrice)
                : round2(netAmount + shippingCost);
            const totalAmountFormatted = formatMoney(totalAmount);
            const vatAmount = Number.isFinite(Number(checkout?.vatAmount))
                ? Number(checkout.vatAmount)
                : Math.max(0, round2(totalAmount - netAmount - shippingCost));
        
            const taxNoteMarkup = vatPercent > 0
                ? ''
                : `
                <div class="tax-note">
                No VAT is charged according to § 19 UStG.
                </div>`;
        
            const vatIdMarkup = vatNumber ? `<br>VAT ID: ${vatNumber}` : '';
        
            const htmlContent = `
        <!DOCTYPE html>
        <html lang="uk">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoice - SignXpert</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
            <style>
                * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact;
                }
        
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
        
                @media print {
                body { background: none; }
                .page { margin: 0; box-shadow: none; }
                }
        
                .nowrap { white-space: nowrap; }
        
                .header {
                    display: flex;
                    justify-content: space-between;
                align-items: center;
                margin-bottom: 40px;
                }
        
                .logo {
                font-weight: 800;
                font-size: 22pt;
                letter-spacing: 0.5px;
                }
                .logo span { color: #0056b3; }
                .logo-sub {
                font-size: 7.5pt;
                    display: block;
                margin-top: -4px;
                }
                .logo-sub span {
                background: #1a4a8d;
                color: white;
                padding: 0 4px;
                border-radius: 1px;
                }
        
                .invoice-title {
                font-size: 26pt;
                font-weight: 700;
                    text-decoration: underline;
                text-underline-offset: 6px;
                }
        
                .info-section {
                    display: flex;
                margin-bottom: 35px;
                }
        
                .address-block { width: 52%; line-height: 1.3; }
        
                .details-block {
                width: 48%;
                padding-left: 35px;
                }
        
                .details-table {
                    border-collapse: collapse;
                }
                .details-table td {
                padding: 1px 0;
                vertical-align: top;
                font-weight: 400;
                }
                .details-table td:first-child { width: 140px; }
                .details-table tr:first-child td { font-weight: 700; }
        
                .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
                }
        
                .items-table th,
                .items-table td {
                border: 0.5pt solid #000;
                padding: 4px 8px;
                    text-align: left;
                }
                .items-table th { font-weight: 400; }
                .col-order { width: 12%; }
                .col-desc { width: 68%; }
                .col-total { width: 20%; }
                .items-table th.col-order { white-space: nowrap; }
        
                .calc-section {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                margin-bottom: 25px;
                }
        
                .calc-table {
                width: 38%;
                    border-collapse: collapse;
                }
                .calc-table td { padding: 2px 0; }
                .calc-table td:last-child { text-align: right; }
                .money-cell {
                white-space: nowrap;
                text-align: right;
                }
                .total-row {
                border-top: 1px solid #000;
                font-weight: 700;
                }
        
                .tax-note {
                font-size: 8.5pt;
                margin-top: 16px;
                text-align: left;
                width: 38%;
                align-self: flex-end;
                line-height: 1.1;
                }
        
                .payment-info { margin-top: 25px; }
                .payment-info h3 {
                font-size: 10.5pt;
                text-decoration: underline;
                margin-bottom: 5px;
                font-weight: 700;
                }
                .payment-grid { display: grid; grid-template-columns: 140px auto; gap: 1px; }
                .payment-value {
                white-space: nowrap;
                text-align: left;
                font-weight: 700;
                }
        
                .online-payment-note {
                margin-top: 15px;
                font-size: 11px;
                line-height: 1.25;
                }
        
                .svg-logo {
                display: inline-block;
                width: 78mm;
                max-width: 95mm;
                height: auto;
                }
                .svg-logo svg { width: 100%; height: auto; display:block; }
        
                .header .logo, .header .logo-sub { display: none; }
                .company-name { font-weight: 400; }
                .online-payment-note .first-line { white-space: nowrap; }
                .footer-col-right div { margin-bottom: 2px; }
                .footer-info-table {
                border-collapse: collapse;
                width: 100%;
                }
                .footer-info-table td {
                padding: 0 8px 4px 0;
                vertical-align: top;
                }
                .footer-info-table td:first-child {
                white-space: nowrap;
                width: 66px;
                }
                .footer-info-table .footer-value-cell {
                width: 100%;
                }
        
                .footer-wrapper {
                margin-top: auto;
                margin-bottom: 6mm;
                }
            </style>
        </head>
        <body>
        
            <div class="page">
            <div class="header">
                <div>
                    <div class="svg-logo">
        <svg width="279" height="71" viewBox="0 0 279 71" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M118.876 48.2324H2.61572V49.0686H118.876V48.2324Z" fill="#006CA4"/>
        <path d="M146.84 2.22474H275.735V1.4043H147.078L146.84 2.22474Z" fill="#006CA4"/>
        <path d="M18.4361 30.9404C18.4361 30.1673 18.1983 29.5047 17.7227 28.9524C17.2472 28.4002 16.296 28.0058 14.8693 27.7533L11.4611 27.1064C8.7028 26.6016 6.62615 25.7653 5.23115 24.5978C3.83615 23.4302 3.13865 21.7104 3.13865 19.4384C3.13865 17.7502 3.56667 16.3302 4.42269 15.1784C5.27871 14.0267 6.48348 13.1431 8.03701 12.5593C9.59053 11.9598 11.3977 11.6758 13.4585 11.6758C15.7095 11.6758 17.5642 11.9913 19.0068 12.6224C20.4493 13.2536 21.5431 14.1056 22.3199 15.21C23.0808 16.3144 23.5564 17.5609 23.7625 18.9967L18.2459 19.6909C17.9288 18.4918 17.4216 17.5924 16.7399 17.0402C16.0424 16.4722 14.9327 16.1882 13.3792 16.1882C11.7306 16.1882 10.5575 16.4722 9.86002 17.0244C9.16252 17.5767 8.81377 18.2867 8.81377 19.1544C8.81377 20.0222 9.08326 20.6849 9.60638 21.1424C10.1454 21.6 11.0648 21.9629 12.4122 22.2311L15.979 22.9253C18.8641 23.4776 20.9566 24.3611 22.2723 25.576C23.5881 26.7909 24.238 28.5107 24.238 30.7353C24.238 33.1651 23.3503 35.1373 21.5907 36.6047C19.8152 38.0878 17.1996 38.8293 13.7438 38.8293C10.4307 38.8293 7.81507 38.1351 5.89695 36.7309C3.97882 35.3267 2.90087 33.1809 2.66309 30.262H4.56536H8.3382C8.56013 31.6662 9.11496 32.6918 10.0344 33.3387C10.938 33.9856 12.2696 34.3169 14.0133 34.3169C15.6778 34.3169 16.8509 34.0013 17.5167 33.3702C18.1032 32.7076 18.4361 31.9187 18.4361 30.9404Z" fill="#262626"/>
        <path d="M35.0649 12.3228H40.7718V38.151H35.0649V12.3228Z" fill="#262626"/>
        <path d="M51.7734 25.3078C51.7734 22.5624 52.249 20.1642 53.216 18.1289C54.1671 16.0936 55.578 14.5 57.4168 13.3798C59.2557 12.2438 61.4909 11.6758 64.1065 11.6758C67.1818 11.6758 69.6072 12.3858 71.3668 13.8216C73.1423 15.2573 74.252 17.2138 74.7117 19.6909L69.0366 20.3062C68.7195 19.1071 68.1964 18.1604 67.4672 17.482C66.738 16.8036 65.5966 16.4722 64.0589 16.4722C62.5371 16.4722 61.3007 16.8509 60.3654 17.5924C59.4301 18.334 58.7484 19.3596 58.3363 20.6691C57.9083 21.9787 57.7022 23.4776 57.7022 25.1973C57.7022 28.0216 58.257 30.1831 59.3667 31.7136C60.4763 33.2282 62.2518 33.9856 64.6772 33.9856C66.6904 33.9856 68.3866 33.5596 69.7658 32.7233V28.4949H64.7089V23.9667H75.108V35.2478C73.7288 36.3996 72.0961 37.2831 70.2096 37.8827C68.3232 38.4822 66.4051 38.782 64.4711 38.782C60.4288 38.782 57.3059 37.5987 55.1024 35.2636C52.8831 32.9127 51.7734 29.5993 51.7734 25.3078Z" fill="#262626"/>
        <path d="M86.6011 12.3228H91.7214L102.548 29.2839V12.3228H107.922V38.151H102.881L91.975 21.2214V38.151H86.6011V12.3228Z" fill="#262626"/>
        <path d="M165.751 12.3228H175.088C177.577 12.3228 179.575 12.6699 181.049 13.3483C182.523 14.0425 183.585 15.005 184.251 16.2356C184.901 17.4821 185.234 18.9494 185.234 20.6376C185.234 22.3732 184.901 23.8879 184.235 25.1816C183.569 26.4754 182.491 27.4694 181.017 28.1794C179.543 28.8894 177.577 29.2523 175.136 29.2523H171.284V38.151H165.767V12.3228H165.751ZM179.876 20.7165C179.876 19.3912 179.543 18.413 178.861 17.7976C178.18 17.1823 176.927 16.8825 175.088 16.8825H171.268V24.6925H175.12C176.991 24.6925 178.243 24.3454 178.893 23.667C179.559 22.9728 179.876 21.9945 179.876 20.7165Z" fill="#262626"/>
        <path d="M195.442 12.3228H213.435V16.9141H201.086V22.6572H212.721V27.2485H201.086V33.5439H214.164L213.577 38.1352H195.442V12.3228Z" fill="#262626"/>
        <path d="M224.817 12.3228H234.598C237.039 12.3228 239.005 12.6541 240.463 13.3325C241.921 14.011 242.984 14.9419 243.649 16.141C244.299 17.3401 244.632 18.697 244.632 20.2116C244.632 21.8525 244.299 23.2725 243.618 24.4716C242.936 25.6708 241.89 26.649 240.495 27.359L245.916 38.1352H239.924L235.374 28.5896C235.184 28.5896 234.994 28.5896 234.788 28.6054C234.598 28.6212 234.408 28.6212 234.201 28.6212H230.27V38.1352H224.817V12.3228ZM239.1 20.3852C239.1 19.1861 238.751 18.271 238.054 17.6556C237.356 17.0403 236.072 16.7405 234.233 16.7405H230.27V24.2665H234.455C236.246 24.2665 237.467 23.9352 238.133 23.2725C238.783 22.5941 239.1 21.6474 239.1 20.3852Z" fill="#262626"/>
        <path d="M262.038 17.277H254.112V12.3228H275.734V17.277H267.776V38.151H262.038V17.277Z" fill="#262626"/>
        <path d="M140.515 24.4714L135.727 31.4136L123.553 49.069H113.978L130.94 24.4714L122.903 12.8116L119.748 8.23607H129.323L132.478 12.8116L135.727 17.5292L140.515 24.4714ZM137.392 33.8119L140.863 38.8607H150.438L142.179 26.8696L137.392 33.8119ZM156.415 1.4043H146.84L137.376 15.131L142.163 22.0732L156.415 1.4043Z" fill="#006CA4"/>
        <path d="M37.9028 8.17296L34.1617 1.4043L30.5474 5.68008L37.9028 8.17296Z" fill="#006CA4"/>
        <path d="M186.708 69.4222H66.9282C62.3628 69.4222 58.6533 65.7302 58.6533 61.1862C58.6533 56.6422 62.3628 52.9502 66.9282 52.9502H186.708C191.273 52.9502 194.983 56.6422 194.983 61.1862C194.983 65.7302 191.273 69.4222 186.708 69.4222Z" fill="#006CA4"/>
        <path d="M7.70441 65.2573C7.08617 65.2573 6.54719 65.1468 6.08748 64.9417C5.62776 64.7366 5.26316 64.4526 4.99367 64.0897C4.72418 63.7268 4.58151 63.3008 4.5498 62.8117H5.43753C5.46924 63.1746 5.59606 63.4744 5.80213 63.7268C6.00821 63.9793 6.2777 64.1528 6.6106 64.2948C6.9435 64.421 7.3081 64.4841 7.70441 64.4841C8.16412 64.4841 8.56043 64.4053 8.90918 64.2633C9.25793 64.1055 9.52742 63.9004 9.7335 63.6321C9.93958 63.3639 10.0347 63.0484 10.0347 62.6855C10.0347 62.3857 9.95543 62.1333 9.79691 61.9281C9.63838 61.723 9.41645 61.5495 9.13111 61.4075C8.84577 61.2655 8.51287 61.1393 8.13242 61.0288L7.05446 60.7133C6.34111 60.4766 5.77043 60.1926 5.37412 59.7981C4.97782 59.4037 4.78759 58.9461 4.78759 58.3781C4.78759 57.889 4.91441 57.4473 5.1839 57.0844C5.45338 56.7057 5.80213 56.4217 6.26185 56.2008C6.72157 55.9957 7.22884 55.8853 7.78367 55.8853C8.35435 55.8853 8.86162 55.9957 9.30549 56.2008C9.74935 56.4059 10.0981 56.7057 10.3517 57.0686C10.6054 57.4315 10.748 57.8417 10.7639 58.315H9.92373C9.87617 57.8101 9.65424 57.4157 9.25793 57.1159C8.86162 56.8161 8.3702 56.6741 7.76782 56.6741C7.35566 56.6741 6.9752 56.753 6.65816 56.895C6.34111 57.037 6.08748 57.2421 5.9131 57.4946C5.73873 57.747 5.64361 58.031 5.64361 58.3624C5.64361 58.6779 5.73873 58.9304 5.9131 59.1513C6.08748 59.3721 6.32526 59.5299 6.59475 59.6719C6.88009 59.7666 7.14958 59.877 7.45077 59.9559L8.40191 60.2241C8.7031 60.303 8.98844 60.4135 9.28963 60.5397C9.59083 60.6659 9.84446 60.8237 10.0981 61.013C10.3359 61.2024 10.5261 61.439 10.6846 61.7073C10.8273 61.9755 10.9066 62.3068 10.9066 62.6697C10.9066 63.1588 10.7797 63.6006 10.5261 63.9793C10.2566 64.3895 9.89202 64.6893 9.41645 64.9101C8.94088 65.1468 8.3702 65.2573 7.70441 65.2573Z" fill="#262626"/>
        <path d="M16.9619 65.0994V58.2834H17.7704V59.8454H17.6753C17.7704 59.4668 17.9131 59.1512 18.135 58.8988C18.3411 58.6463 18.5947 58.4728 18.8642 58.3466C19.1495 58.2203 19.4349 58.1572 19.7202 58.1572C20.2275 58.1572 20.6396 58.315 20.9567 58.6148C21.2896 58.9303 21.4957 59.3406 21.5749 59.8612H21.4481C21.5274 59.5141 21.67 59.1986 21.892 58.9461C22.0981 58.6937 22.3675 58.4886 22.6687 58.3623C22.9699 58.2203 23.3028 58.1572 23.6674 58.1572C24.0796 58.1572 24.4442 58.2519 24.7612 58.4254C25.0783 58.599 25.3319 58.8672 25.5221 59.2143C25.7124 59.5614 25.8075 59.9874 25.8075 60.5081V65.0994H24.9832V60.5239C24.9832 59.9717 24.8405 59.5772 24.5393 59.309C24.2381 59.0566 23.8894 58.9146 23.4613 58.9146C23.1284 58.9146 22.8431 58.9777 22.5895 59.1197C22.3358 59.2617 22.1456 59.451 22.0029 59.7034C21.8603 59.9559 21.7969 60.2557 21.7969 60.587V65.0837H20.9725V60.445C20.9725 59.9717 20.8299 59.593 20.5604 59.3248C20.2909 59.0566 19.9263 58.9146 19.4983 58.9146C19.1971 58.9146 18.9117 58.9934 18.6581 59.1354C18.4045 59.2774 18.1984 59.4826 18.0399 59.7508C17.8813 60.019 17.8021 60.3346 17.8021 60.7132V65.0994H16.9619Z" fill="#262626"/>
        <path d="M33.94 65.2571C33.5278 65.2571 33.1474 65.1782 32.7986 65.0204C32.4499 64.8626 32.1804 64.626 31.9902 64.3104C31.7841 63.9949 31.689 63.632 31.689 63.1902C31.689 62.8589 31.7524 62.5749 31.8792 62.3382C32.006 62.1015 32.1804 61.9122 32.4182 61.7702C32.656 61.6282 32.9413 61.502 33.2583 61.4231C33.5754 61.3442 33.94 61.2653 34.3204 61.218C34.7009 61.1706 35.0179 61.1233 35.2874 61.0917C35.5569 61.0602 35.763 60.9971 35.8898 60.9182C36.0325 60.8393 36.0959 60.7131 36.0959 60.5395V60.3817C36.0959 60.082 36.0325 59.8137 35.9057 59.5929C35.7789 59.372 35.6045 59.1984 35.3667 59.088C35.1289 58.9775 34.8436 58.9144 34.4948 58.9144C34.1778 58.9144 33.8924 58.9617 33.6388 59.0564C33.401 59.1511 33.1949 59.2931 33.0364 59.4509C32.8779 59.6086 32.7511 59.7822 32.6718 59.9715L31.8792 59.7033C32.0377 59.3404 32.2438 59.0406 32.5133 58.8197C32.7828 58.5989 33.0998 58.4253 33.4327 58.3306C33.7815 58.2202 34.1302 58.1729 34.479 58.1729C34.7485 58.1729 35.0338 58.2044 35.3191 58.2833C35.6045 58.3464 35.874 58.4726 36.1118 58.6462C36.3495 58.8197 36.5556 59.0406 36.7141 59.3404C36.8727 59.6402 36.9361 60.0031 36.9361 60.4606V65.0993H36.1276V64.0264H36.0642C35.9691 64.2315 35.8264 64.4366 35.6362 64.626C35.446 64.8153 35.2082 64.9731 34.9228 65.0835C34.6375 65.194 34.3046 65.2571 33.94 65.2571ZM34.051 64.5155C34.4631 64.5155 34.8277 64.4209 35.1289 64.2473C35.4301 64.058 35.6679 63.8213 35.8423 63.5057C36.0166 63.1902 36.0959 62.8589 36.0959 62.4802V61.502C36.0325 61.5651 35.9374 61.6124 35.7947 61.6597C35.652 61.7071 35.4935 61.7386 35.3191 61.7702C35.1448 61.8017 34.9545 61.8333 34.7802 61.8491C34.6058 61.8806 34.4473 61.8964 34.3046 61.9122C33.9241 61.9595 33.5912 62.0226 33.3218 62.1331C33.0523 62.2277 32.8462 62.3697 32.7035 62.5433C32.5608 62.7169 32.4974 62.9377 32.4974 63.206C32.4974 63.4742 32.5608 63.7109 32.7035 63.9002C32.8462 64.0895 33.0206 64.2315 33.2583 64.342C33.4961 64.4524 33.7656 64.5155 34.051 64.5155Z" fill="#262626"/>
        <path d="M43.2451 65.0991V58.2831H44.0536V59.3403H44.117C44.2597 58.9931 44.4974 58.7091 44.8303 58.504C45.1632 58.2989 45.5437 58.1885 45.9876 58.1885C46.051 58.1885 46.1302 58.1885 46.2095 58.1885C46.2888 58.1885 46.3522 58.1885 46.4156 58.2043V59.0405C46.3839 59.0405 46.3205 59.0247 46.2253 59.0089C46.1302 58.9931 46.0351 58.9931 45.9241 58.9931C45.5754 58.9931 45.2584 59.072 44.973 59.214C44.6877 59.356 44.4816 59.5611 44.3231 59.8294C44.1645 60.0818 44.0853 60.3816 44.0853 60.7287V65.0991H43.2451Z" fill="#262626"/>
        <path d="M54.2944 58.2833V59.0091H51.0288V58.2833H54.2944ZM52.0434 56.6582H52.8835V63.49C52.8835 63.8213 52.9628 64.0738 53.1055 64.2315C53.264 64.3893 53.4859 64.4524 53.803 64.4209C53.8664 64.4209 53.9298 64.4209 54.009 64.4051C54.0883 64.3893 54.1676 64.3735 54.2468 64.3578L54.4212 65.0678C54.3261 65.0993 54.231 65.1151 54.12 65.1309C54.009 65.1466 53.8981 65.1624 53.7871 65.1624C53.2323 65.194 52.8043 65.0678 52.5031 64.768C52.2019 64.4682 52.0434 64.058 52.0434 63.5373V56.6582Z" fill="#262626"/>
        <path d="M70.6063 65.2571C69.988 65.2571 69.449 65.1467 68.9893 64.9415C68.5296 64.7364 68.165 64.4524 67.8955 64.0895C67.626 63.7267 67.4834 63.3007 67.4517 62.8115H68.3394C68.3711 63.1744 68.4979 63.4742 68.704 63.7267C68.9101 63.9791 69.1796 64.1527 69.5125 64.2947C69.8454 64.4209 70.21 64.484 70.6063 64.484C71.066 64.484 71.4623 64.4051 71.811 64.2631C72.1598 64.1053 72.4293 63.9002 72.6354 63.632C72.8414 63.3638 72.9365 63.0482 72.9365 62.6853C72.9365 62.3855 72.8573 62.1331 72.6988 61.928C72.5402 61.7229 72.3183 61.5493 72.033 61.4073C71.7476 61.2653 71.4147 61.1391 71.0343 61.0287L69.9563 60.7131C69.2271 60.508 68.6723 60.2082 68.276 59.8295C67.8797 59.4509 67.6894 58.9618 67.6894 58.3938C67.6894 57.9047 67.8163 57.4629 68.0858 57.1C68.3552 56.7213 68.704 56.4373 69.1637 56.2164C69.6234 56.0113 70.1307 55.9009 70.6855 55.9009C71.2562 55.9009 71.7635 56.0113 72.2073 56.2164C72.6512 56.4215 73 56.7213 73.2536 57.0842C73.5072 57.4471 73.6499 57.8573 73.6658 58.3307H72.8097C72.7622 57.8258 72.5402 57.4313 72.1439 57.1315C71.7476 56.8318 71.2562 56.6898 70.6538 56.6898C70.2417 56.6898 69.8612 56.7687 69.5442 56.9107C69.2271 57.0527 68.9735 57.2578 68.7991 57.5102C68.6247 57.7627 68.5296 58.0467 68.5296 58.378C68.5296 58.6935 68.6247 58.946 68.7991 59.1669C68.9735 59.3878 69.2113 59.5455 69.4808 59.6875C69.7661 59.8295 70.0356 59.94 70.3368 60.0189L71.2879 60.2871C71.5891 60.366 71.8744 60.4764 72.1756 60.6027C72.4768 60.7289 72.7305 60.8867 72.9841 61.076C73.2219 61.2653 73.4121 61.502 73.5706 61.7702C73.7133 62.0384 73.7926 62.3698 73.7926 62.7327C73.7926 63.2218 73.6658 63.6635 73.4121 64.0422C73.1585 64.4367 72.7939 64.7364 72.3183 64.9573C71.8269 65.1467 71.2562 65.2571 70.6063 65.2571Z" fill="white"/>
        <path d="M80.2601 57.0211C80.1016 57.0211 79.9589 56.958 79.8321 56.8475C79.7053 56.7371 79.6577 56.5951 79.6577 56.4373C79.6577 56.2795 79.7211 56.1375 79.8321 56.0271C79.9589 55.9166 80.1016 55.8535 80.2601 55.8535C80.4345 55.8535 80.5771 55.9166 80.6881 56.0271C80.7991 56.1375 80.8625 56.2795 80.8625 56.4373C80.8625 56.5951 80.7991 56.7371 80.6881 56.8475C80.5771 56.958 80.4345 57.0211 80.2601 57.0211ZM79.8479 65.0993V58.2833H80.6881V65.0993H79.8479Z" fill="white"/>
        <path d="M89.613 67.7971C89.1533 67.7971 88.7411 67.734 88.3765 67.6236C88.0278 67.4974 87.7266 67.3396 87.4888 67.1345C87.251 66.9294 87.0608 66.6927 86.9181 66.4245L87.5998 66.0143C87.6949 66.1878 87.8375 66.3614 87.9961 66.5191C88.1546 66.6769 88.3765 66.8189 88.6302 66.9136C88.8997 67.024 89.2167 67.0714 89.5972 67.0714C90.1995 67.0714 90.691 66.9294 91.0556 66.6296C91.4202 66.3298 91.6104 65.8723 91.6104 65.2411V63.7107H91.5311C91.436 63.9158 91.3092 64.1367 91.1348 64.3418C90.9605 64.5469 90.7385 64.7205 90.4532 64.8467C90.1678 64.9729 89.8349 65.036 89.4228 65.036C88.8838 65.036 88.3924 64.9098 87.9644 64.6416C87.5364 64.3734 87.2035 63.9947 86.9657 63.4898C86.7279 62.9849 86.6011 62.3854 86.6011 61.6911C86.6011 60.9969 86.712 60.3816 86.9498 59.8609C87.1876 59.3403 87.5205 58.93 87.9485 58.6303C88.3765 58.3305 88.8679 58.1885 89.4228 58.1885C89.8349 58.1885 90.1837 58.2674 90.469 58.4094C90.7544 58.5514 90.9763 58.7407 91.1348 58.9616C91.2933 59.1825 91.436 59.3876 91.5311 59.5927H91.6104V58.2831H92.4189V65.2727C92.4189 65.8565 92.292 66.3298 92.0543 66.7085C91.8165 67.0871 91.4677 67.3554 91.0397 67.5447C90.6593 67.7025 90.1678 67.7971 89.613 67.7971ZM89.5654 64.2787C90.0093 64.2787 90.3739 64.1683 90.691 63.9631C90.9922 63.758 91.2299 63.4583 91.4043 63.0638C91.5628 62.6694 91.6421 62.196 91.6421 61.6596C91.6421 61.1389 91.5628 60.6656 91.4043 60.2554C91.2458 59.8451 91.008 59.5296 90.7068 59.2929C90.4056 59.0563 90.0252 58.9458 89.5813 58.9458C89.1374 58.9458 88.757 59.072 88.4399 59.3087C88.1229 59.5454 87.901 59.8767 87.7266 60.2869C87.5681 60.6971 87.4888 61.1547 87.4888 61.6596C87.4888 62.1803 87.5681 62.6378 87.7266 63.0323C87.8851 63.4267 88.1229 63.7423 88.4399 63.9474C88.7411 64.1683 89.1216 64.2787 89.5654 64.2787Z" fill="white"/>
        <path d="M99.616 60.8553V65.1153H98.7759V58.2993H99.5843V59.8928H99.4575C99.6478 59.2933 99.9331 58.8673 100.345 58.599C100.742 58.3308 101.201 58.2046 101.724 58.2046C102.184 58.2046 102.596 58.2993 102.945 58.4886C103.294 58.6779 103.563 58.9619 103.769 59.3406C103.96 59.7193 104.071 60.161 104.071 60.7133V65.131H103.246V60.7448C103.246 60.1926 103.088 59.7508 102.771 59.4195C102.454 59.0881 102.041 58.9304 101.502 58.9304C101.138 58.9304 100.821 59.0093 100.535 59.167C100.25 59.3248 100.028 59.5457 99.8538 59.8297C99.6953 60.1137 99.616 60.4608 99.616 60.8553Z" fill="white"/>
        <path d="M120.572 65.2255C120.018 65.2255 119.526 65.1151 119.098 64.8942C118.67 64.6733 118.353 64.3735 118.115 64.0107C117.878 63.6478 117.767 63.2218 117.767 62.7642C117.767 62.4013 117.83 62.0858 117.973 61.8175C118.115 61.5493 118.321 61.2811 118.591 61.0287C118.86 60.7762 119.177 60.5238 119.558 60.2398L120.905 59.2458C121.08 59.1195 121.238 58.9775 121.381 58.8513C121.524 58.7251 121.65 58.5515 121.73 58.378C121.825 58.2044 121.856 58.0151 121.856 57.7942C121.856 57.4471 121.746 57.1631 121.524 56.958C121.302 56.7529 121 56.6267 120.636 56.6267C120.382 56.6267 120.144 56.674 119.954 56.7844C119.748 56.8949 119.59 57.0369 119.479 57.2262C119.368 57.4155 119.304 57.6364 119.304 57.8889C119.304 58.1098 119.352 58.3307 119.447 58.5358C119.542 58.7409 119.685 58.946 119.875 59.1827C120.065 59.4193 120.271 59.6718 120.509 59.9715L124.678 65.0993H123.679L120.033 60.6658C119.716 60.2871 119.447 59.9558 119.209 59.656C118.971 59.372 118.781 59.088 118.654 58.804C118.528 58.52 118.464 58.2202 118.464 57.9047C118.464 57.5102 118.559 57.1631 118.734 56.8633C118.908 56.5635 119.162 56.3269 119.494 56.1533C119.812 55.9798 120.192 55.9009 120.604 55.9009C121.032 55.9009 121.397 55.9798 121.698 56.1533C122.015 56.3269 122.253 56.5478 122.427 56.8318C122.602 57.1158 122.681 57.4471 122.681 57.7942C122.681 58.0624 122.633 58.3149 122.538 58.5358C122.443 58.7567 122.3 58.9933 122.11 59.1984C121.92 59.4035 121.698 59.6087 121.444 59.798L119.78 61.0287C119.352 61.3442 119.051 61.644 118.876 61.9122C118.702 62.1804 118.607 62.4644 118.607 62.7642C118.607 63.0955 118.686 63.3795 118.845 63.632C119.003 63.8844 119.241 64.0895 119.526 64.2315C119.812 64.3735 120.144 64.4524 120.509 64.4524C120.905 64.4524 121.27 64.3735 121.619 64.2315C121.967 64.0895 122.269 63.8687 122.538 63.5847C122.808 63.3007 123.014 62.9693 123.172 62.5907C123.331 62.1962 123.426 61.7702 123.458 61.2969L124.266 61.3127C124.25 61.8018 124.187 62.212 124.06 62.5433C123.949 62.8904 123.806 63.1744 123.648 63.3953C123.489 63.6162 123.347 63.8055 123.236 63.9475L123.061 64.1684C122.792 64.484 122.427 64.7364 121.983 64.9258C121.539 65.1309 121.08 65.2255 120.572 65.2255Z" fill="white"/>
        <path d="M138.089 65.0992V56.0112H138.961V64.3261H143.305V65.0992H138.089Z" fill="white"/>
        <path d="M151.041 65.2571C150.628 65.2571 150.248 65.1782 149.899 65.0204C149.55 64.8626 149.281 64.626 149.091 64.3104C148.885 63.9949 148.79 63.632 148.79 63.1902C148.79 62.8589 148.853 62.5749 148.98 62.3382C149.107 62.1015 149.281 61.9122 149.519 61.7702C149.757 61.6282 150.042 61.502 150.359 61.4231C150.676 61.3442 151.041 61.2653 151.421 61.218C151.801 61.1706 152.119 61.1233 152.388 61.0917C152.658 61.0602 152.864 60.9971 152.99 60.9182C153.133 60.8393 153.196 60.7131 153.196 60.5395V60.3817C153.196 60.082 153.133 59.8137 153.006 59.5929C152.879 59.372 152.705 59.1984 152.467 59.088C152.229 58.9775 151.944 58.9144 151.595 58.9144C151.278 58.9144 150.993 58.9617 150.739 59.0564C150.502 59.1511 150.296 59.2931 150.137 59.4509C149.978 59.6086 149.852 59.7822 149.772 59.9715L148.98 59.7033C149.138 59.3404 149.344 59.0406 149.614 58.8197C149.883 58.5989 150.2 58.4253 150.533 58.3306C150.882 58.2202 151.231 58.1729 151.58 58.1729C151.849 58.1729 152.134 58.2044 152.42 58.2833C152.705 58.3464 152.975 58.4726 153.212 58.6462C153.45 58.8197 153.656 59.0406 153.815 59.3404C153.973 59.6402 154.037 60.0031 154.037 60.4606V65.0993H153.228V64.0264H153.165C153.07 64.2315 152.927 64.4366 152.737 64.626C152.547 64.8153 152.309 64.9731 152.023 65.0835C151.738 65.194 151.421 65.2571 151.041 65.2571ZM151.167 64.5155C151.58 64.5155 151.944 64.4209 152.245 64.2473C152.547 64.058 152.784 63.8213 152.959 63.5057C153.133 63.1902 153.212 62.8589 153.212 62.4802V61.502C153.149 61.5651 153.054 61.6124 152.911 61.6597C152.768 61.7071 152.61 61.7386 152.436 61.7702C152.261 61.8017 152.071 61.8333 151.897 61.8491C151.722 61.8806 151.564 61.8964 151.421 61.9122C151.041 61.9595 150.708 62.0226 150.438 62.1331C150.169 62.2277 149.963 62.3697 149.82 62.5433C149.677 62.7169 149.614 62.9377 149.614 63.206C149.614 63.4742 149.677 63.7109 149.82 63.9002C149.963 64.0895 150.137 64.2315 150.375 64.342C150.613 64.4524 150.866 64.5155 151.167 64.5155Z" fill="white"/>
        <path d="M163.358 65.2412C162.945 65.2412 162.613 65.1623 162.327 65.0203C162.042 64.8783 161.82 64.689 161.646 64.4681C161.471 64.2472 161.344 64.0263 161.249 63.8212H161.154V65.0992H160.346V56.0112H161.186V59.5928H161.249C161.344 59.3877 161.471 59.1668 161.646 58.9617C161.82 58.7566 162.042 58.5672 162.311 58.4095C162.581 58.2675 162.93 58.1886 163.358 58.1886C163.912 58.1886 164.404 58.3306 164.832 58.6303C165.26 58.9301 165.577 59.3403 165.815 59.861C166.053 60.3817 166.163 61.0128 166.163 61.707C166.163 62.417 166.053 63.0323 165.815 63.5688C165.577 64.1052 165.26 64.5155 164.832 64.8152C164.404 65.115 163.928 65.2412 163.358 65.2412ZM163.247 64.4997C163.691 64.4997 164.071 64.3735 164.388 64.121C164.705 63.8686 164.927 63.5372 165.101 63.1112C165.26 62.6852 165.339 62.2119 165.339 61.6912C165.339 61.1706 165.26 60.6972 165.101 60.287C164.943 59.8768 164.705 59.5455 164.388 59.293C164.071 59.0406 163.691 58.9301 163.247 58.9301C162.803 58.9301 162.422 59.0563 162.121 59.2772C161.82 59.5139 161.582 59.8452 161.424 60.2555C161.265 60.6657 161.186 61.1548 161.186 61.6912C161.186 62.2277 161.265 62.7168 161.424 63.1428C161.582 63.5688 161.82 63.9001 162.137 64.1368C162.438 64.3735 162.819 64.4997 163.247 64.4997Z" fill="white"/>
        <path d="M174.914 65.2413C174.28 65.2413 173.725 65.0993 173.25 64.7995C172.774 64.4997 172.426 64.0895 172.172 63.5531C171.918 63.0166 171.792 62.4171 171.792 61.7229C171.792 61.0286 171.918 60.4291 172.172 59.8926C172.426 59.3562 172.774 58.946 173.234 58.6304C173.694 58.3306 174.217 58.1729 174.803 58.1729C175.184 58.1729 175.548 58.236 175.881 58.378C176.23 58.52 176.547 58.7251 176.817 58.9933C177.102 59.2773 177.308 59.6244 177.467 60.0504C177.625 60.4764 177.704 60.9813 177.704 61.5651V61.928H172.33V61.218H177.261L176.88 61.4862C176.88 60.9971 176.801 60.5553 176.626 60.1766C176.452 59.7822 176.214 59.4824 175.913 59.2615C175.596 59.0406 175.231 58.9302 174.788 58.9302C174.36 58.9302 173.979 59.0406 173.646 59.2773C173.313 59.514 173.076 59.798 172.885 60.1766C172.695 60.5553 172.616 60.9655 172.616 61.4073V61.8333C172.616 62.3697 172.711 62.8273 172.901 63.2375C173.091 63.632 173.361 63.9475 173.694 64.1684C174.027 64.3893 174.439 64.4997 174.914 64.4997C175.231 64.4997 175.517 64.4524 175.755 64.342C175.992 64.2473 176.198 64.1053 176.373 63.9317C176.547 63.7582 176.658 63.5846 176.737 63.3795L177.53 63.632C177.419 63.916 177.261 64.1842 177.023 64.4209C176.785 64.6733 176.5 64.8626 176.135 65.0046C175.786 65.1782 175.374 65.2413 174.914 65.2413Z" fill="white"/>
        <path d="M184.473 56.0112V65.0992H183.633V56.0112H184.473Z" fill="white"/>
        <path d="M201.435 65.2571C200.817 65.2571 200.278 65.1467 199.802 64.9415C199.327 64.7364 198.978 64.4524 198.709 64.0895C198.439 63.7267 198.296 63.3007 198.265 62.8115H199.152C199.184 63.1744 199.311 63.4742 199.517 63.7267C199.723 63.9791 199.993 64.1527 200.325 64.2947C200.658 64.4209 201.023 64.484 201.419 64.484C201.879 64.484 202.275 64.4051 202.624 64.2631C202.973 64.1053 203.242 63.9002 203.448 63.632C203.654 63.3638 203.75 63.0482 203.75 62.6853C203.75 62.3855 203.67 62.1331 203.512 61.928C203.353 61.7229 203.131 61.5493 202.846 61.4073C202.561 61.2653 202.228 61.1391 201.847 61.0287L200.769 60.7131C200.04 60.508 199.485 60.2082 199.089 59.8295C198.693 59.4509 198.502 58.9618 198.502 58.3938C198.502 57.9047 198.629 57.4629 198.899 57.1C199.168 56.7213 199.517 56.4373 199.977 56.2164C200.436 55.9955 200.944 55.9009 201.499 55.9009C202.069 55.9009 202.576 56.0113 203.02 56.2164C203.464 56.4215 203.813 56.7213 204.067 57.0842C204.32 57.4471 204.463 57.8573 204.479 58.3307H203.623C203.575 57.8258 203.353 57.4313 202.957 57.1315C202.561 56.8318 202.069 56.6898 201.467 56.6898C201.055 56.6898 200.674 56.7687 200.357 56.9107C200.04 57.0527 199.786 57.2578 199.612 57.5102C199.438 57.7627 199.343 58.0467 199.343 58.378C199.343 58.6935 199.422 58.946 199.612 59.1669C199.786 59.372 200.024 59.5455 200.294 59.6875C200.563 59.8295 200.849 59.94 201.15 60.0189L202.101 60.2871C202.402 60.366 202.687 60.4764 202.989 60.6027C203.29 60.7289 203.543 60.8867 203.797 61.076C204.035 61.2653 204.241 61.502 204.384 61.7702C204.526 62.0384 204.606 62.3698 204.606 62.7327C204.606 63.2218 204.479 63.6635 204.225 64.0422C203.971 64.4367 203.607 64.7364 203.131 64.9573C202.672 65.1467 202.101 65.2571 201.435 65.2571Z" fill="#262626"/>
        <path d="M213.356 65.2411C212.754 65.2411 212.231 65.0991 211.787 64.7994C211.343 64.4996 210.978 64.0894 210.725 63.5529C210.471 63.0165 210.344 62.4169 210.344 61.7227C210.344 61.0285 210.471 60.4131 210.725 59.8767C210.978 59.3403 211.343 58.93 211.787 58.6303C212.231 58.3305 212.77 58.1885 213.356 58.1885C213.943 58.1885 214.466 58.3305 214.926 58.6303C215.385 58.93 215.734 59.3403 216.003 59.8767C216.273 60.4131 216.384 61.0285 216.384 61.7227C216.384 62.4169 216.257 63.0165 216.003 63.5529C215.75 64.0894 215.385 64.4996 214.941 64.7994C214.482 65.0991 213.959 65.2411 213.356 65.2411ZM213.356 64.4996C213.832 64.4996 214.228 64.3734 214.545 64.1209C214.878 63.8685 215.116 63.5371 215.29 63.1111C215.465 62.6851 215.544 62.2276 215.544 61.7227C215.544 61.2178 215.465 60.7445 215.29 60.3343C215.116 59.9083 214.862 59.5769 214.545 59.3245C214.212 59.072 213.816 58.9458 213.356 58.9458C212.896 58.9458 212.5 59.072 212.167 59.3245C211.834 59.5769 211.597 59.924 211.422 60.3343C211.248 60.7603 211.169 61.2178 211.169 61.7227C211.169 62.2276 211.248 62.6851 211.422 63.1111C211.597 63.5371 211.834 63.8685 212.167 64.1209C212.484 64.3734 212.881 64.4996 213.356 64.4996Z" fill="#262626"/>
        <path d="M223.184 56.0112V65.0992H222.344V56.0112H223.184Z" fill="#262626"/>
        <path d="M231.84 65.1939C231.38 65.1939 230.968 65.0992 230.619 64.9099C230.27 64.7205 229.985 64.4365 229.795 64.0579C229.589 63.6792 229.494 63.2374 229.494 62.701V58.2832H230.334V62.6379C230.334 63.1901 230.492 63.6319 230.809 63.9632C231.126 64.2945 231.539 64.4523 232.078 64.4523C232.442 64.4523 232.759 64.3734 233.045 64.2314C233.33 64.0894 233.552 63.8528 233.726 63.5688C233.901 63.2848 233.98 62.9377 233.98 62.559V58.299H234.82V65.115H234.012V63.5214H234.138C233.948 64.121 233.647 64.5628 233.251 64.8152C232.854 65.0677 232.347 65.1939 231.84 65.1939Z" fill="#262626"/>
        <path d="M243.428 58.2833V59.0091H240.162V58.2833H243.428ZM241.177 56.6582H242.017V63.49C242.017 63.8213 242.096 64.0738 242.239 64.2315C242.381 64.3893 242.619 64.4524 242.936 64.4209C243 64.4209 243.063 64.4209 243.142 64.4051C243.222 64.3893 243.301 64.3735 243.38 64.3578L243.554 65.0678C243.459 65.0993 243.364 65.1151 243.253 65.1309C243.142 65.1466 243.031 65.1624 242.92 65.1624C242.381 65.194 241.938 65.0678 241.636 64.768C241.319 64.4682 241.177 64.058 241.177 63.5373V56.6582Z" fill="#262626"/>
        <path d="M249.499 57.0211C249.341 57.0211 249.198 56.958 249.071 56.8475C248.945 56.7371 248.897 56.5951 248.897 56.4373C248.897 56.2795 248.96 56.1375 249.071 56.0271C249.198 55.9166 249.341 55.8535 249.499 55.8535C249.674 55.8535 249.816 55.9166 249.927 56.0271C250.038 56.1375 250.102 56.2795 250.102 56.4373C250.102 56.5951 250.038 56.7371 249.927 56.8475C249.801 56.958 249.658 57.0211 249.499 57.0211ZM249.071 65.0993V58.2833H249.912V65.0993H249.071Z" fill="#262626"/>
        <path d="M258.9 65.2411C258.297 65.2411 257.774 65.0991 257.33 64.7994C256.886 64.4996 256.522 64.0894 256.268 63.5529C256.015 63.0165 255.888 62.4169 255.888 61.7227C255.888 61.0285 256.015 60.4131 256.268 59.8767C256.522 59.3403 256.886 58.93 257.33 58.6303C257.774 58.3305 258.313 58.1885 258.9 58.1885C259.486 58.1885 260.009 58.3305 260.469 58.6303C260.929 58.93 261.277 59.3403 261.531 59.8767C261.785 60.4131 261.912 61.0285 261.912 61.7227C261.912 62.4169 261.785 63.0165 261.531 63.5529C261.277 64.0894 260.913 64.4996 260.469 64.7994C260.009 65.0991 259.486 65.2411 258.9 65.2411ZM258.9 64.4996C259.375 64.4996 259.772 64.3734 260.089 64.1209C260.421 63.8685 260.659 63.5371 260.834 63.1111C261.008 62.6851 261.087 62.2276 261.087 61.7227C261.087 61.2178 261.008 60.7445 260.834 60.3343C260.659 59.924 260.406 59.5769 260.089 59.3245C259.756 59.072 259.359 58.9458 258.9 58.9458C258.44 58.9458 258.044 59.072 257.711 59.3245C257.378 59.5769 257.14 59.924 256.966 60.3343C256.791 60.7603 256.712 61.2178 256.712 61.7227C256.712 62.2276 256.791 62.6851 256.966 63.1111C257.14 63.5371 257.378 63.8685 257.711 64.1209C258.028 64.3734 258.424 64.4996 258.9 64.4996Z" fill="#262626"/>
        <path d="M268.712 60.8553V65.1153H267.872V58.2993H268.681V59.8928H268.554C268.744 59.2933 269.029 58.8673 269.441 58.599C269.838 58.3308 270.297 58.2046 270.821 58.2046C271.28 58.2046 271.692 58.2993 272.041 58.4886C272.39 58.6779 272.659 58.9619 272.866 59.3406C273.056 59.7193 273.167 60.161 273.167 60.7133V65.131H272.342V60.7448C272.342 60.1926 272.184 59.7508 271.867 59.4195C271.55 59.0881 271.138 58.9304 270.599 58.9304C270.234 58.9304 269.917 59.0093 269.632 59.167C269.346 59.3248 269.124 59.5457 268.95 59.8297C268.792 60.1137 268.712 60.4608 268.712 60.8553Z" fill="#262626"/>
        </svg>
                    </div>
                    <div class="logo">SIGN<span>X</span>PERT</div>
                    <div class="logo-sub">Smart <span>Sign & Label</span> Solution</div>
                </div>
                <div class="invoice-title">INVOICE</div>
            </div>
        
            <div class="info-section">
                <div class="address-block">
                <span class="company-name">${customerCompany}</span><br>
                ${customerName ? `${customerName}<br>` : ''}
                ${addressLine1 ? `${addressLine1}<br>` : ''}
                ${addressLine2 ? `${addressLine2}<br>` : ''}
                ${countryLine ? `${countryLine}<br>` : ''}
                ${phoneLine ? `Phone: ${phoneLine}` : ''}
                ${vatIdMarkup}
                </div>
                <div class="details-block">
                <table class="details-table">
                    <tr><td><strong>Invoice No:</strong></td><td><strong>${invoiceNumber}</strong></td></tr>
                    <tr><td>Customer No:</td><td>${customerNumber}</td></tr>
                    <tr><td>Date:</td><td>${invoiceDate}</td></tr>
                    ${isInvoiceUnpaidCase
                    ? `<tr><td>Invoice due date:</td><td>${invoiceDueDate}</td></tr>
                    <tr><td>Payment Terms:</td><td>30 days net</td></tr>`
                    : `<tr><td>Payment status:</td><td>${paymentStatus}</td></tr>`}
                    <tr><td>Reference:</td><td>Order No: ${invoiceNumber}</td></tr>
                    </table>
                </div>
            </div>
        
            <table class="items-table">
                <thead>
                    <tr>
                    <th class="col-order nowrap">Order No</th>
                    <th class="col-desc">Description</th>
                    <th class="col-total">Net total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                    <td>${invoiceNumber}</td>
                    <td>Count Signs:${signsCount} (${projectName})</td>
                    <td class="money-cell">€&nbsp;${formatMoney(subtotal)}</td>
                    </tr>
                </tbody>
            </table>
        
            <div class="calc-section">
                <table class="calc-table">
                <tr><td>Subtotal</td><td class="money-cell">€&nbsp;${formatMoney(subtotal)}</td></tr>
                <tr><td>Discount (${discountPercent.toFixed(0)} %)</td><td class="money-cell">€&nbsp;${formatMoney(discountAmount)}</td></tr>
                <tr><td>Shipping & Packaging cost${deliveryLabel ? ` (${deliveryLabel})` : ''}</td><td class="money-cell">€&nbsp;${formatMoney(shippingCost)}</td></tr>
                    <tr class="total-row">
                    <td style="padding-top: 15px; padding-bottom: 6px;"><u>Total amount</u></td>
                    <td class="money-cell" style="padding-top: 12px; padding-bottom: 6px;">€&nbsp;${totalAmountFormatted}</td>
                    </tr>
                </table>
            </div>
        
            ${shouldRenderPaymentInformation ? `
            <div class="payment-info">
                <h3><u>Payment information:</u></h3>
                <div class="payment-grid">
                <div>Amount due:</div><div class="payment-value">€&nbsp;${totalAmountFormatted}</div>
                <div>Account holder:</div><div>SignXpert (Kostyantyn Utvenko)</div>
                <div>IBAN:</div><div>DE78 6535 1260 0134 0819 40</div>
                <div>BIC / SWIFT:</div><div>SOLADES1BAL</div>
                <div>Payment reference:</div><div>Order No: ${invoiceNumber}</div>
                </div>
            </div>
        
            <div class="online-payment-note">
                <span class="first-line">If you would like to pay by card or use any of the other online payment methods available, please visit: <span class="nowrap">sign-xpert.com</span></span><br>
                Log in to your account and go to: <span class="nowrap">My Account → My Orders</span><br>
                Select the relevant invoice and click “Pay” to complete your payment securely.
            </div>
            ` : ''}
        
            <div class="footer-wrapper">
                <div class="footer-thanks" style="text-align:center;margin-bottom:10px;font-weight:700;"><strong>Thank you for choosing SignXpert!</strong></div>
                <div class="footer-box" style="border:0.5pt solid #000;padding:6px 10px;display:flex;justify-content:space-between;font-size:8pt;line-height:1.05;">
                <div class="footer-col-left">
                    <table class="footer-info-table">
                    <tr>
                        <td><strong>SignXpert</strong></td>
                        <td class="footer-value-cell"></td>
                    </tr>
                    <tr>
                        <td>Owner:</td>
                        <td class="footer-value-cell">Kostyantyn Utvenko</td>
                    </tr>
                    <tr>
                        <td>Address:</td>
                        <td class="footer-value-cell">Baumwiesen 2, Haigerloch 72401, Germany</td>
                    </tr>
                    <tr>
                        <td>IBAN:</td>
                        <td class="footer-value-cell">DE78 6535 1260 0134 0819 40</td>
                    </tr>
                    <tr>
                        <td>BIC / SWIFT:</td>
                        <td class="footer-value-cell">SOLADES1BAL</td>
                    </tr>
                    <tr>
                        <td>St.-Nr.:</td>
                        <td class="footer-value-cell">xx/xxx/xxxxx Gemäß § 19 UStG wird keine Umsatzsteuer berechnet/</td>
                    </tr>
                    <tr>
                        <td></td>
                        <td class="footer-value-cell">No VAT is charged under the small business exemption (§ 19 UStG).</td>
                    </tr>
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
        </html>`
        
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: '<div></div>',
                footerTemplate: buildPdfFooterTemplate(10, 20, 2),
                margin: { top: '20px', right: '20px', bottom: '28px', left: '20px' }
            });
        
            const zugferdData = buildZugferdInvoiceData({
                order,
                invoiceNumber: invoiceNumberRaw,
                customerIdentifier: customerIdentifierRaw,
                customerCompany: customerAddress?.companyName || order.user?.company || '',
                customerName: customerAddress?.fullName || [order.user?.firstName, order.user?.surname].filter(Boolean).join(' '),
                customerEmail: customerEmailRaw,
                customerPhone: customerPhoneRaw,
                customerStreetLine1: customerStreetLine1Raw,
                customerStreetLine2: customerStreetLine2Raw,
                customerStreetLine3: customerStreetLine3Raw,
                customerPostalCode: customerPostalCodeRaw,
                customerCity: customerCityRaw,
                customerCountryCode: customerCountryRaw,
                customerCountrySubdivision: customerCountrySubdivisionRaw,
                customerVatNumber: customerVatNumberRaw,
                buyerReference: String(order.user?.reference || order.userId || order.id || ''),
                remittanceInformation: `Order No: ${invoiceNumberRaw}`,
                paymentDueDate: invoiceDueDateDate,
                signsCount: signsCountRaw,
                projectName: projectNameRaw,
                subtotal,
                vatAmount,
                vatPercent,
                totalAmount,
            });
        
            const invoice = basicZugferdInvoicer.create(zugferdData);
                
            const zugferdPdf = await invoice.embedInPdf(pdfBuffer, {
                metadata: {
                title: `Invoice ${invoiceNumber}`,
                subject: `Invoice ${invoiceNumber}`,
                author: 'SignXpert',
                creator: 'SignXpert backend',
                producer: 'SignXpert backend',
                keywords: ['ZUGFeRD', 'Factur-X', 'Invoice'],
                language: 'en',
                },
            });
            outputPdfBuffer = Buffer.from(zugferdPdf);

            //await sendEmail(to, textHTML, subject, outputPdfBuffer)

        } catch (err) {
            console.error("PDF Generation Error in SendToAdminNewOrder:", err);
        } finally {
            if (browser) await browser.close();
        }
        try{
            const fileAttachment = outputPdfBuffer ? {
                filename: `Invoice-${orderNumber}.pdf`,
                content: outputPdfBuffer,
                contentType: 'application/pdf'
            } : null;

            sendEmail(to, textHTML, subject, fileAttachment)

        } catch (err) {
            console.error('Error in SendToAdminNewOrder Final Step:', err);
            return false;
        }
    };

    static CreateOrder=async(order)=>{
        try{
            const orderNumber=String(order.id).padStart(3, '0')
            const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
            const subject=`SignXpert - Order Received #${orderNumber} ${nameOrCompany}`
            const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
            const create=formatDate(order.createdAt);
            const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
            const urlAccount=urlFrontend+'account/detail';
            const urlOrders=urlFrontend+'account';
            
            const html=`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SignXpert Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9f9f9; color: #333333;">

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9f9f9; padding: 20px 0;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #dddddd; padding: 40px; border-radius: 4px;">

                    <tr>
                        <td align="center" style="padding-bottom: 30px;">
                            <img src=${logoPng} alt="SignXpert" width="220" style="display: block; border: 0;">
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding-bottom: 30px;">
                            <h2 style="font-size: 22px; margin: 0; color: #000; font-weight: bold;">Your order has been received – SignXpert</h2>
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 20px;">
                            Hello, <span style="color: #337ab7;">${nameOrCompany}</span>!
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 20px;">
                            Thank you very much for your order — we truly appreciate your trust in SignXpert.
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 25px;">
                            We have successfully received your order. Our team will soon begin reviewing all project details to ensure everything is exactly as requested. You will receive a separate email once we start this review.
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.8; padding-bottom: 25px;">
                            <strong>Order number:</strong> ${orderNumber}<br>
                            <strong>Customer number:</strong> ${String(order.user.id).padStart(3, '0')}<br>
                            <strong>Order date:</strong> ${create}
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 25px;">
                            You can follow the status of your order at any time in your account.<br>
                            Simply log in to <a href="${urlAccount}" style="color: #0056b3; text-decoration: underline;">My Account</a> &rarr; <a href="${urlOrders}" style="color: #0056b3; text-decoration: underline;">My Orders</a>, where you can view:
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>Order status</li>
                                <li>Invoice</li>
                                <li>Project details</li>
                                <li>Delivery information</li>
                            </ul>
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 30px;">
                            If you notice anything that needs correction, please contact us as soon as possible.
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 40px;">
                            Best regards,<br>
                            <strong>SignXpert Team</strong>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="font-size: 14px; border-top: 1px solid #eeeeee; padding-top: 20px;">
                            <a href="https://sign-xpert.com" style="color: #0056b3; text-decoration: underline;">sign-xpert.com</a><br>
                            <a href="mailto:info@sign-xpert.com" style="color: #0056b3; text-decoration: underline;">info@sign-xpert.com</a><br>
                            <span style="color: #666666;">+49 157 766 25 125</span>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>
`
            const to=order.user.email;
            await sendEmail(to, html, subject);
            return true;
        }catch(err){
            console.error('error send email where create order.'+err);
            return false
        }
    }
    static StatusPrinted=async(order)=>{
        try{
            const orderNumber=String(order.id).padStart(3, '0')
            const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
            const subject=`SignXpert - Order Confirmation #${orderNumber} ${nameOrCompany}`;
            const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
            const create=formatDate(order.createdAt);
            const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
            const urlAccount=urlFrontend+'account/detail';
            const urlOrders=urlFrontend+'account';
            
            const html=`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation - SignXpert</title>
    <style>
        /* Базові скидання для поштовиків */
        body { margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse; }
        img { display: block; border: 0; }
        a { color: #0056b3; text-decoration: underline; }

        @media screen and (max-width: 600px) {
            .container { width: 100% !important; border-radius: 0 !important; }
            .content { padding: 20px !important; }
        }
    </style>
</head>
<body style="background-color: #f4f4f4; padding: 20px 0;">

    <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center">
                <table class="container" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #dddddd; border-radius: 8px; overflow: hidden;">

                    <tr>
                        <td align="center" style="padding: 30px 40px 10px 40px;">
                            <img src="${logoPng}" alt="SignXpert" width="200" style="max-width: 200px; height: auto;">
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 10px 40px 20px 40px;">
                            <h1 style="font-size: 22px; color: #000000; margin: 0; font-weight: bold;">Your order has been confirmed – SignXpert</h1>
                        </td>
                    </tr>

                    <tr>
                        <td class="content" align="left" style="padding: 0 40px 30px 40px; color: #333333; font-size: 15px; line-height: 1.6;">
                            <p>Hello, <strong>${nameOrCompany}</strong>!</p>
                            <p>Thank you for your order!</p>

                            <p>We have successfully received your order and our team is now carefully reviewing all project details to ensure everything is exactly as requested. Once the review is complete, your order will move straight into production.</p>

                            <p style="margin: 20px 0;">
                                <strong>Order number:</strong> ${orderNumber}<br>
                                <strong>Customer number:</strong> ${String(order.user.id).padStart(3, '0')}<br>
                                <strong>Order date:</strong> ${create}
                            </p>

                            <p>You can follow the status of your order at any time in your account. Simply log in to <a href="${urlAccount}" style="color: #0056b3;">My Account</a> &rarr; <a href="${urlOrders}" style="color: #0056b3;">My Orders</a>, where you can view:</p>

                            <ul style="padding-left: 20px; margin: 10px 0;">
                                <li>Order status</li>
                                <li>Invoice</li>
                                <li>Project details</li>
                                <li>Delivery information</li>
                            </ul>

                            <p>If you notice anything that needs correction, please contact us as soon as possible.</p>

                            <p>As soon as your order is completed, packed, and ready for shipment, you will receive another email with your tracking number.</p>

                            <p>If you have any questions or need any assistance, we are always happy to help.</p>

                            <p style="margin-top: 30px;">
                                Best regards,<br>
                                <strong>SignXpert Team</strong>
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="padding: 0 40px 40px 40px; border-top: 1px solid #f0f0f0;">
                            <p style="margin: 20px 0 5px 0; font-size: 14px;">
                                <a href="https://sign-xpert.com" style="color: #0056b3; text-decoration: none;">sign-xpert.com</a>
                            </p>
                            <p style="margin: 0 0 5px 0; font-size: 14px;">
                                <a href="mailto:info@sign-xpert.com" style="color: #0056b3; text-decoration: none;">info@sign-xpert.com</a>
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #333333;">
                                +49 157 766 25 125
                            </p>
                        </td>
                    </tr>

                </table>
                </td>
        </tr>
    </table>

</body>
</html>
`       
            const to=order.user.email;
            await sendEmail(to,html,subject);
        }catch(err){
            console.error('error send email where status printed.'+err);
            return false
        }
    }

   static StatusShipped = async (order) => {
    try {
        const orderNumber = String(order.id).padStart(3, '0');
        const nameOrCompany = order.user.company ? order.user.company : order.user.firstName;
        const fullName = [order.user.firstName, order.user.surname].filter(Boolean).join(' ');
        const companyDisplay = order.user.company ? `, (${order.user.company})` : '';
        
        const subject = `SignXpert - Order Shipped #${orderNumber} ${nameOrCompany}`;
        const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
        const urlFrontend = process.env.VITE_LAYOUT_FRONTEND_URL;
        const urlAccount = urlFrontend + 'account/detail';
        const urlOrders = urlFrontend + 'account';
        
        // В реальності тут має бути поле з БД, наприклад order.trackingNumber
        const trackingNumber = 'XXXXXXXX'; 
        const trackingUrl = `https://www.ups.com/track?tracknum=${trackingNumber}`;

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your order has been shipped - SignXpert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #dddddd; border-radius: 8px; overflow: hidden;">
                    
                    <tr>
                        <td align="center" style="padding: 30px 40px 10px 40px;">
                            <img src="${logoPng}" alt="SignXpert" width="200" style="display: block; border: 0;">
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 10px 40px 20px 40px;">
                            <h2 style="margin: 0; color: #000000; font-size: 20px; font-weight: bold;">Your order has been shipped – Tracking available</h2>
                        </td>
                    </tr>

                    <tr>
                        <td align="left" style="padding: 0 60px 30px 60px; color: #000000; font-size: 15px; line-height: 1.5;">
                            <p style="margin: 0 0 20px 0;">Hello, ${fullName}${companyDisplay}!</p>
                            
                            <p style="margin: 0 0 10px 0;">Good news!</p>
                            <p style="margin: 0 0 20px 0;">Your order has now been shipped via UPS and is on its way to you.</p>
                            
                            <p style="margin: 0 0 20px 0;">Tracking number: ${trackingNumber}</p>
                            
                            <p style="margin: 0 0 20px 0;">You can track your order directly on the UPS website by clicking the link below:</p>

                            <table border="0" cellspacing="0" cellpadding="0" style="margin: 30px auto;">
                                <tr>
                                    <td align="center" bgcolor="#3e73a0" style="border-radius: 4px;">
                                        <a href="${trackingUrl}" target="_blank" style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 40px; border-radius: 4px; display: inline-block; font-weight: normal;">
                                            Track Your Shipment
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 20px 0;">Please note that it may take some time for the tracking number to become active in the UPS system. Once active, you can follow the journey of your package and see its current status.</p>
                            
                            <p style="margin: 0 0 20px 0;">You can also always check the detailed status of your order in your account.</p>
                            <p style="margin: 0 0 30px 0;">Simply log in to <a href="${urlAccount}" style="color: #0073bc; text-decoration: underline;">My Account</a> &rarr; <a href="${urlOrders}" style="color: #0073bc; text-decoration: underline;">My Orders</a></p>

                            <p style="margin: 0 0 20px 0; font-weight: bold;">Thank you for choosing SignXpert — we hope you enjoy your custom signs!</p>
                            
                            <p style="margin: 0 0 30px 0;">If you have any questions or need assistance, don't hesitate to contact us.</p>
                            
                            <p style="margin: 0 0 5px 0;">Best regards,</p>
                            <p style="margin: 0 0 40px 0;">SignXpert Team</p>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="padding: 0 60px 40px 60px;">
                            <a href="https://sign-xpert.com" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">sign-xpert.com</a>
                            <a href="mailto:info@sign-xpert.com" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">info@sign-xpert.com</a>
                            <p style="margin: 0; font-size: 14px; color: #000000;">+49 157 766 25 125</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

        const to = order.user.email;
        await sendEmail(to, html, subject, null);
        
        return true;
    } catch (err) {
        console.error('error send email where status shipped.' + err);
        return false;
    }
}
    
    static StatusShipped2=async(order)=>{
        try{
            const orderNumber=String(order.id).padStart(3, '0')
            const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
            const subject=`SignXpert – Invoice #${orderNumber} for ${nameOrCompany}`;
            const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
            const create=formatDate(order.createdAt);
            const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
            const urlAccount=urlFrontend+'account/detail';
            const urlOrders=urlFrontend+'account';
            const payment_url=urlFrontend+`account/pay/${order.id}`
            const html=`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your invoice is ready - SignXpert</title>
    <style>
        body { margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse; }
        img { display: block; border: 0; }
        a { color: #006DA5; text-decoration: underline; }

        @media screen and (max-width: 600px) {
            .container { width: 100% !important; border-radius: 0 !important; }
            .content { padding: 20px !important; }
        }
    </style>
</head>
<body style="background-color: #f4f4f4; padding: 20px 0;">

    <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center">
                <table class="container" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #dddddd; border-radius: 8px; overflow: hidden;">

                    <tr>
                        <td align="center" style="padding: 30px 40px 10px 40px;">
                            <img src="${logoPng}" alt="SignXpert" width="200" style="max-width: 200px; height: auto;">
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 10px 40px 20px 40px;">
                            <h1 style="font-size: 22px; color: #000000; margin: 0; font-weight: bold;">Your invoice is ready – SignXpert</h1>
                        </td>
                    </tr>

                    <tr>
                        <td class="content" align="left" style="padding: 0 40px 30px 40px; color: #333333; font-size: 15px; line-height: 1.6;">
                            <p>Hello, <strong>${nameOrCompany}</strong>!</p>
                            <p>Thank you for your order and for choosing <strong>SignXpert</strong>.</p>

                            <p>Please find your invoice attached to this email.</p>

                            <p>You can also view and settle your invoice at any time via our website:<br>
                            <a href="https://www.sign-xpert.com" style="color: #006DA5;">www.sign-xpert.com</a><br>
                            Simply log in and navigate to:</p>

                            <p><a href="${urlAccount}" style="color: #006DA5;">My Account</a> &rarr; <a href="${urlOrders}" style="color: #006DA5;">My Orders</a></p>

                            <p>Select the relevant order and click <strong>“Pay”</strong></p>

                            <table border="0" cellspacing="0" cellpadding="0" style="margin: 25px auto;">
                                <tr>
                                    <td align="center" bgcolor="#006DA5" style="border-radius: 8px;">
                                        <a href="${payment_url}" target="_blank" style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 10px 60px; border-radius: 8px; border: 1px solid #006DA5; display: inline-block; font-weight: bold; text-transform: uppercase;">
                                            PAY
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p>Multiple secure payment methods are available directly in your account.</p>

                            <p>If you prefer to pay by bank transfer, please use the bank details provided on the invoice and make sure to quote:</p>

                            <p style="margin: 15px 0;">
                                <strong>Order number: ${orderNumber}</strong><br>
                                or<br>
                                <strong>Customer number: ${String(order.user.id).padStart(3, '0')}</strong>
                            </p>

                            <p>This helps us allocate your payment correctly.</p>

                            <p>Should you wish to update your billing address or the email address used for receiving invoices, you can do so in:</p>

                            <p><a href="${urlAccount}" style="color: #006DA5;">My Account</a> &rarr; <a href="${urlOrders}" style="color: #006DA5;">My Details</a></p>

                            <p>If you have already completed the payment, please disregard this message. You can check your payment status at any time in your account under <a href="${urlOrders}" style="color: #006DA5;">“My Orders”</a>.</p>

                            <p style="margin-top: 25px;"><strong>We truly appreciate your business and look forward to working with you again.</strong></p>

                            <p style="margin-top: 30px;">
                                Best regards,<br>
                                <strong>SignXpert Team</strong>
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="padding: 0 40px 40px 40px; border-top: 1px solid #f0f0f0;">
                            <p style="margin: 20px 0 5px 0; font-size: 14px;">
                                <a href="https://sign-xpert.com" style="color: #006DA5; text-decoration: none;">sign-xpert.com</a>
                            </p>
                            <p style="margin: 0 0 5px 0; font-size: 14px;">
                                <a href="mailto:info@sign-xpert.com" style="color: #006DA5; text-decoration: none;">info@sign-xpert.com</a>
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #333333;">
                                +49 157 766 25 125
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>
`       
            const to=order.user.email;
            //await sendEmail(to,html,subject);
            SendEmailForStatus.SendEmailWithFile(order,html,subject,to);
        }catch(err){
            console.error('error send email where status shipped2.'+err);
            return false
        }
    }

    static StatusDelivered = async (order) => {
        try{
            const orderNumber=String(order.id).padStart(3, '0')
            const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
            const subject=`SignXpert -  Order Delivered #${orderNumber} ${nameOrCompany}`;
            const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
            const create=formatDate(order.createdAt);
            const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
            const urlAccount=urlFrontend+'account/detail';
            const urlOrders=urlFrontend+'account';
            const contact=urlFrontend+'contacts'
            
            const html=`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your order has been delivered - SignXpert</title>
    <style>
        body { margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse; }
        img { display: block; border: 0; }
        a { color: #006DA5; text-decoration: underline; }

        @media screen and (max-width: 600px) {
            .container { width: 100% !important; border-radius: 0 !important; }
            .content { padding: 20px !important; }
        }
    </style>
</head>
<body style="background-color: #f4f4f4; padding: 20px 0;">

    <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
            <td align="center">
                <table class="container" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border: 1px solid #dddddd; border-radius: 8px; overflow: hidden;">

                    <tr>
                        <td align="center" style="padding: 30px 40px 10px 40px;">
                            <img src="${logoPng}" alt="SignXpert" width="200" style="max-width: 200px; height: auto;">
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 10px 40px 20px 40px;">
                            <h1 style="font-size: 22px; color: #000000; margin: 0; font-weight: bold;">Your order has been delivered</h1>
                        </td>
                    </tr>

                    <tr>
                        <td class="content" align="left" style="padding: 0 40px 30px 40px; color: #333333; font-size: 15px; line-height: 1.6;">
                            <p>Hello, <strong>${nameOrCompany}</strong>!</p>

                            <p>Good news!<br>
                            Your order has been successfully delivered.</p>

                            <p>We hope everything meets your expectations and that you are happy with your custom signs.</p>

                            <p>We would be grateful if you could take a moment to leave us a review — your feedback helps us improve and continue providing the best service.</p>

                            <table border="0" cellspacing="0" cellpadding="0" style="margin: 30px auto;">
                                <tr>
                                    <td align="center" bgcolor="#006DA5" style="border-radius: 8px;">
                                        <a href="{review_url}" target="_blank" style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 40px; border-radius: 8px; border: 1px solid #006DA5; display: inline-block; font-weight: bold;">
                                            Leave a Review
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p>If you notice anything unusual or have any questions, please don’t hesitate to <a href="${contact}" style="color: #006DA5;">contact</a> us — we are always happy to help.</p>

                            <p style="margin-top: 25px;">
                                <strong>Thank you for working with SignXpert!</strong><br>
                                <strong>We can’t wait to welcome you back and help bring your next custom project to life.</strong>
                            </p>

                            <p style="margin-top: 30px;">
                                Best regards,<br>
                                <strong>SignXpert Team</strong>
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="padding: 0 40px 40px 40px; border-top: 1px solid #f0f0f0;">
                            <p style="margin: 20px 0 5px 0; font-size: 14px;">
                                <a href="https://sign-xpert.com" style="color: #006DA5; text-decoration: none;">sign-xpert.com</a>
                            </p>
                            <p style="margin: 0 0 5px 0; font-size: 14px;">
                                <a href="mailto:info@sign-xpert.com" style="color: #006DA5; text-decoration: none;">info@sign-xpert.com</a>
                            </p>
                            <p style="margin: 0; font-size: 14px; color: #333333;">
                                +49 157 766 25 125
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>
`       
            const recipients = getInvoiceRecipients(order.user);
            if (recipients.length === 0) {
                console.warn(`Skip invoice reminder for order ${order?.id}: user.weWill has no recipients`);
                return true;
            }

            await Promise.all(recipients.map((to) => sendEmail(to, html, subject)));
            return true;
        }catch(err){
            console.error('error send email where status printed.'+err);
            return false
        }
    }


    static ErrorDelivered = async (order) => {
        try{
            const orderNumber=String(order.id).padStart(3, '0')
            const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
            const subject=`SignXpert -  Problem with Delivery #${orderNumber} ${nameOrCompany}`;
            const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
            const create=formatDate(order.createdAt);
            const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
            const urlAccount=urlFrontend+'account/detail';
            const urlOrders=urlFrontend+'account';
            const contact=urlFrontend+'contacts'
            
            const html=`
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delivery Issue Notification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; background-color: #ffffff; margin-top: 20px; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0;">
        <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
                <div style="font-size: 28px; font-weight: bold; color: #333; letter-spacing: 2px;">
                    SÌGN<span style="color: #0066cc;">X</span>PERT
                </div>
                <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-top: 5px;">
                </div>
            </td>
        </tr>

        <tr>
            <td style="padding: 20px 40px; text-align: center;">
                <h1 style="font-size: 22px; color: #000000; margin: 0;">Issue with your delivery — Action required</h1>
            </td>
        </tr>

        <tr>
            <td style="padding: 20px 40px; font-size: 16px; line-height: 1.6; color: #333333;">
                <p>Hello, <span style="color: #0066cc;">${nameOrCompany}</span>!</p>

                <p>The carrier has reported an issue with the delivery of your order.</p>

                <p style="margin-bottom: 10px;">This may occur due to:</p>
                <ul style="margin-top: 0; padding-left: 20px;">
                    <li>Incorrect address</li>
                    <li>Delivery attempt failed</li>
                    <li>Returned to sender</li>
                </ul>

                <p>Please contact us as soon as possible to confirm the correct delivery details or resolve the issue.</p>

                <p>We will update the carrier immediately to ensure your order reaches you without further delay.</p>
            </td>
        </tr>

        <tr>
            <td style="padding: 20px 40px 40px 40px; font-size: 16px; color: #333333;">
                <p style="margin: 0;">Best regards,</p>
                <p style="margin: 5px 0 0 0; font-weight: bold;">SignXpert Team</p>
            </td>
        </tr>

        <tr>
            <td style="padding: 0 40px 40px 40px; text-align: right; font-size: 14px;">
                <a href="https://sign-xpert.com" style="color: #0066cc; text-decoration: underline; display: block; margin-bottom: 5px;">sign-xpert.com</a>
                <a href="mailto:info@sign-xpert.com" style="color: #0066cc; text-decoration: underline; display: block; margin-bottom: 5px;">info@sign-xpert.com</a>
                <p style="margin: 0; color: #333333;">+49 157 766 25 125</p>
            </td>
        </tr>
    </table>
</body>
</html>`       
            const to=order.user.email;
            await sendEmail(to,html,subject);
            return true;
        }catch(err){
            console.error('error send email where status printed.'+err);
            return false
        }
    }

    static ReminderPay = async (order) => {
        try{
            if(order.isPaid)return true;
            const orderNumber=String(order.id).padStart(3, '0')
            const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
            const subject=`SignXpert – Friendly Reminder: Invoice #${orderNumber} for ${nameOrCompany}`;
            const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
            const create=formatDate(order.createdAt);
            const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
            const urlAccount=urlFrontend+'account/detail';
            const urlOrders=urlFrontend+'account';
            const contact=urlFrontend+'contacts'
            const payURL=urlFrontend+'account/pay/'+order.id;
            
            const html=`
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice Reminder</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 600px; background-color: #ffffff; margin-top: 20px; margin-bottom: 20px; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0;">

        <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
                <div style="font-size: 28px; font-weight: bold; color: #333; letter-spacing: 2px;">
                    SÌGN<span style="color: #0066cc;">X</span>PERT
                </div>
                <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-top: 5px;">
                </div>
            </td>
        </tr>

        <tr>
            <td style="padding: 10px 40px; text-align: center;">
                <h1 style="font-size: 20px; color: #000000; margin: 0;">Friendly Reminder - Your Invoice is Due</h1>
            </td>
        </tr>

        <tr>
            <td style="padding: 20px 40px; font-size: 15px; line-height: 1.5; color: #333333;">
                <p>Hello, <span style="color: #0066cc;">${nameOrCompany}</span>!</p>
                <p>We hope you are enjoying your custom signs!</p>

                <p>This is just a friendly reminder that the invoice for your recent order (Invoice #005) is still outstanding. If you have already made the payment, please disregard this message. Please find your invoice attached to this email.</p>

                <p>You can also view and settle your invoice at any time via our website:<br>
                <a href="https://www.sign-xpert.com" style="color: #0066cc; text-decoration: underline;">www.sign-xpert.com</a><br>
                Simply log in and navigate to:</p>

                <p style="font-weight: bold;">
                    <a href="#" style="color: #0066cc; text-decoration: underline;">My Account</a> &rarr; <a href="#" style="color: #0066cc; text-decoration: underline;">My Orders</a>
                </p>

                <p>Select the relevant order and click <strong>"Pay"</strong></p>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                    <tr>
                        <td bgcolor="#006eb3" style="border-radius: 6px; text-align: center;">
                            <a href="${payURL}" style="background-color: #006eb3; border: 1px solid #005a94; border-radius: 6px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: bold; padding: 12px 60px; text-decoration: none; text-transform: uppercase;">Pay</a>
                        </td>
                    </tr>
                </table>

                <p style="margin-top: 25px;">Multiple secure payment methods are available directly in your account.</p>

                <p>If you prefer to pay by bank transfer, please use the bank details provided on the invoice and make sure to quote:</p>

                <p style="margin: 0;"><strong>Order number: ${orderNumber}</strong></p>
                <p style="margin: 5px 0;">or</p>
                <p style="margin: 0;"><strong>Customer number: ${String(order.user.id).padStart(3, '0')}</strong></p>

                <p>This helps us allocate your payment correctly.</p>

                <p>Should you wish to update your billing address or the email address used for receiving invoices, you can do so in:</p>
                <p style="font-weight: bold;">
                    <a href="${urlAccount}" style="color: #0066cc; text-decoration: underline;">My Account</a> &rarr; <a href="${urlOrders}" style="color: #0066cc; text-decoration: underline;">My Details</a>
                </p>

                <p>You can check your payment status at any time in your account under <a href="${urlOrders}" style="color: #0066cc; text-decoration: underline;">"My Orders"</a>.</p>

                <p>Thank you again for choosing SignXpert.<br>
                <strong>We truly appreciate your business and look forward to working with you again soon!</strong></p>
            </td>
        </tr>

        <tr>
            <td style="padding: 20px 40px 40px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="font-size: 15px; color: #333333;">
                            <p style="margin: 0;">Best regards,</p>
                            <p style="margin: 5px 0 0 0; font-weight: bold;">SignXpert Team</p>
                        </td>
                        <td style="text-align: right; font-size: 13px;">
                            <a href="https://sign-xpert.com" style="color: #0066cc; text-decoration: underline; display: block; margin-bottom: 4px;">sign-xpert.com</a>
                            <a href="mailto:info@sign-xpert.com" style="color: #0066cc; text-decoration: underline; display: block; margin-bottom: 4px;">info@sign-xpert.com</a>
                            <p style="margin: 0; color: #333333;">+49 157 766 25 125</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`       
            const to=order.user.email;
            //await sendEmail(to,html,subject);
            await SendEmailForStatus.SendEmailWithFile(order,html, subject, to);
            return true;
        }catch(err){
            console.error('error send email where status printed.'+err);
            return false
        }
    }
    static Contact = async (req, res, next) => {
        try {
            const { name, email, question } = req.body;

            if (!name || !email || !question) {
                throw ErrorApi.badRequest('Missing required fields');
            }

            const logo = process.env.VITE_LAYOUT_SERVER + 'images/images/logo.png';
            const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

            if (!ADMIN_EMAIL) {
                throw ErrorApi.badRequest('Admin email is not configured');
            }

            const subject = `Request from contact page: ${name} (${email})`;

            const messageHTML = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0; background:#f2f2f2; font-family: Arial, sans-serif;">

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2; padding:20px 0;">
    <tr>
        <td align="center">

        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; border-radius:8px; padding:24px;">
            
            <!-- LOGO -->
            <tr>
            <td align="center" style="padding-bottom:24px;">
                <img src="${logo}" alt="SignXpert Logo" width="200" style="display:block;" />
            </td>
            </tr>

            <!-- TITLE -->
            <tr>
            <td align="center" style="font-size:22px; font-weight:600; padding-bottom:24px;">
                New Contact Request – SignXpert
            </td>
            </tr>

            <!-- TEXT -->
            <tr>
            <td style="font-size:14px; padding-bottom:10px;">
                Hello,
            </td>
            </tr>

            <tr>
            <td style="font-size:14px; padding-bottom:20px;">
                You have received a new message via the contact form.
            </td>
            </tr>

            <!-- CUSTOMER -->
            <tr>
            <td style="font-size:14px; font-weight:bold; padding-bottom:10px;">
                Customer details:
            </td>
            </tr>

            <tr>
            <td style="font-size:14px;">Name: ${name}</td>
            </tr>

            <tr>
            <td style="font-size:14px; padding-bottom:10px;">Email: ${email}</td>
            </tr>

            <!-- DATE -->
            <tr>
            <td style="font-size:14px; padding-bottom:20px;">
                Date: ${new Date().toLocaleString()}
            </td>
            </tr>

            <!-- MESSAGE -->
            <tr>
            <td style="font-size:14px; font-weight:bold; color:#006aa8; padding-bottom:10px;">
                Message:
            </td>
            </tr>

            <tr>
            <td style="font-size:14px; background:#f7f7f7; padding:12px; border-radius:6px;">
                ${question}
            </td>
            </tr>

            <!-- FOOTER -->
            <tr>
            <td style="padding-top:30px; font-size:14px;">
                SignXpert System Notification
            </td>
            </tr>

            <tr>
            <td style="font-size:14px;">Best regards,</td>
            </tr>

            <tr>
            <td style="font-size:14px; padding-bottom:20px;">
                SignXpert Team
            </td>
            </tr>

            <!-- CONTACT -->
            <tr>
            <td align="right" style="font-size:13px;">
                <a href="https://sign-xpert.com" style="color:#0a58ff;">sign-xpert.com</a><br/>
                <a href="mailto:info@sign-xpert.com" style="color:#0a58ff;">info@sign-xpert.com</a><br/>
                +49 157 766 25 125
            </td>
            </tr>

        </table>

        </td>
    </tr>
    </table>

    </body>
    </html>
    `;

            await sendEmail(ADMIN_EMAIL, messageHTML, subject);
            const userMessageHTML = `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background:#f2f2f2; font-family: Arial, sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f2f2; padding:20px 0;">
  <tr>
    <td align="center">

      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; border-radius:8px; padding:24px;">

        <!-- LOGO -->
        <tr>
          <td align="center" style="padding-bottom:24px;">
            <img src="${logo}" alt="SignXpert" width="200" style="display:block;" />
          </td>
        </tr>

        <!-- TITLE -->
        <tr>
          <td align="center" style="font-size:22px; font-weight:600; padding-bottom:24px;">
            Thank you for contacting SignXpert
          </td>
        </tr>

        <!-- TEXT -->
        <tr>
          <td style="font-size:14px; padding-bottom:10px;">
            Hello ${name},
          </td>
        </tr>

        <tr>
          <td style="font-size:14px; padding-bottom:20px;">
            Thank you for contacting SignXpert.<br/>
            We have received your message and will get back to you as soon as possible.
          </td>
        </tr>

        <!-- MESSAGE COPY -->
        <tr>
          <td style="font-size:14px; padding-bottom:10px;">
            Here is a copy of your message:
          </td>
        </tr>

        <tr>
          <td style="font-size:14px; font-weight:bold; padding-bottom:8px;">
            Your message:
          </td>
        </tr>

        <tr>
          <td style="font-size:14px; background:#f7f7f7; padding:12px; border-radius:6px;">
            ${question}
          </td>
        </tr>

        <!-- INFO -->
        <tr>
          <td style="font-size:14px; padding-top:20px;">
            If your request is urgent, feel free to contact us directly.
          </td>
        </tr>

        <!-- SIGNATURE -->
        <tr>
          <td style="padding-top:30px; font-size:14px;">
            Best regards,
          </td>
        </tr>

        <tr>
          <td style="font-size:14px; padding-bottom:20px;">
            SignXpert Team
          </td>
        </tr>

        <!-- CONTACT -->
        <tr>
          <td align="right" style="font-size:13px;">
            <a href="https://sign-xpert.com" style="color:#0a58ff;">sign-xpert.com</a><br/>
            <a href="mailto:info@sign-xpert.com" style="color:#0a58ff;">info@sign-xpert.com</a><br/>
            +49 157 766 25 125
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>
`;
            await sendEmail(
                email,
                userMessageHTML,
                'SignXpert - We’ve received your message'
            );

            res.status(200).json({ success: true });
        } catch (err) {
            next(ErrorApi.badRequest(err));
        }
    };
}

export default SendEmailForStatus;