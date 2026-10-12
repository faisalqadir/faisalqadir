# Snolep Technologies site (draft)

Open `index.html` over a local server (ES modules don't load from `file://`), e.g. `npx serve site`.

- The fox is a stand-in for the snow leopard: replace `models/fox.glb` with a rigged model that has
  idle and run clips, and update the clip names and the footer credit in `index.html`.
- Project cards are placeholders: swap in real names, images, links and lines.
- `img/snolep-leopard.webp` and `img/snolep-wordmark.webp` are the Snolep logo cut in two on the same
  frame: the leopard (with its tail) dissolves into the dots, the lettering stays. Re-cut both from a
  new logo if it changes, and move `#perch-0` (where the animal stands) to the leopard's feet.
- The cursor (fine pointers only) is a ring that fills with the scroll; over the call to action it
  becomes a "work with us" disc with a motion-blur trail. Set the real address on `#cta-link`.
- `js/dot-story.js` and `js/scroll-3d-hero.js` come from `.claude/skills/scroll-3d-hero/assets/`.
- Check the motion at speed with
  `node .claude/skills/scroll-3d-hero/scripts/dot-story-motion.mjs site/index.html --from 0 --to 1`.
