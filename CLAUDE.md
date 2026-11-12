# VolumeSlider

flika plugin for light-sheet volumes plus a web interface. Navigation map: @INTERFACE.md. Progress: SESSION_LOG.md.

- Plugin tests need flika: `/opt/anaconda3/envs/flika_new/bin/python -m pytest -q tests`; the web tests run in any env
  with `requirements-web.txt` (`python -m pytest -q tests`; the flika-only test skips).
- The shear transform lives in `volumeSlider/shear_transform.py`; `static/shear_engine.js` must stay voxel-identical
  (regenerate fixtures with `python scripts/make_fixtures.py`).
