import React, { useEffect, useState } from 'react';
import './AdminContainer.scss';
import Order from './Order';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { $authHost } from '../http';
import Flag from 'react-flagkit';
import { SlArrowDown } from 'react-icons/sl';
import ReactPaginate from 'react-paginate';
import combinedCountries from '../components/Countries';

const limit=25;

function formatDate(dateStr) {
  const d = new Date(dateStr);

  const pad = n => String(n).padStart(2, '0');

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = String(d.getFullYear()).slice(2);
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${day}-${month}-${year} ${hours}:${minutes}`;
}


const resolveOrderSigns = (order) => {
  const canvases = order?.orderMongo?.project?.canvases;
  if (Array.isArray(canvases) && canvases.length > 0) {
    return canvases.reduce((sum, canvas) => {
      const raw = canvas?.copiesCount ?? canvas?.toolbarState?.copiesCount ?? 1;
      const copies = Math.max(1, Math.floor(Number(raw) || 1));
      return sum + copies;
    }, 0);
  }

  const legacy = Number(order?.signs);
  return Number.isFinite(legacy) ? legacy : 0;
};

const Admin = () => {
  const { isAdmin } = useSelector(state => state.user);
  const [status,setStatus]=useState('ALL');
  const [page,setPage]=useState(1);
  const [orders,setOrders]=useState([]);
  const [search,setSearch]=useState('');
  const [start,setStart]=useState('');
  const [finish,setFinish]=useState('');
  const [countPages, setCountPages]=useState(1);

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [selectLang, setSelectLang] = useState({ code: 'ALL', label: 'ALL' });
  const [sum,setSum]=useState(0);
  const [orderId,setOrderId]=useState(null);
  const [filteredUserId, setFilteredUserId] = useState(null);

  const handleStartDateChange = (nextStart) => {
    setStart(nextStart);

    if (!nextStart) return;

    const normalizedFinishDate = String(finish || '').split('T')[0];
    if (normalizedFinishDate && nextStart > normalizedFinishDate) {
      setFinish(nextStart);
    }
  };

  
  const getOrders=async({ pageOverride, userIdOverride, reopenOrderId } = {})=>{
    try{
      const requestPage = Number(pageOverride ?? page) || 1;
      const activeFilteredUserId = userIdOverride !== undefined ? userIdOverride : filteredUserId;

      let query=`?page=${requestPage}&limit=${limit}`;
      if(status!='ALL'){
        query+=`&status=${status}`
      }
      if(search){
        query+=`&search=${search}`;
      }
      if(start){
        query+=`&start=${start}`
      }
      if(finish){
        // Додаємо кінець дня, якщо не вказано час
        let finishWithTime = finish;
        if (!finish.includes('T')) {
          finishWithTime = finish + 'T23:59:59';
        }
        query+=`&finish=${finishWithTime}`
      }
      if(selectLang.code!='ALL'){
        query+=`&lang=${selectLang.code}`
      }
      if(activeFilteredUserId != null){
        query+=`&userId=${activeFilteredUserId}`
      }
      /*
        const res=await $authHost.get('cart/filter'+query);
      
     
      setOrders(res.data.orders);
      setSum(res.data.sum)
      const nextCountPages = Math.max(1, Math.ceil(Number(res?.data?.count || 0) / limit));
      setCountPages(nextCountPages)

      if (requestPage > nextCountPages) {
        setPage(nextCountPages);
      }

      if (reopenOrderId != null) {
        setOrderId(reopenOrderId);
      }
      */
      const res=await $authHost.get('cart/filter'+query);
            
     
      setOrders(res.data.orders);
      setSum(res.data.totalSum)
      const nextCountPages = Math.max(1, Math.ceil(Number(res?.data?.count || 0) / limit));
      setCountPages(nextCountPages)

      if (requestPage > nextCountPages) {
        setPage(nextCountPages);
      }

      if (reopenOrderId != null) {
        setOrderId(reopenOrderId);
      }
     
      /*setOrders(res.data.orders);
      setSum(res.data.sum)
      setCountPages(Math.ceil(res.data.count/limit))*/
    }catch(err){
      console.log(err);
      alert('Помилка при отримані замовлень.');
    }
  }

  useEffect(()=>{
    getOrders();
  },[page, status, start, finish, selectLang, search, filteredUserId]);

 
  useEffect(() => {}, [isAdmin]);

  const update=()=>{
    getOrders();
  }

  const handleUserOrdersToggle = (userId) => {
    const normalizedUserId = Number(userId);
    if (!Number.isFinite(normalizedUserId)) {
      return;
    }

    const selectedOrderId = orderId;
    const nextFilteredUserId = filteredUserId === normalizedUserId ? null : normalizedUserId;
    setFilteredUserId(nextFilteredUserId);
    setPage(1);
    getOrders({ pageOverride: 1, userIdOverride: nextFilteredUserId, reopenOrderId: selectedOrderId });
  };

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
          <div className="filters">
            <div className="selects">
              <div className="select-cont">
                <p>Status</p>
                <select onChange={(e)=>setStatus(e.target.value)} value={status}>
                  <option value='ALL'>All</option>
                  <option value='Received'>Received</option>
                  <option value='Printed'>Printed</option>
                  <option value='Manufact'>Manufact.</option>
                  <option value='Delivered'>Delivered</option>
                  <option value='Returned'>Returned</option>
                  <option value='Waiting'>Waiting</option>
                  <option value='Deleted'>Deleted</option>
                </select>
              </div>
              <div className="select-cont">
                <p>Filter</p>
                <input style={{paddingLeft:'7.5px'}} type='text' placeholder='value' value={search} onChange={(e)=>setSearch(e.target.value)} />
              </div>
            </div>
            <div className="dates">
              <div className="date">
                <p>start:</p>
                <input type="date" value={start} onChange={(e)=>handleStartDateChange(e.target.value)} />
              </div>
              <div className="date">
                <p>finish:</p>
                <input type="date" value={finish} onChange={(e)=>setFinish(e.target.value)} />
              </div>
            </div>
            <div className="lang-and-check-and-sum">
              <div className={'lang'}>
                <div
                  style={{ display: 'flex', flexDirection: 'row', gap: '5px', alignItems: 'center', height: '32px' }}
                  onClick={() => setIsLangOpen(!isLangOpen)}
                >
                  {selectLang.code}
                  <SlArrowDown size={14} />
                </div>
                <div className={isLangOpen ? 'dropdown' : 'open'}>
                  {[{code:'ALL'},...combinedCountries].map(lang => (
                    <div
                      key={lang.code}
                      onClick={() => {setIsLangOpen(false);setSelectLang(lang)}}
                      className={'countries'}
                    >
                      {/*lang.countryCode!='ALL'&&
                        <Flag country={lang.countryCode} size={32} />
                      */}
                      {lang.code!='ALL'&&
                      <img src={`https://flagcdn.com/w20/${lang.code.toLowerCase()=='uk'?'gb':lang.code.toLowerCase()}.png`} alt=''/>
}
                      {lang.code}
                    </div>
                  ))}
                </div>
              </div>
              <div className="check">
                <button>check</button>
              </div>
              <div className="sum">
                <input type="number" readOnly value={sum} />
              </div>
            </div>
          </div>
          <table>
            {/* Заголовок таблиці */}
            <thead>
              <tr>
                <th>Order No</th>
                <th>Cust No</th>
                <th>Signs</th>
                <th>Sum (V.+D)</th>
                <th>Country</th>
                <th>Status</th>
                <th>Order Date</th>
                <th>Delivery Type</th>
              </tr>
            </thead>

            {/* Тіло таблиці */}
            <tbody>
              {orders.map((order, index) => (
                <tr
                  style={{backgroundColor: orderId==order.id?'#CACACA': (index+1)%2==0? '#f9f9f9':'unset'}} 
                  onClick={()=>{
                    console.log('Clicked order:', order);
                    if(orderId==order.id)setOrderId(null)
                    else setOrderId(order.id)
                    }} key={order.id}>

                    <td className="order-no">{order.id}</td>
                    <td>{String(order.userId).padStart(3, "0")}</td>
                    <td>{order.signs}</td>
                    <td>{Number.isFinite(Number(order?.totalPrice)) ? Number(order.totalPrice).toFixed(2) : '—'}</td>
                    <td>{order.country}</td>
                    <td>{order.status}</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>{order.deliveryType}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {countPages>1&&
            <div className="pagination">
              <ReactPaginate
                pageCount={countPages}
                forcePage={page - 1}
                onPageChange={(e) => setPage(e.selected + 1)}
                marginPagesDisplayed={1}
                pageRangeDisplayed={3}
                previousLabel="←"
                nextLabel="→"
                breakLabel="…"
                containerClassName="pagination"
                activeClassName="active"
              />
            </div>
          }         
        </div>
        {orderId&&
          <div className="right">
            <Order orderId={orderId} update={update} onToggleUserOrdersFilter={handleUserOrdersToggle} />
          </div>
        }
      </div>
    </>
  );
};

export default Admin;
