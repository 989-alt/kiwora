"""Makes the magnifier frame the observe scene draws over the enlarged plant picture.

    python scripts/lens_frame.py

Reads the clay magnifier prop (assets/raw/public__props__magnifier.png: orange rim, brown handle, blue glass),
makes the blue glass disc transparent (a soft white shine arc and a thin inner shadow ring stay, so it still
reads as glass), turns it so the handle points down and to the right, and writes

  public/props/magnifier-lens.webp   the frame (longest side SIZE px)
  public/lens.json                   {w, h, cx, cy, r}: the see-through lens circle in px of that picture

The app (src/ui/observe/Magnifier.tsx) clips the enlarged plant picture to that circle and lays the frame on top.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "raw" / "public__props__magnifier.png"
OUT = ROOT / "public" / "props" / "magnifier-lens.webp"
JSON_OUT = ROOT / "public" / "lens.json"
SIZE = 768
# The handle points this many degrees to the right of straight down.
HANDLE_DEG = 40.0


def _rgba(im: Image.Image) -> np.ndarray:
    return np.asarray(im.convert("RGBA")).astype(int)


def find_glass(im: Image.Image) -> tuple[float, float, float]:
    """Centre and radius (px) of the blue glass disc: the box of the clearly blue opaque pixels."""
    a = _rgba(im)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    blue = (al >= 128) & (b > r + 40) & (b > g + 10)
    ys, xs = np.where(blue)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    return (x0 + x1) / 2, (y0 + y1) / 2, ((x1 - x0) + (y1 - y0)) / 4


def handle_angle(im: Image.Image, c: tuple[float, float]) -> float:
    """Direction of the handle from the lens centre, in degrees to the right of straight down."""
    a = _rgba(im)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    # brown wood: red over green over blue, darker than the orange rim
    brown = (al >= 128) & (r > g + 25) & (g > b + 10) & (r < 215) & (g < 150)
    ys, xs = np.where(brown)
    dx, dy = xs.mean() - c[0], ys.mean() - c[1]
    return math.degrees(math.atan2(dx, dy))


def _hollow(im: Image.Image, cx: float, cy: float, r: float) -> Image.Image:
    """The glass made see-through: alpha 0 inside the rim (soft 2 px edge, a hair into the rim so no blue
    fringe is left)."""
    rgba = np.asarray(im.convert("RGBA")).copy()
    h, w = rgba.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot(xx - cx, yy - cy)
    keep = np.clip((d - (r + 3)) / 2.0, 0.0, 1.0)
    rgba[..., 3] = (rgba[..., 3] * keep).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def _glass(frame: Image.Image, cx: float, cy: float, r: float) -> Image.Image:
    """What keeps the hole reading as glass: a thin dark ring just inside the rim (fading inwards) and a
    short soft white shine arc at the top left. Both stay inside the hole."""
    edge = r + 2
    shadow = Image.new("RGBA", frame.size, (60, 30, 10, 0))  # blur fades alpha only, not to black
    sw = max(3, round(0.06 * r))
    ImageDraw.Draw(shadow).ellipse((cx - edge, cy - edge, cx + edge, cy + edge), outline=(60, 30, 10, 110), width=sw)
    shadow = shadow.filter(ImageFilter.GaussianBlur(sw / 2))
    shine = Image.new("RGBA", frame.size, (255, 255, 255, 0))
    rs = 0.78 * r
    ImageDraw.Draw(shine).arc((cx - rs, cy - rs, cx + rs, cy + rs), start=200, end=250, fill=(255, 255, 255, 170), width=max(4, round(0.09 * r)))
    shine = shine.filter(ImageFilter.GaussianBlur(max(1.5, 0.02 * r)))
    h, w = frame.height, frame.width
    yy, xx = np.mgrid[0:h, 0:w]
    inside = np.clip(edge + 1 - np.hypot(xx - cx, yy - cy), 0, 1)
    out = frame
    for layer in (shadow, shine):
        la = np.asarray(layer).copy()
        la[..., 3] = (la[..., 3] * inside).astype(np.uint8)
        out = Image.alpha_composite(out, Image.fromarray(la, "RGBA"))
    return out


def measure_hole(im: Image.Image) -> tuple[float, float, float]:
    """Centre and radius of the see-through lens: the nearly transparent pixels not connected to the border
    (flood fill from the edges), centre = their centroid, radius from their area."""
    al = np.asarray(im.convert("RGBA"))[..., 3]
    clear = al < 40
    # a 1 px clear border all round, so the outside is one region the flood fill reaches from the corner
    mask = Image.fromarray(np.pad(clear, 1, constant_values=True).astype(np.uint8) * 255, "L").copy()
    ImageDraw.floodfill(mask, (0, 0), 128)
    hole = (np.asarray(mask) == 255)[1:-1, 1:-1]
    ys, xs = np.where(hole)
    return float(xs.mean()), float(ys.mean()), float(math.sqrt(hole.sum() / math.pi))


def make_frame(im: Image.Image, size: int = SIZE, handle_deg: float = HANDLE_DEG) -> tuple[Image.Image, dict]:
    cx, cy, r = find_glass(im)
    hollow = _hollow(im, cx, cy, r)
    now = handle_angle(im, (cx, cy))
    # PIL turns counter-clockwise for a positive angle: that swings a downward handle to the right.
    turned = hollow.rotate(handle_deg - now, resample=Image.BICUBIC, expand=True)
    box = turned.getbbox()
    pad = 6
    turned = turned.crop((box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad))
    k = size / max(turned.size)
    frame = turned.resize((round(turned.width * k), round(turned.height * k)), Image.LANCZOS)
    hx, hy, hr = measure_hole(frame)
    frame = _glass(frame, hx, hy, hr)
    lens = {"w": frame.width, "h": frame.height, "cx": round(hx, 1), "cy": round(hy, 1), "r": round(hr, 1)}
    return frame, lens


def main(argv: list[str] | None = None) -> int:
    with Image.open(SRC) as src:
        frame, lens = make_frame(src)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    frame.save(OUT, "WEBP", quality=88, method=6)
    JSON_OUT.write_text(json.dumps(lens) + "\n", encoding="utf-8")
    print(f"lens frame -> {OUT} {lens}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
