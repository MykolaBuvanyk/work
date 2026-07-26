import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PRERENDER_ROUTES } from '../src/prerender/routes.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const serverDir = path.join(projectRoot, '.prerender-server');
const serverEntry = path.join(serverDir, 'entry-server.js');
const baseUrl = 'https://sign-xpert.com';

const removeDefaultHeadTags = (template) =>
  template
    .replace(/<html\s+lang=(["']).*?\1/i, '<html lang="de"')
    .replace(/\s*<title>[\s\S]*?<\/title>\s*/i, '\n');

const cleanReactHead = (headHtml) =>
  headHtml
    // index.html already owns these two document-level tags.
    .replace(/<meta\s+charSet="[^"]*"\s*\/>/gi, '')
    .replace(/<meta\s+name="viewport"[^>]*\/>/gi, '')
    // React 19 emits image preloads for every rendered image. They make the
    // static head very large and can capture a local asset-server URL.
    .replace(/<link\s+rel="preload"[^>]*\/>/gi, '')
    .trim();

const outputFileForRoute = (routePath) =>
  routePath === '/'
    ? path.join(distDir, 'index.html')
    : path.join(distDir, routePath.slice(1), 'index.html');

const renderDocument = (template, result) => {
  const rootMarker = '<div id="root"></div>';

  if (!template.includes(rootMarker)) {
    throw new Error('Could not find the #root marker in dist/index.html');
  }

  const headHtml = cleanReactHead(result.headHtml);
  const withLanguage = removeDefaultHeadTags(template);
  const withHead = withLanguage.replace(
    '</head>',
    `  <!-- prerender-head:start -->\n  ${headHtml}\n  <!-- prerender-head:end -->\n</head>`
  );

  return withHead.replace(
    rootMarker,
    `<div id="root">${result.html}</div>`
  );
};

const normalizeSitemap = async () => {
  const sitemapPath = path.join(distDir, 'sitemap.xml');
  let sitemap = await readFile(sitemapPath, 'utf8');

  // German is the default language and must not use a /de prefix.
  sitemap = sitemap.replace(
    /\s*<url>\s*<loc>https:\/\/sign-xpert\.com\/de(?:\/[^<]*)?<\/loc>[\s\S]*?<\/url>/gi,
    ''
  );

  const lastmod = new Date().toISOString();
  const missingEntries = PRERENDER_ROUTES
    .filter(({ path: routePath }) => {
      const url = `${baseUrl}${routePath === '/' ? '' : routePath}`;
      return !sitemap.includes(`<loc>${url}</loc>`);
    })
    .map(({ path: routePath }) => {
      const url = `${baseUrl}${routePath === '/' ? '' : routePath}`;
      return `  <url>\n    <loc>${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    });

  if (missingEntries.length > 0) {
    sitemap = sitemap.replace(
      '</urlset>',
      `${missingEntries.join('\n')}\n</urlset>`
    );
  }

  await writeFile(sitemapPath, sitemap, 'utf8');
};

try {
  const template = await readFile(path.join(distDir, 'index.html'), 'utf8');
  const { render } = await import(pathToFileURL(serverEntry).href);

  for (const route of PRERENDER_ROUTES) {
    const result = await render(route.path);
    const outputFile = outputFileForRoute(route.path);
    const document = renderDocument(template, result);

    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, document, 'utf8');

    console.log(`prerendered ${route.path} -> ${path.relative(projectRoot, outputFile)}`);
  }

  await normalizeSitemap();
  console.log('normalized dist/sitemap.xml');
} finally {
  await rm(serverDir, { recursive: true, force: true });
}
