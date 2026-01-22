import React, { useEffect, useState } from 'react';
import './UpdateAvaible.scss';
import { $authHost } from '../../http';
import { useSelector } from 'react-redux';
import Flag from 'react-flagkit';
import { SlArrowDown } from 'react-icons/sl';

const languages = [
  { countryCode: 'GB', label: 'EN' }, // Використовуємо GB для UK/EN
  { countryCode: 'FR', label: 'FR' },
  { countryCode: 'IT', label: 'IT' },
  { countryCode: 'ES', label: 'ES' },
  { countryCode: 'PL', label: 'PL' },
  { countryCode: 'CZ', label: 'CS' }, // Чехія
  { countryCode: 'NL', label: 'NL' },
  { countryCode: 'SE', label: 'SV' }, // Швеція
  { countryCode: 'NO', label: 'NO' },
  { countryCode: 'DK', label: 'DA' }, // Данія
  { countryCode: 'HU', label: 'HU' },
  { countryCode: 'HR', label: 'HR' }, // Хорватія
  { countryCode: 'UA', label: 'UK' }, // Україна
  { countryCode: 'RU', label: 'RU' },
];

const UpdateAvaible = () => {
  const { isAdmin } = useSelector(state => state.user);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [langInput, setLangInput2]=useState('');
  const [langSelect, setLangSelect]=useState('GB');


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
      const updatedArray = [...prev[arrayName]];
      updatedArray[index] = { ...updatedArray[index], [field]: value };
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
    setLangInput2(formData[code]);
  }

  useEffect(() => {}, [isAdmin]);

  const setLangInput=(value)=>{
    setFormData((prev)=>{
      return {...prev,[langSelect]:value}
    });
    setLangInput2(value)
  }
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

      <div className="row">
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
            <div className="lang-cont">
              <span>VAT</span>
              <div className='lang'>
                <div
                  style={{ display: 'flex', flexDirection: 'row', gap: '5px', alignItems: 'center' }}
                  onClick={() => setIsLangOpen(!isLangOpen)}
                >
                  <Flag country={langSelect} size={32} />
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
                      <Flag country={lang.countryCode} size={32} />
                      {lang.countryCode}
                    </div>
                  ))}
                </div>
              </div>
              <input type="text" value={langInput} onChange={(e)=>setLangInput(e.target.value)} />
            </div>
            <div className="bunuses-text">
              <div className="bonuses-title">
                <p>Bonuses: </p> <span>€</span>
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
        </div>
      </div>
    </div>
  );
};

export default UpdateAvaible;

/*const [formData, setFormData] = useState({
    colour16: [
      { beck: '#FFFFFF', color: '#000000', isSelect: true },
      { beck: '#FFFFFF', color: '#0179D0', isSelect: true },
      { beck: '#FFFFFF', color: '#FE0000', isSelect: true },
      { beck: '#000000', color: '#FFFFFF', isSelect: true },
      { beck: '#2928FF', color: '#FFFFFF', isSelect: true },
      { beck: '#FD0100', color: '#FFFFFF', isSelect: true },
      { beck: '#017F01', color: '#FFFFFF', isSelect: true },
      { beck: '#FFFF01', color: '#000000', isSelect: true },
      { beck: 'linear-gradient(152.22deg, #B5B5B5 28.28%, #F5F5F5 52.41%, #979797 74.14%)', color: '#000000', isSelect: true },
      { beck: '#964B21', color: '#FFFFFF', isSelect: true },
      { beck: '#FD7714', color: '#FFFFFF', isSelect: true },
      { beck: '#808080', color: '#FFFFFF', isSelect: true },
      { beck: '#E6CCB2', color: '#000000', isSelect: true },
      { beck: '#36454F', color: '#FFFFFF', isSelect: true },
    ],
    colour08: [
      { beck: '#FFFFFF', color: '#000000', isSelect: true },
      { beck: '#FFFFFF', color: '#0179D0', isSelect: true },
      { beck: '#FFFFFF', color: '#FE0000', isSelect: true },
      { beck: '#000000', color: '#FFFFFF', isSelect: true },
      { beck: '#2928FF', color: '#FFFFFF', isSelect: true },
      { beck: '#FD0100', color: '#FFFFFF', isSelect: true },
      { beck: '#017F01', color: '#FFFFFF', isSelect: true },
      { beck: '#FFFF01', color: '#000000', isSelect: true },
      { beck: 'linear-gradient(152.22deg, #B5B5B5 28.28%, #F5F5F5 52.41%, #979797 74.14%)', color: '#000000', isSelect: true },
      { beck: '#964B21', color: '#FFFFFF', isSelect: true },
      { beck: '#FD7714', color: '#FFFFFF', isSelect: true },
      { beck: '#808080', color: '#FFFFFF', isSelect: true },
      { beck: '#E6CCB2', color: '#000000', isSelect: true },
      { beck: '#36454F', color: '#FFFFFF', isSelect: true },
    ],
    colour32: [
      { beck: '#FFFFFF', color: '#000000', isSelect: true },
      { beck: '#FFFFFF', color: '#0179D0', isSelect: true },
      { beck: '#FFFFFF', color: '#FE0000', isSelect: true },
      { beck: '#000000', color: '#FFFFFF', isSelect: true },
      { beck: '#2928FF', color: '#FFFFFF', isSelect: true },
      { beck: '#FD0100', color: '#FFFFFF', isSelect: true },
      { beck: '#017F01', color: '#FFFFFF', isSelect: true },
      { beck: '#FFFF01', color: '#000000', isSelect: true },
      { beck: 'linear-gradient(152.22deg, #B5B5B5 28.28%, #F5F5F5 52.41%, #979797 74.14%)', color: '#000000', isSelect: true },
      { beck: '#964B21', color: '#FFFFFF', isSelect: true },
      { beck: '#FD7714', color: '#FFFFFF', isSelect: true },
      { beck: '#808080', color: '#FFFFFF', isSelect: true },
      { beck: '#E6CCB2', color: '#000000', isSelect: true },
      { beck: '#36454F', color: '#FFFFFF', isSelect: true },
    ],
    listAccessories: [
      { isAvaible: true, img: '/images/accessories/CableTies 1.png', text: 'Cable ties', number: 0.05, info: 'Сable ties, size 3.6 x 140 mm' },
      { isAvaible: true, img: '/images/accessories/ph1 2.9 x 9.5 mm 1.png', text: 'Screws', number: 0.1, info: 'Size 2.9 x 9.5 mm' },
      { isAvaible: true, img: '/images/accessories/ph1 2.9 x 9.5 mm 1.png', text: 'Size 2.9 x 13 mm', number: 0.1, info: 'Size 2.9 x 13 mm' },
      { isAvaible: true, img: '/images/accessories/S-Hook.png', text: 'S-Hooks', number: 0.25, info: 'Nickel plated' },
      { isAvaible: true, img: '/images/accessories/Keyring 1.png', text: 'Keyrings', number: 0.7, info: '30 mm' },
      { isAvaible: true, img: '/images/accessories/Ballchain 1.png', text: 'Ball chains', number: 0.25, info: 'Nickel plated, length 10 cm' },
    ],
    listThinkness: {
      thinkness16: { isSelect: true, materialArea: [0.2, 0.22], engravingArea: [0.15, 0.15], holesPerimeter: [0.1, 0.1] },
      thinkness08: { isSelect: true, materialArea: [0.2, 0.22], engravingArea: [0.15, 0.15], holesPerimeter: [0.1, 0.1] },
      thinkness32: { isSelect: true, materialArea: [0.2, 0.22], engravingArea: [0.15, 0.15], holesPerimeter: [0.1, 0.1] }
    },
    discount: [
      { price: '30 - 50', discount: '5' },
      { price: '50 - 100', discount: '10' },
      { price: '100 - 200', discount: '15' },
      { price: '200 - 500', discount: '20' },
      { price: '500 - 10000', discount: '25' },
    ]
  });*/
