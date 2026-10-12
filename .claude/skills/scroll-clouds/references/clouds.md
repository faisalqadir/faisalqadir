# Scroll clouds: how it works and how to tune it

## Contents
- How the shader works
- Pacing the cover
- Colour recipes
- Performance
- Accessibility and fallbacks

## How the shader works

One full-screen triangle, one fragment shader, re-drawn only when the scroll moves:

1. **The scene.** `from`, slightly lighter low down, with a very slow noise variation so the dark
   isn't flat.
2. **Three cloud layers, far to near.** Each samples cloud density: fractal gradient noise (five
   octaves) whose input is warped by a second, slower noise, so the shapes billow, plus a finer layer
   that frays the edges. Nearer layers are bigger, travel further sideways with the scroll (`wind`)
   and grow faster as the cover rises (`zoom`), so they seem to rush past the viewer.
3. **Coverage.** Each layer cuts its density at a threshold chosen from the share of sky it should
   cover at this point in the scroll. Density bunches around its middle, so a straight sweep of the
   threshold would jump from a few clouds to a full cover; working from the share keeps the build-up
   even. Far layers lead a little, and the edges of the screen cloud over first (`wisps`).
4. **Light.** Each layer compares its density with a sample nudged towards the light (upper left):
   where the cloud thins towards the light it is lit (`light`), elsewhere shaded (`shade`). The shade
   whitens as the cover rises, so the inside of the bank is white, not grey.
5. **The end.** Over the last stretch everything eases to `to`, so the next section meets a solid
   colour. A little grain stops banding in the gradients.

The scroll progress is eased (smoothstep) and damped, and the track gets `--cloud-cover` with the
same eased value, so copy moves in step with the clouds.

## Pacing the cover

- The track's height sets how long the transition lasts: 250vh is brisk, 350vh is leisurely.
- `start` / `end` choose the part of the track it happens over. `end: 0.88` leaves the last 12% solid,
  which hides the join with the next section.
- For a scene that starts clear, set `wisps: 0`. For one that starts half cloudy, raise `wisps` and
  start the track earlier.
- Copy over the dark scene: fade it out by a cover of about 0.35–0.45. Copy on the far side: fade
  it in after about 0.8, when the screen is mostly white.

## Colour recipes

| Look | `from` | `to` | `light` | `shade` |
| --- | --- | --- | --- | --- |
| Night sky to day (template) | `#0b1a4a` | `#ffffff` | `#ffffff` | `#7f90bd` |
| Storm to overcast | `#1c2230` | `#e9ecef` | `#f4f5f7` | `#5d6676` |
| Dusk to warm white | `#2a1f3d` | `#fbf6ef` | `#fff8ee` | `#b48ea0` |
| Ocean to fog | `#0f2f45` | `#eef3f5` | `#ffffff` | `#7d98a8` |
| White to dark (reverse) | `#ffffff` | `#0b0f1a` | `#2b3348` | `#0b0f1a` |

For the reverse (light into dark), dark "clouds" over a light scene read as smoke or ink; lower
`softness` a little so the edges stay defined.

## Performance

- About 12 KB of JavaScript (5 KB gzipped), no libraries, no images.
- It draws only while the scroll position is changing (or `drift` is on), and stops when settled.
- Fill rate is the cost: three layers with lighting is about 40 noise samples per pixel. At the
  default half resolution a 1440×900 screen renders about 320,000 pixels per frame, which modern
  laptops and phones handle easily. On weak phones use `resolution: 0.35`.
- Only one context: put one cloud transition per page, or reuse the same canvas.

## Accessibility and fallbacks

- `prefers-reduced-motion`: the cover still follows the scroll (it carries meaning), but `zoom`,
  `wind` and `drift` are off and nothing is damped.
- No WebGL: the canvas fades from `from` to `to`, and `--cloud-cover` still drives the copy.
- The canvas is `aria-hidden`; the copy inside the stage is ordinary text.
