# Dot story: one field of dots from hero to footer

`assets/dot-story.js` draws everything with a single layer of dots and changes what they form as the
page scrolls:

1. **The character:** an animated 3D model drawn as dots. It walks, leaps and holds still exactly
   like scroll-3d-hero's animated models.
2. **The hourglass:** the dots pour into a glass, drain through the neck as text boxes scroll by,
   and run back out.
3. **The wordmark:** the dots settle into the brand name at the footer.

The pointer scatters the dots in every form. Start from `assets/template-dot-story.html` (Snolep
Technologies, with the Khronos sample fox standing in for the final animal).

## Contents
- How it works
- Page structure
- Keyframes
- Options
- Tuning and pitfalls

## How it works

- **The same dots all the way down.** The pool size is the wordmark's dot count (its `dotsPerCap`,
  default 10, sets how many). The character is dithered to exactly that many dots, and the hourglass
  grid is sized so its sand is exactly those dots, one per cell. Each dot keeps a slot in a single
  order, so it has a consistent place in every form. Nothing appears or disappears along the way.
- **A 3D character in dots (Atkinson dithering).** Every frame the rigged GLB is posed (gait,
  scrubbed clips, facing, pitch) and rendered lit and textured, in a side view, into a small target.
  Its tones are stretched around their average (`contrast`, default 1.9) and Atkinson-dithered:
  shadows and dark markings come out dense, highlights sparse, so the dots show volume rather than a
  flat silhouette. The dither density is steered towards N, and an exact-count step drops the palest
  dots or adds the darkest spare ones. The adjustment only kicks in when the count drifts, so a still
  character dithers identically every frame. The cell size scales with the character, so the same
  N dots always cover it. It uses `createAnimator` from scroll-3d-hero.js, so all the animation
  options apply.
- **Pouring in through the top.** Entering the hourglass, the dots leave the character in order
  (feet first), fall through the top opening as a narrow stream that fans out just above the pile, and
  stack from the neck up. Leaving it runs in reverse, so the mound shrinks from the top.
- **Draining.** As `sand` goes 0 → 1, every dot steps one cell along the drain order, so the whole
  top pile sinks while a thin stream falls through the neck. It's tied to scroll, so it stops when
  the visitor stops.
- **Colours.** Dots use the canvas's CSS `color`. Inside the dark panel they switch to `--panel-dots`.
- **Settling.** The loop stops once nothing moves. Scrolling, the pointer or a resize wakes it.

## Page structure

```html
<canvas id="dots" class="dot-story" aria-hidden="true"></canvas>   <!-- position: fixed; inset: 0 -->
<section id="hero">…</section>
<section id="leap">…</section>
<section class="hg-section" id="hourglass-section">               <!-- two columns -->
  <div class="hg-panel" id="panel">                                <!-- sticky, dark, 100vh -->
    <div class="hourglass" id="hourglass">                         <!-- 2:3 box the sand fills -->
      <svg viewBox="0 0 100 150"><path data-hourglass-glass d=""></path>…</svg>  <!-- outline is generated -->
      <span id="hg-top"></span><span id="hg-bottom"></span>        <!-- where it pours in and comes out -->
    </div>
  </div>
  <div class="hg-copy"><article class="box">…</article> ×3</div>  <!-- each about 100vh -->
</section>
<section id="run">…</section>                                       <!-- tall enough for the merge -->
<footer id="footer"><div id="logo" role="img" aria-label="Brand"></div></footer>
```

```css
.dot-story { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 5; pointer-events: none; color: var(--dots); }
:root { --dots: #1b1b1b; --panel-dots: #ecece6; }   /* plus dark-theme values */
```

The glass outline's path is filled in by the script from the same shape the sand uses, so the two
always match. The logo element gets its height from the script.

## Keyframes

Keyframes use whole-page progress. `at: '#id'` means that element's top reaches the viewport top, and
`after` adds screens.

```js
keyframes: [
  { at: 0, form: 'character', x: 0.5, y: 0.25, size: 0.3 },
  // scroll-scrubbed leap (see choreography.md)
  { at: '#leap', after: -0.7, clip: 'Run', clipTime: 0 },
  { at: '#leap', after: 0, x: -0.5, y: -0.55, pitch: -6, ease: 'easeIn' },
  { at: '#leap', after: 0, clip: 'Run', clipTime: 1, ease: 'linear' },
  // into the hourglass
  { at: '#hourglass-section', after: 0, anchor: '#hg-top', form: 'character', sand: 0 },
  { at: '#hourglass-section', after: 0.35, form: 'hourglass' },
  { at: '#hourglass-section', after: 1.55, sand: 1, ease: 'linear' },
  // out again
  { at: '#hourglass-section', after: 1.6, anchor: '#hg-bottom', form: 'hourglass' },
  { at: '#hourglass-section', after: 1.95, form: 'character' },
  // into the wordmark
  { at: '#run', after: 0.15, form: 'character' },
  { at: 1, form: 'logo' },
]
```

| Key | Meaning |
| --- | --- |
| `x`, `y` or `anchor` | Character centre in viewport units, or an element's centre (followed live). |
| `size` | Character length as a fraction of the viewport's shorter side. |
| `pitch` | Nose up (+) or down (−) in degrees, whichever way it faces. |
| `clip`, `clipTime` | Scrub a clip with the scroll between two keyframes, in cycles. |
| `form` | `'character'`, `'hourglass'` or `'logo'`. |
| `sand` | 0–1: how much sand has drained into the lower bulb. |
| `ease` | Easing for the segment ending at this keyframe. |

## Options

```js
createDotStory({
  canvas: '#dots',
  character: { url: 'animal.glb', animation: { idle, walk, run, still: 'pose', face: { idle: 75 } }, tilt: 8 },
  hourglass: { anchor: '#hourglass', panel: '#panel' },
  logo: { anchor: '#logo', text: 'BRAND NAME', dotsPerCap: 10 }, // its dot count is the pool size; plus fontFamily, fontWeight, fontStretch…
  keyframes: [...],
  responsive: { '(max-width: 767px)': { gap: 3, keyframes: [...] } },
  contrast: 1.9,     // tone stretch before dithering: higher = more 3D, lower = flatter
  dotRadius: null,   // one size for every form (default: from the wordmark's spacing)
  gap: 4,            // starting grid for the sand (it adjusts to hold exactly the pool)
  damping: 8, pointer: { radius: 64, force: 5 },
  particles: 2400,   // pool size if there's no logo
});
```

Add `?dots-debug` to the URL for an overlay with progress, form, pose and dot counts. The canvas gets
`data-ready` and `data-settled`, for screenshot scripts.

## Tuning and pitfalls

- **Side views read best.** The character is rendered from the side, and `face.idle` of about 75°
  keeps it near profile even at rest. A three-quarter view turns into a blob of dots.
- **Give the ending room.** The merge into the wordmark needs a few hundred pixels of scrolling. The
  template's run section is 160vh, so the dots stream down as the footer arrives.
- **Pool size versus character size.** The dots are shared, so a bigger pool means a finer, denser
  character. If the character looks crowded, lower the wordmark's `dotsPerCap` or make the
  character bigger. If it looks sparse, do the opposite. About 1,000–1,500 dots suits a character
  around a third of the screen tall.
- **Keep copy out of the path.** The diagonal leap runs from upper right to lower left, so captions go
  top right; on phones the leap stays in the lower part of the screen.
- **Hosts that block file downloads** (such as single-file demos): pass `character: { buffer }` with
  the GLB's bytes.
- **"GPU stall due to ReadPixels" console notes** in some browsers are expected: the silhouette is
  read back each frame. The target is tiny, and the loop stops once the dots are at rest.
