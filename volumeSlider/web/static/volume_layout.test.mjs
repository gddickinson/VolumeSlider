// node volumeSlider/web/static/volume_layout.test.mjs: TIFF -> (t, c, z, y, x) + voxel size in the browser matches
// tifffile + web/volume_io.py on the fixtures (ImageJ, OME, plain, big-endian, BigTIFF tiles, LZW, Deflate, re-split).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readTiff } from './tiff_reader.js';
import { layoutVolume } from './volume_layout.js';

const FIX = new URL('../../../tests/fixtures/', import.meta.url);
const expected = JSON.parse(readFileSync(new URL('volumes.json', FIX)));
let n = 0;
for (const [name, e] of Object.entries(expected)) {
  const s = layoutVolume(await readTiff(readFileSync(new URL(name, FIX))), { slicesPerVolume: e.slices_per_volume });
  assert.deepEqual([s.T, s.C, ...s.size], e.shape, `${name}: shape`);
  assert.equal(s.dtype, e.dtype, `${name}: dtype`);
  assert.equal(s.unit, e.unit, `${name}: unit`);
  assert.equal(s.source, e.source, `${name}: source`);
  if (e.voxel === null) assert.deepEqual(s.voxel, [1, 1, 1]);
  else s.voxel.forEach((v, i) => assert.ok(Math.abs(v - e.voxel[i]) <= 1e-12 * e.voxel[i], `${name}: voxel ${s.voxel} vs ${e.voxel}`));
  const plane = s.size.reduce((a, b) => a * b);
  for (let t = 0; t < s.T; t++) for (let c = 0; c < s.C; c++) {
    const v = s.data[t][c], off = (t * s.C + c) * plane;
    for (let i = 0; i < plane; i++) if (v[i] !== Math.fround(e.data[off + i])) assert.fail(`${name}: t ${t} c ${c} voxel ${i}: ${v[i]} != ${e.data[off + i]}`);
  }
  n++;
}
// the two shipped demos
for (const [f, shape, voxel] of [['synthetic_cell.tif', [3, 1, 32, 80, 80], [0.6, 0.3, 0.3]], ['synthetic_lightsheet_raw.tif', [3, 1, 64, 32, 56], [0.2, 0.4, 0.4]]]) {
  const s = layoutVolume(await readTiff(readFileSync(new URL('demo/' + f, import.meta.url))));
  assert.deepEqual([s.T, s.C, ...s.size], shape, f);
  s.voxel.forEach((v, i) => assert.ok(Math.abs(v - voxel[i]) < 1e-9, `${f} voxel`));
}
// too few pages for one volume
await assert.rejects(async () => layoutVolume(await readTiff(readFileSync(new URL('vol_plain_be_u16.tif', FIX))), { slicesPerVolume: 7 }), /fewer than one volume/);
console.log(`volume_layout: ${n} fixtures match tifffile / volume_io.py`);
