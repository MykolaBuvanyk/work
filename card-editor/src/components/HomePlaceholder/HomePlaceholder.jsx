import React from 'react';
import styles from './HomePlaceholder.module.css';

const HomePlaceholder = () => {
  return (
    <main className={styles.page}>
      <section className={styles.topTitleSection}>
        <div className={styles.container}>
          <h1 className={styles.topTitle}>
            From design to delivery - your sign <span>in 24 hours!</span>
          </h1>
        </div>
      </section>

      <section className={styles.heroSection}>
        <div className={styles.heroOverlay} />

        <div className={`${styles.container} ${styles.heroContainer}`}>
          <div className={styles.heroText}>
            <h2 className={styles.heroTitle}>
              <span className={styles.brandBlue}>SignXpert</span> - Expert-Level
              <br />
              Industrial Marking
            </h2>

            <p className={styles.heroDescription}>
              We produce durable engraved signs and nameplates from high-quality
              plastic for Industry, energy, and business sectors.
            </p>

            <a
              href="https://sign-xpert.com/"
              className={styles.heroButton}
              target="_blank"
              rel="noopener noreferrer"
            >
              Design Your Sign
            </a>

            <p className={styles.heroNote}>Order before 16:00 for same-day dispatch</p>
          </div>
        </div>
      </section>

      <section className={styles.whySection}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.center}`}>
            Why Choose <span className={styles.brandBlue}>SignXpert</span>
          </h2>

          <div className={styles.whyGrid}>
            <article className={styles.whyCard}>
              <div className={styles.whyCardContent}>
                <h3>Fair Pricing. Industrial Quality.</h3>

                <p className={styles.accentText}>
                  In today&apos;s market, we know that budget matters.
                </p>

                <p>
                  SignXpert provides high-quality signs and fast production at
                  competitive rates - professional results without overpaying.
                </p>
              </div>

              <img
                src="/images/home/fair-pricing.jpg"
                alt="Fair pricing and industrial quality"
              />
            </article>

            <article className={styles.whyCard}>
              <div className={styles.whyCardContent}>
                <h3>Volume Discounts</h3>

                <p className={styles.accentText}>
                  The more you order, the lower the price.
                </p>

                <p>
                  Our transparent discount system automatically reduces costs as
                  your volume grows - the smart way to save.
                </p>

                <p className={styles.readMore}>
                  <em>
                    *Read more <a href="#">here</a>
                  </em>
                </p>
              </div>

              <img src="/images/home/volume-discounts.jpg" alt="Volume discounts" />
            </article>
          </div>
        </div>
      </section>

      <section className={styles.customSection}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.center} ${styles.customTitle}`}>
            Custom Engraved <span className={styles.highlightYellow}>Signs</span> Made
            Easy
          </h2>

          <div className={styles.equalGrid}>
            <div className={`${styles.textBox} ${styles.customTextBox}`}>
              <h3 className={styles.customHeading}>
                Design professional engraved plastic signs, labels and nameplates in
                minutes with <span className={styles.brandBlue}>SignXpert</span>
              </h3>

              <p>
                Using our easy{' '}
                <a
                  href="https://sign-xpert.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  online sign editor
                </a>
                , you can create fully customized signs for:
              </p>

              <ul>
                <li>Machines</li>
                <li>Electrical panels</li>
                <li>Technical installations</li>
                <li>Offices</li>
                <li>- exactly the way you need them.</li>
              </ul>

              <p>
                Whether you need one sign or a large batch, SignXpert delivers
                reliable quality and fast production.
              </p>
            </div>

            <div className={styles.photoBox}>
              <img
                src="/images/home/custom-signs.jpg"
                alt="Custom engraved signs editor"
              />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.fastSection}>
        <div className={styles.container}>
          <div className={styles.equalGrid}>
            <div className={styles.photoBox}>
              <img
                src="/images/home/fast-production.jpg"
                alt="Fast production and delivery"
              />
            </div>

            <div className={`${styles.textBox} ${styles.sideTextBox}`}>
              <h2 className={styles.sideTitle}>
                <span className={styles.brandBlue}>Fast</span> Production and Delivery
              </h2>

              <p>
                <strong>At SignXpert,</strong> we combine modern production technology
                with an efficient online ordering system to provide fast delivery.
              </p>

              <ul>
                <li>
                  <span className={styles.brandBlue}>
                    Order before 16:00 for same-day dispatch
                  </span>
                </li>
                <li>reliable shipping across Germany and Europe</li>
                <li>fast response and customer support</li>
              </ul>

              <p>
                This allows businesses and professionals to receive their custom
                engraved signs quickly and reliably.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.durableSection}>
        <div className={styles.container}>
          <div className={styles.equalGrid}>
            <div className={`${styles.textBox} ${styles.sideTextBox}`}>
              <h2 className={styles.sideTitle}>
                <span className={styles.brandBlue}>Durable</span> Engraved Plastic Signs
              </h2>

              <p>
                <strong>
                  All SignXpert products are manufactured from high-quality two-layer
                  engraving plastic.
                </strong>
              </p>

              <p>
                During laser engraving, the top layer is engraved to reveal the
                contrasting color underneath. This ensures permanent, high-contrast
                markings that remain readable for years.
              </p>
            </div>

            <div className={styles.photoBox}>
              <img
                src="/images/home/durable-signs.jpg"
                alt="Durable engraved plastic signs"
              />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.benefitsSection}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.center}`}>
            Your Benefits with <span className={styles.brandBlue}>SignXpert</span>
          </h2>

          <div className={styles.benefitsGrid}>
            <article className={styles.benefitCard}>
              <img
                src="/images/home/icon-custom-production.png"
                alt="Custom production from 1 piece"
              />
              <h3>Custom production from 1 Piece</h3>
            </article>

            <article className={styles.benefitCard}>
              <img
                src="/images/home/icon-industry-solutions.png"
                alt="Professional solutions for industry and business"
              />
              <h3>Professional solutions for Industry and Business</h3>
            </article>

            <article className={styles.benefitCard}>
              <img
                src="/images/home/icon-laser-engraved.png"
                alt="Precision laser engraved signs"
              />
              <h3>Precision laser engraved signs</h3>
            </article>

            <article className={styles.benefitCard}>
              <img
                src="/images/home/icon-adhesive-sign.png"
                alt="Self-adhesive signs"
              />
              <h3>Self-Adhesive signs</h3>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePlaceholder;