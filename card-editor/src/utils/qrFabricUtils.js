export const QR_DISPLAY_LAYER_ID = "qr-display-layer";
export const QR_EXPORT_LAYER_ID = "qr-export-layer";
export const DEFAULT_QR_CELL_SIZE = 4;

const lockQrExportFill = (fabricObject) => {
  if (!fabricObject) return;
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
 * Removes black background rectangles from SVG markup.
 * @param {string} svgMarkup - SVG string to clean
 * @returns {string} Cleaned SVG
 */
export const removeBlackBackgroundRects = (svgMarkup) => {
  if (!svgMarkup || typeof svgMarkup !== 'string') return svgMarkup;
  
  // Видаляємо rect елементи з чорним фоном (різні варіанти запису)
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
  // Додаємо fill="none" щоб SVG був без фону
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
 * Applies QR-specific flags to a Fabric group consisting of display/export layers.
 * Ensures the filled preview layer is ignored during export and interactions.
 * @param {fabric.Object} group
 * @returns {fabric.Object}
 */
export const decorateQrGroup = (group) => {
  if (!group) return group;

  const withChildren = typeof group.forEachObject === "function";
  if (withChildren) {
    group.forEachObject((child) => {
      if (!child) return;
      if (child.id === QR_DISPLAY_LAYER_ID) {
        child.set({
          excludeFromExport: true,
          selectable: false,
          evented: false,
        });
      } else if (child.id === QR_EXPORT_LAYER_ID) {
        child.set({
          selectable: false,
          evented: false,
          strokeLineCap: child.strokeLineCap || "round",
          strokeLineJoin: child.strokeLineJoin || "round",
          fill: null,
          backgroundColor: null,
        });
        lockQrExportFill(child);
        const storedStrokeWidth = child.qrExportStrokeWidth || child.strokeWidth || 1;
        child.qrExportStrokeWidth = storedStrokeWidth;
        child.strokeWidth = Math.min(child.strokeWidth || storedStrokeWidth, 0.001);
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
      } else {
        // Всі інші елементи (включаючи прозорий rect) виключаємо з експорту
        child.set({
          excludeFromExport: true,
          selectable: false,
          evented: false,
        });
      }
    });
  }

  group.set({
    subTargetCheck: false,
    backgroundColor: null,
    fill: null,
    stroke: null,
  });

  // Патч toSVG методу групи щоб видалити всі rect backgrounds
  if (!group.__qrPatchedGroupToSVG && typeof group.toSVG === "function") {
    const originalGroupToSVG = group.toSVG.bind(group);
    group.toSVG = (reviver) => {
      let svgMarkup = originalGroupToSVG(reviver);
      
      // Видаляємо ВСІ rect елементи які можуть бути background
      // Fabric.js може додавати rect для background групи
      svgMarkup = svgMarkup.replace(
        /<rect[^>]*?\/>/gi,
        ''
      );
      
      // Також видаляємо rect з закриваючим тегом
      svgMarkup = svgMarkup.replace(
        /<rect[^>]*>[\s\S]*?<\/rect>/gi,
        ''
      );
      
      return svgMarkup;
    };
    group.__qrPatchedGroupToSVG = true;
  }

  // Preserve custom props during serialization
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

  return group;
};
