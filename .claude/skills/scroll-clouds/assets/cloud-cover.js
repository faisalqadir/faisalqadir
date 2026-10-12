/*!
 * cloud-cover.js
 * Scroll-driven clouds. Soft, lit clouds drift in over a dark scene, thicken as the visitor scrolls
 * and finally cover the whole screen, so the page passes from (say) dark blue to white through a
 * cloud bank. Procedural: one WebGL fragment shader, no images, sharp at any size. Nothing moves
 * while the page is still, unless you ask for an ambient drift.
 *
 *   import { createCloudCover } from './cloud-cover.js';
 *   createCloudCover({ track: '#clouds', stage: '#clouds .clouds-stage' });
 *
 * Markup: a tall track (e.g. 300vh) with a sticky, full-viewport stage inside it. The canvas is
 * added to the stage, behind its other children. Progress runs from 0 when the track's top reaches
 * the top of the viewport to 1 when its bottom reaches the bottom; `start` and `end` pick the part
 * of that over which the clouds go from first wisps to a solid cover.
 *
 * The track gets `--cloud-cover` (0..1, eased like the clouds), for fading copy in step with them.
 */

const DEFAULTS = {
  track: null, // the tall element whose scroll drives the clouds (selector or element)
  stage: null, // a sticky, full-viewport element inside it; the canvas goes in here
  from: '#0b1a4a', // the dark scene the clouds roll in over
  to: '#ffffff', // what it ends on, fully covered
  light: '#ffffff', // the lit side of the clouds
  shade: '#7f90bd', // their shadowed side while the scene is dark (it whitens as they close in)
  start: 0, // part of the track (0..1) where the clouds start to thicken...
  end: 1, // ...and where they cover everything
  wisps: 0.5, // how much cloud is already there at the start, round the edges (0 = none)
  scale: 1, // cloud size: bigger means larger, softer clouds
  softness: 1, // edge softness
  zoom: 1, // how strongly the clouds rush towards the viewer as they close in
  wind: 1, // how far they travel sideways with the scroll (and the parallax between layers)
  drift: 0, // ambient drift while the page is still, in screens per minute (0 = only with scroll)
  seed: 1, // a different seed gives a different sky
  resolution: 0.5, // render scale; clouds are soft, so half resolution is plenty
  damping: 8, // how quickly the clouds catch up with the scrollbar
};

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uP, uT, uScale, uSoft, uZoom, uWind, uWisps, uSeed;
uniform vec3 uFrom, uTo, uLight, uShade;

vec2 grad(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
}
// gradient noise, about -0.7..0.7
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(grad(i), f), dot(grad(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(grad(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(grad(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
// cloud density, roughly 0..1: a slow warp makes the shapes billow, finer detail frays the edges
float density(vec2 q) {
  vec2 w = vec2(noise(q * 0.55 + 3.1), noise(q * 0.55 + 7.7));
  return fbm(q + 1.1 * w) * 0.85 + 0.5 + fbm(q * 3.3 + 11.0 + w) * 0.2;
}

void main() {
  float asp = uRes.x / uRes.y;
  vec2 uv = (vUv - 0.5) * vec2(asp, 1.0); // centred, the viewport's height is 1
  float p = uP;

  // the dark scene: a touch lighter low down, with slow variation so it isn't flat
  vec3 col = uFrom * mix(0.72, 1.18, smoothstep(0.55, -0.5, uv.y));
  col *= 0.92 + 0.16 * (fbm(uv * 1.3 + uSeed * 4.0) + 0.5);

  // the edges cloud over first, the middle last
  float edge = length(uv * vec2(0.62 / max(asp, 1.0) * 1.6, 1.0));

  // three layers, far to near; nearer ones are bigger, faster, and close in a little later
  for (int k = 0; k < 3; k++) {
    float d = float(k) * 0.5;
    float zoom = 1.0 + uZoom * p * p * (0.35 + 1.9 * d);
    vec2 q = uv / zoom;
    q.x += uWind * p * (0.18 + 0.55 * d) + uT * (0.6 + 0.8 * d);
    q.y += uWind * p * 0.06 * (1.0 - d);
    q = q * (1.7 - 0.5 * d) / uScale + vec2(uSeed * 13.1 + d * 7.3, uSeed * 5.7 - d * 3.1);
    float dens = density(q);

    // Pick the threshold from the share of sky this layer should cover, so the cover builds evenly
    // with the scroll (density bunches around its middle, so a straight sweep would jump). The
    // three layers together cover want; far layers lead a little, and the edges go first.
    float want = clamp(0.05 + 0.95 * p + 0.04 * (0.5 - d), 0.003, 0.997);
    float c = 1.0 - pow(1.0 - want, 0.72);
    float thr = 0.6 + 0.075 * log((1.0 - c) / c) / 1.7 - uWisps * (1.0 - p) * (edge - 0.45) * 0.35;
    float soft = (0.06 + 0.04 * d) * uSoft;
    float a = smoothstep(thr - soft, thr + soft, dens);

    // lit from the upper left: brighter where the cloud thins towards the light
    float towards = density(q + vec2(-0.09, 0.07));
    float lit = clamp(0.58 + (dens - towards) * 3.2 + (dens - thr) * 0.7, 0.0, 1.0);
    vec3 shade = mix(uShade, uLight, p * p);
    vec3 cloud = mix(shade, uLight, lit);
    col = mix(col, cloud, a * (0.6 + 0.4 * d));
  }

  // inside the bank at the end: everything goes to the final colour
  col = mix(col, uTo, smoothstep(0.6, 1.0, p));
  // a little grain against banding
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createCloudCover(userOptions = {}) {
  const opts = { ...DEFAULTS, ...userOptions };
  const track = resolve(opts.track);
  const stage = resolve(opts.stage) || track;
  if (!track) throw new Error('[cloud-cover] `track` not found');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const canvas = document.createElement('canvas');
  canvas.className = 'cloud-cover-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;pointer-events:none';
  stage.prepend(canvas);
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });

  let target = 0, smooth = 0, lastTime = 0, rafId = 0, destroyed = false, visible = true, time = 0, lastDrawn = -1;
  let prog = null, uni = {};

  if (gl) {
    prog = program(gl, VERT, FRAG);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uRes', 'uP', 'uT', 'uScale', 'uSoft', 'uZoom', 'uWind', 'uWisps', 'uSeed', 'uFrom', 'uTo', 'uLight', 'uShade']) {
      uni[n] = gl.getUniformLocation(prog, n);
    }
  } else {
    // no WebGL: a plain fade from one colour to the other
    console.warn('[cloud-cover] WebGL unavailable; falling back to a colour fade');
  }

  function progress() {
    const r = track.getBoundingClientRect();
    const span = Math.max(1, r.height - window.innerHeight);
    const raw = Math.min(1, Math.max(0, -r.top / span));
    const t = (raw - opts.start) / Math.max(1e-4, opts.end - opts.start);
    return Math.min(1, Math.max(0, t));
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(stage.clientWidth * dpr * opts.resolution));
    const h = Math.max(2, Math.round(stage.clientHeight * dpr * opts.resolution));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      lastDrawn = -1;
    }
    schedule();
  }

  function draw(p) {
    const eased = p * p * (3 - 2 * p);
    track.style.setProperty('--cloud-cover', eased.toFixed(4));
    if (!gl) {
      const a = hex(opts.from), b = hex(opts.to);
      const c = a.map((v, i) => Math.round((v + (b[i] - v) * eased) * 255));
      canvas.style.background = `rgb(${c.join(',')})`;
      return;
    }
    const still = reduce.matches;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uni.uRes, canvas.width, canvas.height);
    gl.uniform1f(uni.uP, eased);
    gl.uniform1f(uni.uT, still ? 0 : time);
    gl.uniform1f(uni.uScale, opts.scale);
    gl.uniform1f(uni.uSoft, opts.softness);
    gl.uniform1f(uni.uZoom, still ? 0 : opts.zoom);
    gl.uniform1f(uni.uWind, still ? 0 : opts.wind);
    gl.uniform1f(uni.uWisps, opts.wisps);
    gl.uniform1f(uni.uSeed, opts.seed);
    gl.uniform3fv(uni.uFrom, hex(opts.from));
    gl.uniform3fv(uni.uTo, hex(opts.to));
    gl.uniform3fv(uni.uLight, hex(opts.light));
    gl.uniform3fv(uni.uShade, hex(opts.shade));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    rafId = 0;
    const dt = Math.min(0.1, lastTime ? (now - lastTime) / 1000 : 1 / 60);
    lastTime = now;
    target = progress();
    if (reduce.matches || opts.damping <= 0) smooth = target;
    else {
      smooth += (target - smooth) * (1 - Math.exp(-opts.damping * dt));
      if (Math.abs(target - smooth) < 1e-4) smooth = target;
    }
    const drifting = opts.drift > 0 && !reduce.matches && visible;
    if (drifting) time += (dt * opts.drift) / 60;
    if (smooth !== lastDrawn || drifting) {
      draw(smooth);
      lastDrawn = smooth;
    }
    const settled = smooth === target && !drifting;
    canvas.dataset.settled = String(settled);
    if (!settled) schedule();
    else lastTime = 0;
  }

  function schedule() {
    if (!rafId && !destroyed) rafId = requestAnimationFrame(frame);
  }

  const onScroll = () => schedule();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize);
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) schedule();
  });
  io.observe(track);
  if (gl) {
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => location.reload());
  }

  resize();
  smooth = target = progress();
  draw(smooth);
  lastDrawn = smooth;
  canvas.dataset.ready = 'true';
  schedule();

  return {
    get progress() {
      return smooth;
    },
    canvas,
    relayout: resize,
    set(options) {
      Object.assign(opts, options);
      lastDrawn = -1;
      schedule();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      ro.disconnect();
      io.disconnect();
      canvas.remove();
    },
  };
}

function resolve(t) {
  return typeof t === 'string' ? document.querySelector(t) : t || null;
}

function hex(c) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c).trim());
  if (!m) return [1, 1, 1];
  let s = m[1];
  if (s.length === 3) s = [...s].map((ch) => ch + ch).join('');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
}

function program(gl, vs, fs) {
  const make = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('[cloud-cover] ' + gl.getShaderInfoLog(sh));
    return sh;
  };
  const p = gl.createProgram();
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('[cloud-cover] ' + gl.getProgramInfoLog(p));
  return p;
}
