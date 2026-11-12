// Orthogonal slices and maximum projections of a 4D sample (data[t][c]: Float32Array, (z, y, x) C order) on canvas.
// Each channel is coloured, scaled to its display range, added and clipped. Views are drawn at physical aspect from the
// voxel size: one canvas pixel is 1/k length units (µm, or px when the file has no size) in both directions.

export const LUTS = { gray: [255, 255, 255], green: [60, 255, 110], magenta: [255, 60, 220], cyan: [60, 220, 255], red: [255, 70, 60] };
export const CHANNEL_LUTS = ['green', 'magenta', 'cyan', 'red'];
export const VIEWS = {
  xy: { label: 'XY', across: 'z', w: 2, h: 1 },   // width along x, height along y, plane chosen by z
  zy: { label: 'ZY', across: 'x', w: 0, h: 1 },   // width along z, height along y (sits right of XY)
  xz: { label: 'XZ', across: 'y', w: 2, h: 0 },   // width along x, height along z (sits under XY)
};
const AX = { z: 0, y: 1, x: 2 };

export function range(v) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < v.length; i++) { const a = v[i]; if (a < lo) lo = a; if (a > hi) hi = a; }
  return [lo, hi];
}

// Display ranges per channel: 'series' min..max over all time points (steady brightness during playback),
// 'frame' min..max of the shown time point. `sat` (0..1) lowers the top of the range to brighten dim data.
export function displayRanges(s, t, mode, sat = 1) {
  return s.names.map((_, c) => {
    let r;
    if (mode === 'frame') r = range(s.data[t][c]);
    else {
      s._series ??= [];
      if (!s._series[c]) {
        let lo = Infinity, hi = -Infinity;
        for (const vols of s.data) { const [a, b] = range(vols[c]); lo = Math.min(lo, a); hi = Math.max(hi, b); }
        s._series[c] = [lo, hi];
      }
      r = s._series[c];
    }
    return [r[0], r[0] + (r[1] - r[0]) * sat];
  });
}

// 2D image (W*H Float32Array) of one channel: the plane at pos[across], or the max projection along that axis
export function plane(v, size, view, pos, mip) {
  const V = VIEWS[view], [, ny, nx] = size, W = size[V.w], H = size[V.h], out = new Float32Array(W * H).fill(-Infinity);
  const a = AX[V.across], k0 = mip ? 0 : pos[a], k1 = mip ? size[a] : pos[a] + 1;
  const st = [ny * nx, nx, 1], sa = st[a], sw = st[V.w], sh = st[V.h];
  for (let k = k0; k < k1; k++) for (let r = 0; r < H; r++) {
    const base = k * sa + r * sh, row = r * W;
    for (let c = 0; c < W; c++) { const val = v[base + c * sw]; if (val > out[row + c]) out[row + c] = val; }
  }
  return { W, H, img: out };
}

export const colourOf = (s, c, luts) => LUTS[luts[c]] || LUTS.gray;

// RGBA (Uint8ClampedArray) combining the enabled channels
export function composite(s, t, view, pos, mip, enabled, ranges, luts) {
  const V = VIEWS[view], W = s.size[V.w], H = s.size[V.h], acc = new Float32Array(W * H * 3);
  s.data[t].forEach((v, c) => {
    if (!enabled[c]) return;
    const p = plane(v, s.size, view, pos, mip), [lo, hi] = ranges[c], span = hi - lo || 1, col = colourOf(s, c, luts);
    for (let i = 0; i < W * H; i++) { const u = Math.max(0, (p.img[i] - lo) / span); for (let j = 0; j < 3; j++) acc[i * 3 + j] += u * col[j]; }
  });
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { out[i * 4] = acc[i * 3]; out[i * 4 + 1] = acc[i * 3 + 1]; out[i * 4 + 2] = acc[i * 3 + 2]; out[i * 4 + 3] = 255; }
  return { W, H, rgba: out };
}

// Colour volume for the 3D view: RGBA8 voxels (z, y, x), the same colours and display ranges
export function colourVolume(s, t, enabled, ranges, luts) {
  const n = s.size[0] * s.size[1] * s.size[2], acc = new Float32Array(n * 3), out = new Uint8Array(n * 4);
  s.data[t].forEach((v, c) => {
    if (!enabled[c]) return;
    const [lo, hi] = ranges[c], span = hi - lo || 1, col = colourOf(s, c, luts);
    for (let i = 0; i < n; i++) { const u = Math.max(0, (v[i] - lo) / span); for (let j = 0; j < 3; j++) acc[i * 3 + j] += u * col[j]; }
  });
  for (let i = 0; i < n; i++) {
    const r = Math.min(255, acc[i * 3]), g = Math.min(255, acc[i * 3 + 1]), b = Math.min(255, acc[i * 3 + 2]);
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = Math.max(r, g, b);
  }
  return out;
}

const NICE = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
export const niceBar = len => NICE.reduce((b, v) => (v <= len ? v : b), NICE[0]);

// Draw a composite into canvas at k px per length unit; cross = [u, v] position of the other two planes, or null
export function draw(canvas, comp, uW, uH, k, { cross = null, bar = true, unit = 'µm' } = {}) {
  const cw = Math.max(1, Math.round(comp.W * uW * k)), ch = Math.max(1, Math.round(comp.H * uH * k));
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  const off = document.createElement('canvas');
  off.width = comp.W; off.height = comp.H;
  off.getContext('2d').putImageData(new ImageData(comp.rgba, comp.W, comp.H), 0, 0);
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(off, 0, 0, cw, ch);
  if (cross) {
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(cross[0] * k + .5, 0); g.lineTo(cross[0] * k + .5, ch); g.moveTo(0, cross[1] * k + .5); g.lineTo(cw, cross[1] * k + .5); g.stroke();
    g.setLineDash([]);
  }
  const fs = Math.round(Math.max(12, Math.min(cw, 900) / 32));
  g.font = `${fs}px ui-monospace, Menlo, monospace`; g.fillStyle = '#fff';
  if (bar) {
    const len = niceBar(comp.W * uW / 4), px = len * k, x = 8, y = ch - 10, th = Math.max(3, Math.round(fs / 4));
    if (px > 8 && ch > 3 * fs) { g.fillRect(x, y, px, th); g.fillText(`${len} ${unit}`, x, y - 6); }
  }
}
