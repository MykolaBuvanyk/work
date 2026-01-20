import { Router } from 'express';
import multer from 'multer';
import IconsController from '../Controller/IconsController.js';
import IsAdminMiddware from '../middleware/IsAdminMiddware.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('--- MULTER DESTINATION START ---');
    const dest = path.join(__dirname, '../static/icon/');
    console.log('Шлях для збереження:', path.resolve(dest));

    if (!fs.existsSync(dest)) {
      console.log('Папка відсутня, створюємо...');
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    console.log('Назва файлу:', file.originalname);
    cb(null, file.originalname);
  },
});

const router = new Router();
const upload = multer({ storage });

router.get('/get', IconsController.Get);

router.post('/save', IsAdminMiddware, IconsController.Save);

// Додаємо логи прямо в ланцюжок мідлвар
router.post(
  '/upload',
  (req, res, next) => {
    console.log('1. ЗАПИТ ОТРИМАНО В РОУТЕРІ /upload');
    next();
  },
  IsAdminMiddware,
  (req, res, next) => {
    console.log('2. IsAdminMiddware ПРОЙДЕНО');
    next();
  },
  upload.single('file'),
  (req, res, next) => {
    console.log('3. MULTER ЗАВЕРШИВ РОБОТУ');
    if (req.file) {
      console.log('Файл успішно отримано multer-ом:', req.file.filename);
    } else {
      console.log('!!! MULTER НЕ ОТРИМАВ ФАЙЛ !!!');
    }
    next();
  },
  IconsController.Upload
);

export default router;
