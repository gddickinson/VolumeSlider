"""Read a 3D/4D TIFF into (time, channel, z, y, x) with its voxel size, using tifffile.

This is the Python reference for the browser reader (static/volume_layout.js, tested against it in
static/volume_layout.test.mjs via tests/fixtures/). The rules:

- ImageJ hyperstack: channels / slices / frames from the description, pages in ImageJ order (channel fastest, then z,
  then time); z step = `spacing`, x / y from the XResolution / YResolution tags, all in the description's `unit`.
- OME-TIFF: SizeC / SizeZ / SizeT and DimensionOrder from the OME-XML; PhysicalSizeX / Y / Z with their units.
- Anything else: one volume, one page per z plane, sizes unknown (1 px per voxel, unit "px").
- `slices_per_volume` > 0 (single channel only) re-splits all pages in file order into volumes the way the desktop
  plugin does (CamVolumeSlider.updateDisplay_volumeSizeChange: frame = slice + volume * slices; trailing pages that do
  not fill a volume are dropped).

Lengths are converted to micrometres when the unit is known (nm, µm, mm, cm, m); otherwise they stay in pixels.
"""
import io
import re

import numpy as np
import tifffile

UNIT_TO_UM = {"nm": 1e-3, "nanometer": 1e-3, "µm": 1.0, "μm": 1.0, "um": 1.0, "micron": 1.0, "microns": 1.0,
              "micrometer": 1.0, "\\u00B5m": 1.0, "mm": 1e3, "cm": 1e4, "m": 1e6}


def _ratio(tag):
    if tag is None:
        return None
    num, den = tag.value
    return den / num if num else None


def _imagej(tf, flat):
    ij = tf.imagej_metadata or {}
    C, Z, T = int(ij.get("channels", 1)), int(ij.get("slices", 1)), int(ij.get("frames", 1))
    n = C * Z * T
    if n != len(flat):  # images= without the hyperstack sizes: treat as a z stack
        C, Z, T = 1, len(flat), 1
    data = flat[:C * Z * T].reshape(T, Z, C, *flat.shape[1:]).transpose(0, 2, 1, 3, 4)
    factor = UNIT_TO_UM.get(str(ij.get("unit", "")).strip())
    page = tf.pages.first
    px, py = _ratio(page.tags.get("XResolution")), _ratio(page.tags.get("YResolution"))
    if factor is None or px is None:
        return data, None, "ImageJ hyperstack (no length unit)"
    py = py if py is not None else px
    z = float(ij.get("spacing", 1.0))
    return data, (z * factor, py * factor, px * factor), "ImageJ hyperstack"


def _ome(tf, flat):
    pix = tifffile.xml2dict(tf.ome_metadata)["OME"]["Image"]
    pix = (pix[0] if isinstance(pix, list) else pix)["Pixels"]
    sizes = {k: int(pix.get("Size" + k, 1)) for k in "CZT"}
    order = pix.get("DimensionOrder", "XYZCT")[2:]  # fastest first, e.g. "ZCT"
    if sizes["C"] * sizes["Z"] * sizes["T"] != len(flat):
        return flat[None, None], None, "OME-TIFF (sizes do not match the pages)"
    shape = [sizes[a] for a in reversed(order)] + list(flat.shape[1:])
    data = flat.reshape(shape)
    perm = [list(reversed(order)).index(a) for a in "TCZ"] + [3, 4]
    data = data.transpose(perm)

    def size(axis):
        v = pix.get("PhysicalSize" + axis)
        if v is None:
            return None
        f = UNIT_TO_UM.get(str(pix.get("PhysicalSize" + axis + "Unit", "µm")))
        return None if f is None else float(v) * f
    sx, sy, sz = size("X"), size("Y"), size("Z")
    if sx is None:
        return data, None, "OME-TIFF (no physical size)"
    return data, (sz if sz is not None else 1.0, sy if sy is not None else sx, sx), "OME-TIFF"


def read_volume(src, slices_per_volume=0):
    """src: path or bytes. Returns dict(data=(T, C, Z, Y, X) array, voxel=(z, y, x) or None, unit, source)."""
    with tifffile.TiffFile(io.BytesIO(src) if isinstance(src, (bytes, bytearray)) else src) as tf:
        page = tf.pages.first
        if page.samplesperpixel != 1:
            raise ValueError("Only one sample per pixel is supported (not RGB)")
        flat = tf.series[0].asarray().reshape(-1, page.imagelength, page.imagewidth)
        if tf.is_imagej:
            data, voxel, source = _imagej(tf, flat)
        elif tf.is_ome:
            data, voxel, source = _ome(tf, flat)
        else:
            data, voxel, source = flat[None, None], None, "plain page stack"
    if slices_per_volume and data.shape[1] == 1:
        frames = data.reshape(-1, *data.shape[3:])
        n = slices_per_volume
        vols = len(frames) // n
        if vols < 1:
            raise ValueError(f"{len(frames)} pages are fewer than one volume of {n} slices")
        # the plugin: B = reshape(frames, (n, vols, x, y), order='F'), i.e. B[s, v] = frames[s + v * n]
        B = np.reshape(frames[:n * vols], (n, vols) + frames.shape[1:], order="F")
        data = B.transpose(1, 0, 2, 3)[:, None]
        source += f", re-split as {n} slices per volume"
    return {"data": data, "voxel": voxel, "unit": "µm" if voxel else "px", "source": source}


def describe(src, slices_per_volume=0):
    """JSON-ready summary (no pixel data)."""
    v = read_volume(src, slices_per_volume)
    d = v["data"]
    T, C, Z, Y, X = d.shape
    return {"shape": {"T": T, "C": C, "Z": Z, "Y": Y, "X": X}, "dtype": str(d.dtype),
            "voxel": list(v["voxel"]) if v["voxel"] else [1, 1, 1], "unit": v["unit"], "source": v["source"],
            "range": [float(d.min()), float(d.max())]}


_SAFE = re.compile(r"[^A-Za-z0-9_.-]")


def safe_name(name):
    return _SAFE.sub("_", name)[:80]
