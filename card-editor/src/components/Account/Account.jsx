import React, { useEffect, useState } from 'react';
import './Account.scss';
import AccountHeader from './AccountHeader';
import { $authHost } from '../../http';

// Іконки (можна замінити на реальні SVG або FontAwesome)
const DelNoteIcon = () => <span className="icon-green">📄</span>;
const TrackingIcon = () => <span className="icon-blue">🚚</span>;
const InvoiceIcon = () => <span className="icon-red">🧾</span>;
const OpenProjectIcon = () => <span className="icon-folder">📂</span>;

const Account = () => {
    const [myOrders, setMyOrders] = useState([]);

    const getMyOrders = async () => {
        try {
            const res = await $authHost.get('cart/getMyOrders');
            setMyOrders(res.data.orders);
        } catch (err) {
            console.error('Помилка завантаження замовлень', err);
        }
    };

    useEffect(() => {
        getMyOrders();
    }, []);

    const downloadPdf = async (id, type) => {
        try {
            const res = await $authHost.get(`cart/getPdfs${type}/${id}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${type}-${id}.pdf`);
            document.body.appendChild(link);
            link.click();
        } catch (err) {
            alert('Помилка завантаження файлу');
        }
    };

    return (
        <div className='account-container'>
            <AccountHeader />
            
            <div className="orders-table-wrapper">
                <table className="orders-table">
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Order Date</th>
                            <th>Ord. No</th>
                            <th>Project Name</th>
                            <th>Order Sum</th>
                            <th>Sum (Incl.VAT & Del.)</th>
                            <th>Status</th>
                            <th>Del. Note</th>
                            <th>Tracking</th>
                            <th>Invoice</th>
                            <th>Inv. Status</th>
                            <th>To Pay</th>
                            <th>Open Project</th>
                        </tr>
                    </thead>
                    <tbody>
                        {myOrders.map((order, index) => (
                            <tr key={order.id}>
                                <td className="row-number">{index + 1}</td>
                                <td style={{whiteSpace:'nowrap'}}>{new Date(order.createdAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                                <td>{order.id}</td>
                                <td>{order.orderName || 'Water signs 23'}</td>
                                <td>{order.sum?.toFixed(2)}</td>
                                <td>{(order.sum * 1.19 + 8.5).toFixed(2)}</td>
                                <td>{order.status || 'Received'}</td>
                                <td onClick={() => downloadPdf(order.id, '1')} className="clickable"><DelNoteIcon /></td>
                                <td className="clickable"><TrackingIcon /></td>
                                <td onClick={() => downloadPdf(order.id, '3')} className="clickable">
                                    <div className="invoice-cell">
                                        <span>{order.invoiceNo || order.id}</span>
                                        <InvoiceIcon />
                                    </div>
                                </td>
                                <td className={order.paid ? 'status-paid' : 'status-unpaid'}>
                                    {order.paid ? 'Paid' : 'Unpaid'}
                                </td>
                                <td>{!order.paid && <span className="to-pay-icon">💳</span>}</td>
                                <td className="clickable"><OpenProjectIcon /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Account;