import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { prefixedLngs } from './i18n';

const BASE_URL = 'https://sign-xpert.com';
const DEFAULT_LANGUAGE = 'de';

const localeByLanguage = {
  de: 'de_DE',
  en: 'en_GB',
};

const getLanguagePath = (language, cleanPath) => {
  const suffix = cleanPath === '/' ? '' : cleanPath;
  return language === DEFAULT_LANGUAGE
    ? (suffix || '/')
    : `/${language}${suffix}`;
};

const stripTranslationMarkup = (value) =>
  String(value)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export default function Seo() {
  const { t } = useTranslation();

  const location = useLocation();

  const pathname = location.pathname;
  const pathParts = pathname.split('/').filter(Boolean);

  // визначаємо мову
  const currentLang =
    prefixedLngs.find((lng) =>
      pathParts[0] === lng
    ) || DEFAULT_LANGUAGE;

  const lang = currentLang;

  // прибираємо префікс мови з url
  // /de/catalog -> /catalog
  // /lt -> /
  const rawCleanPath =
    pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') ||
    '/';
  const cleanPath =
    rawCleanPath !== '/' && rawCleanPath.endsWith('/')
      ? rawCleanPath.slice(0, -1)
      : rawCleanPath;

  // page key
  // / -> home
  // /catalog -> catalog
  // /contacts -> contacts
  const page =
    cleanPath === '/'
      ? 'home'
      : cleanPath.split('/').slice(1).join('/');

  // meta
  const title = t(`meta.${page}.title`);
  const description = t(
    `meta.${page}.description`
  );

  // canonical
  const canonicalPath = getLanguagePath(lang, cleanPath);
  const canonicalUrl = `${BASE_URL}${canonicalPath === '/' ? '' : canonicalPath}`;

  // og image
  const imageUrl = `${BASE_URL}/images/images/logo.png`;

  const schemaGraph = [
    {
      '@type': 'Organization',
      '@id': `${BASE_URL}/#organization`,
      name: 'SignXpert',
      url: BASE_URL,
      logo: imageUrl,
      email: 'info@sign-xpert.com',
      telephone: '+49 157 766 25 125',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Baumwiesen 2',
        postalCode: '72401',
        addressLocality: 'Haigerloch',
        addressCountry: 'DE',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE_URL}/#website`,
      url: BASE_URL,
      name: 'SignXpert',
      inLanguage: lang,
      publisher: {
        '@id': `${BASE_URL}/#organization`,
      },
    },
    {
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      inLanguage: lang,
      isPartOf: {
        '@id': `${BASE_URL}/#website`,
      },
      about: {
        '@id': `${BASE_URL}/#organization`,
      },
    },
  ];

  if (page === 'faq') {
    const faqItems = [
      {
        question: 'faq.question_1',
        answers: ['faq.answer_1_1', 'faq.answer_1_2', 'faq.answer_1_3'],
      },
      {
        question: 'faq.question_2',
        answers: ['faq.answer_2_1', 'faq.answer_2_2', 'faq.answer_2_3'],
      },
      {
        question: 'faq.question_3',
        answers: ['faq.answer_3_1', 'faq.answer_3_2', 'faq.answer_3_3'],
      },
    ];

    schemaGraph.push({
      '@type': 'FAQPage',
      '@id': `${canonicalUrl}#faq`,
      mainEntity: faqItems.map(({ question, answers }) => ({
        '@type': 'Question',
        name: stripTranslationMarkup(t(question)),
        acceptedAnswer: {
          '@type': 'Answer',
          text: stripTranslationMarkup(
            answers.map((answerKey) => t(answerKey)).join(' ')
          ),
        },
      })),
    });
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': schemaGraph,
  };

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
      <meta name="robots" content="index,follow,max-image-preview:large" />

      {/* canonical */}
      <link
        rel="canonical"
        href={canonicalUrl}
      />

      {/* hreflang */}
      <link
        rel="alternate"
        hrefLang="de"
        href={`${BASE_URL}${cleanPath === '/' ? '' : cleanPath}`}
      />

      {prefixedLngs.map((hrefLang) => {
        const languagePath = getLanguagePath(hrefLang, cleanPath);

        return (
          <link
            key={hrefLang}
            rel="alternate"
            hrefLang={hrefLang}
            href={`${BASE_URL}${languagePath}`}
          />
        );
      })}

      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${BASE_URL}${cleanPath === '/' ? '' : cleanPath}`}
      />

      {/* open graph */}
      <meta
        property="og:type"
        content="website"
      />

      <meta
        property="og:locale"
        content={localeByLanguage[lang] || `${lang}_${lang.toUpperCase()}`}
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

      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
}
