"""Web interface for the VolumeSlider plugin (FastAPI app + static front end; no flika or Qt needed).

- app.py           FastAPI routes under /api and STATIC_ENDPOINTS for the static GitHub Pages export
- volume_io.py     TIFF -> (t, c, z, y, x) + voxel size with tifffile (Python reference for static/volume_layout.js)
- demo_volumes.py  the two synthetic demo volumes (scripts/make_demo.py writes them to static/demo/)
- static/          the front end: viewer, shear transform engine (port of ../shear_transform.py), TIFF reader
"""
