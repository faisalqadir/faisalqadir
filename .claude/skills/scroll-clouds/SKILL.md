---
name: scroll-clouds
description: Build a scroll-driven cloud transition for a website. Soft, lit clouds drift in over a dark scene as the visitor scrolls, thicken, rush towards the viewer and close into a solid colour, so a dark blue section passes through a cloud bank into a white one, like the cloud sequence on unitedcarriers.com. Procedural WebGL with no images, about 5 KB gzipped, still whenever the page is still. Ships a drop-in runtime, a template page and a screenshot checker. Use this whenever someone wants clouds, fog, mist or smoke on scroll, a section transition through clouds, a sky that clouds over, a dark-to-light or night-to-day scroll transition, or wants to copy a cloud effect from a site they saw, even if they never say WebGL or shader.
---

# Scroll clouds

Clouds roll in over a dark scene as the page scrolls and close into a solid colour, for example a
dark blue section that passes through a cloud bank into white. Everything is drawn by one WebGL
fragment shader: three layers of warped fractal noise, lit from the upper left, with far layers
closing in first and near ones rushing towards the viewer. There are no images to download and it
stays sharp at any size.

## Workflow

1. Copy `assets/cloud-cover.js` next to the page (or into the project's static folder).
2. Add a tall track with a sticky stage (markup below). Put the copy that should be swallowed by the
   clouds, and any copy that should appear on the far side, inside the stage.
3. Call `createCloudCover({ track, stage, from, to })` with the two colours; `to` should match the
   background of the section after the track, so the hand-over is seamless.
4. Fade copy with the `--cloud-cover` CSS variable the track gets (0 to 1, eased like the clouds).
5. Check it with `scripts/preview.mjs` (below) on desktop and phone before handing it over.

Start from `assets/template.html`, a complete page (Snolep Technologies, dark blue to white).

## Markup

```html
<section class="clouds" id="clouds">            <!-- tall: 250–350vh; its scroll drives the clouds -->
  <div class="clouds-stage">                     <!-- sticky, full viewport; the canvas goes in here -->
    <div class="night-copy">…</div>              <!-- fades as the clouds cover it -->
    <div class="day-copy">…</div>                <!-- arrives as the white closes in -->
  </div>
</section>
<section class="after">…</section>               <!-- background matches `to` -->

<script type="module">
  import { createCloudCover } from './cloud-cover.js';
  createCloudCover({ track: '#clouds', stage: '#clouds .clouds-stage', from: '#0b1a4a', to: '#ffffff', end: 0.88 });
</script>
```

```css
.clouds { position: relative; height: 320vh; background: #0b1a4a; }
.clouds-stage { position: sticky; top: 0; height: 100vh; overflow: hidden; }
.clouds-stage > :not(canvas) { z-index: 1; }   /* copy above the canvas; give each its own position */
.night-copy { position: absolute; inset: 0; opacity: calc(1 - var(--cloud-cover, 0) * 2.2);
              filter: blur(calc(var(--cloud-cover, 0) * 14px)); }
```

Don't give the stage's children `position: relative` in a rule that also matches absolutely
positioned copy: the more specific rule wins and the copy drops to the top of the stage.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `track`, `stage` | | The tall element whose scroll drives the clouds, and the sticky element the canvas is added to. |
| `from`, `to` | `#0b1a4a`, `#ffffff` | The dark scene and the colour it ends on. |
| `light`, `shade` | `#ffffff`, `#7f90bd` | The lit and shadowed sides of the clouds. The shade whitens as they close in. |
| `start`, `end` | `0`, `1` | The part of the track over which the clouds go from first wisps to a full cover. End before 1 so the last stretch is solid. |
| `wisps` | `0.5` | Cloud already round the edges at the start (0 = a clear sky). |
| `scale`, `softness` | `1`, `1` | Cloud size, and how soft their edges are. |
| `zoom`, `wind` | `1`, `1` | How strongly the clouds rush towards the viewer, and how far they travel sideways with the scroll. |
| `drift` | `0` | Ambient drift while the page is still, in screens per minute. 0 keeps it fully still at rest. |
| `seed` | `1` | A different seed gives a different sky. |
| `resolution` | `0.5` | Render scale. Clouds are soft, so half resolution is plenty; lower it for weak phones. |
| `damping` | `8` | How quickly the clouds catch up with the scrollbar. |

The returned object has `progress`, `canvas`, `relayout()`, `set(options)` and `destroy()`. The canvas
gets `data-ready` and `data-settled` for screenshot scripts.

## Check with preview

```bash
node scripts/preview.mjs path/to/page.html --out shots --stops 0,0.25,0.5,0.75,1 --viewports desktop,mobile
```

It serves the page locally, scrolls the track to each stop, waits for the clouds to settle and saves a
PNG per stop and viewport. It fails if the canvas never becomes ready or the page logs errors. Look for
an even build-up from wisps to full cover, copy that fades before it is buried, and a seamless join
with the section after.

## Read when needed

- `references/clouds.md`: how the shader works, colour recipes (night to day, storm, sunset, white to
  dark), tuning the pace of the cover, performance and accessibility notes.

## Pitfalls

- **Match `to` to the next section** or the end of the track shows a seam.
- **Fade copy early.** Text that is still readable when the clouds are dense looks pasted on top;
  fade it out by about a third of the way and blur it a little as it goes.
- **Reduced motion:** the clouds still cover the screen with the scroll, but nothing zooms or drifts.
- **No WebGL:** it falls back to a plain colour fade between `from` and `to`.
- **Cost:** it renders only while the scroll is moving (or while drifting). On weak phones lower
  `resolution` to 0.35.
