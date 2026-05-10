import React, { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import styles from './FAQ.module.scss'

const Chevron = () => (
  <svg
    className={styles.chevron}
    width="20"
    height="20"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" fill="currentColor" />
  </svg>
)

export default function FAQ({ title = 'FAQ', items = [] }) {
  const { t } = useTranslation()

  return (
    <section className={styles.faq} aria-labelledby="faq-title">
      <h2 id="faq-title" className={styles.title}>
        {t(title, { defaultValue: title })}
      </h2>
      <div className={styles.items}>
        {items.map((it, i) => (
          <FaqItem key={i} question={it.question} answer={it.answer} />
        ))}
      </div>
    </section>
  )
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  return (
    <div className={styles.item}>
      <button
        className={styles.question}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <Chevron />
        <span className={styles.qtext}>{t(question, { defaultValue: question })}</span>
      </button>

      <div className={`${styles.answer} ${open ? styles.open : ''}`} role="region">
        <div className={styles.answerRow}>
          <div className={styles.marker} aria-hidden>
            <span className={styles.outer}>
              <span className={styles.inner} />
            </span>
          </div>
          <div className={styles.answercopy}>{renderAnswer(answer, t)}</div>
        </div>
      </div>
    </div>
  )
}

const linkComponents = {
  home: <Link to="/" />,
  quickGuide: <Link to="/quick-guide" />,
  contacts: <Link to="/contacts" />,
  account: <Link to="/account" />,
  login: <Link to="/login" />,
  email: <a href="mailto:info@sign-xpert.com" />,
}

function renderAnswer(answer, t) {
  if (!Array.isArray(answer)) {
    return answer
  }

  return answer.map((block, index) => <Fragment key={index}>{renderBlock(block, t)}</Fragment>)
}

function renderBlock(block, t) {
  if (block.type === 'list') {
    return (
      <ul>
        {block.items.map((item, index) => (
          <li key={index}>{renderTranslatedText(item, t)}</li>
        ))}
      </ul>
    )
  }

  return <p>{renderTranslatedText(block, t)}</p>
}

function renderTranslatedText(block, t) {
  const textKey = typeof block === 'string' ? block : block.text
  const links = typeof block === 'string' ? [] : block.links || []

  if (!links.length) {
    return t(textKey)
  }

  return <Trans i18nKey={textKey} components={buildLinkComponents(links)} />
}

function buildLinkComponents(links) {
  return links.reduce((components, name) => {
    components[name] = React.cloneElement(linkComponents[name], { key: name })
    return components
  }, {})
}
