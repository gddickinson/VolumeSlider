"""The plugin's defaults, defined once (Qt-free). Every dialog, the viewer and the shear transform read them from here.

- ARRAY_ORDERS: the 24 axis orders of the input/display drop-down menus (key = menu text, value = order).
- DEFAULT_INPUT_ORDER / DEFAULT_DISPLAY_ORDER: the orders the plugin starts with.
- DEFAULT_THETA, DEFAULT_SHIFT_FACTOR, SCAN_AXIS / CAMERA_AXIS, DEFAULT_UPSAMPLE_AXIS, UPSAMPLE_AXIS_CHOICES: shear
  transform settings (see shear_transform.py for what the upsampling axis means).
- DEFAULT_SETTINGS: the g.settings['volumeSlider'] entries written when the plugin starts. The array orders are saved
  as menu indices.
- array_order_index(saved, default): menu index of a saved order (index, order or menu text), else of `default`.
"""
from itertools import permutations

ARRAY_ORDERS = {str(list(p)): list(p) for p in permutations(range(4))}
ARRAY_ORDER_KEYS = list(ARRAY_ORDERS)

DEFAULT_INPUT_ORDER = [0, 3, 1, 2]
DEFAULT_DISPLAY_ORDER = [3, 0, 1, 2]
DEFAULT_THETA = 45
DEFAULT_SHIFT_FACTOR = 1
SCAN_AXIS, CAMERA_AXIS = 0, 1
DEFAULT_UPSAMPLE_AXIS = CAMERA_AXIS
UPSAMPLE_AXIS_CHOICES = ['scan steps (step > camera pixel)', 'camera rows (camera pixel >= step)']  # index = axis


def array_order_index(saved, default):
    """Menu index for a saved array order: an index 0-23, an order such as [3, 0, 1, 2], or its menu text. Anything
    else (missing, out of range, not a permutation) gives the index of `default`."""
    if isinstance(saved, int) and not isinstance(saved, bool) and 0 <= saved < len(ARRAY_ORDER_KEYS):
        return saved
    key = saved if isinstance(saved, str) else str(list(saved)) if isinstance(saved, (list, tuple)) else None
    if key in ARRAY_ORDERS:
        return ARRAY_ORDER_KEYS.index(key)
    return ARRAY_ORDER_KEYS.index(str(list(default)))


DEFAULT_SETTINGS = {
    'inputChoice': 'Current Window',
    'keepOriginalWindow': False,
    'slicesPerVolume': 1,
    'baselineValue': 0,
    'f0Start': 0,
    'f0End': 0,
    'multiplicationFactor': 100,
    'currentDataType': 0,
    'newDataType': 0,
    'theta': DEFAULT_THETA,
    'shiftFactor': DEFAULT_SHIFT_FACTOR,
    'upsampleAxis': DEFAULT_UPSAMPLE_AXIS,
    'trimLastFrame': False,
    'inputArrayOrder': array_order_index(DEFAULT_INPUT_ORDER, DEFAULT_INPUT_ORDER),
    'displayArrayOrder': array_order_index(DEFAULT_DISPLAY_ORDER, DEFAULT_DISPLAY_ORDER),
    'f0VolStart': 0,
    'f0VolEnd': 0,
    'IMS_fname': 'IMS_export.ims',
    'IMS_subsamp': '((1, 1, 1), (1, 2, 2))',
    'IMS_chunks': '((16, 128, 128), (64, 64, 64))',
    'IMS_compression': 'gzip',
    'IMS_thumbsize': '256',
    'IMS_dx': 0.1,
    'IMS_dz': 0.25,
    'IMS_Unit': 'um',
    'IMS_GammaCorrection': 1,
    'IMS_ColorRange': '0 255',
    'IMS_LSMEmissionWavelength': 0,
    'IMS_LSMExcitationWavelength': 0,
}
