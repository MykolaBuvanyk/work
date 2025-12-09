import { User } from '../models/models.js';
import ErrorApi from '../error/ErrorApi.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const secretKey = process.env.secretKey;

const generateJwt = async (id, phone, firstName, surname, type, isRemember = true) => {
  return jwt.sign({ id, phone, firstName, surname, type }, secretKey, {
    expiresIn: isRemember ? '1y' : '1h',
  });
};

class AuthController {
  static Register = async (req, res, next) => {
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

      for (const [field, value] of Object.entries(requiredFields)) {
        if (value === undefined || value === null) {
          return next(ErrorApi.badRequest(`Field "${field}" is required and cannot be null`));
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Створюємо користувача, optional поля ставимо null, якщо не передано
      const newUser = await User.create({
        email,
        eMailInvoice: eMailInvoice || null,
        type,
        company: company || null,
        vatNumber: vatNumber || null,
        reference: reference || null,
        firstName,
        surname,
        phone,
        address,
        address2: address2 || null,
        house: house || null,
        postcode,
        city,
        country,
        state,
        isDifferent,
        isSubscribe,
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
      const token = await generateJwt(
        newUser.id,
        newUser.phone,
        newUser.firstName,
        newUser.surname,
        newUser.type,
        true
      );
      return res.json({ newUser, token });
    } catch (err) {
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
        true
      );
      return res.json({ token });
    } catch (err) {
      return next(ErrorApi.badRequest(err));
    }
  };
}

export default AuthController;
