# Dot story: one field of dots from hero to footer

`assets/dot-story.js` draws everything with a single layer of dots and changes what they form as the
page scrolls:

1. **The character:** an animated 3D model drawn as dots. It walks, leaps and holds still exactly
   like scroll-3d-hero's animated models, and stays in one piece while it moves.
2. **The hourglass:** the character lands on top of the glass, dives in head first and crumbles into
   sand. The sand runs through the neck while more is still pouring in, then the character comes back
   out of the bottom.
3. **The wordmark:** the dots stream down into the brand name at the footer.

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
  default 10, sets how many). The character is drawn with exactly that many dots, and the hourglass
  grid is sized so each bulb holds all of them, one per cell. Nothing appears or disappears.
- **A 3D character that holds together.** Once, at load, the rigged GLB is rendered lit and textured
  in a side view, its tones are stretched around their average (`contrast`, default 1.9) and it's
  Atkinson-dithered to exactly N dots: shadows and dark markings come out dense, highlights sparse.
  Each dot is then pinned to the point on the model's surface under it. Every frame the model is
  posed (gait, scrubbed clips, facing, pitch) and the dots ride the skinned mesh, so legs swing, the
  body turns in 3D and nothing smears however fast it moves. A dot follows its pin exactly; springs
  only settle what the pointer or a change of form displaced. It uses `createAnimator` from
  scroll-3d-hero.js, so all the animation options apply.
- **Synced with the page.** Keyframes can anchor the character to an element and `align` it: it
  stands on the top of the glass, so it lands on it as the glass scrolls in and rides up with it.
  Its gait only counts its own motion along the keyframes, so riding a moving element doesn't make
  it run.
- **Into the glass.** As `pour` goes 0 → 1 the character sinks into the top, lowest part first (nose
  first in a head-down dive), and whatever is inside the glass crumbles: each dot clings to the body a
  moment, drops straight down and spreads out only as it lands on the sand.
- **Draining like real sand.** The top bulb is a stack: landed sand keeps its cell, and the top layer
  runs out first, down the middle to the neck, as sand funnels. Layers fill from the walls in, so the
  middle sits low. `drain` can start long before the top is full; sand only moves on once it has
  landed. The route is worked out once per layout, so it plays the same forwards and backwards.
- **Out of the bottom.** Once all the sand is in the bottom bulb, `emerge` takes it out from the top of
  the mound, through the opening in the base, into the character, nose first.
- **Into the wordmark.** The lowest dots leave first, so the character streams down into the name,
  which builds up from left to right.
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
      <svg viewBox="0 0 100 150">…<path data-hourglass-glass d=""></path></svg>  <!-- sides are generated -->
      <span id="hg-top"></span><span id="hg-bottom"></span>        <!-- top: 0 and top: 100% of the box -->
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

The script draws the glass's two sides from the same shape the sand uses, open at both ends. The
template's frame has an opening in the top and bottom plates, so the way in and out reads. The logo
element gets its height from the script.

## Keyframes

Keyframes use whole-page progress. `at: '#id'` means that element's top reaches the viewport top, and
`after` adds screens. The template's story, desktop values:

```js
keyframes: [
  { at: 0, form: 'character', x: 0.5, y: 0.25, size: 0.36 },
  // a scroll-scrubbed leap (see choreography.md) ...
  { at: '#leap', after: -0.7, clip: 'Run', clipTime: 0 },
  { at: '#leap', after: -0.42, x: 0.2, y: 0.35, ease: 'easeOut' },
  // ... that lands on the glass as it scrolls in; anchored from here on, so it moves with the page
  { at: '#hourglass-section', after: -0.55, anchor: '#hg-top', align: 'bottom', size: 0.26, pitch: 0, ease: 'easeIn' },
  { at: '#hourglass-section', after: -0.55, clip: 'Run', clipTime: 1, ease: 'linear' },
  // tips over the rim and dives in, head first
  { at: '#hourglass-section', after: -0.3, anchor: '#hg-top', align: 'bottom', pitch: 0 },
  { at: '#hourglass-section', after: -0.12, pitch: -70, pour: 0 },
  { at: '#hourglass-section', after: 0.55, anchor: '#hg-top', align: 'bottom', pour: 1, ease: 'linear' },
  // the sand runs through the neck while the rest is still pouring in
  { at: '#hourglass-section', after: -0.02, drain: 0 },
  { at: '#hourglass-section', after: 1.7, drain: 1, ease: 'linear' },
  // comes back out of the bottom as the panel scrolls away
  { at: '#hourglass-section', after: 1.85, anchor: '#hg-bottom', align: 'top', pitch: -70, emerge: 0 },
  { at: '#hourglass-section', after: 2.35, anchor: '#hg-bottom', align: 'top', emerge: 1, ease: 'linear' },
  // runs across, then into the wordmark
  { at: '#run', after: 0, x: 0.45, y: -0.5, size: 0.36, pitch: 0 },
  { at: '#run', after: 0.15, form: 'character' },
  { at: 1, form: 'logo' },
]
```

| Key | Meaning |
| --- | --- |
| `x`, `y` | Character centre in viewport units (−1 left/bottom, 1 right/top). |
| `anchor` | An element to follow as the page scrolls (`x`/`y` then offset it). |
| `align` | With an anchor: `'bottom'` stands the character on it, `'top'` hangs it underneath. Uses the part that's the character right now. |
| `size` | Character length as a fraction of the viewport's shorter side. |
| `pitch` | Nose up (+) or down (−) in degrees, whichever way it faces. |
| `clip`, `clipTime` | Scrub a clip with the scroll between two keyframes, in cycles. |
| `pour` | 0–1: how much of the character has gone into the hourglass, lowest part first. |
| `drain` | 0–1: how much sand has run through the neck. It can overlap `pour`. |
| `emerge` | 0–1: how much has come back out of the bottom (after all the sand has landed). |
| `form` | `'character'` or `'logo'`. Between two forms the dots move across one by one. |
| `ease` | Easing for the segment ending at this keyframe. |

## Options

```js
createDotStory({
  canvas: '#dots',
  character: { url: 'animal.glb', animation: { idle, walk, run, still: 'pose', face: { idle: 75, start: -1 } }, tilt: 8 },
  hourglass: { anchor: '#hourglass', panel: '#panel', dive: -70, crumble: 0.16 },
  logo: { anchor: '#logo', text: 'BRAND NAME', dotsPerCap: 10 }, // its dot count is the pool size; plus fontFamily, fontWeight, fontStretch…
  keyframes: [...],
  responsive: { '(max-width: 767px)': { gap: 3, keyframes: [...] } },
  contrast: 1.9,     // tone stretch before dithering: higher = more 3D, lower = flatter
  dotRadius: null,   // one size for every form (default: from the wordmark's spacing)
  gap: 4,            // starting grid for the sand (it adjusts so each bulb holds the whole pool)
  damping: 8, pointer: { radius: 64, force: 5 },
  particles: 2400,   // pool size if there's no logo
});
```

- `hourglass.dive`: the pitch of the dive; the dots go in lowest-first in that pose. Match it to the
  `pitch` keyframe of the dive.
- `hourglass.crumble`: the share of the dots falling at once as the character goes in. Higher shows
  more of the body crumbling inside the glass.

Add `?dots-debug` to the URL for an overlay with progress, form, pose and flow counts. The canvas gets
`data-ready` and `data-settled`, for screenshot scripts.

## Tuning and pitfalls

- **Side views read best.** The dots are picked from a side view, and `face.idle` of about 75° keeps
  the character near profile at rest. Turning round still works: the pinned dots rotate in 3D.
- **Land on the glass, don't fly to it.** Interpolating from a fixed spot on screen to an element that
  is still scrolling makes the character overshoot into the glass and climb back out. End the leap
  on an anchored, aligned keyframe instead, at a point where the glass is already on screen.
- **Pour and drain in proportion.** If `drain` runs ahead of `pour` it waits for sand to land, so the
  stream thins out. Starting `drain` just as the first sand lands looks most natural.
- **Give the ending room.** The merge into the wordmark needs a few hundred pixels of scrolling. The
  template's run section is 160vh.
- **Pool size versus character size.** The dots are shared, so a bigger pool means a finer, denser
  character. If the character looks crowded, lower the wordmark's `dotsPerCap` or make the
  character bigger. About 1,000–2,000 dots suits a character around a third of the screen long.
- **Keep copy out of the path.** The leap runs from upper right to lower left, so captions go top
  right; on phones the caption sits above the glass.
- **Hosts that block file downloads** (such as single-file demos): pass `character: { buffer }` with
  the GLB's bytes.
- **"GPU stall due to ReadPixels" console notes** at load are expected: the character is rendered and
  read back twice to pick the dots. Nothing is read back after that.
