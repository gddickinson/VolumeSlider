// The plugin's light-sheet shear (deskew) transform, ported from volumeSlider/shear_transform.py
// (perform_shear_transform with interpolate=False, the only mode the 3D viewer uses). Tested against the Python on the
// fixtures in tests/fixtures/shear_*.json by shear_engine.test.mjs, voxel for voxel.
//
// Numerical twins of NumPy, so the same source pixels are picked:
// - np.round is round-half-to-even (roundHalfEven);
// - np.matmul (BLAS) adds with a fused multiply-add, i.e. one rounding of n0 + Si01 * n1 (fmaInt computes that exactly);
// - np.linalg.inv of [[1, cos, 0], [0, sin, 0], [0, 0, 1]] is [[1, -cos * (1 / sin), 0], [0, 1 / sin, 0], [0, 0, 1]].
// Arrays are { shape: [4 ints], data: Float64Array } in C order.

export function roundHalfEven(x) {
  const r = Math.round(x);
  return (r - x === 0.5 && r % 2 !== 0) ? r - 1 : r;
}

// round-to-nearest(a + b * c) with a, c integers (|.| < 2^31) and b any double: exact via BigInt.
const F64 = new Float64Array(1), U64 = new BigUint64Array(F64.buffer);
function decompose(b) { // b = m * 2^e exactly, m a BigInt
  F64[0] = b;
  const bits = U64[0], sign = bits >> 63n ? -1n : 1n, ex = Number((bits >> 52n) & 0x7ffn), frac = bits & 0xfffffffffffffn;
  if (ex === 0) return [sign * frac, -1074];
  return [sign * (frac | 0x10000000000000n), ex - 1075];
}
export function fmaInt(a, b, c) {
  if (b === 0 || c === 0) return a;
  const [m, e] = decompose(b);
  if (e >= 0) return Number(BigInt(a) + m * BigInt(c) * (1n << BigInt(e)));
  const k = -e, num = (BigInt(a) << BigInt(k)) + m * BigInt(c);
  return k <= 1023 ? Number(num) / 2 ** k : Number(num) / 2 ** 1023 / 2 ** (k - 1023);
}

export function transformationMatrix(theta = 45) {
  const t = theta / 360 * 2 * Math.PI, hx = Math.cos(t), sy = Math.sin(t);
  return { S: [[1, hx, 0], [0, sy, 0], [0, 0, 1]], Sinv: [[1, -hx * (1 / sy), 0], [0, 1 / sy, 0], [0, 0, 1]] };
}

// get_transformation_coordinates(I, theta) for an mx x my plane: source (old) and target (new) index lists.
export function transformationCoordinates(mx, my, theta) {
  const { S, Sinv } = transformationMatrix(theta);
  const cx = [0, 0, mx, mx], cy = [0, my, 0, my];
  const c0 = cx.map((x, i) => fmaInt(x, S[0][1], cy[i])), c1 = cy.map(y => S[1][1] * y);
  const rx = [roundHalfEven(Math.min(...c0)), roundHalfEven(Math.max(...c0))];
  const ry = [roundHalfEven(Math.min(...c1)), roundHalfEven(Math.max(...c1))];
  const old0 = [], old1 = [], new0 = [], new1 = [];
  for (let y = ry[0]; y < ry[1]; y++) {
    const o1 = Sinv[1][1] * y;
    const bad1 = o1 >= my - 1 || o1 < 1;
    for (let x = rx[0]; x < rx[1]; x++) {
      if (bad1) continue;
      const o0 = fmaInt(x, Sinv[0][1], y);
      if (o0 >= mx - 1 || o0 < 1) continue;
      old0.push(roundHalfEven(o0)); old1.push(roundHalfEven(o1)); new0.push(x - rx[0]); new1.push(y);
    }
  }
  return { old0, old1, new0, new1 };
}

// numpy.moveaxis(A, src, dst) for a full permutation of 4 axes (copying).
export function moveaxis(A, src, dst) {
  const perm = [0, 0, 0, 0];
  src.forEach((s, i) => { perm[dst[i]] = s; });
  const shape = perm.map(p => A.shape[p]);
  const st = [A.shape[1] * A.shape[2] * A.shape[3], A.shape[2] * A.shape[3], A.shape[3], 1], ps = perm.map(p => st[p]);
  const out = new Float64Array(A.data.length);
  let o = 0;
  for (let i = 0; i < shape[0]; i++) for (let j = 0; j < shape[1]; j++) for (let k = 0; k < shape[2]; k++) {
    const base = i * ps[0] + j * ps[1] + k * ps[2];
    for (let l = 0; l < shape[3]; l++) out[o++] = A.data[base + l * ps[3]];
  }
  return { shape, data: out };
}

// perform_shear_transform(A, shift_factor, interpolate=False, theta, inputArrayOrder, displayArrayOrder)
export function shearTransform(A, { shiftFactor = 1, theta = 45, inputOrder = [0, 3, 1, 2], displayOrder = [3, 0, 1, 2] } = {}) {
  if (!(theta > 0 && theta < 180)) throw new Error('theta must be between 0 and 180 degrees (exclusive)');
  if (!(Number.isInteger(shiftFactor) && shiftFactor >= 1)) throw new Error('shift factor must be a whole number >= 1');
  const B = moveaxis(A, inputOrder, [0, 1, 2, 3]);
  const [m1, m2, m3, m4] = B.shape, sf = shiftFactor, mx = m1, my = m2 * sf, inner = m3 * m4;
  const { old0, old1, new0, new1 } = transformationCoordinates(mx, my, theta);
  if (!new0.length) throw new Error('The transform keeps no pixels: the volume is too small for these settings');
  let nmx = 0, nmy = 0;
  for (let i = 0; i < new0.length; i++) { if (new0[i] > nmx) nmx = new0[i]; if (new1[i] > nmy) nmy = new1[i]; }
  nmx += 1; nmy += 1;
  const D = new Float64Array(nmx * nmy * inner);
  for (let i = 0; i < new0.length; i++) {
    // np.repeat(A, sf, axis=1): row j of the upsampled plane is row floor(j / sf) of the input
    const src = (old0[i] * m2 + Math.floor(old1[i] / sf)) * inner, dst = (new0[i] * nmy + new1[i]) * inner;
    for (let k = 0; k < inner; k++) D[dst + k] = B.data[src + k];
  }
  return moveaxis({ shape: [nmx, nmy, m3, m4], data: D }, [0, 1, 2, 3], displayOrder);
}

export const ARRAY_ORDERS = (() => {
  const out = [];
  const rec = (pre, rest) => (rest.length ? rest.forEach(r => rec([...pre, r], rest.filter(x => x !== r))) : out.push(pre));
  rec([], [0, 1, 2, 3]);
  return out;
})();
