Packed decal textures. Slots: `assets/manifest.ts` (`DECAL_TEXTURES`); placement: `data/decals.ts`.

1. Unzip a Fab/Megascans decal (2K) or drop a transparent PNG into `assets/decals/<id>/` (git-ignored).
2. `python3 tools/pack_decal.py --id <id>` writes `<id>_color.webp` (colour + opacity), `<id>_normal.webp`
   and `<id>.json` (physical size, roughness) here.
3. Boot the game: the console lists `decals: N textures`. `?decals=0` turns them off for comparison.

Sources of the current set: the `source` field of each manifest entry.
