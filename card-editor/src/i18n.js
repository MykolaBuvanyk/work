import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ua from './locales/ua.json';
import en from './locales/en.json';

// Список мов, які мають префікс у URL (всі, крім англійської)
export const prefixedLngs = [
  'en',
  'fr',
  'it',
  'es',
  'pl',
  'cz',
  'nl',
  'se',
  'no',
  'dk',
  'hu',
  'hr',
  'ua',
  'ru',
  'de'
];

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ua: { translation: ua },
    de: { translation: ua }, // тимчасово
  },
  lng: 'de',
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
});

export default i18n;
