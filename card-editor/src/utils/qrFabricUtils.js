export const QR_DISPLAY_LAYER_ID = "qr-display-layer";
export const QR_EXPORT_LAYER_ID = "qr-export-layer";
export const DEFAULT_QR_CELL_SIZE = 4;

// ============================================================================
// DEBUG FLAGS - Встановіть false щоб вимкнути функцію та перевірити вплив
// ============================================================================
const DEBUG_FLAGS = {
  ENABLE_LOCK_QR_EXPORT_FILL: true,        // Блокування fill для export layer
  ENABLE_REMOVE_BLACK_RECTS: false,          // Видалення чорних rect з SVG
  ENABLE_DECORATE_DISPLAY_LAYER: true,       // Декорування display layer (excludeFromExport)
  ENABLE_DECORATE_EXPORT_LAYER: true,       // Декорування export layer (основна проблема!)
  ENABLE_DECORATE_OTHER_CHILDREN: false,      // Декорування інших дочірніх елементів (rect backgrounds)
  ENABLE_PATCH_GROUP_TO_SVG: true,           // Патч toSVG для групи - ВИДАЛЯЄ ЧОРНІ RECT
  ENABLE_PATCH_EXPORT_TO_SVG: false,         // Патч toSVG для export layer
  ENABLE_GROUP_BACKGROUND_RESET: false,       // Скидання backgroundColor групи
};

// Логування для дебагу
const debugLog = (funcName, message, data = null) => {
  console.log(`[QR_DEBUG][${funcName}]`, message, data || '');
};

/**
 * ІЗОЛЬОВАНА ФУНКЦІЯ - може бути вимкнена через DEBUG_FLAGS.ENABLE_LOCK_QR_EXPORT_FILL
 * Блокує властивість fill для export layer, завжди повертаючи null
 */
const lockQrExportFill = (fabricObject) => {
  if (!DEBUG_FLAGS.ENABLE_LOCK_QR_EXPORT_FILL) {
    debugLog('lockQrExportFill', 'ВИМКНЕНО - пропускаємо');
    return;
  }
  
  if (!fabricObject) return;
  debugLog('lockQrExportFill', 'Застосовуємо блокування fill', { objectId: fabricObject.id });
  
  if (!fabricObject.__qrFillLocked && typeof Object.defineProperty === "function") {
    let lockedValue = null;
    Object.defineProperty(fabricObject, "fill", {
      configurable: true,
      enumerable: true,
      get() {
        return lockedValue;
      },
      set() {
        lockedValue = null;
      },
    });
    fabricObject.__qrFillLocked = true;
  }

  fabricObject.fill = null;
};

/**
 * ІЗОЛЬОВАНА ФУНКЦІЯ - може бути вимкнена через DEBUG_FLAGS.ENABLE_REMOVE_BLACK_RECTS
 * Removes black background rectangles from SVG markup.
 * @param {string} svgMarkup - SVG string to clean
 * @returns {string} Cleaned SVG
 */
export const removeBlackBackgroundRects = (svgMarkup) => {
  if (!DEBUG_FLAGS.ENABLE_REMOVE_BLACK_RECTS) {
    debugLog('removeBlackBackgroundRects', 'ВИМКНЕНО - повертаємо без змін');
    return svgMarkup;
  }
  
  if (!svgMarkup || typeof svgMarkup !== 'string') return svgMarkup;
  
  debugLog('removeBlackBackgroundRects', 'Обробка SVG', { length: svgMarkup.length });
  
  let cleaned = svgMarkup;
  
  // Варіант 1: самозакриваючий rect з fill
  cleaned = cleaned.replace(
    /<rect[^>]*\s+fill\s*=\s*["']?(#000000|#000|black|rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0,\s*1\))["']?[^>]*\/>/gi,
    ''
  );
  
  // Варіант 2: rect з закриваючим тегом
  cleaned = cleaned.replace(
    /<rect[^>]*\s+fill\s*=\s*["']?(#000000|#000|black|rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0,\s*1\))["']?[^>]*>[\s\S]*?<\/rect>/gi,
    ''
  );
  
  // Варіант 3: rect зі style="fill: black"
  cleaned = cleaned.replace(
    /<rect[^>]*\s+style\s*=\s*["'][^"']*fill\s*:\s*(#000000|#000|black|rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0,\s*1\))[^"']*["'][^>]*\/>/gi,
    ''
  );
  
  // Варіант 4: rect зі style та закриваючим тегом
  cleaned = cleaned.replace(
    /<rect[^>]*\s+style\s*=\s*["'][^"']*fill\s*:\s*(#000000|#000|black|rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0,\s*1\))[^"']*["'][^>]*>[\s\S]*?<\/rect>/gi,
    ''
  );
  
  return cleaned;
};

/**
 * Builds display and export path data for a QR code instance.
 * Ця функція НЕ впливає на проблему з прозорістю - вона тільки генерує path дані
 * @param {object} qr - qrcode-generator instance with matrix prepared via make().
 * @param {number} cellSize - Size of a single QR module in pixels.
 * @returns {{optimizedPath: string, displayPath: string, size: number}}
 */
export const computeQrVectorData = (qr, cellSize = DEFAULT_QR_CELL_SIZE) => {
  const moduleCount = typeof qr?.getModuleCount === "function" ? qr.getModuleCount() : 0;
  if (!moduleCount || moduleCount <= 0) {
    return { optimizedPath: "", displayPath: "", size: 0 };
  }

  const horizontalLines = new Set();
  const verticalLines = new Set();
  let displayPath = "";

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.isDark(row, col)) continue;

      const x = col * cellSize;
      const y = row * cellSize;

      // Display path (filled squares)
      displayPath += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z`;

      // Top edge
      if (row === 0 || !qr.isDark(row - 1, col)) {
        horizontalLines.add(`${x},${y},${x + cellSize},${y}`);
      }

      // Bottom edge
      if (row === moduleCount - 1 || !qr.isDark(row + 1, col)) {
        horizontalLines.add(`${x},${y + cellSize},${x + cellSize},${y + cellSize}`);
      }

      // Left edge
      if (col === 0 || !qr.isDark(row, col - 1)) {
        verticalLines.add(`${x},${y},${x},${y + cellSize}`);
      }

      // Right edge
      if (col === moduleCount - 1 || !qr.isDark(row, col + 1)) {
        verticalLines.add(`${x + cellSize},${y},${x + cellSize},${y + cellSize}`);
      }
    }
  }

  const optimizedPathLines = [...horizontalLines, ...verticalLines].map((line) => {
    const [x1, y1, x2, y2] = line.split(",").map(Number);
    return `M${x1},${y1}L${x2},${y2}`;
  });

  return {
    optimizedPath: optimizedPathLines.join(""),
    displayPath,
    size: moduleCount * cellSize,
  };
};

/**
 * Creates SVG markup that contains two layers: one filled for on-canvas preview,
 * and one stroked for export. Layer ids are used to configure Fabric objects later.
 * Ця функція НЕ впливає на проблему з прозорістю - вона тільки генерує SVG
 * @param {object} params
 * @param {number} params.size - ViewBox size in pixels.
 * @param {string} params.displayPath - Path commands for filled modules.
 * @param {string} params.optimizedPath - Path commands for export stroke.
 * @param {string} params.strokeColor - Stroke (and fill) color.
 * @returns {string}
 */
export const buildQrSvgMarkup = ({
  size,
  displayPath,
  optimizedPath,
  strokeColor,
}) => {
  const safeColor = strokeColor || "#000000";
  debugLog('buildQrSvgMarkup', 'Створення SVG', { size, strokeColor: safeColor });
  
  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" fill="none">`;

  if (optimizedPath) {
    svg += `<path id="${QR_EXPORT_LAYER_ID}" d="${optimizedPath}" fill="none" stroke="${safeColor}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  if (displayPath) {
    svg += `<path id="${QR_DISPLAY_LAYER_ID}" d="${displayPath}" fill="${safeColor}" stroke="none"/>`;
  }

  svg += "</svg>";
  return svg;
};

/**
 * ГОЛОВНА ФУНКЦІЯ З ІЗОЛЬОВАНИМИ СЕКЦІЯМИ
 * Applies QR-specific flags to a Fabric group consisting of display/export layers.
 * Ensures the filled preview layer is ignored during export and interactions.
 * @param {fabric.Object} group
 * @returns {fabric.Object}
 */
export const decorateQrGroup = (group) => {
  if (!group) return group;
  
  debugLog('decorateQrGroup', '=== ПОЧАТОК ДЕКОРУВАННЯ ===', {
    isQRCode: group.isQRCode,
    qrText: group.qrText,
    hasForEachObject: typeof group.forEachObject === "function"
  });

  const withChildren = typeof group.forEachObject === "function";
  if (withChildren) {
    group.forEachObject((child) => {
      if (!child) return;
      
      debugLog('decorateQrGroup', 'Обробка дочірнього елемента', {
        childId: child.id,
        childType: child.type,
        currentFill: child.fill,
        currentStroke: child.stroke
      });
      
      // ==================== DISPLAY LAYER ====================
      if (child.id === QR_DISPLAY_LAYER_ID) {
        if (DEBUG_FLAGS.ENABLE_DECORATE_DISPLAY_LAYER) {
          debugLog('decorateQrGroup', 'Декорування DISPLAY layer - УВІМКНЕНО');
          child.set({
            excludeFromExport: true,
            selectable: false,
            evented: false,
          });
          // НЕ ЧІПАЄМО fill! Це ключова зміна - fill має залишатись як є
        } else {
          debugLog('decorateQrGroup', 'Декорування DISPLAY layer - ВИМКНЕНО');
        }
      }
      // ==================== EXPORT LAYER ====================
      else if (child.id === QR_EXPORT_LAYER_ID) {
        if (DEBUG_FLAGS.ENABLE_DECORATE_EXPORT_LAYER) {
          debugLog('decorateQrGroup', 'Декорування EXPORT layer - УВІМКНЕНО');
          
          // Зберігаємо поточний stroke колір перед будь-якими змінами
          const currentStroke = child.stroke;
          
          child.set({
            selectable: false,
            evented: false,
            strokeLineCap: child.strokeLineCap || "round",
            strokeLineJoin: child.strokeLineJoin || "round",
            // НЕ встановлюємо fill: null тут - це може впливати на display layer
            backgroundColor: null,
          });
          
          // Відновлюємо stroke якщо він був втрачений
          if (currentStroke) {
            child.set({ stroke: currentStroke });
          }
          
          lockQrExportFill(child);
          
          const storedStrokeWidth = child.qrExportStrokeWidth || child.strokeWidth || 1;
          child.qrExportStrokeWidth = storedStrokeWidth;
          child.strokeWidth = Math.min(child.strokeWidth || storedStrokeWidth, 0.001);
          
          // Патч toSVG для export layer
          if (DEBUG_FLAGS.ENABLE_PATCH_EXPORT_TO_SVG) {
            if (!child.__qrPatchedToSVG && typeof child.toSVG === "function") {
              const originalToSVG = child.toSVG.bind(child);
              child.toSVG = (reviver) => {
                const prevWidth = child.strokeWidth;
                const prevFill = child.fill;
                child.strokeWidth = child.qrExportStrokeWidth || 1;
                child.fill = null;
                const svgMarkup = originalToSVG(reviver);
                child.strokeWidth = prevWidth;
                child.fill = prevFill;
                return svgMarkup;
              };
              child.__qrPatchedToSVG = true;
            }
          }
        } else {
          debugLog('decorateQrGroup', 'Декорування EXPORT layer - ВИМКНЕНО');
        }
      }
      // ==================== OTHER CHILDREN ====================
      else {
        if (DEBUG_FLAGS.ENABLE_DECORATE_OTHER_CHILDREN) {
          debugLog('decorateQrGroup', 'Декорування OTHER children - УВІМКНЕНО', { 
            childType: child.type,
            childFill: child.fill 
          });
          
          // Для rect елементів (фонові прямокутники) - робимо прозорими
          if (child.type === 'rect' || child.type === 'Rect') {
            child.set({
              excludeFromExport: true,
              selectable: false,
              evented: false,
              fill: 'transparent',
              stroke: null,
              backgroundColor: null,
              opacity: 0,
            });
            debugLog('decorateQrGroup', 'Rect зроблено прозорим');
          } else {
            child.set({
              excludeFromExport: true,
              selectable: false,
              evented: false,
            });
          }
        } else {
          debugLog('decorateQrGroup', 'Декорування OTHER children - ВИМКНЕНО');
        }
      }
    });
  }

  // ==================== GROUP SETTINGS ====================
  if (DEBUG_FLAGS.ENABLE_GROUP_BACKGROUND_RESET) {
    debugLog('decorateQrGroup', 'Скидання background групи - УВІМКНЕНО');
    group.set({
      subTargetCheck: false,
      backgroundColor: 'transparent',
      fill: 'transparent',
      stroke: null,
    });
  } else {
    debugLog('decorateQrGroup', 'Скидання background групи - ВИМКНЕНО');
    // Мінімальні налаштування без зміни кольорів
    group.set({
      subTargetCheck: false,
    });
  }

  // ==================== PATCH GROUP toSVG ====================
  if (DEBUG_FLAGS.ENABLE_PATCH_GROUP_TO_SVG) {
    if (!group.__qrPatchedGroupToSVG && typeof group.toSVG === "function") {
      debugLog('decorateQrGroup', 'Патч toSVG групи - УВІМКНЕНО');
      const originalGroupToSVG = group.toSVG.bind(group);
      group.toSVG = (reviver) => {
        let svgMarkup = originalGroupToSVG(reviver);
        
        // Видаляємо rect елементи БЕЗ id (фонові rect від Fabric.js)
        // Самозакриваючі rect без id
        svgMarkup = svgMarkup.replace(
          /<rect(?![^>]*\sid\s*=)[^>]*?\/>/gi,
          ''
        );
        
        // rect без id з закриваючим тегом
        svgMarkup = svgMarkup.replace(
          /<rect(?![^>]*\sid\s*=)[^>]*>[\s\S]*?<\/rect>/gi,
          ''
        );
        
        // Видаляємо чорні rect (з будь-яким fill = black)
        svgMarkup = svgMarkup.replace(
          /<rect[^>]*\s+fill\s*=\s*["']?(#000000|#000|black|rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0,\s*1\))["']?[^>]*\/>/gi,
          ''
        );
        
        svgMarkup = svgMarkup.replace(
          /<rect[^>]*\s+fill\s*=\s*["']?(#000000|#000|black|rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0,\s*1\))["']?[^>]*>[\s\S]*?<\/rect>/gi,
          ''
        );
        
        // Видаляємо rect зі style="fill: black"
        svgMarkup = svgMarkup.replace(
          /<rect[^>]*\s+style\s*=\s*["'][^"']*fill\s*:\s*(#000000|#000|black|rgb\(0,\s*0,\s*0\))["']?[^>]*\/>/gi,
          ''
        );
        
        debugLog('decorateQrGroup', 'SVG після очистки rect', { length: svgMarkup.length });
        return svgMarkup;
      };
      group.__qrPatchedGroupToSVG = true;
    }
  } else {
    debugLog('decorateQrGroup', 'Патч toSVG групи - ВИМКНЕНО');
  }

  // Preserve custom props during serialization (це безпечно, не впливає на відображення)
  if (!group.__qrPatchedToObject && typeof group.toObject === "function") {
    const originalToObject = group.toObject.bind(group);
    group.toObject = (propertiesToInclude = []) =>
      originalToObject([
        ...propertiesToInclude,
        "isQRCode",
        "qrText",
        "qrSize",
      ]);
    group.__qrPatchedToObject = true;
  }

  debugLog('decorateQrGroup', '=== КІНЕЦЬ ДЕКОРУВАННЯ ===');
  return group;
};
