import React from 'react';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import styles from './UndoRedo.module.css';

const UndoRedo = () => {
  const { historyIndex, historyLength, forceUnlockUndoRedo } = useUndoRedo();

  return (
    <div className={styles.undoRedo}>
      <h3>History</h3>
      <div className={styles.debug}>
        <small>Index: {historyIndex}, History length: {historyLength}</small>
        <button 
          onClick={forceUnlockUndoRedo}
          style={{ 
            margin: '5px', 
            padding: '2px 8px', 
            fontSize: '10px',
            backgroundColor: '#ff4444',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
          title="Force unlock undo/redo system if it's stuck"
        >
          🔓 Unlock
        </button>
      </div>
    </div>
  );
};

export default UndoRedo;