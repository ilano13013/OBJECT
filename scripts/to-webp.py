"""Convert rendered PNGs to WebP for src/assets/renders. Usage: python3 scripts/to-webp.py <png-dir> src/assets/renders"""
import pathlib, sys
import numpy as np
from PIL import Image

src, dst = map(pathlib.Path, sys.argv[1:3])
dst.mkdir(parents=True, exist_ok=True)
def difference_matte(black, white):
    """Recovers colour + alpha from the same render on black and on white."""
    b = np.asarray(Image.open(black).convert('RGB')).astype(np.float32)
    w = np.asarray(Image.open(white).convert('RGB')).astype(np.float32)
    a = np.clip(1 - (w - b).max(axis=2) / 255.0, 0, 1)
    rgb = np.clip(b / np.maximum(a[..., None], 1e-3), 0, 255) * (a[..., None] > 1e-3)
    # Shape the translucent glow into a soft halo around the product (a light
    # beam behind it would otherwise end in straight edges); the opaque
    # product itself is left untouched.
    h, wd = a.shape
    yy, xx = np.mgrid[0:h, 0:wd]
    ys, xs = np.nonzero(a > 0.92)
    cx, cy = xs.mean(), ys.mean()
    sx, sy = (xs.max() - xs.min()) * 0.36, (ys.max() - ys.min()) * 0.56
    halo = np.exp(-(((xx - cx) / sx) ** 2 + ((yy - cy) / sy) ** 2) ** 1.4)
    edge = np.minimum.reduce([yy / h, (h - 1 - yy) / h, xx / wd, (wd - 1 - xx) / wd])
    halo = halo * np.clip(edge / 0.12, 0, 1) ** 2
    glow = np.clip((0.92 - a) / 0.3, 0, 1)
    a = a * (1 - glow * (1 - halo))
    return Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), 'RGBA')

for png in sorted(src.glob('*.png')):
    if png.stem.endswith('.white'):
        continue
    if png.stem.endswith('.black'):
        name = png.stem[: -len('.black')]
        img = difference_matte(png, png.with_name(name + '.white.png'))
    else:
        name = png.stem
        img = Image.open(png)
    out = dst / (name + '.webp')
    if name.endswith('-cutout'):
        # Transparent cut-out: keep alpha, crop to the object with a small margin.
        img = img.convert('RGBA')
        l, t, r, b = img.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        m = int(max(r - l, b - t) * 0.04)
        img = img.crop((max(l - m, 0), max(t - m, 0), min(r + m, img.width), min(b + m, img.height)))
        img.save(out, 'WEBP', quality=86, method=6, exact=False)
    else:
        img.convert('RGB').save(out, 'WEBP', quality=84, method=6)
    print(out, out.stat().st_size // 1024, 'KB')
