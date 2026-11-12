"""Plugin defaults are defined once (volumeSlider/defaults.py) and the saved-setting indices point at them.

Run: python -m pytest -q tests/test_defaults.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from volumeSlider import defaults  # noqa: E402
from volumeSlider import shear_transform  # noqa: E402


def test_settings_indices_point_at_the_default_orders():
    keys = list(defaults.ARRAY_ORDERS)
    s = defaults.DEFAULT_SETTINGS
    assert defaults.ARRAY_ORDERS[keys[s["inputArrayOrder"]]] == defaults.DEFAULT_INPUT_ORDER == [0, 3, 1, 2]
    assert defaults.ARRAY_ORDERS[keys[s["displayArrayOrder"]]] == defaults.DEFAULT_DISPLAY_ORDER == [3, 0, 1, 2]
    assert s["theta"] == defaults.DEFAULT_THETA and s["shiftFactor"] == defaults.DEFAULT_SHIFT_FACTOR
    assert s["upsampleAxis"] == defaults.DEFAULT_UPSAMPLE_AXIS


def test_shear_transform_uses_the_same_defaults():
    for name in ("ARRAY_ORDERS", "DEFAULT_INPUT_ORDER", "DEFAULT_DISPLAY_ORDER", "DEFAULT_UPSAMPLE_AXIS"):
        assert getattr(shear_transform, name) is getattr(defaults, name)


def test_array_order_index_accepts_index_or_order_and_falls_back():
    f = defaults.array_order_index
    assert f(5, defaults.DEFAULT_INPUT_ORDER) == 5
    assert f([3, 0, 1, 2], defaults.DEFAULT_INPUT_ORDER) == 18 and f("[3, 0, 1, 2]", defaults.DEFAULT_INPUT_ORDER) == 18
    for bad in (None, 24, -1, "x", [0, 0, 1, 2], True):
        assert f(bad, defaults.DEFAULT_DISPLAY_ORDER) == 18


def test_no_hard_coded_array_order_indices_in_the_gui():
    for name in ("volumeSlider_Main.py", "volumeSlider_Main_GUI.py", "volumeSlider_Start.py"):
        src = (ROOT / "volumeSlider" / name).read_text()
        assert "] = 16" not in src and "setCurrentIndex(18)" not in src and "setCurrentIndex(4)" not in src, name
