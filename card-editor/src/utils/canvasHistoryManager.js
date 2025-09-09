// Утиліта для кращого керування історією змін канвасу
export class CanvasHistoryManager {
  constructor(options = {}) {
    this.maxHistorySize = options.maxHistorySize || 100;
    this.compressionThreshold = options.compressionThreshold || 50;
    this.enableCompression = options.enableCompression || true;
    this.enableMetrics = options.enableMetrics || false;
    
    // Метрики для відстеження продуктивності
    this.metrics = {
      totalSaves: 0,
      totalRestores: 0,
      compressionsSaved: 0,
      averageSaveTime: 0,
      averageRestoreTime: 0
    };
  }

  // Оптимізація стану перед збереженням
  optimizeState(state) {
    if (!state || !state.objects) return state;

    const optimizedState = { ...state };
    
    // Видаляємо непотрібні властивості для історії
    const unnecessaryProps = [
      'canvas',
      '__corner',
      '__eventListeners',
      '_cacheCanvas',
      '_cacheContext',
      'statefullCache'
    ];

    if (optimizedState.objects) {
      optimizedState.objects = optimizedState.objects.map(obj => {
        const cleanObj = { ...obj };
        unnecessaryProps.forEach(prop => {
          delete cleanObj[prop];
        });
        
        // Округлюємо числові значення для зменшення розміру
        if (cleanObj.left) cleanObj.left = Math.round(cleanObj.left * 100) / 100;
        if (cleanObj.top) cleanObj.top = Math.round(cleanObj.top * 100) / 100;
        if (cleanObj.width) cleanObj.width = Math.round(cleanObj.width * 100) / 100;
        if (cleanObj.height) cleanObj.height = Math.round(cleanObj.height * 100) / 100;
        if (cleanObj.angle) cleanObj.angle = Math.round(cleanObj.angle * 100) / 100;
        
        return cleanObj;
      });
    }

    return optimizedState;
  }

  // Компресія історії (видалення дублікатів та об'єднання схожих станів)
  compressHistory(history) {
    if (!this.enableCompression || history.length < this.compressionThreshold) {
      return history;
    }

    const compressed = [];
    let compressionCount = 0;

    for (let i = 0; i < history.length; i++) {
      const currentState = history[i];
      const nextState = history[i + 1];
      
      // Якщо це останній елемент або стани значно відрізняються, зберігаємо
      if (!nextState || this.statesDifferSignificantly(currentState, nextState)) {
        compressed.push(currentState);
      } else {
        compressionCount++;
      }
    }

    if (this.enableMetrics) {
      this.metrics.compressionsSaved += compressionCount;
    }

    console.log(`History compressed: ${history.length} -> ${compressed.length} states`);
    return compressed;
  }

  // Перевірка чи значно відрізняються стани
  statesDifferSignificantly(state1, state2) {
    if (!state1 || !state2) return true;
    
    // Порівнюємо кількість об'єктів
    const objects1 = state1.objects || [];
    const objects2 = state2.objects || [];
    
    if (objects1.length !== objects2.length) return true;
    
    // Перевіряємо чи були значні зміни в позиціях або властивостях
    for (let i = 0; i < objects1.length; i++) {
      const obj1 = objects1[i];
      const obj2 = objects2[i];
      
      // Перевіряємо ключові властивості
      const significantProps = ['left', 'top', 'width', 'height', 'angle', 'fill', 'stroke'];
      
      for (const prop of significantProps) {
        const val1 = obj1[prop];
        const val2 = obj2[prop];
        
        if (typeof val1 === 'number' && typeof val2 === 'number') {
          // Для числових значень перевіряємо значну різницю
          if (Math.abs(val1 - val2) > 1) return true;
        } else if (val1 !== val2) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Створення мінімального стану для швидкого відновлення
  createSnapshot(canvas, options = {}) {
    const startTime = performance.now();
    
    const extraProps = [
      "shapeType", "baseCornerRadius", "displayCornerRadiusMm",
      "cornerRadiusMm", "isCutElement", "cutType", "strokeUniform",
      "strokeLineJoin", "strokeMiterLimit", "isCircle", "selectable",
      "evented", "hasControls", "hasBorders", "customProperties",
      "id", "name", "originalSrc", "filters", ...(options.extraProps || [])
    ];

    const state = canvas.toJSON(extraProps);
    const optimizedState = this.optimizeState(state);
    
    // Додаємо метадані
    const snapshot = {
      ...optimizedState,
      timestamp: Date.now(),
      canvasSize: {
        width: canvas.width,
        height: canvas.height
      },
      viewport: options.includeViewport ? {
        zoom: canvas.getZoom(),
        center: canvas.getCenter(),
        transform: canvas.viewportTransform?.slice()
      } : null,
      version: '1.0'
    };

    if (this.enableMetrics) {
      const saveTime = performance.now() - startTime;
      this.metrics.totalSaves++;
      this.metrics.averageSaveTime = 
        (this.metrics.averageSaveTime * (this.metrics.totalSaves - 1) + saveTime) / this.metrics.totalSaves;
    }

    return snapshot;
  }

  // Відновлення стану з перевірками
  async restoreSnapshot(canvas, snapshot, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      
      if (!canvas || !snapshot) {
        reject(new Error('Canvas or snapshot is missing'));
        return;
      }

      try {
        // Зберігаємо поточні налаштування якщо потрібно
        const preserveViewport = options.preserveViewport || false;
        const currentZoom = preserveViewport ? canvas.getZoom() : null;
        const currentTransform = preserveViewport && canvas.viewportTransform ? 
          canvas.viewportTransform.slice() : null;

        canvas.loadFromJSON(snapshot, () => {
          try {
            // Відновлюємо viewport якщо потрібно
            if (snapshot.viewport && !preserveViewport) {
              if (snapshot.viewport.zoom) {
                canvas.setZoom(snapshot.viewport.zoom);
              }
              if (snapshot.viewport.transform) {
                canvas.setViewportTransform(snapshot.viewport.transform);
              }
            } else if (preserveViewport) {
              if (currentZoom) canvas.setZoom(currentZoom);
              if (currentTransform) canvas.setViewportTransform(currentTransform);
            }

            // Оновлюємо канвас
            canvas.renderAll();
            
            // Очищаємо вибір якщо не потрібно зберігати
            if (!options.preserveSelection) {
              canvas.discardActiveObject();
            }

            if (this.enableMetrics) {
              const restoreTime = performance.now() - startTime;
              this.metrics.totalRestores++;
              this.metrics.averageRestoreTime = 
                (this.metrics.averageRestoreTime * (this.metrics.totalRestores - 1) + restoreTime) / this.metrics.totalRestores;
            }

            resolve(snapshot);
          } catch (renderError) {
            reject(new Error(`Error during canvas render: ${renderError.message}`));
          }
        });
      } catch (error) {
        reject(new Error(`Error restoring snapshot: ${error.message}`));
      }
    });
  }

  // Отримання метрик продуктивності
  getMetrics() {
    return { ...this.metrics };
  }

  // Скидання метрик
  resetMetrics() {
    this.metrics = {
      totalSaves: 0,
      totalRestores: 0,
      compressionsSaved: 0,
      averageSaveTime: 0,
      averageRestoreTime: 0
    };
  }

  // Валідація стану
  validateState(state) {
    if (!state) return false;
    if (typeof state !== 'object') return false;
    if (!Array.isArray(state.objects)) return false;
    
    // Перевіряємо чи всі об'єкти мають необхідні властивості
    return state.objects.every(obj => 
      obj && typeof obj === 'object' && obj.type
    );
  }

  // Порівняння двох станів
  compareStates(state1, state2) {
    if (!state1 || !state2) return { different: true, reason: 'Missing state' };
    
    const objects1 = state1.objects || [];
    const objects2 = state2.objects || [];
    
    if (objects1.length !== objects2.length) {
      return { 
        different: true, 
        reason: `Different object count: ${objects1.length} vs ${objects2.length}` 
      };
    }

    for (let i = 0; i < objects1.length; i++) {
      const obj1 = objects1[i];
      const obj2 = objects2[i];
      
      if (obj1.type !== obj2.type) {
        return { 
          different: true, 
          reason: `Different object type at index ${i}: ${obj1.type} vs ${obj2.type}` 
        };
      }
    }

    return { different: false, reason: 'States are similar' };
  }
}
