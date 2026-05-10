import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../Industries.module.css';

const IndustryArticleLayout = ({ articleKey }) => {
  const { t } = useTranslation();
  const title = t(`${articleKey}.title`);
  const html = t(`${articleKey}.html`);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={`${styles.pageTitle} ${styles.articleTitle}`}>{title}</h1>
        <section className={styles.articleContent} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  );
};

export default IndustryArticleLayout;
