import { DataTypes, Sequelize } from 'sequelize'; // Імпортуємо DataTypes
import sequelize from '../db.js'; // Імпортуємо ваш екземпляр sequelize

const User = sequelize.define('users', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  eMailInvoice: { type: DataTypes.STRING, allowNull: true },
  type: {
    type: DataTypes.ENUM('Consumer', 'Business', 'Admin'),
    defaultValue: 'Consumer',
    allowNull: false,
  },
  company: { type: DataTypes.STRING, allowNull: true },
  vatNumber: { type: DataTypes.STRING, allowNull: true },
  reference: { type: DataTypes.STRING, allowNull: true },
  firstName: { type: DataTypes.STRING, allowNull: true },
  surname: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: true },
  address: { type: DataTypes.STRING, allowNull: true },
  address2: { type: DataTypes.STRING, allowNull: true },
  house: { type: DataTypes.STRING, allowNull: true },
  postcode: { type: DataTypes.STRING, allowNull: true },
  city: { type: DataTypes.STRING, allowNull: true },
  country: { type: DataTypes.STRING, allowNull: true },
  state: { type: DataTypes.STRING, allowNull: true },
  isDifferent: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
  isSubscribe: { type: DataTypes.BOOLEAN, defaultValue: true, allowNull: false }, //чи підписується на розсилку
  company2: { type: DataTypes.STRING, allowNull: true },
  firstName2: { type: DataTypes.STRING, allowNull: true },
  surname2: { type: DataTypes.STRING, allowNull: true },
  phone2: { type: DataTypes.STRING, allowNull: true },
  address3: { type: DataTypes.STRING, allowNull: true },
  address4: { type: DataTypes.STRING, allowNull: true },
  address5: { type: DataTypes.STRING, allowNull: true },
  address6: { type: DataTypes.STRING, allowNull: true },
  postcode2: { type: DataTypes.STRING, allowNull: true },
  city2: { type: DataTypes.STRING, allowNull: true },
  country2: { type: DataTypes.STRING, allowNull: true },
  state2: { type: DataTypes.STRING, allowNull: true },
  additional:{type:DataTypes.STRING,allowNull:true},
  password: { type: DataTypes.STRING, allowNull: false },
  weWill:{type:DataTypes.STRING,allowNull:true},
  tellAbout:{type:DataTypes.STRING,allowNull:true},
  timePasswordUpdate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  //codeFor
});

const Order=sequelize.define('orders',{
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sum:{type:DataTypes.FLOAT, allowNull:false},
  signs:{type:DataTypes.INTEGER,defaultValue:1},
  country:{type:DataTypes.STRING,allowNull:false,defaultValue:"NO"},
  status:{type:DataTypes.ENUM('Returned','Manufact','Delivered','Printed','Waiting','Received','Deleted'),allowNull:false,defaultValue:'Waiting'},
  deliveryType:{type:DataTypes.STRING,allowNull:false,defaultValue:''},
  orderName:{type:DataTypes.STRING,defaultValue:'',allowNull:false},
  orderType:{type:DataTypes.STRING,allowNull:false,defaultValue:''},
  accessories:{type:DataTypes.TEXT,allowNull:false,defaultValue:''},
  idMongo:{type:DataTypes.STRING,allowNull:false}
})

User.hasMany(Order);
Order.belongsTo(User);

export { User, Order };
