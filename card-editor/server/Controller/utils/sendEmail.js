import nodemailer from 'nodemailer';

// Функція для надсилання повідомлення на пошту
const sendEmail = async (to, messageHtml, subject) => {
  try {
    // Налаштування транспорту (використовуємо Gmail)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER_SEND, // Ваша пошта Gmail
        pass: process.env.GMAIL_PASS, // Пароль програми, який ви отримали в Google
      },
    });

    // Параметри електронного листа
    const mailOptions = {
      from: `SignXpert - <${process.env.GMAIL_USER_SEND}>`, // Від кого
      to, // Кому надсилаємо
      subject, // Тема листа
      html: messageHtml, // HTML-контент листа
    };

    // Відправка листа
    await transporter.sendMail(mailOptions);

    // Якщо лист успішно надіслано
    return {
      status: 200,
      message: 'Лист успішно надіслано',
    };
  } catch (error) {
    console.log('Помилка відправки на пошту', error);
    // Визначаємо, який тип помилки стався
    if (error.response && error.response.code === 550) {
      return {
        status: 404,
        message: 'Електронна адреса отримувача не знайдена',
      };
    }

    // Якщо виникла інша помилка
    return {
      status: 500,
      message: `Помилка під час надсилання листа: ${error.message}`,
    };
  }
};

export default sendEmail;
