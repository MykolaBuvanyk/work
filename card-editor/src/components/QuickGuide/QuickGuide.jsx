import React from 'react';
import { useTranslation } from 'react-i18next';
import Link from '../Localized/LocalizedLink';
import './QuickGuide.scss';

const provideItems = [
  ['d_2', 'd_3', 'd_4'],
  ['d_5', 'd_6', 'd_7'],
  ['d_8', 'd_9', 'd_10'],
];

const startSteps = [
  ['user', 'QuickGuide.start.register'],
  ['sign', 'QuickGuide.start.create'],
  ['save', 'QuickGuide.start.save'],
  ['cart', 'QuickGuide.start.cart'],
];

const editorSteps = [
  'shape',
  'size',
  'thickness',
  'color',
  'elements',
  'holes',
];

const sideNotes = ['duplicates', 'copy', 'manage', 'accessories', 'navigate'];
const topNotes = ['plastic', 'templates', 'price'];
const bottomNotes = ['requests', 'thumbnails', 'elements', 'properties'];

const CheckIcon = () => (
  <svg className="quick-guide-check" width="31" height="23" viewBox="0 0 31 23" aria-hidden="true">
    <path d="M1.8 9.5 10.8 18.8 28.8 1.8" fill="none" stroke="currentColor" strokeWidth="5" />
  </svg>
);

const ArrowIcon = ({ className }) => (
  <img className={`quick-guide-arrow ${className}`} src="/images/quick-guide/arrow.png" alt="" aria-hidden="true" />
);

const StepNumber = ({ number }) => (
  <span className="quick-guide-step-number" aria-label={`${number}`}>
    {number}
  </span>
);

const QuickGuide = () => {
  const { t } = useTranslation();

  return (
    <main className="quick-guide-container">
      <section className="quick-guide-provide">
        <h1>{t('QuickGuide.d_1')}</h1>

        <div className="quick-guide-provide-row">
          {provideItems.map(([accent, text, badge]) => (
            <div className="quick-guide-provide-item" key={accent}>
              <CheckIcon />
              <span className="quick-guide-provide-accent">{t(`QuickGuide.${accent}`)}</span>
              <span>{t(`QuickGuide.${text}`)}</span>
              <strong>{t(`QuickGuide.${badge}`)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="quick-guide-start">
        <h2>{t('QuickGuide.start.title')}</h2>

        <div className="quick-guide-start-flow">
          {startSteps.map(([icon, label], index) => (
            <React.Fragment key={icon}>
              <div className={`quick-guide-start-step quick-guide-start-step-${index + 1}`}>
                <div className={`quick-guide-start-icon quick-guide-start-icon-${icon}`} aria-hidden="true" />
                <p>{t(label)}</p>
              </div>
              {index < startSteps.length - 1 && <ArrowIcon className={`quick-guide-arrow-${index + 1}`} />}
            </React.Fragment>
          ))}
        </div>
      </section>

      <section className="quick-guide-editor">
        <h2>{t('QuickGuide.d_11')}</h2>

        <div className="quick-guide-editor-grid">
          <aside className="quick-guide-left-instructions">
            <h3>{t('QuickGuide.editor.choose')}</h3>

            {editorSteps.map((step, index) => (
              <div className="quick-guide-instruction" key={step}>
                <StepNumber number={index + 1} />
                <p>{t(`QuickGuide.editor.steps.${step}`)}</p>
              </div>
            ))}

            {sideNotes.map((note, index) => (
              <div className={`quick-guide-side-note quick-guide-side-note-${index + 1}`} key={note}>
                <p>{t(`QuickGuide.editor.sideNotes.${note}`)}</p>
                <span />
              </div>
            ))}
          </aside>

          <div className="quick-guide-editor-wrap">
            {topNotes.map((note, index) => (
              <div className={`quick-guide-top-note quick-guide-top-note-${index + 1}`} key={note}>
                <p>{t(`QuickGuide.editor.topNotes.${note}`)}</p>
                <span />
              </div>
            ))}

            <img
              className="quick-guide-editor-image"
              src="/images/quick-guide/editor-image.svg"
              alt={t('QuickGuide.editor.imageAlt')}
            />

            {bottomNotes.map((note, index) => (
              <div className={`quick-guide-bottom-note quick-guide-bottom-note-${index + 1}`} key={note}>
                <span />
                <p>{t(`QuickGuide.editor.bottomNotes.${note}`)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="quick-guide-buttons">
          <Link to="/online-sign-editor">{t('QuickGuide.d_12')}</Link>
          <Link to="/contacts">{t('QuickGuide.d_13')}</Link>
        </div>
      </section>
    </main>
  );
};

export default QuickGuide;
