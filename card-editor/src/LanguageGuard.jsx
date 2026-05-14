import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import i18n, { prefixedLngs } from './i18n';

export default function LanguageGuard({ isDefault }) {
  const { lng } = useParams();
  const location = useLocation();

  useEffect(() => {
    // DEFAULT LANGUAGE (GERMAN)
    if (isDefault) {
      i18n.changeLanguage('de');
      return;
    }

    // OTHER LANGUAGES
    if (lng && prefixedLngs.includes(lng)) {
      i18n.changeLanguage(lng);
    }
  }, [lng, isDefault]);

  // REDIRECT /de -> /
  if (lng === 'de') {
    return (
      <Navigate
        to={location.pathname.replace('/de', '') || '/'}
        replace
      />
    );
  }

  // INVALID LANGUAGE
  if (!isDefault && (!lng || !prefixedLngs.includes(lng))) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
