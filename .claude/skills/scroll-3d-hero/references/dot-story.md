# Dot story: one field of dots from hero to footer

`assets/dot-story.js` draws everything with a single layer of dots and changes what they form as the
page scrolls:

1. **The character:** an animated 3D model drawn as dots. It walks, leaps and holds still exactly
   like scroll-3d-hero's animated models, and stays in one piece while it moves.
2. **The hourglass:** in one fluid pounce the character dives head first into the glass and crumbles
   into sand. The sand runs through the neck while more is still pouring in, then the character comes
   back out of the bottom and runs on without a pause.
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
- **Fluid motion.** `ease: 'spline'` joins keyframes with a curve that keeps its speed through them
  (Catmull-Rom), and next to a linear or anchored segment it matches that segment's speed, so the
  character flows from one into the other instead of stopping at each keyframe.
- **Synced with the page.** Keyframes can anchor the character to an element. Heading for one from
  elsewhere, it aims where the element will be when the page reaches that keyframe (worked out at
  layout), so it doesn't chase an element that is still scrolling. Between two keyframes on the same
  element it rides along with it. Its gait only counts its own motion along the keyframes.
- **Into the glass.** With `align: 'pour'` the character passes through the anchor head first: its
  leading point is `pour` of its own length past the rim (negative: still above it). Moving `pour` at
  a steady rate moves it in at a steady speed, and each dot turns to sand the moment it crosses the
  rim: it clings to the body a moment, drops straight down and spreads out only as it lands.
- **Draining like real sand.** The top bulb is a stack: landed sand keeps its cell, and the top layer
  runs out first, down the middle to the neck, as sand funnels. Layers fill from the walls in, so the
  middle sits low. `drain` can start long before the top is full; sand only moves on once it has
  landed. The route is worked out once per layout, so it plays the same forwards and backwards.
- **Out of the bottom.** Once all the sand is in the bottom bulb, `align: 'emerge'` brings the
  character out of the opening in the base the same way, nose first: each dot leaves the top of the
  mound just in time to reach its place as that place comes through the opening.
- **Into the wordmark.** The lowest dots leave first, so the character streams down into the name,
  which builds up from left to right.
- **Colours.** Dots use the canvas's CSS `color`. Inside the dark panel they switch to `--panel-dots`.
- **Fast scrolls.** The story eases after the scrollbar but never trails it by more than `maxLag`
  (0.12 of a screen), so on a flick the character keeps in step with the page. The sand can only
  move so fast: on a flick the pour, drain and emerge fall behind and catch up a moment after the
  scroll stops, the drain waits for sand that has landed and the character only comes out once all
  of it is at the bottom, so every dot takes its whole way through the glass however fast you go.
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
  // stands, then one long scrubbed pounce, up over the page and into the glass, never stopping
  { at: '#leap', after: -0.7, x: 0.5, y: 0.25, pitch: 0 },
  { at: '#leap', after: -0.7, clip: 'Run', clipTime: 0 },
  { at: '#leap', after: -0.5, pitch: 16, ease: 'spline' },
  { at: '#hourglass-section', after: -0.85, x: 0, y: 0.7, size: 0.31, ease: 'spline' },
  { at: '#hourglass-section', after: -0.4, pitch: -25, ease: 'spline' },
  // nose down over the opening just as the glass settles, already moving in...
  { at: '#hourglass-section', after: 0, anchor: '#hg-top', align: 'pour', pour: -0.2, size: 0.22, pitch: -70, ease: 'spline' },
  { at: '#hourglass-section', after: 0, clip: 'Run', clipTime: 1.5, ease: 'linear' },
  // ...and in at an even pace
  { at: '#hourglass-section', after: 0.75, anchor: '#hg-top', align: 'pour', pour: 1.35, ease: 'linear' },
  // the sand runs through the neck while the rest is still pouring in
  { at: '#hourglass-section', after: 0.2, drain: 0 },
  { at: '#hourglass-section', after: 1.45, drain: 1, ease: 'linear' },
  // out of the bottom at the same pace, before the panel scrolls away...
  { at: '#hourglass-section', after: 1.5, anchor: '#hg-bottom', align: 'emerge', emerge: -0.35, size: 0.22, pitch: -70 },
  { at: '#hourglass-section', after: 2.0, anchor: '#hg-bottom', align: 'emerge', emerge: 1, size: 0.22, pitch: -70, ease: 'linear' },
  // ...and straight on into a run, levelling out
  { at: '#run', after: 0, x: 0.45, y: -0.5, size: 0.36, pitch: 0, ease: 'spline' },
  { at: '#run', after: 0.15, form: 'character' },
  { at: 1, form: 'logo' },
]
```

| Key | Meaning |
| --- | --- |
| `x`, `y` | Character centre in viewport units (−1 left/bottom, 1 right/top). |
| `anchor` | An element to head for, or ride along with between two keyframes on it (`x`/`y` then offset it). |
| `align` | With an anchor: `'bottom'` stands the character on it, `'top'` hangs it underneath, `'pour'` and `'emerge'` pass it through head first. |
| `size` | Character length as a fraction of the viewport's shorter side. |
| `pitch` | Nose up (+) or down (−) in degrees, whichever way it faces. Match the dive to `hourglass.dive`. |
| `clip`, `clipTime` | Scrub a clip with the scroll between two keyframes, in cycles. |
| `pour` | How far the character has gone into the hourglass, in its own lengths along the dive (below 0: still above the rim). |
| `drain` | 0–1: how much sand has run through the neck. It can overlap `pour`. |
| `emerge` | How far it has come back out of the bottom, in lengths (after all the sand has landed). |
| `form` | `'character'` or `'logo'`. Between two forms the dots move across one by one. |
| `ease` | Easing for the segment ending at this keyframe: `'linear'`, `'easeIn'`, `'easeOut'`, `'easeInOut'` (default) or `'spline'`. |

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
  damping: 8, maxLag: 0.12, // eases after the scrollbar, but never more than this many screens behind
  pointer: { radius: 64, force: 5 },
  particles: 2400,   // pool size if there's no logo
});
```

- `hourglass.dive`: the pitch of the dive; the dots go in lowest-first in that pose. Match it to the
  `pitch` keyframe of the dive.
- `hourglass.crumble`: how much further (in lengths) the character travels while a dot falls onto the
  sand. Higher shows more of the body crumbling inside the glass.

Add `?dots-debug` to the URL for an overlay with progress, form, pose and flow counts. The canvas gets
`data-ready` and `data-settled`, for screenshot scripts.

## Tuning and pitfalls

- **Side views read best.** The dots are picked from a side view, and `face.idle` of about 75° keeps
  the character near profile at rest. Turning round still works: the pinned dots rotate in 3D.
- **Keep it moving.** Default easing starts and stops every segment, which reads as a pause at each
  keyframe. Use `'spline'` for the flight and `'linear'` for the pour and emerge, and have the
  spline arrive at the keyframe where the pour starts, so the speed carries straight through the rim.
- **Go in once the glass is pinned.** Start the pour when the sticky panel has settled (and finish
  `emerge` before it scrolls away), so the glass isn't moving under the character. Size the glass to
  leave about the character's length above and below it.
- **Mind the copy.** Captions scroll past a character that stays put on screen, so the two must be
  apart sideways: on phones the template keeps copy in the left half and sends the fox up the right.
- **Pour and drain in proportion.** If `drain` runs ahead of `pour` it waits for sand to land, so the
  stream thins out. Starting `drain` just as the first sand lands looks most natural.
- **Check the motion, not just the frames, and at speed.** `?dots-debug` shows the character's
  centre, how far the story trails the scrollbar and how far the character's dots trail their places.
  `scripts/dot-story-motion.mjs` scrolls at set speeds (3,000 and 6,000 px/s and page-down jumps) on
  a stepped 60 fps clock, saves frames and reports both numbers:

  ```bash
  node scripts/dot-story-motion.mjs page.html --from "#hourglass-section:-1.9" --to "#run:0.3"
  ```

  The dots should trail their places by 0 (a few pixels at most, for one frame or two) at every
  speed; anything more means dots are skipping a step of the story.
- **Give the ending room.** The merge into the wordmark needs a few hundred pixels of scrolling. The
  template's run section is 160vh, with its copy low enough that the fox runs in above it.
- **Pool size versus character size.** The dots are shared, so a bigger pool means a finer, denser
  character. If the character looks crowded, lower the wordmark's `dotsPerCap` or make the
  character bigger. About 1,000–2,000 dots suits a character around a third of the screen long.
- **Keep copy out of the path.** The leap runs from upper right to lower left, so captions go top
  right; on phones the caption sits above the glass.
- **Hosts that block file downloads** (such as single-file demos): pass `character: { buffer }` with
  the GLB's bytes.
- **"GPU stall due to ReadPixels" console notes** at load are expected: the character is rendered and
  read back twice to pick the dots. Nothing is read back after that.
