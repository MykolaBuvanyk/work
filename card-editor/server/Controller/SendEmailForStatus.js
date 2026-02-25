import sendEmail from "./utils/sendEmail.js";

const formatDate = (date) => {
  const d = new Date(date);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);

  return `${day}.${month}.${year}`;
};

class SendEmailForStatus {
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
                            <strong>Customer number:</strong> ${order.user.id}<br>
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
                                <strong>Customer number:</strong> ${order.user.id}<br>
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
                                        <a href="{payment_url}" target="_blank" style="font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; padding: 10px 60px; border-radius: 8px; border: 1px solid #006DA5; display: inline-block; font-weight: bold; text-transform: uppercase;">
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
                                <strong>Customer number: ${order.user.id}</strong>
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
                <p style="margin: 0;"><strong>Customer number: ${order.user.id}</strong></p>

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

}

export default SendEmailForStatus;