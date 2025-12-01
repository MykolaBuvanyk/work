import { DataTypes, Sequelize } from 'sequelize'; // Імпортуємо DataTypes
import sequelize from '../db'; // Імпортуємо ваш екземпляр sequelize

const User = sequelize.define('users', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  eMailInvoice: { type: DataTypes.state, allowNull: true },
  type: {
    type: DataTypes.ENUM('Consumer', 'Business', 'Admin'),
    defaultValue: 'Consumer',
    allowNull: false,
  },
  company: { type: DataTypes.STRING, allowNull: true },
  vatNumber: { type: DataTypes.STRING, allowNull: true },
  reference: { type: DataTypes.STRING, allowNull: true },
  firstName: { type: DataTypes.STRING, allowNull: false },
  surname: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING, allowNull: false },
  address2: { type: DataTypes.STRING, allowNull: true },
  house: { type: DataTypes.STRING, allowNull: true },
  postcode: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, allowNull: false },
  country: { type: DataTypes.STRING, allowNull: false },
  state: { type: DataTypes.STRING, allowNull: false },
  isDifferent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isSubscribe: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false }, //чи підписується на розсилку
  company2: { type: DataTypes.STRING, allowNull: true },
  firstName2: { type: DataTypes.STRING, allowNull: false },
  surname2: { type: DataTypes.STRING, allowNull: false },
  phone2: { type: DataTypes.STRING, allowNull: false },
  address3: { type: DataTypes.STRING, allowNull: false },
  address4: { type: DataTypes.STRING, allowNull: false },
  postcode2: { type: DataTypes.STRING, allowNull: false },
  city2: { type: DataTypes.STRING, allowNull: false },
  country2: { type: DataTypes.STRING, allowNull: false },
  state2: { type: DataTypes.STRING, allowNull: false },

  password: { type: DataTypes.STRING, allowNull: false },
  timePasswordUpdate: { type: DataTypes.DATE, allowNull: false, defaultValue: 'NOW()' },
  //codeFor
});

export { User };
