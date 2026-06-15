import ErrorApi from "../error/ErrorApi.js";
import sendEmail from "./utils/sendEmail.js";
import 'dotenv/config'; // для ES модулів
import puppeteer from 'puppeteer';
import { countryToLanguage, DEFAULT_LANGUAGE, t } from '../i18n/index.js';
import { localize } from '../i18n/localize.js';

// Derive UI language for a user (from saved language, fallback to country mapping, else default).
const userLang = (user) => user?.language || countryToLanguage(user?.country) || DEFAULT_LANGUAGE;
// Admin emails are operational notifications and must always stay in English.
const ADMIN_LANG = 'en';

// Build localized frontend URL (de has no prefix, others get /lang prefix).
const localizedUrl = (baseUrl, path = '', lang) => {
  const cleanBaseUrl = String(baseUrl || '').replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (lang === 'de') return `${cleanBaseUrl}${cleanPath}`;
  return `${cleanBaseUrl}/${lang}${cleanPath}`;
};
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
    buildPdfFooterTemplate,
    INTER_FONT_FACE_CSS,
    waitForPdfFonts
} from '../router/CartRouter.js';
import CartProject from "../models/CartProject.js";

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
        const urlHome=localizedUrl(urlFrontend, '', ADMIN_LANG);
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
                            <a href="${urlHome}" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">sign-xpert.com</a>
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
        sendEmail(ADMIN_EMAIL, messageHtml, subject, null, ADMIN_LANG)
    }

    static SendStatusPaid=async(order)=>{
        const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
        const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
        const user=order.user;
        const subject=`SignXpert - Payment Received  #${String(order.id).padStart(3, '0')} (${nameOrCompany})`;
        const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
        const lang = userLang(order.user);
        const urlAccount = localizedUrl(urlFrontend, 'account', lang);
        const urlOrders = localizedUrl(urlFrontend, 'account/detail', lang);
        const urlHome = localizedUrl(urlFrontend, '', lang);
        const orderInMongo=await findCartProjectForOrder(order);
        
        if(orderInMongo.checkout.paymentMethod!='invoice')return;

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
                                Simply log in to <a href="${urlAccount}" style="color: #0073bc; text-decoration: underline;">My Account</a> &rarr; <a href="${urlOrders}" style="color: #0073bc; text-decoration: underline;">My Orders</a>
                            </p>
                            
                            <p style="margin: 40px 0 5px 0;">Best regards,</p>
                            <p style="margin: 0 0 40px 0;">SignXpert Team</p>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="padding: 0 60px 40px 60px;">
                            <a href="${urlHome}" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">sign-xpert.com</a>
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
        sendEmail(order.user.email, messageHtml, subject, null, lang)
    }

    static SendUserNewPassword=async(user,newPassword)=>{
        const nameOrCompany=user.company?user.company:user.firstName;
        const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
        const subjectAdmin=`SignXpert - Password Recovery for ${nameOrCompany}`;
        const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
        const lang = userLang(user);
        const urlAccount = localizedUrl(urlFrontend, 'account', lang);
        const urlDetails = localizedUrl(urlFrontend, 'account/detail', lang);
        const urlHome = localizedUrl(urlFrontend, '', lang);
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
                                Simply log in to <a href="${urlAccount}" style="color: #0073bc; text-decoration: underline;">My Account</a> &rarr; <a href="${urlDetails}" style="color: #0073bc; text-decoration: underline;">My Details</a> in your account to update your password.
                            </p>
                            
                            <p style="margin: 0 0 25px 0;">If you didn't request a password reset, please ignore this email.</p>
                            
                            <p style="margin: 0 0 35px 0;">Thank you for using SignXpert!</p>
                            
                            <p style="margin: 0 0 5px 0;">Best regards,</p>
                            <p style="margin: 0 0 40px 0;">SignXpert Team</p>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="padding: 0 60px 40px 60px;">
                            <a href="${urlHome}" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">sign-xpert.com</a>
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
        const result = await sendEmail(user.email, messageHtml, subjectAdmin, null, lang);
        if (!result || result.status !== 200) {
            throw new Error(result?.message || 'Failed to send password recovery email');
        }
        return result;
    }
    static SendUserRegister=async(user)=>{
        const nameOrCompany=user.company?user.company:user.firstName;
        const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
        const ADMIN_EMAIL=process.env.ADMIN_EMAIL;
        const urlHome=localizedUrl(process.env.VITE_LAYOUT_FRONTEND_URL, '', ADMIN_LANG);
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
                            <a href="${urlHome}" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">sign-xpert.com</a>
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
        await sendEmail(ADMIN_EMAIL,messageHtmlToAdmin,subjectAdmin, null, ADMIN_LANG)
    }

    static SendToAdminNewOrder = async (newOrder, comment, countStar, typeDelivery) => {
        try {
            const order=newOrder;
            const orderNumber=String(order.id || '').padStart(3, '0');
            const nameOrCompany = order.user?.company || order.user?.firstName || 'Customer';
            const hasRating = Number.isFinite(Number(countStar)) && Number(countStar) > 0;
            const normalizedComment = String(comment || '').trim();
            const hasComment = normalizedComment.length > 0;
            const reviewSection = (hasRating || hasComment)
              ? `<div style="margin: 25px 0;">
                        <p>Rating: <span style="color: #FFD700; font-size: 20px;">${'★'.repeat(Math.max(0, Number(countStar) || 0))}</span></p>
                        <p>Comment: <span>${normalizedComment || '-'}</span></p>
                    </div>`
              : '';
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
                    ${reviewSection}
                    <p style="font-style: italic; color: #888;">SignXpert System Notification</p>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>`;

            
            await sendEmail(ADMIN_EMAIL, messageHtmlToAdmin, subjectAdmin, null, ADMIN_LANG);
            return true;
        }
        catch(err){
            console.error('Error in SendToAdminNewOrder Final Step:', err);
            return false;
        }
    }

    static SendEmailWithFile = async (newOrder, textHTML, subject, to) => {
        return;
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
            const cityLine = escapeHtml(
                [customerPostalCodeRaw, customerCityRaw].filter(hasContent).join(' ')
            );
            const countryLine = escapeHtml(customerCountryRaw);
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
            const subtotal = Number.isFinite(Number(checkout?.canvasSubtotal)) && Number(checkout.canvasSubtotal) > 0
                ? round2(Number(checkout.canvasSubtotal))
                : round2(netAmount + discountAmount);
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
        
            const vatIdMarkup = vatNumber ? `<tr><td>VAT ID:</td><td>${vatNumber}</td></tr>` : '';
        
            const logoPng = process.env.VITE_LAYOUT_SERVER + 'images/images/logo.png';


            const htmlContent = `
        <!DOCTYPE html>
        <html lang="uk">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoice - SignXpert</title>
            <style>
                ${INTER_FONT_FACE_CSS}
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
                width: 83mm;
                max-width: 95mm;
                height: auto;
                }
                .svg-logo img { width: 100%; height: auto; display:block; }
        
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
                    <div class="svg-logo"><img src="${logoPng}" alt="SignXpert"></div>
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
                ${addressLine3 ? `${addressLine3}<br>` : ''}
                ${cityLine ? `${cityLine}<br>` : ''}
                ${countryLine ? `${countryLine}<br>` : ''}
                </div>
                <div class="details-block">
                <table class="details-table">
                    <tr><td><strong>Invoice No:</strong></td><td><strong>${invoiceNumber}</strong></td></tr>
                    <tr><td>Customer No:</td><td>${customerNumber}</td></tr>
                    ${vatIdMarkup}
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
                <tr><td>Discount (${displayDiscountPercent.toFixed(0)} %)</td><td class="money-cell">€&nbsp;${formatMoney(discountAmount)}</td></tr>
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
                <div>Account holder:</div><div>Kostyantyn Utvenko</div>
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
                        <td>USt-IdNr.:</td>
                        <td class="footer-value-cell">DE461817538 Gemäß § 19 UStG wird keine Umsatzsteuer berechnet/</td>
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
            await waitForPdfFonts(page);
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
                discountAmount,
                shippingCost,
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

            await sendEmail(to, textHTML, subject, outputPdfBuffer)

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

            sendEmail(to, textHTML, subject, fileAttachment, userLang(newOrder?.user))

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
            const lang = userLang(order.user);
            const urlAccount=localizedUrl(urlFrontend, 'account/detail', lang);
            const urlOrders=localizedUrl(urlFrontend, 'account', lang);
            const urlHome=localizedUrl(urlFrontend, '', lang);
            const orLabel = t('email.common.or', lang);
            
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
                            We have received your order and will check that everything looks correct with your project. If we have any questions, we will contact you.
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
                        <td style="font-size: 16px; line-height: 1.6;">
                            If you notice anything that needs correction, please contact us as soon as possible.
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6;">
                            As soon as your order has been produced, packed, and shipped, you will receive a separate email with your tracking number. The invoice will be attached to that email.
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 40px;">
                            If you have any questions or need any assistance, we are always happy to help.
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
                            <a href="${urlHome}" style="color: #0056b3; text-decoration: underline;">sign-xpert.com</a><br>
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
            await sendEmail(to, html, subject, null, userLang(order.user));
            return true;
        }catch(err){
            console.error('error send email where create order.'+err);
            return false
        }
    }
    static StatusPrinted=async(order)=>{
        try{
            return;
            const orderNumber=String(order.id).padStart(3, '0')
            const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
            const subject=`SignXpert - Order Confirmation #${orderNumber} ${nameOrCompany}`;
            const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
            const create=formatDate(order.createdAt);
            const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
            const lang = userLang(order.user);
            const urlAccount=localizedUrl(urlFrontend, 'account/detail', lang);
            const urlOrders=localizedUrl(urlFrontend, 'account', lang);
            const urlHome=localizedUrl(urlFrontend, '', lang);
            
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
                                <a href="${urlHome}" style="color: #0056b3; text-decoration: none;">sign-xpert.com</a>
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
            await sendEmail(to,html,subject, null, lang);
        }catch(err){
            console.error('error send email where status printed.'+err);
            return false
        }
    }

   static StatusShipped = async (order) => {
    try {
        return;
        const orderNumber = String(order.id).padStart(3, '0');
        const nameOrCompany = order.user.company ? order.user.company : order.user.firstName;
        const fullName = [order.user.firstName, order.user.surname].filter(Boolean).join(' ');
        const companyDisplay = order.user.company ? `, (${order.user.company})` : '';
        
        const subject = `SignXpert - Order Shipped #${orderNumber} ${nameOrCompany}`;
        const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
        const urlFrontend = process.env.VITE_LAYOUT_FRONTEND_URL;
        const lang = userLang(order.user);
        const urlAccount = localizedUrl(urlFrontend, 'account/detail', lang);
        const urlOrders = localizedUrl(urlFrontend, 'account', lang);
        const urlHome = localizedUrl(urlFrontend, '', lang);
        
        const trackingNumber = order.trackingNumber || '';
        const trackingUrl = trackingNumber
          ? `https://www.ups.com/track?tracknum=${trackingNumber}`
          : 'https://www.ups.com/track';

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
                            
                            ${trackingNumber ? `<p style="margin: 0 0 20px 0;">Tracking number: <strong>${trackingNumber}</strong></p>` : ''}

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

                            ${trackingNumber ? `<p style="margin: 0 0 20px 0;">Please note that it may take some time for the tracking number to become active in the UPS system. Once active, you can follow the journey of your package and see its current status.</p>` : ''}
                            
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
                            <a href="${urlHome}" style="display: block; color: #0073bc; text-decoration: underline; font-size: 14px; margin-bottom: 4px;">sign-xpert.com</a>
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
        await sendEmail(to, html, subject, null, lang);

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
            const lang = userLang(order.user);
            const urlAccount=localizedUrl(urlFrontend, 'account/detail', lang);
            const urlOrders=localizedUrl(urlFrontend, 'account', lang);
            const payment_url=localizedUrl(urlFrontend, `account/pay/${order.id}`, lang)
            const urlHome=localizedUrl(urlFrontend, '', lang);
            const orLabel = t('email.common.or', lang);
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
                            <a href="${urlHome}" style="color: #006DA5;">www.sign-xpert.com</a><br>
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
                                ${orLabel}<br>
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
                                <a href="${urlHome}" style="color: #006DA5; text-decoration: none;">sign-xpert.com</a>
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
            const key = String(order?.idMongo || '').trim();
            const mongoRes=await CartProject.findById(key,'checkout.invoiceEmail');
            const emails=mongoRes.checkout.invoiceEmail;
            console.log(4234,emails);
            console.log(emails.split(','));
            emails.split(',').forEach(x=>SendEmailForStatus.SendEmailWithFile(order,html,subject,x))
            //await sendEmail(to,html,subject);
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
            const lang = userLang(order.user);
            const urlAccount=localizedUrl(urlFrontend, 'account/detail', lang);
            const urlOrders=localizedUrl(urlFrontend, 'account', lang);
            const contact=localizedUrl(urlFrontend, 'contacts', lang)
            const urlHome=localizedUrl(urlFrontend, '', lang);
            
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
                                <a href="${urlHome}" style="color: #006DA5; text-decoration: none;">sign-xpert.com</a>
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

            await Promise.all(recipients.map((to) => sendEmail(to, html, subject, null, lang)));
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
            const lang = userLang(order.user);
            const urlAccount=localizedUrl(urlFrontend, 'account/detail', lang);
            const urlOrders=localizedUrl(urlFrontend, 'account', lang);
            const contact=localizedUrl(urlFrontend, 'contacts', lang)
            const urlHome=localizedUrl(urlFrontend, '', lang);
            
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
                <a href="${urlHome}" style="color: #0066cc; text-decoration: underline; display: block; margin-bottom: 5px;">sign-xpert.com</a>
                <a href="mailto:info@sign-xpert.com" style="color: #0066cc; text-decoration: underline; display: block; margin-bottom: 5px;">info@sign-xpert.com</a>
                <p style="margin: 0; color: #333333;">+49 157 766 25 125</p>
            </td>
        </tr>
    </table>
</body>
</html>`
            const to=order.user.email;
            await sendEmail(to,html,subject, null, lang);
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
            const lang = userLang(order.user);
            const urlAccount=localizedUrl(urlFrontend, 'account/detail', lang);
            const urlOrders=localizedUrl(urlFrontend, 'account', lang);
            const contact=localizedUrl(urlFrontend, 'contacts', lang)
            const payURL=localizedUrl(urlFrontend, `account/pay/${order.id}`, lang);
            const urlHome=localizedUrl(urlFrontend, '', lang);
            const outstandingNote = t('email.reminder.outstandingNote', lang, { orderNumber });
            const paymentStatusNote = t('email.reminder.paymentStatusNote', lang);
            const myOrdersLabel = t('common.myOrders', lang);
            const orLabel = t('email.common.or', lang);
            
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

                <p>${outstandingNote}</p>

                <p>You can also view and settle your invoice at any time via our website:<br>
                <a href="${urlHome}" style="color: #0066cc; text-decoration: underline;">www.sign-xpert.com</a><br>
                Simply log in and navigate to:</p>

                <p style="font-weight: bold;">
                    <a href="${urlAccount}" style="color: #0066cc; text-decoration: underline;">My Account</a> &rarr; <a href="${urlOrders}" style="color: #0066cc; text-decoration: underline;">My Orders</a>
                </p>

                <p>Select the relevant order and click <strong>"Pay"</strong></p>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                    <tr>
                        <td bgcolor="#006eb3" style="border-radius: 6px; text-align: center;">
                            <a href="${payURL}" style="background-color: #006eb3; border: 1px solid #005a94; border-radius: 6px; color: #ffffff !important; display: inline-block; font-size: 16px; font-weight: bold; padding: 12px 60px; text-decoration: none !important; text-transform: uppercase;"><span style="color: #ffffff !important; text-decoration: none !important;">Pay</span></a>
                        </td>
                    </tr>
                </table>

                <p style="margin-top: 25px;">Multiple secure payment methods are available directly in your account.</p>

                <p>If you prefer to pay by bank transfer, please use the bank details provided on the invoice and make sure to quote:</p>

                <p style="margin: 0;"><strong>Order number: ${orderNumber}</strong></p>
                <p style="margin: 5px 0;">${orLabel}</p>
                <p style="margin: 0;"><strong>Customer number: ${String(order.user.id).padStart(3, '0')}</strong></p>

                <p>This helps us allocate your payment correctly.</p>

                <p>Should you wish to update your billing address or the email address used for receiving invoices, you can do so in:</p>
                <p style="font-weight: bold;">
                    <a href="${urlAccount}" style="color: #0066cc; text-decoration: underline;">My Account</a> &rarr; <a href="${urlOrders}" style="color: #0066cc; text-decoration: underline;">My Details</a>
                </p>

                <p>${paymentStatusNote} <a href="${urlOrders}" style="color: #0066cc; text-decoration: underline;">"${myOrdersLabel}"</a>.</p>

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
                            <a href="${urlHome}" style="color: #0066cc; text-decoration: underline; display: block; margin-bottom: 4px;">sign-xpert.com</a>
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
            const name = String(req.body?.name || '').trim();
            const email = String(req.body?.email || '').trim();
            const question = String(req.body?.question || '').trim();

            if (!email || !question) {
                throw ErrorApi.badRequest('Missing required fields');
            }

            const logo = process.env.VITE_LAYOUT_SERVER + 'images/images/logo.png';
            const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
            const urlFrontend = process.env.VITE_LAYOUT_FRONTEND_URL;
            const adminUrlHome = localizedUrl(urlFrontend, '', ADMIN_LANG);
            const userUrlHome = localizedUrl(urlFrontend, '', DEFAULT_LANGUAGE);

            if (!ADMIN_EMAIL) {
                throw ErrorApi.badRequest('Admin email is not configured');
            }

            const safeName = escapeHtml(name || 'Not provided');
            const safeEmail = escapeHtml(email);
            const safeQuestion = escapeHtml(question);
            const subject = `Request from contact page: ${name || email} (${email})`;

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
            <td style="font-size:14px;">Name: ${safeName}</td>
            </tr>

            <tr>
            <td style="font-size:14px; padding-bottom:10px;">Email: ${safeEmail}</td>
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
                ${safeQuestion}
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
                <a href="${adminUrlHome}" style="color:#0a58ff;">sign-xpert.com</a><br/>
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

            await sendEmail(ADMIN_EMAIL, messageHTML, subject, null, ADMIN_LANG);
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
            Hello${name ? ` ${safeName}` : ''},
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
            ${safeQuestion}
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
            <a href="${userUrlHome}" style="color:#0a58ff;">sign-xpert.com</a><br/>
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
