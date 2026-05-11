import i18n from '../i18n';

export const getLocalizedPath = (path = '') => {
  console.log(4349234,path)
  const lang = i18n.language?.toLowerCase() || 'en';

  // зовнішні URL не чіпаємо
  if (path.startsWith('http')) {
    return path;
  }

  // абсолютний path
  const cleanPath = path.startsWith('/')
    ? path
    : `/${path}`;

  // en без префікса
  if (lang === 'en') {
    return cleanPath;
  }

  return `/${lang}${cleanPath}`;
};