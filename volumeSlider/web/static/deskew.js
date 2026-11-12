// Deskew page: the plugin's light-sheet shear transform (shear_engine.js, a voxel-exact port of
// volumeSlider/shear_transform.py) applied in the browser to the raw light-sheet demo or the stack open in the Viewer,
// with the raw and deskewed volumes in the same viewer and a cross-check against the Python transform.
import { route, app, api, esc, onLeave } from './core.js';
import { describeSample, fetchDemo, readBuffer } from './loader.js';
import { mountViewer } from './viewer.js';
import { shearTransform } from './shear_engine.js';
import { pluginArray, sampleFromOutput } from './deskew_volume.js';
import { shared } from './state.js';

const orderText = o => `[${o.join(', ')}]`;

async function sha256(f64) {
  const d = await crypto.subtle.digest('SHA-256', new Uint8Array(f64.buffer, f64.byteOffset, f64.byteLength));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

route('deskew', async (args, query) => {
  const [D, demos] = await Promise.all([api('/shear/defaults'), api('/demos')]);
  const sheet = demos.find(d => d.id === 'sheet');
  const useOpen = query.use === 'open' && shared.buf;
  const opts = (sel, def) => D.array_orders.map(o => `<option value="${o.join(',')}" ${o.join() === def.join() ? 'selected' : ''}>${orderText(o)}</option>`).join('');
  app().innerHTML = `
  <h1 class="glow">Deskew a light-sheet scan</h1>
  <p class="lead">The plugin's shear transform for oblique light-sheet data, run in your browser: each raw frame is one
  scan step, and the transform slides every row of the tilted sheet back to where it belongs in the sample.</p>
  <div class="panel"><p class="eq">new<sub>0</sub> = a<sub>0</sub> + cos θ · a<sub>1</sub> &nbsp; · &nbsp; new<sub>1</sub> = sin θ · a<sub>1</sub></p>
  <p class="small mute">a<sub>0</sub>, a<sub>1</sub> are the first two axes after the input array order (by default: scan
  step and image row), with a<sub>1</sub> first repeated "shift factor" times. Source pixels on the border of that plane
  are dropped, as in the plugin. The result is moved by the display array order and shown as the plugin's 3D viewer
  does: axis 0 = depth (z), axis 1 = volume, axis 2 across (x), axis 3 down (y). Interpolated upsampling is not offered:
  the plugin's 3D viewer always calls the transform with interpolate = False.</p></div>
  <div class="params">
    <div><label for="theta">theta (degrees, light-sheet angle)</label><input id="theta" type="number" min="1" max="179" step="any" value="${D.theta}"></div>
    <div><label for="shift">shift factor (whole number)</label><input id="shift" type="number" min="1" max="16" step="1" value="${D.shift_factor}"></div>
    <div><label for="inord">input array order</label><select id="inord">${opts('in', D.input_order)}</select></div>
    <div><label for="disord">display array order</label><select id="disord">${opts('dis', D.display_order)}</select></div>
  </div>
  <p><button type="button" id="run">Apply shear transform</button>
    <button type="button" class="alt" id="reset">Plugin defaults</button>
    <button type="button" class="alt" id="py" disabled>Check against Python</button>
    <span class="seg" role="group" aria-label="Show"><button type="button" data-show="raw">Raw</button><button type="button" data-show="out" disabled>Deskewed</button></span></p>
  <div id="src"></div>
  <div id="msg" aria-live="polite"></div>
  <div id="viewer"></div>`;
  const $ = s => document.getElementById(s);
  const viewer = mountViewer($('viewer'));
  onLeave(() => viewer.stop());
  let raw = null, out = null, lastE = null, lastP = null;
  const params = () => ({ theta: +$('theta').value, shiftFactor: Math.round(+$('shift').value),
    inputOrder: $('inord').value.split(',').map(Number), displayOrder: $('disord').value.split(',').map(Number) });
  const setOrder = (id, o) => { $(id).value = o.join(','); };

  function showWhich(which) {
    document.querySelectorAll('[data-show]').forEach(b => b.classList.toggle('on', b.dataset.show === which));
    viewer.setSample(which === 'out' ? out : raw);
  }
  document.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => showWhich(b.dataset.show)));

  function run() {
    const p = params();
    $('msg').innerHTML = '<p class="mute">Transforming…</p>';
    setTimeout(() => {
      try {
        const t0 = performance.now();
        const E = shearTransform(pluginArray(raw), p);
        out = sampleFromOutput(E, raw, p);
        out.filename = `${raw.filename}_deskewed`; lastE = E; lastP = p;
        out.info = [['Source', raw.file], ['Transform', out.source], ['Plugin array E', E.shape.join(' × ')]];
        $('msg').innerHTML = `<p class="callout a">Raw ${raw.size.join(' × ')} (z × y × x) × ${raw.T} volumes → deskewed
          ${out.size.join(' × ')} × ${out.T} in ${(performance.now() - t0).toFixed(0)} ms (plugin array E: ${E.shape.join(' × ')}).<br>${esc(out.note)}</p>`;
        $('py').disabled = false; document.querySelector('[data-show="out"]').disabled = false;
        showWhich('out');
      } catch (e) { $('msg').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    }, 20);
  }
  $('run').addEventListener('click', run);
  $('reset').addEventListener('click', () => {
    $('theta').value = D.theta; $('shift').value = D.shift_factor; setOrder('inord', D.input_order); setOrder('disord', D.display_order);
  });
  $('py').addEventListener('click', async () => {
    if (!lastE) return;
    const box = document.createElement('div');
    $('msg').append(box);
    if (raw.file !== sheet.file || /re-split/.test(raw.source)) { box.innerHTML = '<p class="small mute">The Python check runs on the shipped light-sheet demo only.</p>'; return; }
    box.innerHTML = '<p class="mute">Running the Python transform…</p>';
    try {
      const body = { theta: lastP.theta, shift_factor: lastP.shiftFactor, input_order: lastP.inputOrder, display_order: lastP.displayOrder };
      const [r, mine] = await Promise.all([api('/shear/check', { body }), sha256(lastE.data)]);
      const okShape = r.shape.join() === lastE.shape.join(), okHash = r.sha256 === mine;
      box.innerHTML = `<table class="check"><tr><th></th><th>browser (JS)</th><th>plugin (Python / NumPy)</th></tr>
        <tr><td>array shape</td><td>${lastE.shape.join(' × ')}</td><td class="${okShape ? 'ok' : 'bad'}">${r.shape.join(' × ')}</td></tr>
        <tr><td>SHA-256 of the float64 array</td><td>${mine.slice(0, 16)}…</td><td class="${okHash ? 'ok' : 'bad'}">${r.sha256.slice(0, 16)}…</td></tr></table>
        <p class="${okShape && okHash ? 'ok' : 'err'}">${okShape && okHash ? 'Identical, voxel for voxel.' : 'The results differ.'}</p>`;
    } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  });

  try {
    if (useOpen) raw = await readBuffer(shared.buf, shared.name, { slicesPerVolume: shared.slices || 0 });
    else {
      raw = await readBuffer(await fetchDemo(sheet.file), sheet.file);
      $('theta').value = sheet.params.theta; $('shift').value = sheet.params.shift_factor;
    }
  } catch (e) { $('src').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  raw.info = [['File', raw.file], ['Read as', raw.source]];
  const isDemo = raw.file === sheet.file;
  $('src').innerHTML = `<p class="callout">${isDemo ? `<span class="badge">synthetic demo</span>${esc(sheet.about)} The plugin's own default
    shift factor is ${D.shift_factor}; this demo was built for ${sheet.params.shift_factor}.<br>` : ''}${describeSample(raw).map(esc).join('<br>')}
    ${raw.C > 1 ? '<br>Only the first channel is transformed.' : ''}</p>`;
  showWhich('raw');
  if (isDemo) run();
});
