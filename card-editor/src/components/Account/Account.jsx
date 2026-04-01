import React, { useEffect, useState } from 'react';
import './Account.scss';
import AccountHeader from './AccountHeader';
import { $authHost } from '../../http';
import { clearAllUnsavedSigns, putProject } from '../../utils/projectStorage';
import { useNavigate } from 'react-router-dom';

// Іконки (можна замінити на реальні SVG або FontAwesome)
const DelNoteIcon = () => <span className="icon-green">📄</span>;
const TrackingIcon = () => <span className="icon-blue">🚚</span>;
const InvoiceIcon = () => <span className="icon-red">🧾</span>;
const OpenProjectIcon = () => <span className="icon-folder">📂</span>;

const Account = () => {
    const [myOrders, setMyOrders] = useState([]);
    const [openingOrderId, setOpeningOrderId] = useState(null);
    const [page,setPage]=useState(1);
    const [countPages,setCountPages]=useState(1)

    const getMyOrders = async () => {
        try {
            const res = await $authHost.get('cart/getMyOrders?limit=15&page='+page);
            setMyOrders(res.data.orders);
            setCountPages(res.data.countPages);
        } catch (err) {
            console.error('Помилка завантаження замовлень', err);
        }
    };

    useEffect(() => {
        getMyOrders();
    }, [page]);

    useEffect(() => {
        if (!Array.isArray(myOrders) || myOrders.length === 0) {
            console.log('Latest order in account:', null);
            return;
        }

        const latestOrder = myOrders.reduce((latest, current) => {
            const latestTime = new Date(latest?.createdAt || 0).getTime();
            const currentTime = new Date(current?.createdAt || 0).getTime();
            return currentTime > latestTime ? current : latest;
        }, myOrders[0]);

        console.log('Latest order in account:', latestOrder);
    }, [myOrders]);

    const downloadPdf = async (id, type) => {
        try {
            const endpointSuffixByType = {
                '1': '',
                '2': '2',
                '3': '3',
            };
            const fileNameByType = {
                '1': 'Order',
                '2': 'DeliveryNote',
                '3': 'Invoice',
            };
            const endpointSuffix = endpointSuffixByType[type] ?? type;
            const res = await $authHost.get(`cart/getPdfs${endpointSuffix}/${id}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${fileNameByType[type] || type}-${id}.pdf`);
            document.body.appendChild(link);
            link.click();
        } catch (err) {
            alert('Помилка завантаження файлу');
        }
    };

    const openProjectFromOrder = async (order) => {
        const newTab = window.open('about:blank', '_blank'); // відкриваємо одразу

        const orderId = order?.id;
        if (!orderId) return;

        const project = order?.orderMongo?.project || order?.project || order?.order || null;
        if (!project || typeof project !== 'object') {
            alert('No project snapshot in this order');
            return;
        }
        if (!project.id) {
            alert('Project snapshot has no id');
            return;
        }

        setOpeningOrderId(orderId);

        try {
            try {
                await clearAllUnsavedSigns();
            } catch {}

            try {
                localStorage.removeItem('currentUnsavedSignId');
            } catch {}

            try {
                window.dispatchEvent(new CustomEvent('unsaved:signsUpdated'));
            } catch {}

            await putProject(project);

            try {
                localStorage.setItem('currentProjectId', project.id);
                localStorage.setItem('currentProjectName', project.name || order?.orderName || '');
            } catch {}

            const first = Array.isArray(project.canvases) ? project.canvases[0] : null;

            if (first?.id) {
                localStorage.setItem('currentCanvasId', first.id);
                localStorage.setItem('currentProjectCanvasId', first.id);
                localStorage.setItem('currentProjectCanvasIndex', '0');

                window.__currentProjectCanvasId = first.id;
                window.__currentProjectCanvasIndex = 0;
            }

            const pathname = String(window?.location?.pathname || '');
            const m = pathname.match(/^\/([a-z]{2})(\/|$)/i);
            const prefix = m ? `/${m[1]}` : '/';
            const targetUrl = prefix === '/' ? '/online-sign-editor' : `${prefix}/online-sign-editor`;

            if (newTab) {
                newTab.location.href = targetUrl;
            }

        } catch (e) {
            console.error('Failed to open ordered project', e);
            alert(e?.message || 'Failed to open ordered project');
            if (newTab) newTab.close();
        } finally {
            setOpeningOrderId(null);
        }
    };

    const navigate=useNavigate();

    return (
        <div id='account-container'>
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
                            <th>Sum & Del.</th>
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
                        {myOrders.sort((a,b)=>b.id-a.id).map((order, index) => (
                            <tr key={order.id}>
                                <td className="row-number">{order.orderNo }</td>
                                <td style={{whiteSpace:'nowrap'}}>{new Date(order.createdAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                                <td>{order.id}</td>
                                <td>{order.orderName || 'Water sifgns 23'}</td>
                                <td>{order.netAfterDiscount?.toFixed(2)}</td>
                                <td>{order.sum?.toFixed(2)}</td>
                                <td>{order.status || 'Received'}</td>
                                <td onClick={() => downloadPdf(order.id, '2')} className="clickable"><DelNoteIcon /></td>
                                <td className="clickable"><TrackingIcon /></td>
                                <td onClick={() => downloadPdf(order.id, '3')} className="clickable">
                                    <div className="invoice-cell">
                                        <span>{order.invoiceNo || order.id}</span>
                                        <InvoiceIcon />
                                    </div>
                                </td>
                                <td style={{color:order.isPaid?'green':'red'}} className={order.paid ? 'status-paid' : 'status-unpaid'}>
                                    {order.isPaid ? 'Paid' : 'Unpaid'}
                                </td>
                                <td>{!order.isPaid && <span onClick={()=>window.open('/account/pay/' + order.id, '_blank')} className="to-pay-icon">💳</span>}</td>
                                <td
                                    className="clickable"
                                    onClick={openingOrderId ? undefined : () => openProjectFromOrder(order)}
                                    style={{ cursor: openingOrderId ? 'default' : 'pointer', opacity: openingOrderId ? 0.6 : 1 }}
                                    title={openingOrderId === order.id ? 'Opening…' : 'Open project'}
                                >
                                    {openingOrderId === order.id ? 'Opening…' : <OpenProjectIcon />}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="pagination">
                {/* Кнопка "Попередня" */}
                <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="pagination-btn"
                >
                    ←
                </button>

                {/* Сторінки */}
                {Array.from({ length: countPages }, (_, i) => i + 1).map((p) => (
                    <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`pagination-btn ${p === page ? 'active' : ''}`}
                    >
                    {p}
                    </button>
                ))}

                {/* Кнопка "Наступна" */}
                <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === countPages}
                    className="pagination-btn"
                >
                    →
                </button>
            </div>
        </div>
    );
};

export default Account;