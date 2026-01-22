import { useParams, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { prefixedLngs } from './i18n';

const LanguageGuard = ({ isDefault }) => {
  const { lng } = useParams();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (isDefault) {
      // Якщо ми на маршруті без префікса — ставимо англійську
      i18n.changeLanguage('de');
    } else if (prefixedLngs.includes(lng)) {
      // Якщо мова в списку префіксів — ставимо її
      i18n.changeLanguage(lng);
    }
  }, [lng, i18n, isDefault]);

  // Якщо префікс є, але його немає в списку дозволених — 404
  if (!isDefault && !prefixedLngs.includes(lng)) {
    return (
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h1>404</h1>
        <p>Page Not Found</p>
      </div>
    );
  }

  return <Outlet />;
};

export default LanguageGuard;
