# INTERFACE.md: VolumeSlider navigation map

A flika plugin (`volumeSlider/`, loaded by flika from `info.xml`) plus a web interface (`volumeSlider/web/`).

## Plugin (needs flika, Qt, pyqtgraph)
| File | Contents |
|---|---|
| `volumeSlider/volumeSlider_Start.py` | Entry point (`volumeSliderBase.gui`), default settings (theta 45, shift factor 1, array-order indices) |
| `volumeSlider/volumeSlider_Main.py` | `CamVolumeSlider`: data handling, reshape to (slices, volumes, x, y), batch processing, `BatchOptions` |
| `volumeSlider/volumeSlider_Main_GUI.py` | Main dialog: slices per volume, baseline, DF/F0, theta, shift factor, array-order combos |
| `volumeSlider/volumeSlider_3DViewer.py` | 3D viewer docks (top-view max projection, X/Y/Z slices, free ROI, time slider), overlays, Gaussian, IMS export dialog |
| `volumeSlider/shear_transform.py` | **Qt-free** shear transform: `get_transformation_matrix`, `get_transformation_coordinates`, `perform_shear_transform`, `ARRAY_ORDERS`, defaults |
| `volumeSlider/helperFunctions.py` | GUI helpers, cube plotting; re-exports the shear transform with status-bar progress |
| `volumeSlider/texturePlot.py`, `scatterPlot.py` | 3D texture-plane and thresholded-scatter plots (pyqtgraph.opengl) |
| `volumeSlider/overlayOptions.py`, `*_classOverwrite*.py`, `histogramExtension.py` | Overlay controls, pyqtgraph subclass tweaks |
| `volumeSlider/exportIMS.py`, `exportFakeSuperRes.py` | Imaris (.ims) export, fake super-resolution export |
| `volumeSlider/tiffLoader.py`, `tiffPageLoader.py` | TIFF loading through flika's tifffile |
| `volumeSlider/test_IMS_converter.py`, `OLD/` | Scratch script (hard-coded Windows path) and old versions; not tests |

## Web interface (no flika needed)
| File | Contents |
|---|---|
| `run_web.py` | Starts uvicorn on 127.0.0.1:8233 |
| `volumeSlider/web/app.py` | FastAPI: `/api/info`, `/api/demos`, `/api/shear/defaults`, `/api/shear/demo`, POST `/api/shear/check`, POST `/api/describe`; `STATIC_ENDPOINTS` |
| `volumeSlider/web/volume_io.py` | `read_volume` / `describe`: TIFF -> (t, c, z, y, x) + voxel size with tifffile (reference for `volume_layout.js`) |
| `volumeSlider/web/demo_volumes.py` | `synthetic_cell`, `synthetic_lightsheet_raw` (seeded synthetic demos) |
| `static/main.js`, `core.js`, `static_api.js`, `state.js`, `loader.js` | Router, API layer (server or static JSON), shared open file, TIFF loading |
| `static/home.js`, `view.js`, `deskew.js`, `about.js` | Pages |
| `static/viewer.js`, `render.js`, `volume3d.js` | Orthogonal views / MIP / readout, canvas drawing, WebGL2 ray-marched 3D view |
| `static/tiff_reader.js`, `tiff_codecs.js`, `tiff_tags.js` | Pure-JS TIFF reader (from web_microview) |
| `static/volume_layout.js` | Pages -> 4D sample + voxel size (twin of `volume_io.py`) |
| `static/shear_engine.js`, `deskew_volume.js` | JS port of `shear_transform.py`; sample <-> plugin array glue, output voxel size |
| `static/*.test.mjs` | Node tests against the Python fixtures |
| `static/demo/*.tif` | The two synthetic demo TIFFs |

## Scripts and tests
| File | Contents |
|---|---|
| `scripts/make_demo.py` | Writes `static/demo/*.tif` |
| `scripts/make_fixtures.py` | Writes `tests/fixtures/` (shear cases, TIFF layouts + expected values) |
| `scripts/build_static.py`, `scripts/screenshots.py` | Static export for GitHub Pages; Playwright smoke test / README images |
| `tests/test_shear_transform.py` | Shear transform regression tests (np.int crash) |
| `tests/test_web.py` | API, static build, node tests, fixtures and demos are current |
