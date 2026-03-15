import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { prefixedLngs } from '../../i18n';
import styles from './Breadcrumbs.module.css';

const LABELS = {
  home: 'Home',
  'new-project': 'New Project',
  faq: 'FAQ',
  login: 'Registration',
  enter: 'Enter',
  'terms-of-purchasing': 'Terms of Purchasing',
  'privacy-policy': 'Privacy Policy',
  contacts: 'Contacts',
  products: 'Products',
  industries: 'Industries',
  'quick-guide': 'Quick Guide',
  share: 'Share Project',
  account: 'My Account',
  pay: 'Payment',
  setting: 'Settings',
  detail: 'My Details',
  checkout: 'Checkout',
  'order-success': 'Order Success',
  'order-secces': 'Order Success',
  admin: 'Admin',
  'cart-orders': 'Cart Orders',
  'update-avaible': 'Update Available',
  icon: 'Icons',
  'update-baner': 'Update Banner',
};

const HIDDEN_ROOT_SEGMENTS = new Set(['', 'share']);

const formatSegmentLabel = (segment) => {
  if (!segment) return '';
  return LABELS[segment] || segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const Breadcrumbs = () => {
  const { pathname } = useLocation();
  const rawSegments = pathname.split('/').filter(Boolean);

  const hasLanguagePrefix = prefixedLngs.includes(rawSegments[0]);
  const contentSegments = hasLanguagePrefix ? rawSegments.slice(1) : rawSegments;
  const pathPrefix = hasLanguagePrefix ? `/${rawSegments[0]}` : '';

  if (contentSegments.length === 0) {
    const homeHref = `${pathPrefix}/home`;
    return (
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <div className={styles.inner}>
          <Link className={styles.link} to={homeHref}>
            Home
          </Link>
          <span className={styles.separator}> - </span>
          <span className={styles.current}>New Project</span>
        </div>
      </nav>
    );
  }

  if (contentSegments.length === 0 || HIDDEN_ROOT_SEGMENTS.has(contentSegments[0])) {
    return null;
  }

  const crumbs = [];

  if (contentSegments[0] !== 'home') {
    crumbs.push({ label: 'Home', href: '/home' });
  }

  contentSegments.forEach((segment, index) => {
    const href = `${pathPrefix}/${contentSegments.slice(0, index + 1).join('/')}`;
    crumbs.push({
      label: formatSegmentLabel(segment),
      href,
    });
  });

  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <div className={styles.inner}>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <React.Fragment key={`${crumb.href}-${crumb.label}-${index}`}>
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