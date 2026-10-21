"""Measures the anchor numbers the scene layering needs, per picture, into public/anchors.json.

    python scripts/anchors.py                      measure every picture under public/{pots,plants,bg,bugs}
    python scripts/anchors.py public/pots/happy.webp ...

anchors.json: { "defaults": {...stand-in numbers...}, "files": { "pots/happy.webp": {...}, ... } }

Per kind (all numbers are px of the picture file itself):
  pot    soilY   middle row of the dark-brown soil rows (upper half of the pot only)
         cx      centre x of the soil
         bottom  lowest opaque row;  bbox [left, top, right, bottom] of the opaque pixels
  plant  stemY   lowest opaque row;  stemX centre x of the lowest opaque rows
         top/left/right  opaque bounding box;  spots  up to 12 points well inside green leaf pixels (bug places)
  bg     surfaceY  estimated: the topmost strong horizontal colour edge in the lower half is the far edge of the
                   placing surface; things stand halfway between that edge and the bottom of the picture.
  bug    bbox only
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
OUT = PUBLIC / "anchors.json"
ALPHA_MIN = 128
KINDS = {"pots": "pot", "plants": "plant", "bg": "bg", "bugs": "bug"}


def kind_of(rel: str) -> str:
    return KINDS[rel.split("/", 1)[0]]


def _alpha(im: Image.Image) -> np.ndarray:
    return np.asarray(im.convert("RGBA"))[:, :, 3]


def _bbox(mask: np.ndarray) -> list[int]:
    ys, xs = np.where(mask)
    return [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]


def measure_pot(im: Image.Image) -> dict:
    rgba = np.asarray(im.convert("RGBA")).astype(int)
    opaque = rgba[:, :, 3] >= ALPHA_MIN
    left, top, right, bottom = _bbox(opaque)
    r, g, b = rgba[:, :, 0], rgba[:, :, 1], rgba[:, :, 2]
    # dark brown: darker than the clay, red >= green >= blue, still reddish (not black)
    soil = opaque & (r < 150) & (r >= g) & (g >= b) & (r - b > 12) & (r > 40)
    soil[top + (bottom - top) // 2 + 1 :, :] = False  # the face (eyes) lives in the lower half
    counts = soil.sum(axis=1)
    rows = np.where(counts >= 0.15 * (right - left + 1))[0]
    if len(rows) == 0:
        raise ValueError("no soil found in the pot picture")
    # the soil is the first block of rows from the top; later dark rows (eyes, brows) are not soil
    end = 0
    while end + 1 < len(rows) and rows[end + 1] - rows[end] <= 3:
        end += 1
    rows = rows[: end + 1]
    xs = np.where(soil[rows[0] : rows[-1] + 1].any(axis=0))[0]
    return {
        "w": im.width,
        "h": im.height,
        "soilY": int(round((rows[0] + rows[-1]) / 2)),
        "cx": round(float((xs.min() + xs.max()) / 2), 1),
        "bottom": bottom,
        "bbox": [left, top, right, bottom],
    }


def _leaf_spots(rgba: np.ndarray, limit: int = 12, min_gap: int = 70) -> list[list[int]]:
    """Points well inside green leaf pixels, spread out (farthest-point order), as bug places."""
    h, w = rgba.shape[:2]
    r, g, b, a = (rgba[:, :, i].astype(int) for i in range(4))
    leaf = (a >= 255 - 1) & (g > r) & (g > b)
    if leaf.sum() < 200:
        leaf = a >= 255 - 1
    for radius in (14, 10, 6, 3, 1):
        mask = Image.fromarray((leaf * 255).astype(np.uint8))
        core = np.asarray(mask.filter(ImageFilter.MinFilter(2 * radius + 1))) > 0
        ys, xs = np.where(core[::4, ::4])
        if len(xs) >= 3:
            break
    else:
        return []
    pts = np.stack([xs * 4, ys * 4], axis=1)
    # start near the middle of the leaf mass, then take the point farthest from those already chosen
    cx, cy = pts.mean(axis=0)
    first = int(np.argmin(((pts - [cx, cy]) ** 2).sum(axis=1)))
    chosen = [pts[first]]
    dist = ((pts - pts[first]) ** 2).sum(axis=1)
    gap2 = min_gap**2
    while len(chosen) < limit:
        i = int(np.argmax(dist))
        if dist[i] < gap2 and len(chosen) >= 3:
            break
        if dist[i] == 0:
            break
        chosen.append(pts[i])
        dist = np.minimum(dist, ((pts - pts[i]) ** 2).sum(axis=1))
    return [[int(x), int(y)] for x, y in chosen]


def measure_plant(im: Image.Image) -> dict:
    rgba = np.asarray(im.convert("RGBA"))
    opaque = rgba[:, :, 3] >= ALPHA_MIN
    left, top, right, bottom = _bbox(opaque)
    band = max(5, im.height // 200)
    ys, xs = np.where(opaque[max(top, bottom - band) : bottom + 1])
    return {
        "w": im.width,
        "h": im.height,
        "stemX": round(float((xs.min() + xs.max()) / 2), 1),
        "stemY": bottom,
        "top": top,
        "left": left,
        "right": right,
        "spots": _leaf_spots(rgba),
    }


def measure_bg(im: Image.Image) -> dict:
    rgb = np.asarray(im.convert("RGB")).astype(float)
    h = rgb.shape[0]
    rows = rgb[:, ::4, :].mean(axis=1)  # mean colour per row
    step = np.sqrt(((rows[2:] - rows[:-2]) ** 2).sum(axis=1))  # colour change across a row
    step = np.convolve(step, np.ones(5) / 5, mode="same")
    lo, hi = int(h * 0.5), int(h * 0.85)
    # the topmost strong edge (>= 55% of the strongest): the far edge of the placing surface, not shadow stripes on it
    strong = np.where(step[lo:hi] >= 0.55 * step[lo:hi].max())[0]
    edge = lo + int(strong[0]) + 1
    return {"w": im.width, "h": h, "surfaceY": int(round(edge + (h - edge) / 2)), "edgeY": edge}


def measure_bug(im: Image.Image) -> dict:
    left, top, right, bottom = _bbox(_alpha(im) >= ALPHA_MIN)
    return {"w": im.width, "h": im.height, "bbox": [left, top, right, bottom]}


MEASURE = {"pot": measure_pot, "plant": measure_plant, "bg": measure_bg, "bug": measure_bug}


def update(paths: list[str], public: Path = PUBLIC, out: Path = OUT) -> dict:
    """Measure the given pictures (repo-relative 'public/...' paths) and merge them into anchors.json."""
    data = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {}
    data.setdefault("defaults", {})
    files = data.setdefault("files", {})
    for p in paths:
        rel = Path(p).as_posix()
        rel = rel[len("public/") :] if rel.startswith("public/") else rel
        kind = kind_of(rel)
        with Image.open(public / rel) as im:
            files[rel] = {"kind": kind, **MEASURE[kind](im)}
    data["files"] = dict(sorted(files.items()))
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return data


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args:
        args = [
            f"public/{p.relative_to(PUBLIC).as_posix()}"
            for folder in KINDS
            for p in sorted((PUBLIC / folder).rglob("*.webp"))
        ]
    update(args)
    print(f"anchors for {len(args)} pictures -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
