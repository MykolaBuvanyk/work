import React, { useEffect, useState } from 'react';
import './UpdateAvaible.scss';
import { $authHost } from '../../http';
import { useSelector } from 'react-redux';
import Flag from 'react-flagkit';
import { SlArrowDown } from 'react-icons/sl';

const languages = [
  { countryCode: 'BE', label: 'FR-BE' }, // Belgium
  { countryCode: 'CH', label: 'DE-CH' }, // Switzerland

  { countryCode: 'CZ', label: 'CS-CZ' }, // Czechia
  { countryCode: 'DK', label: 'DA-DK' }, // Denmark
  { countryCode: 'DE', label: 'DE-DE' }, // Germany
  { countryCode: 'EE', label: 'ET-EE' }, // Estonia
  { countryCode: 'FR', label: 'FR-FR' }, // France

  { countryCode: 'GB', label: 'EN-GB' }, // UK
  { countryCode: 'HU', label: 'HU-HU' }, // Hungary
  { countryCode: 'IE', label: 'EN-IE' }, // Ireland

  { countryCode: 'IT', label: 'IT-IT' }, // Italy
  { countryCode: 'LT', label: 'LT-LT' }, // Lithuania
  { countryCode: 'LU', label: 'LB-LU' }, // Luxembourg

  { countryCode: 'NL', label: 'NL-NL' }, // Netherlands
  { countryCode: 'PL', label: 'PL-PL' }, // Poland

  { countryCode: 'RO', label: 'RO-RO' }, // Romania
  { countryCode: 'SI', label: 'SL-SI' }, // Slovenia
  { countryCode: 'SK', label: 'SK-SK' }, // Slovakia

  { countryCode: 'SE', label: 'SV-SE' }, // Sweden
  { countryCode: 'HR', label: 'HR-HR' }, // Croatia
  { countryCode: 'ES', label: 'ES-ES' }, // Spain

  { countryCode: 'UA', label: 'UK-UA' }, // Ukraine
];



const UpdateAvaible = () => {
  const deliveryLabels = [
    'UPS Envelope',
    'UPS Next Day Package',
    'UPS Express before 12 PM',
    'UPS Saturday Delivery',
  ];

  const { isAdmin } = useSelector(state => state.user);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isLangOpenCons, setIsLangOpenCons] = useState(false);
  const [langInput, setLangInput2]=useState('');
  const [langInputCons, setLangInputCons] = useState('');
  const [langSelect, setLangSelect]=useState('BE');
  const [langSelectCons, setLangSelectCons] = useState('BE');


  const [formData, setFormData] = useState({
    // Тут залишайте ваші початкові дефолтні значення як "скелет"
    colour16: [],
    colour08: [],
    // ... решта полів
  });

  // Функція для запиту даних
  const fetchSettings = async () => {
    try {
      const response = await $authHost.get('auth/getDate'); // Ваш URL
      setFormData(response.data);
    } catch (error) {
      console.error('Помилка при завантаженні конфігурації:', error);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Обробник для кольорів, аксесуарів та знижок (масиви)
  const handleArrayUpdate = (arrayName, index, field, value) => {
    /*if(arrayName[0]=='A'&&value){
      if(!formData[arrayName.slice(1)][index].isSelect)return;
    }
    if(arrayName[0]!='A'&&!value){
      setFormData(prev => {
        const updatedArray = [...prev['A'+arrayName]];
        updatedArray[index] = { ...updatedArray[index], [field]: value };
        return { ...prev, ['A'+arrayName]: updatedArray };
      });
    }*/
    setFormData(prev => {
      const updatedArray = Array.isArray(prev[arrayName]) ? [...prev[arrayName]] : [];
      updatedArray[index] = { ...(updatedArray[index] || {}), [field]: value };
      return { ...prev, [arrayName]: updatedArray };
    });
  };

  const normalizeDeliveryArray = (array = []) =>
    deliveryLabels.map((label, index) => {
      const itemByIndex = array[index];
      const itemByName = Array.isArray(array) ? array.find(x => (x?.name || x?.text) === label) : null;
      const source = itemByIndex || itemByName || {};
      return {
        name: label,
        value: source.value || '',
      };
    });

  const getDeliveryArray = key => {
    if (Array.isArray(formData[key])) return normalizeDeliveryArray(formData[key]);
    return normalizeDeliveryArray([]);
  };

  const handleDeliveryChange = (arrayName, index, value) => {
    setFormData(prev => {
      const updatedArray = normalizeDeliveryArray(prev[arrayName]);
      updatedArray[index] = { ...updatedArray[index], value };
      return { ...prev, [arrayName]: updatedArray };
    });
  };

  // Обробник для параметрів товщини (вкладені об'єкти)
  const handleThicknessUpdate = (thicknessKey, field, value, subIndex = null) => {
    setFormData(prev => {
      const updatedThickness = { ...prev.listThinkness[thicknessKey] };
      if (subIndex !== null) {
        const newArray = [...updatedThickness[field]];
        // Зберігаємо як рядок в стейті під час вводу, 
        // щоб не було проблем з крапкою або порожнім полем
        newArray[subIndex] = value; 
        updatedThickness[field] = newArray;
      } else {
        updatedThickness[field] = value;
      }
      return {
        ...prev,
        listThinkness: { ...prev.listThinkness, [thicknessKey]: updatedThickness },
      };
    });
  };

  const saveToDatabase = async () => {
    try {
      const res = await $authHost.post('auth/save', { formData });
      alert('saved');
    } catch (err) {
      alert('error');
    }
  };

  // Компонент для списку кольорів, щоб не дублювати код
  const ColorGrid = ({ listName,isA }) => (
    <div className="list-colors">
      {formData[listName].map((x, idx) => (
        <div
          key={idx}
          onClick={() => handleArrayUpdate(listName, idx, 'isSelect', !x.isSelect)}
          style={{
            background: x.beck,
            color: x.color,
            opacity: x.isSelect ? 1 : 0.6,
            cursor: 'pointer',
            border: x.isSelect ? '2px solid #000' : '1px solid #ccc',
          }}
        >
          A
        </div>
      ))}
    </div>
  );

  const setSelectLang=(code)=>{
    setLangSelect(code)
    setIsLangOpen(false)
    setLangInput2(formData[code] || '');
  }

  const setSelectLangCons = code => {
    setLangSelectCons(code);
    setIsLangOpenCons(false);
    setLangInputCons(formData[`${code}_CONS`] || '');
  };

  useEffect(() => {}, [isAdmin]);

  const setLangInput=(value)=>{
    setFormData((prev)=>{
      return {...prev,[langSelect]:value}
    });
    setLangInput2(value)
  }

  const setLangInputForCons = value => {
    setFormData(prev => {
      return { ...prev, [`${langSelectCons}_CONS`]: value };
    });
    setLangInputCons(value);
  };
  if (!isAdmin) return <>У вас не достатньо прав</>;

  if (formData.colour16.length == 0) return <>...loading</>;
  return (
    <div className="update-avaible-container">
      <div className="button">
        <button onClick={saveToDatabase}>Save</button>
      </div>

      <div className="list">
        <div className="row">
          <div className="title">
            <span>3</span> Thinkness:
          </div>
          <ul>
            <li>1,6</li>
            <li>0,8</li>
            <li>3,2</li>
          </ul>
        </div>
      </div>

      <div className="list">
        <div className="title">
          <span>4</span> Colour
        </div>
        <div className="list-list-colors">
          <ColorGrid listName="colour16" />
          <ColorGrid listName="colour08" />
          <ColorGrid listName="colour32" />
        </div>
      </div>

      <div style={{marginTop:'60px'}} className="list">
        <div className="row">
          <div className="title" style={{ whiteSpace: 'nowrap' }}>
            Adhesive Tape:
          </div>
          <ul>
            {['thinkness16', 'thinkness08', 'thinkness32'].map((key, i) => (
              <li key={key}>
                <input
                  type="checkbox"
                  checked={formData.listThinkness[key].isSelect}
                  //onChange={e => handleThicknessUpdate(key, 'isSelect', e.target.checked)}
                />
                {['1,6', '0,8', '3,2'][i]}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="list">
        <div className="list-list-colors">
          <ColorGrid listName="Acolour16" />
          <ColorGrid listName="Acolour08" />
          <ColorGrid listName="Acolour32" />
        </div>
      </div>

      <div style={{gap:'60px'}} className="row">
        <div className="first">
          <div className="title">Accessories:</div>
          <ul className="list-elem">
            {formData.listAccessories.map((x, idx) => (
              <li className="elem" key={idx}>
                <input
                  type="checkbox"
                  checked={x.isAvaible}
                  onChange={e =>
                    handleArrayUpdate('listAccessories', idx, 'isAvaible', e.target.checked)
                  }
                />
                <div className="img-cont">
                  <img src={x.img} alt={x.text} />
                </div>
                <div className="text">{x.text}</div>
                <input
                  type="number"
                  step="0.01"
                  value={x.number}
                  onChange={e =>
                    handleArrayUpdate('listAccessories', idx, 'number', e.target.value)
                  }
                />
                <div className="info">{x.info}</div>
              </li>
            ))}
        </ul>
          <div className="bonuses">
            
            {/* Delivery DE column */}
            <div className="bunuses-text">
              <div className="bonuses-title">
                <p style={{fontWeight:'bold'}}>Delivery DE:</p>
              </div>
              <div id="procent-discount" className="delivery-list">
                {getDeliveryArray('deliveryDE').map((x, idx) => (
                  <div key={idx} className="proc">
                    {(x.name || x.text || deliveryLabels[idx])}
                    <input
                      type="number"
                      value={x.value || ''}
                      onChange={e => handleDeliveryChange('deliveryDE', idx, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* Delivery Other column (with inputs) */}
            <div className="bunuses-text">
              <div className="bonuses-title">
                <p style={{fontWeight:'bold'}}>Delivery Other:</p>
              </div>
              <div id="procent-discount" className="delivery-list">
                {getDeliveryArray('deliveryOther').map((x, idx) => (
                  <div key={idx} className="proc">
                    {(x.name || x.text || deliveryLabels[idx])}
                    <input
                      type="number"
                      value={x.value || ''}
                      onChange={e => handleDeliveryChange('deliveryOther', idx, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="bunuses-text">
              <div className="bonuses-title">
                <p style={{fontWeight:'bold'}}>Bonuses: </p> <span>€</span>
              </div>
              <div id="procent-discount">
                {formData.discount.map((x, idx) => (
                  <div key={idx} className="proc">
                    <input
                      style={{ minWidth: '100px' }}
                      value={x.price}
                      type="text"
                      onChange={e => handleArrayUpdate('discount', idx, 'price', e.target.value)}
                    />
                    <input
                      type="number"
                      value={x.discount}
                      className="number2"
                      onChange={e => handleArrayUpdate('discount', idx, 'discount', e.target.value)}
                    />
                    <span>%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="prices">
          <div style={{ textAlign: 'left' }} className="title">
            Price:
          </div>
          <p className="price-desc">
            The price is calculated based on these three parameters for each thickness separately,
             and also depends on whether there is adhesive tape on the back.
          </p>
          <p>
            Material area of the shape Engraving area on the material Holes (excluding standard
            ones) around the perimeter
          </p>
          <div className="list-thinkness">
            {['thinkness16', 'thinkness08', 'thinkness32'].map(tKey => (
              <div key={tKey} className="thickness-section">
                <div className="thinkness-title-row">
                  <div className="thinkness-title">
                    <p>Thinkness:</p>
                    <span>
                      {tKey === 'thinkness16' ? '1,6' : tKey === 'thinkness08' ? '0,8' : '3,2'}
                    </span>
                  </div>
                  <div className="thinkness-info">
                    Adhesive Tape
                    <input
                      type="checkbox"
                      checked={formData.listThinkness[tKey].isSelect}
                      //onChange={e => handleThicknessUpdate(tKey, 'isSelect', e.target.checked)}
                    />
                  </div>
                </div>

                <div className="lists">
                  {['materialArea', 'engravingArea', 'holesPerimeter'].map(field => (
                    <div className="list" key={field}>
                      <p>{field.replace(/([A-Z])/g, ' $1').toLowerCase()}</p>
                      <span>€</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.listThinkness[tKey][field][0]}
                        onChange={e => handleThicknessUpdate(tKey, field, e.target.value, 0)}
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={formData.listThinkness[tKey][field][1]}
                        onChange={e => handleThicknessUpdate(tKey, field, e.target.value, 1)}
                      />
                      <span>* ( cm² )</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="lang-cont">
            <div className="vat-col">
              <span>VAT Bus</span>
              <div className='lang'>
                <div
                  style={{ display: 'flex', flexDirection: 'row', gap: '5px', alignItems: 'center' }}
                  onClick={() => setIsLangOpen(!isLangOpen)}
                >
                  {langSelect}
                  <SlArrowDown size={14} />
                </div>
                <div className={isLangOpen ? 'dropdown' : 'open'}>
                  {languages.map(lang => (
                    <div
                      key={lang.countryCode}
                      onClick={() => setSelectLang(lang.countryCode)}
                      className={'countries'}
                    >
                      {lang.countryCode}
                    </div>
                  ))}
                </div>
              </div>
              <input type="text" value={langInput} onChange={(e)=>setLangInput(e.target.value)} />
            </div>

            <div className="vat-col">
              <span>VAT Cons</span>
              <div className='lang'>
                <div
                  style={{ display: 'flex', flexDirection: 'row', gap: '5px', alignItems: 'center' }}
                  onClick={() => setIsLangOpenCons(!isLangOpenCons)}
                >
                  {langSelectCons}
                  <SlArrowDown size={14} />
                </div>
                <div className={isLangOpenCons ? 'dropdown' : 'open'}>
                  {languages.map(lang => (
                    <div
                      key={`${lang.countryCode}-cons`}
                      onClick={() => setSelectLangCons(lang.countryCode)}
                      className={'countries'}
                    >
                      {lang.countryCode}
                    </div>
                  ))}
                </div>
              </div>
              <input type="text" value={langInputCons} onChange={(e)=>setLangInputForCons(e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateAvaible;