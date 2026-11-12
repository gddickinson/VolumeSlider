"""The main dialog (Form2) uses and remembers the shear-transform settings. Needs flika and Qt (run in the flika env);
skipped elsewhere. flika's real settings object writes ~/.FLIKA/settings.json on every change, so every test swaps
g.settings for a plain dict first.

Run: /opt/anaconda3/envs/flika_new/bin/python -m pytest -q tests/test_gui_settings.py
"""
import os
import sys
from pathlib import Path
from unittest import mock

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
pytest.importorskip("flika")
QtWidgets = pytest.importorskip("qtpy.QtWidgets")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from flika import global_vars as g  # noqa: E402

from volumeSlider.shear_transform import ARRAY_ORDERS, CAMERA_AXIS, SCAN_AXIS  # noqa: E402

BASE_SETTINGS = {"slicesPerVolume": 1, "baselineValue": 0, "f0Start": 0, "f0End": 0, "f0VolStart": 0, "f0VolEnd": 0,
                 "multiplicationFactor": 100, "currentDataType": 0, "newDataType": 0, "theta": 45, "shiftFactor": 1,
                 "trimLastFrame": False, "inputArrayOrder": 4, "displayArrayOrder": 18}


@pytest.fixture
def form(monkeypatch):
    """Build Form2 on a stub viewer with the given plugin settings."""
    app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
    from volumeSlider import volumeSlider_Main_GUI as gui

    def make(**overrides):
        monkeypatch.setattr(g, "settings", {"volumeSlider": {**BASE_SETTINGS, **overrides}})
        viewer = mock.MagicMock()
        viewer.getNFrames.return_value = 10
        viewer.getMaxPixel.return_value = 100
        viewer.getNVols.return_value = 2
        viewer.getArrayKeys.return_value = list(ARRAY_ORDERS)
        return gui.Form2(viewer)
    yield make
    app.processEvents()


def test_upsample_axis_setting_is_shown_and_saved(form):
    f = form(upsampleAxis=SCAN_AXIS)
    assert f.upsampleAxisBox.currentIndex() == SCAN_AXIS and f.upsampleAxis == SCAN_AXIS
    f.upsampleAxisBox.setCurrentIndex(CAMERA_AXIS)
    f.saveSettings()
    assert g.settings["volumeSlider"]["upsampleAxis"] == CAMERA_AXIS
