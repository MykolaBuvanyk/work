import React, { useState, useEffect } from 'react';
import './TellAbout.scss';

const tellAboutList = [
  'Colleague',
  'Social media',
  'Event / exhibition',
  'Newsletter',
  'E-Mail',
];

const TellAbout = ({ value, setValue }) => {
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [otherText, setOtherText] = useState('');

  // Обробка вибору зі списку
  const handleSelect = (item) => {
    setIsOtherSelected(false);
    setValue(item);
  };

  // Обробка активації поля "Other"
  const handleOtherClick = () => {
    setIsOtherSelected(true);
    setValue(otherText);
  };

  // Оновлення значення при вводі в інпут "Other"
  const handleOtherChange = (e) => {
    const text = e.target.value;
    setOtherText(text);
    setValue(text);
  };

  return (
    <div className='tell-about-cont'>
      <div className="dropdown">
        {/* Рендеримо стандартні опції */}
        {tellAboutList.map((item) => (
          <div 
            key={item} 
            className={`dropdown-item ${value === item && !isOtherSelected ? 'active' : ''}`}
            onClick={() => handleSelect(item)}
          >
            {item}
          </div>
        ))}

        {/* Спеціальна секція "Other" з інпутом */}
        <div className={`other-option ${isOtherSelected ? 'active' : ''}`}>
          <div className="label" onClick={handleOtherClick}>Other</div>
          <div className="input-wrapper">
            <input 
              type="text" 
              value={otherText}
              onChange={handleOtherChange}
              onFocus={() => setIsOtherSelected(true)}
              placeholder=""
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TellAbout;