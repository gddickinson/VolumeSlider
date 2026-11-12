"""Light-sheet shear (deskew) transform used by the 3D viewer, free of Qt and flika.

Moved here from helperFunctions.py so it can be tested and reused (the web interface imports it); helperFunctions
re-exports the same names, so the plugin behaves as before. The only change is `np.int` -> `int`: the alias was removed
in NumPy 1.24, and every call crashed with AttributeError on a current NumPy.

Array layout (the plugin's): B has shape (slices per volume, volumes, x, y), as built by
CamVolumeSlider.updateDisplay_volumeSizeChange. `inputArrayOrder` moves those axes to (a0, a1, a2, a3); the shear acts
in the (a0, a1) plane: new_a0 = a0 + cos(theta) * a1, new_a1 = sin(theta) * a1. `displayArrayOrder` then moves the
result's axes; the 3D viewer reads it as (depth, volume, image axis 1, image axis 2).

Which axis the shift factor upsamples (`upsample_axis`). With the default input order a0 is the scan step (one frame per
step) and a1 the camera axis that lies along the tilted sheet. A voxel at step k, camera row p sits at lateral position
k * step + p * pixel * cos(theta) and depth p * pixel * sin(theta), so the shear is only right when a0 and a1 are in the
same unit, and either axis can be stretched to get there:
- CAMERA_AXIS (1, default): each camera row is repeated `shift_factor` times; the grid unit is one scan step, and
  shift_factor = camera pixel size / scan step (for a camera pixel at least as large as the step).
- SCAN_AXIS (0): each scan step is repeated `shift_factor` times; the grid unit is one camera pixel, and
  shift_factor = scan step / camera pixel size (for a step larger than the pixel).
So the right choice depends on the acquisition. The default is the axis the plugin has always used (the 3D viewer only
ever ran this path). `interpolate=True` upsamples the same axis by linear interpolation instead of repetition; it used
to upsample a0 while the repeat path stretched a1 (so the same shift factor meant opposite geometries), and it crashed
on scikit-image >= 0.19 (a 2-value scale for 3D blocks).
"""
import numpy as np
from numpy import moveaxis

# The plugin's array-order choices (CamVolumeSlider.arrayDict) and defaults (volumeSlider_Main / volumeSlider_Start).
ARRAY_ORDERS = {str(list(p)): list(p) for p in [
    (0, 1, 2, 3), (0, 1, 3, 2), (0, 2, 1, 3), (0, 2, 3, 1), (0, 3, 1, 2), (0, 3, 2, 1),
    (1, 0, 2, 3), (1, 0, 3, 2), (1, 2, 0, 3), (1, 2, 3, 0), (1, 3, 0, 2), (1, 3, 2, 0),
    (2, 0, 1, 3), (2, 0, 3, 1), (2, 1, 0, 3), (2, 1, 3, 0), (2, 3, 0, 1), (2, 3, 1, 0),
    (3, 0, 1, 2), (3, 0, 2, 1), (3, 1, 0, 2), (3, 1, 2, 0), (3, 2, 0, 1), (3, 2, 1, 0)]}
DEFAULT_INPUT_ORDER = [0, 3, 1, 2]
DEFAULT_DISPLAY_ORDER = [3, 0, 1, 2]
DEFAULT_THETA = 45
DEFAULT_SHIFT_FACTOR = 1
SCAN_AXIS, CAMERA_AXIS = 0, 1
DEFAULT_UPSAMPLE_AXIS = CAMERA_AXIS
UPSAMPLE_AXIS_CHOICES = ['scan steps (step > camera pixel)', 'camera rows (camera pixel >= step)']  # index = axis


def get_transformation_matrix(theta=45):
    """
    theta is the angle of the light sheet
    """

    theta = theta/360 * 2 * np.pi # in radians
    hx = np.cos(theta)
    sy = np.sin(theta)

    S = np.array([[1, hx, 0],
                  [0, sy, 0],
                  [0, 0, 1]])

    return S


def get_transformation_coordinates(I, theta):
    S = get_transformation_matrix(theta)
    S_inv = np.linalg.inv(S)
    mx, my = I.shape

    four_corners = np.matmul(S, np.array([[0, 0, mx, mx],
                                          [0, my, 0, my],
                                          [1, 1, 1, 1]]))[:-1,:]
    range_x = np.round(np.array([np.min(four_corners[0]), np.max(four_corners[0])])).astype(int)
    range_y = np.round(np.array([np.min(four_corners[1]), np.max(four_corners[1])])).astype(int)
    all_new_coords = np.meshgrid(np.arange(range_x[0], range_x[1]), np.arange(range_y[0], range_y[1]))
    new_coords = [all_new_coords[0].flatten(), all_new_coords[1].flatten()]
    new_homog_coords = np.stack([new_coords[0], new_coords[1], np.ones(len(new_coords[0]))])
    old_coords = np.matmul(S_inv, new_homog_coords)
    old_coords = old_coords[:-1, :]
    old_coords[0, old_coords[0, :] >= mx-1] = -1
    old_coords[1, old_coords[1, :] >= my-1] = -1
    old_coords[0, old_coords[0, :] < 1] = -1
    old_coords[1, old_coords[1, :] < 1] = -1
    new_coords[0] -= np.min(new_coords[0])
    keep_coords = np.logical_not(np.logical_or(old_coords[0] == -1, old_coords[1] == -1))
    new_coords = [new_coords[0][keep_coords], new_coords[1][keep_coords]]
    old_coords = [old_coords[0][keep_coords], old_coords[1][keep_coords]]
    return old_coords, new_coords


def upsample_linear(A, factor, axis):
    """Linear interpolation of A to `factor` times as many samples along `axis`, sampled at pixel centres (sample j of
    the output sits at (j + 0.5) / factor - 0.5 of the input) and clamped at the edges, like skimage's rescale(order=1,
    mode='edge'). Values constant along `axis` come out exactly as np.repeat(A, factor, axis) gives them."""
    m = A.shape[axis]
    x = np.clip((np.arange(m * factor) + 0.5) / factor - 0.5, 0, m - 1)
    i0 = np.floor(x).astype(int)
    i1 = np.minimum(i0 + 1, m - 1)
    w = (x - i0).reshape([-1 if a == axis else 1 for a in range(A.ndim)])
    return np.take(A, i0, axis=axis) * (1 - w) + np.take(A, i1, axis=axis) * w


def perform_shear_transform(A, shift_factor, interpolate, datatype, theta, inputArrayOrder=DEFAULT_INPUT_ORDER,
                            displayArrayOrder=DEFAULT_DISPLAY_ORDER, progress=print, upsample_axis=None):
    """Deskew a 4D array (see the module docstring for the axes). `upsample_axis` (SCAN_AXIS or CAMERA_AXIS, default
    DEFAULT_UPSAMPLE_AXIS) is the axis stretched by `shift_factor`, by repetition or, with `interpolate`, linearly.
    `progress(message)` reports upsampling steps."""
    axis = DEFAULT_UPSAMPLE_AXIS if upsample_axis is None else upsample_axis
    if axis not in (SCAN_AXIS, CAMERA_AXIS):
        raise ValueError(f"upsample_axis must be {SCAN_AXIS} (scan step) or {CAMERA_AXIS} (camera row), not {axis!r}")
    A = moveaxis(A, inputArrayOrder, [0, 1, 2, 3]) # INPUT
    if interpolate:
        progress('Upsampling axis {} x{} (linear)'.format(axis, shift_factor))
        A_rescaled = upsample_linear(np.asarray(A, dtype=float), int(shift_factor), axis)
    else:
        A_rescaled = np.repeat(A, shift_factor, axis=axis)
    mx, my, mz, mt = A_rescaled.shape
    I = A_rescaled[:, :, 0, 0]
    old_coords, new_coords = get_transformation_coordinates(I, theta)
    old_coords = np.round(old_coords).astype(int)
    new_mx, new_my = np.max(new_coords[0]) + 1, np.max(new_coords[1]) + 1

    D = np.zeros((new_mx, new_my, mz, mt))
    D[new_coords[0], new_coords[1], :, :] = A_rescaled[old_coords[0], old_coords[1], :, :]
    E = moveaxis(D, [0, 1, 2, 3], displayArrayOrder) # AXIS INDEX CHANGED FROM INPUT TO MATCH KYLE'S CODE

    return E
