# Nimbus: sky-themed landing page

A static, dependency-free landing page for a fictional creative-agent product called **Nimbus**. The layout and interactions were modelled on [air.inc](https://air.inc). The brand, copy, illustrations and placeholder logos are all original, so swap in your own before shipping.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## What's in it

- **Time-of-day switcher** (right edge on desktop, bottom-right on mobile): sunrise, day, sunset and night re-tint the whole sky with animated CSS custom properties. Night adds stars and a moon and dims the clouds and meadow. The choice is saved in `localStorage`; the default is sunset.
- **Glass wordmark**: a script wordmark rendered as SVG text with a glass filter (`#glass` in `index.html`). It starts full-screen and shrinks into the nav logo as you scroll.
- **Procedural sky**: clouds are painted onto canvases once at load, then drifted and parallaxed with transforms only.
- **Hero task cycle**: the prompt pill types a request and the matching column (Learn / Arrange / Amplify) animates.
- **Prompt composer demo**, **logo marquees**, **tilting product tour** with auto-advancing tabs, **feature cards**, **sticky big-type section**, **demo form** (front end only), and a **canvas meadow footer** whose grass sways in the wind.
- Responsive down to small phones. It respects `prefers-reduced-motion`, and the menus, tabs and switcher are keyboard accessible.

## Structure

```
index.html            markup + shared SVG defs (glass filter, product illustration, icons)
assets/css/styles.css all styles, the four sky phases, responsive rules
assets/js/main.js     interactions (no dependencies)
assets/fonts/         self-hosted woff2 fonts + their OFL licenses
assets/img/           placeholder photos (see CREDITS.md)
```

## Make it yours

- **Brand name**: search for `Nimbus` in `index.html` and `main.js`. The wordmark is SVG text in the Sacramento font. The dot on the "i" is a separate `<circle>` (cx 618, cy 231) placed over a dotless `ı`, so re-position it if you change the word or font.
- **Sky colours**: edit the `html[data-phase="…"]` blocks near the top of `styles.css`.
- **Copy and imagery**: everything is plain HTML. Photos live in `assets/img/`.
- **Forms**: `#notify-form` and `#demo-form` only validate and show a thank-you message. Wire them to your backend in `main.js`.
