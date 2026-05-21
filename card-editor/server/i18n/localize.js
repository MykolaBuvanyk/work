import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeLanguage, DEFAULT_LANGUAGE } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.join(__dirname, 'locales');

const dictionaryCache = new Map();
const compiledCache = new Map();

const loadDictionary = (lang) => {
  if (dictionaryCache.has(lang)) return dictionaryCache.get(lang);
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    parsed = null;
  }
  dictionaryCache.set(lang, parsed);
  return parsed;
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const startsWithWordChar = (str) => /^[A-Za-z0-9]/.test(str);
const endsWithWordChar = (str) => /[A-Za-z0-9]$/.test(str);

const buildPhraseRegex = (phrase) => {
  let pattern = escapeRegex(phrase);
  if (startsWithWordChar(phrase)) {
    pattern = `(?<![A-Za-z0-9])${pattern}`;
  }
  if (endsWithWordChar(phrase)) {
    pattern = `${pattern}(?![A-Za-z0-9])`;
  }
  return new RegExp(pattern, 'g');
};

/**
 * Compile entries to a sorted list (longest phrase first).
 * Each entry: { regex, replacement }
 */
const compileEntries = (lang) => {
  if (compiledCache.has(lang)) return compiledCache.get(lang);
  const targetDict = loadDictionary(lang);
  const sourceDict = loadDictionary('en');
  if (!targetDict || !sourceDict) {
    compiledCache.set(lang, []);
    return [];
  }
  const phrases = Object.keys(sourceDict).filter((key) => {
    const enValue = sourceDict[key];
    const trValue = targetDict[key];
    return (
      typeof enValue === 'string' &&
      typeof trValue === 'string' &&
      enValue.trim().length > 0 &&
      trValue.trim().length > 0 &&
      enValue !== trValue // skip if translation equals source (e.g. brand names)
    );
  });
  // longer phrases first — protects against partial overlaps
  phrases.sort((a, b) => sourceDict[b].length - sourceDict[a].length);
  const entries = phrases.map((key) => {
    const en = sourceDict[key];
    const tr = targetDict[key];
    const regex = buildPhraseRegex(en);
    return { regex, replacement: tr };
  });
  compiledCache.set(lang, entries);
  return entries;
};

const localizeTextNode = (text, entries) => {
  let out = text;
  for (const { regex, replacement } of entries) {
    out = out.replace(regex, replacement);
  }
  return out;
};

/**
 * Replace known English phrases with translated equivalents.
 * - Phrases are matched as-is (no word-boundary guess); use full clauses in en.json.
 * - Longest phrases match first to avoid partial overlap.
 * - If lang == 'en' or dictionary missing, returns input unchanged.
 *
 * @param {string} input HTML / plain text source
 * @param {string} lang  language code
 * @returns {string}
 */
export const localize = (input, lang) => {
  if (input == null) return input;
  const text = String(input);
  const normalized = normalizeLanguage(lang);
  if (normalized === 'en') return text;
  const entries = compileEntries(normalized);
  if (!entries.length) return text;
  return text
    .split(/(<[^>]*>)/g)
    .map((part) => (part.startsWith('<') ? part : localizeTextNode(part, entries)))
    .join('');
};

export const clearLocalizeCache = () => {
  dictionaryCache.clear();
  compiledCache.clear();
};

export default localize;
