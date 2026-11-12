// Static-site data layer: answers api() calls from the JSON exported by scripts/build_static.py. Reading TIFFs, the
// viewer and the shear transform all run in the browser anyway; only the Python cross-checks need the local app
// (except the light-sheet demo at its intended settings, whose Python result is exported at build time).
const files = new Map();
async function file(rel) {
  if (!files.has(rel)) files.set(rel, fetch('api/' + rel + '.json').then(r => { if (!r.ok) throw new Error(`${r.status} ${rel}`); return r.json(); }));
  return files.get(rel);
}

export const NEEDS_SERVER = 'needs the full app running locally (Python server): see the README, "Run the web app"';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function staticApi(path, body) {
  const clean = path.split('?')[0].replace(/^\/+/, '');
  if (clean === 'shear/check') {
    const demo = await file('shear/demo');
    const p = demo.params;
    if (body && +body.theta === p.theta && +body.shift_factor === p.shift_factor && same(body.input_order, p.input_order) && same(body.display_order, p.display_order)) return demo;
    throw new Error('The Python check for other settings ' + NEEDS_SERVER + '.');
  }
  if (clean === 'describe') throw new Error('Reading with tifffile ' + NEEDS_SERVER + '.');
  return file(clean);
}
