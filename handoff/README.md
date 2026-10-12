# Handoff: continuing this work locally

## Get the work
    git clone <your repo> && cd faisalqadir && git checkout claude/wonderful-cray-q14z90

Everything is on this branch:
- `.claude/skills/scroll-3d-hero/`: 3D hero, animated fox, dotted wordmark, dot story (hourglass)
- `.claude/skills/scroll-clouds/`: cloud cover transition (dark blue to white)
- `demo/`: single-file demos (open in a browser: snolep-dot-story.html, snolep-clouds.html, index.html)
- `docs/scroll-3d-hero-guide.pdf`: guide (frozen at its last version; don't update it)

## Continue in Claude Code on your machine
Open the repo in Claude Code locally; the skills load automatically from `.claude/skills/`.
To give the new session the full history, start with:

    Read handoff/README.md, then continue the Snolep dot-story / cloud work on branch
    claude/wonderful-cray-q14z90. The full previous transcript is handoff/session-transcript.jsonl.gz.

## Where things stand
- Dot story v5: the fox is pinned dots on a rigged GLB (Atkinson-dithered), pounces in one spline
  into the hourglass, sand funnels through, the fox exits and runs, then dots form SNOLEP TECHNOLOGIES.
  Verified at normal speed and at 3,000/6,000 px/s and page jumps (scripts/dot-story-motion.mjs).
- Clouds: procedural WebGL, ~5 KB, mock is Snolep-branded.
- Page weight: dot story page ~470 KB; unitedcarriers.com ~4.6 MB first screen, ~11.4 MB full scroll.

## Open options (not done)
- Swap the Fox stand-in for a rigged snow leopard GLB (idle + run clips).
- Lighter page: drop unused DRACO/meshopt/RoomEnvironment imports (-15 KB), static font files
  (-40-50 KB), or pre-bake the dots to remove three.js and the model (-~300 KB).
- Optionally integrate the cloud transition into the dot-story page.

## Testing locally
Needs Node and Playwright (`npm i -g playwright && npx playwright install chromium`):

    node .claude/skills/scroll-3d-hero/scripts/preview.mjs .claude/skills/scroll-3d-hero/assets/template.html
    node .claude/skills/scroll-3d-hero/scripts/dot-story-motion.mjs .claude/skills/scroll-3d-hero/assets/template-dot-story.html --from "#hourglass-section:-1.9" --to "#run:0.3"
    node .claude/skills/scroll-clouds/scripts/preview.mjs .claude/skills/scroll-clouds/assets/template.html
