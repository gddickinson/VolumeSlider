// Glue between the viewer's samples and the plugin's arrays for the shear transform (shear_engine.js).
// The plugin holds a light-sheet recording as B[slice, volume, x, y] (flika's windows are (frame, x, y), x = image
// column), and its 3D viewer shows the transform's output E as E[:, volume] = (depth, image axis 1, image axis 2)
// with pyqtgraph's column-major images: axis 1 across, axis 2 down. These helpers do the same in both directions.

// sample (data[t][c], z-y-x) -> B = (slices, volumes, x, y) as Float64Array
export function pluginArray(s, channel = 0) {
  const [Z, Y, X] = s.size, T = s.T, B = new Float64Array(Z * T * X * Y);
  for (let z = 0; z < Z; z++) for (let t = 0; t < T; t++) {
    const v = s.data[t][channel];
    for (let x = 0; x < X; x++) {
      const o = ((z * T + t) * X + x) * Y;
      for (let y = 0; y < Y; y++) B[o + y] = v[(z * Y + y) * X + x];
    }
  }
  return { shape: [Z, T, X, Y], data: B };
}

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Output voxel size. With the default array orders (input [0, 3, 1, 2], display [3, 0, 1, 2]) the transform adds the
// scan step index to the row index (new = step + cos(theta) * row), after one of them was repeated shift-factor times.
// Repeating rows (upsampleAxis 1, the plugin's default) makes the grid unit one camera row pixel / shift factor, and one
// scan step is taken to be one grid unit; repeating scan steps (upsampleAxis 0) makes it one camera row pixel, and one
// scan step is taken to be shift factor grid units. Columns are unchanged.
export function outputVoxel(raw, { shiftFactor, inputOrder, displayOrder, upsampleAxis = 1 }) {
  if (!same(inputOrder, [0, 3, 1, 2]) || !same(displayOrder, [3, 0, 1, 2])) {
    return { voxel: [1, 1, 1], unit: 'grid', note: 'Non-default array orders: the output axes are shown in grid units.' };
  }
  const rows = upsampleAxis === 1, grid = rows ? raw.voxel[1] / shiftFactor : raw.voxel[1], step = rows ? grid : grid * shiftFactor;
  const p = x => +x.toPrecision(4);
  const note = (rows ? `Grid unit = camera row pixel / shift factor = ${p(grid)} ${raw.unit}. The transform treats one scan step as one grid unit`
    : `Grid unit = camera row pixel = ${p(grid)} ${raw.unit}. The transform treats one scan step as shift factor grid units (${p(step)} ${raw.unit})`) +
    (raw.scaleKnown ? `; the file gives a step of ${p(raw.voxel[0])} ${raw.unit}${Math.abs(raw.voxel[0] - step) > 1e-6 * step ? ' (different: check the shift factor and which axis it stretches)' : ' (consistent)'}.` : '.');
  return { voxel: [grid, grid, raw.voxel[2]], unit: raw.unit, note };
}

// E (depth, volumes, a, b) -> sample with z = depth, x = a (across), y = b (down)
export function sampleFromOutput(E, raw, opts) {
  const [D, T, A, Bn] = E.shape, data = [];
  for (let t = 0; t < T; t++) {
    const v = new Float32Array(D * Bn * A);
    for (let z = 0; z < D; z++) for (let a = 0; a < A; a++) {
      const src = ((z * T + t) * A + a) * Bn;
      for (let b = 0; b < Bn; b++) v[(z * Bn + b) * A + a] = E.data[src + b];
    }
    data.push([v]);
  }
  const { voxel, unit, note } = outputVoxel(raw, opts);
  return { T, C: 1, size: [D, Bn, A], data, voxel, unit, scaleKnown: raw.scaleKnown && unit !== 'grid', names: ['deskewed'],
    source: `shear transform (theta ${opts.theta}°, shift factor ${opts.shiftFactor} on the ${opts.upsampleAxis === 0 ? 'scan' : 'camera'} axis)`, dtype: 'float64', note };
}
