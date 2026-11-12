"""Synthetic demo volumes for the web interface (seeded, so the files are reproducible). Not microscope data.

- `synthetic_cell`: a 4D (t, z, y, x) stack: an ellipsoidal cell outline with a brighter nucleus and puncta that
  drift between time points; voxel 0.6 x 0.3 x 0.3 µm (z, y, x).
- `synthetic_lightsheet_raw`: what a scanned oblique light sheet records of fluorescent beads, built so that the
  plugin's own shear transform (shear_transform.perform_shear_transform, theta = 45°, shift factor 2, default array
  orders) maps them back to round beads. Each raw frame is one scan step; within a frame the rows run along the tilted
  sheet. The beads are placed in the deskewed grid (depth d, horizontal x, vertical h, one grid unit = camera pixel /
  shift factor along d and h, one camera pixel along x), and each raw pixel (step s, row r, column x) samples the
  point d = sin(theta) j, h = s + cos(theta) j with j = r * shift + (shift - 1) / 2, the inverse of the transform.
"""
import numpy as np

CELL = {"voxel_um": (0.6, 0.3, 0.3), "shape": (3, 32, 80, 80)}  # (t, z, y, x)
SHEET = {"theta": 45, "shift_factor": 2, "camera_px_um": 0.4, "steps": 64, "rows": 32, "cols": 56, "volumes": 3}


def synthetic_cell(seed=1):
    rng = np.random.default_rng(seed)
    T, Z, Y, X = CELL["shape"]
    vz, vy, vx = CELL["voxel_um"]
    z, y, x = np.meshgrid((np.arange(Z) + 0.5) * vz, (np.arange(Y) + 0.5) * vy, (np.arange(X) + 0.5) * vx,
                          indexing="ij")
    c = np.array([Z * vz / 2, Y * vy / 2, X * vx / 2])
    r = ((z - c[0]) / 7.0) ** 2 + ((y - c[1]) / 10.0) ** 2 + ((x - c[2]) / 9.0) ** 2
    shell = np.exp(-((np.sqrt(r) - 1.0) / 0.15) ** 2)
    nuc = 1.0 / (1.0 + np.exp((((z - c[0]) / 3.5) ** 2 + ((y - c[1] - 1) / 4.0) ** 2
                               + ((x - c[2] + 1) / 4.5) ** 2 - 1.0) / 0.08))
    pts = c + rng.uniform(-1, 1, (14, 3)) * np.array([4.0, 6.0, 5.5])
    vel = rng.normal(0, 0.6, (14, 3))
    out = np.empty((T, Z, Y, X), np.uint16)
    for t in range(T):
        img = 900 * shell + 350 * nuc
        for p in pts + t * vel:
            img += 1600 * np.exp(-(((z - p[0]) / 0.7) ** 2 + ((y - p[1]) / 0.35) ** 2 + ((x - p[2]) / 0.35) ** 2))
        out[t] = np.clip(100 + img + rng.normal(0, 12, img.shape), 0, 65535).astype(np.uint16)
    return out


def synthetic_lightsheet_raw(seed=2):
    """Raw scan as (volumes, steps, rows, columns) uint16, plus the bead centres (grid units) for reference."""
    rng = np.random.default_rng(seed)
    p = SHEET
    th = np.deg2rad(p["theta"])
    sf, S, R, Xn = p["shift_factor"], p["steps"], p["rows"], p["cols"]
    j = np.arange(R) * sf + (sf - 1) / 2
    s = np.arange(S)
    d = (np.sin(th) * j)[None, :, None]                                    # (1, R, 1)
    h = (s[:, None] + np.cos(th) * j[None, :])[:, :, None]                  # (S, R, 1)
    x = np.arange(Xn)[None, None, :]
    dmax, hmax = np.sin(th) * j[-1], S + np.cos(th) * j[-1]
    # beads inside the region every step sees: h between cos*j_max and S, d between 3 and d_max - 3
    n = 18
    beads = np.column_stack([rng.uniform(4, dmax - 4, n), rng.uniform(4, Xn - 4, n),
                             rng.uniform(np.cos(th) * j[-1] + 3, S - 3, n), rng.uniform(0.6, 1.0, n)])
    drift = rng.normal(0, 1.2, (n, 3))
    sig_dh = 0.6 / (p["camera_px_um"] / sf)  # 0.6 µm in grid units
    sig_x = 0.6 / p["camera_px_um"]
    out = np.empty((p["volumes"], S, R, Xn), np.uint16)
    for v in range(p["volumes"]):
        img = np.zeros((S, R, Xn))
        for k, (bd, bx, bh, a) in enumerate(beads):
            cd, cx, ch = np.array([bd, bx, bh]) + v * drift[k]
            img += 2500 * a * np.exp(-((d - cd) ** 2 + (h - ch) ** 2) / (2 * sig_dh ** 2) - (x - cx) ** 2 / (2 * sig_x ** 2))
        out[v] = np.clip(100 + img + rng.normal(0, 8, img.shape), 0, 65535).astype(np.uint16)
    return out, beads, (dmax, hmax)
