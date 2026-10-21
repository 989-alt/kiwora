"""Contact sheets for the teacher's picture review.

    python scripts/contact_sheet.py --species balsam   ->  assets/review/balsam.png
    python scripts/contact_sheet.py --species shared   ->  assets/review/shared.png

A species sheet lays its stage pictures out in a row, in stage order, with the Korean stage name under
each one. The shared sheet shows the pots, the backgrounds and the bugs. Labels are drawn here with PIL,
never generated (the image model garbles Hangul).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "assets" / "manifest.json"
REVIEW = ROOT / "assets" / "review"

STAGE_NAME = {
    "seed": "씨",
    "sprout": "싹이 텄어요",
    "leafStem": "잎과 줄기가 자라요",
    "grownTree": "적당한 크기로 자라요",
    "flower": "꽃이 피어요",
    "fruit": "열매를 맺어요",
    "winter": "겨울을 지내요",
    "newShoot": "새순이 나와요",
    "seedDone": "씨를 얻었어요",
}
SHARED_NAME = {
    "happy": "화분 신남",
    "normal": "화분 보통",
    "worried": "화분 걱정",
    "sick": "화분 아픔",
    "window": "배경 창가",
    "desk": "배경 책상",
    "shade": "배경 그늘",
    "yardSunny": "배경 땅(해)",
    "yardPartial": "배경 땅(반그늘)",
    "yardShade": "배경 땅(그늘)",
    "aphid": "벌레 진딧물",
    "caterpillar": "벌레 애벌레",
}

PAD = 16
BG = (240, 236, 224, 255)
CELL_BORDER = (205, 198, 180, 255)
INK = (30, 41, 59, 255)
FONT_PATHS = [
    r"C:\Windows\Fonts\malgunbd.ttf",
    r"C:\Windows\Fonts\malgun.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
]

Item = tuple[Path, str]


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for p in FONT_PATHS:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def _fit(path: Path, cell_h: int) -> Image.Image:
    with Image.open(path) as src:
        im = src.convert("RGBA")
    scale = min(1.0, cell_h / im.height)
    if scale < 1.0:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    return im


def build_rows(rows: list[tuple[list[Item], int]], out: Path) -> Path:
    """rows: [(items, cell_h)]. Each item is (picture path, label). Pictures sit on a common baseline."""
    label_font = _font(30)
    label_h = 56
    laid: list[tuple[list[tuple[Image.Image, str]], int]] = []
    width = 0
    height = PAD
    for items, cell_h in rows:
        pics = [(_fit(p, cell_h), label) for p, label in items]
        width = max(width, sum(im.width + 2 * PAD for im, _ in pics))
        laid.append((pics, cell_h))
        height += max(im.height for im, _ in pics) + label_h + 2 * PAD
    sheet = Image.new("RGBA", (max(width, 1), max(height, 1)), BG)
    draw = ImageDraw.Draw(sheet)
    y = PAD
    for pics, _ in laid:
        row_h = max(im.height for im, _ in pics)
        x = 0
        for im, label in pics:
            cell_w = im.width + 2 * PAD
            draw.rectangle((x + 4, y - 4, x + cell_w - 4, y + row_h + label_h + PAD - 4), outline=CELL_BORDER, width=2)
            sheet.alpha_composite(im, (x + PAD, y + row_h - im.height))
            if label:
                box = draw.textbbox((0, 0), label, font=label_font)
                tw = box[2] - box[0]
                draw.text((x + (cell_w - tw) / 2 - box[0], y + row_h + 10), label, font=label_font, fill=INK)
            x += cell_w
        y += row_h + label_h + 2 * PAD
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(out)
    return out


def build_sheet(items: list[Item], out: Path, cell_h: int = 560) -> Path:
    """One row of pictures with labels under them."""
    return build_rows([(items, cell_h)], out)


def _manifest() -> list[dict]:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def species_items(species: str, rows: list[dict] | None = None) -> list[Item]:
    items: list[Item] = []
    for r in rows if rows is not None else _manifest():
        if r["species"] != species:
            continue
        stage = Path(r["path"]).stem
        items.append((ROOT / r["path"], STAGE_NAME.get(stage, stage)))
    return items


def make_species_sheet(species: str) -> Path:
    items = [(p, label) for p, label in species_items(species) if p.exists()]
    if not items:
        raise SystemExit(f"no generated pictures for {species}")
    return build_sheet(items, REVIEW / f"{species}.png")


def make_shared_sheet() -> Path:
    groups: dict[str, list[Item]] = {"pots": [], "bg": [], "bugs": []}
    for r in _manifest():
        if r["species"] != "shared":
            continue
        p = ROOT / r["path"]
        group = p.parent.name
        if p.exists() and group in groups:
            groups[group].append((p, SHARED_NAME.get(p.stem, p.stem)))
    rows = [(groups["pots"], 360), (groups["bg"], 300), (groups["bugs"], 300)]
    rows = [(items, h) for items, h in rows if items]
    if not rows:
        raise SystemExit("no generated shared pictures")
    return build_rows(rows, REVIEW / "shared.png")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--species", required=True, help="a species id, or 'shared'")
    args = ap.parse_args(argv)
    out = make_shared_sheet() if args.species == "shared" else make_species_sheet(args.species)
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
