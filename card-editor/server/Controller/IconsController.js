import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ErrorApi from '../error/ErrorApi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, '../data/icons.json');
const ICONS_DIR = path.join(__dirname, '../static/icon');

class IconsController {
  // Отримання списку з JSON
  static Get = (req, res, next) => {
    try {
      if (!fs.existsSync(DATA_PATH)) return res.status(200).json({});
      const data = fs.readFileSync(DATA_PATH, 'utf8');
      return res.status(200).json(JSON.parse(data));
    } catch (err) {
      next(ErrorApi.internal('Помилка завантаження конфігу'));
    }
  };

  // Збереження всього об'єкта в JSON
  static Save = (req, res, next) => {
    try {
      const data = JSON.stringify(req.body, null, 2);
      fs.writeFileSync(DATA_PATH, data, 'utf8');
      return res.status(200).json({ message: 'Збережено успішно' });
    } catch (err) {
      next(ErrorApi.internal('Помилка запису файлу'));
    }
  };

  // Фізичне завантаження файлу на диск
  static Upload = (req, res, next) => {
    try {
      // Якщо multer не зміг обробити файл, req.file буде порожнім
      if (!req.file) {
        return res.status(400).json({ message: 'Файл не отримано' });
      }

      return res.status(200).json({
        fileName: req.file.originalname,
      });
    } catch (err) {
      // Якщо тут немає console.log, ви не побачите причину 500-ї помилки
      console.error('DEBUG UPLOAD ERROR:', err);
      next(err);
    }
  };
}

export default IconsController;
