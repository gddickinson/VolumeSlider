"""Web interface tests: every exported endpoint answers, the static build is complete, and the JS engine tests pass.

Run: python -m pytest -q tests/test_web.py
"""
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from volumeSlider.web.app import STATIC, STATIC_ENDPOINTS, app  # noqa: E402

client = TestClient(app)


def test_index_served():
    r = client.get("/")
    assert r.status_code == 200 and "static/main.js" in r.text


@pytest.mark.parametrize("path", STATIC_ENDPOINTS)
def test_endpoint(path):
    r = client.get("/api" + path)
    assert r.status_code == 200, r.text
    assert r.json() is not None


def test_static_build(tmp_path):
    sys.path.insert(0, str(ROOT / "scripts"))
    import build_static
    build_static.build(tmp_path / "site")
    assert (tmp_path / "site" / "index.html").read_text().count("APP_STATIC") == 1
    for path in STATIC_ENDPOINTS:
        assert (tmp_path / "site" / "api" / (path.strip("/") + ".json")).exists()


def test_static_assets_referenced_exist():
    html = (STATIC / "index.html").read_text()
    for name in ("style.css", "main.js"):
        assert f"static/{name}" in html and (STATIC / name).exists()


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_js_engine():
    tests = sorted(STATIC.glob("*.test.mjs"))
    for t in tests:
        r = subprocess.run(["node", str(t)], capture_output=True, text=True)
        assert r.returncode == 0, r.stdout + r.stderr


# --- VolumeSlider-specific -------------------------------------------------------------------------------------------
import json  # noqa: E402

import numpy as np  # noqa: E402

FIX = ROOT / "tests" / "fixtures"


def test_demos_described_with_voxel_sizes():
    d = {x["id"]: x for x in client.get("/api/demos").json()}
    assert d["cell"]["described"]["shape"] == {"T": 3, "C": 1, "Z": 32, "Y": 80, "X": 80}
    assert d["cell"]["described"]["voxel"] == [0.6, 0.3, 0.3] and d["cell"]["described"]["unit"] == "µm"
    assert d["sheet"]["described"]["voxel"] == [0.2, 0.4, 0.4]
    assert all("Synthetic" in x["about"] for x in d.values())


def test_shear_defaults_are_the_plugins():
    r = client.get("/api/shear/defaults").json()
    assert (r["theta"], r["shift_factor"], r["input_order"], r["display_order"]) == (45, 1, [0, 3, 1, 2], [3, 0, 1, 2])
    assert len(r["array_orders"]) == 24


def test_shear_check_matches_fixture_and_rejects_bad_input():
    demo = json.loads((FIX / "shear_cases.json").read_text())["demo"]
    r = client.get("/api/shear/demo").json()
    assert r["shape"] == demo["out_shape"] and r["nonzero"] == demo["nonzero"]
    assert np.isclose(r["sum"], demo["sum"], rtol=1e-12)
    assert client.post("/api/shear/check", json={"theta": 0}).status_code == 422
    assert client.post("/api/shear/check", json={"input_order": [0, 0, 1, 2]}).status_code == 422
    r = client.post("/api/shear/check", json={"theta": 30, "shift_factor": 1}).json()
    assert r["shape"][1] == 3 and len(r["sha256"]) == 64


def test_describe_upload():
    f = FIX / "vol_ij_tzyx_u16.tif"
    r = client.post("/api/describe", files={"file": (f.name, f.read_bytes(), "image/tiff")})
    assert r.status_code == 200 and r.json()["shape"] == {"T": 2, "C": 1, "Z": 3, "Y": 5, "X": 6}
    assert client.post("/api/describe", files={"file": ("x.tif", b"not a tiff", "image/tiff")}).status_code == 422


def test_info_from_readme_and_info_xml():
    r = client.get("/api/info").json()
    assert r["plugin"]["version"] == "2019.01.11" and r["plugin"]["author"] == "George Dickinson"
    assert "](" not in r["overview"] and len(r["features"]) >= 5


def test_fixtures_are_current():
    """Re-run the Python side of the fixtures (scripts/make_fixtures.py) and compare with the committed files."""
    sys.path.insert(0, str(ROOT / "scripts"))
    import make_fixtures
    from volumeSlider.web.volume_io import read_volume
    cases = json.loads((FIX / "shear_cases.json").read_text())
    for c, (theta, sf, inp, disp, shape) in zip(cases["cases"], make_fixtures.SHEAR_CASES):
        A = np.array(c["input"], float).reshape(shape)
        E = make_fixtures.perform_shear_transform(A, sf, False, A.dtype, theta, inputArrayOrder=inp,
                                                  displayArrayOrder=disp, progress=lambda m: None)
        assert list(E.shape) == c["out_shape"]
        # BLAS rounding may differ between platforms; allow a handful of re-picked source pixels
        assert np.mean(E.ravel() == np.array(c["output"])) > 0.99
    E = make_fixtures.perform_shear_transform(make_fixtures.demo_planes(), 2, False, float, 45, progress=lambda m: None)
    assert list(E.shape) == cases["demo"]["out_shape"]
    assert abs(E.sum() - cases["demo"]["sum"]) / cases["demo"]["sum"] < 1e-3
    expected = json.loads((FIX / "volumes.json").read_text())
    for name, e in expected.items():
        v = read_volume(str(FIX / name), slices_per_volume=e["slices_per_volume"])
        assert list(v["data"].shape) == e["shape"] and v["source"] == e["source"] and v["unit"] == e["unit"]
        np.testing.assert_allclose(v["data"].ravel().astype(float), e["data"], rtol=1e-9)
        if e["voxel"]:
            np.testing.assert_allclose(v["voxel"], e["voxel"], rtol=1e-9)


def test_demo_files_are_current():
    """scripts/make_demo.py reproduces the shipped demo pixels (to within one count, for libm differences between platforms)."""
    from volumeSlider.web.demo_volumes import synthetic_cell, synthetic_lightsheet_raw
    from volumeSlider.web.volume_io import read_volume
    demo = ROOT / "volumeSlider" / "web" / "static" / "demo"
    cell = read_volume(str(demo / "synthetic_cell.tif"))["data"][:, 0]
    sheet = read_volume(str(demo / "synthetic_lightsheet_raw.tif"))["data"][:, 0]
    assert np.abs(cell.astype(int) - synthetic_cell()).max() <= 1
    assert np.abs(sheet.astype(int) - synthetic_lightsheet_raw()[0]).max() <= 1
