import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ua from './locales/ua.json';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import cz from './locales/cz.json';
import da from './locales/da.json';
import es from './locales/es.json';
import et from './locales/et.json';
import hr from './locales/hr.json';


import hu from './locales/hu.json';
import lt from './locales/lt.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import ro from './locales/ro.json';

// словники, які реально існують
const dictionaries = {
  de,
  en,
  ua,
  fr,
  it,
  cs: cz,
  da,
  es,
  et,
  hr,
  hu,
  lt,
  nl,
  pl,
  ro,
};

const languageCountries = [
  { flag: '🇩🇪', code: 'DE', codeFlag: 'DE' },
  { flag: '🇬🇧', code: 'EN', codeFlag: 'GB' },
  { flag: '🇫🇷', code: 'FR', codeFlag: 'FR' },
  { flag: '🇮🇹', code: 'IT', codeFlag: 'IT' },
  { flag: '🇨🇿', code: 'CS', codeFlag: 'CZ' },
  { flag: '🇩🇰', code: 'DA', codeFlag: 'DK' },
  { flag: '🇪🇸', code: 'ES', codeFlag: 'ES' },
  { flag: '🇪🇪', code: 'ET', codeFlag: 'EE' },
  { flag: '🇭🇷', code: 'HR', codeFlag: 'HR' },
  { flag: '🇭🇺', code: 'HU', codeFlag: 'HU' },
  { flag: '🇱🇹', code: 'LT', codeFlag: 'LT' },
  { flag: '🇳🇱', code: 'NL', codeFlag: 'NL' },
  { flag: '🇵🇱', code: 'PL', codeFlag: 'PL' },
  { flag: '🇷🇴', code: 'RO', codeFlag: 'RO' },
  { flag: '🇸🇰', code: 'SK', codeFlag: 'SK' },
  { flag: '🇸🇮', code: 'SL', codeFlag: 'SI' },
  { flag: '🇸🇪', code: 'SV', codeFlag: 'SE' },
  { flag: '🇺🇦', code: 'UA', codeFlag: 'UA' },
];

// Всі, крім DE, мають префікс
export const prefixedLngs = languageCountries
  .filter(x => x.code.toLowerCase() !== 'de')
  .map(x => x.code.toLowerCase());

i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    languageCountries.map(lang => {
      const code = lang.code.toLowerCase();

      return [
        code,
        {
          // якщо словника нема → en
          translation: dictionaries[code] ?? en,
        },
      ];
    })
  ),

  lng: 'de',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;