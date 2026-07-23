const GOOGLE_ANALYTICS_ID = 'G-V82W5XKFK2';
const GOOGLE_TAG_MANAGER_ID = 'GTM-MGKTXBGV';

let isGoogleAnalyticsLoaded = false;

const appendScript = (id, src) => {
  if (document.getElementById(id)) return;

  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
};

export const loadGoogleAnalytics = () => {
  if (isGoogleAnalyticsLoaded || typeof window === 'undefined') return;

  isGoogleAnalyticsLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', GOOGLE_ANALYTICS_ID);
  window.dataLayer.push({
    'gtm.start': new Date().getTime(),
    event: 'gtm.js',
  });

  appendScript(
    'google-analytics-script',
    `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`,
  );
  appendScript(
    'google-tag-manager-script',
    `https://www.googletagmanager.com/gtm.js?id=${GOOGLE_TAG_MANAGER_ID}`,
  );
};
