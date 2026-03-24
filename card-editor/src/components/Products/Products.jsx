import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './Products.module.css';

const usesItems = [
  {
    title: 'Industry\nand Manufacturing',
    image: '/images/products/use-industry-manufacturing.png',
    alt: 'Industry and manufacturing',
  },
  {
    title: 'Electrical\nInstallations',
    image: '/images/products/use-electrical-installations.png',
    alt: 'Electrical installations',
  },
  {
    title: 'Machinery\nand Equipment labeling',
    image: '/images/products/use-machinery-equipment.png',
    alt: 'Machinery and equipment labeling',
  },
  {
    title: 'Offices\nand Buildings',
    image: '/images/products/use-offices-buildings.png',
    alt: 'Offices and buildings',
  },
  {
    title: 'Technical\nInstallations',
    image: '/images/products/use-technical-installations.png',
    alt: 'Technical installations',
  },
];

const featureItems = [
  {
    title: 'Self-adhesive option with\nstrong 3M tape',
    image: '/images/products/feature-self-adhesive-3m.png',
    alt: 'Self-adhesive option with strong 3M tape',
  },
  {
    title: 'Versatile use for industrial\nand office environments',
    image: '/images/products/feature-versatile-use.png',
    alt: 'Versatile use for industrial and office environments',
  },
  {
    title: 'Fire behavior class B2\n(DIN 4102)',
    image: '/images/products/feature-fire-class-b2.png',
    alt: 'Fire behavior class B2 according to DIN 4102',
  },
  {
    title: 'UV-resistant material\nsuitable for outdoor use',
    image: '/images/products/feature-uv-resistant.png',
    alt: 'UV-resistant material suitable for outdoor use',
  },
  {
    title: 'Large format options: up to\n600 x 295 mm',
    image: '/images/products/feature-large-format.png',
    alt: 'Large format options up to 600 by 295 millimeters',
  },
  {
    title: 'Material thickness\n0.8 mm and 1.6 mm',
    image: '/images/products/feature-material-thickness.png',
    alt: 'Material thickness 0.8 millimeters and 1.6 millimeters',
  },
  {
    title: 'Durable and long-lasting\nengraving',
    image: '/images/products/feature-durable-engraving.png',
    alt: 'Durable and long-lasting engraving',
  },
  {
    title: 'High contrast for excellent\nreadability',
    image: '/images/products/feature-high-contrast.png',
    alt: 'High contrast for excellent readability',
  },
];

const categoryItems = [
  {
    title: 'Electrical Panel Labels',
    className: styles.plateCardRed,
    items: ['electrical panels', 'switchboards', 'control cabinets', 'circuit identification'],
  },
  {
    title: 'Machine Nameplates',
    className: styles.plateCardSilver,
    items: ['machinery identification', 'manufacturer plates', 'technical specification plates', 'equipment labeling'],
  },
  {
    title: 'Warning and Safety Signs',
    className: styles.plateCardYellow,
    items: ['safety warnings', 'hazard identification', 'machine safety labels', 'operational instructions'],
  },
  {
    title: 'Control Panel Labels',
    className: styles.plateCardGreen,
    items: ['button labels', 'switch labels', 'machine control panels', 'operator interface labels'],
  },
  {
    title: 'Serial Number Plates',
    className: styles.plateCardBlack,
    items: ['serial number plates', 'asset tags', 'equipment ID plates', 'inventory labels'],
  },
  {
    title: 'Door and Office Nameplates',
    className: styles.plateCardOrange,
    items: ['office door signs', 'room identification', 'workplace labels'],
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
  useEffect(() => {
    const id = 'inter-font-products';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap';
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
            <h1><span style={{ color: '#006CA4' }}>Custom </span>Engraved Plastic Signs and Nameplates</h1>
          </header>

          <div className={styles.heroGrid}>
            <div className={styles.heroVisual}>
              <img src="/images/products/hero-bg.png" alt="Engraved plastic signs and labels" />
            </div>

            <div className={styles.heroContent}>
              <h2 className={styles.heroAddTitle}>
                At <Link to="/" className={styles.brandHomeLink}>SignXpert </Link>, we produce high-quality engraved plastic signs, nameplates and industrial labels using durable two-layer engraving plastic.
              </h2>
              <p className={styles.heroPara}>Our engraved signs provide clear, permanent and professional identification for machines, electrical installations, offices, buildings and workplaces.</p>
              <p className={styles.heroAddPara}>
                Using precision laser engraving, the top layer of the plastic is engraved to reveal the contrasting color layer underneath. This creates high-contrast markings that remain readable for years, even in demanding industrial environments.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.uses}`}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <h2 className={`${styles.sectionTitle}`}>
              Our engraved plastic signs are widely used in:
            </h2>
          </div>

          <div className={styles.usesGrid}>
            {usesItems.map((item) => (
              <article className={styles.iconCard} key={item.title}>
                <div className={styles.iconCardImage}>
                  <img src={item.image} alt={item.alt} />
                </div>
                <h3>{renderMultiline(item.title)}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.features}`}>
        <div className={styles.container}>
          <div className={`${styles.sectionHeading} ${styles.sectionHeadingLeftText}`}>
            <h2 className={`${styles.sectionTitle} `}>
              <span className={styles.featuresTitleAccent}>Product</span>
              <br />
              Features
            </h2>
            <p className={`${styles.sectionHeadingDescription} ${styles.sectionHeadingDescriptionLeft}`}>
              <strong>
                Our engraved plastic signs are manufactured from high-quality two-layer plastic designed for technical and
                industrial applications.
              </strong>
              <br />
              Because the text is engraved into the material, it will not fade, peel or wear off like printed labels.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            {featureItems.map((item) => (
              <article className={styles.featureCard} key={item.title}>
                <div className={styles.featureCardImage}>
                  <img src={item.image} alt={item.alt} />
                </div>
                <h3>{renderMultiline(item.title)}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.infoBlock} ${styles.infoBlockWide} ${styles.infoBlockPrimary}`}>
        <div className={`${styles.container} ${styles.infoBlockContainerWide}`}>
          <div className={styles.sectionHeading}>
            <h2 className={`${styles.sectionTitle} `}>
              Design Your Engraved <span style={{ color: '#006CA4' }}>Sign Online </span>
            </h2>
          </div>

          <div className={styles.infoBlockGrid}>
            <div className={styles.infoBlockContent}>
              <h3 className={styles.infoBlockContentTitle}>
                <strong>
                  With the SignXpert <a href="#" className={styles.onlineEditorLink}>Online Editor</a>, creating a custom engraved sign is simple and fast.
                </strong>
              </h3>
              <p style={{ color: '#006CA4', fontSize: '18px', fontWeight: 'bold' }}>You can design your sign directly in your browser and see every change instantly.</p>
              <p>Features of our online editor:</p>

              <ul className={styles.bulletList}>
                <li>choose your sign size and layout</li>
                <li>customize text, symbols and colors</li>
                <li>add mounting holes or adhesive backing</li>
                <li>preview your sign in real time</li>
              </ul>

              <p>
                This makes it easy to create professional engraved labels, machine nameplates and technical signs in just a
                few minutes.
              </p>
              <p>
                Signs can also be ordered via phone or email, and our team will help you prepare the design if needed.
              </p>
            </div>

            <aside className={styles.infoBlockBadge}>
              <img src="/images/products/design.jpg" alt="Design your sign by SignXpert" />
            </aside>
          </div>

          <div className={styles.infoBlockCtaWrap}>
            <Link to="/online-sign-editor" className={styles.infoBlockCta}>
              Design Your Sign
            </Link>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.infoBlock} ${styles.infoBlockWide} ${styles.infoBlockSecondary}`}>
        <div className={`${styles.container} ${styles.infoBlockContainerWide}`}>
          <div className={`${styles.infoBlockGrid} ${styles.infoBlockGridReversed}`}>
            <div className={`${styles.infoBlockContent}`}>
                <h2 className={`${styles.sectionTitle} ${styles.infoBlockSecondaryTitle}`}>
                  Custom Production
                  <br />
                  with <span style={{ color: '#006CA4' }}>SignXpert</span>
                </h2>
                <p style={{ fontWeight: 'bold', marginBottom: '20px' }}>
                  At SignXpert, every engraved sign can be customized to your needs.
                </p>
                <p>
                  Whether you need a single sign or large production batches, we provide reliable quality and precise
                  engraving.
                </p>
                <p>
                  You can design your sign directly in our online sign editor, upload your own files or contact us with your
                  requirements.
                </p>
                <p>
                  Our goal is to provide durable, professional and easy-to-order engraved plastic signs for industry and
                  businesses.
                </p>
            </div>

            <aside className={styles.infoBlockBadge}>
              <img src="/images/products/design1.jpg" alt="Custom production by SignXpert" />
            </aside>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.categories}`}>
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <h2 className={`${styles.sectionTitle} `}>
              Our <span style={{ color: '#006CA4' }}>Product Categories</span> and Typical Applications
            </h2>
          </div>

          <div className={styles.categoriesGrid}>
            {categoryItems.map((category) => (
              <article className={`${styles.plateCard} ${category.className}`} key={category.title}>
                <HoleDots />
                <h3>{category.title}</h3>
                <ul>
                  {category.items.map((item) => (
                    <li key={item}>{item}</li>
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