import React, { useEffect, useState, useTransition } from 'react';
import styles from './HomePlaceholder.module.css';
import { useTranslation } from 'react-i18next';
import Link from '../Localized/LocalizedLink';

const heroImages = [
  '/images/home/hero-bg.jpg',
  '/images/home/hero-bg1.jpg',
  '/images/home/hero-bg2.jpg',
  '/images/home/hero-bg3.jpg',
  '/images/home/hero-bg4.jpg',
];

const HomePlaceholder = () => {
  const [activeHeroImage, setActiveHeroImage] = useState(0);
  const [isVolumeDiscountModalOpen, setIsVolumeDiscountModalOpen] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveHeroImage((currentImage) => (currentImage + 1) % heroImages.length);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!isVolumeDiscountModalOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsVolumeDiscountModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVolumeDiscountModalOpen]);

  const {t}=useTranslation();

  return (
    <main className={styles.page}>
      <section style={{padding:0}} className={styles.topTitleSection}>
        <div className={styles.container}>
          <h1 className={styles.topTitle}>
            {t("HomePlaceholder.h_1")} <span> {t("HomePlaceholder.h_2")}</span>
          </h1>
        </div>
      </section>

      <section className={styles.heroSection}>
        <div className={styles.heroBackgrounds} aria-hidden="true">
          {heroImages.map((image, index) => (
            <div
              key={image}
              className={`${styles.heroBackground} ${
                index === activeHeroImage ? styles.heroBackgroundActive : ''
              }`}
              style={{ backgroundImage: `url(${image})` }}
            />
          ))}
        </div>

        <div className={styles.heroOverlay} />

        <div className={`${styles.container} ${styles.heroContainer}`}>
          <div className={styles.heroText}>
            <h2 className={styles.heroTitle}>
              <span className={styles.brandBlue}>SignXpert</span>  {t("HomePlaceholder.h_3")}
              <br />
               {t("HomePlaceholder.h_4")}
            </h2>

            <p className={styles.heroDescription}>
               {t("HomePlaceholder.h_5")}
            </p>

            <Link to="/online-sign-editor" className={styles.heroButton}>
               {t("HomePlaceholder.h_6")}
            </Link>

            <p className={styles.heroNote}> {t("HomePlaceholder.h_7")}</p>
          </div>
        </div>
      </section>

      <section className={styles.whySection}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.center}`}>
             {t("HomePlaceholder.h_8")} <span className={styles.brandBlue}>SignXpert</span>
          </h2>

          <div className={styles.whyGrid}>
            <article className={styles.whyCard}>
              <div className={styles.whyCardContent}>
                <h3> {t("HomePlaceholder.h_9")}</h3>

                <p className={styles.accentText}>
                   {t("HomePlaceholder.h_10")}
                </p>

                <p>
                  {t("HomePlaceholder.h_11")}
                </p>
              </div>

              <img src="/images/home/fair-pricing.jpg" alt="Fair pricing and industrial quality" />
            </article>

            <article className={styles.whyCard}>
              <div className={styles.whyCardContent}>
                <h3> {t("HomePlaceholder.h_12")}</h3>

                <p className={styles.accentText}> {t("HomePlaceholder.h_13")}</p>

                <p>
                   {t("HomePlaceholder.h_14")}
                </p>

                <p className={styles.readMore}>
                  <em>
                    {t("HomePlaceholder.h_15")}{' '}
                    <button
                      type="button"
                      className={styles.readMoreButton}
                      onClick={() => setIsVolumeDiscountModalOpen(true)}
                    >
                       {t("HomePlaceholder.h_16")}
                    </button>
                  </em>
                </p>
              </div>

              <img src="/images/home/volume-discounts.jpg" alt="Volume discounts" />
            </article>
          </div>
        </div>
      </section>

      {isVolumeDiscountModalOpen && (
        <div
          className={styles.volumeDiscountBackdrop}
          onClick={() => setIsVolumeDiscountModalOpen(false)}
        />
      )}
      {isVolumeDiscountModalOpen && (
        <div
          className={styles.volumeDiscountModal}
          role="dialog"
          aria-modal="false"
          aria-labelledby="volume-discount-title"
        >
          <button
            type="button"
            className={styles.volumeDiscountClose}
            onClick={() => setIsVolumeDiscountModalOpen(false)}
            aria-label="Close volume discounts"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12.0008 12.0001L14.8292 14.8285M9.17236 14.8285L12.0008 12.0001L9.17236 14.8285ZM14.8292 9.17163L12.0008 12.0001L14.8292 9.17163ZM12.0008 12.0001L9.17236 9.17163L12.0008 12.0001Z"
                stroke="#006CA4"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="#006CA4"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <h2 id="volume-discount-title"> {t("HomePlaceholder.h_17")}</h2>

          <div className={styles.volumeDiscountContent}>
            <p>
              <strong>
                 {t("HomePlaceholder.h_18")}
              </strong>
            </p>
            <p> {t("HomePlaceholder.h_19")}</p>
            <p>
               {t("HomePlaceholder.h_20")}
            </p>

            <div className={styles.volumeDiscountList}>
              <p> {t("HomePlaceholder.h_21")}</p>
              <p> {t("HomePlaceholder.h_22")}</p>
              <p> {t("HomePlaceholder.h_23")}</p>
              <p> {t("HomePlaceholder.h_24")}</p>
              <p> {t("HomePlaceholder.h_25")}</p>
              <p> {t("HomePlaceholder.h_26")}</p>
            </div>

            <p className={styles.volumeDiscountNote}>
              <strong>
                 {t("HomePlaceholder.h_27")}
              </strong>
            </p>
          </div>
        </div>
      )}

      <section className={styles.customSection}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.center} ${styles.customTitle}`}>
             {t("HomePlaceholder.h_28")} <span className={styles.highlightYellow}> {t("HomePlaceholder.h_29")}</span>  {t("HomePlaceholder.h_30")}
          </h2>

          <div className={styles.equalGrid}>
            <div className={`${styles.textBox} ${styles.customTextBox}`}>
              <h3 className={styles.customHeading}>
                 {t("HomePlaceholder.h_31")}{' '}
                <span className={styles.brandBlue}>SignXpert</span>
              </h3>

              <p>
                {t("HomePlaceholder.h_32")} <Link to="/online-sign-editor"> {t("HomePlaceholder.h_33")}</Link>  {t("HomePlaceholder.h_34")}
              </p>

              <ul>
                <li> {t("HomePlaceholder.h_35")}</li>
                <li> {t("HomePlaceholder.h_36")}</li>
                <li> {t("HomePlaceholder.h_37")}</li>
                <li> {t("HomePlaceholder.h_38")}</li>
              </ul>
              <p style={{ color: '#006ca4' }}> {t("HomePlaceholder.h_39")}</p>
              <p>
                 {t("HomePlaceholder.h_40")}
              </p>
            </div>

            <div className={styles.photoBox}>
              <img src="/images/home/custom-signs.jpg" alt="Custom engraved signs editor" />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.fastSection}>
        <div className={styles.container}>
          <div className={styles.equalGrid}>
            <div className={styles.photoBox}>
              <img src="/images/home/fast-production.jpg" alt="Fast production and delivery" />
            </div>

            <div className={`${styles.textBox} ${styles.sideTextBox}`}>
              <h2 className={styles.sideTitle}>
                <span className={styles.brandBlue}> {t("HomePlaceholder.h_41")}</span>  {t("HomePlaceholder.h_42")}
              </h2>

              <p>
                <strong> {t("HomePlaceholder.h_43")}</strong>  {t("HomePlaceholder.h_44")}
              </p>

              <ul>
                <li>
                  <span className={styles.brandBlue}> {t("HomePlaceholder.h_45")}</span>
                </li>
                <li> {t("HomePlaceholder.h_46")}</li>
                <li> {t("HomePlaceholder.h_47")}</li>
              </ul>

              <p>
                 {t("HomePlaceholder.h_48")}
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
                <span className={styles.brandBlue}> {t("HomePlaceholder.h_49")}</span>  {t("HomePlaceholder.h_50")}
              </h2>

              <p>
                <strong>
                   {t("HomePlaceholder.h_51")}
                </strong>
              </p>

              <p>
                 {t("HomePlaceholder.h_52")}
              </p>
            </div>

            <div className={styles.photoBox}>
              <img src="/images/home/durable-signs.jpg" alt="Durable engraved plastic signs" />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.benefitsSection}>
        <div className={styles.container}>
          <h2 className={`${styles.sectionTitle} ${styles.center}`}>
             {t("HomePlaceholder.h_53")} <span className={styles.brandBlue}>SignXpert</span>
          </h2>

          <div className={styles.benefitsGrid}>
            <article className={styles.benefitCard}>
              <img
                src="/images/home/icon-custom-production.png"
                alt="Custom production from 1 piece"
              />
              <h3> {t("HomePlaceholder.h_54")}</h3>
            </article>

            <article className={styles.benefitCard}>
              <img
                src="/images/home/icon-industry-solutions.png"
                alt="Professional solutions for industry and business"
              />
              <h3> {t("HomePlaceholder.h_55")}</h3>
            </article>

            <article className={styles.benefitCard}>
              <img
                src="/images/home/icon-laser-engraved.png"
                alt="Precision laser engraved signs"
              />
              <h3> {t("HomePlaceholder.h_56")}</h3>
            </article>

            <article className={styles.benefitCard}>
              <img src="/images/home/icon-adhesive-sign.png" alt="Self-adhesive signs" />
              <h3> {t("HomePlaceholder.h_57")}</h3>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePlaceholder;
