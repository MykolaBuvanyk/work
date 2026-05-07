import styles from './EUOnlineDisputeResolution.module.css';

const EUOnlineDisputeResolution = () => {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Eu Online Dispute Resolution</h1>

      <section className={styles.section}>
        <p className={styles.body}>
          The European Commission provides a platform for online dispute resolution (ODR):{' '}
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer">
            https://ec.europa.eu/consumers/odr/
          </a>
          .
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>Dispute Resolution Proceedings</h2>
        <p className={styles.body}>
          We are not obliged to participate in dispute resolution proceedings before a consumer
          arbitration board.
        </p>
      </section>
    </div>
  );
};

export default EUOnlineDisputeResolution;
