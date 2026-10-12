/*!
 * dot-story.js
 * One field of dots that tells a story as the page scrolls. The same dots become, in turn:
 *   - an animated 3D character (a rigged GLB rendered off-screen every frame and sampled as dots),
 *     with the same gait, leaps and stillness as scroll-3d-hero's animated models;
 *   - sand in an hourglass, pouring in, draining through the neck and running back out;
 *   - a dotted brand wordmark at the bottom of the page.
 * The pointer scatters the dots in every form, and they spring back.
 *
 * Needs the import map for "three" / "three/addons/" and scroll-3d-hero.js next to this file.
 *
 *   import { createDotStory } from './dot-story.js';
 *   createDotStory({ canvas: '#dots', character: {...}, hourglass: {...}, logo: {...}, keyframes: [...] });
 *
 * Keyframes interpolate per property between the keyframes that set it:
 *   at        progress 0..1 of the whole page, or a selector (that element's top at the viewport top);
 *             `after` adds screens, e.g. { at: '#story', after: 0.5 }
 *   x, y      character centre in viewport units (-1 left/bottom, 1 right/top), or `anchor: selector`
 *   size      character length as a fraction of the viewport's shorter side
 *   pitch     nose up (+) / down (-) in degrees, whichever way it faces
 *   clip, clipTime   scrub an animation clip with the scroll between two keyframes (in cycles)
 *   form      'character' | 'hourglass' | 'logo': what the dots form; between two keyframes with
 *             different forms the dots move across one by one
 *   sand      0..1, how much has drained into the hourglass's lower bulb
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createAnimator, normalizeObject } from './scroll-3d-hero.js';

const DEG = Math.PI / 180;
const NUM_KEYS = ['x', 'y', 'size', 'pitch', 'sand'];
const NUM_DEFAULTS = { x: 0, y: 0, size: 0.3, pitch: 0, sand: 0 };

const EASE = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - (1 - t) ** 3,
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

const DEFAULTS = {
  canvas: '#dots', // a full-viewport canvas (position: fixed); its CSS `color` is the dot colour
  character: null, // { url | buffer, animation: { idle, walk, run, still, face }, rotate }
  hourglass: null, // { anchor: '#hourglass', panel: '#panel' }: the box it fills, and an optional dark panel
  logo: null, // { anchor: '#logo', text: 'ACME', fontFamily, fontWeight, fontStretch, ... }
  keyframes: [],
  responsive: {}, // { '(max-width: 767px)': { keyframes: [...] } }
  gap: 4, // dot spacing for the character and the sand, in CSS px
  dotSize: 0.68, // dot diameter as a fraction of the spacing
  particles: 2400, // pool size when there's no logo (with a logo, the pool matches its dot count)
  damping: 8, // how quickly the story catches up with the scrollbar
  pointer: { radius: 64, force: 5 },
  debug: false, // or ?dots-debug in the URL
};

export function createDotStory(userOptions = {}) {
  const base = { ...DEFAULTS, ...userOptions, pointer: { ...DEFAULTS.pointer, ...(userOptions.pointer || {}) } };
  const canvas = typeof base.canvas === 'string' ? document.querySelector(base.canvas) : base.canvas;
  if (!canvas) throw new Error(`[dot-story] canvas "${base.canvas}" not found`);
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const debug = base.debug || new URLSearchParams(location.search).has('dots-debug');
  const sprites = { ink: document.createElement('canvas'), panel: document.createElement('canvas') };
  const pointer = { x: 0, y: 0, until: 0 };

  let opts = base;
  let frames = [];
  let tracks = {};
  let vw = 1, vh = 1, dpr = 1, range = 1;
  let target = 0, smooth = 0, lastTime = 0, rafId = 0, destroyed = false, ready = false, lastScrollY = -1;
  let N = 0, px, py, vx, vy, ease, fric, rank;
  let dotR = 1.3, spriteR = 0, colors = { ink: '#222', panel: '#eee' };
  let debugEl = null;

  /* ---------- keyframes ---------- */

  function computeOptions() {
    let o = base;
    for (const [q, over] of Object.entries(base.responsive || {})) if (matchMedia(q).matches) o = { ...o, ...over };
    return o;
  }

  function resolveAt(kf, index, count) {
    let at = kf.at ?? index / Math.max(1, count - 1);
    if (typeof at === 'string') {
      const el = document.querySelector(at);
      if (!el) {
        console.warn(`[dot-story] keyframe "at" target "${at}" not found`);
        at = 0;
      } else {
        at = (el.getBoundingClientRect().top + window.scrollY + (kf.after || 0) * vh) / range;
      }
    } else if (kf.after) {
      at += (kf.after * vh) / range;
    }
    return Math.min(1, Math.max(0, at));
  }

  function buildFrames() {
    const list = opts.keyframes || [];
    frames = list
      .map((kf, index) => {
        const f = { index, at: resolveAt(kf, index, list.length), ease: EASE[kf.ease] || (typeof kf.ease === 'function' ? kf.ease : EASE.easeInOut), v: {} };
        for (const k of NUM_KEYS) if (typeof kf[k] === 'number') f.v[k] = kf[k];
        if (kf.anchor) {
          f.anchor = document.querySelector(kf.anchor);
          if (!f.anchor) console.warn(`[dot-story] anchor "${kf.anchor}" not found`);
          f.ox = kf.x || 0;
          f.oy = kf.y || 0;
        }
        if (typeof kf.clipTime === 'number') f.clipTime = kf.clipTime;
        if (kf.clip) f.clip = kf.clip;
        if (kf.form) f.form = kf.form;
        return f;
      })
      .sort((a, b) => a.at - b.at || a.index - b.index);
    tracks = {};
    for (const k of NUM_KEYS) {
      tracks[k] = frames.filter((f) => f.v[k] !== undefined || (f.anchor && (k === 'x' || k === 'y')));
    }
    tracks.clip = frames.filter((f) => f.clipTime !== undefined);
    tracks.form = frames.filter((f) => f.form);
  }

  function valueOf(f, k) {
    if (f.anchor && (k === 'x' || k === 'y')) {
      const r = f.anchor.getBoundingClientRect();
      return k === 'x' ? ((r.left + r.width / 2) / vw) * 2 - 1 + f.ox : 1 - ((r.top + r.height / 2) / vh) * 2 + f.oy;
    }
    return f.v[k];
  }

  function sample(k, p) {
    const list = tracks[k];
    if (!list || !list.length) return NUM_DEFAULTS[k];
    if (p <= list[0].at) return valueOf(list[0], k);
    for (let i = 1; i < list.length; i++) {
      const b = list[i];
      if (p <= b.at) {
        const a = list[i - 1];
        const t = b.at - a.at > 1e-6 ? (p - a.at) / (b.at - a.at) : 1;
        const va = valueOf(a, k);
        return va + (valueOf(b, k) - va) * b.ease(t);
      }
    }
    return valueOf(list[list.length - 1], k);
  }

  function sampleClip(p) {
    const list = tracks.clip;
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      if (p >= a.at && p <= b.at && a.clip && a.clip === b.clip) {
        const t = b.at - a.at > 1e-6 ? (p - a.at) / (b.at - a.at) : 1;
        return { clip: a.clip, cycles: a.clipTime + (b.clipTime - a.clipTime) * b.ease(t) };
      }
    }
    return null;
  }

  // what the dots form at p: form `a`, moving over to form `b` by `blend` (0..1)
  function sampleForm(p) {
    const list = tracks.form;
    if (!list.length) return { a: 'character', b: 'character', blend: 0 };
    if (p <= list[0].at) return { a: list[0].form, b: list[0].form, blend: 0 };
    for (let i = 1; i < list.length; i++) {
      const b = list[i];
      if (p <= b.at) {
        const a = list[i - 1];
        const t = b.at - a.at > 1e-6 ? (p - a.at) / (b.at - a.at) : 1;
        return { a: a.form, b: b.form, blend: a.form === b.form ? 0 : b.ease(t) };
      }
    }
    const last = list[list.length - 1].form;
    return { a: last, b: last, blend: 0 };
  }

  /* ---------- the character, sampled as dots ---------- */

  const character = {
    renderer: null, scene: null, camera: null, rt: null, buf: null, holder: null,
    yawGroup: null, tiltGroup: null, pitchGroup: null, anim: null,
    pts: new Float32Array(0), count: 0, w: 0, h: 0,
    last: null, speed: 0, vx: 0, dir: 0, yaw: 0, snap: true, moved: false,
  };

  async function loadCharacter(src) {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: false });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    // an orthographic side view, in units of the character's length
    const camera = new THREE.OrthographicCamera(-0.8, 0.8, 0.6, -0.6, -10, 10);
    camera.position.set(0, 0, 5);
    const loader = new GLTFLoader();
    const gltf = src.buffer ? await loader.parseAsync(src.buffer, '') : await loader.loadAsync(src.url);
    const object = gltf.scene;
    object.traverse((n) => {
      if (n.isSkinnedMesh) n.frustumCulled = false;
    });
    const holder = normalizeObject(object, src.rotate);
    const yawGroup = new THREE.Group();
    const tiltGroup = new THREE.Group();
    const pitchGroup = new THREE.Group();
    yawGroup.add(holder);
    tiltGroup.add(yawGroup);
    pitchGroup.add(tiltGroup);
    tiltGroup.rotation.x = (src.tilt ?? 8) * DEG; // a little of its back shows, as in the 3D version
    scene.add(pitchGroup);
    Object.assign(character, { renderer, scene, camera, holder, yawGroup, tiltGroup, pitchGroup });
    if (src.animation && gltf.animations.length) character.anim = createAnimator(object, gltf.animations, src.animation);
  }

  // Render the posed character into a tiny target (one pixel per dot) and read back which cells it covers.
  function sampleCharacter(pose, dt, p) {
    const c = character;
    if (!c.renderer) return;
    const len = Math.max(8, pose.size * Math.min(vw, vh));
    const gap = opts.gap;
    const w = Math.max(4, Math.ceil((1.6 * len) / gap));
    const h = Math.max(4, Math.ceil((1.2 * len) / gap));
    if (!c.rt || c.w !== w || c.h !== h) {
      c.rt?.dispose();
      c.rt = new THREE.WebGLRenderTarget(w, h);
      c.buf = new Uint8Array(w * h * 4);
      c.w = w;
      c.h = h;
    }
    const cx = ((pose.x + 1) / 2) * vw;
    const cy = ((1 - pose.y) / 2) * vh;

    // gait, facing and scrubbed clips, as in scroll-3d-hero
    let speed = 0;
    let vxs = 0;
    if (c.last && dt > 1e-4) {
      vxs = (cx - c.last.x) / dt / len;
      speed = Math.hypot(vxs, (cy - c.last.y) / dt / len);
    }
    c.last = { x: cx, y: cy };
    const k = 1 - Math.exp(-dt / 0.15);
    c.speed += (speed - c.speed) * k;
    c.vx += (vxs - c.vx) * k;
    const anim = c.anim;
    if (anim) anim.update(dt, c.speed, reduce.matches, sampleClip(p));
    const conf = anim ? anim.conf : { walkAbove: 0.08, face: true, still: 'pose' };
    const face = { moving: 90, idle: 75, start: 1, ...(conf.face && conf.face !== true ? conf.face : {}) };
    if (!c.dir) c.dir = face.start;
    if (Math.abs(c.vx) > conf.walkAbove * 0.5) c.dir = Math.sign(c.vx);
    const state = anim ? anim.state : 'idle';
    if (state !== 'idle') c.moved = true;
    const atRest = state === 'idle' && (conf.still === 'idle' || !c.moved);
    const yaw = c.dir * (atRest ? face.idle : face.moving) * DEG;
    c.yaw = c.snap ? yaw : c.yaw + (yaw - c.yaw) * (1 - Math.exp(-dt * 5));
    c.snap = false;
    c.yawGroup.rotation.y = c.yaw;
    c.pitchGroup.rotation.z = pose.pitch * DEG * c.dir; // nose up, whichever way it faces

    c.renderer.setRenderTarget(c.rt);
    c.renderer.clear();
    c.renderer.render(c.scene, c.camera);
    c.renderer.readRenderTargetPixels(c.rt, 0, 0, w, h, c.buf);
    c.renderer.setRenderTarget(null);

    if (c.pts.length < w * h * 2) c.pts = new Float32Array(w * h * 2);
    let m = 0;
    for (let yy = h - 1; yy >= 0; yy--) {
      // top row first, so dot order runs top-left to bottom-right
      for (let xx = 0; xx < w; xx++) {
        if (c.buf[(yy * w + xx) * 4 + 3] > 127) {
          c.pts[m * 2] = cx + (xx + 0.5 - w / 2) * gap;
          c.pts[m * 2 + 1] = cy - (yy + 0.5 - h / 2) * gap;
          m++;
        }
      }
    }
    c.count = m;
  }

  /* ---------- the hourglass ---------- */

  // Shared shape (box units): half-width of the glass at height v, 0..1 from top to bottom.
  const HG = { v0: 0.05, v1: 0.95, neck: 0.03, max: 0.4 };
  function halfWidth(v) {
    const t = Math.min(1, Math.abs(v - 0.5) / (0.5 - HG.v0));
    return HG.neck + (HG.max - HG.neck) * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2));
  }

  const hourglass = { el: null, panel: null, w: 0, h: 0, top: null, bottom: null, topN: 0, bottomN: 0 };

  function hourglassPath() {
    // the glass outline in a 100 x 150 viewBox; the sand cells use the same halfWidth()
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const v = HG.v0 + ((HG.v1 - HG.v0) * i) / 60;
      pts.push([(0.5 + halfWidth(v)) * 100, v * 150]);
    }
    const right = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`);
    const left = pts.reverse().map(([x, y]) => `${(100 - x).toFixed(2)},${y.toFixed(2)}`);
    return `M${right.join(' L')} L${left.join(' L')} Z`;
  }

  function buildHourglassCells() {
    const r = hourglass.el.getBoundingClientRect();
    if (!r.width || (r.width === hourglass.w && r.height === hourglass.h)) return;
    hourglass.w = r.width;
    hourglass.h = r.height;
    const gap = opts.gap;
    const wall = (gap * 1.1) / r.width;
    const top = [];
    const bottom = [];
    for (let y = gap / 2; y < r.height; y += gap) {
      const v = y / r.height;
      if (v < HG.v0 + 0.01 || v > HG.v1 - 0.01 || Math.abs(v - 0.5) < 0.012) continue;
      for (let x = gap / 2; x < r.width; x += gap) {
        const u = x / r.width;
        if (Math.abs(u - 0.5) < halfWidth(v) - wall) (v < 0.5 ? top : bottom).push([x, y, u, v]);
      }
    }
    // the top bulb drains from the neck upwards; the bottom bulb fills as a mound from the base
    top.sort((a, b) => b[3] - a[3] || Math.abs(a[2] - 0.5) - Math.abs(b[2] - 0.5));
    bottom.sort((a, b) => (1 - a[3]) + Math.abs(a[2] - 0.5) * 0.7 - ((1 - b[3]) + Math.abs(b[2] - 0.5) * 0.7));
    hourglass.top = Float32Array.from(top.flatMap((c) => [c[0], c[1]]));
    hourglass.bottom = Float32Array.from(bottom.flatMap((c) => [c[0], c[1]]));
    hourglass.topN = top.length;
    hourglass.bottomN = bottom.length;
  }

  /* ---------- the logo ---------- */

  const logo = { el: null, pts: new Float32Array(0), count: 0, gap: 4, width: 0 };

  function setFont(c, size, o) {
    c.font = `${o.fontWeight || 800} ${size}px "${o.fontFamily || 'Archivo'}", "Arial Black", sans-serif`;
    if ('fontStretch' in c) c.fontStretch = o.fontStretch || 'expanded';
  }

  function textWidth(c, str, size, o) {
    setFont(c, size, o);
    let w = 0;
    for (const ch of str) w += c.measureText(ch).width;
    return w + (o.tracking ?? 0.03) * size * (str.length - 1);
  }

  function layoutLogo() {
    const o = opts.logo;
    const width = logo.el.clientWidth;
    if (!width) return false;
    logo.width = width;
    const m = document.createElement('canvas').getContext('2d');
    const fit = (str) => ({ str, size: (100 * width * 0.995) / textWidth(m, str, 100, o) });
    const one = fit(o.text);
    const lines = one.size >= (o.stackBelow ?? 56) || !o.text.includes(' ') ? [one] : o.text.split(/\s+/).map(fit);
    const cap = o.capHeight ?? 0.72;
    const minCap = Math.min(...lines.map((l) => l.size)) * cap;
    const gap = Math.max(o.minGap ?? 2.5, Math.min(o.maxGap ?? 7, minCap / (o.dotsPerCap ?? 15)));
    const lineGap = gap * 4;
    const textH = lines.reduce((s, l) => s + l.size * cap, 0) + lineGap * (lines.length - 1);
    const H = Math.ceil(textH + gap * 2);
    logo.el.style.height = `${H}px`;
    const off = document.createElement('canvas');
    off.width = Math.ceil(width);
    off.height = H;
    const oc = off.getContext('2d', { willReadFrequently: true });
    let baseline = 0;
    for (const line of lines) {
      baseline += line.size * cap;
      let x = (width - textWidth(oc, line.str, line.size, o)) / 2;
      for (const ch of line.str) {
        oc.fillText(ch, x, baseline);
        x += oc.measureText(ch).width + (o.tracking ?? 0.03) * line.size;
      }
      baseline += lineGap;
    }
    const data = oc.getImageData(0, 0, off.width, off.height).data;
    const pts = [];
    for (let x = gap / 2; x < width; x += gap) {
      // column by column, so the wordmark builds up from left to right
      for (let y = gap / 2; y < H; y += gap) {
        if (data[((y | 0) * off.width + (x | 0)) * 4 + 3] > 127) pts.push(x, y);
      }
    }
    logo.pts = Float32Array.from(pts);
    logo.count = pts.length / 2;
    logo.gap = gap;
    return true;
  }

  /* ---------- particles ---------- */

  function allocate(n) {
    N = n;
    px = new Float32Array(n);
    py = new Float32Array(n);
    vx = new Float32Array(n);
    vy = new Float32Array(n);
    ease = new Float32Array(n);
    fric = new Float32Array(n);
    rank = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      px[i] = Math.random() * vw;
      py[i] = vh + Math.random() * vh; // start below the screen; they gather into the first form
      ease[i] = 0.06 + Math.random() * 0.06;
      fric[i] = 0.8 + Math.random() * 0.12;
      // the order dots switch between forms: mostly in sequence, with some scatter
      rank[i] = Math.min(0.999, (i / n) * 0.82 + Math.random() * 0.18);
    }
  }

  function drawSprites() {
    for (const [key, sprite] of Object.entries(sprites)) {
      const size = Math.ceil(dotR * 2 * dpr) + 2;
      sprite.width = sprite.height = size;
      const s = sprite.getContext('2d');
      s.fillStyle = colors[key];
      s.beginPath();
      s.arc(size / 2, size / 2, dotR * dpr, 0, Math.PI * 2);
      s.fill();
      spriteR = size / 2;
    }
  }

  function readColors() {
    const cs = getComputedStyle(canvas);
    colors.ink = cs.color || colors.ink;
    colors.panel = cs.getPropertyValue('--panel-dots').trim() || colors.panel;
    drawSprites();
  }

  /* ---------- per frame ---------- */

  const out = { x: 0, y: 0 };
  function targetFor(form, i, ctxForm) {
    if (form === 'character') {
      const m = character.count;
      if (!m) return false;
      const j = Math.min(m - 1, Math.floor((i * m) / N));
      out.x = character.pts[j * 2];
      out.y = character.pts[j * 2 + 1];
      return true;
    }
    if (form === 'hourglass') {
      const hg = ctxForm.hg;
      if (!hg) return false;
      if (i < hg.kBottom) {
        const j = i % hourglass.bottomN;
        out.x = hg.left + hourglass.bottom[j * 2];
        out.y = hg.top + hourglass.bottom[j * 2 + 1];
      } else if (i < hg.kBottom + hg.stream) {
        // a thin stream through the neck: each dot moves down a slot as the next one lands
        const slot = i - hg.kBottom;
        const t = (slot + 0.5) / hg.stream;
        out.x = hg.left + hourglass.w / 2 + ((slot % 2) - 0.5) * opts.gap * 0.6;
        out.y = hg.top + hg.surfaceY + (hg.neckY - hg.surfaceY) * t;
      } else {
        const j = (i - hg.kBottom - hg.stream) % hourglass.topN;
        out.x = hg.left + hourglass.top[j * 2];
        out.y = hg.top + hourglass.top[j * 2 + 1];
      }
      return true;
    }
    if (form === 'logo') {
      if (!logo.count) return false;
      const j = i % logo.count;
      out.x = ctxForm.logoLeft + logo.pts[j * 2];
      out.y = ctxForm.logoTop + logo.pts[j * 2 + 1];
      return true;
    }
    return false;
  }

  function frame(now) {
    rafId = 0;
    const dt = Math.min(0.1, lastTime ? (now - lastTime) / 1000 : 1 / 60);
    lastTime = now;
    const step = dt * 60;

    target = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0;
    if (!ready || reduce.matches || opts.damping <= 0) smooth = target;
    else {
      smooth += (target - smooth) * (1 - Math.exp(-opts.damping * dt));
      if (Math.abs(target - smooth) < 1e-5) smooth = target;
    }
    const p = smooth;
    const pose = {};
    for (const k of NUM_KEYS) pose[k] = sample(k, p);
    const form = sampleForm(p);
    const uses = (f) => form.a === f || (form.blend > 0 && form.b === f);

    const fctx = { hg: null, logoLeft: 0, logoTop: 0 };
    if (uses('character')) sampleCharacter(pose, dt, p);
    else character.last = null;
    if (uses('hourglass') && hourglass.el) {
      buildHourglassCells();
      const r = hourglass.el.getBoundingClientRect();
      const sand = Math.min(1, Math.max(0, pose.sand));
      const stream = Math.round(Math.min(22, Math.min(sand, 1 - sand) * 400));
      const kBottom = Math.round(sand * (N - stream));
      const last = Math.min(hourglass.bottomN - 1, Math.max(0, kBottom - 1));
      const surfaceY = kBottom > 0 ? hourglass.bottom[last * 2 + 1] : HG.v1 * r.height;
      fctx.hg = { left: r.left, top: r.top, kBottom, stream, neckY: 0.5 * r.height, surfaceY };
    }
    if (uses('logo') && logo.el) {
      const r = logo.el.getBoundingClientRect();
      fctx.logoLeft = r.left;
      fctx.logoTop = r.top;
    }

    // physics: spring to the target, scatter from the pointer
    const R = opts.pointer.radius;
    const R2 = R * R;
    const active = now < pointer.until && !reduce.matches;
    let moving = false;
    // leaving the hourglass, the last sand to land leaves first, so the mound shrinks from the top
    const reverse = form.a === 'hourglass';
    for (let i = 0; i < N; i++) {
      const f = form.blend > 0 && (reverse ? 1 - rank[i] : rank[i]) < form.blend ? form.b : form.a;
      if (targetFor(f, i, fctx)) {
        if (reduce.matches) {
          px[i] = out.x;
          py[i] = out.y;
          continue;
        }
        if (active) {
          const dx = px[i] - pointer.x;
          const dy = py[i] - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 1e-4) {
            const d = Math.sqrt(d2);
            const push = (1 - d / R) * opts.pointer.force * (0.5 + Math.random()) * step;
            vx[i] += (dx / d) * push + (Math.random() - 0.5) * 0.6 * step;
            vy[i] += (dy / d) * push + (Math.random() - 0.5) * 0.6 * step;
          }
        }
        const fr = Math.pow(fric[i], step);
        const kk = 1 - Math.pow(1 - ease[i], step);
        vx[i] *= fr;
        vy[i] *= fr;
        px[i] += vx[i] * step + (out.x - px[i]) * kk;
        py[i] += vy[i] * step + (out.y - py[i]) * kk;
        if (!moving && (Math.abs(out.x - px[i]) + Math.abs(out.y - py[i]) > 0.2 || Math.abs(vx[i]) + Math.abs(vy[i]) > 0.05)) moving = true;
      }
    }
    paint();

    // only clips that play in time keep the loop going; scrubbed and held poses are static
    const st = character.anim && uses('character') ? character.anim.state : 'idle';
    const animating = st === 'walk' || st === 'run' || st === 'manual' || (st === 'idle' && character.anim?.conf.still === 'idle');
    const settled = !moving && !active && smooth === target && !animating;
    canvas.dataset.settled = String(settled);
    if (debugEl) {
      debugEl.textContent =
        `dot-story  progress ${p.toFixed(3)}  form ${form.a}${form.blend > 0 ? ` → ${form.b} ${(form.blend * 100) | 0}%` : ''}\n` +
        `x ${pose.x.toFixed(2)} y ${pose.y.toFixed(2)} size ${pose.size.toFixed(2)} pitch ${pose.pitch.toFixed(0)} sand ${pose.sand.toFixed(2)}\n` +
        `dots ${N}  character ${character.count}  ${character.anim ? character.anim.state : ''}`;
    }
    if (!settled) schedule();
    else lastTime = 0;
  }

  function paint() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < N; i++) ctx.drawImage(sprites.ink, px[i] * dpr - spriteR, py[i] * dpr - spriteR);
    // inside the dark panel the dots switch to the panel colour
    const panel = hourglass.panel;
    if (panel) {
      const r = panel.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(r.left * dpr, r.top * dpr, r.width * dpr, r.height * dpr);
        ctx.clip();
        ctx.clearRect(r.left * dpr, r.top * dpr, r.width * dpr, r.height * dpr);
        for (let i = 0; i < N; i++) {
          const x = px[i];
          const y = py[i];
          if (x > r.left - 4 && x < r.right + 4 && y > r.top - 4 && y < r.bottom + 4) {
            ctx.drawImage(sprites.panel, x * dpr - spriteR, y * dpr - spriteR);
          }
        }
        ctx.restore();
      }
    }
  }

  function schedule() {
    if (rafId || destroyed) return;
    rafId = requestAnimationFrame(frame);
  }

  /* ---------- layout ---------- */

  function layout() {
    opts = computeOptions();
    vw = window.innerWidth;
    vh = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    range = Math.max(1, document.documentElement.scrollHeight - vh);
    if (logo.el) layoutLogo();
    hourglass.w = 0; // rebuild the sand cells for the new size
    buildFrames();
    const n = logo.count || opts.particles;
    if (n !== N) allocate(n);
    dotR = (opts.dotSize * Math.min(opts.gap, logo.count ? logo.gap : opts.gap)) / 2;
    readColors();
    schedule();
  }

  let layoutQueued = false;
  const queueLayout = () => {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      layout();
    });
  };

  const onScroll = () => {
    if (window.scrollY !== lastScrollY) {
      lastScrollY = window.scrollY;
      schedule();
    }
  };
  const onPointer = (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.until = performance.now() + 120;
    schedule();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('resize', queueLayout);
  const ro = new ResizeObserver(queueLayout);
  ro.observe(document.body);
  const themeObserver = new MutationObserver(() => {
    readColors();
    schedule();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    readColors();
    schedule();
  });
  Object.keys(base.responsive || {}).forEach((q) => matchMedia(q).addEventListener('change', queueLayout));

  if (debug) {
    debugEl = document.createElement('div');
    debugEl.style.cssText =
      'position:fixed;left:12px;bottom:12px;z-index:2147483647;pointer-events:none;white-space:pre;' +
      'font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#fff;background:rgba(0,0,0,.78);padding:8px 10px;border-radius:8px';
    document.body.appendChild(debugEl);
  }

  /* ---------- start ---------- */

  if (base.hourglass) {
    hourglass.el = document.querySelector(base.hourglass.anchor);
    hourglass.panel = base.hourglass.panel ? document.querySelector(base.hourglass.panel) : null;
    const path = hourglass.el && hourglass.el.querySelector('[data-hourglass-glass]');
    if (path) path.setAttribute('d', hourglassPath());
  }
  if (base.logo) {
    logo.el = document.querySelector(base.logo.anchor);
    if (logo.el && !logo.el.getAttribute('aria-label')) logo.el.setAttribute('aria-label', base.logo.text);
  }

  const font = base.logo ? `${base.logo.fontWeight || 800} ${base.logo.fontStretch || 'expanded'} 100px "${base.logo.fontFamily || 'Archivo'}"` : null;
  const fontReady = font && document.fonts?.load ? document.fonts.load(font).catch(() => {}) : Promise.resolve();
  const timeout = new Promise((res) => setTimeout(res, 2500));
  const charReady = base.character ? loadCharacter(base.character) : Promise.resolve();

  const api = {
    get progress() {
      return smooth;
    },
    get particles() {
      return N;
    },
    relayout: queueLayout,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', queueLayout);
      ro.disconnect();
      themeObserver.disconnect();
      character.anim?.dispose();
      character.renderer?.dispose();
      debugEl?.remove();
    },
    ready: null,
  };

  api.ready = Promise.all([Promise.race([fontReady, timeout]), charReady]).then(() => {
    layout();
    ready = true;
    canvas.dataset.ready = 'true';
    canvas.classList.add('is-ready');
    fontReady.then(() => logo.el && queueLayout()); // re-sample the logo if the font arrives late
    return api;
  });
  api.ready.catch((err) => console.error('[dot-story] could not start', err));
  return api;
}
