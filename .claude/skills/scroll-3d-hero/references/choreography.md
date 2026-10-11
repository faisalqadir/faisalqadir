# Choreography

How to design the motion: how progress is measured, a set of recipes, and a breakdown of the
kanaknaturals.com hero translated into this runtime's keyframes.

## Contents
- How progress maps to the page
- Principles that make it feel expensive
- Recipes: land in a card, flip reveal, zig-zag, turntable, zoom-through, product switcher
- Reference: kanaknaturals.com

## How progress maps to the page

```
track top hits viewport top ─────────── progress 0     (hero fills the screen)
│  section 2 top hits viewport top ──── progress = (section 2 offset) / (track height − viewport height)
│  …
track bottom hits viewport bottom ───── progress 1     (last section fills the screen; stage unpins after this)
```

With a hero plus two more full-height sections, the track is 300vh tall and has a 200vh scroll range.
Section 2's top arrives at 0.5 and the last section fills the screen at 1. Use `at: '#section-id'`
instead of hand-computed numbers; selectors are re-measured on resize and after fonts load.

Past progress 1 the stage scrolls away with the content. An anchored object scrolls away still sitting
in its card, which reads as "it's part of the page now".

## Principles that make it feel expensive

- **One big move per section.** Flip in one section, travel and shrink in the next, settle in the
  last. If everything changes everywhere at once, it reads as noise.
- **Stagger properties.** Give size, rotation and shadow their own keyframes (`{ at: 0.62, size: 0.42 }`)
  so they don't all start and stop together. This is the biggest quality jump for the least effort.
- **Rotate through the "ugly" angles quickly.** A flat object seen edge-on (`rx` near 0 or ±180) is a
  thin line. Pass through those angles mid-segment, where the easing is fastest, and never put a
  keyframe at them.
- **Land on a classic product angle.** About 55–70° of x-tilt with a little y gives a three-quarter
  view. Add full turns (`-295` instead of `65`) so the arrival is a revolution, not a nudge.
- **Shadow only when grounded.** Keep `shadow: 0` while it flies and fade it in just before landing.
- **Leave the copy alone.** At progress 0 the headline and main button must be fully visible. Push the
  object to the opposite side or below, and let it bleed off the edge of the screen: an object cut off
  by the screen edge looks bigger than one fully in frame.
- **Idle keeps it alive.** The default wobble (3.5°) is enough; more feels seasick.

## Recipes

### Hero → story → land in a card (the template)

```js
keyframes: [
  { at: 0, x: 0.58, y: -0.3, size: 0.95, rotate: [60, -30, 20], shadow: 0 },
  { at: '#statement', x: -0.08, y: 0.04, rotate: [-110, 20, -12] },
  { at: 0.62, size: 0.42 },
  { at: 0.85, shadow: 0 },
  { at: 1, anchor: '#s3h-slot', fit: 0.92, rotate: [-295, 0, 0], shadow: 1 },
]
```

### Turn-around reveal (show the back label of a bottle, box or bag)

For upright products modelled facing +Z, `ry` turns them around their own vertical axis, because the
y rotation is applied before the x tilt:

```js
keyframes: [
  { at: 0, x: 0.45, y: 0, size: 0.8, rotate: [8, -20, 0] },  // front, slightly turned
  { at: 0.5, rotate: [8, 160, 0] },                          // back label
  { at: 1, rotate: [8, 340, 0] },                            // front again
]
```

For flat objects (plates, lids, coasters) flip on x instead: `rotate: [60, 0, 0]` to `[-120, 0, 0]`
shows the underside.

Pair it with text that changes per half: hide/show copy with `--s3h-progress`, for example
`opacity: clamp(0, calc((var(--s3h-progress) - .5) * 8), 1)`.

### Zig-zag across feature sections (object opposite the text)

```js
keyframes: [
  { at: 0, x: 0.5, y: -0.2, size: 0.9, rotate: [60, -20, 10] },
  { at: '#feature-1', x: -0.5, y: 0, size: 0.6, rotate: [-60, 40, 0] },   // text on the right
  { at: '#feature-2', x: 0.5, y: 0, rotate: [-240, -30, 0] },             // text on the left
  { at: '#feature-3', x: -0.5, y: 0, rotate: [-420, 30, 0] },
  { at: 1, anchor: '#buy-slot', fit: 0.9, rotate: [-655, 0, 0], shadow: 1 },
]
```

Lay out each feature section with its copy on the side opposite the object at the moment the section
arrives.

### Turntable showcase (the product revolves in place)

```js
{ spin: 25, keyframes: [ { at: 0, x: 0.35, y: -0.05, size: 0.85, rotate: [62, 0, 0] }, { at: 1, x: 0.35, y: 0, size: 0.7, rotate: [62, 0, 0] } ] }
```

`spin` turns around the model's own up axis independently of scroll. Combine it with keyframed `ry`
for "spins faster while scrolling" (`rotate: [62, 720, 0]` at the end).

### Zoom-through (the object flies at the camera and the next section is revealed)

```js
{ at: 0.7, z: 0, size: 0.6 },
{ at: 0.85, z: 4.2, size: 0.6, ease: 'easeIn' }, // the camera sits at z = 5, so it fills the screen
{ at: 0.86, size: 0 },                           // then vanishes
```

### An animal walking through the page

For a rigged model with `animation: { idle, walk, run }` (see SKILL.md and `template-animal.html`):

```js
keyframes: [
  { at: 0, x: 0.55, y: -0.62, size: 0.34, rotate: [8, 0, 0], shadow: 1 }, // stands in the hero
  { at: '#trail', x: 0.2 },        // starts strolling as the next section arrives
  { at: 0.45, x: -0.55 },          // walks to the left edge
  { at: 0.55, x: -0.55 },          // the same x on two keyframes = it stops and looks around
  { at: 0.85, x: 0.5 },            // more distance over a similar stretch of scroll = it runs
  { at: 1, anchor: '#den-slot', fit: 0.95 },   // trots into a card and stands there
]
```

- **A ground line.** Keep `y` constant while it walks (around -0.6 to -0.8), so it reads as walking
  on a floor. Change `y` only where it should climb or jump. Give the shadow
  `offset: 0.25`–`0.3` so it sits under the feet.
- **Tilt, don't turn.** Use `rotate` only for a slight x tilt (8–12°) that shows a little of its back.
  The runtime turns it left or right to face where it's going (`face`).
- **Pauses are free.** Two keyframes with the same `x` make it stop, idle and look around while the
  reader takes in that section.
- **Gait follows ground speed,** in body lengths per second. A big character on a narrow phone screen
  covers little ground and only walks; make it smaller on phones with `responsive`.
- **Keep its lane clear.** Put section copy in the top two-thirds of the screen, away from its path.

### A leap that follows the scroll (stops mid-air when the visitor stops)

From `template-animal.html`: the fox stands at the upper right, then leaps diagonally down to the
lower left. The position, pitch and leg motion all follow the scrollbar.

```js
animation: { idle: 'Survey', walk: 'Walk', run: 'Run', still: 'pose' }, // no idle fidgeting at rest
keyframes: [
  { at: 0, x: 0.5, y: 0.22, size: 0.34, rotate: [8, 0, 0], shadow: 1 },
  { at: 0.18, x: 0.5, y: 0.22, rz: 0, shadow: 1 },          // about to jump
  { at: 0.18, clip: 'Run', clipTime: 0 },                   // start scrubbing the run cycle
  { at: 0.23, shadow: 0 },                                  // off the ground
  { at: 0.24, rz: -16 },                                    // take-off, nose up (facing left)
  { at: 0.28, x: 0.2, y: 0.32, size: 0.4, ease: 'easeOut' }, // top of the arc
  { at: 0.36, rz: 22 },                                     // diving, nose down
  { at: 0.42, x: -0.5, y: -0.62, size: 0.34, rz: 6, shadow: 1, ease: 'easeIn' }, // lands
  { at: 0.42, clip: 'Run', clipTime: 1, ease: 'linear' },   // one bound, scrubbed linearly
  { at: 0.46, rz: 0 },
  { at: 0.58, x: -0.5, y: -0.62 },                          // stands still
]
```

- Two keyframes can share an `at`: one moves the body with its own easing, while the other scrubs
  the clip with `linear` so the legs don't speed up and slow down.
- `easeOut` into the apex and `easeIn` into the landing give the arc a feel of gravity.
- Fade the shadow out while airborne and back in on landing.
- A clip-less model (or no jump clip) still works: scrub the run cycle, or skip `clip` and let the
  arc and pitch carry the jump.

### Product switcher in the landing card

```js
next.onclick = () => hero.setModel({ url: models[++i % models.length] }, { direction: 1 });
prev.onclick = () => hero.setModel({ url: models[--i < 0 ? (i = models.length - 1) : i] }, { direction: -1 });
```

The outgoing model spins half a turn while shrinking to zero, and the incoming one spins in from the
other side. Calls in quick succession are queued, and stale ones are dropped.

## Reference: kanaknaturals.com

This is how the plate hero on kanaknaturals.com was built, as observed in its production bundle in
October 2026. It's useful when a user says "make it like that". The goal is the same motion with the
user's own assets, never their models or code.

**Stack.** Astro islands with React Three Fiber; drei's `Environment` (a warehouse HDR) and
`ContactShadows`; framer-motion's `scroll()` for progress; Lenis smooth scrolling. Models are
Draco-compressed GLBs produced with `gltfjsx --transform`, swapped per product.

**Layout.** `.home-hero-three` is absolutely positioned over the hero, the "Your reputation is our
pride" statement and the product-cards section (`z-index: 99`, `pointer-events: none`).
`.home-hero-three-stick` inside it is `position: sticky; top: 0; height: 100vh`. This skill uses the
same structure.

**Camera.** fov 30, positioned at z = 5.

**Motion.** Scroll distance is measured from the page top to the point where the product card is
vertically centred, then split into phases:

| Phase | Their values | In this runtime's units |
| --- | --- | --- |
| Start | position (1.6, −0.65), rotation π·(0.25, −0.28, 0.165), scale 16 | `x: 0.67, y: -0.49, rotate: [45, -50, 30]`, about as big as the right half of the screen |
| 0 → 40% | move to (−0.3, 0); rotation → π·(−1, 0, −0.05) | `at: 0.4, x: -0.13, y: 0, rotate: [-180, 0, -9]`: flipped upside down |
| 0 → 60% | scale 16 → 5 | `at: 0.6, size` ≈ 31% of the start size |
| 40 → 100% | canvas slides sideways to the card centre; rotation → π·(−1.91, 0.33, 0) | `at: 1, anchor: card, rotate: [-344, 59, 0]`: almost a full revolution in x plus a sixth of a turn in y |
| 60 → 100% | scale 5 → 7 | grows slightly into the card (`fit`) |
| Idle | rotation x/y eased towards cos(t/2)·0.02π | `idle: { wobble: 3.6, speed: 0.5 }` |
| Card | switching products spins models out and in about y with scale 0 ↔ 1 | `setModel(…, { direction })` |

As one keyframe list for this runtime (their bowl model is deep, so it reads fine edge-on; for a flat
plate end on about `-295` instead of `-344`):

```js
keyframes: [
  { at: 0, x: 0.67, y: -0.49, size: 1.2, rotate: [45, -50, 30] },
  { at: 0.4, x: -0.13, y: 0, rotate: [-180, 0, -9] },
  { at: 0.6, size: 0.38 },
  { at: 0.9, shadow: 0 },
  { at: 1, anchor: '#product-card-slot', fit: 0.9, rotate: [-344, 59, 0], shadow: 1 },
]
```

They also float a decorative orange fork in the background with its own scroll path. To do the same,
add a second mesh through `hero.scene` and move it in `onUpdate(progress)`.
