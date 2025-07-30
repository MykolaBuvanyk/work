import React from 'react';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import styles from './UndoRedo.module.css';

const UndoRedo = () => {
  const { historyIndex, historyLength } = useUndoRedo();

  return (
    <div className={styles.undoRedo}>
      <h3>History</h3>
      <div className={styles.debug}>
        <small>Index: {historyIndex}, History length: {historyLength}</small>
      </div>
    </div>
  );
};

export default UndoRedo;