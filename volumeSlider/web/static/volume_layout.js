// TIFF pages -> a 4D sample (time, channel, z, y, x) with its voxel size: the browser twin of web/volume_io.py
// (tested against it on the fixtures in tests/fixtures/ by volume_layout.test.mjs).
// ImageJ hyperstacks (channels / slices / frames, spacing, unit + X/YResolution), OME-TIFF (SizeC/Z/T, DimensionOrder,
// PhysicalSizeX/Y/Z), otherwise one volume with one page per z plane and no known size (1 px per voxel).
// slicesPerVolume > 0 re-splits all pages in file order like the desktop plugin: frame = slice + volume * slices,
// trailing pages that do not fill a volume are dropped.

export const UNIT_TO_UM = { nm: 1e-3, nanometer: 1e-3, 'µm': 1, 'μm': 1, um: 1, micron: 1, microns: 1, micrometer: 1,
  '\\u00B5m': 1, mm: 1e3, cm: 1e4, m: 1e6 };

const tagValue = (t, code) => (t.tags.find(x => x.code === code) || {}).value;
const ratio = v => (Array.isArray(v) && v[0] ? v[1] / v[0] : null);

function imagejMeta(desc) {
  const m = {};
  for (const line of desc.split(/\r?\n/)) { const i = line.indexOf('='); if (i > 0) m[line.slice(0, i)] = line.slice(i + 1); }
  return m;
}

function imagej(t, n) {
  const m = imagejMeta(t.description);
  let C = +(m.channels || 1), Z = +(m.slices || 1), T = +(m.frames || 1);
  if (C * Z * T !== n) { C = 1; Z = n; T = 1; }
  const index = (tt, c, z) => c + C * (z + Z * tt);
  const factor = UNIT_TO_UM[(m.unit || '').trim()];
  const px = ratio(tagValue(t, 282));
  if (factor === undefined || px === null) return { T, C, Z, index, voxel: null, source: 'ImageJ hyperstack (no length unit)' };
  const py = ratio(tagValue(t, 283)) ?? px, z = m.spacing !== undefined ? parseFloat(m.spacing) : 1;
  return { T, C, Z, index, voxel: [z * factor, py * factor, px * factor], source: 'ImageJ hyperstack' };
}

function ome(t, n) {
  const pix = (t.description.match(/<Pixels\b[^>]*>/) || [''])[0];
  const attr = k => { const m = pix.match(new RegExp(`\\b${k}="([^"]*)"`)); return m ? m[1] : undefined; };
  const S = { C: +(attr('SizeC') || 1), Z: +(attr('SizeZ') || 1), T: +(attr('SizeT') || 1) };
  if (S.C * S.Z * S.T !== n) return { T: 1, C: 1, Z: n, index: (tt, c, z) => z, voxel: null, source: 'OME-TIFF (sizes do not match the pages)' };
  const order = (attr('DimensionOrder') || 'XYZCT').slice(2), stride = {};
  let s = 1;
  for (const a of order) { stride[a] = s; s *= S[a]; }
  const index = (tt, c, z) => tt * stride.T + c * stride.C + z * stride.Z;
  const size = a => {
    const v = attr('PhysicalSize' + a);
    if (v === undefined) return null;
    const f = UNIT_TO_UM[attr(`PhysicalSize${a}Unit`) ?? 'µm'];
    return f === undefined ? null : parseFloat(v) * f;
  };
  const sx = size('X'), sy = size('Y'), sz = size('Z');
  if (sx === null) return { T: S.T, C: S.C, Z: S.Z, index, voxel: null, source: 'OME-TIFF (no physical size)' };
  return { T: S.T, C: S.C, Z: S.Z, index, voxel: [sz ?? 1, sy ?? sx, sx], source: 'OME-TIFF' };
}

const toF32 = p => (p instanceof Float32Array ? p : Float32Array.from(p));

function stack(pages, ny, nx, Z, at) {
  const out = new Float32Array(Z * ny * nx);
  for (let z = 0; z < Z; z++) out.set(toF32(pages[at(z)]), z * ny * nx);
  return out;
}

// t: the result of tiff_reader.readTiff. Returns { T, C, size: [Z, Y, X], data[t][c] (Float32Array, z-y-x order),
// voxel: [z, y, x], unit ('µm', or 'px' when the file has no size), scaleKnown, source, dtype, pages, dropped }.
export function layoutVolume(t, { slicesPerVolume = 0 } = {}) {
  if (t.samples !== 1) throw new Error('Only one sample per pixel is supported (not RGB)');
  const n = t.pages.length, desc = t.description || '';
  let L;
  if (desc.startsWith('ImageJ=')) L = imagej(t, n);
  else if (desc.includes('<OME')) L = ome(t, n);
  else L = { T: 1, C: 1, Z: n, index: (tt, c, z) => z, voxel: null, source: 'plain page stack' };
  let { T, C, Z, index } = L, dropped = 0, source = L.source;
  if (slicesPerVolume > 0 && C === 1) {
    // all frames in file order (time-major), then the plugin's split
    const order = [];
    for (let tt = 0; tt < T; tt++) for (let z = 0; z < Z; z++) order.push(index(tt, 0, z));
    const N = slicesPerVolume, vols = Math.floor(order.length / N);
    if (vols < 1) throw new Error(`${order.length} pages are fewer than one volume of ${N} slices`);
    dropped = order.length - N * vols;
    T = vols; Z = N;
    index = (tt, c, z) => order[z + tt * N];
    source += `, re-split as ${N} slices per volume`;
  }
  const data = Array.from({ length: T }, (_, tt) => Array.from({ length: C }, (_, c) => stack(t.pages, t.height, t.width, Z, z => index(tt, c, z))));
  return {
    T, C, size: [Z, t.height, t.width], data, voxel: L.voxel || [1, 1, 1], unit: L.voxel ? 'µm' : 'px', scaleKnown: !!L.voxel,
    source, dtype: t.dtype, pages: n, dropped, names: Array.from({ length: C }, (_, c) => (C > 1 ? `channel ${c + 1}` : 'intensity')),
  };
}
