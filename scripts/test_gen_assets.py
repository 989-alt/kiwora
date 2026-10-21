"""Tests for gen_assets.py. Run: python -I -m pytest scripts/test_gen_assets.py"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_assets as ga  # noqa: E402

ROW = {"path": "public/plants/x/flower.webp", "prompt": "p", "aspect": "3:4", "transparent": True, "species": "x"}


def test_a_failed_generation_is_failed_even_if_an_old_png_is_lying_around(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(ga, "RAW", tmp_path)
    stale = tmp_path / ga.raw_name(ROW["path"])
    stale.write_bytes(b"old")

    def fake_run(*a, **k):  # the generator makes no file and says FAILED on stderr
        return subprocess.CompletedProcess(a, 0, stdout="", stderr="  FAILED (mark Needs-Manual): " + stale.name + " key=SECRET")

    monkeypatch.setattr(ga.subprocess, "run", fake_run)
    status = ga.run_generator([ROW], "SECRET")
    assert status == {ROW["path"]: "FAILED"}
    assert not stale.exists()
    err = capsys.readouterr().err
    assert "FAILED" in err and "SECRET" not in err


def test_a_fresh_png_counts_as_ok(tmp_path, monkeypatch):
    monkeypatch.setattr(ga, "RAW", tmp_path)
    (tmp_path / ga.raw_name(ROW["path"])).write_bytes(b"old")

    def fake_run(*a, **k):
        (tmp_path / ga.raw_name(ROW["path"])).write_bytes(b"new")
        return subprocess.CompletedProcess(a, 0, stdout="OK", stderr="")

    monkeypatch.setattr(ga.subprocess, "run", fake_run)
    assert ga.run_generator([ROW], "k") == {ROW["path"]: "OK"}
