import React, { useState, useEffect } from "react";
import { useUndoRedo } from "../../hooks/useUndoRedo";
import styles from "./HistoryPanel.module.css";

const HistoryPanel = ({ isOpen, onClose }) => {
  const { 
    history, 
    historyIndex, 
    goToHistoryState, 
    clearHistory, 
    getHistoryMetrics,
    exportHistory,
    importHistory 
  } = useUndoRedo();

  const [metrics, setMetrics] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredHistory, setFilteredHistory] = useState([]);

  // Оновлюємо метрики кожні 2 секунди
  useEffect(() => {
    if (isOpen && getHistoryMetrics) {
      const updateMetrics = () => {
        setMetrics(getHistoryMetrics());
      };
      
      updateMetrics();
      const interval = setInterval(updateMetrics, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen, getHistoryMetrics]);

  // Фільтруємо історію за пошуковим терміном
  useEffect(() => {
    if (!searchTerm) {
      setFilteredHistory(history);
      return;
    }

    const filtered = history.filter((state, index) => {
      const stateInfo = getStateInfo(state, index);
      return stateInfo.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
             stateInfo.time.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    setFilteredHistory(filtered);
  }, [history, searchTerm]);

  // Отримуємо інформацію про стан для відображення
  const getStateInfo = (state, index) => {
    const timestamp = state.timestamp || Date.now();
    const date = new Date(timestamp);
    const objectCount = state.objects ? state.objects.length : 0;
    
    // Визначаємо тип операції на основі змін
    let operationType = "Unknown";
    if (index > 0 && history[index - 1]) {
      const prevState = history[index - 1];
      const prevCount = prevState.objects ? prevState.objects.length : 0;
      
      if (objectCount > prevCount) {
        operationType = "Added object";
      } else if (objectCount < prevCount) {
        operationType = "Removed object";
      } else {
        operationType = "Modified";
      }
    } else if (index === 0) {
      operationType = "Initial state";
    }

    return {
      description: `${operationType} (${objectCount} objects)`,
      time: date.toLocaleTimeString(),
      objectCount,
      isCurrent: index === historyIndex
    };
  };

  // Обробка кліку по стану в історії
  const handleStateClick = (index) => {
    if (goToHistoryState) {
      goToHistoryState(index);
    }
  };

  // Експорт історії
  const handleExportHistory = () => {
    if (exportHistory) {
      const historyData = exportHistory();
      const blob = new Blob([JSON.stringify(historyData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `canvas-history-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Імпорт історії
  const handleImportHistory = (event) => {
    const file = event.target.files[0];
    if (file && importHistory) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const historyData = JSON.parse(e.target.result);
          importHistory(historyData);
        } catch (error) {
          alert('Error importing history: ' + error.message);
        }
      };
      reader.readAsText(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.historyPanel}>
      <div className={styles.header}>
        <h3>History Panel</h3>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>

      <div className={styles.controls}>
        <input
          type="text"
          placeholder="Search history..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        
        <div className={styles.actionButtons}>
          <button 
            onClick={clearHistory}
            className={styles.clearButton}
            title="Clear all history"
          >
            Clear
          </button>
          
          <button 
            onClick={handleExportHistory}
            className={styles.exportButton}
            title="Export history to file"
          >
            Export
          </button>
          
          <label className={styles.importButton} title="Import history from file">
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImportHistory}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      <div className={styles.historyList}>
        {filteredHistory.map((state, index) => {
          const stateInfo = getStateInfo(state, index);
          return (
            <div
              key={index}
              className={`${styles.historyItem} ${
                stateInfo.isCurrent ? styles.current : ''
              }`}
              onClick={() => handleStateClick(index)}
            >
              <div className={styles.stateInfo}>
                <div className={styles.description}>
                  {stateInfo.description}
                </div>
                <div className={styles.timestamp}>
                  {stateInfo.time}
                </div>
              </div>
              <div className={styles.stateIndex}>
                #{index + 1}
              </div>
            </div>
          );
        })}
      </div>

      {metrics && (
        <div className={styles.metrics}>
          <h4>Performance Metrics</h4>
          <div className={styles.metricsGrid}>
            <div className={styles.metric}>
              <span>Total Saves:</span>
              <span>{metrics.totalSaves}</span>
            </div>
            <div className={styles.metric}>
              <span>Total Restores:</span>
              <span>{metrics.totalRestores}</span>
            </div>
            <div className={styles.metric}>
              <span>Avg Save Time:</span>
              <span>{metrics.averageSaveTime?.toFixed(2)}ms</span>
            </div>
            <div className={styles.metric}>
              <span>Avg Restore Time:</span>
              <span>{metrics.averageRestoreTime?.toFixed(2)}ms</span>
            </div>
            {metrics.compressionsSaved > 0 && (
              <div className={styles.metric}>
                <span>Compressions:</span>
                <span>{metrics.compressionsSaved}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
