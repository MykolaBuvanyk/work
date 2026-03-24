import ErrorApi from "../error/ErrorApi.js";
import sendEmail from "./utils/sendEmail.js";

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
        sendEmail(order.user.email, messageHtml, subject)
    }

    static SendStatusPaid=async(order)=>{
        const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
        const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
      
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
        const messageHtmlToAdmin=`<!DOCTYPE html>
<html lang="uk">
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
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: #777; text-transform: uppercase; letter-spacing: 1px;">Smart <span style="background-color: #0073bc; color: #ffffff; padding: 2px 5px;">Sign & Label</span> Solution</p>
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 20px 40px;">
                            <h2 style="margin: 0; color: #333333; font-size: 22px;">A new customer has registered</h2>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 10px 40px; color: #444444; font-size: 15px; line-height: 1.6;">
                            <p>Hello,</p>
                            <p>A new customer has registered on the SignXpert website.</p>
                            
                            <div style="margin: 25px 0; border-top: 1px solid #eeeeee; padding-top: 20px;">
                                <strong style="display: block; margin-bottom: 10px; color: #000;">Customer details:</strong>
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 15px; color: #444444;">
                                    <tr><td width="150" style="padding: 3px 0;">Customer number:</td><td><strong>${String(user.id).padStart(3, '0')}</strong></td></tr>
                                    <tr><td style="padding: 3px 0;">Name:</td><td><strong>${user.firstName}</strong></td></tr>
                                    <tr><td style="padding: 3px 0;">Company:</td><td><strong>${user.company?user.company:'-'}</strong></td></tr>
                                    <tr><td style="padding: 3px 0;">Email:</td><td><a href="mailto:${user.email}" style="color: #0073bc; text-decoration: none;">${user.email}</a></td></tr>
                                    <tr><td style="padding: 3px 0;">Phone:</td><td>${user.phone}</td></tr>
                                    <tr><td style="padding: 3px 0;">Country:</td><td>${user.country}</td></tr>
                                </table>
                            </div>

                            <p style="margin: 20px 0;">Registration date: ${currentDate}</p>
                            
                            <p>You can view the full customer profile in the admin panel.</p>
                            
                            <p style="margin-top: 30px; font-style: italic; color: #888;">SignXpert System Notification</p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 0 40px 40px 40px; color: #444444; font-size: 15px;">
                            <p style="margin: 0;">Best regards,<br><strong>SignXpert Team</strong></p>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="padding: 20px 40px; background-color: #fafafa; border-top: 1px solid #eeeeee;">
                            <a href="https://sign-xpert.com" style="display: block; color: #0073bc; text-decoration: none; font-size: 14px; margin-bottom: 4px;">sign-xpert.com</a>
                            <a href="mailto:info@sign-xpert.com" style="display: block; color: #0073bc; text-decoration: none; font-size: 14px; margin-bottom: 4px;">info@sign-xpert.com</a>
                            <p style="margin: 0; font-size: 14px; color: #666;">+49 157 766 25 125</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
        sendEmail(ADMIN_EMAIL,messageHtmlToAdmin,subjectAdmin)
    }

    static SendToAdminNewOrder=async(newOrder,comment,countStar)=>{
        const nameOrCompany=newOrder.user.company?newOrder.user.company:newOrder.user.firstName;
        const logoPng=process.env.VITE_LAYOUT_SERVER+'images/images/logo.png';
        const ADMIN_EMAIL=process.env.ADMIN_EMAIL;
        const subjectAdmin=`SignXpert | New Order #${String(newOrder.id).padStart(3, '0')} | Cust. ID #${String(newOrder.user.id).padStart(3, '0')} ${nameOrCompany}`;
        const currentDate = new Date().toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'long',
  year: 'numeric'
});
        const messageHtmlToAdmin=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Order Received #${String(newOrder.id).padStart(3, '0')}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
            <td align="center" style="padding: 20px 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #dddddd; border-radius: 8px; overflow: hidden;">
                    
                    <tr>
                        <td align="center" style="padding: 30px 40px 10px 40px;">
                            <img src="${logoPng}" alt="SignXpert" width="200" style="display: block; border: 0;">
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding: 10px 40px 20px 40px;">
                            <h2 style="margin: 0; color: #000000; font-size: 22px;">New Order Received #${String(newOrder.id).padStart(3, '0')}</h2>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 0 40px; color: #444444; font-size: 15px; line-height: 1.6;">
                            <p>Hello,</p>
                            <p>A new order has been placed on the SignXpert website.</p>
                            
                            <div style="margin: 20px 0; padding: 15px 0; border-top: 1px solid #eeeeee;">
                                <p style="margin: 0;">Order number: <strong>${String(newOrder.id).padStart(3, '0')}</strong></p>
                                <p style="margin: 5px 0 0 0;">Order date: <strong>${currentDate}</strong></p>
                            </div>

                            <div style="margin: 20px 0;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 15px; color: #444444;">
                                    <tr><td style="padding-bottom: 5px;">Customer number: ${String(newOrder.id).padStart(3, '0')}</td></tr>
                                    <tr><td style="padding-bottom: 5px;">Name: ${newOrder.user.firstName}</td></tr>
                                    ${newOrder.company?`<tr><td style="padding-bottom: 5px;">Company: ${newOrder.user.company}</td></tr>`:''}
                                    <tr><td style="padding-bottom: 5px;">Email: <a href="mailto:${newOrder.user.email}" style="color: #0073bc; text-decoration: none;">${newOrder.user.email}</a></td></tr>
                                    <tr><td style="padding-bottom: 5px;">Phone: ${newOrder.user.phone}</td></tr>
                                    <tr><td style="padding-bottom: 20px;">Country: ${newOrder.user.country}</td></tr>
                                </table>
                            </div>

                            <div style="margin: 20px 0; padding: 15px 0; border-top: 1px solid #eeeeee; border-bottom: 1px solid #eeeeee;">
                                <p style="margin: 0;">Total amount: <strong>€${newOrder.sum}</strong></p>
${/*z<p style="margin: 5px 0 0 0;">Payment method: <strong>PayPal</strong></p>
                                <p style="margin: 5px 0 0 0;">Shipping method: <strong>UPS Next Day Package</strong></p>*/''}
                            </div>

                            <div style="margin: 25px 0;">
                                <p style="margin: 0 0 10px 0;">How was your experience with SignXpert?</p>
                                <div style="color: #FFD700; font-size: 24px; letter-spacing: 5px;">
                                    ${'★'.repeat(countStar)}
                                </div>
                                <p style="margin: 10px 0 0 0; color: #888;">Comment: <span style="color: #333;">${comment}</span></p>
                            </div>

                            <p style="margin: 30px 0 10px 0;">You can view the full customer profile in the admin panel.</p>
                            <p style="margin: 0; font-style: italic; color: #888; font-size: 13px;">SignXpert System Notification</p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 30px 40px 40px 40px; color: #444444; font-size: 15px;">
                            <p style="margin: 0;">Best regards,<br><strong>SignXpert Team</strong></p>
                        </td>
                    </tr>

                    <tr>
                        <td align="right" style="padding: 20px 40px; background-color: #fafafa; border-top: 1px solid #eeeeee;">
                            <a href="https://sign-xpert.com" style="display: block; color: #0073bc; text-decoration: none; font-size: 14px; margin-bottom: 4px;">sign-xpert.com</a>
                            <a href="mailto:info@sign-xpert.com" style="display: block; color: #0073bc; text-decoration: none; font-size: 14px; margin-bottom: 4px;">info@sign-xpert.com</a>
                            <p style="margin: 0; font-size: 14px; color: #666;">+49 157 766 25 125</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`
        sendEmail(ADMIN_EMAIL,messageHtmlToAdmin,subjectAdmin)
    }

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

    static StatusShipped=async(order)=>{
        try{
            const orderNumber=String(order.id).padStart(3, '0')
            const nameOrCompany=order.user.company?order.user.company:order.user.firstName;
            const subject=`SignXpert - Order Shipped #${orderNumber} ${nameOrCompany}`;
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
    <title>Your order has been shipped - SignXpert</title>
    <style>
        body { margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse; }
        img { display: block; border: 0; }
        a { color: #0056b3; text-decoration: underline; }

        @media screen and (max-width: 600px) {
            .container { width: 100% !important; border-radius: 0 !important; }
            .content { padding: 20px !important; }
            .button-wrapper { width: 100% !important; }
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
                            <h1 style="font-size: 22px; color: #000000; margin: 0; font-weight: bold;">Your order has been shipped – Tracking available</h1>
                        </td>
                    </tr>

                    <tr>
                        <td class="content" align="left" style="padding: 0 40px 30px 40px; color: #333333; font-size: 15px; line-height: 1.6;">
                            <p>Hello, <strong>${nameOrCompany}</strong>

                            <p>Good news!<br>
                            Your order has now been shipped via UPS and is on its way to you.</p>

                            <p><strong>Tracking number:</strong> XXXXXXXX</p>

                            <p>You can track your order directly on the UPS website by clicking the link below:</p>

                            <table border="0" cellspacing="0" cellpadding="0" style="margin: 30px auto;">
                                <tr>
                                    <td align="center" bgcolor="#006DA5" style="border-radius: 8px;">
                                        <a href="{tracking_url}" target="_blank" style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 8px; border: 1px solid #006DA5; display: inline-block; font-weight: bold;">
                                            Track Your Shipment
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p>Please note that it may take some time for the tracking number to become active in the UPS system. Once active, you can follow the journey of your package and see its current status.</p>

                            <p>You can also always check the detailed status of your order in your account.<br>
                            Simply log in to <a href="${urlAccount}" style="color: #0056b3;">My Account</a> &rarr; <a href="${urlOrders}" style="color: #0056b3;">My Orders</a>.</p>

                            <p style="margin-top: 25px;"><strong>Thank you for choosing SignXpert — we hope you enjoy your custom signs!</strong></p>

                            <p>If you have any questions or need assistance, don’t hesitate to contact us.</p>

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
            const payment_url=urlFrontend+`account/pay/${String(order.id).padStart(3, '0')}`
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
            await sendEmail(to,html,subject);
        }catch(err){
            console.error('error send email where status printed.'+err);
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
                    Smart <span style="background-color: #0066cc; color: #ffffff; padding: 2px 5px; border-radius: 10px;">Sign & Label</span> Solution
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
                    Smart <span style="background-color: #0066cc; color: #ffffff; padding: 2px 5px; border-radius: 10px;">Sign & Label</span> Solution
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
                            <a href="${urlAccount}" style="background-color: #006eb3; border: 1px solid #005a94; border-radius: 6px; color: #ffffff; display: inline-block; font-size: 16px; font-weight: bold; padding: 12px 60px; text-decoration: none; text-transform: uppercase;">Pay</a>
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
            await sendEmail(to,html,subject);
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

            const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

            if (!ADMIN_EMAIL) {
                throw ErrorApi.badRequest('Admin email is not configured');
            }

            const subject = `Request from the contact page from the user ${name} (${email})`;

            const messageHTML = `
  <p><b>Name:</b> ${name}</p>
  <p><b>Email:</b> <a href="mailto:${email}">${email}</a></p>
  <p><b>Question:</b> ${question}</p>

  <p>
    <a href="mailto:${email}?subject=Re: Your question">
      Reply to user
    </a>
  </p>
`;

            await sendEmail(ADMIN_EMAIL, messageHTML, subject);

            res.status(200).json({ success: true });
        } catch (err) {
            next(ErrorApi.badRequest(err));
        }
    };
}

export default SendEmailForStatus;