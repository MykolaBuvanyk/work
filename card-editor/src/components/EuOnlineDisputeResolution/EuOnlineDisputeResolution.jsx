import React from 'react';
import './EUOnlineDisputeResolution.scss'

const EUOnlineDisputeResolution = () => {
  return (
    <div className="EUOnlineDisputeResolution max-w-4xl mx-auto px-4 py-12 text-gray-800 font-sans leading-relaxed">
      {/* Заголовок */}
      <h1 className="text-2xl font-bold mb-8 text-gray-900 border-b pb-4">
        EU Online Dispute Resolution
      </h1>

      {/* Опис платформи ODR */}
      <section className="mb-12">
        <p className="text-sm text-gray-700 leading-normal mb-4">
          The European Commission provides a platform for online dispute resolution (ODR):{' '}
          <a 
            href="https://ec.europa.eu/consumers/odr/" 
            target="_blank" 
            rel="noreferrer" 
            className="text-blue-600 hover:underline"
          >
            https://ec.europa.eu/consumers/odr/
          </a>.
        </p>
      </section>

      {/* Участь у вирішенні спорів */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          Dispute Resolution Proceedings
        </h2>
        <p className="text-sm text-gray-700 leading-normal">
          We are not obliged to participate in dispute resolution proceedings before a consumer arbitration board.
        </p>
      </section>
    </div>
  );
};

export default EUOnlineDisputeResolution;