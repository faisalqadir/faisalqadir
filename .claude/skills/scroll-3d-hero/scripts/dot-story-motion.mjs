#!/usr/bin/env node
// Check a dot story in motion, at speed. The page's animation clock is driven in exact 1/60 s steps
// while the scroll moves at a set speed, so the frames show what a 60 fps screen shows however slow
// this machine is. Saves every few frames as PNGs (the dots over grey boxes where the copy is) and a
// CSV per run, and reports how far the story trails the scrollbar and how far the character's dots
// trail their places (0 means it holds together).
//
//   node dot-story-motion.mjs <page.html | url> [options]
//
//   --from <spec>        where to start: a selector (its top at the viewport top), optionally
//                        followed by :screens, e.g. "#hourglass-section:-1.9"; or a page fraction 0..1
//   --to <spec>          where to stop (same form)
//   --speeds <list>      px per second, or "jump" for page-down jumps every 250 ms (default: 3000,6000,jump)
//   --viewports <list>   desktop, mobile, or WIDTHxHEIGHT (default: desktop,mobile)
//   --every <n>          save every n-th frame (default: 3)
//   --out <dir>          where frames and CSVs go (default: ./dot-story-motion)
//
// Needs the page's dot story with ?dots-debug available (createDotStory adds it).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, laptop: { width: 1280, height: 720 }, mobile: { width: 390, height: 844 } };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

const args = parseArgs(process.argv.slice(2));
if (!args._[0]) {
  console.error('usage: node dot-story-motion.mjs <page.html | url> --from "#section:-1" --to "#section:1" [--speeds 3000,6000,jump]');
  process.exit(2);
}
const outDir = path.resolve(args.out || 'dot-story-motion');
const speeds = (args.speeds || '3000,6000,jump').split(',');
const viewports = (args.viewports || 'desktop,mobile').split(',').map(parseViewport);
const every = Number(args.every || 3);
fs.mkdirSync(outDir, { recursive: true });

process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK = '1';
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const { chromium } = await loadPlaywright();
let server = null;
let pageUrl = args._[0];
if (!/^https?:\/\//.test(pageUrl)) {
  const file = path.resolve(pageUrl);
  server = await serve(path.dirname(file));
  pageUrl = `http://127.0.0.1:${server.address().port}/${path.basename(file)}`;
}
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  ...(proxy ? { proxy: { server: proxy, bypass: '127.0.0.1,localhost' } } : {}),
});

let failed = false;
try {
  for (const vp of viewports) {
    for (const speed of speeds) {
      const page = await (await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 })).newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      // take over requestAnimationFrame so the test can step the page's clock itself
      await page.addInitScript(() => {
        const real = window.requestAnimationFrame.bind(window);
        window.__vt = { manual: false, t: 0, q: [] };
        window.requestAnimationFrame = (cb) => (window.__vt.manual ? (window.__vt.q.push(cb), window.__vt.q.length) : real(cb));
        window.__tick = (ms) => {
          window.__vt.t += ms;
          const q = window.__vt.q;
          window.__vt.q = [];
          for (const cb of q) cb(window.__vt.t);
        };
      });
      await page.goto(pageUrl + (pageUrl.includes('?') ? '&' : '?') + 'dots-debug', { waitUntil: 'load' });
      await page.waitForSelector('canvas[data-ready="true"]', { state: 'attached', timeout: 60000 });
      await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
      const [y0, y1] = await page.evaluate(([a, b]) => {
        const at = (spec) => {
          if (/^[\d.]+$/.test(spec)) return Number(spec) * (document.documentElement.scrollHeight - innerHeight);
          const [sel, screens] = spec.split(':');
          const el = document.querySelector(sel);
          if (!el) throw new Error(`"${sel}" not found`);
          return el.getBoundingClientRect().top + scrollY + Number(screens || 0) * innerHeight;
        };
        const max = document.documentElement.scrollHeight - innerHeight;
        return [Math.max(0, Math.round(at(a))), Math.min(max, Math.round(at(b)))];
      }, [args.from || '0', args.to || '1']);
      await page.evaluate((y) => window.scrollTo(0, y), y0);
      await page.waitForFunction(() => document.querySelector('canvas[data-settled]')?.dataset.settled === 'true', null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(300);
      const run = await page.evaluate(({ y0, y1, speed, every }) => {
        window.__vt.manual = true;
        window.__vt.t = performance.now() + 100;
        const dots = document.querySelector('canvas[data-settled]');
        const shots = [];
        const log = [];
        const scale = 0.4;
        const debug = () => [...document.querySelectorAll('div')].find((d) => d.textContent.startsWith('dot-story'))?.textContent || '';
        const capture = (i) => {
          log.push([i, Math.round(scrollY), debug()]);
          if (i % every) return;
          const c = document.createElement('canvas');
          c.width = innerWidth * scale;
          c.height = innerHeight * scale;
          const x = c.getContext('2d');
          x.scale(scale, scale);
          x.fillStyle = '#f4f4f1';
          x.fillRect(0, 0, innerWidth, innerHeight);
          x.fillStyle = '#e2e2dc';
          document.querySelectorAll('h1, h2, h3, p').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.bottom > 0 && r.top < innerHeight) x.fillRect(r.left, r.top, r.width, r.height);
          });
          x.fillStyle = '#0e0e0e';
          document.querySelectorAll('#panel, .hg-panel').forEach((el) => {
            const r = el.getBoundingClientRect();
            x.fillRect(r.left, r.top, r.width, r.height);
          });
          x.drawImage(dots, 0, 0, innerWidth, innerHeight);
          x.fillStyle = 'red';
          x.font = '28px monospace';
          x.fillText(`frame ${i}  ${Math.round(scrollY)}px`, 10, innerHeight - 14);
          shots.push(c.toDataURL('image/png'));
        };
        let y = y0;
        let still = 0;
        for (let i = 0; i < 900; i++) {
          if (speed === 'jump') {
            if (i % 15 === 0 && y < y1) y = Math.min(y1, y + innerHeight * 0.875);
          } else y = Math.min(y1, y + Number(speed) / 60);
          window.scrollTo(0, y);
          window.dispatchEvent(new Event('scroll'));
          window.__tick(1000 / 60);
          capture(i);
          if (y >= y1 && dots.dataset.settled === 'true' && ++still > 6) break;
        }
        return { shots, log };
      }, { y0, y1, speed, every });
      const tag = `${vp.name}-${speed}`;
      run.shots.forEach((u, k) => fs.writeFileSync(path.join(outDir, `${tag}-${String(k).padStart(3, '0')}.png`), Buffer.from(u.split(',')[1], 'base64')));
      const num = (t, re) => Number((t.match(re) || [])[1] || 0);
      const rows = ['frame,scroll,scrollLagPx,bodyLagAvgPx,bodyLagMaxPx'];
      let maxScroll = 0;
      let maxBody = 0;
      for (const [i, y, t] of run.log) {
        const sl = Math.abs(num(t, /scroll lag (-?\d+)px/));
        const bm = num(t, /max (\d+)px/);
        maxScroll = Math.max(maxScroll, sl);
        maxBody = Math.max(maxBody, bm);
        rows.push([i, y, sl, num(t, /body lag avg ([\d.]+)/), bm].join(','));
      }
      fs.writeFileSync(path.join(outDir, `${tag}.csv`), rows.join('\n'));
      console.log(`[${tag}] ${run.log.length} frames (${(run.log.length / 60).toFixed(2)} s at 60 fps): story trails the scrollbar by up to ${maxScroll}px; dots trail their places by up to ${maxBody}px`);
      if (errors.length) {
        failed = true;
        console.error(`[${tag}] errors:\n  ${errors.join('\n  ')}`);
      }
      await page.context().close();
    }
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
