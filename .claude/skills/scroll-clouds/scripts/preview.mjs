#!/usr/bin/env node
// Screenshot a scroll-clouds page at several points of its cloud track, so the build-up can be
// checked without opening a browser by hand.
//
//   node preview.mjs <page.html | http://localhost:3000/> [options]
//
//   --out <dir>          where PNGs go (default: ./clouds-preview)
//   --stops <list>       progress through the track, 0..1 (default: 0,0.25,0.5,0.75,1)
//   --viewports <list>   desktop, laptop, tablet, mobile, or WIDTHxHEIGHT (default: desktop,mobile)
//   --track <selector>   the cloud track (default: the first element holding a .cloud-cover-canvas)
//   --root <dir>         directory to serve for a local file (default: the file's directory)
//
// A local .html file is served over http (ES modules do not load from file://). Exits non-zero if
// the clouds never become ready or the page logs errors.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 720 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif' };

const args = parseArgs(process.argv.slice(2));
if (!args._[0]) {
  console.error('usage: node preview.mjs <page.html | url> [--out dir] [--stops 0,0.5,1] [--viewports desktop,mobile]');
  process.exit(2);
}
const outDir = path.resolve(args.out || 'clouds-preview');
const stops = (args.stops || '0,0.25,0.5,0.75,1').split(',').map(Number);
const viewports = (args.viewports || 'desktop,mobile').split(',').map(parseViewport);

// Behind an HTTPS proxy, CDN requests (fonts) must use it while the local server must not.
// Playwright forces loopback through the proxy unless this is set.
process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK = '1';
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const { chromium } = await loadPlaywright();

let server = null;
let pageUrl = args._[0];
if (!/^https?:\/\//.test(pageUrl)) {
  const file = path.resolve(pageUrl);
  const root = path.resolve(args.root || path.dirname(file));
  server = await serve(root);
  pageUrl = `http://127.0.0.1:${server.address().port}/${path.relative(root, file).split(path.sep).join('/')}`;
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  ...(proxy ? { proxy: { server: proxy, bypass: '127.0.0.1,localhost' } } : {}),
});
let failed = false;
try {
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && problems.push(`${m.type()}: ${m.text()}`));
    await page.goto(pageUrl, { waitUntil: 'load' });
    try {
      await page.waitForSelector('.cloud-cover-canvas[data-ready="true"]', { state: 'attached', timeout: 30000 });
    } catch {
      console.error(`[${vp.name}] the clouds never became ready (no .cloud-cover-canvas[data-ready])`);
      failed = true;
      await context.close();
      continue;
    }
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
    const track = await page.evaluate((sel) => {
      const el = sel ? document.querySelector(sel) : document.querySelector('.cloud-cover-canvas')?.closest('section, [data-clouds], div');
      const t = sel ? el : el && (function up(n) { while (n && n.getBoundingClientRect().height <= innerHeight * 1.05) n = n.parentElement; return n; })(el);
      if (!t) return null;
      const r = t.getBoundingClientRect();
      return { top: r.top + scrollY, span: Math.max(0, r.height - innerHeight) };
    }, args.track || null);
    if (!track) {
      console.error(`[${vp.name}] cloud track not found`);
      failed = true;
      await context.close();
      continue;
    }
    for (const s of stops) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(track.top + s * track.span));
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.waitForFunction(() => document.querySelector('.cloud-cover-canvas').dataset.settled === 'true', null, { timeout: 20000 }).catch(() => problems.push(`not settled at stop ${s}`));
      const file = path.join(outDir, `${vp.name}-${String(s).replace('.', '_')}.png`);
      await page.screenshot({ path: file });
      console.log(`[${vp.name}] stop ${s} → ${file}`);
    }
    if (problems.length) {
      failed = true;
      console.error(`[${vp.name}] problems:\n  ${problems.join('\n  ')}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  server?.close();
}
process.exit(failed ? 1 : 0);

function parseArgs(list) {
  const out = { _: [] };
  for (let i = 0; i < list.length; i++) {
    if (list[i].startsWith('--')) out[list[i].slice(2)] = list[++i];
    else out._.push(list[i]);
  }
  return out;
}

function parseViewport(name) {
  if (VIEWPORTS[name]) return { name, ...VIEWPORTS[name] };
  const m = /^(\d+)x(\d+)$/.exec(name);
  if (!m) throw new Error(`unknown viewport "${name}"`);
  return { name, width: +m[1], height: +m[2] };
}

function serve(root) {
  const srv = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(srv)));
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return import(pathToFileURL(path.join(globalRoot, 'playwright', 'index.mjs')).href);
  }
}
