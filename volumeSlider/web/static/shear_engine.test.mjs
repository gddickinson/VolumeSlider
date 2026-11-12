// node volumeSlider/web/static/shear_engine.test.mjs: the JS shear transform gives exactly the arrays the plugin's
// Python (volumeSlider/shear_transform.py) gives, on the fixtures from scripts/make_fixtures.py and on the shipped demo.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ARRAY_ORDERS, fmaInt, moveaxis, roundHalfEven, shearTransform } from './shear_engine.js';
import { readTiff } from './tiff_reader.js';
import { layoutVolume } from './volume_layout.js';
import { pluginArray } from './deskew_volume.js';

const FIX = new URL('../../../tests/fixtures/', import.meta.url);
const { cases, demo } = JSON.parse(readFileSync(new URL('shear_cases.json', FIX)));

// numpy twins
assert.deepEqual([0.5, 1.5, 2.5, -0.5, -1.5, -2.5, 2.4999999999999996, 3.7].map(roundHalfEven), [0, 2, 2, -0, -2, -2, 2, 4]);
assert.equal(fmaInt(3, 0.1, 7), 3.7);
assert.equal(fmaInt(5, -1.0000000000000002, 4), 0.9999999999999991);  // one rounding, not round(5 - round(4 * b))
assert.equal(ARRAY_ORDERS.length, 24);
assert.deepEqual(ARRAY_ORDERS[4], [0, 3, 1, 2]); assert.deepEqual(ARRAY_ORDERS[18], [3, 0, 1, 2]);
{
  const A = { shape: [2, 3, 4, 5], data: Float64Array.from({ length: 120 }, (_, i) => i) };
  const B = moveaxis(A, [0, 3, 1, 2], [0, 1, 2, 3]);
  assert.deepEqual(B.shape, [2, 5, 3, 4]);
  assert.equal(B.data[((1 * 5 + 4) * 3 + 2) * 4 + 3], ((1 * 3 + 2) * 4 + 3) * 5 + 4);
}

for (const c of cases) {
  const A = { shape: c.shape, data: Float64Array.from(c.input) };
  const E = shearTransform(A, { shiftFactor: c.shift_factor, theta: c.theta, inputOrder: c.input_order, displayOrder: c.display_order });
  const tag = `theta ${c.theta}, shift ${c.shift_factor}, orders ${c.input_order}/${c.display_order}`;
  assert.deepEqual(E.shape, c.out_shape, `${tag}: shape`);
  for (let i = 0; i < E.data.length; i++) if (E.data[i] !== c.output[i]) assert.fail(`${tag}: element ${i} ${E.data[i]} != ${c.output[i]}`);
}

// the shipped light-sheet demo, all volumes: byte-identical to NumPy's float64 result
{
  const s = layoutVolume(await readTiff(readFileSync(new URL('demo/synthetic_lightsheet_raw.tif', import.meta.url))));
  const E = shearTransform(pluginArray(s), { shiftFactor: demo.shift_factor, theta: demo.theta });
  assert.deepEqual(E.shape, demo.out_shape);
  const bytes = new Uint8Array(E.data.buffer);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), demo.sha256, 'demo transform hash');
}
assert.throws(() => shearTransform({ shape: [4, 1, 2, 3], data: new Float64Array(24) }, { theta: 0 }), /theta/);
assert.throws(() => shearTransform({ shape: [4, 1, 2, 3], data: new Float64Array(24) }, { shiftFactor: 1.5 }), /shift/);
console.log(`shear_engine: ${cases.length} cases + the demo volume match NumPy exactly`);
