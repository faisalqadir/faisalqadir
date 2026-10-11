---
name: scroll-3d-hero
description: Build a scroll-driven 3D hero for a website, where a product (plate, bowl, cup, bottle, shoe, any GLB model) floats in the hero, revolves and flips as the visitor scrolls, travels through the next sections and lands in a product card, like the plate on kanaknaturals.com. Ships a drop-in Three.js runtime, a working template page and a screenshot checker. Use this whenever someone wants a 3D or WebGL hero, a product that rotates/spins/revolves/flips on scroll, a scroll-linked 3D animation, Three.js on a landing page, or asks to recreate an awwwards-style 3D scroll effect from a site they saw, even if they never say "Three.js".
---

# Scroll 3D hero

The effect: a 3D object sits large in the hero with a gentle idle wobble. As the visitor scrolls it
revolves, shrinks and travels across the following sections, then settles into a slot (usually a
product card) and casts a soft shadow there. Everything after that section scrolls normally.

How it works, in four parts:

1. **Track.** A wrapper around every section the object travels through. Its scroll range, from its
   top hitting the viewport top to its bottom hitting the viewport bottom, is progress `0 → 1`.
2. **Sticky stage.** An absolutely positioned layer spans the track. Inside it a `position: sticky`,
   `100vh` stage holds the WebGL canvas, so the canvas stays pinned while the sections scroll
   underneath. The layer has `pointer-events: none`, so links and buttons underneath stay clickable.
3. **Keyframes.** Progress is mapped to keyframes of position, size, rotation and shadow, and
   interpolated with easing and a little damping so wheel steps feel smooth.
4. **Anchor.** The last keyframe can follow a DOM element (`anchor: '#slot'`), so the object lands
   exactly in the card at every screen size without hand-tuned numbers.

## What's in this skill

| File | Use |
| --- | --- |
| `assets/scroll-3d-hero.js` | The runtime. Copy it into the project unchanged. Vanilla Three.js, no build step. |
| `assets/template.html` | A complete working page (hero → statement → product card). Start from it. |
| `scripts/preview.mjs` | Screenshots the page at several scroll positions on desktop and mobile. |
| `references/choreography.md` | Keyframe recipes, plus a breakdown of how kanaknaturals.com does it. Read it when designing the motion. |
| `references/models.md` | Getting, exporting and compressing a real product model. Read it when the user has or needs a GLB. |
| `references/frameworks.md` | React/Next.js, Vue, Svelte, Astro, Vite, WordPress/Webflow/Shopify setup. Read it for anything but plain HTML. |

## Workflow

### 1. Pin down the brief

Work out from the request and the codebase:

- **The object.** Use the user's GLB if they have one. Otherwise start with the built-in procedural
  `plate` or `bowl` (molded-fibre look, no download) and say a real model can replace it later.
- **The path.** Which sections should it pass through, and where should it land? The usual path is
  hero → one or two story sections → product card.
- **The stack.** Plain HTML or a framework (see `references/frameworks.md`).

If they pointed at a site, describe that site's beats back to them in plain words, for example "big and
tilted on the right, flips over while shrinking, lands in the card". Then build those beats with this
runtime. Don't copy that site's models, images or code; recreate the motion with the user's own assets.

### 2. Add the runtime and markup

Copy `assets/scroll-3d-hero.js` next to the page's other scripts. In plain HTML, add the import map
from the template (pin a three.js version). With a bundler, run `npm i three` instead; the runtime's
`three` and `three/addons/...` imports resolve with no changes.

Wrap the sections and add the layer as the track's first child:

```html
<div class="s3h">                         <!-- track -->
  <div class="s3h-layer" aria-hidden="true">
    <div class="s3h-stage"></div>          <!-- canvas is inserted here -->
  </div>
  <section class="hero">…</section>
  <section id="story">…</section>
  <section id="product">… <div id="s3h-slot"></div> …</section>
</div>
```

Copy this CSS as is. Each line matters:

```css
.s3h { position: relative; }
.s3h-layer { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.s3h-stage { position: sticky; top: 0; height: 100vh; overflow: hidden; }
.s3h-canvas { display: block; width: 100%; height: 100%; opacity: 0; transition: opacity .9s ease; }
.s3h-stage.is-ready .s3h-canvas { opacity: 1; }
```

To put the object behind the text instead of in front, give the layer `z-index: 0` and the sections
`position: relative; z-index: 1`.

```html
<script type="module">
  import { createScroll3DHero } from './scroll-3d-hero.js';
  const hero = createScroll3DHero({ track: '.s3h', stage: '.s3h-stage', model: { shape: 'plate' }, keyframes: [ /* step 3 */ ] });
</script>
```

### 3. Choreograph the keyframes

```js
keyframes: [
  { at: 0, x: 0.58, y: -0.3, size: 0.95, rotate: [60, -30, 20], shadow: 0 },  // hero: big, tilted, bottom right
  { at: '#story', x: -0.08, y: 0.04, rotate: [-110, 20, -12] },             // flipped, showing the underside
  { at: 0.62, size: 0.42 },                                                 // shrink on its own schedule
  { at: 0.85, shadow: 0 },
  { at: 1, anchor: '#s3h-slot', fit: 0.92, rotate: [-295, 0, 0], shadow: 1 }, // lands upright after one revolution
]
```

| Key | Meaning |
| --- | --- |
| `at` | Progress `0..1`, or a selector meaning "when this element's top reaches the viewport top". |
| `x`, `y` | Centre of the object. `-1` is the left/bottom edge, `0` the centre, `1` the right/top edge. |
| `size` | Largest dimension as a fraction of the viewport's shorter side. Models are auto-normalised, so `size` means the same for any GLB. |
| `rotate` | `[x, y, z]` in degrees, interpolated per axis, so `-360` is a full revolution. Use `rx`/`ry`/`rz` to set one axis. |
| `z` | Depth in world units (positive = towards the camera). Usually 0; use it for a zoom past the camera. |
| `shadow` | `0..1` opacity of the soft shadow under the object. Fade it in only where it rests on something. |
| `anchor` | Selector. Each frame, `x`/`y` come from that element's centre, and any `x`/`y` you give become offsets. |
| `fit` | With `anchor`: size the object to this fraction of the anchor's shorter side. |
| `ease` | `'easeInOut'` (default), `'easeIn'`, `'easeOut'`, `'linear'` or a function. Applies to the segment ending at this keyframe. |

Every key is optional per keyframe. Each property interpolates only among the keyframes that set it,
so size, rotation and shadow can run on independent schedules, as in the example above.

Orientation basics for the built-in shapes, whose up axis is +Y: `rotate: [0, 0, 0]` is edge-on,
`[90, 0, 0]` faces the camera, and `[60, …]` gives the classic three-quarter product shot. A flip
that ends upright again needs a full turn, for example from `60` to `-295` (which is the same as 65°).
For more motion ideas, read `references/choreography.md`.

Progress `1` is reached when the track's bottom meets the viewport's bottom. So the landing slot must be
on screen in the track's last viewport-height. In practice that means the final section is about
`min-height: 100vh` with the card vertically centred.

### 4. Make it work on phones

`responsive` overrides any option per media query; later matches win, and `keyframes` are replaced
whole:

```js
responsive: {
  '(max-width: 767px)': {
    keyframes: [ { at: 0, x: 0.1, y: -0.64, size: 0.95, rotate: [60, -30, 20] }, /* … */ ],
    tilt: 0,
  },
},
```

On narrow screens the object usually sits below the headline in the hero, `x` near 0 and `y` around
`-0.6`. Keep it smaller mid-scroll so it doesn't swallow the copy.

### 5. Check it, then iterate

Look at the result before calling it done. Motion bugs are invisible in code review.

```bash
node <skill>/scripts/preview.mjs path/to/page.html --out /tmp/s3h --stops 0,0.25,0.5,0.75,1
# a running dev server works too: node preview.mjs http://localhost:5173/ --viewports desktop,mobile,tablet
```

The script serves local files over http, waits until the hero is ready, scrolls to each stop, waits for
the object to settle and writes `desktop-0.png`, `mobile-0_5.png` and so on. It exits non-zero on page
errors or `[scroll-3d-hero]` warnings. Open the PNGs and check:

- The object never covers the headline, the main button or the copy at the moment the reader needs it.
- Mid-scroll frames show it actually revolving, not just shrinking.
- At progress 1 it sits inside the slot with the shadow visible beneath it, on both desktop and mobile.

`--after-ready "<js>"` runs code before the screenshots, for example clicking a button that calls
`setModel`. For live tuning in a browser, add `?s3h-debug` to the URL. That shows progress, the current
pose and the resolved keyframe positions, and outlines anchors.

If Playwright is missing: `npm i -D playwright && npx playwright install chromium`.

## Options

```js
createScroll3DHero({
  track: '.s3h', stage: '.s3h-stage',            // selectors or elements
  model: { shape: 'plate' },                     // 'plate' | 'bowl' (+ color, ribs, ribDepth, roughness, texture)
                                                 // or { url: 'model.glb', rotate: [x,y,z], prepare(obj) {} } or { object: THREE.Object3D }
  keyframes: [...],
  responsive: { '(max-width: 767px)': { ... } },
  camera: { fov: 30, distance: 5 },              // narrow fov = flat, product-photo perspective
  idle: { wobble: 3.5, speed: 0.5, float: 0.015 }, // or false
  spin: 0,                                       // deg/s turntable spin around the model's up axis
  tilt: 0,                                       // deg the object leans towards the pointer (desktop nicety)
  damping: 7,                                    // catch-up speed; 0 locks to the scrollbar (use 0 with Lenis)
  shadow: { opacity: 0.35, width: 0.9, offset: 0.42, color: '#1b1a17' },
  lighting: { environment: 0.6, key: 1.8, exposure: 1, toneMapping: 'neutral' }, // 'neutral' | 'aces' | 'agx'
  maxPixelRatio: 2,
  dracoPath: null,                               // defaults to jsDelivr, matching the loaded three.js
  debug: false,
  onReady(hero) {}, onLoadProgress(fraction) {}, onUpdate(progress, pose) {},
});
```

The returned object provides:

- `progress` and `settled`.
- `setModel(source, { direction })`: the current model revolves out and the new one revolves in. Use it for product switchers.
- `setKeyframes(list)`, `refresh()` (call after layout changes the observers can't see) and `destroy()`.
- `ready`, a promise.
- `scene`, `camera` and `renderer` for custom additions.

The stage gets `is-ready`, `data-s3h-ready` and `data-s3h-settled`, and dispatches an `s3h:ready` event.
The track gets a `--s3h-progress` CSS variable, which lets DOM animations follow the same timeline with
no JavaScript:

```css
.hero-copy { opacity: calc(1 - var(--s3h-progress, 0) * 3); }
.card-cta  { opacity: clamp(0, calc((var(--s3h-progress, 0) - .82) * 6), 1); }
```

## Pitfalls

- **Sticky stops pinning.** `overflow: hidden`/`auto` on any ancestor of the stage (often `body` or a
  page wrapper used to hide horizontal overflow) disables `position: sticky`. Use `overflow-x: clip`.
  The runtime prints a console warning naming the element.
- **No movement.** The track must be taller than the viewport, so plan two or three screens of
  content. A one-screen track has zero scroll range.
- **Smooth-scroll libraries** that keep native scrolling (Lenis, Locomotive Scroll v5) work, because the runtime reads
  element positions every frame. Set `damping: 0` so the two kinds of smoothing don't stack. Libraries
  that transform a fake scroll container need `refresh()` and are best avoided here.
- **ES modules don't load from `file://`.** Serve the page; the preview script does this for you.
- **Heavy models** stall the hero. Aim for under 2–3 MB with Draco or Meshopt geometry and WebP
  textures; KTX2 textures aren't supported by the loader setup. See `references/models.md`.
- **Accessibility.** The layer is `aria-hidden` and decorative, so put the product's name and details in
  real text. `prefers-reduced-motion` is respected automatically: no idle wobble, spin, tilt or damping.
- **No WebGL.** The stage gets `s3h-fallback`. Put an `<img class="s3h-poster">` inside the stage as the
  loading and fallback image; the template's CSS hides it once the canvas is ready.
