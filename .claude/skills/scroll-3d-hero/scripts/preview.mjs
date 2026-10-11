#!/usr/bin/env node
// Screenshot a scroll-3d-hero page at several scroll positions so the choreography can be checked
// without opening a browser by hand. If the page has a dot-matrix wordmark (dot-wordmark.js), it is
// scrolled into view and captured once its dots settle, as <viewport>-wordmark.png.
//
//   node preview.mjs <page.html | http://localhost:3000/> [options]
//
//   --out <dir>          where PNGs go (default: ./s3h-preview)
//   --stops <list>       progress stops, 0..1 (default: 0,0.25,0.5,0.75,1)
//   --viewports <list>   desktop, laptop, tablet, mobile, or WIDTHxHEIGHT (default: desktop,mobile)
//   --track <selector>   the track element (default: .s3h)
//   --stage <selector>   the stage element (default: .s3h-stage)
//   --root <dir>         directory to serve for a local file (default: the file's directory)
//   --after-ready <js>   expression evaluated after the hero is ready, before screenshots
//
// A local .html file is served over http (ES modules do not load from file://). Exits non-zero
// if the hero never becomes ready, the page logs errors, or it has neither a hero nor a wordmark.
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
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2',
};

const args = parseArgs(process.argv.slice(2));
if (!args._[0]) {
  console.error('usage: node preview.mjs <page.html | url> [--out dir] [--stops 0,0.5,1] [--viewports desktop,mobile]');
  process.exit(2);
}
const outDir = path.resolve(args.out || 's3h-preview');
const stops = (args.stops || '0,0.25,0.5,0.75,1').split(',').map(Number);
const viewports = (args.viewports || 'desktop,mobile').split(',').map(parseViewport);
const trackSel = args.track || '.s3h';
const stageSel = args.stage || '.s3h-stage';

const { chromium } = await loadPlaywright();
let server = null;
let pageUrl = args._[0];
if (!/^https?:\/\//.test(pageUrl)) {
  const file = path.resolve(pageUrl);
  const root = path.resolve(args.root || path.dirname(file));
  server = await serve(root);
  pageUrl = `http://127.0.0.1:${server.address().port}/${path.relative(root, file).split(path.sep).join('/')}`;
}

// Behind an HTTPS proxy, CDN requests (three.js, fonts) must use it while the local server must not.
// Playwright forces loopback through the proxy unless this is set.
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy) process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK = '1';
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {}),
});

fs.mkdirSync(outDir, { recursive: true });
let failed = false;
for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
  const page = await context.newPage();
  const problems = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || (m.type() === 'warning' && /scroll-3d-hero|dot-wordmark/.test(m.text()))) problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

  await page.goto(pageUrl, { waitUntil: 'load' });
  const hasHero = await page.evaluate((sel) => !!document.querySelector(sel), stageSel);
  if (hasHero) {
    try {
      await page.waitForSelector(`${stageSel}[data-s3h-ready="true"]`, { state: 'attached', timeout: 45000 });
    } catch {
      console.error(`[${vp.name}] the hero never became ready (no data-s3h-ready on ${stageSel}).`);
      problems.forEach((p) => console.error(`  ${p}`));
      failed = true;
      await page.screenshot({ path: path.join(outDir, `${vp.name}-not-ready.png`) });
      await context.close();
      continue;
    }
  }
  if (args['after-ready']) await page.evaluate(args['after-ready']);
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });

  for (const stop of hasHero ? stops : []) {
    await page.evaluate(
      ({ trackSel, stageSel, stop }) => {
        const track = document.querySelector(trackSel);
        const top = track.getBoundingClientRect().top + window.scrollY;
        const stage = document.querySelector(stageSel) || track;
        const range = track.offsetHeight - (stage.clientHeight || window.innerHeight);
        window.scrollTo(0, top + Math.max(0, range) * stop);
      },
      { trackSel, stageSel, stop }
    );
    // let two frames run so the hero sees the new scroll position before we trust its settled flag
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    try {
      await page.waitForFunction((sel) => document.querySelector(sel)?.dataset.s3hSettled === 'true', stageSel, { timeout: 20000 });
    } catch {
      problems.push(`note: not settled at stop ${stop} after 20s (slow software rendering?)`);
    }
    await page.waitForTimeout(150);
    const file = path.join(outDir, `${vp.name}-${String(stop).replace('.', '_')}.png`);
    await page.screenshot({ path: file });
    const progress = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).getPropertyValue('--s3h-progress'), trackSel);
    console.log(`[${vp.name}] stop ${stop} → progress ${progress.trim() || '?'} → ${file}`);
  }

  const hasWordmark = await page.evaluate(() => !!document.querySelector('[data-dot-wordmark]'));
  if (hasWordmark) {
    await page.evaluate(() => {
      const b = document.querySelector('[data-dot-wordmark]').getBoundingClientRect();
      window.scrollTo(0, window.scrollY + b.bottom - window.innerHeight + 24);
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    try {
      await page.waitForFunction(() => document.querySelector('[data-dot-wordmark]').dataset.settled === 'true', null, { timeout: 30000 });
    } catch {
      problems.push('note: the wordmark had not settled after 30s (slow software rendering?)');
    }
    const file = path.join(outDir, `${vp.name}-wordmark.png`);
    await page.screenshot({ path: file });
    console.log(`[${vp.name}] wordmark → ${file}`);
  }
  if (!hasHero && !hasWordmark) problems.push(`error: found neither a hero stage (${stageSel}) nor a dot wordmark`);
  if (problems.length) {
    console.log(`[${vp.name}] console problems:`);
    problems.forEach((p) => console.log(`  ${p}`));
    if (problems.some((p) => !p.startsWith('note'))) failed = true;
  }
  await context.close();
}

await browser.close();
server?.close();
process.exit(failed ? 1 : 0);

/* ------------------------------------------------------------------------ */

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}

function parseViewport(name) {
  if (VIEWPORTS[name]) return { name, ...VIEWPORTS[name] };
  const m = /^(\d+)x(\d+)$/.exec(name);
  if (!m) throw new Error(`unknown viewport "${name}"`);
  return { name, width: +m[1], height: +m[2], isMobile: +m[1] < 768, hasTouch: +m[1] < 768 };
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {}
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return await import(pathToFileURL(path.join(globalRoot, 'playwright', 'index.mjs')).href);
  } catch {}
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

function serve(root) {
  const srv = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(root, urlPath);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(srv)));
}
