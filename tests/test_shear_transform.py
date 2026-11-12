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


# --- upsampling axis (2026-11-12) ---------------------------------------------------------------------------------
# The shear new_a0 = a0 + cos(theta) * a1 needs a0 (scan step index) and a1 (camera row along the tilted sheet) in the
# same unit. Repeating a1 r times makes the unit one scan step (r = camera pixel / scan step); upsampling a0 r times
# makes it one camera pixel (r = scan step / camera pixel). interpolate=True used to upsample a0 while the default path
# repeated a1, so one shift factor meant two opposite geometries (and interpolate=True crashed on scikit-image >= 0.19).
QUIET = {"progress": lambda m: None}


def _const_along(axis, shape=(6, 5, 2, 4), seed=3):
    """A random plugin array B whose values do not change along `axis` of the input-ordered array A."""
    A = np.random.default_rng(seed).random(shape)
    A = np.repeat(np.take(A, [0], axis=axis), shape[axis], axis=axis)
    return np.moveaxis(A, [0, 1, 2, 3], DEFAULT_INPUT_ORDER)  # back to B, so moveaxis(B, input order) == A


@pytest.mark.parametrize("axis", [0, 1])
def test_interpolate_upsamples_the_same_axis_as_repeat(axis):
    B = _const_along(axis)
    rep = perform_shear_transform(B, 2, False, B.dtype, 45, upsample_axis=axis, **QUIET)
    lin = perform_shear_transform(B, 2, True, B.dtype, 45, upsample_axis=axis, **QUIET)
    assert lin.shape == rep.shape
    np.testing.assert_allclose(lin, rep, rtol=1e-12, atol=1e-12)


def test_default_axis_is_the_camera_axis_in_both_paths():
    B = np.random.default_rng(4).random((6, 2, 5, 4))
    for interpolate in (False, True):
        E = perform_shear_transform(B, 2, interpolate, B.dtype, 45, **QUIET)
        E1 = perform_shear_transform(B, 2, interpolate, B.dtype, 45, upsample_axis=1, **QUIET)
        np.testing.assert_array_equal(E, E1)
    assert perform_shear_transform(B, 2, False, B.dtype, 45, **QUIET).shape == \
        perform_shear_transform(B, 2, True, B.dtype, 45, **QUIET).shape


def test_scan_axis_option_puts_features_at_their_physical_position():
    """Scan step = 2 camera pixels, theta 60: two beads at the same lateral position but different depths are seen at
    (step 4, row 2) and (step 3, row 6). Upsampling the scan axis by 2 lines them up; repeating rows does not."""
    m0, m1 = 10, 10
    A = np.zeros((m0, m1, 1, 1))
    A[4, 2] = A[3, 6] = 1.0
    B = np.moveaxis(A, [0, 1, 2, 3], DEFAULT_INPUT_ORDER)
    E = perform_shear_transform(B, 2, False, B.dtype, 60, upsample_axis=0, **QUIET)
    plane = np.moveaxis(E, DEFAULT_DISPLAY_ORDER, [0, 1, 2, 3])[:, :, 0, 0]
    cols = sorted({int(c) for c in np.nonzero(plane)[0]})
    assert max(cols) - min(cols) <= 1, cols
    E_rows = perform_shear_transform(B, 2, False, B.dtype, 60, upsample_axis=1, **QUIET)
    plane = np.moveaxis(E_rows, DEFAULT_DISPLAY_ORDER, [0, 1, 2, 3])[:, :, 0, 0]
    cols = sorted({int(c) for c in np.nonzero(plane)[0]})
    assert max(cols) - min(cols) >= 2, cols


def test_bad_upsample_axis_is_rejected():
    B = np.zeros((6, 1, 3, 4))
    with pytest.raises(ValueError, match="upsample_axis"):
        perform_shear_transform(B, 2, False, B.dtype, 45, upsample_axis=2, **QUIET)
