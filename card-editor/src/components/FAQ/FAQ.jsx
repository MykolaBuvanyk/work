import React, { useState } from 'react'
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
  return (
    <section className={styles.faq} aria-labelledby="faq-title">
      <h2 id="faq-title" className={styles.title}>
        {title}
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

  return (
    <div className={styles.item}>
      <button
        className={styles.question}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <Chevron />
        <span className={styles.qtext}>{question}</span>
      </button>

      <div className={`${styles.answer} ${open ? styles.open : ''}`} role="region">
        <div className={styles.answerRow}>
          <div className={styles.marker} aria-hidden>
            <span className={styles.outer}>
              <span className={styles.inner} />
            </span>
          </div>
          <div className={styles.answercopy}>{answer}</div>
        </div>
      </div>
    </div>
  )
}
