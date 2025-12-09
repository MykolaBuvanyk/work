import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize('work', process.env.DB_USER, process.env.DB_PASS, {
  dialect: 'mysql',
  host: process.env.HOST,
  logging: false, // ⛔ вимикає логування SQL-запитів
});

export default sequelize;
