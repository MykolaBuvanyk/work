import React, { useState } from 'react'
import './UpdateAvaible.scss'

const UpdateAvaible = () => {
    const [formData,setFormData]=useState({
        colour16:[
            {beck:'#FFFFFF',color:'#000000',isSelect:true},
            {beck:'#FFFFFF',color:'#0179D0',isSelect:true},
            {beck:'#FFFFFF',color:'#FE0000',isSelect:true},
            {beck:'#000000',color:'#FFFFFF',isSelect:true},
            {beck:'#2928FF',color:'#FFFFFF',isSelect:true},
            {beck:'#FD0100',color:'#FFFFFF',isSelect:true},
            {beck:'#017F01',color:'#FFFFFF',isSelect:true},
            {beck:'#FFFF01',color:'#000000',isSelect:true},
            {beck:'linear-gradient(152.22deg, #B5B5B5 28.28%, #F5F5F5 52.41%, #979797 74.14%);',color:'#000000',isSelect:true},
            {beck:'#964B21',color:'#FFFFFF',isSelect:true},
            {beck:'#FD7714',color:'#FFFFFF',isSelect:true},
            {beck:'#808080',color:'#FFFFFF',isSelect:true},
            {beck:'#E6CCB2',color:'#000000',isSelect:true},
            {beck:'#36454F',color:'#FFFFFF',isSelect:true},
        ],
        colour08:[
            {beck:'#FFFFFF',color:'#000000',isSelect:true},
            {beck:'#FFFFFF',color:'#0179D0',isSelect:true},
            {beck:'#FFFFFF',color:'#FE0000',isSelect:true},
            {beck:'#000000',color:'#FFFFFF',isSelect:true},
            {beck:'#2928FF',color:'#FFFFFF',isSelect:true},
            {beck:'#FD0100',color:'#FFFFFF',isSelect:true},
            {beck:'#017F01',color:'#FFFFFF',isSelect:true},
            {beck:'#FFFF01',color:'#000000',isSelect:true},
            {beck:'linear-gradient(152.22deg, #B5B5B5 28.28%, #F5F5F5 52.41%, #979797 74.14%);',color:'#000000',isSelect:true},
            {beck:'#964B21',color:'#FFFFFF',isSelect:true},
            {beck:'#FD7714',color:'#FFFFFF',isSelect:true},
            {beck:'#808080',color:'#FFFFFF',isSelect:true},
            {beck:'#E6CCB2',color:'#000000',isSelect:true},
            {beck:'#36454F',color:'#FFFFFF',isSelect:true},
        ],
        colour32:[
            {beck:'#FFFFFF',color:'#000000',isSelect:true},
            {beck:'#FFFFFF',color:'#0179D0',isSelect:true},
            {beck:'#FFFFFF',color:'#FE0000',isSelect:true},
            {beck:'#000000',color:'#FFFFFF',isSelect:true},
            {beck:'#2928FF',color:'#FFFFFF',isSelect:true},
            {beck:'#FD0100',color:'#FFFFFF',isSelect:true},
            {beck:'#017F01',color:'#FFFFFF',isSelect:true},
            {beck:'#FFFF01',color:'#000000',isSelect:true},
            {beck:'linear-gradient(152.22deg, #B5B5B5 28.28%, #F5F5F5 52.41%, #979797 74.14%);',color:'#000000',isSelect:true},
            {beck:'#964B21',color:'#FFFFFF',isSelect:true},
            {beck:'#FD7714',color:'#FFFFFF',isSelect:true},
            {beck:'#808080',color:'#FFFFFF',isSelect:true},
            {beck:'#E6CCB2',color:'#000000',isSelect:true},
            {beck:'#36454F',color:'#FFFFFF',isSelect:true},
        ],
    });
  return (
    <div className='update-avaible-container'>
        <div className="button"><button>Save</button></div>
        <div className="list">
            <div className="row">
                <div className="title"><span>3</span> Thinkness: </div>
                <ul>
                    <li>1,6</li>
                    <li>0,8</li>
                    <li>3,2</li>
                </ul>
            </div>
        </div>
        <div className="list">
            <div className="title"><span>4</span> Colour </div>
            <div className="list-list-colors">
                <div className="list-colors">
                    {formData.colour16.map((x,idx)=>(
                        <div style={{backgroundColor:x.beck,color:x.color,opacity:x.isSelect?1:0.3}} key={idx}>
                            A
                        </div>
                    ))}
                </div>
                <div className="list-colors">
                    {formData.colour08.map((x,idx)=>(
                        <div style={{backgroundColor:x.beck,color:x.color,opacity:x.isSelect?1:0.3}} key={idx}>
                            A
                        </div>
                    ))}
                </div>
                <div className="list-colors">
                    {formData.colour32.map((x,idx)=>(
                        <div style={{backgroundColor:x.beck,color:x.color,opacity:x.isSelect?1:0.3}} key={idx}>
                            A
                        </div>
                    ))}
                </div>
            </div>
        </div>
        <div className="list">
            <div className="row">
                <div className="title" style={{whiteSpace:'nowrap'}}> Adhesive Tape: </div>
                <ul>
                    <li><input type='checkbox'/>1,6</li>
                    <li><input type='checkbox'/>0,8</li>
                    <li><input type='checkbox'/>3,2</li>
                </ul>
            </div>
        </div>
        <div style={{marginTop:'15px'}} className="list-list-colors">
            <div className="list-colors">
                {formData.colour16.map((x,idx)=>(
                    <div style={{backgroundColor:x.beck,color:x.color,opacity:x.isSelect?1:0.3}} key={idx}>
                        A
                    </div>
                ))}
            </div>
            <div className="list-colors">
                {formData.colour08.map((x,idx)=>(
                    <div style={{backgroundColor:x.beck,color:x.color,opacity:x.isSelect?1:0.3}} key={idx}>
                        A
                    </div>
                ))}
            </div>
            <div className="list-colors">
                {formData.colour32.map((x,idx)=>(
                    <div style={{backgroundColor:x.beck,color:x.color,opacity:x.isSelect?1:0.3}} key={idx}>
                        A
                    </div>
                ))}
            </div>
        </div>
        <div className="row">
            <div className="first">
                <div className="title">Accessories:</div>
                <ul className="list-elem">
                    <li className="elem">
                        <input type='checkbox' />
                        <img src='/images/accessories/CableTies 1.png' alt='CableTies'/>
                        <div className="text">Cable ties  €</div>
                        <input type='number' />
                        <div className="info">Сable ties, size 3.6 x 140 mm</div>
                    </li>
                </ul>
            </div>
        </div>
    </div>
  )
}

export default UpdateAvaible