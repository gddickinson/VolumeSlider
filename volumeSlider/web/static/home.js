// Home page: hero with the synthetic cell demo as an animated max projection, real counts, entry cards.
import { route, api, app, esc, animate } from './core.js';
import { fetchDemo, readBuffer } from './loader.js';
import { composite, displayRanges, draw } from './render.js';

const DOORS = [
  ['#/view?demo=cell', 'Volume viewer', 'Open your own 3D / 4D TIFF: XY, ZY and XZ slices or max projections, a WebGL 3D render, playback through volumes, in physical units.'],
  ['#/deskew', 'Deskew', 'The plugin\'s light-sheet shear transform, ported to JavaScript and checked against the Python voxel for voxel, on a raw scan.'],
  ['#/view?demo=sheet', 'Raw light-sheet scan', 'The synthetic raw scan before deskewing: tilted beads, one page per scan step.'],
  ['#/about', 'About', 'What the flika plugin does, what the web version covers, how to run both, credits.'],
];

route('home', async () => {
  const [info, demos] = await Promise.all([api('/info'), api('/demos')]);
  const cell = demos.find(d => d.id === 'cell');
  app().innerHTML = `
  <section class="hero two">
    <div>
      <p class="kicker">flika plugin · light-sheet volumes · x, y, z, t</p>
      <h1 class="glow">VolumeSlider</h1>
      <p class="lead">${esc(info.overview)}</p>
      <p class="small mute">This site runs the plugin's viewer and shear transform in your browser: open a TIFF, slice it in all three axes, project it,
      deskew it, render it in 3D. Nothing is uploaded.</p>
      <a class="btn" href="#/view?demo=cell">Open the viewer</a><a class="btn alt" href="#/deskew">Deskew a scan</a>
    </div>
    <figure class="fig"><canvas id="hero" role="img" aria-label="Maximum projection along z of the synthetic cell demo, cycling through its volumes"></canvas>
      <figcaption id="hcap">Loading the demo…</figcaption></figure>
  </section>
  <div class="tiles">
    <div class="tile"><b>3</b><span>slice axes (z, y, x) + max projections</span></div>
    <div class="tile"><b>${info.array_orders}</b><span>input / display array orders (as in the plugin)</span></div>
    <div class="tile"><b>${info.demos}</b><span>synthetic demo volumes</span></div>
    <div class="tile"><b>${esc(info.plugin.version)}</b><span>plugin version (info.xml)</span></div>
  </div>
  <div class="grid wide">${DOORS.map(([href, t, d]) => `<a class="card door" href="${href}"><b>${t}</b><span>${d}</span></a>`).join('')}</div>`;
  try {
    const s = await readBuffer(await fetchDemo(cell.file), cell.file), cv = document.getElementById('hero');
    if (!cv) return;
    const ranges = displayRanges(s, 0, 'series', 0.8), k = 520 / (s.size[2] * s.voxel[2]);
    let t = 0, last = 0;
    const frame = () => draw(cv, composite(s, t, 'xy', [0, 0, 0], true, [true], ranges, ['cyan']), s.voxel[2], s.voxel[1], k, { unit: s.unit });
    frame();
    document.getElementById('hcap').textContent = `Synthetic demo (not microscope data): max projection along z, ${s.T} volumes of ${s.size.join(' × ')} voxels, voxel ${s.voxel.join(' × ')} µm (z × y × x)`;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) animate(now => { if (now - last > 700) { last = now; t = (t + 1) % s.T; frame(); } });
  } catch (e) { const c = document.getElementById('hcap'); if (c) c.textContent = e.message; }
});
