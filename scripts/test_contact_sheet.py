"""Tests for contact_sheet.py. Run: python -m pytest scripts/test_contact_sheet.py"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import contact_sheet as cs  # noqa: E402


def dummy(tmp_path: Path, name: str, w: int, h: int, color=(20, 160, 60, 255)) -> Path:
    p = tmp_path / name
    Image.new("RGBA", (w, h), color).save(p)
    return p


def test_sheet_is_at_least_as_wide_as_the_pictures_side_by_side(tmp_path):
    paths = [dummy(tmp_path, f"{i}.png", 120, 160) for i in range(3)]
    out = tmp_path / "sheet.png"
    cs.build_sheet([(p, f"단계{i}") for i, p in enumerate(paths)], out)
    with Image.open(out) as im:
        assert im.width >= 3 * 120
        assert im.height > 160  # room for the label under the pictures


def test_large_pictures_are_shrunk_to_a_readable_sheet(tmp_path):
    paths = [dummy(tmp_path, f"{i}.png", 1024, 1366) for i in range(6)]
    out = tmp_path / "sheet.png"
    cs.build_sheet([(p, f"단계{i}") for i, p in enumerate(paths)], out)
    with Image.open(out) as im:
        assert im.width < 6 * 1024
        assert im.height < 1366


def test_labels_are_drawn_not_generated(tmp_path):
    p = dummy(tmp_path, "a.png", 100, 100, (255, 255, 255, 0))
    plain = tmp_path / "plain.png"
    labelled = tmp_path / "labelled.png"
    cs.build_sheet([(p, "")], plain)
    cs.build_sheet([(p, "싹이 텄어요")], labelled)
    with Image.open(plain) as a, Image.open(labelled) as b:
        assert a.tobytes() != b.tobytes()


def test_stage_names_are_korean_and_cover_every_stage():
    for stage in ["seed", "sprout", "leafStem", "grownTree", "flower", "fruit", "winter", "newShoot", "seedDone"]:
        assert cs.STAGE_NAME[stage]


def test_props_sheet_lists_every_props_row():
    import json

    rows = [r for r in json.loads(cs.MANIFEST.read_text(encoding="utf-8")) if r["species"] == "props"]
    assert len(rows) == 17
    items = cs.species_items("props")
    assert [p for p, _ in items] == [cs.ROOT / r["path"] for r in rows]
    for p, label in items:
        assert label and label != p.stem  # every picture has a Korean label
