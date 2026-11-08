---
name: sakura-qr-tree
description: Build the "QR code <-> voxel cherry-blossom tree" interactive widget (Three.js). Tap the tree and it dissolves into petals while the QR code rises out of the plate; tap again and the tree regrows. Use for QR/link-sharing pages, landing-page heroes, or portfolio showcases.
---

# Sakura QR Tree

A 3D voxel scene: a plate of 29×29-ish columns encodes a QR code. In **tree** state the dark modules are sunk pits and a procedural voxel sakura tree stands on the plate; in **qr** state the tree dissolves into falling petals, dark modules pop up in the theme colour (ripple from the centre) and the camera swings from a ~29° isometric view to a straight top-down view. Click/tap the canvas to toggle.

## Files (assets/)
- `sakura-qr-tree.js` – ES module source (needs `three` ≥ 0.160 via import map, plus a QR encoder)
- `sakura-qr-tree.bundle.js` – IIFE bundle incl. three + qrcode-generator → `window.SakuraQR`
- `sakura-qr-tree-standalone.html` – single-file demo (open directly, or publish as an artifact)
- `demo.html` – minimal page using the bundle

## Quick start
```html
<div id="app" style="height:100vh"></div>
<script src="sakura-qr-tree.bundle.js"></script>
<script>
  const app = SakuraQR.createSakuraQR(document.getElementById('app'), { url: 'https://yoursite.com' });
</script>
```
ES-module use: `import { createSakuraQR } from './sakura-qr-tree.js'` with an import map for `three`, and `<script src=".../qrcode.js">` (qrcode-generator, defines global `qrcode`) — or pass `encode: (text) => boolean[][]`.

The container **must have a height** (the widget fills it: canvas on top, controls below).

## Options
| option | default | meaning |
|---|---|---|
| `url` | `'https://yoursite.com'` | text encoded in the QR (empty → placeholder) |
| `color` | `'pink'` | `pink purple red amber blue white` (see `PALETTES`) |
| `mode` | `'spring'` | `spring` normal · `bloom` replays canopy bloom + dense petals · `breeze` strong sway + wind-blown petals |
| `state` | `'tree'` | initial `'tree'` or `'qr'` |
| `ui` | `true` | URL input, Share button, mode pill, colour swatches, sound toggle; `false` = canvas only |
| `sound` | `false` | wind ambience + chimes on toggle (needs user gesture) |
| `seed` | `7` | different seed → different tree |
| `petals` | `460` | petal instance count |
| `duration` | `1.7` | transition seconds |
| `encode` | qrcode-generator | custom `text → boolean[][]` |
| `onToggle(state)`, `onShare(url)`, `onChange(patch)` | – | callbacks (`onShare` replaces the default Web Share / copy-link) |
| `preserveDrawingBuffer` | `false` | set `true` for screenshots/tests |

## Controller API
`toggle()` · `setState('tree'|'qr')` · `snap('tree'|'qr')` (no animation) · `seek(0..1)` (freeze mid-transition) · `setUrl(url)` · `setColor(name)` · `setMode(name)` · `setSound(bool)` · `destroy()` · read-only `state`, `progress`, `matrix`, `canvas`.

## How the effect works (to re-implement or tweak)
- One master progress `m` (0 tree → 1 QR) animates linearly; everything derives from it:
  - **Modules** (`InstancedMesh`, 1 box per cell, +1 cell margin): dark module `i` pops with `easeOutBack((m − (0.18 + dist·0.36 + rand·0.07)) / 0.34)`; height −0.62 → +0.5, colour pit-grey → theme QR colour. Reversing `m` gives the reverse ripple for free.
  - **Tree voxels**: each has a growth `order` (trunk low, canopy outer high). Shrink starts at `(1 − order)·0.3`, lasts 0.3 of `m`; canopy dissolves first, trunk last.
  - **Camera**: `easeInOut(m)` interpolates elevation 29°→89.6°, azimuth −24°→0, look-at y 12.5→0, and fit distance.
  - **Petals**: instanced planes with gravity + sine drift; burst of ~260 on tap; fewer/smaller in QR state.
- **Tree generator** (`buildTree(seed)`, units = plate cells, voxel 0.6): twisted tapered trunk, 6 roots, 6 branches reaching into the canopy, canopy = clusters of small noisy lumps around ~14 blob centres, random single-voxel sprinkles for a ragged edge, surface-only voxels kept. Leaf colour = fbm noise mapped to dark-pink → base → near-white patches; 3 small flower bushes on the plate.
- Sway is a vertex-shader patch (`onBeforeCompile`) driven by `uSway` (spring .35 / bloom .45 / breeze 1.5).
- Lighting: hemisphere + one shadow-casting directional light from the right (shadow falls left), `ShadowMaterial` floor.

## Gotchas
- Needs WebGL. `PCFSoftShadowMap` was removed in three r18x — the code uses `PCFShadowMap`.
- ~40–60k tree instances: fine on GPUs; on software rendering (headless) animation runs slower than real time → use `seek()`/`snap()` for screenshots.
- Headless test flags: `chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})`.
- Keep QR data short (version ≤ 5) so modules stay large; ECC level is `M`.
- Share button uses `navigator.share`, falling back to clipboard copy + toast.

## Customising
- Palettes: edit `PALETTES` (`base/light/dark` leaf tones, `qr` module colour, `swatch`).
- Tree shape: tweak counts/radii in `buildTree` (`blobs`, `lumps`, `trunkAt`).
- Only the canvas wanted (own UI): `ui:false`, drive it with `toggle/setColor/setUrl`.
