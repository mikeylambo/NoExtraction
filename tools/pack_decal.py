#!/usr/bin/env python3
"""Pack a decal (Megascans/Fab decal set, or a transparent PNG/sheet) into the game's decal files.

    python3 tools/pack_decal.py --id leak_rust [download_dir_or_files...] [--max 1024] [--size-m 0.5x1]

With no inputs it reads assets/decals/<id>/ (unzip the Fab download there, or drop the PNG there).
Writes public/decals/<id>_color.webp (colour + opacity in alpha), <id>_normal.webp (if the set has a
normal map) and <id>.json (physical size in metres and mean roughness). The id must be listed in
assets/manifest.ts DECAL_TEXTURES; what gets placed where is data/decals.ts.

Opacity comes from an _Opacity/_Alpha/_Mask map, else from the image's own alpha channel. Fully
transparent pixels get the decal's average colour, so mipmaps do not grow dark halos.
Physical size comes from --size-m, else the Megascans json, else 1 x 1 m.
Needs Pillow with WebP (`pip install pillow`).
"""
import argparse, json, os, sys
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pack_surface import ROOT, EXTS, gather, grey, out_size, manifest_ids, physical_size, files_in  # noqa: E402


def fill_transparent(rgb, alpha):
    """RGB with fully transparent pixels set to the mean colour of the visible ones."""
    solid = alpha.point(lambda v: 255 if v > 128 else 0)
    if not solid.getbbox():
        return rgb
    small = rgb.resize((64, 64), Image.BILINEAR)
    m = solid.resize((64, 64), Image.NEAREST)
    px = [c for c, k in zip(small.get_flattened_data() if hasattr(small, 'get_flattened_data') else small.getdata(),
                            m.get_flattened_data() if hasattr(m, 'get_flattened_data') else m.getdata()) if k]
    if not px:
        return rgb
    avg = tuple(sum(c[i] for c in px) // len(px) for i in range(3))
    keep = alpha.point(lambda v: 255 if v >= 4 else 0)
    return Image.composite(rgb, Image.new('RGB', rgb.size, avg), keep)


def mean_grey(im):
    small = grey(im).resize((32, 32), Image.BILINEAR)
    data = small.get_flattened_data() if hasattr(small, 'get_flattened_data') else small.getdata()
    return sum(data) / (32 * 32 * 255)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('inputs', nargs='*', help='download folder(s) or files (default: assets/decals/<id>/)')
    ap.add_argument('--id', required=True, help='decal texture id from assets/manifest.ts DECAL_TEXTURES')
    ap.add_argument('--max', type=int, default=1024, help='longest side in pixels: 256, 512, 1024 or 2048 (default 1024)')
    ap.add_argument('--size-m', help='physical size in metres, WxH (e.g. 0.5x1); overrides the Megascans json')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'decals'))
    ap.add_argument('--quality', type=int, default=90, help='WebP quality (default 90)')
    ap.add_argument('--force', action='store_true', help='allow an id not listed in the manifest')
    a = ap.parse_args()

    ids = manifest_ids('DECAL_TEXTURES')
    if a.id not in ids and not a.force:
        sys.exit(f'unknown decal id {a.id!r}; manifest has: {", ".join(ids)} (or pass --force)')
    if a.max not in (256, 512, 1024, 2048):
        sys.exit('--max must be 256, 512, 1024 or 2048')
    inputs = a.inputs or [os.path.join(ROOT, 'assets', 'decals', a.id)]
    missing = [p for p in inputs if not os.path.exists(p)]
    if missing:
        sys.exit(f'not found: {", ".join(missing)}')

    maps = gather(inputs)
    if 'base' not in maps:
        images = [f for f in files_in(inputs) if os.path.splitext(f)[1].lower() in EXTS]
        if len(images) == 1:
            maps['base'] = images[0]  # a lone PNG (generated sheet/emblem): it is the colour map
        else:
            sys.exit('no base colour map found (looked for _BaseColor/_Albedo/_Diffuse/_Color, or a single image)')
    for r, f in sorted(maps.items()):
        print(f'  {r:10s} {os.path.relpath(f)}')

    with Image.open(maps['base']) as im:
        size = out_size(im.size, a.max)
        own_alpha = im.getchannel('A') if 'A' in im.getbands() else None
        rgb = im.convert('RGB')
    if 'opacity' in maps:
        with Image.open(maps['opacity']) as im:
            alpha = grey(im)
    elif own_alpha is not None:
        alpha = own_alpha
    else:
        sys.exit('no opacity: add the _Opacity map, or use a PNG with transparency')
    alpha = alpha.resize(rgb.size, Image.LANCZOS)
    rgb = fill_transparent(rgb, alpha)
    color = rgb.resize(size, Image.LANCZOS)
    color.putalpha(alpha.resize(size, Image.LANCZOS))

    os.makedirs(a.out, exist_ok=True)
    written = []
    p = os.path.join(a.out, f'{a.id}_color.webp')
    color.save(p, 'WEBP', quality=a.quality, alpha_quality=100, method=6)
    written.append(p)

    nkey = 'normal_dx' if 'normal_dx' in maps else 'normal' if 'normal' in maps else None
    if nkey:
        with Image.open(maps[nkey]) as im:
            n = im.convert('RGB').resize(size, Image.LANCZOS)
        if nkey == 'normal_dx':
            r, g, b = n.split()
            n = Image.merge('RGB', (r, ImageOps.invert(g), b))
        p = os.path.join(a.out, f'{a.id}_normal.webp')
        n.save(p, 'WEBP', quality=a.quality, method=6)
        written.append(p)

    if 'rough' in maps:
        with Image.open(maps['rough']) as im:
            rough = mean_grey(im)
    elif 'gloss' in maps:
        with Image.open(maps['gloss']) as im:
            rough = 1 - mean_grey(im)
    else:
        rough = 0.8
    if a.size_m:
        w, h = (float(v) for v in a.size_m.lower().split('x'))
        src = '--size-m'
    else:
        ps = physical_size(inputs)
        (w, h), src = (ps, 'Megascans json') if ps else ((1.0, 1.0), 'default')
    meta = {'size': [w, h], 'roughness': round(rough, 3), 'source': os.path.basename(os.path.normpath(inputs[0]))}
    p = os.path.join(a.out, f'{a.id}.json')
    with open(p, 'w', encoding='utf8') as fh:
        json.dump(meta, fh)
        fh.write('\n')
    written.append(p)

    for p in written:
        print(f'wrote {os.path.relpath(p, ROOT)}  ({os.path.getsize(p) // 1024} KB)')
    print(f'{a.id}: {w:g} x {h:g} m ({src}), {size[0]}x{size[1]} px, roughness {rough:.2f}')
    if src == 'default':
        print('  note: no size found; pass --size-m WxH (atlas sheets: the size of the whole sheet)')


if __name__ == '__main__':
    main()
