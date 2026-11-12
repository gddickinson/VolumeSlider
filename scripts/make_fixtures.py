"""Fixtures for the JS-vs-Python tests (tests/fixtures/):

- shear_cases.json: inputs and outputs of volumeSlider/shear_transform.perform_shear_transform for several angles,
  shift factors and array orders, plus a SHA-256 of the transform of the shipped light-sheet demo (all volumes).
- vol_*.tif + volumes.json: small TIFFs written with tifffile in the layouts the browser reader handles, and what
  web/volume_io.read_volume (the Python reference) makes of them.

Run: python scripts/make_fixtures.py
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from volumeSlider.shear_transform import perform_shear_transform  # noqa: E402
from volumeSlider.web.volume_io import read_volume  # noqa: E402

FIX = ROOT / "tests" / "fixtures"
DEMO = ROOT / "volumeSlider" / "web" / "static" / "demo" / "synthetic_lightsheet_raw.tif"
QUIET = {"progress": lambda m: None}

SHEAR_CASES = [  # (theta, shift factor, input order, display order, input shape, upsample axis)
    (45, 1, [0, 3, 1, 2], [3, 0, 1, 2], (9, 2, 4, 6), 1),
    (45, 2, [0, 3, 1, 2], [3, 0, 1, 2], (8, 1, 3, 7), 1),
    (30, 3, [0, 3, 1, 2], [3, 0, 1, 2], (10, 2, 3, 5), 1),
    (60, 2, [0, 3, 1, 2], [3, 0, 1, 2], (7, 2, 5, 6), 1),
    (135, 1, [0, 3, 1, 2], [3, 0, 1, 2], (9, 1, 3, 8), 1),
    (72.5, 2, [0, 1, 2, 3], [0, 1, 2, 3], (8, 6, 2, 3), 1),
    (20, 1, [2, 0, 3, 1], [1, 3, 0, 2], (8, 3, 9, 2), 1),
    (45, 2, [0, 3, 1, 2], [3, 0, 1, 2], (8, 1, 3, 7), 0),
    (30, 3, [0, 3, 1, 2], [3, 0, 1, 2], (6, 2, 3, 9), 0),
    (110, 2, [1, 0, 3, 2], [2, 3, 1, 0], (5, 7, 2, 4), 0),
]


def demo_planes():
    """The demo as the plugin's B array (slices, volumes, x, y)."""
    raw = read_volume(str(DEMO))["data"][:, 0]  # (t, z, y, x)
    return raw.transpose(1, 0, 3, 2).astype(float)


def shear_fixture():
    rng = np.random.default_rng(7)
    cases = []
    for theta, sf, inp, disp, shape, axis in SHEAR_CASES:
        A = rng.integers(0, 1000, shape).astype(float)
        E = perform_shear_transform(A, sf, False, A.dtype, theta, inputArrayOrder=inp, displayArrayOrder=disp,
                                    upsample_axis=axis, **QUIET)
        cases.append({"theta": theta, "shift_factor": sf, "input_order": inp, "display_order": disp, "upsample_axis": axis,
                      "shape": list(shape), "input": A.ravel().astype(int).tolist(),
                      "out_shape": list(E.shape), "output": E.ravel().astype(int).tolist()})
    E = perform_shear_transform(demo_planes(), 2, False, float, 45, **QUIET)
    demo = {"theta": 45, "shift_factor": 2, "out_shape": list(E.shape),
            "sha256": hashlib.sha256(np.ascontiguousarray(E, "<f8").tobytes()).hexdigest(),
            "sum": float(E.sum()), "nonzero": int(np.count_nonzero(E))}
    return {"cases": cases, "demo": demo}


def volume_fixtures():
    rng = np.random.default_rng(3)
    files = {}

    def add(name, arr, slices=0, **kw):
        tifffile.imwrite(FIX / name, arr, **kw)
        files[name] = slices

    add("vol_ij_tzyx_u16.tif", rng.integers(0, 4000, (2, 3, 5, 6), dtype=np.uint16), imagej=True,
        resolution=(1 / 0.25, 1 / 0.25), metadata={"axes": "TZYX", "spacing": 0.8, "unit": "um"})
    add("vol_ij_zcyx_u8.tif", rng.integers(0, 255, (3, 2, 4, 5), dtype=np.uint8), imagej=True,
        resolution=(10.0, 8.0), metadata={"axes": "ZCYX", "spacing": 2.0, "unit": "micron"})
    add("vol_ij_nm_lzw_f32.tif", rng.random((4, 6, 7), dtype=np.float32), imagej=True, compression="lzw",
        resolution=(1 / 65.0, 1 / 65.0), metadata={"axes": "ZYX", "spacing": 150.0, "unit": "nm"})
    add("vol_ome_tzyx_i16.ome.tif", rng.integers(-500, 500, (2, 3, 4, 5), dtype=np.int16), ome=True,
        metadata={"axes": "TZYX", "PhysicalSizeX": 0.11, "PhysicalSizeY": 0.12, "PhysicalSizeZ": 0.5})
    add("vol_plain_be_u16.tif", rng.integers(0, 60000, (6, 5, 4), dtype=np.uint16), byteorder=">", photometric="minisblack")
    add("vol_bigtiff_tiled_deflate.tif", rng.integers(0, 60000, (3, 20, 24), dtype=np.uint16), bigtiff=True,
        tile=(16, 16), compression="zlib", photometric="minisblack")
    add("vol_ij_frames_resplit.tif", rng.integers(0, 4000, (14, 3, 4), dtype=np.uint16), slices=4, imagej=True,
        resolution=(2.5, 2.5), metadata={"axes": "TYX", "unit": "um"})
    expected = {}
    for name, slices in files.items():
        v = read_volume(str(FIX / name), slices_per_volume=slices)
        d = v["data"]
        expected[name] = {"slices_per_volume": slices, "shape": list(d.shape), "dtype": str(d.dtype),
                          "voxel": list(v["voxel"]) if v["voxel"] else None, "unit": v["unit"], "source": v["source"],
                          "data": d.ravel().astype(float).tolist()}
    return expected


def main():
    FIX.mkdir(parents=True, exist_ok=True)
    (FIX / "shear_cases.json").write_text(json.dumps(shear_fixture(), separators=(",", ":")))
    (FIX / "volumes.json").write_text(json.dumps(volume_fixtures(), separators=(",", ":")))
    print("fixtures written to", FIX)


if __name__ == "__main__":
    main()
