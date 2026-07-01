import React, { useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import styles from './Products.module.css';
import Link from '../Localized/LocalizedLink';

const usesItems = [
  {
    title: 'products.uses.industry.title',
    image: '/images/products/use-industry-manufacturing.png',
    alt: 'products.uses.industry.alt',
  },
  {
    title: 'products.uses.electrical.title',
    image: '/images/products/use-electrical-installations.png',
    alt: 'products.uses.electrical.alt',
  },
  {
    title: 'products.uses.machinery.title',
    image: '/images/products/use-machinery-equipment.png',
    alt: 'products.uses.machinery.alt',
  },
  {
    title: 'products.uses.offices.title',
    image: '/images/products/use-offices-buildings.png',
    alt: 'products.uses.offices.alt',
  },
  {
    title: 'products.uses.technical.title',
    image: '/images/products/use-technical-installations.png',
    alt: 'products.uses.technical.alt',
  },
];

const featureItems = [
  {
    title: 'products.features.selfAdhesive.title',
    image: '/images/products/feature-self-adhesive-3m.png',
    alt: 'products.features.selfAdhesive.alt',
  },
  {
    title: 'products.features.versatile.title',
    image: '/images/products/feature-versatile-use.png',
    alt: 'products.features.versatile.alt',
  },
  {
    title: 'products.features.fireClass.title',
    image: '/images/products/feature-fire-class-b2.png',
    alt: 'products.features.fireClass.alt',
  },
  {
    title: 'products.features.uvResistant.title',
    image: '/images/products/feature-uv-resistant.png',
    alt: 'products.features.uvResistant.alt',
  },
  {
    title: 'products.features.largeFormat.title',
    image: '/images/products/feature-large-format.png',
    alt: 'products.features.largeFormat.alt',
  },
  {
    title: 'products.features.thickness.title',
    image: '/images/products/feature-material-thickness.png',
    alt: 'products.features.thickness.alt',
  },
  {
    title: 'products.features.durable.title',
    image: '/images/products/feature-durable-engraving.png',
    alt: 'products.features.durable.alt',
  },
  {
    title: 'products.features.contrast.title',
    image: '/images/products/feature-high-contrast.png',
    alt: 'products.features.contrast.alt',
  },
];

const categoryItems = [
  {
    title: 'products.categories.electricalPanel.title',
    className: styles.plateCardRed,
    items: [
      'products.categories.electricalPanel.item_1',
      'products.categories.electricalPanel.item_2',
      'products.categories.electricalPanel.item_3',
      'products.categories.electricalPanel.item_4',
    ],
  },
  {
    title: 'products.categories.machineNameplates.title',
    className: styles.plateCardSilver,
    items: [
      'products.categories.machineNameplates.item_1',
      'products.categories.machineNameplates.item_2',
      'products.categories.machineNameplates.item_3',
      'products.categories.machineNameplates.item_4',
    ],
  },
  {
    title: 'products.categories.warningSafety.title',
    className: styles.plateCardYellow,
    items: [
      'products.categories.warningSafety.item_1',
      'products.categories.warningSafety.item_2',
      'products.categories.warningSafety.item_3',
      'products.categories.warningSafety.item_4',
    ],
  },
  {
    title: 'products.categories.controlPanel.title',
    className: styles.plateCardGreen,
    items: [
      'products.categories.controlPanel.item_1',
      'products.categories.controlPanel.item_2',
      'products.categories.controlPanel.item_3',
      'products.categories.controlPanel.item_4',
    ],
  },
  {
    title: 'products.categories.serialNumber.title',
    className: styles.plateCardBlack,
    items: [
      'products.categories.serialNumber.item_1',
      'products.categories.serialNumber.item_2',
      'products.categories.serialNumber.item_3',
      'products.categories.serialNumber.item_4',
    ],
  },
  {
    title: 'products.categories.doorOffice.title',
    className: styles.plateCardOrange,
    items: [
      'products.categories.doorOffice.item_1',
      'products.categories.doorOffice.item_2',
      'products.categories.doorOffice.item_3',
      'products.categories.doorOffice.item_4',
      'products.categories.doorOffice.item_5',
    ],
  },
];

const renderMultiline = (text) =>
  String(text)
    .split('\n')
    .map((line, index, arr) => (
      <React.Fragment key={`${line}-${index}`}>
        {line}
        {index < arr.length - 1 ? <br /> : null}
      </React.Fragment>
    ));

const HoleDots = () => (
  <>
    <span className={`${styles.plateCardHole} ${styles.plateCardHoleTl}`} />
    <span className={`${styles.plateCardHole} ${styles.plateCardHoleTr}`} />
    <span className={`${styles.plateCardHole} ${styles.plateCardHoleBl}`} />
    <span className={`${styles.plateCardHole} ${styles.plateCardHoleBr}`} />
  </>
);

const Products = () => {
  const { t } = useTranslation();

  useEffect(() => {
    const id = 'inter-font-products';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap';
      document.head.appendChild(link);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.parentNode.removeChild(el);
    };
  }, []);

  return (
    <main className={styles.page} style={{ fontFamily: 'Inter, sans-serif' }}>
      <section className={`${styles.hero} ${styles.section}`}>
        <div className={styles.container}>
          <header className={`${styles.sectionHeading} ${styles.sectionHeadingHero}`}>
            <h1>
              <Trans
                i18nKey="products.hero.title"
                components={{ accent: <span style={{ color: '#006CA4' }} /> }}
              />
            </h1>
          </header>

          <div className={styles.heroGrid}>
            <div className={styles.heroVisual}>
              <img src="/images/products/cat.JPG" alt={t('products.hero.imageAlt')} />
            </div>

            <div className={styles.heroContent}>
              <h2 className={styles.heroAddTitle}>
                <Trans
                  i18nKey="products.hero.intro"
                  components={{ home: <Link to="/" className={styles.brandHomeLink} /> }}
                />
              </h2>
              <p className={styles.heroPara}>
                {t('products.hero.description')}
              </p>
              <p className={styles.heroAddPara}>{t('products.hero.details')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.uses}`}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <h2 className={`${styles.sectionTitle}`}>
              {t('products.uses.title')}
            </h2>
          </div>

          <div className={styles.usesGrid}>
            {usesItems.map((item) => (
              <article className={styles.iconCard} key={item.title}>
                <div className={styles.iconCardImage}>
                  <img src={item.image} alt={t(item.alt)} />
                </div>
                <h3>{renderMultiline(t(item.title))}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.features}`}>
        <div className={styles.container}>
          <div className={`${styles.sectionHeading} ${styles.sectionHeadingLeftText}`}>
            <h2 className={`${styles.sectionTitle} `}>
              <Trans
                i18nKey="products.features.title"
                components={{ accent: <span className={styles.featuresTitleAccent} /> }}
              />
            </h2>
            <p
              className={`${styles.sectionHeadingDescription} ${styles.sectionHeadingDescriptionLeft}`}
            >
              <strong>{t('products.features.descriptionStrong')}</strong>
              <br />
              {t('products.features.description')}
            </p>
          </div>

          <div className={styles.featuresGrid}>
            {featureItems.map((item) => (
              <article className={styles.featureCard} key={item.title}>
                <div className={styles.featureCardImage}>
                  <img src={item.image} alt={t(item.alt)} />
                </div>
                <h3>{renderMultiline(t(item.title))}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.infoBlock} ${styles.infoBlockWide} ${styles.infoBlockPrimary}`}
      >
        <div className={`${styles.container} ${styles.infoBlockContainerWide}`}>
          <div className={styles.sectionHeading}>
            <h2 className={`${styles.sectionTitle} `}>
              <Trans
                i18nKey="products.design.title"
                components={{ accent: <span style={{ color: '#006CA4' }} /> }}
              />
            </h2>
          </div>

          <div className={styles.infoBlockGrid}>
            <div className={styles.infoBlockContent}>
              <h3 className={styles.infoBlockContentTitle}>
                <strong>
                  <Trans
                    i18nKey="products.design.intro"
                    components={{
                      editor: (
                        <Link
                          to="/online-sign-editor"
                          className={styles.onlineEditorLink}
                          style={{ fontWeight: 'black' }}
                        />
                      ),
                    }}
                  />
                </strong>
              </h3>
              <p
                className={styles.infoBlockHighlight}
                style={{ color: '#006CA4', fontSize: '18px', fontWeight: 'bold' }}
              >
                {t('products.design.highlight')}
              </p>
              <p>{t('products.design.listTitle')}</p>

              <ul className={styles.bulletList}>
              {[
                'products.design.item_1',
                'products.design.item_2',
                'products.design.item_3',
                'products.design.item_4',
              ].map((key) => {
                const text = t(key);
                const [title, ...rest] = text.split(' — ');

                return (
                  <li key={key}>
                    {title}

                    {rest.length > 0 && (
                      <>
                        {' - '}
                        <span>{rest.join(' - ')}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>

              <p>{t('products.design.summary')}</p>
              <p>{t('products.design.support')}</p>
            </div>

            <aside className={styles.infoBlockBadge}>
              <img src="/images/products/design.jpg" alt={t('products.design.imageAlt')} />
            </aside>
          </div>

          <div className={styles.infoBlockCtaWrap}>
            <Link to="/online-sign-editor" className={styles.infoBlockCta}>
              {t('products.design.cta')}
            </Link>
          </div>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.infoBlock} ${styles.infoBlockWide} ${styles.infoBlockSecondary}`}
      >
        <div className={`${styles.container} ${styles.infoBlockContainerWide}`}>
          <div className={`${styles.infoBlockGrid} ${styles.infoBlockGridReversed}`}>
            <div className={`${styles.infoBlockContent}`}>
              <h2 className={`${styles.sectionTitle} ${styles.infoBlockSecondaryTitle}`}>
                {t('products.production.titleLine_1')}
                <br />
                <Trans
                  i18nKey="products.production.titleLine_2"
                  components={{ home: <Link to="/" className={styles.brandHomeLink} /> }}
                />
              </h2>
              <p style={{ fontWeight: 'bold', marginBottom: '20px' }}>
                {t('products.production.lead')}
              </p>
              <p>{t('products.production.description_1')}</p>
              <p>{t('products.production.description_2')}</p>
              <p>{t('products.production.description_3')}</p>
            </div>

            <aside className={styles.infoBlockBadge}>
              <img src="/images/products/cat.JPG" alt={t('products.production.imageAlt')} />
            </aside>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.categories}`}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <h2 className={`${styles.sectionTitle} `}>
              <Trans
                i18nKey="products.categories.title"
                components={{ accent: <span style={{ color: '#006CA4' }} /> }}
              />
            </h2>
          </div>

          <div className={styles.categoriesGrid}>
            {categoryItems.map((category) => (
              <article className={`${styles.plateCard} ${category.className}`} key={category.title}>
                <HoleDots />
                <h3>{t(category.title)}</h3>
                <ul>
                  {category.items.map((item) => (
                    <li key={item}>{t(item)}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Products;
