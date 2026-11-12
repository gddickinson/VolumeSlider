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
