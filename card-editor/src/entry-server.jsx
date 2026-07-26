import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import AppRoot from './AppRoot.jsx';
import i18n from './i18n.js';
import { isPrerenderPath } from './prerender/routes.js';

/**
 * Server-side entry used by the build-time prerender step.
 * Only the explicitly approved German routes may be rendered here.
 */
export async function render(url) {
  const pathname = new URL(url, 'https://sign-xpert.com').pathname;

  if (!isPrerenderPath(pathname)) {
    throw new Error(`Route is not approved for prerendering: ${pathname}`);
  }

  await i18n.changeLanguage('de');

  const helmetContext = {};
  const renderedHtml = renderToString(
    <StrictMode>
      <AppRoot
        Router={StaticRouter}
        routerProps={{ location: pathname }}
        helmetContext={helmetContext}
      />
    </StrictMode>
  );

  // React 19 emits hoistable metadata before the application root when using
  // renderToString. Keep it separate so the future prerender template can put
  // metadata in <head> and application markup inside #root.
  const appMarker = '<div class="app">';
  const appStart = renderedHtml.indexOf(appMarker);
  const headHtml = appStart >= 0 ? renderedHtml.slice(0, appStart) : '';
  const html = appStart >= 0 ? renderedHtml.slice(appStart) : renderedHtml;

  return {
    html,
    headHtml,
    helmet: helmetContext.helmet ?? null,
    lang: 'de',
    pathname,
  };
}
