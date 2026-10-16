"""Convert rendered PNGs to WebP for src/assets/renders. Usage: python3 scripts/to-webp.py <png-dir> src/assets/renders"""
import pathlib, sys
from PIL import Image

src, dst = map(pathlib.Path, sys.argv[1:3])
dst.mkdir(parents=True, exist_ok=True)
for png in sorted(src.glob('*.png')):
    out = dst / (png.stem + '.webp')
    Image.open(png).convert('RGB').save(out, 'WEBP', quality=84, method=6)
    print(out, out.stat().st_size // 1024, 'KB')
