import React, { useState } from 'react';
import './PleaceTell.scss';

const PleaceTell = () => {
  const [source, setSource] = useState('');
  const [otherText, setOtherText] = useState('');

  const options = [
    "Online / Internet",
    "Through samples",
    "Via flyer",
    "Colleague",
    "Social media",
    "Event / exhibition",
    "Newsletter",
    "E-Mail"
  ];

  return (
    <div className="please-tell-container">
      <h3>Please tell us where you heard about us — it will help us improve!</h3>
      
      <div className="survey-table">
        {options.map((option) => (
          <label key={option} className="table-row">
            <div className="label-cell">{option}</div>
            <div className="radio-cell">
              <input 
                type="radio" 
                name="source" 
                value={option} 
                checked={source === option}
                onChange={(e) => setSource(e.target.value)}
              />
              <span className="checkmark"></span>
            </div>
          </label>
        ))}

        <div className="table-row other-row">
          <div className="label-cell other-label">Other</div>
          <div className="input-cell">
            <input 
              type="text" 
              value={otherText} 
              onChange={(e) => setOtherText(e.target.value)}
              className="other-input"
              style={{background:'#ffffff'}}
            />
          </div>
        </div>
      </div>

      <button className="send-btn">Send</button>
    </div>
  );
};

export default PleaceTell;