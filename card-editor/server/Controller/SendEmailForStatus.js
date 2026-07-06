import ErrorApi from "../error/ErrorApi.js";
import sendEmail from "./utils/sendEmail.js";
import 'dotenv/config'; // для ES модулів
import { countryToLanguage, DEFAULT_LANGUAGE, normalizeLanguage, t } from '../i18n/index.js';
import { localize } from '../i18n/localize.js';
import { generateInvoicePdfBuffer } from '../utils/invoicePdf.js';
import { formatMoneyDisplay } from '../utils/formatMoneyDisplay.js';

// Derive UI language for a user (from saved language, fallback to country mapping, else default).
const userLang = (user) => normalizeLanguage(user?.language || countryToLanguage(user?.country) || DEFAULT_LANGUAGE);
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
                            
                            <p style="margin: 0 0 5px 0;">Best regards</p>
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
        const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
        const lang = userLang(order.user);
        const subject=`${t('email.paymentReceived.userSubject', lang)} #${String(order.id).padStart(3, '0')} (${nameOrCompany})`;
        const urlAccount = localizedUrl(urlFrontend, 'account', lang);
        const urlOrders = localizedUrl(urlFrontend, 'account/detail', lang);
        const urlHome = localizedUrl(urlFrontend, '', lang);
        const orderInMongo=await findCartProjectForOrder(order);
        
        if(orderInMongo.checkout.paymentMethod!='invoice')return;

        const messageHtml=`<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('email.paymentReceived.userTitle', lang)}</title>
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
                            <h2 style="margin: 0; color: #000000; font-size: 20px; font-weight: normal;">${t('email.paymentReceived.userHeading', lang)} - #${String(order.id).padStart(3, '0')}</h2>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 10px 60px; color: #000000; font-size: 15px; line-height: 1.5;">
                            
                            <p style="margin: 0 0 25px 0;">${t('common.helloComma', lang)} ${user.firstName}, ${user.company?`(${user.company})`:''}</p>
                            
                            <p style="margin: 0 0 10px 0;">${t('email.paymentReceived.thankYou', lang)}</p>
                            <p style="margin: 0 0 25px 0;">${t('email.paymentReceived.successfullyReceived', lang)} #${String(order.id).padStart(3, '0')}.</p>
                            
                            <p style="margin: 0 0 5px 0;">${t('common.totalAmountLabel', lang)} <strong>${formatMoneyDisplay(order.sum)}</strong></p>
                        
                            <p style="margin: 0 0 25px 0;">
                                ${t('email.paymentReceived.checkStatus', lang)}<br>
                                ${t('email.paymentReceived.simplyLogIn', lang)} <a href="${urlAccount}" style="color: #0073bc; text-decoration: underline;">${t('common.myAccount', lang)}</a> &rarr; <a href="${urlOrders}" style="color: #0073bc; text-decoration: underline;">${t('common.myOrders', lang)}</a>
                            </p>
                            
                            <p style="margin: 40px 0 5px 0;">${t('common.bestRegards', lang)}</p>
                            <p style="margin: 0 0 40px 0;">${t('common.signxpertTeam', lang)}</p>
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
        const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
        const lang = userLang(user);
        const subjectAdmin=`${t('email.password.subject', lang)} ${nameOrCompany}`;
        const urlAccount = localizedUrl(urlFrontend, 'account', lang);
        const urlDetails = localizedUrl(urlFrontend, 'account/detail', lang);
        const urlHome = localizedUrl(urlFrontend, '', lang);
        const messageHtml=`<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('email.password.title', lang)}</title>
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
                            <h2 style="margin: 0; color: #000000; font-size: 20px; font-weight: normal;">${t('email.password.heading', lang)}</h2>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 10px 60px; color: #000000; font-size: 15px; line-height: 1.5;">
                            
                            <p style="margin: 0 0 25px 0;">${t('common.helloComma', lang)} ${user.firstName}, ${user.company?`(${user.company})`:''}</p>
                            
                            <p style="margin: 0 0 25px 0;">${t('common.customerNumberLabel', lang)} ${String(user.id).padStart(3, '0')}</p>
                            
                            <p style="margin: 0 0 25px 0;">${t('email.password.requestIntro', lang)}</p>
                            
                            <p style="margin: 0 0 25px 0;">
                                ${t('email.password.temporaryIs', lang)}<br>
                                ${newPassword}
                            </p>

                            <p style="margin: 0 0 25px 0;">
                                ${t('email.password.securityNote', lang)}<br>
                                ${t('email.password.simplyLogIn', lang)} <a href="${urlAccount}" style="color: #0073bc; text-decoration: underline;">${t('common.myAccount', lang)}</a> &rarr; <a href="${urlDetails}" style="color: #0073bc; text-decoration: underline;">${t('common.myDetails', lang)}</a> ${t('email.password.inYourAccount', lang)}
                            </p>
                            
                            <p style="margin: 0 0 25px 0;">${t('email.password.ifNotRequest', lang)}</p>
                            
                            <p style="margin: 0 0 35px 0;">${t('common.thankYouForUsing', lang)}</p>
                            
                            <p style="margin: 0 0 5px 0;">${t('common.bestRegards', lang)}</p>
                            <p style="margin: 0 0 40px 0;">${t('common.signxpertTeam', lang)}</p>
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
                            
                            <p style="margin: 0 0 5px 0;">Best regards</p>
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
                        <p>Total amount: <strong>${formatMoneyDisplay(order.sum)}</strong></p>
                        <p>Payment status: <strong>${order.isPaid?'pay':'un paid'}</strong></p>
                        <p>Delivery type: <strong>${order.deliveryType}</strong></p>
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

    static SendEmailWithFile = async (newOrder, textHTML, subject, to, lang = userLang(newOrder?.user)) => {
        const order = newOrder; // ��� �������� � ������ � getPdfs3
        const orderNumber = String(order.id).padStart(3, '0');

        try {
            const orderMongo = await findCartProjectForOrder(order);
            const outputPdfBuffer = await generateInvoicePdfBuffer({ order, orderMongo, lang });
            const fileAttachment = {
                filename: `invoice-${orderNumber}.pdf`,
                content: outputPdfBuffer,
                contentType: 'application/pdf',
            };

            await sendEmail(to, textHTML, subject, fileAttachment, lang);
            return true;
        } catch (err) {
            console.error('Error in SendToAdminNewOrder Final Step:', err);
            return false;
        }

    }

        static CreateOrder=async(order)=>{
        try{
            const orderNumber=String(order.id).padStart(3, '0')
            const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
            const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
            const create=formatDate(order.createdAt);
            const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
            const lang = userLang(order.user);
            const subject=`${t('email.created.subject', lang)} #${orderNumber} ${nameOrCompany}`;
            const urlAccount=localizedUrl(urlFrontend, 'account/detail', lang);
            const urlOrders=localizedUrl(urlFrontend, 'account', lang);
            const urlHome=localizedUrl(urlFrontend, '', lang);
            
            const html=`
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('email.created.title', lang)}</title>
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
                            <h2 style="font-size: 22px; margin: 0; color: #000; font-weight: bold;">${t('email.created.heading', lang)}</h2>
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 20px;">
                            ${t('common.helloComma', lang)} <span style="color: #337ab7;">${nameOrCompany}</span>!
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 20px;">
                            ${t('email.created.thankYou', lang)}
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 25px;">
                            ${t('email.created.body1', lang)}
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.8; padding-bottom: 25px;">
                            <strong>${t('common.orderNoLabel', lang)}</strong> ${orderNumber}<br>
                            <strong>${t('common.customerNoLabel', lang)}</strong> ${String(order.user.id).padStart(3, '0')}<br>
                            <strong>${t('common.orderDateLabel', lang)}</strong> ${create}
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 25px;">
                            ${t('email.created.followStatus', lang)}<br>
                            ${t('email.created.simplyLogInWhereView', lang)} <a href="${urlAccount}" style="color: #0056b3; text-decoration: underline;">${t('common.myAccount', lang)}</a> &rarr; <a href="${urlOrders}" style="color: #0056b3; text-decoration: underline;">${t('common.myOrders', lang)}</a>, ${t('email.created.whereYouCanView', lang)}
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>${t('email.created.listOrderStatus', lang)}</li>
                                <li>${t('email.created.listInvoice', lang)}</li>
                                <li>${t('email.created.listProjectDetails', lang)}</li>
                                <li>${t('email.created.listDeliveryInformation', lang)}</li>
                            </ul>
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6;">
                            ${t('email.created.contactCorrection', lang)}
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6;">
                            ${t('email.created.shipmentReady', lang)}
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 40px;">
                            ${t('email.created.anyQuestions', lang)}
                        </td>
                    </tr>

                    <tr>
                        <td style="font-size: 16px; line-height: 1.6; padding-bottom: 40px;">
                            ${t('common.bestRegards', lang)}<br>
                            <strong>${t('common.signxpertTeam', lang)}</strong>
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
                                Best regards<br>
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
                            
                            <p style="margin: 0 0 5px 0;">Best regards</p>
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
            const lang = userLang(order.user);
            const orderNumber=String(order.id).padStart(3, '0')
            const customerNumber=String(order.user.id).padStart(3, '0')
            const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
            const registeredName=[order.user.firstName, order.user.surname].filter(Boolean).join(' ') || nameOrCompany;
            const companyName=order.user.company || '';
            const subject=`${t('email.invoice.subject', lang)} #${orderNumber} ${t('email.invoice.subjectFor', lang)} ${nameOrCompany}`;
            const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
            const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
            const trackingNumber=String(order.trackingNumber || '').trim();
            const trackingUrl=trackingNumber
                ? `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`
                : 'https://www.ups.com/track';
            const urlAccount=localizedUrl(urlFrontend, 'account/detail', lang);
            const urlOrders=localizedUrl(urlFrontend, 'account', lang);
            const payment_url=localizedUrl(urlFrontend, `account/pay/${order.id}`, lang)
            const urlHome=localizedUrl(urlFrontend, '', lang);
            const orLabel = t('email.common.or', lang);
            const html=`
<!DOCTYPE html>
<html lang="${lang}">
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #ffffff;">

    <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="width: 600px; margin: 0 auto; padding: 20px;">
        <tr>
            <td align="center" style="padding-bottom: 30px;">
                <img src="${logoPng}" alt="SignXpert" width="275" style="display: block; border: 0; max-width: 275px; height: auto;">
            </td>
        </tr>

        <tr>
            <td align="center" style="font-size: 20px; font-weight: 450; color: #000000; padding-bottom: 20px; text-decoration: underline;">
                ${t('email.invoice.headingAttached', lang)}
            </td>
        </tr>

        <tr>
            <td style="font-size: 16px; color: #000000; line-height: 1.5; padding-bottom: 20px;">
                ${t('email.invoice.helloComma', lang)} <span style="color: #006CA4; font-weight: 400;">${escapeHtml(registeredName)}</span>${companyName ? `, <span style="color: #006CA4; font-weight: 400;">${escapeHtml(companyName)}</span>` : ''},<br><br>
                ${t('email.invoice.attached', lang)}<br>
                ${t('email.invoice.viewSettleIntro', lang)} <a href="https://sign-xpert.com" style="color: #006CA4; text-decoration: none;">${t('common.wwwSignXpertCom', lang)}</a><br>
                ${t('email.invoice.simplyLogInGoTo', lang)}<br>
                <a href="${urlAccount}" style="color: #006CA4; text-decoration: none;">${t('email.invoice.myAccount', lang)}</a>
                &rarr; <a href="${urlOrders}" style="color: #006CA4; text-decoration: none;">${t('email.invoice.myOrders', lang)}</a>
                &rarr; <a href="${payment_url}" style="color: #006CA4; text-decoration: none;">${t('email.invoice.payButton', lang)}</a><br>
                ${t('email.invoice.multiplePaymentMethods', lang)}<br>
                ${t('email.invoice.bankTransferQuote', lang)}<br><br>
                ${t('email.invoice.orderNumberLabel', lang)} ${orderNumber}<br>
                ${t('email.invoice.or', lang)}<br>
                ${t('email.invoice.customerNumberLabel', lang)} ${customerNumber}<br><br>
                ${t('email.invoice.helpAllocate', lang)}<br><br>
                <b>${t('email.invoice.alreadyPaidDisregardPaymentInfo', lang)}</b>
            </td>
        </tr>

        <tr>
            <td align="center" style="padding: 20px 0 30px 0;">
                <a href="${payment_url}" style="background-color: #006CA4; color: #ffffff; padding: 12px 40px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">${t('email.invoice.payButtonUpper', lang)}</a>
            </td>
        </tr>

        <tr>
            <td align="center" style="font-size: 20px; font-weight: 450; color: #000000; padding: 10px 0 20px 0;">
                <span style="border-bottom: 1px solid #000000;">${t('email.invoice.shippedHeadingLine1', lang)}</span><br>
                <span style="border-bottom: 1px solid #000000;">${t('email.invoice.shippedHeadingLine2', lang)}</span>
            </td>
        </tr>

        <tr>
            <td style="font-size: 16px; color: #000000; line-height: 1.5; padding-top: 20px; padding-bottom: 20px;">
                ${t('email.invoice.trackingNumberLabel', lang)} ${trackingNumber ? escapeHtml(trackingNumber) : ''}<br>
                ${t('email.invoice.trackBelow', lang)}
            </td>
        </tr>

        <tr>
            <td align="center" style="padding: 20px 0 30px 0;">
                <a href="${trackingUrl}" style="background-color: #006CA4; color: #ffffff; padding: 12px 20px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">${t('email.invoice.ctaTrack', lang)}</a>
            </td>
        </tr>

        <tr>
            <td style="font-size: 16px; color: #000000; line-height: 1.5; padding-bottom: 30px;">
                ${t('email.invoice.upsActiveNote', lang)}<br><br>
                ${t('email.invoice.checkDetailedStatus', lang)}<br><br>
                ${t('email.invoice.thankYouEnjoy', lang)}<br><br>
                ${t('email.invoice.questionsAssistance', lang)}
            </td>
        </tr>

        <tr>
            <td style="font-size: 16px; color: #000000; padding-bottom: 30px;">
                ${t('email.invoice.bestRegards', lang)}<br>
                ${t('email.invoice.signxpertTeam', lang)}
            </td>
        </tr>

        <tr>
            <td style="border-top: 1px solid #eeeeee; padding-top: 20px; text-align: right; font-size: 14px; color: #001CD3;">
                <a href="https://sign-xpert.com" style="color: #001CD3; text-decoration: none;">sign-xpert.com</a><br>
                <a href="mailto:info@sign-xpert.com" style="color: #001CD3; text-decoration: none;">info@sign-xpert.com</a><br>
                <a href="tel:+4915776625125" style="color: #001CD3; text-decoration: none;">+49 157 766 25 125</a>
            </td>
        </tr>
    </table>
</body>
</html>
`
            const key = String(order?.idMongo || '').trim();
            const mongoRes=key ? await CartProject.findById(key,'checkout.invoiceEmail') : null;
            const invoiceRecipients = parseEmailList(mongoRes?.checkout?.invoiceEmail);
            const recipientSource = invoiceRecipients.length ? invoiceRecipients : parseEmailList(order.user.email);
            const seenRecipients = new Set();
            const recipients=recipientSource
                .filter((email) => {
                    const normalized = normalizeEmail(email);
                    if (!normalized || seenRecipients.has(normalized)) return false;
                    seenRecipients.add(normalized);
                    return true;
                });
            await Promise.all(recipients.map((to)=>SendEmailForStatus.SendEmailWithFile(order,html,subject,to,lang)));
            return true;
        }catch(err){
            console.error('error send email where status shipped2.'+err);
            return false
        }
    }
    static StatusDelivered = async (order) => {
        try{
            const orderNumber=String(order.id).padStart(3, '0')
            const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
            const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
            const create=formatDate(order.createdAt);
            const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
            const lang = userLang(order.user);
            const subject=`${t('email.delivered.subject', lang)} #${orderNumber} ${nameOrCompany}`;
            const urlAccount=localizedUrl(urlFrontend, 'account/detail', lang);
            const urlOrders=localizedUrl(urlFrontend, 'account', lang);
            const contact=localizedUrl(urlFrontend, 'contacts', lang)
            const urlHome=localizedUrl(urlFrontend, '', lang);
            
            const html=`
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('email.delivered.title', lang)}</title>
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
                            <h1 style="font-size: 22px; color: #000000; margin: 0; font-weight: bold;">${t('email.delivered.heading', lang)}</h1>
                        </td>
                    </tr>

                    <tr>
                        <td class="content" align="left" style="padding: 0 40px 30px 40px; color: #333333; font-size: 15px; line-height: 1.6;">
                            <p>${t('common.helloComma', lang)} <strong>${nameOrCompany}</strong>!</p>

                            <p>${t('email.shipped.goodNews', lang)}<br>
                            ${t('email.delivered.goodNewsDelivered', lang)}</p>

                            <p>${t('email.delivered.hopeExpectations', lang)}</p>

                            <p>${t('email.delivered.askForReview', lang)}</p>

                            <table border="0" cellspacing="0" cellpadding="0" style="margin: 30px auto;">
                                <tr>
                                    <td align="center" bgcolor="#006DA5" style="border-radius: 8px;">
                                        <a href="{review_url}" target="_blank" style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 40px; border-radius: 8px; border: 1px solid #006DA5; display: inline-block; font-weight: bold;">
                                            ${t('email.delivered.ctaLeaveReview', lang)}
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p>${t('email.delivered.contactIfUnusual', lang)} <a href="${contact}" style="color: #006DA5;">${t('email.delivered.contactWord', lang)}</a> ${t('email.delivered.usHelp', lang)}</p>

                            <p style="margin-top: 25px;">
                                <strong>${t('common.thankYouForWorking', lang)}</strong><br>
                                <strong>${t('email.delivered.welcomeBack', lang)}</strong>
                            </p>

                            <p style="margin-top: 30px;">
                                ${t('common.bestRegards', lang)}<br>
                                <strong>${t('common.signxpertTeam', lang)}</strong>
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
            const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
            const create=formatDate(order.createdAt);
            const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
            const lang = userLang(order.user);
            const subject=`${t('email.errorDelivery.subject', lang)} #${orderNumber} ${nameOrCompany}`;
            const urlAccount=localizedUrl(urlFrontend, 'account/detail', lang);
            const urlOrders=localizedUrl(urlFrontend, 'account', lang);
            const contact=localizedUrl(urlFrontend, 'contacts', lang)
            const urlHome=localizedUrl(urlFrontend, '', lang);
            
            const html=`
<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('email.errorDelivery.title', lang)}</title>
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
                <h1 style="font-size: 22px; color: #000000; margin: 0;">${t('email.errorDelivery.heading', lang)}</h1>
            </td>
        </tr>

        <tr>
            <td style="padding: 20px 40px; font-size: 16px; line-height: 1.6; color: #333333;">
                <p>${t('common.helloComma', lang)} <span style="color: #0066cc;">${nameOrCompany}</span>!</p>

                <p>${t('email.errorDelivery.carrierReport', lang)}</p>

                <p style="margin-bottom: 10px;">${t('email.errorDelivery.mayOccur', lang)}</p>
                <ul style="margin-top: 0; padding-left: 20px;">
                    <li>${t('email.errorDelivery.reasonIncorrect', lang)}</li>
                    <li>${t('email.errorDelivery.reasonFailed', lang)}</li>
                    <li>${t('email.errorDelivery.reasonReturned', lang)}</li>
                </ul>

                <p>${t('email.errorDelivery.contactConfirm', lang)}</p>

                <p>${t('email.errorDelivery.updateCarrier', lang)}</p>
            </td>
        </tr>

        <tr>
            <td style="padding: 20px 40px 40px 40px; font-size: 16px; color: #333333;">
                <p style="margin: 0;">${t('common.bestRegards', lang)}</p>
                <p style="margin: 5px 0 0 0; font-weight: bold;">${t('common.signxpertTeam', lang)}</p>
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
            const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
            const create=formatDate(order.createdAt);
            const urlFrontend=process.env.VITE_LAYOUT_FRONTEND_URL;
            const lang = userLang(order.user);
            const subject=`${t('email.reminder.subject', lang)} #${orderNumber} ${nameOrCompany}`;
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
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('email.reminder.title', lang)}</title>
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
                <h1 style="font-size: 20px; color: #000000; margin: 0;">${t('email.reminder.heading', lang)}</h1>
            </td>
        </tr>

        <tr>
            <td style="padding: 20px 40px; font-size: 15px; line-height: 1.5; color: #333333;">
                <p>${t('common.helloComma', lang)} <span style="color: #0066cc;">${nameOrCompany}</span>!</p>
                <p>${t('email.reminder.enjoyingSigns', lang)}</p>

                <p>${outstandingNote}</p>

                <p>${t('email.invoice.viewSettleIntro', lang)}<br>
                <a href="${urlHome}" style="color: #0066cc; text-decoration: underline;">www.sign-xpert.com</a><br>
                ${t('email.invoice.simplyLogInNavigate', lang)}</p>

                <p style="font-weight: bold;">
                    <a href="${urlAccount}" style="color: #0066cc; text-decoration: underline;">${t('common.myAccount', lang)}</a> &rarr; <a href="${urlOrders}" style="color: #0066cc; text-decoration: underline;">${t('common.myOrders', lang)}</a>
                </p>

                <p>${t('email.invoice.selectClickPay', lang)} <strong>"${t('common.payButton', lang)}"</strong></p>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                    <tr>
                        <td bgcolor="#006eb3" style="border-radius: 6px; text-align: center;">
                            <a href="${payURL}" style="background-color: #006eb3; border: 1px solid #005a94; border-radius: 6px; color: #ffffff !important; display: inline-block; font-size: 16px; font-weight: bold; padding: 12px 60px; text-decoration: none !important; text-transform: uppercase;"><span style="color: #ffffff !important; text-decoration: none !important;">${t('common.payButton', lang)}</span></a>
                        </td>
                    </tr>
                </table>

                <p style="margin-top: 25px;">${t('email.invoice.multiplePaymentMethods', lang)}</p>

                <p>${t('email.invoice.bankTransferQuote', lang)}</p>

                <p style="margin: 0;"><strong>${t('email.invoice.orderNumberLabel', lang)} ${orderNumber}</strong></p>
                <p style="margin: 5px 0;">${orLabel}</p>
                <p style="margin: 0;"><strong>${t('email.invoice.customerNumberLabel', lang)} ${String(order.user.id).padStart(3, '0')}</strong></p>

                <p>${t('email.invoice.helpAllocate', lang)}</p>

                <p>${t('email.invoice.updateBilling', lang)}</p>
                <p style="font-weight: bold;">
                    <a href="${urlAccount}" style="color: #0066cc; text-decoration: underline;">${t('common.myAccount', lang)}</a> &rarr; <a href="${urlOrders}" style="color: #0066cc; text-decoration: underline;">${t('common.myDetails', lang)}</a>
                </p>

                <p>${paymentStatusNote} <a href="${urlOrders}" style="color: #0066cc; text-decoration: underline;">"${myOrdersLabel}"</a>.</p>

                <p>${t('common.thankYouAgainForChoosing', lang)}<br>
                <strong>${t('email.reminder.appreciateBusiness', lang)}</strong></p>
            </td>
        </tr>

        <tr>
            <td style="padding: 20px 40px 40px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="font-size: 15px; color: #333333;">
                            <p style="margin: 0;">${t('common.bestRegards', lang)}</p>
                            <p style="margin: 5px 0 0 0; font-weight: bold;">${t('common.signxpertTeam', lang)}</p>
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
            await SendEmailForStatus.SendEmailWithFile(order,html, subject, to, lang);
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
            const lang = normalizeLanguage(req.body?.language || String(req.headers?.['accept-language'] || '').split(',')[0] || DEFAULT_LANGUAGE);
            const adminUrlHome = localizedUrl(urlFrontend, '', ADMIN_LANG);
            const userUrlHome = localizedUrl(urlFrontend, '', lang);

            if (!ADMIN_EMAIL) {
                throw ErrorApi.badRequest('Admin email is not configured');
            }

            const safeName = escapeHtml(name || 'Not provided');
            const safeEmail = escapeHtml(email);
            const safeQuestion = escapeHtml(question);
            const subject = `${t('email.contact.subjectPrefix', ADMIN_LANG)} ${name || email} (${email})`;
            const userTitle = t('email.contact.userTitle', lang);
            const userIntro = t('email.contact.userIntro', lang);
            const userReceived = t('email.contact.userReceived', lang);
            const userCopyHeading = t('email.contact.copyHeading', lang);
            const userMessageLabel = t('email.contact.yourMessageLabel', lang);
            const userUrgentNote = t('email.contact.urgentNote', lang);
            const userBestRegards = t('common.bestRegards', lang);
            const userTeam = t('common.signxpertTeam', lang);
            const userHello = name ? `${t('common.helloComma', lang)} ${safeName}` : t('common.helloComma', lang);

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
                New contact enquiry - SignXpert
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
                SignXpert system notification
            </td>
            </tr>

            <tr>
            <td style="font-size:14px;">Best regards</td>
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
                        ${userTitle}
          </td>
        </tr>

        <!-- TEXT -->
        <tr>
          <td style="font-size:14px; padding-bottom:10px;">
                        ${userHello}
          </td>
        </tr>

        <tr>
          <td style="font-size:14px; padding-bottom:20px;">
                        ${userIntro}<br/>
                        ${userReceived}
          </td>
        </tr>

        <!-- MESSAGE COPY -->
        <tr>
          <td style="font-size:14px; padding-bottom:10px;">
                        ${userCopyHeading}
          </td>
        </tr>

        <tr>
          <td style="font-size:14px; font-weight:bold; padding-bottom:8px;">
                        ${userMessageLabel}
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
                        ${userUrgentNote}
          </td>
        </tr>

        <!-- SIGNATURE -->
        <tr>
          <td style="padding-top:30px; font-size:14px;">
                        ${userBestRegards}
          </td>
        </tr>

        <tr>
          <td style="font-size:14px; padding-bottom:20px;">
                        ${userTeam}
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
                t('email.contact.userSubject', lang)
            );

            res.status(200).json({ success: true });
        } catch (err) {
            next(ErrorApi.badRequest(err));
        }
    };
}

export default SendEmailForStatus;

