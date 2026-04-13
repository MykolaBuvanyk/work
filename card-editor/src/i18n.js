import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ua from './locales/ua.json';
import en from './locales/en.json';
import { languageCountries } from './components/Header/Header';

// Список мов, які мають префікс у URL (всі, крім англійської)
export const prefixedLngs = languageCountries.map(l =>
  l.code.toLowerCase()
);
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
