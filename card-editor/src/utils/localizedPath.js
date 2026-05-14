import i18n from '../i18n';

export const getLocalizedPath = (path = '') => {
  const lang = i18n.language?.toLowerCase() || 'de';

  // зовнішні URL не чіпаємо
  if (path.startsWith('http')) {
    return path;
  }

  // абсолютний path
  const cleanPath = path.startsWith('/')
    ? path
    : `/${path}`;

  // de без префікса
  if (lang === 'de') {
    return cleanPath;
  }

  return `/${lang}${cleanPath}`;
};
