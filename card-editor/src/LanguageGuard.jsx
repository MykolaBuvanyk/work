import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import i18n, { prefixedLngs } from './i18n';

export default function LanguageGuard({ isDefault }) {
  const { lng } = useParams();
  const location = useLocation();

  useEffect(() => {
    // DEFAULT LANGUAGE (ENGLISH)
    if (isDefault) {
      i18n.changeLanguage('en');
      return;
    }

    // OTHER LANGUAGES
    if (lng && prefixedLngs.includes(lng)) {
      i18n.changeLanguage(lng);
    }
  }, [lng, isDefault]);

  // REDIRECT /en -> /
  if (lng === 'en') {
    return (
      <Navigate
        to={location.pathname.replace('/en', '') || '/'}
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