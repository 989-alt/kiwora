"""Tests for anchors.py on synthetic pictures. Run: python -m pytest scripts/test_anchors.py"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import anchors  # noqa: E402


def make_pot() -> Image.Image:
    im = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((60, 100, 340, 379), fill=(220, 110, 40, 255))  # terracotta body
    d.rectangle((110, 110, 290, 170), fill=(80, 45, 30, 255))  # dark brown soil, rows 110..170
    d.ellipse((130, 215, 160, 245), fill=(30, 20, 15, 255))  # eye (below the soil: must not count as soil)
    d.ellipse((240, 215, 270, 245), fill=(30, 20, 15, 255))
    return im


def make_plant() -> Image.Image:
    im = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((190, 120, 209, 399), fill=(90, 150, 60, 255))  # stem down to the last row
    d.ellipse((60, 40, 190, 150), fill=(50, 140, 50, 255))  # leaf
    d.ellipse((210, 60, 360, 170), fill=(50, 140, 50, 255))  # leaf
    d.ellipse((255, 90, 285, 120), fill=(220, 60, 130, 255))  # a pink flower on the right leaf
    return im


def make_bg() -> Image.Image:
    im = Image.new("RGBA", (400, 400), (120, 180, 240, 255))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 300, 400, 400), fill=(200, 140, 70, 255))  # surface from row 300
    return im


def test_pot_anchors():
    a = anchors.measure_pot(make_pot())
    assert (a["w"], a["h"]) == (400, 400)
    assert a["bottom"] == 379
    assert abs(a["soilY"] - 140) <= 2  # middle row of the soil rows 110..170
    assert abs(a["cx"] - 199.5) <= 2
    assert a["bbox"] == [60, 100, 340, 379]


def test_plant_anchors():
    a = anchors.measure_plant(make_plant())
    assert a["stemY"] == 399
    assert abs(a["stemX"] - 199.5) <= 1.5
    assert a["top"] == 40
    assert a["left"] == 60 and a["right"] == 360


def test_plant_leaf_spots_sit_on_green_leaf_pixels():
    im = make_plant()
    a = anchors.measure_plant(im)
    spots = a["spots"]
    assert 2 <= len(spots) <= 12
    for x, y in spots:
        r, g, b, al = im.getpixel((x, y))
        assert al == 255 and g > r and g > b, (x, y)
    # spread out: no two spots closer than 20 px
    for i, p in enumerate(spots):
        for q in spots[i + 1 :]:
            assert (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 >= 20**2


def test_background_surface_is_halfway_down_the_flat_surface():
    a = anchors.measure_bg(make_bg())
    assert (a["w"], a["h"]) == (400, 400)
    assert abs(a["surfaceY"] - 350) <= 3  # surface starts at row 300, spans to the bottom


def test_update_writes_per_file_entries_and_keeps_others(tmp_path):
    public = tmp_path / "public"
    (public / "pots").mkdir(parents=True)
    (public / "plants" / "balsam").mkdir(parents=True)
    make_pot().save(public / "pots" / "happy.webp")
    make_plant().save(public / "plants" / "balsam" / "flower.webp")
    out = public / "anchors.json"
    out.write_text(json.dumps({"defaults": {"x": 1}, "files": {"old/file.webp": {"kind": "bg", "w": 1}}}))

    anchors.update(["public/pots/happy.webp", "public/plants/balsam/flower.webp"], public=public, out=out)
    data = json.loads(out.read_text())
    assert data["defaults"] == {"x": 1}
    assert "old/file.webp" in data["files"]
    assert data["files"]["pots/happy.webp"]["bottom"] == 379
    assert data["files"]["plants/balsam/flower.webp"]["stemY"] == 399
    assert data["files"]["plants/balsam/flower.webp"]["kind"] == "plant"


def test_kind_follows_the_folder():
    assert anchors.kind_of("pots/happy.webp") == "pot"
    assert anchors.kind_of("plants/balsam/flower.webp") == "plant"
    assert anchors.kind_of("bg/window.webp") == "bg"
    assert anchors.kind_of("bugs/aphid.webp") == "bug"


def test_bg_stand_overrides_merge(tmp_path):
    public = tmp_path / "public"
    (public / "bg").mkdir(parents=True)
    make_bg().save(public / "bg" / "shade.webp")
    make_bg().save(public / "bg" / "yardSunny.webp")
    stand = tmp_path / "bg_stand.json"
    stand.write_text(json.dumps({"bg/shade.webp": {"standTop": 310, "standBottom": 380, "x0": 12, "x1": 388}}))
    out = public / "anchors.json"

    anchors.update(["public/bg/shade.webp", "public/bg/yardSunny.webp"], public=public, out=out, stand=stand)
    files = json.loads(out.read_text())["files"]
    shade = files["bg/shade.webp"]
    assert (shade["standTop"], shade["standBottom"], shade["x0"], shade["x1"]) == (310, 380, 12, 388)
    assert shade["surfaceY"] > 0 and shade["kind"] == "bg"  # measured numbers stay
    assert "standTop" not in files["bg/yardSunny.webp"]  # pictures without an entry are untouched


def test_real_stand_file_covers_the_three_rooms():
    stand = json.loads(anchors.STAND.read_text(encoding="utf-8"))
    for rel in ("bg/window.webp", "bg/desk.webp", "bg/shade.webp"):
        s = stand[rel]
        assert 0 < s["standTop"] < s["standBottom"] < 768 and 0 <= s["x0"] < s["x1"] <= 1024


def test_draw_stand_marks_the_two_lines_and_the_x_range(tmp_path):
    public = tmp_path / "public"
    (public / "bg").mkdir(parents=True)
    make_bg().save(public / "bg" / "shade.webp")
    stand = tmp_path / "bg_stand.json"
    stand.write_text(json.dumps({"bg/shade.webp": {"standTop": 310, "standBottom": 380, "x0": 12, "x1": 388}}))

    im = anchors.draw_stand("bg/shade.webp", public=public, stand=stand)
    assert im.size == (400, 400)
    base = make_bg().convert("RGB")
    out = im.convert("RGB")
    assert out.getpixel((200, 310)) != base.getpixel((200, 310))
    assert out.getpixel((200, 380)) != base.getpixel((200, 380))
    assert out.getpixel((12, 340)) != base.getpixel((12, 340))
    assert out.getpixel((388, 340)) != base.getpixel((388, 340))


def test_prop_kind_measures_bbox(tmp_path):
    assert anchors.kind_of("props/moon.webp") == "prop"
    assert anchors.kind_of("weather/rain.webp") == "prop"
    im = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse((100, 150, 400, 460), fill=(240, 220, 120, 255))
    a = anchors.measure_prop(im)
    assert (a["w"], a["h"]) == (512, 512)
    l, t, r, b = a["bbox"]
    assert 98 <= l <= 102 and 148 <= t <= 152 and 398 <= r <= 402 and 458 <= b <= 462
    public = tmp_path / "public"
    (public / "props").mkdir(parents=True)
    im.save(public / "props" / "moon.webp")
    out = tmp_path / "anchors.json"
    anchors.update(["public/props/moon.webp"], public=public, out=out, stand=tmp_path / "none.json")
    f = json.loads(out.read_text())["files"]["props/moon.webp"]
    assert f["kind"] == "prop" and f["bbox"] == a["bbox"]
