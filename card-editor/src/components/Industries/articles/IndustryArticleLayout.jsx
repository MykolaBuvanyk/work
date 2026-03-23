import React from 'react';
import styles from '../Industries.module.css';

const IndustryArticleLayout = ({ title, html }) => {
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
