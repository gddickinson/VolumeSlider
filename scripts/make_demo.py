"""Write the two synthetic demo TIFFs shipped with the web interface (volumeSlider/web/static/demo/).

Run: python scripts/make_demo.py   (deterministic: the same seed gives the same files)
Both are ImageJ hyperstacks (t, z, y, x), uint16, Deflate-compressed, with their voxel size in the file.
"""
import sys
from pathlib import Path

import tifffile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from volumeSlider.web.demo_volumes import CELL, SHEET, synthetic_cell, synthetic_lightsheet_raw  # noqa: E402

OUT = ROOT / "volumeSlider" / "web" / "static" / "demo"


def write(path, data, z_um, xy_um, info):
    tifffile.imwrite(path, data, imagej=True, compression="zlib", resolution=(1 / xy_um, 1 / xy_um),
                     metadata={"axes": "TZYX", "spacing": z_um, "unit": "um", "Info": info})


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    vz, vy, _ = CELL["voxel_um"]
    write(OUT / "synthetic_cell.tif", synthetic_cell(), vz, vy,
          "Synthetic demo volume (VolumeSlider web interface, scripts/make_demo.py). Not microscope data.")
    raw, _, _ = synthetic_lightsheet_raw()
    px = SHEET["camera_px_um"]
    write(OUT / "synthetic_lightsheet_raw.tif", raw, px / SHEET["shift_factor"], px,
          "Synthetic raw oblique light-sheet scan (beads), theta 45 deg, shift factor 2 (scripts/make_demo.py). "
          "Not microscope data.")
    for f in sorted(OUT.glob("*.tif")):
        print(f"{f.name}: {f.stat().st_size / 1e3:.0f} kB")


if __name__ == "__main__":
    main()
