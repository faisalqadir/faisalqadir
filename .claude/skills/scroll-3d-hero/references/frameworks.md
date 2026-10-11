# Framework setup

The runtime is a plain ES module that imports `three` and `three/addons/...`. It creates its own
renderer, so it works the same everywhere. Mount it after the markup exists and call `destroy()` when
the component unmounts. The markup and CSS are the same as in SKILL.md in every case.

## Plain HTML / static sites

Use `assets/template.html` as is: an import map pointing at a pinned three.js on jsDelivr, plus a
`<script type="module">`. Serve over http (not `file://`).

## Vite, webpack, Parcel (no framework)

```bash
npm i three
```

Copy `scroll-3d-hero.js` into `src/lib/`. Drop the import map; the bundler resolves `three` and
`three/addons/*` (three's package exports map `addons/*` to `examples/jsm/*`).

```js
import { createScroll3DHero } from './lib/scroll-3d-hero.js';
createScroll3DHero({ /* … */ });
```

Static model files go in `public/` and are referenced as `/models/product.glb`.

## React / Next.js

```jsx
'use client'; // Next.js App Router
import { useEffect } from 'react';

export default function Hero3D({ children }) {
  useEffect(() => {
    let hero;
    let cancelled = false;
    // a dynamic import keeps three.js out of the server bundle and out of the first JS chunk
    import('@/lib/scroll-3d-hero').then(({ createScroll3DHero }) => {
      if (cancelled) return;
      hero = createScroll3DHero({
        track: '.s3h',
        stage: '.s3h-stage',
        model: { url: '/models/product.glb' },
        keyframes: [/* … */],
      });
    });
    return () => {
      cancelled = true;
      hero?.destroy(); // also handles StrictMode's mount → unmount → mount in development
    };
  }, []);

  return (
    <div className="s3h">
      <div className="s3h-layer" aria-hidden="true"><div className="s3h-stage" /></div>
      {children /* hero, story sections, product section with #s3h-slot */}
    </div>
  );
}
```

Pass element refs instead of selectors if several heroes could exist on one page
(`track: trackRef.current`). In the Pages Router, use `next/dynamic` with `ssr: false` or the same
`useEffect` pattern.

**Already using React Three Fiber?** You can still use the runtime; it is independent of any existing
`<Canvas>`. To build it natively in R3F instead, mirror the structure: a sticky `100vh` div holding
`<Canvas camera={{ fov: 30, position: [0, 0, 5] }}>`, scroll progress read from the track's
`getBoundingClientRect()` inside `useFrame`, and the same per-property keyframe interpolation applied
to a group's position, rotation and scale. kanaknaturals.com is built that way (see
`choreography.md`).

## Vue / Nuxt

```vue
<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
let hero;
onMounted(async () => {
  const { createScroll3DHero } = await import('~/lib/scroll-3d-hero.js');
  hero = createScroll3DHero({ /* … */ });
});
onBeforeUnmount(() => hero?.destroy());
</script>
```

In Nuxt, wrap the component in `<ClientOnly>` or name it `*.client.vue`.

## Svelte / SvelteKit

```svelte
<script>
  import { onMount } from 'svelte';
  onMount(() => {
    let hero;
    import('$lib/scroll-3d-hero.js').then(({ createScroll3DHero }) => (hero = createScroll3DHero({ /* … */ })));
    return () => hero?.destroy();
  });
</script>
```

## Astro

Put the markup in a `.astro` component and the setup in a plain `<script>` tag. Astro bundles it with
Vite, so `npm i three` and import normally. With view transitions, create the hero on
`astro:page-load` and destroy it on `astro:before-swap`.

## WordPress, Webflow, Shopify, Framer and other site builders

1. Upload `scroll-3d-hero.js` (and the GLB) as site assets or to a CDN you control.
2. Add the import map and the module script to the page's custom code, before `</body>`, using the
   uploaded file's absolute URL in the `import`.
3. Recreate the track, layer and stage structure with the builder's divs and classes, and paste the CSS.
4. Look for wrappers with `overflow: hidden`, which page builders add often. Switch them to `clip`, or
   sticky won't pin; the runtime's console warning names the element.

On Shopify, put the script in the theme section's liquid file and the asset in `assets/`
(`{{ 'scroll-3d-hero.js' | asset_url }}`).
