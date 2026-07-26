/**
 * Public German pages that are safe to expose as build-time rendered HTML.
 *
 * Keep this list deliberately shallow. It is the source of truth for the
 * future prerender build, sitemap generation, and HTML smoke tests.
 */
export const PRERENDER_ROUTES = Object.freeze([
  { path: '/', page: 'home' },
  { path: '/online-sign-editor', page: 'online-sign-editor' },
  { path: '/products', page: 'products' },
  { path: '/account', page: 'account', audience: 'guest' },
  { path: '/industries', page: 'industries' },
  { path: '/faq', page: 'faq' },
  { path: '/quick-guide', page: 'quick-guide' },
  { path: '/contacts', page: 'contacts' },
]);

export const PRERENDER_PATHS = Object.freeze(
  PRERENDER_ROUTES.map(({ path }) => path)
);

export const isPrerenderPath = (pathname = '/') =>
  PRERENDER_PATHS.includes(pathname);
