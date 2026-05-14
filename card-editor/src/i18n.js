import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ua from './locales/ua.json';
import en from './locales/en.json';
import de from './locales/de.json';

const languageCountries = [
  { flag: "🇩🇪", code: "DE", codeFlag: "DE" }, // вибрана
  { flag: "🇬🇧", code: "EN", codeFlag: "GB" },
  { flag: "🇫🇷", code: "FR", codeFlag: "FR" },
  { flag: "🇮🇹", code: "IT", codeFlag: "IT" },
  { flag: "🇨🇿", code: "CS", codeFlag: "CZ" },
  { flag: "🇩🇰", code: "DA", codeFlag: "DK" },
  { flag: "🇪🇸", code: "ES", codeFlag: "ES" },
  { flag: "🇪🇪", code: "ET", codeFlag: "EE" },
  { flag: "🇭🇷", code: "HR", codeFlag: "HR" },
  { flag: "🇭🇺", code: "HU", codeFlag: "HU" },
  { flag: "🇱🇹", code: "LT", codeFlag: "LT" },
  { flag: "🇳🇱", code: "NL", codeFlag: "NL" },
  { flag: "🇵🇱", code: "PL", codeFlag: "PL" },
  { flag: "🇷🇴", code: "RO", codeFlag: "RO" },
  { flag: "🇸🇰", code: "SK", codeFlag: "SK" },
  { flag: "🇸🇮", code: "SL", codeFlag: "SI" },
  { flag: "🇸🇪", code: "SV", codeFlag: "SE" },
  { flag: "🇺🇦", code: "UA", codeFlag: "UA" },
  //{ flag: "🇩🇪", code: "DE", codeFlag: "DE" },
];

// Список мов, які мають префікс у URL (всі, крім німецької)
export const prefixedLngs = languageCountries.filter(x=>x.code.toLocaleLowerCase()!='de').map(l =>
  l.code.toLowerCase()
)
i18n.use(initReactI18next).init({
  resources:  Object.fromEntries(
  languageCountries.map(lang => [
    lang.code.toLowerCase(),
    {
      translation: lang.code.toLowerCase() === 'de' ? de : en,//тимчасово
    },
  ])
),
  lng: 'de',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
