import { User } from '../models/models.js';
import ErrorApi from '../error/ErrorApi.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'; // Обов'язково додаємо цей рядок
import sendEmail from './utils/sendEmail.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const secretKey = process.env.secretKey;

const generateJwt = async (id, phone, firstName, surname, type, isRemember = true, company) => {
  return jwt.sign({ id, phone, firstName, surname, type, company }, secretKey, {
    expiresIn: isRemember ? '1y' : '1h',
  });
};

class AuthController {
  static Register = async (req, res, next) => {
    console.log(52423432)
    try {
      const {
        email,
        eMailInvoice,
        type,
        company,
        vatNumber,
        reference,
        firstName,
        surname,
        phone,
        address,
        address2,
        house,
        postcode,
        city,
        country,
        state,
        isDifferent,
        isSubscribe,
        company2,
        firstName2,
        surname2,
        phone2,
        address3,
        address4,
        postcode2,
        city2,
        country2,
        state2,
        password,
      } = req.body;

      // Перевіряємо всі NOT NULL поля
      const requiredFields = {
        email,
        type,
        firstName,
        surname,
        phone,
        address,
        postcode,
        city,
        country,
        state,
        isDifferent,
        isSubscribe,
        password,
      };

      /*for (const [field, value] of Object.entries(requiredFields)) {
        if (value === undefined || value === null) {
          return next(ErrorApi.badRequest(`Field "${field}" is required and cannot be null`));
        }
      }*/

      const hashedPassword = await bcrypt.hash(password, 10);

      // Створюємо користувача, optional поля ставимо null, якщо не передано
      const newUser = await User.create({
        email,
        eMailInvoice: eMailInvoice || null,
        type,
        company: company || null,
        vatNumber: vatNumber || null,
        reference: reference || null,
        firstName:firstName||null,
        surname:surname||null,
        phone:phone||null,
        address:address||null,
        address2: address2 || null,
        house: house || null,
        postcode:postcode||null,
        city:city||null,
        country:country||null,
        state:state||null,
        isDifferent:isDifferent||null,
        isSubscribe:isSubscribe||null,
        company2: company2 || null,
        firstName2: firstName2 || null,
        surname2: surname2 || null,
        phone2: phone2 || null,
        address3: address3 || null,
        address4: address4 || null,
        postcode2: postcode2 || null,
        city2: city2 || null,
        country2: country2 || null,
        state2: state2 || null,
        password: hashedPassword,
      });
      console.log(94234324);
      const token = await generateJwt(
        newUser.id,
        newUser.phone||'',
        newUser.firstName||'',
        newUser.surname||'',
        newUser.type||'',
        true,
        newUser.company||''
      );

      console.log(233284234);

      const subject = `Welcome to SignXpert. Your account is ready!`;
      const messageHtml = `
<div style="background-color: #f4f4f4; padding: 40px 20px; font-family: Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); color: #333333;">
        
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="${process.env.VITE_LAYOUT_SERVER}images/images/logo.png" alt="SignXpert Logo" style="max-width: 250px; height: auto;">
        </div>

        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="font-size: 22px; font-weight: bold; color: #000000; margin: 0;">
                Your account is ready! Welcome to SignXpert
            </h1>
        </div>

        <div style="font-size: 16px; line-height: 1.5;">
            <p style="margin: 0 0 15px 0;">Hello, <span style="color: #337ab7; font-weight: bold;">${firstName}</span>!</p>
            <p style="margin: 0 0 15px 0;">We’re excited to have you with us.</p>
            <p style="margin: 0 0 25px 0;">Your account has been successfully created, and you can now start designing your projects.</p>

            <div style="margin-bottom: 25px;">
                <p style="margin: 0;">Customer number: <strong>${String(newUser.id).padStart(3, '0')}</strong></p>
                <p style="margin: 0;">Email: <a href="mailto:${email}" style="color: #337ab7; text-decoration: underline;">${email}</a></p>
            </div>

            <p style="margin: 0 0 5px 0;">Ready to start creating?</p>
            <p style="margin: 0 0 30px 0;">Our online editor is available right in your browser — the fastest way to bring your ideas to life.</p>

            <div style="text-align: center; margin-bottom: 40px;">
                <a href="https://sign-xpert.com/editor" style="background-color: #337ab7; color: #ffffff; padding: 14px 45px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">Create now</a>
            </div>

            <p style="margin: 0;">Best regards,</p>
            <p style="margin: 0 0 40px 0;">SignXpert Team</p>

            <div style="text-align: right; font-size: 14px; line-height: 1.4;">
                <p style="margin: 0;"><a href="https://sign-xpert.com" style="color: #337ab7; text-decoration: underline;">sign-xpert.com</a></p>
                <p style="margin: 0;"><a href="mailto:info@sign-xpert.com" style="color: #337ab7; text-decoration: underline;">info@sign-xpert.com</a></p>
                <p style="margin: 0; color: #666666;">+49 157 766 25 125</p>
            </div>
        </div>
    </div>
</div>
`;

      console.log(534234);
      sendEmail(email, messageHtml, subject)

      console.log(78234234);
      return res.json({ newUser, token });
    } catch (err) {
      console.log(32434,err);
      return next(ErrorApi.internalServerError(err));
    }
  };
  static Login = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user) return next(ErrorApi.badRequest('no register'));
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return next(ErrorApi.badRequest('password false'));
      }
      const token = await generateJwt(
        user.id,
        user.phone,
        user.firstName,
        user.surname,
        user.type,
        true,
        user.company
      );
      return res.json({ token });
    } catch (err) {
      return next(ErrorApi.badRequest(err));
    }
  };

  static SaveDATE = (req, res, next) => {
    try {
      const { formData } = req.body;
      if (!formData) return next(ErrorApi.badRequest('Дані не отримано'));

      const dirPath = path.join(__dirname, '../data');
      const filePath = path.join(dirPath, 'formData.json');

      // 1. Перевіряємо чи є папка, якщо ні — створюємо
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const jsonString = JSON.stringify(formData, null, 2);

      // 2. Записуємо файл
      fs.writeFile(filePath, jsonString, 'utf8', err => {
        if (err) return next(ErrorApi.internal('Помилка запису: ' + err.message));
        return res.status(200).json({ message: 'Дані успішно збережені' });
      });
    } catch (err) {
      return next(ErrorApi.badRequest(err.message));
    }
  };

  static GetDATE = (req, res, next) => {
    try {
      const filePath = path.join(__dirname, '../data/formData.json');

      if (!fs.existsSync(filePath)) {
        // Якщо файлу немає, повертаємо null або пустий об'єкт, щоб фронтенд не ламався
        return res.status(200).json(null);
      }

      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return next(ErrorApi.internal('Помилка читання'));

        try {
          const formData = JSON.parse(data);
          console.log(434, formData);
          return res.status(200).json(formData);
        } catch (e) {
          console.log(343, e);
          return next(ErrorApi.internal('Помилка парсингу JSON'));
        }
      });
    } catch (err) {
      return next(ErrorApi.badRequest(err.message));
    }
  };

  static GetMy=async(req,res,next)=>{
    try{
      const userId=req.user.id;
      const user=await User.findOne({where:{id:userId}});
      return res.json({user});
    }catch(err){
      return next(ErrorApi.badRequest(err));
    }
  }
  
  static UpdateProfile = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const values = req.body;

      // Видаляємо поля, які не можна оновлювати через цей метод (безпека)
      const { id, password, role, ...updateData } = values;

      // Оновлюємо користувача
      // Метод update повертає масив [кількість_оновлених_рядків]
      const [updatedRows] = await User.update(updateData, {
        where: { id: userId }
      });

      if (updatedRows === 0) {
        return next(ErrorApi.badRequest("User not found or no changes made"));
      }

      // Отримуємо оновлені дані користувача для відповіді
      const updatedUser = await User.findOne({ where: { id: userId } });

      return res.json({ 
        message: "Profile updated successfully", 
        user: updatedUser 
      });
      
    } catch (err) {
      console.log(524234);
      // Якщо помилка валідації Sequelize (наприклад, дублікат email)
      if (err.name === 'SequelizeUniqueConstraintError') {
        return next(ErrorApi.badRequest("Email already in use"));
      }
      return next(ErrorApi.badRequest(err.message));
    }
  }
  static UpdatePassword = async (req, res, next) => {
    try {
      const { oldPassword, newPassword } = req.body; // виправлено typo: oldPassowrd -> oldPassword
      
      const user = await User.findOne({ where: { id: req.user.id } });
      if (!user) {
        return next(ErrorApi.badRequest("Користувача не знайдено"));
      }

      // 1. ПРАВИЛЬНА ПЕРЕВІРКА ПАРОЛЯ
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      
      if (!isMatch) {
        return next(ErrorApi.badRequest("Старий пароль невірний"));
      }

      // 2. ХЕШУВАННЯ НОВОГО ПАРОЛЯ
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      // 3. ОНОВЛЕННЯ ТА ЗБЕРЕЖЕННЯ
      user.password = hashedNewPassword;
      await user.save(); // Обов'язково await

      return res.status(200).json({ message: "Password updated successfully" });
    } catch (err) {
      return next(ErrorApi.badRequest(err.message));
    }
  }
  
  static NewPass = async (req, res, next) => {
    try {
      const { email } = req.body;

      if (!email) {
        return next(ErrorApi.badRequest("Email is required"));
      }

      // 1) знайти користувача
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return next(ErrorApi.badRequest("User not found"));
      }

      // 2) згенерувати новий пароль
      const newPassword = Math.random().toString(36).slice(-8);

      // 3) захешувати
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 4) оновити пароль в базі
      user.password = hashedPassword;
      await user.save();

      // 5) сформувати email
      const htmlMessage = `
        <h2>Password Reset</h2>
        <p>Hello ${user.firstName},</p>
        <p>Your new password is:</p>
        <h3>${newPassword}</h3>
        <p>Please log in and change it after signing in.</p>
      `;

      // 6) відправити
      await sendEmail(email, htmlMessage, "Your new password");

      return res.json({ message: "New password sent successfully" });

    } catch (err) {
      console.log(4234,err);
      return next(ErrorApi.internalServerError(err.message));
    }
  };

}

export default AuthController;
