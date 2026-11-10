#!/usr/bin/env python3
"""Pack a PBR surface download (Megascans/Fab or any tiling set) into the game's surface files.

    python3 tools/pack_surface.py --id concrete [download_dir_or_files...] [--size 1024]

With no inputs it reads assets/surfaces/<id>/ (unzip the Fab/Megascans download there).

Writes public/surfaces/<id>_basecolor.webp, <id>_normal.webp and <id>_orm.webp
(ORM = R ambient occlusion, G roughness, B metalness; slots in assets/manifest.ts SURFACES).
The game picks them up at the next boot (src/render/scans.ts); delete them to go back to procedural.

Inputs are recognised by filename suffix, case-insensitive:
  base colour  _BaseColor _Albedo _Diffuse _Color        (UE-style T_*_D / T_*_B too)
  normal       _Normal _NormalGL (OpenGL)  _NormalDX (DirectX: green is flipped; T_*_N counts as DX)
  AO           _AO _AmbientOcclusion _Occlusion
  roughness    _Roughness   (or _Gloss/_Glossiness, inverted)
  metalness    _Metalness _Metallic _Metal
  packed       _ORM _ARM (copied as is), _ORDp (UE Megascans: R AO, G roughness, metal = 0)
Everything else (displacement, cavity, specular, opacity, ...) is ignored. Missing AO -> 1,
missing metalness -> 0, missing roughness -> 0.8 (with a warning).

Needs Pillow with WebP (`pip install pillow`). The normal and ORM maps are written lossless:
lossy WebP subsamples chroma, which would bleed the packed channels into each other.
"""
import argparse, os, re, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTS = ('.png', '.jpg', '.jpeg', '.tif', '.tiff', '.tga', '.webp', '.bmp')

ROLES = [  # (role, regex on the filename stem's last token(s))
    ('orm', r'(orm|arm)'),
    ('ordp', r'ordp'),
    ('normal_dx', r'(normal[_ -]?dx|nrm[_ -]?dx)'),
    ('normal', r'(normal[_ -]?gl|normal|nrm|nor)'),
    ('base', r'(base[_ -]?colou?r|albedo|diffuse|colou?r|col)'),
    ('ao', r'(ao|ambient[_ -]?occlusion|occlusion)'),
    ('rough', r'(roughness|rough)'),
    ('gloss', r'(glossiness|gloss)'),
    ('metal', r'(metalness|metallic|metal)'),
]
UE_SHORT = {'d': 'base', 'b': 'base', 'n': 'normal_dx'}


def classify(name):
    """Role of an image file from its name, or None to ignore it."""
    stem, ext = os.path.splitext(os.path.basename(name))
    if ext.lower() not in EXTS:
        return None
    low = stem.lower()
    for role, pat in ROLES:
        if re.search(r'(^|[_ .-])' + pat + r'$', low):
            return role
    m = re.match(r'^t_.*_([a-z])$', low)  # Unreal-style texture names: T_Name_D, T_Name_N
    if m and m.group(1) in UE_SHORT:
        return UE_SHORT[m.group(1)]
    return None


def surface_ids():
    src = open(os.path.join(ROOT, 'assets', 'manifest.ts'), encoding='utf8').read()
    block = src.split('export const SURFACES', 1)[1].split('];', 1)[0]
    return re.findall(r"id:\s*'(\w+)'", block)


def gather(inputs):
    files = []
    for p in inputs:
        if os.path.isdir(p):
            for d, _, fs in os.walk(p):
                files += [os.path.join(d, f) for f in fs]
        else:
            files.append(p)
    found = {}
    for f in files:
        role = classify(f)
        if not role:
            continue
        # several resolutions in one folder: keep the largest
        with Image.open(f) as im:
            px = im.size[0] * im.size[1]
        if role not in found or px > found[role][1]:
            found[role] = (f, px)
    return {r: f for r, (f, _) in found.items()}


def grey(im):
    """One 8-bit channel from any greyscale-ish image (16-bit PNGs included)."""
    if im.mode in ('I;16', 'I;16B', 'I;16L', 'I'):
        return im.convert('I').point(lambda v: v * (1 / 257)).convert('L')
    if im.mode == 'L':
        return im
    return im.convert('RGB').getchannel(0)


def out_size(src_size, size):
    w, h = src_size
    if w == h:
        return size, size
    # keep aspect, round the short side to a power of two
    short = size * min(w, h) / max(w, h)
    p = 1 << max(0, round(short).bit_length() - 1)
    if short / p > 1.5:
        p *= 2
    return (size, p) if w > h else (p, size)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('inputs', nargs='*', help='download folder(s) or map files (default: assets/surfaces/<id>/)')
    ap.add_argument('--id', required=True, help='surface id from assets/manifest.ts SURFACES')
    ap.add_argument('--size', type=int, default=1024, help='output size, power of two, max 2048 (default 1024)')
    ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'surfaces'))
    ap.add_argument('--quality', type=int, default=90, help='base colour WebP quality (default 90)')
    flip = ap.add_mutually_exclusive_group()
    flip.add_argument('--flip-green', action='store_true', help='force DirectX -> OpenGL normal conversion')
    flip.add_argument('--no-flip-green', action='store_true', help='never flip the normal green channel')
    ap.add_argument('--force', action='store_true', help='allow an id not listed in the manifest')
    a = ap.parse_args()

    ids = surface_ids()
    if a.id not in ids and not a.force:
        sys.exit(f'unknown surface id {a.id!r}; manifest has: {", ".join(ids)} (or pass --force)')
    if a.size not in (256, 512, 1024, 2048):
        sys.exit('--size must be 256, 512, 1024 or 2048 (ASSET_SPEC: never larger than 2048)')

    inputs = a.inputs or [os.path.join(ROOT, 'assets', 'surfaces', a.id)]
    missing = [p for p in inputs if not os.path.exists(p)]
    if missing:
        sys.exit(f'not found: {", ".join(missing)}')
    maps = gather(inputs)
    if 'base' not in maps:
        sys.exit('no base colour map found (looked for _BaseColor/_Albedo/_Diffuse/_Color)')
    for r, f in sorted(maps.items()):
        print(f'  {r:10s} {os.path.relpath(f)}')

    with Image.open(maps['base']) as im:
        size = out_size(im.size, a.size)
        base = im.convert('RGB').resize(size, Image.LANCZOS)
    os.makedirs(a.out, exist_ok=True)
    written = []

    def save(img, suffix, lossless):
        p = os.path.join(a.out, f'{a.id}_{suffix}.webp')
        if lossless:
            img.save(p, 'WEBP', lossless=True, quality=100, method=6)
        else:
            img.save(p, 'WEBP', quality=a.quality, method=6)
        written.append(p)

    save(base, 'basecolor', False)

    # normal
    nkey = 'normal_dx' if 'normal_dx' in maps else 'normal' if 'normal' in maps else None
    if nkey:
        with Image.open(maps[nkey]) as im:
            n = im.convert('RGB').resize(size, Image.LANCZOS)
        do_flip = a.flip_green or (nkey == 'normal_dx' and not a.no_flip_green)
        if do_flip:
            r, g, b = n.split()
            n = Image.merge('RGB', (r, ImageOps.invert(g), b))
        save(n, 'normal', True)
        print(f'  normal: {"flipped green (DirectX -> OpenGL)" if do_flip else "kept as OpenGL"}'
              f'{"" if do_flip else "  - if bumps look inverted in-game, rerun with --flip-green"}')
    else:
        print('  note: no normal map; the surface will be flat-shaded')

    # ORM
    def load_grey(role):
        with Image.open(maps[role]) as im:
            return grey(im).resize(size, Image.LANCZOS)

    if 'orm' in maps:
        with Image.open(maps['orm']) as im:
            orm = im.convert('RGB').resize(size, Image.LANCZOS)
    else:
        if 'ordp' in maps:
            with Image.open(maps['ordp']) as im:
                rgb = im.convert('RGB').resize(size, Image.LANCZOS)
            ao, rough = rgb.getchannel(0), rgb.getchannel(1)
        else:
            ao = load_grey('ao') if 'ao' in maps else Image.new('L', size, 255)
            if 'rough' in maps:
                rough = load_grey('rough')
            elif 'gloss' in maps:
                rough = ImageOps.invert(load_grey('gloss'))
            else:
                rough = Image.new('L', size, round(0.8 * 255))
                print('  warning: no roughness or gloss map; using constant 0.8')
        metal = load_grey('metal') if 'metal' in maps else Image.new('L', size, 0)
        orm = Image.merge('RGB', (ao, rough, metal))
    save(orm, 'orm', True)

    for p in written:
        print(f'wrote {os.path.relpath(p, ROOT)}  ({os.path.getsize(p) // 1024} KB, {size[0]}x{size[1]})')
    print(f'Check `tile` for {a.id!r} in assets/manifest.ts SURFACES matches the scan\'s real-world size (metres).')


if __name__ == '__main__':
    main()
