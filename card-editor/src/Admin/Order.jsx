import React, { useEffect, useState } from 'react';
import './OrderContainer.scss';
import { $authHost } from '../http';

const Order = ({orderId}) => {
  const [order,setOrder]=useState();
  
  const getOrder=async()=>{
    try{
      const res=await $authHost.get('cart/get/'+orderId);
      setOrder(res.data.order);
    }catch(err){
      console.log(err);
      alert('Помилка отримання замовлення');
    }
  }

  useEffect(()=>{
    getOrder()
  },[orderId])

  const setStatus = async(newStatus) => {
    try {
      const res=await $authHost.post('cart/setStatus', {orderId,newStatus});
      getOrder();
    }catch {
      alert("Помилка задання статусу");
    }
  }

  const downloadFile = async (url, fileName) => {
    const res = await $authHost.get(url, { responseType: 'blob' });
    
    // Створюємо тимчасове посилання для скачування
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    
    // Очищуємо пам'ять
    window.URL.revokeObjectURL(link.href);
  };

  const druk = async () => {
    try {
      // Скачуємо по черзі
      await downloadFile(`cart/getPdfs/${orderId}`, `Order-${orderId}.pdf`);
      await downloadFile(`cart/getPdfs2/${orderId}`, `DeliveryNote-${orderId}.pdf`);
      await downloadFile(`cart/getPdfs3/${orderId}`, `Invoice-${orderId}.pdf`);
      
      console.log('Усі файли завантажено');
    } catch (err) {
      console.error(err);
      alert('Помилка при завантаженні файлів');
    }
  };

  if(!order)return null;
  return (
    <div className="order-container">
      <div className="row">
        <p>Order.No</p>
        <span>{order.id} ({order.status})</span>
        <div onClick={druk} className="druk">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6 9V2H18V9"
              stroke="#0088FF"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M6 18H4C3.46957 18 2.96086 17.7893 2.58579 17.4142C2.21071 17.0391 2 16.5304 2 16V11C2 10.4696 2.21071 9.96086 2.58579 9.58579C2.96086 9.21071 3.46957 9 4 9H20C20.5304 9 21.0391 9.21071 21.4142 9.58579C21.7893 9.96086 22 10.4696 22 11V16C22 16.5304 21.7893 17.0391 21.4142 17.4142C21.0391 17.7893 20.5304 18 20 18H18"
              stroke="#007AFF"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M18 14H6V22H18V14Z"
              stroke="#0088FF"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>
      <div className="row">
        <p>Order Name</p>
        <span>{order.orderName}</span>
        <div />
      </div>
      <div className="row">
        <p>Customer No</p>
        <span>{order.userId} ({order.user.orders.length}; {order.user.orders.reduce((acc,x)=>acc+=x.sum,0)}) </span>
        <div />
      </div>
      <div className="row">
        <p>Order Type</p>
        <span>CSA Engraved Plastic</span>
        <div className="open">Open Project</div>
      </div>
      <div className="delivery">
        <button>Delivery Note</button>
      </div>
      <div className="buttons">
        <button className={order.status=='Returned'?'active':''} onClick={()=>setStatus('Returned')}>Returned</button>
        <button className={order.status=='Manufact'?'active':''} onClick={()=>setStatus('Manufact')}>Manufact</button>
        <button className={order.status=='Delivered'?'active':''} onClick={()=>setStatus('Delivered')}>Delivered</button>
        <button className={order.status=='Printed'?'active':''} onClick={()=>setStatus('Printed')}>Printed</button>
        <button className={order.status=='Waiting'?'active':''} onClick={()=>setStatus('Waiting')}>Waiting</button>
        <button className={order.status=='Recived'?'active':''} onClick={()=>setStatus('Recived')}>Recived</button>
      </div>
      <div className="row">
        <p>Delivery Type</p>
        <span>{order.deliveryType}</span>
        <div />
      </div>
      <div className="row">
        <p>Order Sum</p>
        <span>{order.sum}</span>
        <div />
      </div>
      <div className="row">
        <p>Freight</p>
        <span>5.95</span>
        <div />
      </div>
      <div className="row">
        <p>Accessories:</p>
        <span className="mol">{JSON.parse(order.accessories).map(x=><>{x.qty} {x.name};{'   '}</>)}</span>
        <div />
      </div>
      <div className="row">
        <p>Count Sings:</p>
        <span>{order.signs}</span>
        <div />
      </div>
      <div className="row">
        <p>Invoice Tag:</p>
        <span>12 Plastic Engraved Plates</span>
        <div />
      </div>
      <div className="row">
        <p>Payment Method:</p>
        <span>Invoice</span>
        <div />
      </div>
      <div className="row box">
        <p>Delivery Address:</p>
        <div className="box">
          <div>Water Design Solution GmbH</div>
          <div>Joe Doe</div>
          <div>Hauptstr. 33</div>
          <div>72400 Balingen</div>
          <div>Germany</div>
        </div>
      </div>
      <div className="row">
        <p>E-Mail:</p>
        <span>{order.user.email}</span>
        <div />
      </div>
      <div className="row">
        <p>Phone:</p>
        <span>{order.user.phone}</span>
        <div />
      </div>
      <div className="row">
        <p>Instruction:</p>
        <span></span>
        <div />
      </div>
      <div className="row">
        <p>Massage to Production:</p>
        <span>---</span>
      </div>
      <div className="urls">
        <div className="url-cont">
          <div className="url">33 White / Black NO TAPE (5) .pdf (4 signs)</div>
          <div style={{ backgroundColor: '#FFFFFF' }} className="img">
            A
          </div>
        </div>
        <div className="url-cont">
          <div className="url">33 Silver / Black 0,8 (5) . pdf (2 signs)</div>
          <div
            style={{
              backgroundColor:
                'linear-gradient(152.22deg, #B5B5B5 28.28%, #F5F5F5 52.41%, #979797 74.14%)',
            }}
            className="img"
          >
            A
          </div>
        </div>
        <div className="url-cont">
          <div className="url">33 Blue / White 3,2 NO TAPE (5) .pdf (2 signs)</div>
          <div
            style={{
              backgroundColor: '#2928FF',
              color: '#FFFFFF',
            }}
            className="img"
          >
            A
          </div>
        </div>
        <div className="url-cont">
          <div className="url">33 Red / White (5) .pdf (4 signs)</div>
          <div style={{ backgroundColor: '#FD0100', color: '#FFFFFF' }} className="img">
            A
          </div>
        </div>
      </div>
      <div className="title">Make Customised PDF:</div>
      <div className="list-info">
        <div className="inf">
          <p>Material</p>
          <select style={{ width: '100%' }}>
            <option value="1">White / Black NO TAPE (4 signs)</option>
          </select>
        </div>
        <div className="inf">
          <p>Mode</p>
          <select style={{ width: '172px' }}>
            <option value="1">Normal</option>
          </select>
        </div>
        <div className="info-ful">
          <p>Min page width</p>
          <input type="number" />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Min page height</p>
          <input type="number" />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Min page width</p>
          <input type="number" />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Min page height</p>
          <input type="number" />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Page margin</p>
          <input type="number" />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Sign spacing</p>
          <input type="number" />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Max width on sheet</p>
          <input type="number" />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Max height on sheet</p>
          <input type="number" />
          <span>0 = defaults</span>
        </div>
        <div className="info-ful">
          <p>Sort order</p>
          <select>
            <option value="1">High first</option>
          </select>
        </div>
        <div className="info-ful">
          <p>Add sheet info</p>
          <input type="checkbox" />
          <span>Only if sheets are used</span>
        </div>
      </div>
      <div className="but">
        <button>Download PDF</button>
      </div>
      <div className="but-message">
        <button>Message to customer</button>
      </div>
    </div>
  );
};

export default Order;
