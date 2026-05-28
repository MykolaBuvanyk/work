import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { prefixedLngs } from '../../i18n';
import styles from './Breadcrumbs.module.css';
import Link from '../Localized/LocalizedLink';

const formatSegmentLabel = (segment) => {
  if (!segment) return '';
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getArticleLabelKey = (sectionSlug, articleSlug) => (
  sectionSlug && articleSlug
    ? `industries.sections.${sectionSlug}.items.${articleSlug}`
    : ''
);

const Breadcrumbs = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const rawSegments = pathname.split('/').filter(Boolean);

  const hasLanguagePrefix = prefixedLngs.includes(rawSegments[0]);
  const contentSegments = hasLanguagePrefix ? rawSegments.slice(1) : rawSegments;

  if (contentSegments[0] !== 'industries') {
    return null;
  }

  const [, sectionSlug, articleSlug] = contentSegments;
  const crumbs = [
    {
      label: t('Header.nav.home', { defaultValue: 'Home' }),
      href: '/',
    },
    {
      label: t('Header.nav.industries', { defaultValue: 'Industries' }),
      href: '/industries',
    },
  ];

  if (articleSlug) {
    const articleLabelKey = getArticleLabelKey(sectionSlug, articleSlug);
    crumbs.push({
      label: t(articleLabelKey, { defaultValue: formatSegmentLabel(articleSlug) }),
      href: `/industries/${sectionSlug}/${articleSlug}`,
    });
  }

  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <div className={styles.inner}>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <React.Fragment key={`${crumb.href}-${index}`}>
              {isLast ? (
                <span className={styles.current}>{crumb.label}</span>
              ) : (
                <Link className={styles.link} to={crumb.href}>
                  {crumb.label}
                </Link>
              )}
              {!isLast ? <span className={styles.separator}> - </span> : null}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};

export default Breadcrumbs;
