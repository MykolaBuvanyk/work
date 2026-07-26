import { access, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { PRERENDER_ROUTES } from '../src/prerender/routes.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const origin = 'http://127.0.0.1:4180';
const hydrationErrorPattern =
  /hydration|did not match|server rendered html|react error #(?:418|419|423|425)/i;

const findBrowserExecutable = async () => {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : undefined,
    process.platform === 'win32'
      ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      : undefined,
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next locally installed browser.
    }
  }

  return undefined;
};

const contentTypeByExtension = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
};

const resolveStaticFile = async (requestPath) => {
  const decodedPath = decodeURIComponent(requestPath).replace(/^\/+/, '');
  const candidates = requestPath === '/'
    ? [path.join(distDir, 'index.html')]
    : [
        path.join(distDir, decodedPath, 'index.html'),
        path.join(distDir, decodedPath),
        path.join(distDir, 'index.html'),
      ];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(`${distDir}${path.sep}`) && resolved !== path.join(distDir, 'index.html')) {
      continue;
    }

    try {
      if ((await stat(resolved)).isFile()) return resolved;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
};

const staticServer = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', origin);
    const file = await resolveStaticFile(requestUrl.pathname);
    if (!file) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    const body = await readFile(file);
    const contentType =
      contentTypeByExtension[path.extname(file).toLowerCase()] ||
      'application/octet-stream';
    response.writeHead(200, { 'Content-Type': contentType });
    response.end(body);
  } catch (error) {
    response.writeHead(500);
    response.end(error.message);
  }
});

let browser;

try {
  await new Promise((resolve, reject) => {
    staticServer.once('error', reject);
    staticServer.listen(4180, '127.0.0.1', resolve);
  });
  const executablePath = await findBrowserExecutable();
  browser = await puppeteer.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const route of PRERENDER_ROUTES) {
    const page = await browser.newPage();
    const hydrationErrors = [];

    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error' && hydrationErrorPattern.test(text)) {
        hydrationErrors.push(text);
      }
    });
    page.on('pageerror', (error) => {
      if (hydrationErrorPattern.test(error.message)) {
        hydrationErrors.push(error.message);
      }
    });

    await page.goto(`${origin}${route.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await new Promise((resolve) => setTimeout(resolve, 750));

    const state = await page.evaluate(() => ({
      hasApp: Boolean(document.querySelector('#root > .app')),
      hasHeading: Boolean(document.querySelector('h1')),
      lang: document.documentElement.lang,
      title: document.title,
    }));

    if (!state.hasApp || !state.hasHeading || state.lang !== 'de' || !state.title) {
      throw new Error(`${route.path} has an invalid hydrated document: ${JSON.stringify(state)}`);
    }
    if (hydrationErrors.length > 0) {
      const hydratedOverview = await page
        .$eval(
          '[aria-labelledby="public-page-overview-title"]',
          (element) => element.outerHTML
        )
        .catch(() => '');
      const staticPage = await browser.newPage();
      await staticPage.setJavaScriptEnabled(false);
      await staticPage.goto(`${origin}${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      const staticOverview = await staticPage
        .$eval(
          '[aria-labelledby="public-page-overview-title"]',
          (element) => element.outerHTML
        )
        .catch(() => '');
      await staticPage.close();

      let difference = '';
      if (staticOverview !== hydratedOverview) {
        const maxLength = Math.max(staticOverview.length, hydratedOverview.length);
        let differenceIndex = 0;
        while (
          differenceIndex < maxLength &&
          staticOverview[differenceIndex] === hydratedOverview[differenceIndex]
        ) {
          differenceIndex += 1;
        }
        const start = Math.max(0, differenceIndex - 120);
        const end = differenceIndex + 240;
        difference =
          `\nFirst DOM difference at ${differenceIndex}` +
          `\nstatic: ${staticOverview.slice(start, end)}` +
          `\nhydrated: ${hydratedOverview.slice(start, end)}`;
      }

      throw new Error(
        `${route.path} hydration errors:\n${hydrationErrors.join('\n')}${difference}`
      );
    }

    if (route.path === '/faq') {
      const question = await page.$('[aria-expanded]');
      if (!question) throw new Error('/faq has no interactive question button');
      await question.click();
      const expanded = await question.evaluate((element) => element.getAttribute('aria-expanded'));
      if (expanded !== 'true') {
        throw new Error('/faq did not become interactive after hydration');
      }
    }

    console.log(`hydrated ${route.path}`);
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => staticServer.close(resolve));
}
