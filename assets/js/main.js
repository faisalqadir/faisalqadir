/* =========================================================
   Nimbus — interactions
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motionQuery.matches;
  const canHover = matchMedia('(hover: hover)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };
  const rng = seed => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const whenVisible = (el, cb, threshold = 0) => {
    if (!el) return;
    new IntersectionObserver(entries => entries.forEach(e => cb(e.isIntersecting, e)), { threshold }).observe(el);
  };

  if (reduced()) root.classList.add('reduce-motion');
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     Typewriter that cancels itself when asked to type again
     --------------------------------------------------------- */
  function typer(el, speed = 30) {
    let token = 0;
    const fn = async text => {
      const mine = ++token;
      if (reduced()) { el.textContent = text; return true; }
      el.textContent = '';
      for (let i = 1; i <= text.length; i++) {
        if (mine !== token) return false;
        el.textContent = text.slice(0, i);
        await sleep(speed + (text[i - 1] === ' ' ? 10 : 0));
      }
      return mine === token;
    };
    fn.cancel = () => { token++; };
    return fn;
  }

  /* ---------------------------------------------------------
     Time of day
     --------------------------------------------------------- */
  const PHASES = ['sunrise', 'day', 'sunset', 'night'];
  const THEME = { sunrise: '#6f9bd2', day: '#1a6fe8', sunset: '#a593ec', night: '#060d22' };
  const SHADOW = { sunrise: '#2c4a73', day: '#123c86', sunset: '#4b2f7a', night: '#000010' };
  const phaseBtns = $$('.phase [role="radio"]');
  const themeMeta = $('meta[name="theme-color"]');

  function setPhase(p, save = true) {
    if (!PHASES.includes(p)) p = 'sunset';
    root.dataset.phase = p;
    phaseBtns.forEach(b => {
      const on = b.dataset.phase === p;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    if (themeMeta) themeMeta.content = THEME[p];
    root.style.setProperty('--shadow-flood', SHADOW[p]);
    if (save) store.set('nimbus-phase', p);
  }
  setPhase(root.dataset.phase, false);

  phaseBtns.forEach((b, i) => {
    b.addEventListener('click', () => setPhase(b.dataset.phase));
    b.addEventListener('keydown', e => {
      const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const next = phaseBtns[(i + dir + phaseBtns.length) % phaseBtns.length];
      setPhase(next.dataset.phase);
      next.focus();
    });
  });

  /* ---------------------------------------------------------
     Stars (visible at night)
     --------------------------------------------------------- */
  (function stars() {
    const r = rng(7);
    $$('.sky__stars i').forEach((el, layer) => {
      const n = layer ? 60 : 140;
      const list = [];
      for (let i = 0; i < n; i++) {
        const x = (r() * 100).toFixed(2), y = (r() * 72).toFixed(2);
        const size = r() < .08 ? 1.3 : r() * .8;
        list.push(`${x}vw ${y}vh 0 ${size.toFixed(2)}px rgba(255,255,255,${(.35 + r() * .65).toFixed(2)})`);
      }
      el.style.boxShadow = list.join(',');
    });
  })();

  /* ---------------------------------------------------------
     Clouds: painted once per sprite, then drifted + parallaxed
     --------------------------------------------------------- */
  function cloudSprite(w, h, seed) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    const r = rng(seed);
    const base = h * .74;
    const puffs = [];
    for (let i = 0; i < 30; i++) {
      const px = w * (.14 + .72 * r());
      const dome = 1 - Math.pow((px - w / 2) / (w / 2), 2) * .85;
      const rad = (h * (.15 + .22 * r()) * dome + h * .06);
      const py = base - rad * (.35 + .55 * r()) * dome - h * .02;
      puffs.push([px, py, rad]);
    }
    for (let i = 0; i < 12; i++) puffs.push([w * (.1 + .8 * r()), base - h * .04 * r(), h * (.06 + .07 * r())]);
    puffs.sort((a, b) => b[1] - a[1]);
    for (const [px, py, rad] of puffs) {
      const g = x.createRadialGradient(px - rad * .25, py - rad * .3, rad * .1, px, py, rad);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(.55, 'rgba(255,255,255,.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath(); x.arc(px, py, rad, 0, Math.PI * 2); x.fill();
    }
    x.globalCompositeOperation = 'source-atop';
    const shade = x.createLinearGradient(0, base - h * .42, 0, base + h * .08);
    shade.addColorStop(0, 'rgba(140,125,185,0)');
    shade.addColorStop(1, 'rgba(140,125,185,.5)');
    x.fillStyle = shade; x.fillRect(0, 0, w, h);
    const hi = x.createLinearGradient(0, 0, 0, base * .6);
    hi.addColorStop(0, 'rgba(255,255,255,.35)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = hi; x.fillRect(0, 0, w, h);
    // feather the bottom edge so sprites never end in a hard line
    x.globalCompositeOperation = 'destination-in';
    const fade = x.createLinearGradient(0, base - h * .1, 0, h);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = fade; x.fillRect(0, 0, w, h);
    c.style.filter = 'blur(1.5px)';
    return c;
  }

  const cloudLayer = $('#clouds');
  const CLOUDS = [
    { side: 0, y: .04, w: 640, h: 270, p: .22, seed: 3 },
    { side: 1, y: .2, w: 720, h: 290, p: .32, seed: 9 },
    { side: 0, y: .44, w: 520, h: 220, p: .4, seed: 21 },
    { side: 1, y: .62, w: 560, h: 240, p: .26, seed: 5 },
    { side: 0, y: .82, w: 700, h: 280, p: .34, seed: 14 },
    { side: 1, y: 1.02, w: 480, h: 200, p: .45, seed: 33 },
    { side: .5, y: 1.3, w: 420, h: 170, p: .5, seed: 27 },
  ];
  let clouds = [];
  function buildClouds() {
    if (!cloudLayer) return;
    cloudLayer.textContent = '';
    const k = innerWidth < 700 ? .55 : innerWidth < 1100 ? .8 : 1;
    clouds = CLOUDS.map(c => {
      const w = Math.round(c.w * k), h = Math.round(c.h * k);
      const el = cloudSprite(w, h, c.seed);
      cloudLayer.appendChild(el);
      return { ...c, w, h, el };
    });
  }
  function placeClouds(t) {
    const vw = innerWidth, vh = innerHeight, sy = scrollY;
    for (const c of clouds) {
      const baseX = c.side === 0 ? -c.w * .42 : c.side === 1 ? vw - c.w * .58 : vw * .5 - c.w / 2;
      const drift = reduced() ? 0 : Math.sin(t * .00006 + c.seed) * 46;
      const band = vh + c.h + 160;
      const y = (((c.y * band - sy * c.p) % band) + band) % band - c.h;
      c.el.style.transform = `translate3d(${(baseX + drift).toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  }
  buildClouds();
  (function cloudLoop(t) {
    placeClouds(t || 0);
    requestAnimationFrame(cloudLoop);
  })();

  /* ---------------------------------------------------------
     Header: dropdowns + mobile menu
     --------------------------------------------------------- */
  const setMenu = (li, on) => {
    li.classList.toggle('is-open', on);
    $('button', li).setAttribute('aria-expanded', String(on));
  };
  $$('.has-menu').forEach(li => {
    const btn = $('button', li);
    let t;
    if (canHover) {
      li.addEventListener('mouseenter', () => { clearTimeout(t); $$('.has-menu.is-open').forEach(o => o !== li && setMenu(o, false)); setMenu(li, true); });
      li.addEventListener('mouseleave', () => { t = setTimeout(() => setMenu(li, false), 140); });
    }
    btn.addEventListener('click', () => setMenu(li, !li.classList.contains('is-open')));
    li.addEventListener('keydown', e => { if (e.key === 'Escape') { setMenu(li, false); btn.focus(); } });
    li.addEventListener('focusout', e => { if (!li.contains(e.relatedTarget)) setMenu(li, false); });
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.has-menu')) $$('.has-menu.is-open').forEach(li => setMenu(li, false));
  });

  const burger = $('.nav__burger');
  const setMobile = on => {
    document.body.classList.toggle('menu-open', on);
    burger.setAttribute('aria-expanded', String(on));
    burger.setAttribute('aria-label', on ? 'Close menu' : 'Open menu');
    document.body.style.overflow = on ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setMobile(!document.body.classList.contains('menu-open')));
  $$('.mobile-menu a').forEach(a => a.addEventListener('click', () => setMobile(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setMobile(false); burger.focus(); } });
  addEventListener('resize', () => { if (innerWidth > 960) setMobile(false); });

  /* ---------------------------------------------------------
     Giant glass wordmark -> nav logo
     --------------------------------------------------------- */
  const wordmark = $('#wordmark');
  const navLogo = $('.nav__logo');
  let wm = null;
  function layoutWordmark() {
    if (!wordmark || reduced()) { root.style.setProperty('--logo-o', 1); return; }
    const vw = innerWidth, vh = innerHeight;
    const W0 = Math.min(vw * (vw < 700 ? 1.04 : 1.1), 1800);
    wordmark.style.setProperty('--wm-w', W0 + 'px');
    const r = navLogo.getBoundingClientRect();
    wm = { W0, H0: W0 * 520 / 1500, vw, vh, end: { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width } };
  }
  function updateWordmark() {
    if (!wm) return;
    const { W0, H0, vw, vh, end } = wm;
    const p = clamp(scrollY / (vh * .8), 0, 1);
    const e = easeInOut(p);
    const s = lerp(1, end.w / W0, e);
    const cx = lerp(vw / 2, end.x, e);
    const cy = lerp(vh * (vw < 700 ? .46 : .56), end.y, e);
    wordmark.style.transform = `translate3d(${(cx - W0 * s / 2).toFixed(2)}px, ${(cy - H0 * s / 2).toFixed(2)}px, 0) scale(${s.toFixed(5)})`;
    const fade = clamp((p - .84) / .16, 0, 1);
    wordmark.style.opacity = String(1 - fade);
    wordmark.style.visibility = fade >= 1 ? 'hidden' : 'visible';
    root.style.setProperty('--logo-o', fade.toFixed(3));
  }

  /* ---------------------------------------------------------
     Hero: rotating tasks + prompt pill
     --------------------------------------------------------- */
  const tasks = $$('.task');
  const promptType = typer($('#prompt-text'), 28);
  const resizeFrame = $('#resize-frame');
  const resizeItems = $$('#resize-list li');
  let taskIdx = 0, taskTimer = 0, resizeTimer = 0, heroVisible = true;

  function runResize() {
    clearTimeout(resizeTimer);
    let k = 0;
    const step = () => {
      const ratio = resizeItems[k].dataset.ratio;
      resizeFrame.dataset.ratio = ratio;
      resizeItems.forEach((li, j) => li.classList.toggle('is-on', j === k));
      k = (k + 1) % resizeItems.length;
      if (!reduced()) resizeTimer = setTimeout(step, 1050);
    };
    step();
  }
  function activateTask(i, byUser = false) {
    taskIdx = i;
    tasks.forEach((t, k) => t.classList.toggle('is-active', k === i));
    promptType(tasks[i].dataset.prompt);
    if (i === 2) runResize(); else { clearTimeout(resizeTimer); resizeFrame.dataset.ratio = 'square'; resizeItems.forEach((li, j) => li.classList.toggle('is-on', j === 0)); }
    clearTimeout(taskTimer);
    if (!reduced() && heroVisible) taskTimer = setTimeout(() => activateTask((taskIdx + 1) % tasks.length), byUser ? 9000 : 5400);
  }
  tasks.forEach((t, i) => t.addEventListener('click', () => activateTask(i, true)));
  resizeItems.forEach((li, j) => li.classList.toggle('is-on', j === 0));
  whenVisible($('#tasks'), vis => {
    heroVisible = vis;
    clearTimeout(taskTimer);
    if (vis && !reduced()) taskTimer = setTimeout(() => activateTask((taskIdx + 1) % tasks.length), 3800);
  });

  /* ---------------------------------------------------------
     Marquees: repeat content so the loop is seamless
     --------------------------------------------------------- */
  function setupMarquee(track) {
    const originals = [...track.children];
    const clone = n => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); return c; };
    let guard = 0;
    while (track.scrollWidth < innerWidth * 1.05 && guard++ < 4) originals.forEach(n => track.appendChild(clone(n)));
    [...track.children].forEach(n => track.appendChild(clone(n)));
    track.style.animationDuration = (track.scrollWidth / 2 / 42).toFixed(1) + 's';
  }
  const initMarquees = () => $$('[data-dup] .marquee__track').forEach(setupMarquee);
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(initMarquees);

  /* ---------------------------------------------------------
     Coming soon: the prompt composer demo
     --------------------------------------------------------- */
  const stage = $('#composer-stage');
  const composerType = typer($('#composer-typed'), 36);
  const send = $('#composer-send');
  const result = $('#composer-result');
  const cursor = $('#composer-cursor');
  const PROMPTS = [
    ['Tag every photo from the lemon shoot by product and mood', 'Tagged 214 photos · 38 new tags'],
    ['Make social sizes for everything on this board', 'Created 48 variants in 4 formats'],
    ['Archive drafts older than 90 days and flag duplicates', 'Archived 312 drafts · 17 duplicates flagged'],
  ];
  let composerOn = false, composerRunning = false;

  function placeCursor(x, y, animate) {
    if (!animate) { cursor.style.transition = 'none'; }
    cursor.style.transform = `translate(${x}px, ${y}px)`;
    if (!animate) { void cursor.offsetWidth; cursor.style.transition = ''; }
  }
  async function composerLoop() {
    if (composerRunning) return;
    composerRunning = true;
    let i = 0;
    while (composerOn) {
      const [prompt, done] = PROMPTS[i % PROMPTS.length];
      result.classList.remove('is-on');
      send.classList.remove('is-ready');
      const box = stage.getBoundingClientRect();
      placeCursor(box.width * .9, box.height * 1.02, false);
      cursor.style.opacity = '0';
      await composerType(prompt);
      if (!composerOn) break;
      send.classList.add('is-ready');
      const b = send.getBoundingClientRect(), s = stage.getBoundingClientRect();
      cursor.style.opacity = '1';
      placeCursor(b.left - s.left + b.width * .38, b.top - s.top + b.height * .42, true);
      await sleep(1250);
      if (!composerOn) break;
      cursor.classList.remove('is-click'); void cursor.offsetWidth; cursor.classList.add('is-click');
      send.classList.add('is-pressed');
      await sleep(170);
      send.classList.remove('is-pressed', 'is-ready');
      $('span', result).textContent = done;
      result.classList.add('is-on');
      $('#composer-typed').textContent = '';
      await sleep(900);
      cursor.style.opacity = '0';
      await sleep(2000);
      i++;
    }
    composerRunning = false;
  }
  if (stage) {
    if (reduced()) {
      $('#composer-typed').textContent = PROMPTS[0][0];
    } else {
      whenVisible(stage, vis => {
        composerOn = vis;
        if (vis) composerLoop(); else composerType.cancel();
      }, .35);
    }
  }

  /* ---------------------------------------------------------
     Manifesto: words light up as you scroll
     --------------------------------------------------------- */
  const manifesto = $('#manifesto');
  let words = [];
  if (manifesto) {
    const text = manifesto.textContent.trim();
    manifesto.setAttribute('aria-label', text);
    manifesto.innerHTML = text.split(/\s+/).map(w => `<span class="w" aria-hidden="true">${w}</span>`).join(' ');
    words = $$('.w', manifesto);
  }
  function updateManifesto() {
    if (!words.length) return;
    const r = manifesto.getBoundingClientRect(), vh = innerHeight;
    const p = reduced() ? 1 : clamp((vh * .82 - r.top) / (r.height + vh * .25), 0, 1);
    const lit = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('is-on', i < lit));
  }

  /* ---------------------------------------------------------
     Product tour: scale, tilt, tabs
     --------------------------------------------------------- */
  const frame = $('#showcase-frame');
  const tabsBar = $('.tabs');
  const tabs = $$('.tabs [role="tab"]');
  const panels = $$('.app__panel');
  const searchType = typer($('#search-typed'), 34);
  const results = $('.results');
  let tabIdx = 0;

  if (frame && 'ResizeObserver' in window) {
    new ResizeObserver(([entry]) => {
      frame.style.setProperty('--s', Math.min(1, entry.contentRect.width / 1100).toFixed(4));
    }).observe(frame);
  }
  function updateTilt() {
    if (!frame) return;
    if (reduced()) { frame.style.setProperty('--tilt', '0deg'); return; }
    const r = frame.getBoundingClientRect(), vh = innerHeight;
    const p = clamp((vh - r.top) / (vh * .7), 0, 1);
    frame.style.setProperty('--tilt', ((1 - easeInOut(p)) * 22).toFixed(2) + 'deg');
  }
  async function runSearch() {
    results.classList.remove('is-shown');
    await sleep(350);
    const finished = await searchType('sunny beach shots with people, landscape format');
    if (finished) results.classList.add('is-shown');
  }
  function showTab(i, focus = false) {
    tabIdx = i;
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p, k) => p.classList.toggle('is-active', k === i));
    if (focus) tabs[i].focus();
    if (i === 2) runSearch(); else searchType.cancel();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => showTab(i));
    t.addEventListener('keydown', e => {
      const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (dir) { e.preventDefault(); showTab((i + dir + tabs.length) % tabs.length, true); }
    });
    $('.tabs__bar', t).addEventListener('animationend', () => {
      if (!reduced() && t.getAttribute('aria-selected') === 'true') showTab((i + 1) % tabs.length);
    });
  });
  if (reduced() && results) results.classList.add('is-shown');
  whenVisible(frame, vis => tabsBar && tabsBar.classList.toggle('is-paused', !vis));

  /* ---------------------------------------------------------
     Pillars: sticky big type
     --------------------------------------------------------- */
  const pillarSec = $('#pillars');
  const pillars = $$('.pillar');
  const dots = $$('.pillars__dots li');
  let pillarIdx = 0;
  function updatePillars() {
    if (!pillarSec) return;
    const r = pillarSec.getBoundingClientRect();
    const total = pillarSec.offsetHeight - innerHeight;
    const p = clamp(-r.top / total, 0, .999);
    const i = Math.floor(p * pillars.length);
    if (i === pillarIdx) return;
    pillarIdx = i;
    pillars.forEach((el, k) => { el.classList.toggle('is-active', k === i); el.classList.toggle('is-past', k < i); });
    dots.forEach((d, k) => d.classList.toggle('is-on', k === i));
  }

  /* ---------------------------------------------------------
     Reveal on scroll (also starts the feature-card animations)
     --------------------------------------------------------- */
  const revealObs = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); }
  }), { threshold: .18, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach(el => revealObs.observe(el));

  /* ---------------------------------------------------------
     Forms (front-end only)
     --------------------------------------------------------- */
  const notifyForm = $('#notify-form');
  notifyForm.addEventListener('submit', e => {
    e.preventDefault();
    const input = $('input', notifyForm), msg = $('#notify-msg');
    if (!input.checkValidity() || !input.value.trim()) {
      notifyForm.classList.add('is-invalid');
      msg.textContent = 'Please enter a valid email address.';
      input.focus();
      return;
    }
    notifyForm.classList.remove('is-invalid');
    msg.textContent = "Thanks — you're on the list. We'll email you at launch.";
    notifyForm.reset();
  });

  const demoForm = $('#demo-form');
  demoForm.addEventListener('submit', e => {
    e.preventDefault();
    let firstBad = null;
    $$('input, select', demoForm).forEach(f => {
      const bad = !f.checkValidity() || !f.value.trim();
      f.classList.toggle('is-invalid', bad);
      f.setAttribute('aria-invalid', String(bad));
      if (bad && !firstBad) firstBad = f;
    });
    if (firstBad) { firstBad.focus(); return; }
    $('#form-ok').hidden = false;
    demoForm.reset();
  });
  demoForm.addEventListener('input', e => {
    if (e.target.classList.contains('is-invalid') && e.target.checkValidity()) {
      e.target.classList.remove('is-invalid');
      e.target.removeAttribute('aria-invalid');
    }
  });

  /* ---------------------------------------------------------
     Footer meadow: canvas grass that sways in the wind
     --------------------------------------------------------- */
  function Meadow(canvas) {
    const ctx = canvas.getContext('2d');
    const LAYERS = 7;
    let w = 0, h = 0, dpr = 1, layers = [], props = [], raf = 0, running = false;
    const FAR = ['#86c463', '#79b958', '#93cf6c', '#6fae52'];
    const MID = ['#56a03e', '#4b9437', '#62ad46', '#3f8731'];
    const NEAR = ['#2f7a2a', '#3a862f', '#276b24', '#46923a'];
    const mix = (a, b, t) => {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const c = [16, 8, 0].map(sh => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, t)));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    };
    const surface = x => {
      const u = x / w;
      return h * (.1 + .3 * Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 1.5) + .025 * Math.sin(u * 11));
    };

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const r = rng(11);
      layers = Array.from({ length: LAYERS }, () => FAR.map(() => []));
      const count = Math.round(w * (w < 700 ? 1.3 : 1.7));
      for (let i = 0; i < count; i++) {
        const d = Math.pow(r(), .8);
        const li = Math.min(LAYERS - 1, Math.floor(d * LAYERS));
        const x = -10 + r() * (w + 20);
        const top = surface(x);
        const y = top + d * (h - top + 30) + 6;
        const k = clamp(w / 1440, .55, 1.2);
        const bh = (16 + 78 * Math.pow(d, 1.25)) * (.7 + r() * .6) * k;
        const bw = (2.2 + 5.5 * d) * k;
        layers[li][Math.floor(r() * 4)].push({ x, y, bh, bw, ph: r() * Math.PI * 2, amp: .25 + r() * .35 });
      }
      const pr = rng(4);
      const P = [
        { type: 'mush', u: .2, d: .7, s: 1.15 }, { type: 'mush', u: .27, d: .45, s: .6 },
        { type: 'mush', u: .86, d: .78, s: .75 }, { type: 'flower', u: .45, d: .5, s: .7 },
        { type: 'flower', u: .9, d: .62, s: 1 }, { type: 'flower', u: .6, d: .85, s: 1.25 },
        { type: 'flower', u: .12, d: .35, s: .55 },
      ];
      props = P.map(p => {
        const x = p.u * w, top = surface(x);
        return { ...p, x, y: top + p.d * (h - top) * .82 + 4, li: Math.min(LAYERS - 1, Math.floor(p.d * LAYERS)), ph: pr() * 6 };
      });
    }

    function blade(b, t, wind) {
      const sway = (Math.sin(t * 1.4 + b.ph + b.x * .006) * b.amp + wind) * b.bh * .32;
      ctx.moveTo(b.x - b.bw / 2, b.y);
      ctx.quadraticCurveTo(b.x - b.bw * .2 + sway * .45, b.y - b.bh * .55, b.x + sway, b.y - b.bh);
      ctx.quadraticCurveTo(b.x + b.bw * .2 + sway * .45, b.y - b.bh * .55, b.x + b.bw / 2, b.y);
    }
    function mushroom(p, t) {
      const s = p.s * clamp(w / 1440, .6, 1.2) * 46;
      const lean = Math.sin(t * .8 + p.ph) * .03;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(lean);
      ctx.fillStyle = '#efe6d2';
      ctx.beginPath(); ctx.moveTo(-s * .22, 0); ctx.quadraticCurveTo(-s * .3, -s * .7, -s * .16, -s * 1.15); ctx.lineTo(s * .16, -s * 1.15); ctx.quadraticCurveTo(s * .3, -s * .7, s * .22, 0); ctx.fill();
      const g = ctx.createLinearGradient(0, -s * 1.9, 0, -s * 1.05);
      g.addColorStop(0, '#e2352b'); g.addColorStop(1, '#a8161b');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, -s * 1.12, s * .78, s * .62, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f6edd6';
      [[-.42, -1.32, .11], [.05, -1.55, .14], [.42, -1.3, .1], [-.12, -1.25, .07], [.25, -1.5, .06]].forEach(([dx, dy, rr]) => {
        ctx.beginPath(); ctx.ellipse(dx * s, dy * s, rr * s * 1.2, rr * s, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }
    function flower(p, t) {
      const s = p.s * clamp(w / 1440, .6, 1.2) * 34;
      const sway = Math.sin(t * 1.3 + p.ph) * s * .12;
      ctx.strokeStyle = '#2f6e27'; ctx.lineWidth = Math.max(1.5, s * .08);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x + sway * .4, p.y - s * 1.2, p.x + sway, p.y - s * 2.1); ctx.stroke();
      const cx = p.x + sway, cy = p.y - s * 2.2;
      ctx.fillStyle = '#d8262c';
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2 + p.ph;
        ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * s * .38, cy + Math.sin(a) * s * .3, s * .42, s * .3, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#2b2350';
      ctx.beginPath(); ctx.arc(cx, cy, s * .2, 0, Math.PI * 2); ctx.fill();
    }

    function draw(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // ground body
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 12) ctx.lineTo(x, surface(x) + 8);
      ctx.lineTo(w, h); ctx.closePath();
      const g = ctx.createLinearGradient(0, h * .1, 0, h);
      g.addColorStop(0, '#6aae4b'); g.addColorStop(.45, '#3f8a31'); g.addColorStop(1, '#1d5419');
      ctx.fillStyle = g; ctx.fill();

      const wind = Math.sin(t * .35) * .35 + Math.sin(t * .9) * .12;
      for (let li = 0; li < LAYERS; li++) {
        const depth = li / (LAYERS - 1);
        layers[li].forEach((bucket, ci) => {
          if (!bucket.length) return;
          const col = depth < .5 ? mix(FAR[ci], MID[ci], depth * 2) : mix(MID[ci], NEAR[ci], (depth - .5) * 2);
          ctx.fillStyle = col;
          ctx.beginPath();
          for (const b of bucket) blade(b, t, wind);
          ctx.fill();
        });
        props.forEach(p => { if (p.li === li) (p.type === 'mush' ? mushroom : flower)(p, t); });
      }
      // aerial haze: the far ridge fades softly into the sky
      const haze = ctx.createLinearGradient(0, 0, 0, h);
      haze.addColorStop(0, 'rgba(255,236,226,.3)');
      haze.addColorStop(.3, 'rgba(255,236,226,.12)');
      haze.addColorStop(.62, 'rgba(255,236,226,0)');
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = haze; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    function loop(now) {
      draw(now / 1000);
      if (running) raf = requestAnimationFrame(loop);
    }
    return {
      build() { build(); draw(performance.now() / 1000); },
      start() { if (running || reduced()) return; running = true; raf = requestAnimationFrame(loop); },
      stop() { running = false; cancelAnimationFrame(raf); },
    };
  }
  const grassCanvas = $('#grass');
  const meadow = grassCanvas && grassCanvas.getContext ? Meadow(grassCanvas) : null;
  if (meadow) {
    meadow.build();
    whenVisible(grassCanvas, vis => (vis ? meadow.start() : meadow.stop()));
  }

  /* ---------------------------------------------------------
     Scroll + resize plumbing
     --------------------------------------------------------- */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateWordmark();
      updateManifesto();
      updateTilt();
      updatePillars();
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });

  let resizeT = 0, lastW = innerWidth;
  addEventListener('resize', () => {
    layoutWordmark();
    onScroll();
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (Math.abs(innerWidth - lastW) > 40) { buildClouds(); lastW = innerWidth; }
      if (meadow) meadow.build();
    }, 200);
  });

  const start = () => { layoutWordmark(); onScroll(); updatePillars(); };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start);
  start();
})();
