/*!
 * dot-wordmark.js
 * A wordmark made of dots, for the bottom of a page. The text is drawn off-screen, sampled on a
 * grid, and every filled sample becomes a dot. The dots fly in when the canvas scrolls into view,
 * scatter away from the pointer (or a finger) and spring back into place.
 *
 * No dependencies. Works with or without scroll-3d-hero.js.
 *
 *   <canvas id="wordmark" class="dot-wordmark" aria-label="Acme Naturals"></canvas>
 *   import { createDotWordmark } from './dot-wordmark.js';
 *   createDotWordmark('#wordmark', { text: 'ACME NATURALS' });
 *   createDotWordmark('#wordmark', { image: '/logo.svg' }); // or sample a logo instead of text
 *
 * The dot colour is the canvas's CSS `color`, so set it from a theme token.
 */

const DEFAULTS = {
  text: '', // defaults to the canvas's aria-label
  image: null, // URL or <img> of a logo to sample instead of text (same-origin or CORS-enabled)
  maxHeight: Infinity, // for an image: the tallest it may be drawn, in CSS px
  sample: 'alpha', // which pixels become dots: 'alpha' (any opaque pixel), 'dark' or 'light' (for logos
  //                  with white cut-outs, or drawn on a solid background)
  fontFamily: 'Archivo', // load it with the weight (and width) you use, e.g. from Google Fonts
  fontWeight: 800,
  fontStretch: 'expanded', // wide letters read best as dots; ignored where canvas lacks fontStretch
  fallbackFonts: '"Arial Black", sans-serif',
  tracking: 0.03, // extra space between letters, in em
  capHeight: 0.72, // the font's cap height as a fraction of its size (about 0.7 for most sans faces)
  dotsPerCap: 15, // grid rows across one capital letter (or the whole image); more = finer dots
  minGap: 2.5, // grid spacing limits, in CSS px
  maxGap: 7,
  dotSize: 0.68, // dot diameter as a fraction of the grid spacing
  stackBelow: 56, // if one line would be smaller than this font size (px), put each word on its own line
  lineGap: 4, // space between stacked lines, in grid cells
  flyIn: 0.8, // room above the letters for the fly-in, as a fraction of the text height; 0 = none
  intro: 'scatter', // 'scatter' (dots fly in) or 'none' (dots start in place)
  radius: 14, // pointer influence radius, in grid cells (never less than 50px)
  force: 5, // how hard the pointer pushes dots away
  color: null, // defaults to the canvas's CSS color
  threshold: 0.3, // how much of the canvas must be visible before the intro plays
  onSettle: null, // () => {} each time the dots come to rest
};

export function createDotWordmark(target, options = {}) {
  const canvas = typeof target === 'string' ? document.querySelector(target) : target;
  if (!canvas || !canvas.getContext) throw new Error(`[dot-wordmark] canvas "${target}" not found`);
  const o = { ...DEFAULTS, ...options };
  const text = o.text || canvas.getAttribute('aria-label') || '';
  if (!text && !o.image) throw new Error('[dot-wordmark] no text: pass { text } or { image }, or set aria-label on the canvas');
  if (!canvas.hasAttribute('role')) canvas.setAttribute('role', 'img');
  if (!canvas.hasAttribute('aria-label') && text) canvas.setAttribute('aria-label', text);
  if (!canvas.getAttribute('aria-label')) console.warn('[dot-wordmark] give the canvas an aria-label naming the logo');
  canvas.dataset.dotWordmark = '';

  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const darkScheme = matchMedia('(prefers-color-scheme: dark)');
  const sprite = document.createElement('canvas'); // one pre-drawn dot, stamped for every particle
  const pointer = { x: 0, y: 0, until: 0 };
  let W = 0, H = 0, dpr = 1, gap = 4, r = 1.3, spriteR = 0, color = '#999', lastWidth = 0;
  let n = 0, ox, oy, px, py, vx, vy, ease, fric;
  let started = false, played = false, rafId = 0, lastTime = 0, destroyed = false, usedFont = false;
  let logo = null; // the loaded image, when sampling a logo

  /* ---------- text layout ---------- */

  function setFont(c, size) {
    c.font = `${o.fontWeight} ${size}px "${o.fontFamily}", ${o.fallbackFonts}`;
    if ('fontStretch' in c) c.fontStretch = o.fontStretch;
  }

  function lineWidth(c, str, size) {
    setFont(c, size);
    let w = 0;
    for (const ch of str) w += c.measureText(ch).width;
    return w + o.tracking * size * (str.length - 1);
  }

  function fit(str, width) {
    return { str, size: (100 * width) / lineWidth(ctx, str, 100) };
  }

  function chooseLines(width) {
    const one = fit(text, width);
    if (one.size >= o.stackBelow || !text.includes(' ')) return [one];
    return text.split(/\s+/).map((word) => fit(word, width));
  }

  function drawLine(c, line, baseline) {
    let x = (W - lineWidth(c, line.str, line.size)) / 2;
    for (const ch of line.str) {
      c.fillText(ch, x, baseline);
      x += c.measureText(ch).width + o.tracking * line.size;
    }
  }

  function layout() {
    if (destroyed) return;
    const width = canvas.clientWidth;
    if (!width) return;
    lastWidth = width;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    let textH, draw;
    if (logo) {
      const iw = logo.naturalWidth || logo.width;
      const ih = logo.naturalHeight || logo.height;
      const scale = Math.min((width * 0.995) / iw, o.maxHeight / ih);
      const dw = iw * scale;
      textH = ih * scale;
      gap = Math.max(o.minGap, Math.min(o.maxGap, textH / o.dotsPerCap));
      draw = (c, top) => c.drawImage(logo, (W - dw) / 2, top, dw, textH);
    } else {
      const lines = chooseLines(width * 0.995);
      const minCap = Math.min(...lines.map((l) => l.size)) * o.capHeight;
      gap = Math.max(o.minGap, Math.min(o.maxGap, minCap / o.dotsPerCap));
      const lineGap = gap * o.lineGap;
      textH = lines.reduce((h, l) => h + l.size * o.capHeight, 0) + lineGap * (lines.length - 1);
      draw = (c, top) => {
        let baseline = top;
        for (const line of lines) {
          baseline += line.size * o.capHeight;
          drawLine(c, line, baseline);
          baseline += lineGap;
        }
      };
    }
    r = (gap * o.dotSize) / 2;
    const padTop = o.intro === 'none' ? 0 : Math.round(textH * o.flyIn);
    W = width;
    H = Math.ceil(padTop + textH + gap * 3);
    canvas.style.height = `${H}px`;
    canvas.style.marginTop = `${-padTop}px`; // the fly-in room overlaps whatever sits above
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const off = document.createElement('canvas');
    off.width = Math.ceil(W);
    off.height = H;
    const oc = off.getContext('2d', { willReadFrequently: true });
    draw(oc, padTop);
    let data;
    try {
      data = oc.getImageData(0, 0, off.width, off.height).data;
    } catch (err) {
      console.warn('[dot-wordmark] cannot read the logo pixels; serve the image from the same origin or with CORS headers.', err);
      return;
    }
    const pts = [];
    for (let y = padTop + gap / 2; y < H; y += gap) {
      for (let x = gap / 2; x < W; x += gap) {
        const i = ((y | 0) * off.width + (x | 0)) * 4;
        if (data[i + 3] <= 127) continue;
        if (o.sample !== 'alpha') {
          const dark = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 < 128;
          if (dark !== (o.sample === 'dark')) continue;
        }
        pts.push(x, y);
      }
    }

    n = pts.length / 2;
    ox = new Float32Array(n);
    oy = new Float32Array(n);
    px = new Float32Array(n);
    py = new Float32Array(n);
    vx = new Float32Array(n);
    vy = new Float32Array(n);
    ease = new Float32Array(n);
    fric = new Float32Array(n);
    const inPlace = played || reduce.matches || o.intro === 'none'; // a re-layout after the intro snaps
    for (let i = 0; i < n; i++) {
      ox[i] = pts[2 * i];
      oy[i] = pts[2 * i + 1];
      px[i] = inPlace ? ox[i] : Math.random() * W;
      py[i] = inPlace ? oy[i] : Math.random() * H;
      ease[i] = 0.035 + Math.random() * 0.05;
      fric[i] = 0.8 + Math.random() * 0.14;
    }
    drawSprite();
    if (started) {
      paint();
      schedule();
    }
  }

  /* ---------- motion and drawing ---------- */

  function frame(now) {
    rafId = 0;
    // time-based, so the motion is the same at 30, 60 or 120 frames per second; 1 = one 60 Hz frame
    const step = Math.min(0.2, lastTime ? (now - lastTime) / 1000 : 1 / 60) * 60;
    lastTime = now;
    const R = Math.max(50, gap * o.radius);
    const R2 = R * R;
    const active = now < pointer.until;
    let moving = false;
    for (let i = 0; i < n; i++) {
      if (active) {
        const dx = px[i] - pointer.x;
        const dy = py[i] - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 1e-4) {
          const d = Math.sqrt(d2);
          const push = (1 - d / R) * o.force * (0.5 + Math.random()) * step;
          vx[i] += (dx / d) * push + (Math.random() - 0.5) * 0.6 * step;
          vy[i] += (dy / d) * push + (Math.random() - 0.5) * 0.6 * step;
        }
      }
      const f = Math.pow(fric[i], step);
      const k = 1 - Math.pow(1 - ease[i], step);
      vx[i] *= f;
      vy[i] *= f;
      px[i] += vx[i] * step + (ox[i] - px[i]) * k;
      py[i] += vy[i] * step + (oy[i] - py[i]) * k;
      if (!moving && (Math.abs(ox[i] - px[i]) + Math.abs(oy[i] - py[i]) > 0.1 || Math.abs(vx[i]) + Math.abs(vy[i]) > 0.05)) {
        moving = true;
      }
    }
    paint();
    if (moving || active) {
      schedule();
    } else {
      lastTime = 0;
      canvas.dataset.settled = 'true';
      if (o.onSettle) o.onSettle();
    }
  }

  function drawSprite() {
    const size = Math.ceil(r * 2 * dpr) + 2;
    sprite.width = sprite.height = size;
    const s = sprite.getContext('2d');
    s.fillStyle = color;
    s.beginPath();
    s.arc(size / 2, size / 2, r * dpr, 0, Math.PI * 2);
    s.fill();
    spriteR = size / 2;
  }

  // Stamping one pre-drawn dot is far cheaper than building thousands of arcs per frame.
  function paint() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < n; i++) ctx.drawImage(sprite, px[i] * dpr - spriteR, py[i] * dpr - spriteR);
  }

  function schedule() {
    if (rafId || destroyed) return;
    canvas.dataset.settled = 'false';
    rafId = requestAnimationFrame(frame);
  }

  function readColor() {
    color = o.color || getComputedStyle(canvas).color || color;
    drawSprite();
  }

  function start() {
    if (started) return;
    started = true;
    played = true;
    readColor();
    if (reduce.matches || o.intro === 'none') {
      px.set(ox);
      py.set(oy);
    }
    paint();
    schedule();
  }

  /* ---------- wiring ---------- */

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    },
    { threshold: o.threshold }
  );

  const onPointer = (e) => {
    if (!started || reduce.matches) return;
    const b = canvas.getBoundingClientRect();
    const x = e.clientX - b.left;
    const y = e.clientY - b.top;
    if (x < -40 || x > b.width + 40 || y < -40 || y > b.height + 40) return;
    pointer.x = x;
    pointer.y = y;
    pointer.until = performance.now() + 120; // dots return once the pointer stops
    schedule();
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  const ro = new ResizeObserver(() => {
    if (canvas.clientWidth && canvas.clientWidth !== lastWidth) requestAnimationFrame(layout);
  });
  ro.observe(canvas.parentElement || canvas);

  const recolor = () => {
    readColor();
    if (started) paint();
  };
  darkScheme.addEventListener('change', recolor);
  const mo = new MutationObserver(recolor);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  function begin() {
    layout();
    if (!destroyed) io.observe(canvas);
  }

  if (o.image) {
    const img = typeof o.image === 'string' ? new Image() : o.image;
    if (typeof o.image === 'string') {
      img.crossOrigin = 'anonymous';
      img.src = o.image;
    }
    (img.decode ? img.decode() : Promise.resolve()).then(
      () => {
        logo = img;
        begin();
      },
      () => console.warn(`[dot-wordmark] could not load the image "${img.src}"`)
    );
  }

  // Sample the real font, not a fallback: wait for it briefly, and re-sample if it arrives late.
  const fontLoad = o.image ? Promise.resolve(false) : document.fonts?.load
    ? document.fonts.load(`${o.fontWeight} ${o.fontStretch} 100px "${o.fontFamily}"`).then(
        (faces) => faces.length > 0,
        () => false
      )
    : Promise.resolve(false);
  if (!o.image) {
    fontLoad.then((ok) => {
      if (ok && !usedFont && n) layout();
    });
    Promise.race([fontLoad, new Promise((res) => setTimeout(() => res(false), 2500))]).then((ok) => {
      usedFont = ok;
      begin();
    });
  }

  return {
    get settled() {
      return canvas.dataset.settled === 'true';
    },
    // Play the fly-in again, for example when the footer is revealed by a page transition.
    replay() {
      if (!n || reduce.matches) return;
      for (let i = 0; i < n; i++) {
        px[i] = Math.random() * W;
        py[i] = Math.random() * H;
        vx[i] = vy[i] = 0;
      }
      if (!started) start();
      else schedule();
    },
    relayout: layout,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('pointermove', onPointer);
      darkScheme.removeEventListener('change', recolor);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
