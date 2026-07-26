import Link from '../Localized/LocalizedLink';
import styles from './PublicPageOverview.module.css';

export default function PublicPageOverview({
  eyebrow,
  title,
  description,
  features = [],
  primaryAction,
  secondaryAction,
  status,
}) {
  return (
    <section className={styles.section} aria-labelledby="public-page-overview-title">
      <div className={styles.content}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 id="public-page-overview-title" className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>

        {Array.isArray(features) && features.length > 0 ? (
          <ul className={styles.features}>
            {features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        ) : null}

        <div className={styles.actions}>
          {primaryAction ? (
            <Link className={styles.primaryAction} to={primaryAction.to}>
              {primaryAction.label}
            </Link>
          ) : null}
          {secondaryAction ? (
            <Link className={styles.secondaryAction} to={secondaryAction.to}>
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>

        {status ? (
          <p className={styles.status} role="status">{status}</p>
        ) : null}
      </div>
    </section>
  );
}
