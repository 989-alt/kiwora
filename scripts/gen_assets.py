"""Generate the picture set from assets/manifest.json (kie.ai gpt-image-2, via the education-pptx tool).

    python scripts/gen_assets.py --species balsam [--only public/plants/balsam/leafStem.webp]
    python scripts/gen_assets.py --species shared        (pots, backgrounds, bugs)

For each manifest row of the species it
  1. asks education-pptx/scripts/image_gen.py (manifest mode) for a png in assets/raw/ (transparent rows are
     generated on magenta and keyed out by that tool; "transparent": false rows stay opaque),
  2. converts it to webp (long side <= 1024 px, quality 85, alpha kept) at the row's path,
  3. measures the anchors of the new pictures into public/anchors.json (scripts/anchors.py).

The API key is read from KIE_API_KEY in ~/docs/.env and handed to the child process as KIE_AI_API_KEY only.
It is never printed or written anywhere. assets/raw/ is git-ignored.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "assets" / "manifest.json"
RAW = ROOT / "assets" / "raw"
IMAGE_GEN = Path.home() / ".claude" / "skills" / "education-pptx" / "scripts" / "image_gen.py"
ENV_FILE = Path(os.environ.get("PLANT_ENV_FILE", str(Path.home() / "docs" / ".env")))

MAX_SIDE = 1024
QUALITY = 85


def read_key(env_file: Path = ENV_FILE) -> str | None:
    """KIE_API_KEY from a .env file. Returns None when missing (the caller reports, never prints the value)."""
    if not env_file.exists():
        return None
    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if line.startswith("KIE_API_KEY") and "=" in line:
            return line.split("=", 1)[1].strip().strip('"').strip("'") or None
    return None


def raw_name(path: str) -> str:
    return path.replace("/", "__").rsplit(".", 1)[0] + ".png"


def to_webp(png: Path, dest: Path, transparent: bool) -> None:
    """Shrink to MAX_SIDE, clean the keyed edge of transparent pictures, save webp."""
    with Image.open(png) as src:
        im = src.convert("RGBA")
    scale = min(1.0, MAX_SIDE / max(im.size))
    if scale < 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    if transparent:
        im = defringe(im)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=QUALITY, method=6)


def defringe(im: Image.Image) -> Image.Image:
    """The magenta key leaves a thin pink rim. Pull the alpha edge in by one pixel and soften it."""
    r, g, b, a = im.split()
    a = a.point(lambda v: 255 if v > 127 else 0).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    return Image.merge("RGBA", (r, g, b, a))


def run_generator(rows: list[dict], key: str) -> dict[str, str]:
    """Calls image_gen.py in manifest mode for the rows. Returns {path: 'OK' | 'FAILED'}."""
    RAW.mkdir(parents=True, exist_ok=True)
    # A stale png from an earlier run must not pass for this run's result: no file after the call = FAILED.
    for r in rows:
        (RAW / raw_name(r["path"])).unlink(missing_ok=True)
    jobs = [
        {"filename": raw_name(r["path"]), "prompt": r["prompt"], "aspect": r["aspect"], "opaque": not r["transparent"]}
        for r in rows
    ]
    job_file = RAW / f"_job_{os.getpid()}.json"  # one per process, so two runs never share a job list
    job_file.write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")
    env = {**os.environ, "KIE_AI_API_KEY": key, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    proc = subprocess.run(
        [sys.executable, str(IMAGE_GEN), "--manifest", str(job_file), "-o", str(RAW)],
        cwd=str(ROOT),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    job_file.unlink(missing_ok=True)
    # The generator reports "FAILED ..." on stderr; show everything it said (key masked) so a failure is visible.
    for stream, out in ((proc.stdout, sys.stdout), (proc.stderr, sys.stderr)):
        if stream.strip():
            print(stream.strip().replace(key, "***"), file=out)
    return {r["path"]: ("OK" if (RAW / raw_name(r["path"])).exists() else "FAILED") for r in rows}


def select_rows(species: str, only: str | None, manifest: list[dict]) -> list[dict]:
    rows = [r for r in manifest if r["species"] == species]
    if only:
        rows = [r for r in rows if r["path"] == only]
    return rows


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--species", required=True, help="species id or 'shared'")
    ap.add_argument("--only", help="regenerate just this manifest path")
    ap.add_argument("--reconvert", action="store_true", help="skip generation, convert the existing raw pngs again")
    args = ap.parse_args(argv)

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    rows = select_rows(args.species, args.only, manifest)
    if not rows:
        print(f"no manifest rows for {args.species} {args.only or ''}", file=sys.stderr)
        return 1

    if args.reconvert:
        status = {r["path"]: ("OK" if (RAW / raw_name(r["path"])).exists() else "FAILED") for r in rows}
    else:
        key = read_key()
        if not key:
            print("KIE_API_KEY not found in the .env file; nothing generated", file=sys.stderr)
            return 2
        if not IMAGE_GEN.exists():
            print(f"image_gen.py not found: {IMAGE_GEN}", file=sys.stderr)
            return 2
        status = run_generator(rows, key)

    done: list[str] = []
    for r in rows:
        if status[r["path"]] != "OK":
            print(f"FAILED {r['path']}")
            continue
        to_webp(RAW / raw_name(r["path"]), ROOT / r["path"], r["transparent"])
        done.append(r["path"])
        print(f"OK     {r['path']}")

    if done:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import anchors

        anchors.update(done)
    return 0 if len(done) == len(rows) else 2


if __name__ == "__main__":
    sys.exit(main())
