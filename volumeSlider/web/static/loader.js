// Load a TIFF (a shipped demo or the user's file) into a viewer sample: tiff_reader.js + volume_layout.js.
import { readTiff } from './tiff_reader.js';
import { layoutVolume } from './volume_layout.js';

const MAX_MB = 1024;

export async function readBuffer(buf, name, opts = {}) {
  const t = await readTiff(buf);
  const s = layoutVolume(t, opts);
  s.filename = name.replace(/\.(ome\.)?tiff?$/i, '');
  s.file = name;
  return s;
}

export async function fetchDemo(file) {
  const r = await fetch('static/demo/' + file);
  if (!r.ok) throw new Error(`could not load the demo ${file} (${r.status})`);
  return r.arrayBuffer();
}

export async function fileBuffer(f) {
  if (f.size > MAX_MB * 1024 * 1024) throw new Error(`${f.name} is larger than ${MAX_MB} MB`);
  return f.arrayBuffer();
}

// One line per fact about how the file was read, for the page's notice.
export function describeSample(s) {
  const notes = [`${s.file}: ${s.source}; ${s.pages} pages → ${s.T} volume${s.T > 1 ? 's' : ''} × ${s.C} channel${s.C > 1 ? 's' : ''} × ${s.size.join(' × ')} (z × y × x), ${s.dtype}.`];
  if (s.dropped) notes.push(`${s.dropped} trailing pages did not fill a volume and were left out (as the plugin does).`);
  notes.push(s.scaleKnown ? `Voxel size from the file: ${s.voxel.map(v => +v.toPrecision(4)).join(' × ')} µm (z × y × x).`
    : 'No voxel size in the file: sizes are in pixels (1 px per voxel). Set the real values under "Layout and units".');
  return notes;
}
