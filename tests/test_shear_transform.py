"""The light-sheet shear transform (volumeSlider/shear_transform.py) runs on a current NumPy and keeps its geometry.

Regression: helperFunctions used `np.int`, removed in NumPy 1.24, so opening the 3D viewer crashed with AttributeError.
Run: python -m pytest -q tests/test_shear_transform.py
"""
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from volumeSlider.shear_transform import (  # noqa: E402
    ARRAY_ORDERS, DEFAULT_DISPLAY_ORDER, DEFAULT_INPUT_ORDER, get_transformation_coordinates, perform_shear_transform)


def test_runs_on_current_numpy():
    A = np.random.default_rng(0).random((5, 2, 6, 4))  # (slices, volumes, x, y)
    E = perform_shear_transform(A, 1, False, A.dtype, 45, progress=lambda m: None)
    # input (0,3,1,2) -> (slices, y, volumes, x); output moved to (depth, volumes, x, sheared)
    assert E.shape[1] == 2 and E.shape[2] == 6
    assert E.ndim == 4 and np.isfinite(E).all()


def test_theta_90_keeps_interior_pixels():
    """At 90 degrees the shear is the identity; the transform drops source pixels on the border of the (a0, a1) plane
    (index 0 and the last index; a0 = 1 as well, because cos(90 deg) is 6e-17 rather than 0, putting it just below 1)."""
    A = np.arange(6 * 1 * 3 * 7, dtype=float).reshape(6, 1, 3, 7)
    E = perform_shear_transform(A, 1, False, A.dtype, 90, displayArrayOrder=[0, 1, 2, 3], progress=lambda m: None)
    Ain = np.moveaxis(A, DEFAULT_INPUT_ORDER, [0, 1, 2, 3])  # (6, 7, 1, 3)
    assert E.shape == (5, 6, 1, 3)
    assert E[2:5, 1:6].tolist() == Ain[2:5, 1:6].tolist()
    assert (E[:2] == 0).all() and (E[:, 0] == 0).all()


def test_coordinates_stay_inside_source():
    old, new = get_transformation_coordinates(np.zeros((20, 9)), 30)
    assert old[0].min() >= 1 and old[0].max() < 19 and old[1].min() >= 1 and old[1].max() < 8
    assert new[0].min() >= 0 and len(old[0]) == len(new[1])


def test_shift_factor_repeats_axis_one():
    A = np.random.default_rng(1).random((4, 1, 3, 5))
    E1 = perform_shear_transform(A, 1, False, A.dtype, 45, progress=lambda m: None)
    E3 = perform_shear_transform(A, 3, False, A.dtype, 45, progress=lambda m: None)
    assert E3.shape[0] > E1.shape[0] and E3.shape[2] == E1.shape[2] == 3


def test_array_orders_match_the_plugin():
    assert len(ARRAY_ORDERS) == 24 and list(ARRAY_ORDERS)[4] == str(DEFAULT_INPUT_ORDER)
    assert list(ARRAY_ORDERS)[18] == str(DEFAULT_DISPLAY_ORDER)  # the GUI's default combo index


def test_helper_functions_reexport():
    pytest.importorskip("flika")
    from volumeSlider import helperFunctions
    A = np.random.default_rng(2).random((5, 2, 6, 4))
    got = helperFunctions.perform_shear_transform(A, 1, False, A.dtype, 45)  # the 3D viewer's call
    np.testing.assert_array_equal(got, perform_shear_transform(A, 1, False, A.dtype, 45, progress=lambda m: None))
    assert helperFunctions.get_transformation_coordinates is get_transformation_coordinates
