import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import PDFDocument from 'pdfkit';
import svgToPdf from 'svg-to-pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as fontkitModule from 'fontkit';
import TextToSVG from 'text-to-svg';
import paper from 'paper';
import sequelize from './db.js';
import './models/models.js';
import router from './router/index.js';
import { connectMongo } from './mongo.js';
import errorMiddleware from './middleware/errorMiddleware.js';
import { Order, User } from './models/models.js';
import { Op } from 'sequelize';
import SendEmailForStatus from './Controller/SendEmailForStatus.js';
import cron from 'node-cron';


dotenv.config();

const MM_TO_PT = 72 / 25.4;
const DEFAULT_PORT = Number(process.env.LAYOUT_EXPORT_PORT || 4177);
const REQUEST_BODY_LIMIT = process.env.LAYOUT_EXPORT_BODY_LIMIT || '512mb';
const MAX_EXPORT_SHEETS = Number(process.env.LAYOUT_EXPORT_MAX_SHEETS || 200);
const ALLOWED_ORIGINS = process.env.LAYOUT_EXPORT_ORIGINS
  ? process.env.LAYOUT_EXPORT_ORIGINS.split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
  : null;
const OUTLINE_STROKE_COLOR = '#0000FF';
const CUSTOM_BORDER_STROKE_COLOR = '#008181';
const CUSTOM_BORDER_STROKE_WIDTH_PT = 1;
const TEXT_OUTLINE_COLOR = '#008181';
const TEXT_STROKE_WIDTH_PT = 0.5;
const FONT_SIZE_PX_TO_PT_NEAR_UNIT_SCALE =0.99;
const PDF_TEXT_X_NUDGE_EM = 0;
const PDF_TEXT_Y_NUDGE_EM = 0;
const PLACEMENT_TEXT_GLOBAL_Y_SHIFT_MM = -0.25;
const PLACEMENT_TEXT_GLOBAL_Y_SHIFT_PT = PLACEMENT_TEXT_GLOBAL_Y_SHIFT_MM * MM_TO_PT;
const FABRIC_FONT_SIZE_FRACTION = 0.222;
const FABRIC_FONT_SIZE_MULT = 1.13;
const FABRIC_TEXT_BASELINE_OFFSET_EM =
  FABRIC_FONT_SIZE_MULT * (1 - FABRIC_FONT_SIZE_FRACTION);
const PDF_SHEET_INFO_LEFT_SHIFT_MODES = new Set([
  'Sheet A4 portrait',
  'Sheet A5 portrait',
  'Sheet A4 landscape',
]);
const PDF_SHEET_INFO_LEFT_SHIFT_MM = 2;

const normalizeColorForGrouping = value => {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, '');
  const shortHex = /^#([0-9a-f]{3})$/i;
  const shortHexWithAlpha = /^#([0-9a-f]{4})$/i;
  const match3 = compact.match(shortHex);
  if (match3) {
    const [r, g, b] = match3[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  const match4 = compact.match(shortHexWithAlpha);
  if (match4) {
    const [r, g, b, a] = match4[1].split('');
    return `#${r}${r}${g}${g}${b}${b}${a}${a}`;
  }
  return compact;
};

const normalizeThicknessMmForGrouping = thicknessPx => {
  const px = Number(thicknessPx);
  if (!Number.isFinite(px) || px <= 0) return null;
  const mm = px / MM_TO_PT;
  return Math.round(mm * 100) / 100;
};

const getMaterialKeyFromPlacement = placement => {
  const colorRaw =
    placement?.materialColor ||
    placement?.customBorder?.exportStrokeColor ||
    placement?.customBorder?.displayStrokeColor ||
    placement?.themeStrokeColor ||
    null;
  const thicknessMmFromMaterial = (() => {
    const numeric = Number(placement?.materialThicknessMm);
    if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric * 100) / 100;
    return null;
  })();
  const thicknessMm =
    thicknessMmFromMaterial ??
    normalizeThicknessMmForGrouping(placement?.customBorder?.thicknessPx);
  const color = normalizeColorForGrouping(colorRaw) || 'unknown';
  const thickness = thicknessMm !== null ? String(thicknessMm) : 'unknown';

  const tapeRaw = placement?.isAdhesiveTape;
  const tape = tapeRaw === true || tapeRaw === 1 || tapeRaw === 'true' || tapeRaw === '1';
  const tapeKey = tape ? 'tape' : 'no-tape';

  return `${color}::${thickness}::${tapeKey}`;
};

const splitSheetByMaterial = sheet => {
  const placements = Array.isArray(sheet?.placements) ? sheet.placements : [];
  if (placements.length <= 1) return [sheet];

  const groups = new Map();
  const order = [];
  placements.forEach(placement => {
    const key = getMaterialKeyFromPlacement(placement);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key).push(placement);
  });

  if (order.length <= 1) return [sheet];

  return order.map(key => ({
    ...sheet,
    placements: groups.get(key) || [],
    materialKey: key,
  }));
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FONT_DIR = path.resolve(__dirname, '../src/assets/fonts');

const FONT_DEFINITIONS = [
  {
    id: 'AbrilFatface-Regular',
    file: 'AbrilFatface-Regular.ttf',
    aliases: ['abril fatface', 'abril-fatface'],
  },
  {
    id: 'AlfaSlabOne-Regular',
    file: 'AlfaSlabOne-Regular.ttf',
    aliases: ['alfa slab one', 'alfa-slab-one'],
  },
  {
    id: 'ArialMT',
    file: 'ArialMT.ttf',
    aliases: ['arial', 'arialmt', 'arial, sans-serif'],
  },
  {
    id: 'Arial-BoldMT',
    file: 'Arial-BoldMT.ttf',
    aliases: ['arial bold', 'arial-bold', 'arial bold mt', 'arial boldmt'],
  },
  {
    id: 'Arial-ItalicMT',
    file: 'Arial-ItalicMT.ttf',
    aliases: ['arial italic', 'arial-italic', 'arial italic mt'],
  },
  {
    id: 'Arial-BoldItalicMT',
    file: 'Arial-BoldItalicMT.ttf',
    aliases: ['arial bold italic', 'arial-bold-italic', 'arial bolditalic'],
  },
  {
    id: 'ArialNarrow',
    file: 'ArialNarrow.ttf',
    aliases: ['arial narrow', 'arial-narrow'],
  },
  {
    id: 'ArialNarrow-Bold',
    file: 'ArialNarrow-Bold.ttf',
    aliases: ['arial narrow bold', 'arial-narrow bold', 'arial narrow-bold'],
  },
  {
    id: 'Audiowide-Regular',
    file: 'Audiowide-Regular.ttf',
    aliases: ['audiowide'],
  },
  { id: 'Baloo-Regular', file: 'Baloo-Regular.ttf', aliases: ['baloo'] },
  {
    id: 'Baloo2-Regular',
    file: 'Baloo2-Regular.ttf',
    aliases: ['baloo 2', 'baloo2'],
  },
  {
    id: 'Baloo2-Medium',
    file: 'Baloo2-Medium.ttf',
    aliases: ['baloo 2 medium', 'baloo2 medium', 'baloo 2-medium'],
  },
  {
    id: 'Baloo2-Bold',
    file: 'Baloo2-Bold.ttf',
    aliases: ['baloo 2 bold', 'baloo2 bold', 'baloo 2-bold'],
  },
  {
    id: 'BreeSerif-Regular',
    file: 'BreeSerif-Regular.ttf',
    aliases: ['bree serif', 'bree-serif'],
  },
  {
    id: 'ComicSansMS',
    file: 'ComicSansMS.ttf',
    aliases: ['comic sans ms', 'comic-sans-ms'],
  },
  {
    id: 'ComicSansMS-Bold',
    file: 'ComicSansMS-Bold.ttf',
    aliases: ['comic sans ms bold', 'comic-sans-ms bold'],
  },
  {
    id: 'ComicSansMS-BoldItalic',
    file: 'ComicSansMS-BoldItalic.ttf',
    aliases: ['comic sans ms bold italic', 'comic-sans-ms bold italic'],
  },
  {
    id: 'CourierNewPSMT',
    path: 'C:/Windows/Fonts/cour.ttf',
    aliases: ['courier new', 'couriernew', 'courier'],
  },
  {
    id: 'CourierNewPS-BoldMT',
    path: 'C:/Windows/Fonts/courbd.ttf',
    aliases: ['courier new bold', 'couriernew bold', 'courier bold'],
  },
  {
    id: 'CourierNewPS-ItalicMT',
    path: 'C:/Windows/Fonts/couri.ttf',
    aliases: ['courier new italic', 'couriernew italic', 'courier italic'],
  },
  {
    id: 'CourierNewPS-BoldItalicMT',
    path: 'C:/Windows/Fonts/courbi.ttf',
    aliases: [
      'courier new bold italic',
      'couriernew bold italic',
      'courier new bolditalic',
      'courier bold italic',
    ],
  },
  {
    id: 'Courgette-Regular',
    file: 'Courgette-Regular.ttf',
    aliases: ['courgette'],
  },
  {
    id: 'DancingScript-Bold',
    file: 'DancingScript-Bold.ttf',
    aliases: ['dancing script', 'dancing-script', 'dancing script bold', 'dancing-script bold'],
  },
  {
    id: 'Daniel-Bold',
    file: 'Daniel-Bold.ttf',
    aliases: ['daniel', 'daniel bold'],
  },
  {
    id: 'DIN1451Engschrift',
    file: 'DIN1451Engschrift.ttf',
    aliases: ['din 1451 engschrift', 'din1451 engschrift'],
  },
  {
    id: 'DIN1451Mittelschrift',
    file: 'DIN1451Mittelschrift.ttf',
    aliases: ['din 1451 mittelschrift', 'din1451 mittelschrift'],
  },
  {
    id: 'Exmouth',
    file: 'exmouth_.ttf',
    aliases: ['exmouth', 'exmouth script'],
  },
  { id: 'Exo2-Regular', file: 'Exo2-Regular.ttf', aliases: ['exo 2', 'exo2'] },
  {
    id: 'Exo2-Medium',
    file: 'Exo2-Medium.ttf',
    aliases: ['exo 2 medium', 'exo2 medium'],
  },
  {
    id: 'Exo2-Bold',
    file: 'Exo2-Bold.ttf',
    aliases: ['exo 2 bold', 'exo2 bold'],
  },
  {
    id: 'Exo2-MediumItalic',
    file: 'Exo2-MediumItalic.ttf',
    aliases: ['exo 2 medium italic', 'exo2 medium italic'],
  },
  {
    id: 'Exo2-BoldItalic',
    file: 'Exo2-BoldItalic.ttf',
    aliases: ['exo 2 bold italic', 'exo2 bold italic'],
  },
  {
    id: 'Gotham-Medium',
    file: 'Gotham-Medium.ttf',
    aliases: ['gotham', 'gotham medium'],
  },
  { id: 'Gotham-Bold', file: 'Gotham-Bold.ttf', aliases: ['gotham bold'] },
  {
    id: 'Gotham-MediumItalic',
    file: 'Gotham-MediumItalic.ttf',
    aliases: ['gotham medium italic'],
  },
  {
    id: 'Gotham-BoldItalic',
    file: 'Gotham-BoldItalic.ttf',
    aliases: ['gotham bold italic'],
  },
  {
    id: 'GreatVibes-Regular',
    file: 'GreatVibes-Regular.ttf',
    aliases: ['great vibes', 'great-vibes'],
  },
  {
    id: 'Georgia',
    path: 'C:/Windows/Fonts/georgia.ttf',
    aliases: ['georgia'],
  },
  {
    id: 'Georgia-Bold',
    path: 'C:/Windows/Fonts/georgiab.ttf',
    aliases: ['georgia bold'],
  },
  {
    id: 'Georgia-Italic',
    path: 'C:/Windows/Fonts/georgiai.ttf',
    aliases: ['georgia italic'],
  },
  {
    id: 'Georgia-BoldItalic',
    path: 'C:/Windows/Fonts/georgiaz.ttf',
    aliases: ['georgia bold italic', 'georgia bolditalic'],
  },
  { id: 'Handlee-Regular', file: 'Handlee-Regular.ttf', aliases: ['handlee'] },
  {
    id: 'ImpactLTStd',
    file: 'ImpactLTStd.ttf',
    aliases: ['impact', 'impact lt std', 'impactltstd'],
  },
  { id: 'Inter-Regular', file: 'Inter-Regular.ttf', aliases: ['inter'] },
  { id: 'Inter-Bold', file: 'Inter-Bold.ttf', aliases: ['inter bold'] },
  { id: 'Inter-Italic', file: 'Inter-Italic.ttf', aliases: ['inter italic'] },
  {
    id: 'Inter-ExtraBoldItalic',
    file: 'Inter-ExtraBoldItalic.ttf',
    aliases: ['inter extra bold italic', 'inter extrabold italic'],
  },
  { id: 'Kalam-Regular', file: 'Kalam-Regular.ttf', aliases: ['kalam'] },
  { id: 'Kalam-Bold', file: 'Kalam-Bold.ttf', aliases: ['kalam bold'] },
  {
    id: 'KeaniaOne-Regular',
    file: 'KeaniaOne-Regular.ttf',
    aliases: ['keania one', 'keania-one'],
  },
  { id: 'Lobster-Regular', file: 'Lobster-Regular.ttf', aliases: ['lobster'] },
  {
    id: 'Merriweather-Regular',
    file: 'Merriweather-Regular.ttf',
    aliases: ['merriweather'],
  },
  {
    id: 'Merriweather-BoldItalic',
    file: 'Merriweather-BoldItalic.ttf',
    aliases: ['merriweather bold italic', 'merriweather bolditalic'],
  },
  {
    id: 'Merriweather-BlackItalic',
    file: 'Merriweather-BlackItalic.ttf',
    aliases: ['merriweather black italic', 'merriweather blackitalic'],
  },
  { id: 'Oswald-Regular', file: 'Oswald-Regular.ttf', aliases: ['oswald'] },
  { id: 'Oswald-Bold', file: 'Oswald-Bold.ttf', aliases: ['oswald bold'] },
  {
    id: 'Pacifico-Regular',
    file: 'Pacifico-Regular.ttf',
    aliases: ['pacifico'],
  },
  {
    id: 'PatuaOne-Regular',
    file: 'PatuaOne-Regular.ttf',
    aliases: ['patua one', 'patua-one'],
  },
  { id: 'Roboto-Regular', file: 'Roboto-Regular.ttf', aliases: ['roboto'] },
  { id: 'Roboto-Bold', file: 'Roboto-Bold.ttf', aliases: ['roboto bold'] },
  {
    id: 'Roboto-Italic',
    file: 'Roboto-Italic.ttf',
    aliases: ['roboto italic'],
  },
  {
    id: 'Roboto-BoldItalic',
    file: 'Roboto-BoldItalic.ttf',
    aliases: ['roboto bold italic', 'roboto bolditalic'],
  },
  { id: 'Rubik-Regular', file: 'Rubik-Regular.ttf', aliases: ['rubik'] },
  { id: 'Rubik-Bold', file: 'Rubik-Bold.ttf', aliases: ['rubik bold'] },
  {
    id: 'Rubik-BoldItalic',
    file: 'Rubik-BoldItalic.ttf',
    aliases: ['rubik bold italic', 'rubik bolditalic'],
  },
  {
    id: 'Sacramento-Regular',
    file: 'Sacramento-Regular.ttf',
    aliases: ['sacramento'],
  },
  { id: 'Satisfy-Regular', file: 'Satisfy-Regular.ttf', aliases: ['satisfy'] },
  {
    id: 'StardosStencil-Regular',
    file: 'StardosStencil-Regular.ttf',
    aliases: ['stardos stencil', 'stardos-stencil'],
  },
  {
    id: 'StardosStencil-Bold',
    file: 'StardosStencil-Bold.ttf',
    aliases: ['stardos stencil bold', 'stardos-stencil bold'],
  },
  { id: 'Teko-Regular', file: 'Teko-Regular.ttf', aliases: ['teko'] },
  {
    id: 'Teko-SemiBold',
    file: 'Teko-SemiBold.ttf',
    aliases: ['teko semibold', 'teko semi bold'],
  },
  { id: 'Teko-Bold', file: 'Teko-Bold.ttf', aliases: ['teko bold'] },
  {
    id: 'TimesNewRomanMTStd',
    file: 'TimesNewRomanMTStd.ttf',
    aliases: ['times', 'times new roman', 'timesnewroman'],
  },
  {
    id: 'TimesNewRomanMTStd-Bold',
    file: 'TimesNewRomanMTStd-Bold.ttf',
    aliases: ['times new roman bold', 'timesnewroman bold'],
  },
  {
    id: 'TimesNewRomanMTStd-Italic',
    file: 'TimesNewRomanMTStd-Italic.ttf',
    aliases: ['times new roman italic', 'timesnewroman italic'],
  },
  {
    id: 'TimesNewRomanMTStd-BoldIt',
    file: 'TimesNewRomanMTStd-BoldIt.ttf',
    aliases: ['times new roman bold italic', 'timesnewroman bold italic'],
  },
  {
    id: 'VT323-Regular',
    file: 'VT323-Regular.ttf',
    aliases: ['vt323', 'vt 323'],
  },
];

const fontkit = fontkitModule?.default || fontkitModule;
const FONT_DEFINITION_MAP = new Map(FONT_DEFINITIONS.map(def => [def.id, def]));
const FONTKIT_CACHE = new Map();
const TEXT_TO_SVG_CACHE = new Map();
const TEXT_TO_SVG_ANCHOR = 'left top';
const PLACEMENT_TEXT_TO_SVG_ANCHOR = 'left baseline';

const DEFAULT_FONT_ID = 'ArialMT';

const FONT_ALIAS_LOOKUP = FONT_DEFINITIONS.reduce((map, def) => {
  def.aliases.forEach(alias => {
    map.set(alias.toLowerCase(), def.id);
  });
  map.set(def.id.toLowerCase(), def.id);
  return map;
}, new Map());

const getFontDefinition = fontId => FONT_DEFINITION_MAP.get(fontId);

const resolveFontPath = fontId => {
  const def = getFontDefinition(fontId);
  if (!def) {
    return null;
  }
  if (def.path) {
    return def.path;
  }
  return path.resolve(FONT_DIR, def.file);
};

const getFontkitFont = fontId => {
  if (!fontkit || typeof fontkit.openSync !== 'function') {
    return null;
  }

  if (FONTKIT_CACHE.has(fontId)) {
    return FONTKIT_CACHE.get(fontId);
  }

  const fontPath = resolveFontPath(fontId);
  if (!fontPath) {
    FONTKIT_CACHE.set(fontId, null);
    return null;
  }

  try {
    const fontInstance = fontkit.openSync(fontPath);
    FONTKIT_CACHE.set(fontId, fontInstance);
    return fontInstance;
  } catch (error) {
    console.warn(`Не вдалося завантажити шрифт ${fontId} через fontkit:`, error.message);
    FONTKIT_CACHE.set(fontId, null);
    return null;
  }
};

const getTextToSvgInstance = fontId => {
  if (TEXT_TO_SVG_CACHE.has(fontId)) {
    return TEXT_TO_SVG_CACHE.get(fontId);
  }

  const fontPath = resolveFontPath(fontId);
  if (!fontPath) {
    TEXT_TO_SVG_CACHE.set(fontId, null);
    return null;
  }

  try {
    const instance = TextToSVG.loadSync(fontPath);
    TEXT_TO_SVG_CACHE.set(fontId, instance);
    return instance;
  } catch (error) {
    console.warn(`Не вдалося підготувати TextToSVG для ${fontId}:`, error.message);
    TEXT_TO_SVG_CACHE.set(fontId, null);
    return null;
  }
};

let PAPER_GLYPH_SCOPE = null;

const getPaperGlyphScope = () => {
  if (PAPER_GLYPH_SCOPE) {
    return PAPER_GLYPH_SCOPE;
  }

  try {
    const scope = new paper.PaperScope();
    scope.setup(new scope.Size(1000, 1000));
    PAPER_GLYPH_SCOPE = scope;
    return PAPER_GLYPH_SCOPE;
  } catch (error) {
    console.warn('Не вдалося ініціалізувати Paper.js для гліф-інтерсекту:', error.message);
    PAPER_GLYPH_SCOPE = null;
    return null;
  }
};

const buildIntersectedGlyphPathData = (textToSvgInstance, text, fontSize) => {
  if (!textToSvgInstance || !text || !Number.isFinite(fontSize) || fontSize <= 0) {
    return null;
  }

  const font = textToSvgInstance.font;
  if (!font || typeof font.stringToGlyphs !== 'function') {
    return null;
  }

  const scope = getPaperGlyphScope();
  if (!scope) {
    return null;
  }

  try {
    scope.project.clear();

    const glyphs = font.stringToGlyphs(String(text));
    if (!Array.isArray(glyphs) || glyphs.length === 0) {
      scope.project.clear();
      return null;
    }

    const glyphItems = [];
    const unitsPerEm = Number(font.unitsPerEm) || 1000;
    const unitToPx = fontSize / unitsPerEm;
    let cursorXPx = 0;

    for (let i = 0; i < glyphs.length; i += 1) {
      const glyph = glyphs[i];
      if (!glyph) continue;

      let glyphPathData = '';
      try {
        const glyphPath = glyph.getPath(cursorXPx, 0, fontSize, { kerning: false });
        glyphPathData = typeof glyphPath?.toPathData === 'function' ? glyphPath.toPathData(5) : '';
      } catch {
        glyphPathData = '';
      }

      if (glyphPathData && glyphPathData.trim()) {
        try {
          const pathItem = new scope.CompoundPath(glyphPathData);
          glyphItems.push(pathItem);
        } catch {
          // Ignore single-glyph parse failures and keep the rest.
        }
      } else {
        glyphItems.push(null);
      }

      const advance = Number(glyph.advanceWidth) || 0;
      const nextGlyph = i + 1 < glyphs.length ? glyphs[i + 1] : null;
      const kerning =
        nextGlyph && typeof font.getKerningValue === 'function'
          ? Number(font.getKerningValue(glyph, nextGlyph)) || 0
          : 0;
      cursorXPx += (advance + kerning) * unitToPx;
    }

    for (let i = 0; i + 1 < glyphItems.length; i += 1) {
      const leftGlyph = glyphItems[i];
      const rightGlyph = glyphItems[i + 1];
      if (!leftGlyph || !rightGlyph || !leftGlyph.bounds || !rightGlyph.bounds) continue;

      const leftBounds = leftGlyph.bounds;
      const rightBounds = rightGlyph.bounds;
      if (!leftBounds.intersects(rightBounds)) continue;

      let overlap = null;
      let clipped = null;
      try {
        // Detect the actual contour-overlap region between neighbor glyphs.
        overlap = leftGlyph.intersect(rightGlyph, { insert: false });
      } catch {
        overlap = null;
      }

      if (!overlap || !overlap.pathData || !overlap.pathData.trim()) {
        try {
          if (overlap) overlap.remove();
        } catch {}
        continue;
      }

      try {
        // Trim only where contours actually intersect, preserving non-overlapping parts.
        clipped = leftGlyph.subtract(overlap, { insert: false });
      } catch {
        clipped = null;
      }

      try {
        overlap.remove();
      } catch {}

      if (clipped && clipped.pathData) {
        try {
          leftGlyph.remove();
        } catch {}
        glyphItems[i] = clipped;
      } else {
        try {
          if (clipped) clipped.remove();
        } catch {}
      }
    }

    const pathData = glyphItems
      .filter(item => item && typeof item.pathData === 'string' && item.pathData.trim())
      .map(item => item.pathData)
      .join(' ')
      .trim();

    scope.project.clear();
    return pathData || null;
  } catch (error) {
    try {
      scope.project.clear();
    } catch {}
    return null;
  }
};

const fontSupportsCodePoint = (fontInstance, codePoint) => {
  if (!fontInstance || typeof codePoint !== 'number') return false;
  try {
    if (typeof fontInstance.hasGlyphForCodePoint === 'function') {
      return fontInstance.hasGlyphForCodePoint(codePoint);
    }
    if (typeof fontInstance.glyphForCodePoint === 'function') {
      const glyph = fontInstance.glyphForCodePoint(codePoint);
      return Boolean(glyph && glyph.id !== 0);
    }
  } catch (error) {
    return false;
  }
  return false;
};

const splitTextIntoFontRuns = (text = '', preferredFontId = DEFAULT_FONT_ID) => {
  if (!text) {
    return [];
  }

  const fallbackFontId = DEFAULT_FONT_ID;
  const preferredFont =
    preferredFontId === fallbackFontId
      ? getFontkitFont(fallbackFontId)
      : getFontkitFont(preferredFontId);
  const fallbackFont = getFontkitFont(fallbackFontId);

  const runs = [];
  let buffer = '';
  let currentFontId = preferredFont ? preferredFontId : fallbackFontId;

  const flushBuffer = () => {
    if (buffer) {
      runs.push({ fontId: currentFontId, text: buffer });
      buffer = '';
    }
  };

  for (const char of text) {
    const codePoint = char.codePointAt(0);
    const preferredSupports = preferredFont
      ? fontSupportsCodePoint(preferredFont, codePoint)
      : false;
    const fallbackSupports = fallbackFont ? fontSupportsCodePoint(fallbackFont, codePoint) : false;

    let targetFontId = preferredSupports ? preferredFontId : fallbackFontId;

    if (!preferredSupports && !fallbackSupports) {
      // Немає підтримки ні в основному, ні у fallback — залишаємо основний, щоб не губити символ.
      targetFontId = preferredFont ? preferredFontId : fallbackFontId;
    }

    if (targetFontId !== currentFontId) {
      flushBuffer();
      currentFontId = targetFontId;
    }

    buffer += char;
  }

  flushBuffer();

  return runs;
};

const registerDocumentFonts = doc => {
  FONT_DEFINITIONS.forEach(def => {
    try {
      const fontPath = resolveFontPath(def.id);
      if (fontPath) {
        doc.registerFont(def.id, fontPath);
      }
    } catch (error) {
      console.warn(`Не вдалося зареєструвати шрифт ${def.id}:`, error.message);
    }
  });
};

const FONT_GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'emoji',
  'math',
  'fangsong',
]);

const parseFontFamilyCandidates = value => {
  if (!value) return [];

  return String(value)
    .split(',')
    .map(candidate => normalizeFontFamily(candidate))
    .filter(Boolean);
};

const normalizeFontFamily = value => {
  if (!value) return '';
  return value.replace(/"|'/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
};

const getFontAliasMatch = family => {
  const normalizedFamily = normalizeFontFamily(family);
  if (!normalizedFamily || FONT_GENERIC_FAMILIES.has(normalizedFamily)) {
    return null;
  }

  return FONT_ALIAS_LOOKUP.get(normalizedFamily) || null;
};

const resolveFontId = (fontFamily, fontWeight = '', fontStyle = '') => {
  const familyCandidates = parseFontFamilyCandidates(fontFamily);

  const weight =
    typeof fontWeight === 'string' ? fontWeight.toLowerCase() : String(fontWeight || '');
  const weightIsBold = weight.includes('bold') || Number(weight) >= 600;
  const style = (fontStyle || '').toLowerCase();
  const isItalic = style.includes('italic') || style.includes('oblique');

  const buildVariantCandidates = family => {
    const variants = [];

    if (weightIsBold && isItalic) {
      variants.push(`${family} bold italic`);
    }
    if (weightIsBold) {
      variants.push(`${family} bold`);
    }
    if (isItalic) {
      variants.push(`${family} italic`);
    }
    variants.push(family);

    return variants;
  };

  for (const family of familyCandidates) {
    const variantCandidates = buildVariantCandidates(family);
    for (const candidate of variantCandidates) {
      const match = getFontAliasMatch(candidate);
      if (match) {
        return match;
      }
    }
  }

  return DEFAULT_FONT_ID;
};

const decodeHtmlEntities = (input = '') =>
  input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

const parseStyleStringValue = (styleAttr = '', property) => {
  if (!styleAttr) return null;
  const regex = new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i');
  const match = styleAttr.match(regex);
  return match ? match[1].trim() : null;
};

const parseCssLengthToPx = (value, relativeBasePx = 16) => {
  if (value === null || value === undefined) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const match = raw.match(/^(-?\d*\.?\d+)\s*([a-z%]*)$/i);
  if (!match) return null;

  const numeric = parseFloat(match[1]);
  if (!Number.isFinite(numeric)) return null;

  const unit = (match[2] || 'px').toLowerCase();
  switch (unit) {
    case '':
    case 'px':
      return numeric;
    case 'pt':
      return numeric;
    case 'pc':
      return numeric * 12;
    case 'in':
      return numeric * 72;
    case 'cm':
      return numeric * (72 / 2.54);
    case 'mm':
      return numeric * (72 / 25.4);
    case 'q':
      return numeric * (72 / 101.6);
    case 'em':
    case 'rem':
      return numeric * (Number.isFinite(relativeBasePx) && relativeBasePx > 0 ? relativeBasePx : 16);
    case '%':
      return (Number.isFinite(relativeBasePx) && relativeBasePx > 0 ? relativeBasePx : 16) * (numeric / 100);
    default:
      return numeric;
  }
};

const parseFontSizeFromFontShorthand = (fontValue, relativeBasePx = 16) => {
  if (!fontValue) return null;
  const raw = String(fontValue).trim();
  if (!raw) return null;

  const match = raw.match(/(-?\d*\.?\d+)\s*(px|pt|pc|in|cm|mm|q|em|rem|%)\s*(?:\/[^\s]+)?/i);
  if (!match) return null;

  return parseCssLengthToPx(`${match[1]}${match[2]}`, relativeBasePx);
};

const getNodeStyleValue = (node, property) => {
  if (!node || typeof node.getAttribute !== 'function') return null;

  const attributeValue = node.getAttribute(property);
  if (attributeValue !== null && attributeValue !== undefined && String(attributeValue).trim()) {
    return String(attributeValue).trim();
  }

  const styleAttr = node.getAttribute('style') || '';
  const styleValue = parseStyleStringValue(styleAttr, property);
  if (styleValue !== null && styleValue !== undefined && String(styleValue).trim()) {
    return String(styleValue).trim();
  }

  return null;
};

const getInheritedNodeStyleValue = (node, property) => {
  let current = node;

  while (current && current.nodeType === 1) {
    const value = getNodeStyleValue(current, property);
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }

    const tagName = String(current.nodeName || '').toLowerCase();
    if (tagName === 'svg') {
      break;
    }

    current = current.parentNode;
  }

  return null;
};

const getDescendantNodeStyleValue = (node, tagName, property) => {
  if (!node || typeof node.getElementsByTagName !== 'function') {
    return null;
  }

  const descendants = node.getElementsByTagName(tagName);
  for (let idx = 0; idx < descendants.length; idx += 1) {
    const value = getNodeStyleValue(descendants[idx], property);
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return null;
};

const resolveTextStyleValue = (textNode, property) => {
  const inheritedValue = getInheritedNodeStyleValue(textNode, property);
  if (inheritedValue) {
    return inheritedValue;
  }

  return getDescendantNodeStyleValue(textNode, 'tspan', property) || '';
};

const getDeclaredNodeFontSizePx = (node, inheritedSizePx = 16) => {
  if (!node || typeof node.getAttribute !== 'function') return null;

  const fontSizeValue = getNodeStyleValue(node, 'font-size');
  const parsedFontSize = parseCssLengthToPx(fontSizeValue, inheritedSizePx);
  if (Number.isFinite(parsedFontSize) && parsedFontSize > 0) {
    return parsedFontSize;
  }

  const fontAttrValue = node.getAttribute('font') || parseStyleStringValue(node.getAttribute('style') || '', 'font');
  const parsedFromFont = parseFontSizeFromFontShorthand(fontAttrValue, inheritedSizePx);
  if (Number.isFinite(parsedFromFont) && parsedFromFont > 0) {
    return parsedFromFont;
  }

  return null;
};

const resolveComputedFontSizePx = (node, fallbackPx = 16, depth = 0) => {
  if (!node || node.nodeType !== 1 || depth > 100) {
    return fallbackPx;
  }

  const parentSize = resolveComputedFontSizePx(node.parentNode, fallbackPx, depth + 1);
  const declaredSize = getDeclaredNodeFontSizePx(node, parentSize);
  if (Number.isFinite(declaredSize) && declaredSize > 0) {
    return declaredSize;
  }

  return parentSize;
};

const resolveTextNodeFontSize = textNode => {
  const directSize = resolveComputedFontSizePx(textNode, 16);
  if (Number.isFinite(directSize) && directSize > 0) {
    return directSize;
  }

  if (textNode && typeof textNode.getElementsByTagName === 'function') {
    const tspans = textNode.getElementsByTagName('tspan');
    for (let idx = 0; idx < tspans.length; idx += 1) {
      const tspanSize = resolveComputedFontSizePx(tspans[idx], directSize || 16);
      if (Number.isFinite(tspanSize) && tspanSize > 0) {
        return tspanSize;
      }
    }
  }

  return 16;
};

const normalizeFontSizeForSvgUnits = (fontSize, svgScale) => {
  const numericFontSize = Number(fontSize);
  if (!Number.isFinite(numericFontSize) || numericFontSize <= 0) {
    return 16;
  }

  const numericSvgScale = Number(svgScale);
  if (!Number.isFinite(numericSvgScale) || numericSvgScale <= 0) {
    return numericFontSize;
  }

  // When svgScale ≈ 1, exported SVG geometry is typically already in pt units,
  // while text font-size values still come in CSS px. Convert px -> pt.
  if (Math.abs(numericSvgScale - 1) <= 0.08) {
    return numericFontSize * FONT_SIZE_PX_TO_PT_NEAR_UNIT_SCALE;
  }

  // When svgScale ≈ 0.75, geometry is in CSS px and svgScale already converts px -> pt.
  return numericFontSize;
};

const computeBaselineOffset = scaledFontSize => {
  const safeFontSize = Number.isFinite(scaledFontSize) && scaledFontSize > 0 ? scaledFontSize : 16;
  return safeFontSize * FABRIC_TEXT_BASELINE_OFFSET_EM;
};

const parseNumericListValue = (value, fallback = 0) => {
  if (typeof value !== 'string') return fallback;
  const tokens = value
    .split(/[,\s]+/)
    .map(part => part.trim())
    .filter(Boolean);
  for (const token of tokens) {
    const numeric = parseFloat(token);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return fallback;
};

const resolveTextNodePosition = textNode => {
  if (!textNode || typeof textNode.getAttribute !== 'function') {
    return { baseX: 0, baseY: 0, source: 'default' };
  }

  const textXAttr = textNode.getAttribute('x');
  const textYAttr = textNode.getAttribute('y');
  const hasTextPosition =
    (typeof textXAttr === 'string' && textXAttr.trim() !== '') ||
    (typeof textYAttr === 'string' && textYAttr.trim() !== '');

  if (hasTextPosition) {
    return {
      baseX: parseNumericListValue(textXAttr, 0),
      baseY: parseNumericListValue(textYAttr, 0),
      source: 'text',
    };
  }

  if (typeof textNode.getElementsByTagName === 'function') {
    const tspans = textNode.getElementsByTagName('tspan');
    for (let idx = 0; idx < tspans.length; idx += 1) {
      const tspan = tspans[idx];
      const tspanXAttr = tspan.getAttribute('x');
      const tspanYAttr = tspan.getAttribute('y');
      const hasTspanPosition =
        (typeof tspanXAttr === 'string' && tspanXAttr.trim() !== '') ||
        (typeof tspanYAttr === 'string' && tspanYAttr.trim() !== '');

      if (hasTspanPosition) {
        return {
          baseX: parseNumericListValue(tspanXAttr, 0),
          baseY: parseNumericListValue(tspanYAttr, 0),
          source: 'tspan',
        };
      }
    }
  }

  return { baseX: 0, baseY: 0, source: 'default' };
};

const extractSvgContentDimensions = (svgElement, fallbackWidth, fallbackHeight) => {
  let width = Number(fallbackWidth) || 0;
  let height = Number(fallbackHeight) || 0;

  if (svgElement && typeof svgElement.getAttribute === 'function') {
    const viewBoxAttr = svgElement.getAttribute('viewBox');
    if (viewBoxAttr) {
      const parts = viewBoxAttr
        .split(/[,\s]+/)
        .map(part => parseFloat(part))
        .filter(Number.isFinite);
      if (parts.length >= 4) {
        width = parts[2];
        height = parts[3];
      }
    }

    if (!width) {
      width = parseNumericListValue(svgElement.getAttribute('width'), width);
    }
    if (!height) {
      height = parseNumericListValue(svgElement.getAttribute('height'), height);
    }
  }

  if (!width) width = 1;
  if (!height) height = 1;

  return { width, height };
};

const isPlacementRotated = placement => {
  const raw = placement?.rotated;
  return raw === true || raw === 1 || raw === '1' || raw === 'true';
};

const hasRotatedWrapperNode = root => {
  if (!root || root.nodeType !== 1) return false;

  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    if (!current || current.nodeType !== 1) continue;

    if (typeof current.getAttribute === 'function') {
      const marker = current.getAttribute('data-layout-rotated');
      if (marker === 'true') {
        return true;
      }
    }

    const children = Array.from(current.childNodes || []);
    for (const child of children) {
      if (child && child.nodeType === 1) {
        stack.push(child);
      }
    }
  }

  return false;
};

const applyPlacementRotationToSvgElement = (svgElement, placement) => {
  if (!svgElement || !isPlacementRotated(placement)) {
    return;
  }

  if (hasRotatedWrapperNode(svgElement)) {
    return;
  }

  const { width, height } = extractSvgContentDimensions(
    svgElement,
    placement?.sourceWidth || placement?.width,
    placement?.sourceHeight || placement?.height
  );

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return;
  }

  const ownerDocument = svgElement.ownerDocument;
  if (!ownerDocument || typeof ownerDocument.createElementNS !== 'function') {
    return;
  }

  const ns = svgElement.namespaceURI || 'http://www.w3.org/2000/svg';
  const wrapper = ownerDocument.createElementNS(ns, 'g');
  wrapper.setAttribute('data-layout-rotated', 'true');
  wrapper.setAttribute('transform', `translate(${height},0) rotate(90)`);

  const nodesToWrap = Array.from(svgElement.childNodes || []).filter(node => {
    if (!node) return false;
    if (node.nodeType !== 1) return true;
    const tag = (node.nodeName || '').toLowerCase();
    return tag !== 'defs';
  });

  nodesToWrap.forEach(node => {
    wrapper.appendChild(node);
  });

  svgElement.appendChild(wrapper);
  svgElement.setAttribute('viewBox', `0 0 ${height} ${width}`);

  const attrWidth = parseFloat(svgElement.getAttribute('width') || '');
  const attrHeight = parseFloat(svgElement.getAttribute('height') || '');
  if (Number.isFinite(attrWidth) && Number.isFinite(attrHeight)) {
    svgElement.setAttribute('width', String(attrHeight));
    svgElement.setAttribute('height', String(attrWidth));
  }
};

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];

const multiplyMatrices = (m1 = IDENTITY_MATRIX, m2 = IDENTITY_MATRIX) => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];

const degreesToRadians = degrees => (Number(degrees) || 0) * (Math.PI / 180);

const parseTransformOperation = operation => {
  if (!operation) return IDENTITY_MATRIX;
  const match = operation.match(/([a-z]+)\(([^)]+)\)/i);
  if (!match) return IDENTITY_MATRIX;

  const [, typeRaw, paramsRaw] = match;
  const type = typeRaw.toLowerCase();
  const params = paramsRaw
    .split(/[,\s]+/)
    .map(value => parseFloat(value))
    .filter(Number.isFinite);

  switch (type) {
    case 'matrix': {
      if (params.length >= 6) {
        return [params[0], params[1], params[2], params[3], params[4], params[5]];
      }
      break;
    }
    case 'translate': {
      const tx = params[0] ?? 0;
      const ty = params[1] ?? 0;
      return [1, 0, 0, 1, tx, ty];
    }
    case 'scale': {
      const sx = params[0] ?? 1;
      const sy = params.length >= 2 ? params[1] : sx;
      return [sx, 0, 0, sy, 0, 0];
    }
    case 'rotate': {
      const angle = degreesToRadians(params[0] ?? 0);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      if (params.length >= 3) {
        const cx = params[1];
        const cy = params[2];
        const translateToOrigin = [1, 0, 0, 1, -cx, -cy];
        const rotation = [cos, sin, -sin, cos, 0, 0];
        const translateBack = [1, 0, 0, 1, cx, cy];
        return multiplyMatrices(translateBack, multiplyMatrices(rotation, translateToOrigin));
      }
      return [cos, sin, -sin, cos, 0, 0];
    }
    case 'skewx': {
      const angle = degreesToRadians(params[0] ?? 0);
      return [1, 0, Math.tan(angle), 1, 0, 0];
    }
    case 'skewy': {
      const angle = degreesToRadians(params[0] ?? 0);
      return [1, Math.tan(angle), 0, 1, 0, 0];
    }
    default:
      break;
  }

  return IDENTITY_MATRIX;
};

const parseTransformToMatrix = (transformString = '') => {
  if (!transformString) return IDENTITY_MATRIX;
  const operations = transformString.match(/[a-z]+\([^)]*\)/gi);
  if (!operations || operations.length === 0) return IDENTITY_MATRIX;

  return operations.reduce((acc, operation) => {
    const opMatrix = parseTransformOperation(operation);
    return multiplyMatrices(acc, opMatrix);
  }, IDENTITY_MATRIX);
};

const computeCumulativeMatrix = node => {
  let matrix = IDENTITY_MATRIX;
  let current = node;

  while (current && current.nodeType === 1) {
    if (typeof current.getAttribute === 'function') {
      const transform = current.getAttribute('transform');
      if (transform) {
        const transformMatrix = parseTransformToMatrix(transform);
        matrix = multiplyMatrices(transformMatrix, matrix);
      }
    }
    current = current.parentNode;
  }

  return matrix;
};

const applyMatrixToPoint = (matrix = IDENTITY_MATRIX, x = 0, y = 0) => ({
  x: matrix[0] * x + matrix[2] * y + matrix[4],
  y: matrix[1] * x + matrix[3] * y + matrix[5],
});

const extractScaleFromMatrix = (matrix = IDENTITY_MATRIX) => {
  const scaleX = Math.hypot(matrix[0], matrix[1]) || 1;
  const scaleY = Math.hypot(matrix[2], matrix[3]) || 1;
  return { scaleX, scaleY };
};

const extractRotationDegreesFromMatrix = (matrix = IDENTITY_MATRIX) => {
  const angleRad = Math.atan2(matrix[1] || 0, matrix[0] || 1);
  if (!Number.isFinite(angleRad)) return 0;
  return (angleRad * 180) / Math.PI;
};

// Heuristic detection of JsBarcode-like groups: a <g> containing many <rect>
// with same height and narrow varying widths. Keeps it conservative to avoid
// touching arbitrary artwork.
const normalizeColorString = (value = '') => String(value).trim().toLowerCase().replace(/\s+/g, '');

const isWhiteColorString = (value = '') => {
  const normalized = normalizeColorString(value);
  if (!normalized) return false;
  return (
    normalized === '#fff' ||
    normalized === '#ffffff' ||
    normalized === 'white' ||
    normalized === 'rgb(255,255,255)' ||
    normalized === 'rgba(255,255,255,1)'
  );
};

const rectHasWhiteFill = rect => {
  if (!rect || typeof rect.getAttribute !== 'function') return false;
  const fillAttr = rect.getAttribute('fill');
  if (fillAttr && isWhiteColorString(fillAttr)) {
    return true;
  }
  const styleAttr = rect.getAttribute('style') || '';
  const match = styleAttr.match(/fill\s*:\s*([^;]+)/i);
  if (match && isWhiteColorString(match[1])) {
    return true;
  }
  return false;
};

const BARCODE_EXPORT_ATTR = 'data-layout-barcode';
const BARCODE_BAR_ATTR = 'data-layout-barcode-bar';

const collectMarkedBarcodeRects = (root, { suppressLogs = false } = {}) => {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const rects = Array.from(root.querySelectorAll(`rect[${BARCODE_BAR_ATTR}="true"]`));
  if (!suppressLogs && rects.length) {
    console.log(`[layoutExportServer] Using marked barcode rects: ${rects.length}`);
  }
  return rects;
};

const stripMarkedBarcodeRectsFromRoot = (root, { suppressLogs = false } = {}) => {
  const rects = collectMarkedBarcodeRects(root, { suppressLogs });
  rects.forEach(rect => {
    try {
      rect.parentNode?.removeChild(rect);
    } catch {}
  });
  return rects.length;
};

const filterBarcodeBarRects = rects => {
  if (!Array.isArray(rects) || rects.length === 0) return [];

  const widths = rects
    .map(rect => parseFloat(rect.getAttribute('width') || '0'))
    .filter(value => Number.isFinite(value) && value > 0);
  const minWidth = widths.length ? Math.min(...widths) : null;
  const widthThreshold = Number.isFinite(minWidth) ? minWidth * 4 : Infinity;

  return rects.filter(rect => {
    if (rectHasWhiteFill(rect)) {
      return false;
    }
    const width = parseFloat(rect.getAttribute('width') || '0');
    if (!Number.isFinite(width) || width <= 0) return false;
    if (widthThreshold !== Infinity && width > widthThreshold) {
      return false;
    }
    return true;
  });
};

const stripBarcodeRectsFromNode = node => {
  const rects = gatherBarcodeRects(node);
  const bars = filterBarcodeBarRects(rects);
  bars.forEach(rect => {
    try {
      rect.parentNode?.removeChild(rect);
    } catch {}
  });
  return bars.length;
};

const isLikelyBarcodeGroup = node => {
  if (!node || node.nodeType !== 1) return false;
  const tag = (node.nodeName || '').toLowerCase();
  if (tag !== 'g' && tag !== 'svg') return false;
  const rects = gatherBarcodeRects(node);
  if (rects.length < 12) return false;
  const heights = [];
  const widths = [];
  for (const r of rects) {
    const w = parseFloat(r.getAttribute('width'));
    const h = parseFloat(r.getAttribute('height'));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return false;
    widths.push(w);
    heights.push(h);
  }
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  if (maxH === 0) return false;
  // Heights should be almost equal
  if ((maxH - minH) / maxH > 0.05) return false;
  const avgW = widths.reduce((a, b) => a + b, 0) / widths.length;
  // Bars are vertically tall vs width
  if (maxH / avgW < 2) return false;
  return true;
};

const collectBarcodeGroups = (root, { suppressLogs = false } = {}) => {
  const results = [];

  // Prefer explicit markers from the client export markup.
  if (root && typeof root.querySelectorAll === 'function') {
    const marked = Array.from(root.querySelectorAll(`[${BARCODE_EXPORT_ATTR}="true"]`));
    if (marked.length) {
      if (!suppressLogs) {
        console.log(`[layoutExportServer] Using marked barcode containers: ${marked.length}`);
      }
      return marked;
    }
  }

  const walk = n => {
    if (!n || n.nodeType !== 1) return;
    if (isLikelyBarcodeGroup(n)) {
      if (!suppressLogs) {
        console.log(
          `[layoutExportServer] Found barcode group:`,
          n.nodeName,
          'rects:',
          Array.from(n.childNodes || []).filter(
            c => c?.nodeType === 1 && (c.nodeName || '').toLowerCase() === 'rect'
          ).length
        );
      }
      results.push(n);
    }
    const children = Array.from(n.childNodes || []);
    children.forEach(walk);
  };
  walk(root);
  if (!suppressLogs) {
    console.log(`[layoutExportServer] Total barcodes collected: ${results.length}`);
  }
  return results;
};

const rectToTransformedQuad = (matrix, x, y, w, h) => {
  const p1 = applyMatrixToPoint(matrix, x, y);
  const p2 = applyMatrixToPoint(matrix, x + w, y);
  const p3 = applyMatrixToPoint(matrix, x + w, y + h);
  const p4 = applyMatrixToPoint(matrix, x, y + h);
  return [p1, p2, p3, p4];
};

/**
 * Draws the standard blue border outline on the PDF.
 * This is always present on every placement.
 */
const drawStandardBorderOutline = (doc, { xPt, yTopPt, widthPt, heightPt }) => {
  if (!doc) {
    return;
  }

  doc.save();
  doc.strokeColor(OUTLINE_STROKE_COLOR);
  doc.lineWidth(CUSTOM_BORDER_STROKE_WIDTH_PT);
  doc.lineJoin('round');
  doc.lineCap('round');
  doc.strokeOpacity(1);
  doc.fillOpacity(0);

  // Draw a simple rectangle outline (stroke only, no fill)
  doc.rect(xPt, yTopPt, widthPt, heightPt).stroke();

  doc.restore();
};

/**
 * Draws a custom border outline (teal, stroke only) on the PDF
 * when the user has enabled the border feature.
 * Uses the placement's bounding box to draw a simple rectangle outline.
 */
const drawCustomBorderOutline = (doc, { xPt, yTopPt, widthPt, heightPt, customBorder }) => {
  if (!doc || !customBorder) {
    return;
  }

  // Only draw if the custom border mode is "custom"
  if (customBorder.mode !== 'custom') {
    return;
  }

  doc.save();
  doc.strokeColor(CUSTOM_BORDER_STROKE_COLOR);
  doc.lineWidth(CUSTOM_BORDER_STROKE_WIDTH_PT);
  doc.lineJoin('round');
  doc.lineCap('round');
  doc.strokeOpacity(1);
  doc.fillOpacity(0);

  // Draw a simple rectangle outline (stroke only, no fill)
  // doc.rect(xPt, yTopPt, widthPt, heightPt).stroke();

  doc.restore();
};

const gatherBarcodeRects = node => {
  if (!node) return [];
  if (typeof node.getElementsByTagName === 'function') {
    return Array.from(node.getElementsByTagName('rect'));
  }
  const rects = [];
  const stack = Array.from(node.childNodes || []);
  while (stack.length) {
    const current = stack.pop();
    if (!current || current.nodeType !== 1) continue;
    if ((current.nodeName || '').toLowerCase() === 'rect') {
      rects.push(current);
    }
    if (current.childNodes && current.childNodes.length) {
      stack.push(...current.childNodes);
    }
  }
  return rects;
};

const drawBarcodePaths = (
  doc,
  barcodeGroups,
  { xPt, yTopPt, widthPt, heightPt, contentWidth, contentHeight }
) => {
  if (!doc || !Array.isArray(barcodeGroups) || barcodeGroups.length === 0) {
    return;
  }

  const safeContentWidth = Number(contentWidth) || 1;
  const safeContentHeight = Number(contentHeight) || 1;
  const svgScaleX = widthPt / safeContentWidth;
  const svgScaleY = heightPt / safeContentHeight;
  const outlineScale = Math.max(Math.min(svgScaleX, svgScaleY), 0.0001);

  doc.save();
  doc.strokeColor(TEXT_OUTLINE_COLOR);
  doc.lineJoin('round');
  doc.lineCap('round');
  doc.strokeOpacity(1);
  doc.fillOpacity(0);

  barcodeGroups.forEach(group => {
    const rects = gatherBarcodeRects(group);
    if (!rects.length) return;

    const barRects = filterBarcodeBarRects(rects);

    if (!barRects.length) return;

    barRects.forEach(rect => {
      const x = parseFloat(rect.getAttribute('x') || '0');
      const y = parseFloat(rect.getAttribute('y') || '0');
      const w = parseFloat(rect.getAttribute('width') || '0');
      const h = parseFloat(rect.getAttribute('height') || '0');
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        return;
      }

      const matrix = computeCumulativeMatrix(rect);
      const quad = rectToTransformedQuad(matrix, x, y, w, h).map(point => ({
        x: xPt + point.x * svgScaleX,
        y: yTopPt + point.y * svgScaleY,
      }));

      const edgeLength01 = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
      const edgeLength12 = Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y);
      const barWidthPt = Math.min(edgeLength01, edgeLength12);
      // Mirror client-side outline heuristics so PDF export matches preview.
      const barWidthPx = barWidthPt / outlineScale;
      const defaultOutlinePx = 1;
      const minOutlinePx = 0.3;
      const maxByRectWidthPx =
        Number.isFinite(barWidthPx) && barWidthPx > 0 ? barWidthPx * 0.5 : null;

      let outlineWidthPx = defaultOutlinePx;
      if (Number.isFinite(maxByRectWidthPx) && maxByRectWidthPx > 0) {
        outlineWidthPx = Math.min(outlineWidthPx, maxByRectWidthPx);
      }
      outlineWidthPx = Math.max(outlineWidthPx, minOutlinePx);
      if (Number.isFinite(maxByRectWidthPx) && maxByRectWidthPx > 0) {
        outlineWidthPx = Math.min(outlineWidthPx, maxByRectWidthPx);
      }

      const outlineWidthPt = Math.max(outlineWidthPx * outlineScale, minOutlinePx * outlineScale);

      doc.lineWidth(outlineWidthPt);
      doc.moveTo(quad[0].x, quad[0].y);
      doc.lineTo(quad[1].x, quad[1].y);
      doc.lineTo(quad[2].x, quad[2].y);
      doc.lineTo(quad[3].x, quad[3].y);
      doc.closePath();
      doc.stroke();
    });
  });

  doc.restore();
};

const drawBarcodeRectsDirect = (
  doc,
  rects,
  { xPt, yTopPt, widthPt, heightPt, contentWidth, contentHeight }
) => {
  if (!doc || !Array.isArray(rects) || rects.length === 0) return;

  const safeContentWidth = Number(contentWidth) || 1;
  const safeContentHeight = Number(contentHeight) || 1;
  const svgScaleX = widthPt / safeContentWidth;
  const svgScaleY = heightPt / safeContentHeight;
  const outlineScale = Math.max(Math.min(svgScaleX, svgScaleY), 0.0001);

  doc.save();
  doc.strokeColor(TEXT_OUTLINE_COLOR);
  doc.lineJoin('round');
  doc.lineCap('round');
  doc.strokeOpacity(1);
  doc.fillOpacity(0);

  rects.forEach(rect => {
    const x = parseFloat(rect.getAttribute('x') || '0');
    const y = parseFloat(rect.getAttribute('y') || '0');
    const w = parseFloat(rect.getAttribute('width') || '0');
    const h = parseFloat(rect.getAttribute('height') || '0');
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      return;
    }

    const matrix = computeCumulativeMatrix(rect);
    const quad = rectToTransformedQuad(matrix, x, y, w, h).map(point => ({
      x: xPt + point.x * svgScaleX,
      y: yTopPt + point.y * svgScaleY,
    }));

    const edgeLength01 = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
    const edgeLength12 = Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y);
    const barWidthPt = Math.min(edgeLength01, edgeLength12);

    const barWidthPx = barWidthPt / outlineScale;
    const defaultOutlinePx = 1;
    const minOutlinePx = 0.3;
    const maxByRectWidthPx =
      Number.isFinite(barWidthPx) && barWidthPx > 0 ? barWidthPx * 0.5 : null;

    let outlineWidthPx = defaultOutlinePx;
    if (Number.isFinite(maxByRectWidthPx) && maxByRectWidthPx > 0) {
      outlineWidthPx = Math.min(outlineWidthPx, maxByRectWidthPx);
    }
    outlineWidthPx = Math.max(outlineWidthPx, minOutlinePx);
    if (Number.isFinite(maxByRectWidthPx) && maxByRectWidthPx > 0) {
      outlineWidthPx = Math.min(outlineWidthPx, maxByRectWidthPx);
    }

    const outlineWidthPt = Math.max(outlineWidthPx * outlineScale, minOutlinePx * outlineScale);

    doc.lineWidth(outlineWidthPt);
    doc.moveTo(quad[0].x, quad[0].y);
    doc.lineTo(quad[1].x, quad[1].y);
    doc.lineTo(quad[2].x, quad[2].y);
    doc.lineTo(quad[3].x, quad[3].y);
    doc.closePath();
    doc.stroke();
  });

  doc.restore();
};

const parseSvgLength = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  const raw = String(value).trim();
  if (!raw) return fallback;
  const numeric = parseFloat(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const buildRoundedRectPathData = ({ x, y, width, height, rx = 0, ry = 0 }) => {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  if (safeWidth <= 0 || safeHeight <= 0) return null;

  let radiusX = Math.max(0, Number(rx) || 0);
  let radiusY = Math.max(0, Number(ry) || 0);

  if (!radiusX && radiusY) radiusX = radiusY;
  if (!radiusY && radiusX) radiusY = radiusX;

  radiusX = Math.min(radiusX, safeWidth / 2);
  radiusY = Math.min(radiusY, safeHeight / 2);

  const left = x;
  const top = y;
  const right = x + safeWidth;
  const bottom = y + safeHeight;

  if (radiusX <= 0 || radiusY <= 0) {
    return `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`;
  }

  return [
    `M ${left + radiusX} ${top}`,
    `H ${right - radiusX}`,
    `A ${radiusX} ${radiusY} 0 0 1 ${right} ${top + radiusY}`,
    `V ${bottom - radiusY}`,
    `A ${radiusX} ${radiusY} 0 0 1 ${right - radiusX} ${bottom}`,
    `H ${left + radiusX}`,
    `A ${radiusX} ${radiusY} 0 0 1 ${left} ${bottom - radiusY}`,
    `V ${top + radiusY}`,
    `A ${radiusX} ${radiusY} 0 0 1 ${left + radiusX} ${top}`,
    'Z',
  ].join(' ');
};

const buildNodePathData = node => {
  if (!node || typeof node.getAttribute !== 'function') return null;
  const tag = (node.nodeName || '').toLowerCase();

  if (tag === 'path') {
    const d = node.getAttribute('d');
    return d && d.trim() ? d.trim() : null;
  }

  if (tag === 'rect') {
    const x = parseSvgLength(node.getAttribute('x'), 0);
    const y = parseSvgLength(node.getAttribute('y'), 0);
    const width = parseSvgLength(node.getAttribute('width'), 0);
    const height = parseSvgLength(node.getAttribute('height'), 0);
    const rx = parseSvgLength(node.getAttribute('rx'), 0);
    const ry = parseSvgLength(node.getAttribute('ry'), 0);
    return buildRoundedRectPathData({ x, y, width, height, rx, ry });
  }

  if (tag === 'circle') {
    const cx = parseSvgLength(node.getAttribute('cx'), 0);
    const cy = parseSvgLength(node.getAttribute('cy'), 0);
    const r = parseSvgLength(node.getAttribute('r'), 0);
    if (!Number.isFinite(r) || r <= 0) return null;
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  }

  if (tag === 'ellipse') {
    const cx = parseSvgLength(node.getAttribute('cx'), 0);
    const cy = parseSvgLength(node.getAttribute('cy'), 0);
    const rx = parseSvgLength(node.getAttribute('rx'), 0);
    const ry = parseSvgLength(node.getAttribute('ry'), 0);
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 0 || ry <= 0) return null;
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
  }

  if (tag === 'polygon' || tag === 'polyline') {
    const pointsRaw = node.getAttribute('points') || '';
    const numericValues = pointsRaw
      .trim()
      .replace(/,/g, ' ')
      .split(/\s+/)
      .map(value => parseFloat(value))
      .filter(Number.isFinite);

    const points = [];
    for (let i = 0; i + 1 < numericValues.length; i += 2) {
      points.push([numericValues[i], numericValues[i + 1]]);
    }

    if (points.length < 2) return null;

    const [firstX, firstY] = points[0];
    const commands = [`M ${firstX} ${firstY}`];
    for (let i = 1; i < points.length; i += 1) {
      commands.push(`L ${points[i][0]} ${points[i][1]}`);
    }
    if (tag === 'polygon') {
      commands.push('Z');
    }
    return commands.join(' ');
  }

  return null;
};

const invertAffineMatrix = matrix => {
  if (!Array.isArray(matrix) || matrix.length < 6) return null;
  const [a, b, c, d, e, f] = matrix;
  const det = a * d - b * c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-10) return null;

  const invA = d / det;
  const invB = -b / det;
  const invC = -c / det;
  const invD = a / det;
  const invE = (c * f - d * e) / det;
  const invF = (b * e - a * f) / det;
  return [invA, invB, invC, invD, invE, invF];
};

const resolvePlacementClipBoundaryNode = svgRoot => {
  if (!svgRoot || typeof svgRoot.querySelector !== 'function') return null;

  const selectors = [
    '[id="canvaShapeCustom"]',
    '[id="canvaShape"]',
    '[data-canvas-outline="true"]',
    '[data-export-border="custom"]',
    '[data-export-border-blue="true"]',
  ];

  for (const selector of selectors) {
    try {
      const node = svgRoot.querySelector(selector);
      if (node) return node;
    } catch {}
  }

  return null;
};

const applyPlacementBoundaryClip = (
  doc,
  svgRoot,
  { xPt, yTopPt, widthPt, heightPt, contentWidth, contentHeight }
) => {
  if (!doc || !svgRoot) return false;
  if (!Number.isFinite(contentWidth) || !Number.isFinite(contentHeight)) return false;
  if (contentWidth <= 0 || contentHeight <= 0) return false;

  const clipNode = resolvePlacementClipBoundaryNode(svgRoot);

  let clipPathData = null;
  if (clipNode) {
    clipPathData = buildNodePathData(clipNode);
  }

  // Fallback: якщо не вдалося побудувати path з контуру,
  // хоча б обмежуємо в межах placement rectangle.
  if (!clipPathData) {
    clipPathData = `M 0 0 H ${contentWidth} V ${contentHeight} H 0 Z`;
  }

  if (!clipPathData) return false;

  const safeContentWidth = Number(contentWidth) || 1;
  const safeContentHeight = Number(contentHeight) || 1;
  const svgScaleX = widthPt / safeContentWidth;
  const svgScaleY = heightPt / safeContentHeight;

  // Use independent axis scaling so placement clipping matches 1:1 canvas geometry.
  const placementMatrix = [svgScaleX, 0, 0, svgScaleY, xPt, yTopPt];
  const clipNodeMatrix = computeCumulativeMatrix(clipNode);
  const finalMatrix = multiplyMatrices(placementMatrix, clipNodeMatrix);
  const inverseMatrix = invertAffineMatrix(finalMatrix);
  if (!inverseMatrix) return false;

  try {
    doc.save();
    doc.transform(
      finalMatrix[0],
      finalMatrix[1],
      finalMatrix[2],
      finalMatrix[3],
      finalMatrix[4],
      finalMatrix[5]
    );
    doc.path(clipPathData);
    doc.clip();
    doc.transform(
      inverseMatrix[0],
      inverseMatrix[1],
      inverseMatrix[2],
      inverseMatrix[3],
      inverseMatrix[4],
      inverseMatrix[5]
    );
    return true;
  } catch (error) {
    try {
      doc.restore();
    } catch {}
    console.warn('Не вдалося застосувати кліп бордера:', error?.message || error);
    return false;
  }
};

const app = express();

app.use(cors());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Дозволити всім
  res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use('/images', express.static(path.join(__dirname, 'static')));

app.use(express.json({ limit: REQUEST_BODY_LIMIT }));

// Optional: receive client diagnostics and print them in server terminal.
// Enable with: ENABLE_CLIENT_DIAG_LOGS=1
app.post('/api/client-log', (req, res) => {
  try {
    if (String(process.env.ENABLE_CLIENT_DIAG_LOGS || '') !== '1') {
      return res.status(404).json({ error: 'Not found' });
    }

    const payload = req.body;
    const entries = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.entries)
        ? payload.entries
        : [payload];

    entries
      .filter(Boolean)
      .slice(0, 200)
      .forEach(entry => {
        try {
          console.error('[CLIENT_DIAG]', entry);
        } catch {}
      });

    return res.json({ ok: true, count: entries.length });
  } catch (e) {
    try {
      console.error('[CLIENT_DIAG] handler error', e);
    } catch {}
    return res.status(500).json({ ok: false });
  }
});

app.use('/api', router);

// API error handler (must be after routes)
app.use(errorMiddleware);

const mmToPoints = (valueMm = 0) => (Number(valueMm) || 0) * MM_TO_PT;

const escapeForSvg = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const buildFallbackSvgMarkup = (placement, message) => {
  const width = Math.max(Number(placement?.width) || 0, 0);
  const height = Math.max(Number(placement?.height) || 0, 0);
  const label = escapeForSvg(message || 'SVG недоступний');

  if (width <= 0 || height <= 0) {
    return null;
  }

  const inset = Math.min(width, height) > 2 ? 0.6 : 0.2;
  const fontSize = Math.min(Math.max(height * 0.18, 2), 6);
  const textY = height - Math.max(fontSize * 0.4, 1.5);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect x="${inset}" y="${inset}" width="${Math.max(width - inset * 2, 0)}" height="${Math.max(
    height - inset * 2,
    0
  )}" fill="none" stroke="${OUTLINE_STROKE_COLOR}" stroke-width="${Math.min(
    inset * 2,
    1
  )}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
  <text x="${
    inset * 2
  }" y="${textY}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#404040">${label}</text>
</svg>`;
};

app.post('/api/layout-pdf', async (req, res) => {
  try {
    const { sheets, sheetLabel = 'sheet', timestamp, exportMode, svgAssets } = req.body || {};
    const svgAssetMap = svgAssets && typeof svgAssets === 'object' ? svgAssets : {};

    if (!Array.isArray(sheets) || sheets.length === 0) {
      return res.status(400).json({ error: 'Очікуємо принаймні один аркуш для експорту.' });
    }

    if (Number.isFinite(MAX_EXPORT_SHEETS) && MAX_EXPORT_SHEETS > 0 && sheets.length > MAX_EXPORT_SHEETS) {
      return res.status(400).json({
        error: `Максимальна кількість аркушів для PDF — ${MAX_EXPORT_SHEETS}.`,
      });
    }

    const safeSheetLabel = String(sheetLabel || 'sheet').replace(/[^a-z0-9-_]+/gi, '-');
    const fileNameParts = [safeSheetLabel || 'sheet'];
    if (timestamp) {
      fileNameParts.push(String(timestamp).replace(/[^0-9-]+/g, ''));
    }
    const fileName = `${fileNameParts.join('-') || 'layout'}.pdf`;

    const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
    registerDocumentFonts(doc);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    doc.pipe(res);

    const expandedSheets = [];
    sheets.forEach(sheet => {
      if (sheet?.skipMaterialSplit === true) {
        expandedSheets.push(sheet);
      } else {
        expandedSheets.push(...splitSheetByMaterial(sheet));
      }
    });

    const parser = new DOMParser();
    const parsedSvgByAssetKey = new Map();

    expandedSheets.forEach((sheet, sheetIndex) => {
      const pageWidthPt = mmToPoints(sheet?.width);
      const pageHeightPt = mmToPoints(sheet?.height);

      if (
        !Number.isFinite(pageWidthPt) ||
        !Number.isFinite(pageHeightPt) ||
        pageWidthPt <= 0 ||
        pageHeightPt <= 0
      ) {
        console.warn(`Пропускаємо аркуш ${sheetIndex} через некоректні розміри.`);
        return;
      }

      doc.addPage({ size: [pageWidthPt, pageHeightPt], margin: 0 });

      const shouldRenderMjFrame =
        sheet?.disableMjStrip !== true &&
        (exportMode === 'Sheet optimized (MJ) Fr.' ||
          sheet?.exportMode === 'Sheet optimized (MJ) Fr.' ||
          (Number(sheet?.leftStripWidthMm) || 0) > 0);

      if (shouldRenderMjFrame) {
        const stripWidthMm = Math.max(0, Number(sheet?.leftStripWidthMm) || 9.5);
        const holeDiameterMm = 5.5;
        const holeSpacingMm = 80;
        const secondHoleMinHeightMm = 135;

        doc.save();
        // Strip background is the page itself (white).
        // Do not draw a separate strip edge line here: the frame outline is drawn later.

        const pageHeightMm = Math.max(0, Number(sheet?.height) || 0);
        const holeCentersYmm =
          pageHeightMm >= secondHoleMinHeightMm
            ? [pageHeightMm / 2 - holeSpacingMm / 2, pageHeightMm / 2 + holeSpacingMm / 2]
            : [pageHeightMm / 2];

        const centerXpt = mmToPoints(stripWidthMm / 2);
        const radiusPt = mmToPoints(holeDiameterMm / 2);

        holeCentersYmm.forEach((cyMm) => {
          const cyPt = mmToPoints(cyMm);
          doc
            .circle(centerXpt, cyPt, radiusPt)
            .lineWidth(0.75)
            .fillAndStroke('#FFFFFF', '#FF0000');
        });

        doc.restore();
      }

      // Optional: left-side sheet info label (rotated), if provided by client.
      const sheetInfo = sheet?.sheetInfo || null;
      if (sheetInfo && (sheetInfo.projectId || sheetInfo.sheetIndex)) {
        const leftStripWidthMm = Math.max(0, Number(sheet?.leftStripWidthMm) || 0);
        const leftInsetMm = Math.max(0, Number(sheet?.leftInset) || 0);
        const fallbackAreaWidthMm = leftStripWidthMm > 0 ? leftStripWidthMm : leftInsetMm;
        const firstCanvasStartMm = (Array.isArray(sheet?.placements) ? sheet.placements : []).reduce((minX, placement) => {
          const x = Number(placement?.x);
          if (!Number.isFinite(x) || x < 0) return minX;
          return Math.min(minX, x);
        }, Number.POSITIVE_INFINITY);
        const hasCanvasStart = Number.isFinite(firstCanvasStartMm) && firstCanvasStartMm > 0;
        const areaWidthMm = Math.max(
          0,
          hasCanvasStart
            ? firstCanvasStartMm
            : Number(sheetInfo?.areaWidthMm) || fallbackAreaWidthMm
        );

        if (areaWidthMm > 0) {
          const pageHeightMm = Math.max(0, Number(sheet?.height) || 0);
          const fallbackXCenterMm = leftStripWidthMm > 0 ? leftStripWidthMm / 2 : areaWidthMm / 2;
          const requestedXCenterMm = Number.isFinite(Number(sheetInfo?.xCenterMm))
            ? Number(sheetInfo.xCenterMm)
            : fallbackXCenterMm;
          const resolvedExportMode = sheet?.exportMode || exportMode;
          const shiftSheetInfoLeft = PDF_SHEET_INFO_LEFT_SHIFT_MODES.has(resolvedExportMode);
          const xCenterBaseMm = hasCanvasStart
            ? areaWidthMm / 2
            : Math.max(0, Math.min(areaWidthMm, requestedXCenterMm));
          const xCenterMm = Math.max(
            0,
            Math.min(areaWidthMm, xCenterBaseMm - (shiftSheetInfoLeft ? PDF_SHEET_INFO_LEFT_SHIFT_MM : 0))
          );
          const yCenterMm = Number.isFinite(Number(sheetInfo?.yCenterMm)) ? Number(sheetInfo.yCenterMm) : pageHeightMm / 2;
          const anchorXpt = mmToPoints(xCenterMm);
          const anchorYpt = mmToPoints(yCenterMm);

          // Font size in pt: slightly smaller to avoid hugging the canvas edge.
          const fontSize = Math.max(5.8, Math.min(9, mmToPoints(areaWidthMm * 0.58)));

          // Special handling for Sheet optimized (MJ) Fr. mode with a circle
          const isMjOptimized = (sheet?.exportMode || exportMode) === 'Sheet optimized (MJ) Fr.';
          const customLabel = sheetInfo.customLabel || null;

          doc.save();
          doc.strokeColor(TEXT_OUTLINE_COLOR);
          doc.strokeOpacity(1);
          doc.lineJoin('round');
          doc.lineCap('round');
          doc.lineWidth(Math.max(TEXT_STROKE_WIDTH_PT, 0.2));
          doc.font(DEFAULT_FONT_ID);
          doc.fontSize(fontSize);
          doc.translate(anchorXpt, anchorYpt);
          doc.rotate(-90);

          const drawVectorLabelText = (text, startX, startY, anchor = TEXT_TO_SVG_ANCHOR) => {
            const runs = splitTextIntoFontRuns(String(text || ''), DEFAULT_FONT_ID);
            if (!runs.length) return;

            let segmentX = startX;
            runs.forEach(run => {
              if (!run?.text) return;

              const textToSvg = getTextToSvgInstance(run.fontId) || getTextToSvgInstance(DEFAULT_FONT_ID);
              if (textToSvg) {
                try {
                  const pathData = textToSvg.getD(run.text, {
                    fontSize,
                    anchor,
                  });
                  const metrics = textToSvg.getMetrics(run.text, {
                    fontSize,
                    anchor,
                  });
                  doc.save();
                  doc.translate(segmentX, startY);
                  doc.path(pathData);
                  doc.stroke();
                  doc.restore();
                  segmentX += Number(metrics?.width) || 0;
                  return;
                } catch (pathError) {
                  console.warn('SheetInfo TextToSVG path failed:', pathError.message);
                }
              }

              // Fallback if TextToSVG is unavailable.
              const fallbackY = anchor === 'left middle' ? startY - fontSize * 0.5 : startY;
              doc.text(run.text, segmentX, fallbackY, {
                lineBreak: false,
                stroke: true,
                fill: false,
              });
              segmentX += doc.widthOfString(run.text);
            });
          };

          if (isMjOptimized && customLabel && customLabel.includes('\u25CF')) {
            // Split by the circle
            let [rightText, leftText] = customLabel.split('\u25CF').map(s => s.trim());
            // leftText is the number, rightText is the project name (for this patch)
            // Restore 'Sh' before the number
            let sheetNum = leftText;
            if (!/^Sh\s*/.test(sheetNum)) {
              sheetNum = `Sh ${sheetNum}`;
            }
            // Circle geometry
            const stripWidthPt = mmToPoints(leftStripWidthMm);
            const circleRadiusPt = mmToPoints(5.5 / 2); // 5.5mm diameter
            const circleCenterX = 0; // anchorXpt is at strip center
            // Measure text widths
            const leftWidth = doc.widthOfString(sheetNum);
            const rightWidth = doc.widthOfString(rightText);
            // Place number to the left of the first circle, project name to the right
            const gapPt = mmToPoints(1.2); // 1.2mm gap from circle
            const centeredAnchor = 'left middle';
            // Draw number (with 'Sh') left of the circle
            drawVectorLabelText(sheetNum, -circleRadiusPt - gapPt - leftWidth, 0, centeredAnchor);
            // Draw project name right of the circle
            drawVectorLabelText(rightText, circleRadiusPt + gapPt, 0, centeredAnchor);
          } else {
            // Fallback: default label logic
            const projectId = sheetInfo.projectId ? String(sheetInfo.projectId) : '';
            const shPart = sheetInfo.sheetCount
              ? `Sh ${Number(sheetInfo.sheetIndex) || 1} / ${Number(sheetInfo.sheetCount) || 1}`
              : `Sh ${Number(sheetInfo.sheetIndex) || 1}`;
            const label = projectId ? `${projectId} ${shPart}` : shPart;
            const totalWidth = doc.widthOfString(label);
            drawVectorLabelText(label, -totalWidth / 2, 0);
          }
          doc.restore();
        }
      }

      (sheet.placements || []).forEach((placement, placementIndex) => {
        const widthPt = mmToPoints(placement?.width);
        const heightPt = mmToPoints(placement?.height);
        const xPt = mmToPoints(placement?.x);
        const yTopPt = mmToPoints(placement?.y || 0);

        if (
          !Number.isFinite(widthPt) ||
          !Number.isFinite(heightPt) ||
          widthPt <= 0 ||
          heightPt <= 0
        ) {
          console.warn(
            `Пропускаємо елемент ${placementIndex} на аркуші ${sheetIndex} через некоректні розміри.`
          );
          return;
        }

        if (!Number.isFinite(xPt) || !Number.isFinite(yTopPt)) {
          console.warn(
            `Пропускаємо елемент ${placementIndex} на аркуші ${sheetIndex} через некоректні координати.`
          );
          return;
        }

        const placementSvgMarkup = (() => {
          if (typeof placement?.svgMarkup === 'string' && placement.svgMarkup.trim()) {
            return placement.svgMarkup;
          }

          const assetKey = placement?.svgAssetKey;
          if (typeof assetKey === 'string' && assetKey) {
            const assetMarkup = svgAssetMap[assetKey];
            if (typeof assetMarkup === 'string' && assetMarkup.trim()) {
              return assetMarkup;
            }
          }

          return null;
        })();

        const placementSvgAssetKey =
          typeof placement?.svgAssetKey === 'string' && placement.svgAssetKey
            ? placement.svgAssetKey
            : null;

        if (placementSvgMarkup) {
          let placementClipApplied = false;
          try {
            let svgElement = null;

            if (placementSvgAssetKey) {
              if (parsedSvgByAssetKey.has(placementSvgAssetKey)) {
                const cachedSvgElement = parsedSvgByAssetKey.get(placementSvgAssetKey);
                svgElement = cachedSvgElement ? cachedSvgElement.cloneNode(true) : null;
              } else {
                const svgDocument = parser.parseFromString(placementSvgMarkup, 'image/svg+xml');
                const parsedElement = svgDocument?.documentElement || null;
                parsedSvgByAssetKey.set(placementSvgAssetKey, parsedElement || null);
                svgElement = parsedElement ? parsedElement.cloneNode(true) : null;
              }
            } else {
              const svgDocument = parser.parseFromString(placementSvgMarkup, 'image/svg+xml');
              svgElement = svgDocument?.documentElement || null;
            }

            if (!svgElement) {
              throw new Error('SVG markup не містить кореневого елемента');
            }

            applyPlacementRotationToSvgElement(svgElement, placement);

            const { width: contentWidth, height: contentHeight } = extractSvgContentDimensions(
              svgElement,
              placement.sourceWidth || placement.width,
              placement.sourceHeight || placement.height
            );

            placementClipApplied = applyPlacementBoundaryClip(doc, svgElement, {
              xPt,
              yTopPt,
              widthPt,
              heightPt,
              contentWidth,
              contentHeight,
            });
            if (!placementClipApplied) {
              console.warn(
                `[layoutExportServer] Clip not applied for placement ${placement?.id || placementIndex}`
              );
            }

            // Render background without text nodes. Placement text is drawn separately
            // as vector paths so downstream tools like LightBurn see geometry, not PDF text.
            const backgroundSvg = svgElement.cloneNode(true);
            const backgroundTextNodes = backgroundSvg.getElementsByTagName('text');
            while (backgroundTextNodes.length > 0) {
              const node = backgroundTextNodes[0];
              node.parentNode?.removeChild(node);
            }

            // Keep barcode geometry inside the original SVG background markup.
            // This ensures PDF output matches canvas dimensions 1:1.

            // NOTE: Do not recolor border elements on the server.
            // Client-side export markup already contains:
            // - standard blue outline
            // - green overlay (#008181) + inner green offset
            // Recoloring here would break the expected "blue + green" stacking.
            const allElements = backgroundSvg.getElementsByTagName('*');

            // Видаляємо фоновий rect (canvas background) за атрибутом data-layout-background="true"
            const backgroundRects = [];
            for (let i = 0; i < allElements.length; i++) {
              const el = allElements[i];
              if (el.getAttribute('data-layout-background') === 'true') {
                backgroundRects.push(el);
              }
            }
            backgroundRects.forEach(rect => rect.parentNode?.removeChild(rect));

            // Також видаляємо rect які посилаються на pattern (текстурні фони - дерево, карбон)
            const rectsWithPattern = backgroundSvg.getElementsByTagName('rect');
            const rectsToRemove = [];
            for (let i = 0; i < rectsWithPattern.length; i++) {
              const rect = rectsWithPattern[i];
              const fill = rect.getAttribute('fill') || '';
              // Якщо fill посилається на url(#...) - це може бути pattern
              if (fill.startsWith('url(#') || fill.includes('url(')) {
                rectsToRemove.push(rect);
              }
            }
            rectsToRemove.forEach(rect => rect.parentNode?.removeChild(rect));

            const serializer = new XMLSerializer();
            const backgroundMarkup = serializer.serializeToString(backgroundSvg);

            if (backgroundMarkup) {
              try {
                svgToPdf(doc, backgroundMarkup, xPt, yTopPt, {
                  assumePt: false,
                  width: widthPt,
                  height: heightPt,
                  preserveAspectRatio: 'none',
                });
              } catch (backgroundError) {
                console.warn('Не вдалося відрендерити фон SVG:', backgroundError.message);
              }
            }

            // Always draw the standard blue border outline first
            try {
              // drawStandardBorderOutline(doc, {
              //   xPt,
              //   yTopPt,
              //   widthPt,
              //   heightPt,
              // });
            } catch (standardBorderError) {
              console.warn(
                'Не вдалося намалювати стандартний бордер:',
                standardBorderError.message
              );
            }

            // Draw custom border outline on top if enabled (teal stroke only)
            if (placement.customBorder) {
              try {
                drawCustomBorderOutline(doc, {
                  xPt,
                  yTopPt,
                  widthPt,
                  heightPt,
                  customBorder: placement.customBorder,
                });
              } catch (borderError) {
                console.warn('Не вдалося намалювати кастомний бордер:', borderError.message);
              }
            }

            const textNodes = svgElement.getElementsByTagName('text');

            if (!textNodes || textNodes.length === 0) {
              return;
            }

            for (let idx = 0; idx < textNodes.length; idx += 1) {
              const textNode = textNodes[idx];
              try {
                const anchorAttr = resolveTextStyleValue(textNode, 'text-anchor');
                const fontFamilyAttr = resolveTextStyleValue(textNode, 'font-family');
                const fontWeightAttr = resolveTextStyleValue(textNode, 'font-weight');
                const fontStyleAttr = resolveTextStyleValue(textNode, 'font-style');
                const fontSize = resolveTextNodeFontSize(textNode);

                const { baseX, baseY, source: positionSource } =
                  resolveTextNodePosition(textNode);

                const cumulativeMatrix = computeCumulativeMatrix(textNode);
                const point = applyMatrixToPoint(cumulativeMatrix, baseX, baseY);
                const { scaleX: matrixScaleX, scaleY: matrixScaleY } =
                  extractScaleFromMatrix(cumulativeMatrix);
                const matrixRotationDeg = extractRotationDegreesFromMatrix(cumulativeMatrix);
                const hasMatrixRotation = Math.abs(matrixRotationDeg) > 0.01;

                const fontId = resolveFontId(fontFamilyAttr, fontWeightAttr, fontStyleAttr);

                let textContent = textNode.textContent || '';
                textContent = decodeHtmlEntities(textContent.trim());
                if (!textContent) continue;

                const svgScaleX = widthPt / contentWidth;
                const svgScaleY = heightPt / contentHeight;
                const svgScale = Math.min(svgScaleX, svgScaleY) || 1;
                const offsetXPt = xPt + (widthPt - contentWidth * svgScale) / 2;
                const offsetYPt = yTopPt + (heightPt - contentHeight * svgScale) / 2;
                const normalizedX = offsetXPt + point.x * svgScale;
                const normalizedY = offsetYPt + point.y * svgScale;

                const combinedScaleX = svgScale * matrixScaleX;
                const combinedScaleY = svgScale * matrixScaleY;
                const fontScaleX = combinedScaleX || svgScale;
                const fontScaleY = combinedScaleY || svgScale;
                const averageScale = (fontScaleX + fontScaleY) / 2 || svgScale;
                const normalizedFontSize = normalizeFontSizeForSvgUnits(
                  fontSize,
                  svgScale
                );
                const scaledFontSize = normalizedFontSize * fontScaleY;
                const strokeWidthPt = Math.max(TEXT_STROKE_WIDTH_PT * averageScale, 0.01);
                const anchorMode = (anchorAttr || '').trim().toLowerCase();

                const fontRuns = splitTextIntoFontRuns(textContent, fontId);
                if (!fontRuns.length) {
                  continue;
                }

                doc.save();

                const measureWithPdfkit = (requestedFontId, text) => {
                  let resolvedFontId = requestedFontId;
                  try {
                    doc.font(resolvedFontId);
                  } catch (fontError) {
                    console.warn(
                      `Шрифт ${resolvedFontId} недоступний, використаємо ${DEFAULT_FONT_ID}:`,
                      fontError.message
                    );
                    resolvedFontId = DEFAULT_FONT_ID;
                    doc.font(DEFAULT_FONT_ID);
                  }
                  doc.fontSize(scaledFontSize);
                  const width = doc.widthOfString(text);
                  const lineHeight = doc.currentLineHeight(true);
                  return {
                    width,
                    lineHeight,
                    baselineOffset: computeBaselineOffset(scaledFontSize),
                    fontId: resolvedFontId,
                    textToSvg: null,
                  };
                };

                const segmentMetrics = fontRuns.map(run => {
                  const requestedFontId = run.fontId;
                  let textToSvgInstance = getTextToSvgInstance(requestedFontId);
                  let activeFontId = requestedFontId;

                  if (!textToSvgInstance) {
                    textToSvgInstance = getTextToSvgInstance(DEFAULT_FONT_ID);
                    if (textToSvgInstance) {
                      activeFontId = DEFAULT_FONT_ID;
                    }
                  }

                  if (!textToSvgInstance) {
                    const fallback = measureWithPdfkit(activeFontId, run.text);
                    return {
                      ...run,
                      fontId: fallback.fontId,
                      width: fallback.width,
                      lineHeight: fallback.lineHeight,
                      textToSvg: null,
                    };
                  }

                  try {
                    const metrics = textToSvgInstance.getMetrics(run.text || '', {
                      fontSize: scaledFontSize,
                      anchor: PLACEMENT_TEXT_TO_SVG_ANCHOR,
                    });
                    const width = metrics?.width ?? 0;
                    const height = metrics?.height ?? scaledFontSize;
                    return {
                      ...run,
                      fontId: activeFontId,
                      width,
                      lineHeight: height,
                      baselineOffset: computeBaselineOffset(scaledFontSize),
                      textToSvg: textToSvgInstance,
                    };
                  } catch (metricsError) {
                    console.warn(
                      `TextToSVG metrics failed для ${activeFontId}:`,
                      metricsError.message
                    );
                    TEXT_TO_SVG_CACHE.set(activeFontId, null);
                    const fallback = measureWithPdfkit(activeFontId, run.text);
                    return {
                      ...run,
                      fontId: fallback.fontId,
                      width: fallback.width,
                      lineHeight: fallback.lineHeight,
                      baselineOffset: fallback.baselineOffset,
                      textToSvg: null,
                    };
                  }
                });

                const textWidth = segmentMetrics.reduce((acc, segment) => acc + segment.width, 0);
                const maxLineHeight =
                  segmentMetrics.reduce((max, segment) => Math.max(max, segment.lineHeight), 0) ||
                  scaledFontSize;
                const maxBaselineOffset =
                  segmentMetrics.reduce(
                    (max, segment) => Math.max(max, Number(segment.baselineOffset) || 0),
                    0
                  ) ||
                  scaledFontSize * 0.8;

                let drawXLocal = 0;
                if (anchorMode === 'end' || anchorMode === 'right') {
                  drawXLocal -= textWidth;
                } else if (anchorMode === 'middle' || anchorMode === 'center') {
                  drawXLocal -= textWidth / 2;
                } else if (anchorMode === 'start' || anchorMode === 'left') {
                  drawXLocal += 0;
                } else {
                  // Fabric exports actual line positions on tspans. If we recovered coordinates
                  // from a tspan x/y, they already represent the line start, so don't center again.
                  if (positionSource === 'tspan') {
                    drawXLocal += 0;
                  } else {
                    drawXLocal -= textWidth / 2;
                  }
                }

                const drawYLocal = 0;

                let drawX = normalizedX + drawXLocal;
                let drawY = normalizedY + drawYLocal;

                drawX += scaledFontSize * PDF_TEXT_X_NUDGE_EM;
                drawY += scaledFontSize * PDF_TEXT_Y_NUDGE_EM;
                drawY += PLACEMENT_TEXT_GLOBAL_Y_SHIFT_PT;

                if (!hasMatrixRotation && positionSource === 'default') {
                  const outOfBounds =
                    drawX < xPt - widthPt * 0.25 ||
                    drawX > xPt + widthPt * 1.25 ||
                    drawY < yTopPt - heightPt * 0.5 ||
                    drawY > yTopPt + heightPt * 1.5;

                  if (outOfBounds) {
                    drawX = xPt + widthPt / 2 - textWidth / 2;
                    const centerY = yTopPt + heightPt / 2;
                    drawY = centerY;
                  }
                }

                doc.strokeColor(TEXT_OUTLINE_COLOR);
                doc.lineWidth(strokeWidthPt);
                doc.lineJoin('round');
                doc.lineCap('round');

                const drawSegments = (segmentStartX, baselineY) => {
                  let segmentX = segmentStartX;
                  segmentMetrics.forEach(segment => {
                    if (!segment.text) {
                      return;
                    }

                    const renderWithPdfkit = () => {
                      try {
                        doc.font(segment.fontId);
                      } catch (segmentFontError) {
                        doc.font(DEFAULT_FONT_ID);
                      }
                      doc.fontSize(scaledFontSize);
                      doc.text(
                        segment.text,
                        segmentX,
                        baselineY - (Number(segment.baselineOffset) || maxBaselineOffset),
                        {
                        lineBreak: false,
                        stroke: true,
                        fill: false,
                        }
                      );
                    };

                    if (segment.textToSvg) {
                      try {
                        const pathData =
                          buildIntersectedGlyphPathData(
                            segment.textToSvg,
                            segment.text,
                            scaledFontSize
                          ) ||
                          segment.textToSvg.getD(segment.text, {
                            fontSize: scaledFontSize,
                            anchor: PLACEMENT_TEXT_TO_SVG_ANCHOR,
                          });
                        doc.save();
                        doc.translate(segmentX, baselineY);
                        doc.path(pathData);
                        doc.stroke();
                        doc.restore();
                      } catch (pathError) {
                        console.warn(
                          `TextToSVG path failed для ${segment.fontId}:`,
                          pathError.message
                        );
                        TEXT_TO_SVG_CACHE.set(segment.fontId, null);
                        renderWithPdfkit();
                      }
                    } else {
                      renderWithPdfkit();
                    }

                    segmentX += segment.width;
                  });
                };

                if (hasMatrixRotation) {
                  doc.save();
                  doc.translate(normalizedX, normalizedY);
                  doc.rotate(matrixRotationDeg);
                  drawSegments(drawXLocal, 0);
                  doc.restore();
                } else {
                  drawSegments(drawX, drawY);
                }

                doc.restore();
              } catch (textError) {
                console.error('Не вдалося намалювати текстовий елемент:', textError.message);
              }
            }

            return;
          } catch (error) {
            console.error(
              `Не вдалося відрендерити SVG для ${placement?.id || placementIndex}`,
              error
            );
          } finally {
            if (placementClipApplied) {
              try {
                doc.restore();
              } catch {}
            }
          }
        }

        const fallbackMarkup = buildFallbackSvgMarkup(
          placement,
          placementSvgMarkup ? 'SVG недоступний' : 'SVG відсутній'
        );
        if (fallbackMarkup) {
          try {
            svgToPdf(doc, fallbackMarkup, xPt, yTopPt, {
              assumePt: false,
              width: widthPt,
              height: heightPt,
              preserveAspectRatio: 'xMidYMid meet',
            });
            return;
          } catch (error) {
            console.error(
              `Не вдалося відрендерити fallback SVG для ${placement?.id || placementIndex}`,
              error
            );
          }
        }

        // Якщо fallback SVG теж не вдався, малюємо мінімальний прямокутник у класичній системі координат.
        const yBottomPt = pageHeightPt - mmToPoints((placement?.y || 0) + (placement?.height || 0));
        doc.save();
        doc.lineWidth(1);
        doc.strokeColor(OUTLINE_STROKE_COLOR);
        doc.rect(xPt, yBottomPt, widthPt, heightPt).stroke();
        doc.restore();
      });

      // Draw the wrapping frame AFTER placements so it stays visible.
      const frameRects = Array.isArray(sheet?.frameRects) && sheet.frameRects.length
        ? sheet.frameRects
        : sheet?.frameRect
          ? [sheet.frameRect]
          : [];
      const frameInfos = Array.isArray(sheet?.frameInfos) ? sheet.frameInfos : [];
      const sheetMode = sheet?.exportMode || exportMode;
      const isMjOptimizedSheet = sheetMode === 'Sheet optimized (MJ) Fr.';
      const isMjFrameSheet =
        isMjOptimizedSheet ||
        sheetMode === 'Normal (MJ) Frame';

      frameRects.forEach((frameRect, frameIndex) => {
        if (
          !frameRect ||
          !Number.isFinite(Number(frameRect?.x)) ||
          !Number.isFinite(Number(frameRect?.y)) ||
          !Number.isFinite(Number(frameRect?.width)) ||
          !Number.isFinite(Number(frameRect?.height))
        ) {
          return;
        }

        const frameWidthMm = Math.max(0, Number(frameRect.width) || 0);
        const frameHeightMm = Math.max(0, Number(frameRect.height) || 0);
        if (frameWidthMm <= 0 || frameHeightMm <= 0) return;

        const frameXPt = mmToPoints(frameRect.x);
        const frameYPt = mmToPoints(frameRect.y);
        const frameWidthPt = mmToPoints(frameWidthMm);
        const frameHeightPt = mmToPoints(frameHeightMm);

        if (isMjFrameSheet) {
          doc.save();
          doc.lineWidth(0.5);
          doc.strokeColor('#8B4513');

          const radiusPt = mmToPoints(1.5);
          doc.roundedRect(frameXPt, frameYPt, frameWidthPt, frameHeightPt, radiusPt).stroke();
          doc.restore();
        }

        if (isMjFrameSheet) {
          const frameInfo = frameInfos[frameIndex] || null;
          const stripWidthMm = Math.max(0, Number(frameInfo?.stripWidthMm) || 9.5);
          const holeDiameterMm = 5.5;
          const holeRadiusMm = holeDiameterMm / 2;
          const holeSpacingMm = 80;
          const secondHoleMinHeightMm = 135;
          const stripLeftXmm = frameRect.x;
          const stripRightXmm = frameRect.x + stripWidthMm;
          // Compute hole center X so there is exactly 2mm clearance
          // from the circle edge to the brown frame edge (left) and
          // 2mm clearance from the circle edge to the canvas start (right).
          // holeCenterXmm must satisfy both:
          //   holeCenterXmm - holeRadiusMm - frameRect.x >= 2
          //   (frameRect.x + stripWidthMm) - (holeCenterXmm + holeRadiusMm) >= 2
          // Solve ideal position: frameRect.x + holeRadiusMm + 2
          // Clamp to available strip if strip is narrower than required.
          const minCenterXmm = frameRect.x + holeRadiusMm + 2;
          const maxCenterXmm = frameRect.x + stripWidthMm - holeRadiusMm - 2;
          // Prefer centered-ish placement but respect clearances
          let holeCenterXmm = Math.max(minCenterXmm, Math.min(maxCenterXmm, frameRect.x + stripWidthMm * 0.5));
          const holeCentersYmm = frameHeightMm >= secondHoleMinHeightMm
            ? [frameRect.y + frameHeightMm / 2 - holeSpacingMm / 2, frameRect.y + frameHeightMm / 2 + holeSpacingMm / 2]
            : [frameRect.y + frameHeightMm / 2];

          // Separator line removed: keep only the rounded frame outline
          // (previously drew a straight separator at `separatorXmm`, removed per request)

          doc.save();
          doc.lineWidth(0.75);
          holeCentersYmm.forEach((cyMm) => {
            doc
              .circle(mmToPoints(holeCenterXmm), mmToPoints(cyMm), mmToPoints(holeRadiusMm))
              .fillAndStroke('#FFFFFF', '#FF0000');
          });
          doc.restore();

          if (!isMjOptimizedSheet) {
            return;
          }

          const topLabel = (typeof frameInfo?.topLabel === 'string' && frameInfo.topLabel.trim()) || '';
          const bottomLabel =
            (typeof frameInfo?.bottomLabel === 'string' && frameInfo.bottomLabel.trim()) || `Sh ${frameIndex + 1}/${frameRects.length}`;

          const drawRotatedLabel = (label, anchorXmm, anchorYmm, fontSize) => {
            if (!label) return;
            doc.save();
            doc.strokeColor(TEXT_OUTLINE_COLOR);
            doc.strokeOpacity(1);
            doc.lineJoin('round');
            doc.lineCap('round');
            doc.lineWidth(Math.max(TEXT_STROKE_WIDTH_PT, 0.2));
            doc.font(DEFAULT_FONT_ID);
            doc.fontSize(fontSize);
            doc.translate(mmToPoints(anchorXmm), mmToPoints(anchorYmm));
            doc.rotate(-90);

            const runs = splitTextIntoFontRuns(String(label || ''), DEFAULT_FONT_ID);
            if (!runs.length) {
              doc.restore();
              return;
            }

            const centeredAnchor = 'left middle';
            const runMetrics = runs.map((run) => {
              if (!run?.text) return { run, width: 0, textToSvg: null };
              const textToSvg = getTextToSvgInstance(run.fontId) || getTextToSvgInstance(DEFAULT_FONT_ID);
              if (textToSvg) {
                try {
                  const metrics = textToSvg.getMetrics(run.text, {
                    fontSize,
                    anchor: centeredAnchor,
                  });
                  return {
                    run,
                    width: Number(metrics?.width) || 0,
                    textToSvg,
                  };
                } catch (metricsError) {
                  console.warn('Frame label TextToSVG metrics failed:', metricsError.message);
                }
              }

              return {
                run,
                width: doc.widthOfString(run.text),
                textToSvg: null,
              };
            });

            const totalWidthPt = runMetrics.reduce((acc, entry) => acc + (Number(entry?.width) || 0), 0);
            let segmentX = -totalWidthPt / 2;

            runMetrics.forEach((entry) => {
              const run = entry?.run;
              if (!run?.text) return;

              if (entry?.textToSvg) {
                try {
                  const pathData = entry.textToSvg.getD(run.text, {
                    fontSize,
                    anchor: centeredAnchor,
                  });
                  doc.save();
                  doc.translate(segmentX, 0);
                  doc.path(pathData);
                  doc.stroke();
                  doc.restore();
                  segmentX += Number(entry?.width) || 0;
                  return;
                } catch (pathError) {
                  console.warn('Frame label TextToSVG path failed:', pathError.message);
                }
              }

              doc.text(run.text, segmentX, -fontSize * 0.5, {
                lineBreak: false,
                stroke: true,
                fill: false,
              });
              segmentX += Number(entry?.width) || doc.widthOfString(run.text);
            });
            doc.restore();
          };

          const fontSize = Math.max(5.8, Math.min(9, mmToPoints(Math.max(8, stripWidthMm) * 0.9)));
          const firstHoleY = holeCentersYmm[0];
          const lastHoleY = holeCentersYmm[holeCentersYmm.length - 1];
          const topZoneTop = frameRect.y;
          const topZoneBottom = firstHoleY - holeRadiusMm - 0.8;
          const bottomZoneTop = lastHoleY + holeRadiusMm + 0.8;
          const bottomZoneBottom = frameRect.y + frameHeightMm;

          // If there are two holes, draw the main label between them vertically.
          if (holeCentersYmm.length === 2) {
            // Place both labels between the two holes, stacked vertically, with 2mm
            // clearance from hole edges. If space is tight, shrink font (but not below 5.8pt).
            const topHoleY = holeCentersYmm[0];
            const bottomHoleY = holeCentersYmm[1];
            const betweenTop = topHoleY + holeRadiusMm + 2; // 2mm clearance from top hole
            const betweenBottom = bottomHoleY - holeRadiusMm - 2; // 2mm clearance from bottom hole
            const availableMm = Math.max(0, betweenBottom - betweenTop);

            if (availableMm > 0 && (topLabel || bottomLabel)) {
              // Compute current font size in mm
              const fontSizePt = fontSize;
              const fontSizeMm = fontSizePt / MM_TO_PT;
              const desiredTwoLinesMm = fontSizeMm * 2 + 0.5; // slight gap between lines

              let useFontPt = fontSizePt;
              if (availableMm < desiredTwoLinesMm) {
                const ratio = availableMm / desiredTwoLinesMm;
                useFontPt = Math.max(5.8, Math.floor(fontSizePt * ratio));
              }

              const lineHeightMm = (useFontPt / MM_TO_PT);
              const gapBetweenLinesMm = Math.max(0.4, (availableMm - lineHeightMm * 2) / 3);
              // Position first line slightly below betweenTop + gap
              const firstLineY = betweenTop + gapBetweenLinesMm + lineHeightMm / 2;
              const secondLineY = firstLineY + lineHeightMm + gapBetweenLinesMm;

              if (topLabel) drawRotatedLabel(topLabel, holeCenterXmm, firstLineY, useFontPt);
              if (bottomLabel) drawRotatedLabel(bottomLabel, holeCenterXmm, secondLineY, useFontPt);
            }
          } else {
            if (topLabel && topZoneBottom - topZoneTop > 2.5) {
              drawRotatedLabel(topLabel, holeCenterXmm, (topZoneTop + topZoneBottom) / 2, fontSize);
            }
            if (bottomLabel && bottomZoneBottom - bottomZoneTop > 2.5) {
              drawRotatedLabel(bottomLabel, holeCenterXmm, (bottomZoneTop + bottomZoneBottom) / 2, fontSize);
            }
          }
        }
      });
    });

    doc.end();
  } catch (error) {
    console.error('Помилка експорту PDF', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Не вдалося створити PDF.' });
    } else {
      res.end();
    }
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const start = async () => {
  try {
    // Mongo is required for templates API; do not block PDF export during local dev
    try {
      await connectMongo();
      console.log('Mongo connected');
    } catch (mongoError) {
      console.log('Mongo connection failed (server will still run):', mongoError);
    }

    // MySQL is used for auth; do not block server startup during local dev
    try {
      await sequelize.authenticate();
      await sequelize.sync();
      console.log('MySQL connected');
    } catch (mysqlError) {
      console.log('MySQL connection failed (server will still run):', mysqlError);
    }

    const server = app.listen(DEFAULT_PORT, () => {
      console.log(`Layout export server запущено на порту ${DEFAULT_PORT}`);
      if (ALLOWED_ORIGINS) {
        console.log(`Дозволені домени: ${ALLOWED_ORIGINS.join(', ')}`);
      }
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${DEFAULT_PORT} is already in use. Stop the process using it and retry.`);
      } else {
        console.error('HTTP server error:', err);
      }
      process.exitCode = 1;
    });
  } catch (error) {
    console.log(error);
  }
};


const CheckIsPay=async()=>{
  try{
    const date21DaysAgo = new Date();
    date21DaysAgo.setDate(date21DaysAgo.getDate() - 21);

    const orders = await Order.findAll({
      where: {
        isPaid: false,
        createdAt: {
          [Op.lte]: date21DaysAgo
        }
      },
      include:[{
        model:User
      }]
    });
    for(let i=0;i<orders.length;i++){
      SendEmailForStatus.ReminderPay(orders[i]);
    }
  }catch(err){
    console.error(4234,err);
  }
}

cron.schedule('0 3 * * *', async () => {
  console.log('Running CheckIsPay job...');
  await CheckIsPay();
});

start();
