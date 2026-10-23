"""Tests for lens_frame.py on a synthetic magnifier. Run: python -m pytest scripts/test_lens_frame.py"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lens_frame  # noqa: E402


def make_magnifier() -> Image.Image:
    """Orange rim round a blue glass (centre 300,260, glass radius 120) with a brown handle straight down."""
    im = Image.new("RGBA", (600, 700), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((270, 380, 330, 640), radius=28, fill=(150, 85, 45, 255))  # handle
    d.ellipse((300 - 160, 260 - 160, 300 + 160, 260 + 160), fill=(240, 140, 50, 255))  # rim
    d.ellipse((300 - 120, 260 - 120, 300 + 120, 260 + 120), fill=(140, 190, 235, 255))  # glass
    d.ellipse((220, 190, 260, 215), fill=(250, 252, 255, 255))  # a white shine on the glass
    return im


def test_find_glass_and_handle():
    im = make_magnifier()
    cx, cy, r = lens_frame.find_glass(im)
    assert abs(cx - 300) <= 2 and abs(cy - 260) <= 2 and abs(r - 120) <= 2
    assert abs(lens_frame.handle_angle(im, (cx, cy))) < 3  # straight down


def test_frame_has_a_see_through_lens_and_the_handle_down_right():
    frame, lens = lens_frame.make_frame(make_magnifier(), size=400)
    assert max(frame.size) == 400
    assert (lens["w"], lens["h"]) == frame.size
    a = np.asarray(frame)
    cx, cy, r = lens["cx"], lens["cy"], lens["r"]
    # the middle of the lens is clear; just outside the hole is the opaque rim
    assert a[round(cy), round(cx), 3] == 0
    for ang in range(0, 360, 30):
        x = cx + (r + 0.12 * r) * math.cos(math.radians(ang))
        y = cy + (r + 0.12 * r) * math.sin(math.radians(ang))
        assert a[round(y), round(x), 3] > 200, ang
    # the hole is the glass (not the whole picture): a good part of the frame, smaller than half of it
    assert 0.18 < r / max(frame.size) < 0.32
    # the brown handle lies down and to the right of the lens, about HANDLE_DEG from straight down
    ang = lens_frame.handle_angle(frame, (cx, cy))
    assert abs(ang - lens_frame.HANDLE_DEG) < 4
    # a white shine stays on the glass (top left), half see-through
    shine = a[round(cy - 0.55 * r), round(cx - 0.55 * r)]
    assert shine[3] > 30 and shine[:3].min() > 200


def test_main_writes_the_frame_and_its_lens_numbers(tmp_path, monkeypatch):
    src = tmp_path / "raw.png"
    make_magnifier().save(src)
    monkeypatch.setattr(lens_frame, "SRC", src)
    monkeypatch.setattr(lens_frame, "OUT", tmp_path / "props" / "magnifier-lens.webp")
    monkeypatch.setattr(lens_frame, "JSON_OUT", tmp_path / "lens.json")
    assert lens_frame.main([]) == 0
    lens = json.loads((tmp_path / "lens.json").read_text(encoding="utf-8"))
    with Image.open(tmp_path / "props" / "magnifier-lens.webp") as im:
        assert im.size == (lens["w"], lens["h"])
        assert np.asarray(im)[round(lens["cy"]), round(lens["cx"]), 3] == 0
        hx, hy, hr = lens_frame.measure_hole(im)
    # (the shine and the inner shadow take a little of the clear area, so the hole measured now is a bit smaller)
    assert abs(hx - lens["cx"]) < 4 and abs(hy - lens["cy"]) < 4 and 0.88 * lens["r"] < hr <= lens["r"] + 1
