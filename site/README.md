# Snolep Technologies site (draft)

Open `index.html` over a local server (ES modules don't load from `file://`), e.g. `npx serve site`.

- The fox is a stand-in for the snow leopard: replace `models/fox.glb` with a rigged model that has
  idle and run clips, and update the clip names and the footer credit in `index.html`.
- Project cards are placeholders: swap in real names, images, links and lines.
- `js/dot-story.js` and `js/scroll-3d-hero.js` come from `.claude/skills/scroll-3d-hero/assets/`.
- Check the motion at speed with
  `node .claude/skills/scroll-3d-hero/scripts/dot-story-motion.mjs site/index.html --from 0 --to "#cta:0.3"`.
