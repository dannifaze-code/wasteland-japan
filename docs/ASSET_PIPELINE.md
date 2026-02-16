# Asset Pipeline

## Overview

This document describes the asset folder layout and workflow for adding new
textures, models, audio, and map data to *Wasteland Japan*.

## Folder Structure

```
/assets
  /_source_zips          – Original uploaded archives (never delete)
  /_licenses             – Per-pack LICENSE / credits notes
  /maps
    /heightmaps          – Terrain heightmap images
    /minimaps            – Minimap overlay images
    /poi                 – Point-of-interest JSON data
  /models
    /environment
      /buildings
      /roads_signs
      /props
      /interiors
    /weapons
      /melee
      /firearms
      /attachments
    /characters
      /npcs
      /companions
  /textures
    /environment
      /buildings
      /roads_signs
      /props
      /terrain
    /weapons
      /melee
      /firearms
      /attachments
    /ui
  /audio
    /music
    /sfx
```

## Adding New Assets

1. Place the original archive in `assets/_source_zips/`.
2. Extract usable files into the matching category folder above.
3. Add a license/credits note to `assets/_licenses/`.
4. Update `docs/ASSET_CREDITS.md` with attribution details.
5. If the asset needs to be referenced at runtime, register it in
   `src/assets.js` inside the `AssetManifest` object.

## Runtime Usage

Assets are served as static files from a local HTTP server.
No build step is required — the game loads assets via relative paths
(e.g. `./assets/maps/heightmaps/my_heightmap.png`).

The helper module `src/assets.js` provides:

- `ASSET_BASE` — base path constant (`"./assets"`)
- `assetPath(rel)` — returns `${ASSET_BASE}/${rel}`
- `AssetManifest` — a manifest object for future cataloguing
