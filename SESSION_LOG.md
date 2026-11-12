# SESSION_LOG

## 2026-11-12: web interface (branch web-interface)
- **Fix**: the shear transform used `np.int` (removed in NumPy 1.24), so the 3D viewer and batch processing crashed
  with AttributeError on a current NumPy. Moved the transform to Qt-free `volumeSlider/shear_transform.py` with `int`;
  `helperFunctions.py` re-exports it. Regression tests: `tests/test_shear_transform.py`.
- **Fix (docs)**: README clone URL (placeholder repository), licence link (LICENSE.md -> LICENSE), and "volume
  rendering" (the plugin has scatter and texture-plane plots).
- Added the web interface: FastAPI app (port 8233) + static GitHub Pages site. Viewer for 3D/4D TIFFs (pure-JS reader,
  ImageJ/OME/plain, voxel sizes), orthogonal slices, max projections, WebGL2 volume render, playback; Deskew page with
  the shear transform ported to JS (voxel-identical to NumPy on 7 fixture cases and the demo, SHA-256 checked).
- Demo data are synthetic (`scripts/make_demo.py`): a 4D cell and a raw oblique light-sheet bead scan built for
  theta 45 deg / shift factor 2.
- Open questions for George: see reports (interpolate branch upsamples axis 0 while the default path repeats axis 1;
  `BatchOptions` sets `displayArrayOrder = 16` unconditionally; README clone target nests the plugin one folder deep).

## 2026-11-12: follow-up fixes (George: "make sensible choices")
- **Fix**: `perform_shear_transform(interpolate=True)` upsampled axis 0 (scan step) while the default path repeated
  axis 1 (camera row), so one shift factor meant opposite geometries; it also crashed on scikit-image >= 0.19 (a 2-value
  scale for 3D blocks). Which axis is right depends on the acquisition (stretch camera rows when the camera pixel is at
  least the scan step, shift = pixel / step; stretch scan steps when the step is larger, shift = step / pixel), so both
  paths now take `upsample_axis` (default 1 = camera rows, what the 3D viewer has always done; results unchanged), and
  interpolate is linear along that same axis. The main dialog has a "shift factor stretches" menu (setting
  `upsampleAxis`); the web Deskew page and `/api/shear/check` have the same option (JS still voxel-identical: 10 cases).
- **Fix**: the main dialog and `BatchOptions` set `displayArrayOrder = s['displayArrayOrder'] = 16` on every open,
  while the menus were hard-coded to index 18 (display, the order the viewer really used) and 4 (input), whatever the
  setting said. Defaults now live only in `volumeSlider/defaults.py` (`DEFAULT_SETTINGS` uses index 18, i.e.
  [3, 0, 1, 2], the order the plugin has always transformed with); the menus open at the saved setting, the viewer is
  set to what the menus show, and a change is stored in the settings. Note: `volumeSlider_Start` still rewrites all
  plugin settings at every flika start (its 'UPDATE' check never matches), so choices last for the flika session.
- **Fix (docs)**: README, manual and the web About page told users to clone the repository into
  `~/.flika/plugins/volumeSlider`, which puts `info.xml` at `.../volumeSlider/volumeSlider/info.xml`; flika only loads
  plugin folders with `info.xml` at the top (`plugin_manager`), and its folder is `~/.FLIKA/plugins`. Now: clone
  anywhere, copy or symlink the inner `volumeSlider` folder.
