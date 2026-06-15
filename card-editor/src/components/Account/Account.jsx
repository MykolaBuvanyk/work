import React, { useEffect, useState } from 'react';
import './Account.scss';
import AccountHeader from './AccountHeader';
import { $authHost } from '../../http';
import { clearAllUnsavedSigns, putProject } from '../../utils/projectStorage';
import { useTranslation } from 'react-i18next';
import { getLocalizedPath } from '../../utils/localizedPath';

// Іконки (можна замінити на реальні SVG або FontAwesome)
const DelNoteIcon = () => <span className="icon-green">📄</span>;
const TrackingIcon = () => <span className="icon-blue">🚚</span>;
const InvoiceIcon = () => <span className="icon-red">🧾</span>;
const OpenProjectIcon = () => <span className="icon-folder">📂</span>;

const Account = () => {
    const { t } = useTranslation();
    const translateStatus = (status) => {
        if (!status) return t('MyAccount.orders.status.received');
        const key = String(status).toLowerCase();
        return t(`MyAccount.orders.status.${key}`, { defaultValue: status });
    };
    const [myOrders, setMyOrders] = useState([]);
    const [openingOrderId, setOpeningOrderId] = useState(null);
    const [page,setPage]=useState(1);
    const [countPages,setCountPages]=useState(1)
    const [isOrdersLoading, setIsOrdersLoading] = useState(true);

    const getMyOrders = async () => {
        setIsOrdersLoading(true);
        try {
            const res = await $authHost.get('cart/getMyOrders?limit=15&page='+page);
            setMyOrders(res.data.orders);
            setCountPages(res.data.countPages);
        } catch (err) {
            console.error('Помилка завантаження замовлень', err);
        } finally {
            setIsOrdersLoading(false);
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
        } catch {
            alert(t('MyAccount.orders.downloadFileFailed'));
        }
    };

    const openProjectFromOrder = async (order) => {
        const newTab = window.open('about:blank', '_blank'); // відкриваємо одразу

        const orderId = order?.id;
        if (!orderId) return;

        const project = order?.orderMongo?.project || order?.project || order?.order || null;
        if (!project || typeof project !== 'object') {
            alert(t('MyAccount.orders.noProjectSnapshot'));
            return;
        }
        if (!project.id) {
            alert(t('MyAccount.orders.projectSnapshotNoId'));
            return;
        }

        setOpeningOrderId(orderId);

        try {
            try {
                await clearAllUnsavedSigns();
            } catch {
                // Best-effort cleanup before opening the ordered project.
            }

            try {
                localStorage.removeItem('currentUnsavedSignId');
            } catch {
                // Best-effort cleanup before opening the ordered project.
            }

            try {
                window.dispatchEvent(new CustomEvent('unsaved:signsUpdated'));
            } catch {
                // Best-effort notification for other editor surfaces.
            }

            await putProject(project);

            try {
                localStorage.setItem('currentProjectId', project.id);
                localStorage.setItem('currentProjectName', project.name || order?.orderName || '');
            } catch {
                // Best-effort persistence for editor state.
            }

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
            alert(e?.message || t('MyAccount.orders.openProjectFailed'));
            if (newTab) newTab.close();
        } finally {
            setOpeningOrderId(null);
        }
    };


    return (
        <div id='account-container'>
            <AccountHeader />
            {isOrdersLoading && (
                <p className="orders-loading-note">
                    {t('MyAccount.orders.loadingNote')}
                </p>
            )}
            
            <div className="orders-table-wrapper">
                <table className="orders-table">
                    <thead>
                        <tr>
                            <th>{t('MyAccount.orders.table.no')}</th>
                            <th>{t('MyAccount.orders.table.orderDate')}</th>
                            <th>{t('MyAccount.orders.table.orderNo')}</th>
                            <th>{t('MyAccount.orders.table.projectName')}</th>
                            <th>{t('MyAccount.orders.table.orderSum')}</th>
                            <th>{t('MyAccount.orders.table.sumDelivery')}</th>
                            <th>{t('MyAccount.orders.table.status')}</th>
                            <th>{t('MyAccount.orders.table.deliveryNote')}</th>
                            <th>{t('MyAccount.orders.table.tracking')}</th>
                            <th>{t('MyAccount.orders.table.invoice')}</th>
                            <th>{t('MyAccount.orders.table.invoiceStatus')}</th>
                            <th>{t('MyAccount.orders.table.toPay')}</th>
                            <th>{t('MyAccount.orders.table.openProject')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {myOrders.sort((a,b)=>b.id-a.id).map((order) => (
                            <tr key={order.id}>
                                <td className="row-number">{order.orderNo }</td>
                                <td style={{whiteSpace:'nowrap'}}>{new Date(order.createdAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                                <td>{order.id}</td>
                                <td>{order.orderName || 'Water sifgns 23'}</td>
                                <td>{order.netAfterDiscount?.toFixed(2)}</td>
                                <td>{order.sum?.toFixed(2)}</td>
                                <td>{translateStatus(order.status)}</td>
                                <td onClick={() => downloadPdf(order.id, '2')} className="clickable"><DelNoteIcon /></td>
                                <td
                                    className="clickable"
                                    onClick={() => order.trackingNumber && window.open(`https://www.ups.com/track?tracknum=${order.trackingNumber}`, '_blank')}
                                    style={{opacity: order.trackingNumber ? 1 : 0.35, cursor: order.trackingNumber ? 'pointer' : 'default'}}
                                    title={order.trackingNumber || t('MyAccount.orders.noTrackingYet')}
                                >
                                    <TrackingIcon />
                                </td>
                                <td onClick={() => downloadPdf(order.id, '3')} className="clickable">
                                    <div className="invoice-cell">
                                        <span>{order.invoiceNo || order.id}</span>
                                        <InvoiceIcon />
                                    </div>
                                </td>
                                <td style={{color:order.isPaid?'green':'red'}} className={order.paid ? 'status-paid' : 'status-unpaid'}>
                                    {order.isPaid ? t('MyAccount.orders.status.paid') : t('MyAccount.orders.status.unpaid')}
                                </td>
                                <td>{!order.isPaid && <span onClick={()=>window.open(getLocalizedPath('/account/pay/' + order.id), '_blank')} className="to-pay-icon">💳</span>}</td>
                                <td
                                    className="clickable"
                                    onClick={openingOrderId ? undefined : () => openProjectFromOrder(order)}
                                    style={{ cursor: openingOrderId ? 'default' : 'pointer', opacity: openingOrderId ? 0.6 : 1 }}
                                    title={openingOrderId === order.id ? t('MyAccount.orders.opening') : t('MyAccount.orders.openProject')}
                                >
                                    {openingOrderId === order.id ? t('MyAccount.orders.opening') : <OpenProjectIcon />}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="orders-cards">
                {myOrders.sort((a,b)=>b.id-a.id).map((order) => {
                    const isPaid = order.isPaid;
                    return (
                        <div className="order-card" key={order.id}>
                            <div className="order-card__top">
                                <span className="order-card__num">{order.orderNo}</span>
                                <button
                                    type="button"
                                    className="order-card__open"
                                    onClick={openingOrderId ? undefined : () => openProjectFromOrder(order)}
                                    disabled={!!openingOrderId}
                                >
                                    {openingOrderId === order.id ? t('MyAccount.orders.opening') : t('MyAccount.orders.openProject')}
                                </button>
                            </div>
                            <div className="order-card__meta">
                                <span className="order-card__id">#{order.id}</span>
                                <span className="order-card__date">
                                    {new Date(order.createdAt).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="order-card__name">{order.orderName || 'Water sifgns 23'}</div>
                            <div className="order-card__sums">
                                <div className="order-card__sum">
                                    <span className="order-card__label">{t('MyAccount.orders.table.orderSum')}</span>
                                    <strong>{order.netAfterDiscount?.toFixed(2)}$</strong>
                                </div>
                                <div className="order-card__sum">
                                    <span className="order-card__label">{t('MyAccount.orders.sumInclVatDelivery')}</span>
                                    <strong>{order.sum?.toFixed(2)}</strong>
                                </div>
                            </div>
                            <div className="order-card__statuses">
                                <div className="order-card__status">
                                    <span className="order-card__label">{t('MyAccount.orders.table.status')}</span>
                                    <span className="order-card__pill order-card__pill--neutral">
                                        {translateStatus(order.status)}
                                    </span>
                                </div>
                                <div className="order-card__status">
                                    <span className="order-card__label">{t('MyAccount.orders.table.invoiceStatus')}</span>
                                    <span className={`order-card__pill ${isPaid ? 'order-card__pill--paid' : 'order-card__pill--unpaid'}`}>
                                        {isPaid ? t('MyAccount.orders.status.received') : t('MyAccount.orders.status.unpaid')}
                                    </span>
                                </div>
                            </div>
                            <div className="order-card__actions">
                                <button type="button" className="order-card__action" onClick={() => downloadPdf(order.id, '2')}>
                                    <span className="order-card__action-icon icon-green">📄</span>
                                    <span className="order-card__action-label">{t('MyAccount.orders.table.deliveryNote')}</span>
                                </button>
                                <button
                                    type="button"
                                    className="order-card__action"
                                    onClick={() => order.trackingNumber && window.open(`https://www.ups.com/track?tracknum=${order.trackingNumber}`, '_blank')}
                                    disabled={!order.trackingNumber}
                                    title={order.trackingNumber || t('MyAccount.orders.noTrackingYet')}
                                >
                                    <span className="order-card__action-icon icon-blue">🚚</span>
                                    <span className="order-card__action-label">{t('MyAccount.orders.table.tracking')}</span>
                                </button>
                                <button type="button" className="order-card__action" onClick={() => downloadPdf(order.id, '3')}>
                                    <span className="order-card__action-icon icon-red">🧾</span>
                                    <span className="order-card__action-label">{t('MyAccount.orders.table.invoice')}</span>
                                </button>
                                <button
                                    type="button"
                                    className="order-card__action"
                                    onClick={() => !isPaid && window.open(getLocalizedPath('/account/pay/' + order.id), '_blank')}
                                    disabled={isPaid}
                                >
                                    <span className="order-card__action-icon to-pay-icon">💳</span>
                                    <span className="order-card__action-label">{t('MyAccount.orders.table.toPay')}</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
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
