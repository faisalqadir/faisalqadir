# Models

What the runtime accepts, where a product model comes from, and how to get it small enough to load
instantly.

## What the runtime accepts

```js
model: { shape: 'plate' }                               // built-in, no download
model: { shape: 'bowl', color: '#d9c7a5', ribs: 0 }     // options: color, roughness, ribs (count), ribDepth, texture (fibre speckle)
model: { url: '/models/cup.glb' }                       // glTF/GLB, Draco or Meshopt compressed is fine
model: { url: '/models/cup.glb', rotate: [-90, 0, 0] }  // fix a model exported lying down
model: { url: '/models/cup.glb', prepare(obj) { … } }   // tweak materials before display
model: { object: myThreeObject3D }                      // anything you build yourself
```

Every model is centred and scaled so its largest dimension is 1 before keyframes apply, so swapping
models never breaks the choreography. Orientation still matters: the runtime treats +Y as up and +Z as
facing the camera. That is glTF's convention, and Blender's glTF exporter converts to it automatically.

## Where a model comes from

Pick the first option that fits:

1. **The client's own files.** Packaging and product companies often have CAD (STEP) or 3D files from
   their tooling supplier. Convert CAD in Blender (via the STEP importer add-on) or a CAD tool's glTF
   export.
2. **Model it in Blender.** Most packaging (plates, bowls, cups, lids, bottles, jars) is rotationally
   symmetric. Draw half the profile and use the Screw modifier or Spin, as the built-in shapes do with
   `LatheGeometry`. Add ribs or embossing with a displacement or a normal map. This takes about an
   hour for a clean result.
3. **Photogrammetry or a phone scan** of the real product (Polycam, RealityScan, Luma). This is fast
   and photoreal, but needs cleanup: decimate to under about 50k triangles and bake textures.
4. **AI image-to-3D tools** turn a product photo into a rough model. They're fine for a mock-up; check
   silhouettes and the details of the brand mark before shipping.
5. **Marketplaces** (Sketchfab, CGTrader, Poly Haven for CC0). Check the licence allows commercial web use.

Never lift GLBs from the site that inspired the effect. They belong to that brand.

## Export settings (Blender → glTF 2.0)

- Format **glTF Binary (.glb)**; include only the selected objects; check **+Y Up**.
- Apply all transforms (Ctrl+A → All Transforms) and modifiers first.
- Use Principled BSDF materials (base colour, roughness, metallic, normal); procedural Blender nodes
  don't export, so bake them to textures.
- Textures at 1024–2048 px. A 4k texture on a hero object is wasted bandwidth.

## Compress it

The target is under 2–3 MB, ideally under 1 MB. glTF Transform does it in one command:

```bash
npx @gltf-transform/cli optimize input.glb public/models/product.glb \
  --compress draco --texture-compress webp --texture-size 2048
```

- `--compress draco` (or `meshopt`): both are decoded by the runtime. Draco decoders load from
  jsDelivr by default; self-host them by copying `three/examples/jsm/libs/draco/gltf/` and passing
  `dracoPath`.
- `--texture-compress webp`: use WebP or AVIF. KTX2 textures need a KTX2 loader, which this runtime
  doesn't set up.
- `optimize` also simplifies geometry by default. If fine details such as embossing, ribs or a lip get
  lost, add `--simplify false`. For a single product, `--instance false` keeps meshes plain.
- `npx @gltf-transform/cli inspect product.glb` shows sizes per mesh and texture, to find what's heavy.

`npx gltfjsx model.glb --transform` (the React Three Fiber tool) produces a similar compressed GLB, if
the user already uses it.

## Make it look right

- **Too shiny or too plastic?** Raise roughness in `prepare`:
  `obj.traverse(o => o.isMesh && (o.material.roughness = 0.85))`.
- **Washed out?** Lower `lighting.environment` (0.4–0.6) or `lighting.exposure`. For accurate brand
  colours keep `toneMapping: 'neutral'`; `'aces'` is more filmic but shifts colours.
- **Looks flat?** Raise `lighting.key`. The key light comes from the upper right, in front.
- **Dark on one side after a flip?** That's real lighting and usually reads well mid-motion. Choose
  landing rotations where the face you show points up or towards the right.
- **A poster image** for loading and no-WebGL: run `scripts/preview.mjs --stops 0`, crop the object out
  of `desktop-0.png`, save it as WebP, and put it inside the stage as `<img class="s3h-poster">`.

## Building a custom shape in code

When there's no model yet but the product isn't a plate or bowl, a lathe profile gets close fast:

```js
import * as THREE from 'three';
// [radius, height] from the bottom centre up the outside, over the rim, down the inside
const profile = [[0, 0], [0.3, 0], [0.34, 0.02], [0.4, 0.9], [0.42, 1], [0.4, 1], [0.38, 0.92], [0.32, 0.04], [0, 0.04]]
  .map(([r, y]) => new THREE.Vector2(r, y));
const cup = new THREE.Mesh(
  new THREE.LatheGeometry(new THREE.SplineCurve(profile).getPoints(80), 128),
  new THREE.MeshStandardMaterial({ color: '#f2ede4', roughness: 0.8, side: THREE.DoubleSide })
);
createScroll3DHero({ model: { object: cup }, /* … */ });
```
