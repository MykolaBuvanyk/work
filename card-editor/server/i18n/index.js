import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.join(__dirname, 'locales');

export const SUPPORTED_LANGUAGES = [
  'de', 'en', 'fr', 'it', 'cs', 'da', 'es', 'et',
  'hr', 'hu', 'lt', 'nl', 'pl', 'ro', 'sk', 'sl', 'sv', 'ua',
];

export const DEFAULT_LANGUAGE = 'de';

// Country (ISO-3166 alpha-2) → primary language code for SignXpert
const COUNTRY_TO_LANGUAGE = {
  DE: 'de', AT: 'de', CH: 'de', LI: 'de',
  GB: 'en', UK: 'en', IE: 'en', US: 'en', MT: 'en',
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr',
  IT: 'it', SM: 'it', VA: 'it',
  CZ: 'cs',
  DK: 'da', FO: 'da', GL: 'da',
  ES: 'es', AD: 'es',
  EE: 'et',
  HR: 'hr', BA: 'hr',
  HU: 'hu',
  LT: 'lt',
  NL: 'nl',
  PL: 'pl',
  RO: 'ro', MD: 'ro',
  SK: 'sk',
  SI: 'sl',
  SE: 'sv',
  UA: 'ua', BY: 'ua',
};

export const countryToLanguage = (country) => {
  const code = String(country || '').trim().toUpperCase();
  if (!code) return DEFAULT_LANGUAGE;
  return COUNTRY_TO_LANGUAGE[code] || DEFAULT_LANGUAGE;
};

const translations = {};

const loadLanguage = (lang) => {
  if (translations[lang]) return translations[lang];
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    translations[lang] = JSON.parse(raw);
  } catch (err) {
    translations[lang] = null;
  }
  return translations[lang];
};

const getByPath = (obj, key) => {
  if (!obj) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  return key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
};

export const normalizeLanguage = (raw) => {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return DEFAULT_LANGUAGE;
  // accept "uk" as alias for "ua"
  if (value === 'uk') return 'ua';
  // accept "en-GB" → "en"
  const short = value.split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(short) ? short : DEFAULT_LANGUAGE;
};

/**
 * Translate by key.
 * @param {string} key dot-path, e.g. "invoice.label.qty"
 * @param {string} lang language code (e.g. "de", "fr")
 * @param {object} [vars] interpolation variables { name } => replaces {name}
 */
export const t = (key, lang = DEFAULT_LANGUAGE, vars = {}) => {
  const normalized = normalizeLanguage(lang);
  let value = getByPath(loadLanguage(normalized), key);
  if (value === undefined && normalized !== 'en') {
    value = getByPath(loadLanguage('en'), key);
  }
  if (value === undefined) {
    return key;
  }
  if (vars && typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (_, name) =>
      vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : `{${name}}`
    );
  }
  return value;
};

/**
 * Picks the language to use for a given request/order.
 * Priority: explicit body.language → user.language → Accept-Language header → DEFAULT
 */
export const pickLanguage = ({ explicit, user, acceptHeader } = {}) => {
  if (explicit) return normalizeLanguage(explicit);
  if (user?.language) return normalizeLanguage(user.language);
  if (acceptHeader) {
    const first = String(acceptHeader).split(',')[0]?.trim();
    if (first) return normalizeLanguage(first);
  }
  return DEFAULT_LANGUAGE;
};

export default { t, pickLanguage, normalizeLanguage, countryToLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE };
