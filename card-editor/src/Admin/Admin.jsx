import React, { useEffect, useState } from 'react';
import './AdminContainer.scss';
import Order from './Order';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { $authHost } from '../http';

const limit=10;

const Admin = () => {
  const { isAdmin } = useSelector(state => state.user);
  const [status,setStatus]=useState('all');
  const [page,setPage]=useState(1);
  const [orders,setOrders]=useState([]);

  const [day, setDay] = useState('03');
  const [month, setMonth] = useState('Dec');
  const [year, setYear] = useState('2025');

  // Об'єднання в формат ISO або об'єкт Date
  const fullDate = new Date(`${month} ${day}, ${year}`); 
  // Або просто рядок для відправки на сервер
  const dateString = `${year}-${month}-${day}`;
  
  const getOrders=async()=>{
    try{
      let query=`?page=${page}&limit=${limit}`;
      if(status!='all'){
        query+=`&status=${status}`
      }
      console.log(94324,query)
      const res=await $authHost.get('cart/filter'+query);
      setOrders(res.data.orders);
    }catch(err){
      alert('Помилка при отримані замовлень.');
    }
  }

  useEffect(()=>{
    getOrders();
  },[page, status])

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
  useEffect(() => {}, [isAdmin]);
  if (!isAdmin) return <>У вас не достатньо прав</>;
  return (
    <>
      <div style={{
            alignItems: 'flex-end',
            display: 'flex',
            justifyContent: 'right',
            marginBottom: '15px',
            gap:'30px'
          }} className="end">
        <NavLink
          to={'/admin/update-baner'}
        >
          update baner
        </NavLink>
        <NavLink
          to={'/admin/update-avaible'}
        >
          update avaible
        </NavLink>
        <NavLink
          to={'/admin/update-avaible/icon'}
        >
          update icons
        </NavLink>
      </div>
      <div className="admin-container">
        <div className="left">
          <div className="selects">
            <div className="select-cont">
              <p>Status</p>
              <select onChange={(e)=>setStatus(e.target.value)} value={status}>
                <option value='all'>All</option>
                <option value='Recived'>Received</option>
                <option value='Printed'>Printed</option>
                <option value='Manufact'>Manufact.</option>
                <option value='Delivered'>Delivered</option>
                <option value='Returned'>Returned</option>
                <option value='Waiting'>Waiting</option>
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
              {orders.map((order, index) => (
                <tr key={order.orderNo}>
                  {/* Перша колонка Order No з помаранчевим фоном */}
                  <td className="order-no">{order.id}</td>
                  <td>{order.userId}</td>
                  <td>{order.signs}</td>
                  <td>{order.sum}</td>
                  <td>{order.country}</td>
                  <td>{order.status}</td>
                  <td>{order.createdAt}</td>
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
    </>
  );
};

export default Admin;
