"""Light-sheet shear (deskew) transform used by the 3D viewer, free of Qt and flika.

Moved here from helperFunctions.py so it can be tested and reused (the web interface imports it); helperFunctions
re-exports the same names, so the plugin behaves as before. The only change is `np.int` -> `int`: the alias was removed
in NumPy 1.24, and every call crashed with AttributeError on a current NumPy.

Array layout (the plugin's): B has shape (slices per volume, volumes, x, y), as built by
CamVolumeSlider.updateDisplay_volumeSizeChange. `inputArrayOrder` moves those axes to (a0, a1, a2, a3); the shear acts
in the (a0, a1) plane: new_a0 = a0 + cos(theta) * a1, new_a1 = sin(theta) * a1, after a1 has been repeated
`shift_factor` times (or a0 upsampled by `shift_factor` when interpolate=True). `displayArrayOrder` then moves the
result's axes; the 3D viewer reads it as (depth, volume, image axis 1, image axis 2).
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


def perform_shear_transform(A, shift_factor, interpolate, datatype, theta, inputArrayOrder=DEFAULT_INPUT_ORDER,
                            displayArrayOrder=DEFAULT_DISPLAY_ORDER, progress=print):
    """Deskew a 4D array (see the module docstring for the axes). `progress(message)` reports upsampling steps."""
    A = moveaxis(A, inputArrayOrder, [0, 1, 2, 3]) # INPUT
    m1, m2, m3, m4 = A.shape
    if interpolate:
        from skimage.transform import rescale
        A_rescaled = np.zeros((m1*int(shift_factor), m2, m3, m4))
        for v in np.arange(m4):
            progress('Upsampling Volume #{}/{}'.format(v+1, m4))
            A_rescaled[:, :, :, v] = rescale(A[:, :, :, v], (shift_factor, 1.), mode='constant', preserve_range=True)
    else:
        A_rescaled = np.repeat(A, shift_factor, axis=1)
    mx, my, mz, mt = A_rescaled.shape
    I = A_rescaled[:, :, 0, 0]
    old_coords, new_coords = get_transformation_coordinates(I, theta)
    old_coords = np.round(old_coords).astype(int)
    new_mx, new_my = np.max(new_coords[0]) + 1, np.max(new_coords[1]) + 1

    D = np.zeros((new_mx, new_my, mz, mt))
    D[new_coords[0], new_coords[1], :, :] = A_rescaled[old_coords[0], old_coords[1], :, :]
    E = moveaxis(D, [0, 1, 2, 3], displayArrayOrder) # AXIS INDEX CHANGED FROM INPUT TO MATCH KYLE'S CODE

    return E
