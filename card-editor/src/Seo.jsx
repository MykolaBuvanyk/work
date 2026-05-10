import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { prefixedLngs } from './i18n';

const BASE_URL = 'https://sign-xpert.com';

export default function Seo() {
  const { t } = useTranslation();

  const location = useLocation();

  const pathname = location.pathname;

  // визначаємо мову
  const currentLang =
    prefixedLngs.find((lng) =>
      pathname.startsWith(lng)
    ) || '/en';

  const lang = currentLang.replace('/', '');

  // прибираємо префікс мови з url
  // /de/catalog -> /catalog
  // /lt -> /
  const cleanPath =
    pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') ||
    '/';

  // page key
  // / -> home
  // /catalog -> catalog
  // /contacts -> contacts
  const page =
    cleanPath === '/'
      ? 'home'
      : cleanPath.split('/')[1];

  // meta
  const title = t(`meta.${page}.title`);
  const description = t(
    `meta.${page}.description`
  );

  // canonical
  const canonicalUrl = `${BASE_URL}${pathname}`;

  // og image
  const imageUrl = `${BASE_URL}/images/images/logo.png`;

  return (
    <Helmet>
      {/* base */}
      <html lang={lang} />

      <meta charSet="UTF-8" />

      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
      />

      <title>{title}</title>

      <meta
        name="description"
        content={description}
      />

      {/* canonical */}
      <link
        rel="canonical"
        href={canonicalUrl}
      />

      {/* hreflang */}
      {prefixedLngs.map((lngPrefix) => {
        const hrefLang = lngPrefix.replace(
          '/',
          ''
        );

        return (
          <link
            key={hrefLang}
            rel="alternate"
            hrefLang={hrefLang}
            href={`${BASE_URL}${lngPrefix}${cleanPath}`}
          />
        );
      })}

      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${BASE_URL}${cleanPath}`}
      />

      {/* open graph */}
      <meta
        property="og:type"
        content="website"
      />

      <meta
        property="og:locale"
        content={lang}
      />

      <meta
        property="og:title"
        content={title}
      />

      <meta
        property="og:description"
        content={description}
      />

      <meta
        property="og:url"
        content={canonicalUrl}
      />

      <meta
        property="og:image"
        content={imageUrl}
      />

      {/* twitter */}
      <meta
        name="twitter:card"
        content="summary_large_image"
      />

      <meta
        name="twitter:title"
        content={title}
      />

      <meta
        name="twitter:description"
        content={description}
      />

      <meta
        name="twitter:image"
        content={imageUrl}
      />
    </Helmet>
  );
}