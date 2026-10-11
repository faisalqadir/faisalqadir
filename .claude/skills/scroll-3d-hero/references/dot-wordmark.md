# Dot-matrix footer wordmark

`assets/dot-wordmark.js` turns a brand name (or a logo image) into a field of small dots at the bottom
of the page. When the footer scrolls into view the dots fly in from random positions and settle into
the letters. The pointer (or a finger) pushes nearby dots away, and they spring back once it stops.
It has no dependencies, so it works on any page, with or without the 3D hero.

## Contents
- How it works
- Setup
- Options
- Logos instead of text
- Tuning the look
- Pitfalls
- Reference: unitedcarriers.com

## How it works

1. The text is drawn off-screen in a wide, heavy font, sized so one line fills the container. On
   narrow screens, where one line would be too small to read as dots, each word gets its own line,
   and each line fills the width.
2. The drawing is sampled on a square grid; every filled sample becomes a particle with a home
   position.
3. Each frame, a particle springs towards home with its own random stiffness and friction, so the
   fly-in looks organic instead of uniform. Within a radius of the pointer it gets pushed outwards
   with a little jitter. The motion is time-based, so it looks the same at 30, 60 or 120 frames per
   second.
4. All dots are stamped from one pre-drawn dot image. That is much cheaper than drawing thousands of
   circles every frame, and the loop stops completely once the dots are at rest.

## Setup

```html
<footer>
  …legal links…
  <canvas id="wordmark" class="dot-wordmark" aria-label="Acme Naturals"></canvas>
</footer>
```

```css
.dot-wordmark { display: block; width: 100%; height: 9vw; color: var(--dots); pointer-events: none; }
:root { --dots: #a1998a; }                       /* about 35–45% contrast against the background */
/* plus a darker or lighter --dots in your dark-theme block */
```

```html
<script type="module">
  import { createDotWordmark } from './dot-wordmark.js';
  createDotWordmark('#wordmark', { text: 'ACME NATURALS' });
</script>
```

- The canvas sets its own height. The `9vw` above only reserves space until the script runs.
- The dot colour comes from the canvas's CSS `color`, re-read when the theme changes (both the
  `data-theme` attribute and the OS setting).
- Load the font with the weight and width you use. The default is Archivo 800 at expanded width, so
  the Google Fonts URL needs `family=Archivo:wdth,wght@125,800` (keep any other instances you use).
  The runtime waits up to 2.5 s for it and re-samples if it arrives later.
- Keep it in its own `<script type="module">`, separate from the 3D hero's script, so a CDN failure
  in one doesn't take down the other.
- Put it last on the page, like a signature. The fly-in room (`flyIn`) overlaps the content above it
  through a negative top margin, and `pointer-events: none` keeps links there clickable.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `text` | canvas `aria-label` | The words to draw. Uppercase reads best. |
| `image`, `maxHeight`, `sample` | `null`, `Infinity`, `'alpha'` | Sample a logo instead of text (see below). |
| `fontFamily`, `fontWeight`, `fontStretch` | `'Archivo'`, `800`, `'expanded'` | The face used for the text. Wide, heavy faces read best as dots. |
| `tracking` | `0.03` | Extra letter spacing, in em. |
| `capHeight` | `0.72` | The font's cap height as a fraction of its size. Used to size the grid. |
| `dotsPerCap` | `15` | Grid rows across a capital letter, or across the whole image. Higher = finer. |
| `minGap`, `maxGap` | `2.5`, `7` | Limits for the grid spacing, in CSS px. |
| `dotSize` | `0.68` | Dot diameter as a fraction of the grid spacing. |
| `stackBelow` | `56` | If one line would be smaller than this font size (px), stack the words. |
| `lineGap` | `4` | Space between stacked lines, in grid cells. |
| `flyIn` | `0.8` | Room above the letters for the fly-in, as a fraction of the text height. |
| `intro` | `'scatter'` | `'none'` starts the dots in place, with no fly-in. |
| `radius`, `force` | `14`, `5` | Pointer influence radius (in grid cells, minimum 50 px) and push strength. |
| `color` | canvas CSS `color` | Fixed dot colour, ignoring the theme. |
| `threshold` | `0.3` | How much of the canvas must be visible before the intro plays. |
| `onSettle` | `null` | Called each time the dots come to rest. |

It returns `{ settled, replay(), relayout(), destroy() }`. Call `replay()` to run the fly-in again,
for example after a page transition reveals the footer. The canvas gets `data-dot-wordmark` and
`data-settled="true|false"`; `scripts/preview.mjs` uses these to screenshot it once it's at rest.

## Logos instead of text

```js
createDotWordmark('#wordmark', { image: '/brand/logo.svg', maxHeight: 240 });
```

- The image must be same-origin or served with CORS headers. Otherwise the browser blocks reading its
  pixels, and the runtime logs a warning instead of drawing.
- SVGs need intrinsic `width` and `height` attributes, not just a `viewBox`.
- `sample: 'alpha'` (default) turns every opaque pixel into a dot, which suits a one-colour logo on a
  transparent background. Use `'dark'` for a dark logo with white cut-outs or on a white background,
  and `'light'` for a white logo on a dark background.
- Set the canvas's `aria-label` to the brand name, because the image itself isn't announced.

## Tuning the look

- **Finer or coarser dots:** `dotsPerCap` from 12 (chunky, retro LED) to 20 (fine halftone). Keep `minGap` at
  2.5 or above on phones, or the dots blur into solid letters.
- **Subtle or bold:** set the colour token. The reference look is a mid grey at roughly 40% contrast,
  so the wordmark reads as texture rather than a headline.
- **Calmer interaction:** `force: 3` with `radius: 10`. For a playful one: `force: 8` with `radius: 20`.
- **No fly-in** (e.g. the footer is always visible on short pages): `intro: 'none'`.
- **Two-line lockups on desktop too:** raise `stackBelow` above the one-line size, for example `stackBelow: 200`.

## Pitfalls

- **Letters look like a fallback font:** the font didn't load in time. Check that the Google Fonts URL
  includes the exact weight and width instance, for example `wdth,wght@125,800`.
- **Blank canvas:** the canvas had no width when it was laid out, for example inside a hidden tab. It
  lays itself out again once it has a width; call `relayout()` if you resize it by other means.
- **Clipped fly-in:** an ancestor with `overflow: hidden` clips the negative top margin. Use
  `overflow: clip` on the specific axis, or set `flyIn: 0`.
- **Very slow in headless screenshots:** software-only GPU emulation (SwiftShader) can make canvas
  drawing very slow. Real browsers are fine, and the time-based motion still settles correctly.

## Reference: unitedcarriers.com

This is the behaviour of the footer on unitedcarriers.com, as observed in its production bundle in
October 2026. It's described here so the effect can be matched; their code and logo are not used.

- A `<canvas id="footer-particle-canvas">` sits below the footer's legal row. Their logo SVG is drawn
  into it and sampled every few pixels; each opaque sample becomes a mid-grey dot (`#A0A0A0` on white).
- The particles start at random positions and ease into place while the footer is on screen. The
  animation only runs while the canvas is visible.
- The mouse pushes particles out of a small radius, with random jitter. They spring back with
  per-particle easing and friction, and the push stops 100 ms after the mouse stops moving.
- It runs on desktop only (wider than 991 px); phones see a static PNG of the dotted logo.

This version differs in a few ways: it draws text from a font, so the name is a one-line change; it
stacks the words on phones and runs there too (touch drags scatter the dots); the motion is
time-based; dots are stamped from a sprite instead of drawn one circle at a time; it follows the
light and dark theme; and it honours reduced-motion settings.
