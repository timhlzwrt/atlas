# Globe textures

Equirectangular Earth imagery used by the globe surface switcher
(`src/components/Globe/globeTheme.ts`).

| File | Surface | Origin |
|---|---|---|
| `earth-blue-marble.jpg` | Satellite | NASA Visible Earth — Blue Marble |
| `earth-night.jpg` | Night lights | NASA Visible Earth — Earth at Night |
| `earth-topology.png` | Terrain (also the bump map for Satellite) | NASA elevation-derived height map |

All three are NASA imagery in the public domain, vendored here from the
[`three-globe`](https://github.com/vasturiano/three-globe) example assets. They are served from this origin
rather than a CDN because the site's Content-Security-Policy is `img-src 'self' data:`.

Downscaled from the original 4096×2048 (bump map 2048×1024) to 2048×1024 (bump map 1024×512): at the
on-screen size the globe actually renders at, the extra resolution was invisible but quadrupled GPU texture
memory and decode cost, which mattered most on lower-end/mobile GPUs.
