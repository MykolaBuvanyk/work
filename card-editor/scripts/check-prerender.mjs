import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRERENDER_ROUTES } from '../src/prerender/routes.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const baseUrl = 'https://sign-xpert.com';

const outputFileForRoute = (routePath) =>
  routePath === '/'
    ? path.join(distDir, 'index.html')
    : path.join(distDir, routePath.slice(1), 'index.html');

const countMatches = (value, pattern) => value.match(pattern)?.length ?? 0;

for (const route of PRERENDER_ROUTES) {
  const file = outputFileForRoute(route.path);
  const html = await readFile(file, 'utf8');
  const expectedCanonical =
    route.path === '/' ? baseUrl : `${baseUrl}${route.path}`;
  const checks = [
    ['German document language', /<html\s+lang="de"/i.test(html)],
    ['one title', countMatches(html, /<title>/gi) === 1],
    ['description', /<meta\s+name="description"/i.test(html)],
    ['robots index directive', /<meta\s+name="robots"\s+content="index,follow/i.test(html)],
    ['canonical', html.includes(`rel="canonical" href="${expectedCanonical}"`)],
    ['German hreflang', html.includes('hrefLang="de"')],
    ['structured data', html.includes('type="application/ld+json"')],
    ['rendered application', /<div id="root"><div class="app">/i.test(html)],
    ['visible heading', /<h1(?:\s|>)/i.test(html)],
    ['client hydration bundle', /<script type="module"[^>]+src="\/assets\//i.test(html)],
    ['no German URL prefix', !html.includes(`${baseUrl}/de/`)],
  ];

  const failed = checks.filter(([, passed]) => !passed);
  if (failed.length > 0) {
    throw new Error(
      `${route.path} failed prerender checks: ${failed.map(([name]) => name).join(', ')}`
    );
  }

  console.log(`verified ${route.path}`);
}

const sitemap = await readFile(path.join(distDir, 'sitemap.xml'), 'utf8');
if (/https:\/\/sign-xpert\.com\/de(?:\/|<)/i.test(sitemap)) {
  throw new Error('dist/sitemap.xml still contains German /de URLs');
}
if (!sitemap.includes('<loc>https://sign-xpert.com/account</loc>')) {
  throw new Error('dist/sitemap.xml does not contain the public account overview');
}

console.log('verified dist/sitemap.xml');
