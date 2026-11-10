Packed tiling surfaces (scans) for the world materials. Slots, tile sizes and what to search for:
`assets/manifest.ts` (`SURFACES`).

1. Unzip a Fab/Megascans surface (2K) into `assets/surfaces/<id>/` (git-ignored: raw downloads stay local).
2. `python3 tools/pack_surface.py --id <id>` writes `<id>_basecolor.webp`, `<id>_normal.webp` and
   `<id>_orm.webp` here (needs `pip install pillow`).
3. Boot the game: the console lists `surface scans: ...`. Delete the files to go back to procedural.

Check the licence on each listing before committing a scan.
