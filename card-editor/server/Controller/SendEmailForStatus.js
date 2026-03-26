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
    buildZugferdInvoiceData
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

class SendEmailForStatus {
    
    static SendAdminStatusPaid=async(order)=>{
        const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
        const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
      
        const subject=`SignXpert Order Paid – #[${String(order.id).padStart(3, '0')}] ${nameOrCompany}`;
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
                            <h2 style="margin: 0; color: #000000; font-size: 20px; font-weight: bold;">Order Paid – #[${String(order.id).padStart(3, '0')}]</h2>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 10px 60px; color: #000000; font-size: 15px; line-height: 1.6;">
                            
                            <p style="margin: 0 0 20px 0;">Hello,</p>
                            
                            <p style="margin: 0 0 30px 0;">Payment has been received for the following order on SignXpert.</p>
                            
                            <div style="margin: 0 0 30px 0;">
                                <p style="margin: 0 0 5px 0;">Order Number: #[${String(order.id).padStart(3, '0')}]</p>
                                <p style="margin: 0 0 5px 0;">Customer Name: [${order.user.firstName}]</p>
                                <p style="margin: 0 0 5px 0;">Customer Email: [${order.user.email}]</p>
                                ${//<p style="margin: 0 0 5px 0;">Payment Method: [${paymentMethod}]</p>
                                ''}
                                <p style="margin: 0 0 5px 0;">Order Total: [${order.sum}]</p>
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
        const subject=`SignXpert - Payment Received  #[${String(order.id).padStart(3, '0')}] (${nameOrCompany})`;
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
                            <h2 style="margin: 0; color: #000000; font-size: 20px; font-weight: normal;">Payment has been received – #[${String(order.id).padStart(3, '0')}]</h2>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 10px 60px; color: #000000; font-size: 15px; line-height: 1.5;">
                            
                            <p style="margin: 0 0 25px 0;">Hello, ${user.firstName}, ${user.company?`(${user.company})`:''}</p>
                            
                            <p style="margin: 0 0 10px 0;">Thank you for your payment.</p>
                            <p style="margin: 0 0 25px 0;">We have successfully received it for Order #[${String(order.id).padStart(3, '0')}].</p>
                            
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

            // 2. Підготовка даних (логіка один в один з getPdfs3)
            const checkout = orderMongo?.checkout && typeof orderMongo.checkout === 'object' ? orderMongo.checkout : {};
            const deliveryAddress = checkout?.deliveryAddress || {};
            const invoiceAddress = checkout?.invoiceAddress || null;
            const customerAddress = hasAddressContent(invoiceAddress) ? invoiceAddress : deliveryAddress;

            const customerCompany = escapeHtml(customerAddress?.companyName || order.user?.company || 'Water Design Solution GmbH');
            const customerIdentifierRaw = String(order.user?.reference || order.userId || '').trim();
            const customerStreetLine1Raw = String(customerAddress?.address1 || [order.user?.address, order.user?.house].filter(hasContent).join(' ') || '').trim();
            const customerStreetLine2Raw = String(customerAddress?.address2 || order.user?.address2 || '').trim();
            const customerStreetLine3Raw = String(customerAddress?.address3 || order.user?.address3 || '').trim();
            const customerPostalCodeRaw = String(customerAddress?.postalCode || order.user?.postcode || '').trim();
            const customerCityRaw = String(customerAddress?.town || order.user?.city || '').trim();
            const customerCountryRaw = String(customerAddress?.country || order.user?.country || order.country || '').trim();
            const customerCountrySubdivisionRaw = String(customerAddress?.state || order.user?.state || '').trim();
            const customerEmailRaw = String(checkout?.invoiceAddressEmail || checkout?.invoiceEmail || invoiceAddress?.email || deliveryAddress?.email || customerAddress?.email || order.user?.eMailInvoice || order.user?.email || '').trim();
            const customerPhoneRaw = String(invoiceAddress?.mobile || deliveryAddress?.mobile || customerAddress?.mobile || order.user?.phone2 || order.user?.phone || '').trim();
            const customerVatNumberRaw = String(checkout?.vatNumber || order.user?.vatNumber || '').trim();
            const customerName = escapeHtml(customerAddress?.fullName || [order.user?.firstName, order.user?.surname].filter(Boolean).join(' '));
            
            const addressLine1 = escapeHtml([customerStreetLine1Raw, customerStreetLine2Raw, customerStreetLine3Raw].filter(hasContent).join(', '));
            const addressLine2 = escapeHtml([customerPostalCodeRaw, customerCityRaw].filter(hasContent).join(' '));
            const countryLine = escapeHtml(customerCountryRaw);
            const phoneLine = escapeHtml(customerPhoneRaw);
            const vatNumber = escapeHtml(customerVatNumberRaw);

            const invoiceNumberRaw = String(order.id || '');
            const customerNumber = escapeHtml(order.userId);
            const invoiceDate = escapeHtml(formatInvoiceDate(order.createdAt));
            const invoiceDueDateDate = new Date(new Date(order.createdAt).setMonth(new Date(order.createdAt).getMonth() + 1));
            const invoiceDueDate = escapeHtml(formatInvoiceDate(invoiceDueDateDate));
            const projectNameRaw = String(order.orderName || orderMongo?.projectName || 'Project');
            const projectName = escapeHtml(projectNameRaw);
            const signsCountRaw = Math.max(0, Number(order.signs || 0));
            const signsCount = escapeHtml(signsCountRaw);
            const deliveryLabel = escapeHtml(order?.deliveryType || checkout?.deliveryLabel || '');

            const netAmount = Number.isFinite(Number(order?.netAfterDiscount)) ? Number(order.netAfterDiscount) : Number.isFinite(Number(orderMongo?.price)) ? Number(orderMongo.price) : 0;
            const discountAmount = toNumber(orderMongo?.discountAmount, 0);
            const discountPercent = toNumber(orderMongo?.discountPercent, 0);
            const subtotal = round2(netAmount + discountAmount);
            const shippingCost = Number.isFinite(Number(checkout?.deliveryPrice)) ? Number(checkout.deliveryPrice) : 0;
            const vatPercent = toNumber(checkout?.vatPercent, 0);
            const totalAmount = Number.isFinite(Number(order?.sum)) ? Number(order.sum) : Number.isFinite(Number(orderMongo?.totalPrice)) ? Number(orderMongo.totalPrice) : round2(netAmount + shippingCost);
            const totalAmountFormatted = formatMoney(totalAmount);
            const vatAmount = Number.isFinite(Number(checkout?.vatAmount)) ? Number(checkout.vatAmount) : Math.max(0, round2(totalAmount - netAmount - shippingCost));

            const vatIdMarkup = vatNumber ? `<br>VAT ID: ${vatNumber}` : '';

            // 3. HTML контент (Розширений варіант з getPdfs3)
            const htmlContent = `
    <!DOCTYPE html>
    <html lang="uk">
    <head>
        <meta charset="UTF-8">
        <title>Invoice - SignXpert</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; color: #000; font-size: 10.5pt; line-height: 1.2; }
            .page { width: 210mm; height: 297mm; padding: 10mm 15mm 10mm 15mm; margin: 10mm auto; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); position: relative; display: flex; flex-direction: column; }
            @media print { body { background: none; } .page { margin: 0; box-shadow: none; } }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
            .svg-logo { display: inline-block; width: 78mm; max-width: 95mm; height: auto; }
            .svg-logo svg { width: 100%; height: auto; display:block; }
            .invoice-title { font-size: 26pt; font-weight: 700; text-decoration: underline; text-underline-offset: 6px; }
            .info-section { display: flex; margin-bottom: 35px; }
            .address-block { width: 52%; line-height: 1.3; }
            .details-block { width: 48%; padding-left: 35px; }
            .details-table { border-collapse: collapse; }
            .details-table td { padding: 1px 0; vertical-align: top; font-weight: 400; }
            .details-table td:first-child { width: 140px; }
            .details-table tr:first-child td { font-weight: 700; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th, .items-table td { border: 0.5pt solid #000; padding: 4px 8px; text-align: left; }
            .money-cell { white-space: nowrap; text-align: right; }
            .calc-section { display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 25px; }
            .calc-table { width: 38%; border-collapse: collapse; }
            .calc-table td { padding: 2px 0; }
            .calc-table td:last-child { text-align: right; }
            .total-row { border-top: 1px solid #000; font-weight: 700; }
            .payment-info { margin-top: 25px; }
            .payment-info h3 { font-size: 10.5pt; text-decoration: underline; margin-bottom: 5px; font-weight: 700; }
            .payment-grid { display: grid; grid-template-columns: 140px auto; gap: 1px; }
            .payment-value { white-space: nowrap; font-weight: 700; }
            .footer-wrapper { margin-top: auto; margin-bottom: 6mm; }
            .footer-box { border: 0.5pt solid #000; padding: 6px 10px; display: flex; justify-content: space-between; font-size: 8pt; line-height: 1.05; }
        </style>
    </head>
    <body>
    <div class="page">
        <div class="header">
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
                </svg>
            </div>
            <div class="logo">SIGN<span>X</span>PERT</div>
            <div class="logo-sub">Smart <span>Sign & Label</span> Solution</div>
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
            <tr><td><strong>Invoice No:</strong></td><td><strong>${invoiceNumberRaw}</strong></td></tr>
            <tr><td>Customer No:</td><td>${customerNumber}</td></tr>
            <tr><td>Date:</td><td>${invoiceDate}</td></tr>
            <tr><td>Invoice due date:</td><td>${invoiceDueDate}</td></tr>
            <tr><td>Payment Terms:</td><td>30 days net</td></tr>
            <tr><td>Reference:</td><td>Order No: ${invoiceNumberRaw}</td></tr>
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
                <td>${invoiceNumberRaw}</td>
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

        <div class="payment-info">
        <h3><u>Payment information:</u></h3>
        <div class="payment-grid">
            <div>Amount due:</div><div class="payment-value">€&nbsp;${totalAmountFormatted}</div>
            <div>Account holder:</div><div>SignXpert (Kostyantyn Utvenko)</div>
            <div>IBAN:</div><div>DE78 6535 1260 0134 0819 40</div>
            <div>BIC / SWIFT:</div><div>SOLADES1BAL</div>
            <div>Payment reference:</div><div>Order No: ${invoiceNumberRaw}</div>
        </div>
        </div>

        <div class="online-payment-note">
        <span class="first-line">If you would like to pay by card or use any of the other online payment methods available, please visit: <span class="nowrap">sign-xpert.com</span></span><br>
        Log in to your account and go to: <span class="nowrap">My Account → My Orders</span><br>
        Select the relevant invoice and click “Pay” to complete your payment securely.
        </div>

        <div class="footer-wrapper">
        <div class="footer-thanks" style="text-align:center;margin-bottom:10px;font-weight:700;"><strong>Thank you for choosing SignXpert!</strong></div>
        <div class="footer-box">
            <div class="footer-col-left">
            <table class="footer-info-table">
                <tr><td><strong>SignXpert</strong></td></tr>
                <tr><td>Owner: Kostyantyn Utvenko</td></tr>
                <tr><td>Address: Baumwiesen 2, Haigerloch 72401, Germany</td></tr>
                <tr><td>IBAN: DE78 6535 1260 0134 0819 40</td></tr>
                <tr><td>BIC / SWIFT: SOLADES1BAL</td></tr>
                <tr><td>No VAT is charged under the small business exemption (§ 19 UStG).</td></tr>
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
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '20px', right: '20px', bottom: '28px', left: '20px' }
            });

            // 4. Впровадження ZUGFeRD метаданих (як у getPdfs3)
            const zugferdData = buildZugferdInvoiceData({
                order, invoiceNumber: invoiceNumberRaw, customerIdentifier: customerIdentifierRaw,
                customerCompany: customerAddress?.companyName || order.user?.company || '',
                customerName, customerEmail: customerEmailRaw, customerPhone: customerPhoneRaw,
                customerStreetLine1: customerStreetLine1Raw, customerStreetLine2: customerStreetLine2Raw,
                customerStreetLine3: customerStreetLine3Raw, customerPostalCode: customerPostalCodeRaw,
                customerCity: customerCityRaw, customerCountryCode: customerCountryRaw,
                customerCountrySubdivision: customerCountrySubdivisionRaw,
                customerVatNumber: customerVatNumberRaw, remittanceInformation: `Order No: ${invoiceNumberRaw}`,
                paymentDueDate: invoiceDueDateDate, signsCount: signsCountRaw, projectName: projectNameRaw,
                subtotal, vatAmount, vatPercent, totalAmount
            });

            const invoice = basicZugferdInvoicer.create(zugferdData);
            const zugferdPdf = await invoice.embedInPdf(pdfBuffer, {
                metadata: {
                    title: `Invoice ${invoiceNumberRaw}`,
                    author: 'SignXpert',
                    creator: 'SignXpert backend',
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
            const subject = `SignXpert - Order Shipped #${orderNumber} ${nameOrCompany}`;
            const logoPng = process.env.VITE_LAYOUT_SERVER + 'images/images/logo.png';
            const urlFrontend = process.env.VITE_LAYOUT_FRONTEND_URL;
            const urlAccount = urlFrontend + 'account/detail';
            const urlOrders = urlFrontend + 'account';
            
            // Отримуємо трекінг номер з об'єкта замовлення (якщо він там є)
            //const trackingNumber = order.trackingNumber || 'XXXXXXXX';
            const trackingNumber='XXXXXXXX';
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
                                <img src="${logoPng}" alt="SignXpert" width="200" style="max-width: 200px; height: auto;">
                            </td>
                        </tr>
                        <tr>
                            <td align="center" style="padding: 10px 40px 20px 40px;">
                                <h1 style="font-size: 22px; color: #000000; margin: 0; font-weight: bold;">Your order has been shipped</h1>
                            </td>
                        </tr>
                        <tr>
                            <td align="left" style="padding: 0 40px 30px 40px; color: #333333; font-size: 15px; line-height: 1.6;">
                                <p>Hello, <strong>${nameOrCompany}</strong>!</p>
                                <p>Good news!<br>Your order has now been shipped via UPS and is on its way to you.</p>
                                <p><strong>Tracking number:</strong> ${trackingNumber}</p>
                                
                                <table border="0" cellspacing="0" cellpadding="0" style="margin: 30px auto;">
                                    <tr>
                                        <td align="center" bgcolor="#006DA5" style="border-radius: 8px;">
                                            <a href="${trackingUrl}" target="_blank" style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 8px; display: inline-block; font-weight: bold;">
                                                Track Your Shipment
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                <p>You can also check the status in your account: <a href="${urlAccount}" style="color: #0056b3;">My Account</a>.</p>
                                <p style="margin-top: 30px;">Best regards,<br><strong>SignXpert Team</strong></p>
                            </td>
                        </tr>
                        <tr>
                            <td align="right" style="padding: 20px 40px; border-top: 1px solid #f0f0f0; font-size: 14px;">
                                <a href="https://sign-xpert.com" style="color: #0056b3; text-decoration: none;">sign-xpert.com</a><br>
                                <span style="color: #333333;">+49 157 766 25 125</span>
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
            console.error('error send email where status shipped1.' + err);
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
            const to=order.user.email;
            await sendEmail(to,html,subject);
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