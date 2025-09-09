// Simplified ImageTracer-like vectorization and helpers
// Exports: vectorizeDataURLToSVG(dataURL, opts)

/**
 * Vectorize a DataURL image into an SVG string.
 * @param {string} dataURL - image data URL
 * @param {Object} [opts]
 * @param {number} [opts.threshold=120] - grayscale threshold (0..255)
 * @param {number} [opts.pathomit=8] - minimum contour length to keep
 * @param {number} [opts.ltres=1] - line tolerance (kept for API symmetry)
 * @param {number} [opts.qtres=1] - curve tolerance (kept for API symmetry)
 * @param {number} [opts.maxSize=300] - downscale longest side before tracing
 * @param {number} [opts.scale=2] - multiply resulting SVG coordinates
 * @param {string} [opts.fillColor="#000"] - fill color for generated paths
 * @returns {Promise<string>} SVG markup string
 */
export function vectorizeDataURLToSVG(dataURL, opts = {}) {
  const options = {
    threshold: 120,
  // More aggressive defaults to reduce precision/complexity
  pathomit: 20, // min contour length
  ltres: 1,
  qtres: 1,
  maxSize: 240, // downscale more to reduce detail
  scale: 2,
    fillColor: "#000",
  // New simplification options
  simplifyTolerance: 2.5, // px tolerance for RDP
  pointStep: 2, // keep every N-th point
  quantize: 1, // px grid size for coordinates
  roundDecimals: 0, // decimals for output coordinates
  // Hole handling
  fillRule: "evenodd", // use evenodd to preserve holes
  combineToSinglePath: true,
  invert: false, // invert mask (treat light as foreground)
  autoThreshold: true, // use Otsu if true
  autoInvert: true, // detect dark border -> invert so shapes become black
  // Pre-processing
  brightness: 0, // -255..255 shift in grayscale before threshold
  // Complexity guards
  maxContours: 200,
  maxPointsPerContour: 2000,
  maxTotalPoints: 20000,
  timeBudgetMs: 800,
    ...opts,
  };

  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Create temp canvas and downscale
        const maxSize = options.maxSize;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.max(1, Math.floor(img.width * scale));
        const h = Math.max(1, Math.floor(img.height * scale));

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = w;
        tempCanvas.height = h;
        const ctx = tempCanvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        let imageData = ctx.getImageData(0, 0, w, h);
        // 1) Fast binarization (grayscale -> threshold -> black/white)
        imageData = binarizeImageData(imageData, {
          threshold: options.threshold,
          autoThreshold: options.autoThreshold !== false,
          autoInvert: options.autoInvert !== false,
          invert: typeof options.invert === 'boolean' ? options.invert : undefined,
          brightness: options.brightness || 0,
        });
        ctx.putImageData(imageData, 0, 0);

        // 2) Prefer potrace-wasm directly from canvas (very fast for silhouettes)
        //    Fallback to imagetracerjs, then to local tracer.
        vectorizeWithPreferredCanvas(tempCanvas, imageData, options)
          .then(resolve)
          .catch((err) => {
            if (err && err.code === 'PREFER_IMPORT_FAILED') {
              // Second try: imagetracerjs
              vectorizeWithImagetracer(imageData, options)
                .then(resolve)
                .catch(() => {
                  const svg = ImageTracer.imageToSVG(imageData, options);
                  resolve(svg);
                });
            } else {
              reject(err || new Error('VECTOR_TOO_COMPLEX'));
            }
          });
      };
      img.onerror = () => reject(new Error("Не вдалося завантажити зображення"));
      img.src = dataURL;
    } catch (e) {
      reject(e);
    }
  });
}

// Minimal tracer based on provided logic
const ImageTracer = {
  imageToSVG(imgd, options = {}) {
    const ltres = options.ltres || 1;
    const qtres = options.qtres || 1;
    const pathomit = options.pathomit || 8;
    const scale = options.scale || 1;
    const fillColor = options.fillColor || "black";
    const simplifyTolerance = options.simplifyTolerance ?? 0;
    const pointStep = Math.max(1, options.pointStep ?? 1);
    const quantize = Math.max(0, options.quantize ?? 0);
    const roundDecimals = Math.max(0, options.roundDecimals ?? 1);
    const fillRule = options.fillRule || "evenodd";
    const combineToSinglePath = options.combineToSinglePath !== false;

    const contours = this.getContoursWithHoles(imgd, {
      threshold: options.threshold,
      autoThreshold: options.autoThreshold !== false,
      invert: options.invert,
      autoInvert: options.autoInvert !== false,
    });

    let svgString = `<svg width="${imgd.width * scale}" height="${imgd.height * scale}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${imgd.width * scale} ${imgd.height * scale}">`;

    const subpaths = [];
    contours.forEach((entry) => {
      const contour = entry.points || entry; // backward compat
      if (contour.length > pathomit) {
        let pts = decimatePoints(contour, pointStep);
        if (simplifyTolerance > 0) pts = simplifyRDP(pts, simplifyTolerance);
        if (quantize > 0) pts = quantizePoints(pts, quantize);
        const pathString = this.contourToPath(pts, ltres, qtres, scale, roundDecimals);
        if (pathString) subpaths.push(pathString);
      }
    });

    if (subpaths.length) {
      if (combineToSinglePath) {
        // Combine subpaths into one compound path so fill-rule can create holes
        const d = subpaths.join(" ");
        svgString += `<path d="${d}" fill="${fillColor}" stroke="none" fill-rule="${fillRule}" clip-rule="${fillRule}"/>`;
      } else {
        subpaths.forEach((d) => {
          svgString += `<path d="${d}" fill="${fillColor}" stroke="none" fill-rule="${fillRule}" clip-rule="${fillRule}"/>`;
        });
      }
    }

    svgString += "</svg>";
    return svgString;
  },

  // Extracts both foreground contours and interior holes (background regions not touching border)
  getContoursWithHoles(imgd, cfg) {
    const data = imgd.data;
    const width = imgd.width;
    const height = imgd.height;
    const visited1 = new Array(width * height).fill(false);
    const visited0 = new Array(width * height).fill(false);
    const contours = [];
    const startTs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const maxContours = cfg.maxContours ?? 200;
    const maxTotalPoints = cfg.maxTotalPoints ?? 20000;
    let totalPoints = 0;

    // Binary conversion
    const binary = new Array(width * height);
    // 1) Determine threshold
    let threshold = typeof cfg.threshold === "number" ? cfg.threshold : undefined;
    if (threshold === undefined && cfg.autoThreshold) {
      threshold = otsuThreshold(data);
    }
    if (threshold === undefined) threshold = 120;

    // 2) Decide auto-invert from border if requested
    let invert = !!cfg.invert;
    if (cfg.autoInvert) {
      const borderMean = borderMeanGray(data, width, height);
      // if background (border) is darker than threshold -> invert so shapes become black
      if (borderMean < threshold) invert = true;
    }

    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const dark = gray < threshold;
      const v = dark ? 1 : 0; // dark pixels
      binary[idx] = invert ? (v ? 0 : 1) : v; // after invert, foreground=black shapes
    }

    // 1) Foreground contours
    outer1:
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const idx = y * width + x;
        if (binary[idx] === 1 && !visited1[idx]) {
          const contour = this.traceContourValue(binary, width, height, x, y, visited1, 1);
          if (contour.length > 10) {
            contours.push({ points: contour, isHole: false });
            totalPoints += contour.length;
            if (contours.length >= maxContours || totalPoints >= maxTotalPoints) break outer1;
          }
        }
        if (((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTs) > (cfg.timeBudgetMs ?? 800)) break outer1;
      }
    }

    // 2) Mark background connected to border to avoid treating it as holes
    const queue = [];
    const pushIfBackground = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const idx = y * width + x;
      if (binary[idx] === 0 && !visited0[idx]) {
        visited0[idx] = true;
        queue.push([x, y]);
      }
    };
    // push all border pixels that are background
    for (let x = 0; x < width; x++) {
      pushIfBackground(x, 0);
      pushIfBackground(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      pushIfBackground(0, y);
      pushIfBackground(width - 1, y);
    }
    while (queue.length) {
      const [cx, cy] = queue.shift();
      // 4-neighbor flood fill to mark non-hole background
      pushIfBackground(cx + 1, cy);
      pushIfBackground(cx - 1, cy);
      pushIfBackground(cx, cy + 1);
      pushIfBackground(cx, cy - 1);
    }

    // 3) Remaining background islands are holes -> trace their contours
    outer2:
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (binary[idx] === 0 && !visited0[idx]) {
          const contour = this.traceContourValue(binary, width, height, x, y, visited0, 0);
          if (contour.length > 10) {
            contours.push({ points: contour, isHole: true });
            totalPoints += contour.length;
            if (contours.length >= maxContours || totalPoints >= maxTotalPoints) break outer2;
          }
        }
        if (((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTs) > (cfg.timeBudgetMs ?? 800)) break outer2;
      }
    }

    // If too complex, abort to let caller fallback to raster
    if (contours.length >= maxContours || totalPoints >= maxTotalPoints || (((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTs) > (cfg.timeBudgetMs ?? 800))) {
      const err = new Error('VECTOR_TOO_COMPLEX');
      err.code = 'VECTOR_TOO_COMPLEX';
      throw err;
    }

    return contours;
  },

  traceContourValue(binary, width, height, startX, startY, visited, targetVal) {
    const contour = [];
    const directions = [
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [-1, -1],
      [0, -1],
      [1, -1],
    ];

    let x = startX,
      y = startY;
    let dir = 0;
    let steps = 0;

    do {
      const idx = y * width + x;
      if (idx >= 0 && idx < binary.length) {
        visited[idx] = true;
        contour.push({ x, y });
      }

      let found = false;
      for (let i = 0; i < 8; i++) {
        const newDir = (dir + i) % 8;
        const dx = directions[newDir][0];
        const dy = directions[newDir][1];
        const newX = x + dx;
        const newY = y + dy;
        if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
          const newIdx = newY * width + newX;
          if (binary[newIdx] === targetVal) {
            x = newX;
            y = newY;
            dir = newDir;
            found = true;
            break;
          }
        }
      }

      if (!found) break;
      steps++;
    } while ((x !== startX || y !== startY) && steps < 10000);

    return contour;
  },

  contourToPath(contour, ltres, qtres, scale, roundDecimals = 0) {
    if (!contour || contour.length < 3) return "";
    const fmt = (v) => {
      const f = Number((v).toFixed(roundDecimals));
      return Number.isFinite(f) ? f : 0;
    };
    // Enforce max points per contour (adaptive decimation)
    const maxPts = this.maxPointsPerContour || 2000;
    let pts = contour;
    if (pts.length > maxPts) {
      const step = Math.ceil(pts.length / maxPts);
      pts = decimatePoints(pts, step);
    }
    let simplified = pts;
    // Use iterative RDP to avoid recursion overflow
    if (simplified.length > 3) simplified = simplifyRDPIterative(simplified,  (roundDecimals === 0 ? 1.5 : 1) );
    let pathString = `M ${fmt(simplified[0].x * scale)} ${fmt(simplified[0].y * scale)}`;
    for (let i = 1; i < simplified.length; i++) {
      pathString += ` L ${fmt(simplified[i].x * scale)} ${fmt(simplified[i].y * scale)}`;
    }
    pathString += " Z";
    return pathString;
  },
};

export default ImageTracer;

// ---------- helpers to reduce path precision/complexity ----------

// Keep every N-th point and always keep last
function decimatePoints(points, step) {
  if (step <= 1) return points;
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

// Quantize coordinates to grid size (px)
function quantizePoints(points, grid) {
  if (grid <= 0) return points;
  const q = (v) => Math.round(v / grid) * grid;
  return points.map((p) => ({ x: q(p.x), y: q(p.y) }));
}

// Ramer–Douglas–Peucker polyline simplification
function simplifyRDP(points, tolerance) {
  if (!points || points.length < 3 || tolerance <= 0) return points;
  const sqTol = tolerance * tolerance;

  // perpendicular distance squared from point p to segment (a-b)
  const getSqSegDist = (p, a, b) => {
    let x = a.x;
    let y = a.y;
    let dx = b.x - x;
    let dy = b.y - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = b.x;
        y = b.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    dx = p.x - x;
    dy = p.y - y;
    return dx * dx + dy * dy;
  };

  const simplifyDP = (pts, first, last, out) => {
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const dist = getSqSegDist(pts[i], pts[first], pts[last]);
      if (dist > maxDist) {
        index = i;
        maxDist = dist;
      }
    }
    if (maxDist > sqTol && index !== -1) {
      if (index - first > 1) simplifyDP(pts, first, index, out);
      out.push(pts[index]);
      if (last - index > 1) simplifyDP(pts, index, last, out);
    }
  };

  const last = points.length - 1;
  const out = [points[0]];
  simplifyDP(points, 0, last, out);
  out.push(points[last]);
  return out;
}

// Iterative RDP (avoids deep recursion)
function simplifyRDPIterative(points, tolerance) {
  if (!points || points.length < 3 || tolerance <= 0) return points;
  const sqTol = tolerance * tolerance;
  const n = points.length;
  const stack = [[0, n - 1]];
  const keep = new Array(n).fill(false);
  keep[0] = keep[n - 1] = true;

  const getSqSegDist = (p, a, b) => {
    let x = a.x, y = a.y;
    let dx = b.x - x, dy = b.y - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b.x; y = b.y; }
      else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p.x - x; dy = p.y - y; return dx * dx + dy * dy;
  };

  while (stack.length) {
    const [first, last] = stack.pop();
    let index = -1; let maxDist = 0;
    for (let i = first + 1; i < last; i++) {
      const dist = getSqSegDist(points[i], points[first], points[last]);
      if (dist > maxDist) { index = i; maxDist = dist; }
    }
    if (maxDist > sqTol && index !== -1) {
      keep[index] = true;
      if (index - first > 1) stack.push([first, index]);
      if (last - index > 1) stack.push([index, last]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

// ---------- threshold and background helpers ----------

// Otsu global threshold (0..255)
function otsuThreshold(rgba) {
  const hist = new Array(256).fill(0);
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const g = Math.max(0, Math.min(255, Math.round(rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114)));
    hist[g]++;
    total++;
  }
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = -1;
  let threshold = 120;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > varMax) {
      varMax = between;
      threshold = t;
    }
  }
  return threshold;
}

// ---------- imagetracerjs integration (secondary path) ----------
async function vectorizeWithImagetracer(imageData, options) {
  try {
    const mod = await import('imagetracerjs');
    const IT = mod.default || mod;
    const itOpts = {
      numberofcolors: 2,
      colorsampling: 0,
      pathomit: options.pathomit ?? 20,
      ltres: options.ltres ?? 1,
      qtres: options.qtres ?? 1,
      blurradius: 0,
      blurdelta: 0,
      linefilter: false,
      scale: options.scale ?? 2,
      strokewidth: 0,
      viewbox: true,
    };
  const rawSvg = IT.imagedataToSVG(imageData, itOpts);
    // Filter only black shapes and unify fill
    const desiredFill = options.fillColor || '#000';
    const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
    const paths = Array.from(doc.querySelectorAll('path'));
    const blackDs = [];
    const isBlackFill = (fill) => {
      if (!fill) return false;
      const f = fill.toLowerCase();
      if (f === 'black' || f === '#000' || f === '#000000') return true;
      const m = f.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (m) {
        const r = +m[1], g = +m[2], b = +m[3];
        return r < 32 && g < 32 && b < 32; // near black
      }
      return false;
    };
    for (const p of paths) {
      const fill = p.getAttribute('fill');
      const d = p.getAttribute('d');
      if (d && isBlackFill(fill)) blackDs.push(d);
    }
    if (!blackDs.length) {
      const err = new Error('VECTOR_TOO_COMPLEX');
      err.code = 'VECTOR_TOO_COMPLEX';
      throw err;
    }
    if (paths.length > (options.maxContours ?? 200)) {
      const err = new Error('VECTOR_TOO_COMPLEX');
      err.code = 'VECTOR_TOO_COMPLEX';
      throw err;
    }
    const w = imageData.width * (options.scale || 1);
    const h = imageData.height * (options.scale || 1);
    const dCombined = blackDs.join(' ');
    const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="${dCombined}" fill="${desiredFill}" stroke="none" fill-rule="evenodd" clip-rule="evenodd"/></svg>`;
    return svg;
  } catch (e) {
    // Distinguish module import failure vs complexity
    if (e && (e.code === 'MODULE_NOT_FOUND' || String(e).includes('Cannot find module'))) {
      const err = new Error('PREFER_IMPORT_FAILED');
      err.code = 'PREFER_IMPORT_FAILED';
      throw err;
    }
    throw e;
  }
}

// ---------- potrace-wasm integration (preferred path) ----------
async function vectorizeWithPreferredCanvas(canvas, imageData, options) {
  try {
    const mod = await import('potrace-wasm');
    const loadFromCanvas = (mod.loadFromCanvas || (mod.default && mod.default.loadFromCanvas));
    if (!loadFromCanvas) throw new Error('MODULE_NOT_FOUND');

    const cfg = {
      // Smaller features removal; tuneable
      turdsize: 2,
      // Smoothing
      alphamax: 1.0,
      optcurve: true,
      // Turn policy can be 'minority','majority','black','white','right','left'
      turnpolicy: 'minority',
    };
    const rawSvg = await loadFromCanvas(canvas, cfg);

    // Recolor to desired fill and enforce evenodd
    const desiredFill = options.fillColor || '#000';
    const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    const w = imageData.width * (options.scale || 1);
    const h = imageData.height * (options.scale || 1);
    if (svgEl) {
      svgEl.setAttribute('width', String(w));
      svgEl.setAttribute('height', String(h));
      svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
    doc.querySelectorAll('path').forEach((p) => {
      p.setAttribute('fill', desiredFill);
      p.setAttribute('stroke', 'none');
      p.setAttribute('fill-rule', 'evenodd');
      p.setAttribute('clip-rule', 'evenodd');
    });
    const out = new XMLSerializer().serializeToString(doc);
    return out;
  } catch (e) {
    if (e && (e.code === 'MODULE_NOT_FOUND' || String(e).includes('Cannot find module'))) {
      const err = new Error('PREFER_IMPORT_FAILED');
      err.code = 'PREFER_IMPORT_FAILED';
      throw err;
    }
    throw e;
  }
}

// Fast grayscale -> binary for canvas ImageData
function binarizeImageData(imageData, cfg) {
  const { data, width, height } = imageData;
  let threshold = typeof cfg.threshold === 'number' ? cfg.threshold : undefined;
  if (threshold === undefined && cfg.autoThreshold) threshold = otsuThreshold(data);
  if (threshold === undefined) threshold = 120;
  let invert = !!cfg.invert;
  if (cfg.invert === undefined && cfg.autoInvert) {
    const borderMean = borderMeanGray(data, width, height);
    if (borderMean < threshold) invert = true;
  }
  const bright = Math.max(-255, Math.min(255, Math.round(cfg.brightness || 0)));
  for (let i = 0; i < data.length; i += 4) {
    let g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    g = Math.max(0, Math.min(255, g + bright));
    const isDark = invert ? g >= threshold : g < threshold;
    const v = isDark ? 0 : 255; // 0 = black (foreground), 255 = white
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  return imageData;
}

// Mean grayscale of image border
function borderMeanGray(rgba, width, height) {
  let sum = 0;
  let count = 0;
  const add = (x, y) => {
    const i = (y * width + x) * 4;
    const g = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114;
    sum += g;
    count++;
  };
  for (let x = 0; x < width; x++) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    add(0, y);
    add(width - 1, y);
  }
  return count ? sum / count : 255;
}
