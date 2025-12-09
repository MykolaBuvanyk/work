import React from 'react';
import './AdminContainer.scss';
import Order from './Order';

const Admin = () => {
  const orderData = [
    {
      orderNo: 1,
      custNo: 1,
      signs: 10,
      orderSum: 125.54,
      country: 'CH',
      status: 'Returned',
      orderDate: '26-11-25 08:40',
      deliveryType: 'Deutsch Post Großbrief',
    },
    {
      orderNo: 2,
      custNo: 123,
      signs: 9,
      orderSum: 98.45,
      country: 'UK',
      status: 'Manufact.',
      orderDate: '23-11-25 15:23',
      deliveryType: 'UPS Next Day Packet',
    },
    {
      orderNo: 3,
      custNo: 45,
      signs: 2,
      orderSum: 9.54,
      country: 'PL',
      status: 'Delivered',
      orderDate: '05-09-25 12:45',
      deliveryType: 'UPS Next Day',
    },
    {
      orderNo: 4,
      custNo: 4,
      signs: 5,
      orderSum: 25.63,
      country: 'DE',
      status: 'Received',
      orderDate: '05-09-25 12:45',
      deliveryType: 'Pick Up',
    },
    {
      orderNo: 5,
      custNo: 33,
      signs: 12,
      orderSum: 225.07,
      country: 'DE',
      status: 'Printed',
      orderDate: '12-11-25 16:45',
      deliveryType: 'Deutsch Post Großbrief',
    },
    {
      orderNo: 6,
      custNo: 57,
      signs: 1,
      orderSum: 9.25,
      country: 'IT',
      status: 'Waiting',
      orderDate: '08-11-25 7:45',
      deliveryType: 'UPS Next Day',
    },
  ];
  return (
    <div className="admin-container">
      <div className="left">
        <div className="selects">
          <div className="select-cont">
            <p>Status</p>
            <select>
              <option>All</option>
              <option>Received</option>
              <option>Printed</option>
              <option>Manufact.</option>
              <option>Delivered</option>
              <option>Returned</option>
              <option>Waiting</option>
            </select>
          </div>
          <div className="select-cont">
            <p>Filter</p>
            <input />
          </div>
        </div>
        <table>
          {/* Заголовок таблиці */}
          <thead>
            <tr>
              <th>Order No</th>
              <th>Cust No</th>
              <th>Signs</th>
              <th>Order Sum</th>
              <th>Country</th>
              <th>Status</th>
              <th>Order Date</th>
              <th>Delivery Type</th>
            </tr>
          </thead>

          {/* Тіло таблиці */}
          <tbody>
            {orderData.map((order, index) => (
              <tr key={order.orderNo}>
                {/* Перша колонка Order No з помаранчевим фоном */}
                <td className="order-no">{order.orderNo}</td>
                <td>{order.custNo}</td>
                <td>{order.signs}</td>
                <td>{order.orderSum}</td>
                <td>{order.country}</td>
                <td>{order.status}</td>
                <td>{order.orderDate}</td>
                <td>{order.deliveryType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="right">
        <Order />
      </div>
    </div>
  );
};

export default Admin;
