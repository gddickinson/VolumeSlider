// About page: the plugin (from README.md / info.xml), what the web version covers and what it leaves out, how to run.
import { route, api, app, esc, list } from './core.js';

const WEB = [
  ['Orthogonal views (XY, XZ, YZ) and slice navigation', 'yes: z / y / x plane sliders, click a view to move the cursor planes'],
  ['Max projection (the 3D viewer\'s top view)', 'yes, along each axis'],
  ['Time / volume slider', 'yes, with playback'],
  ['Slices per volume (re-split a flat stack)', 'yes, the plugin\'s rule: frame = slice + volume × slices'],
  ['Shear transform (theta, shift factor, array orders)', 'yes: ported to JavaScript, identical to the Python result'],
  ['3D volume view', 'yes: raw WebGL2 ray marching (max intensity or translucent), not the plugin\'s scatter / texture plots'],
  ['Baseline subtraction, DF/F0, Gaussian filter, overlays, ROI line profiles', 'no (desktop only)'],
  ['Export to Imaris (.ims), numpy arrays, batch processing', 'no (desktop only); the web version exports PNG views'],
];

route('about', async () => {
  const info = await api('/info');
  app().innerHTML = `
  <h1 class="glow">About VolumeSlider</h1>
  <p class="lead">${esc(info.overview)}</p>
  <h2>The flika plugin</h2>
  <p>${esc(info.plugin.name)} · version ${esc(info.plugin.version)} · by ${esc(info.plugin.author)}. Features listed in the README:</p>
  <ul>${list(info.features, f => `<li><b>${esc(f.name)}</b>: ${esc(f.text)}</li>`)}</ul>
  <h2>What this web version does</h2>
  <div class="scroll"><table><tr><th>Plugin feature</th><th>In the browser</th></tr>${list(WEB, ([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`)}</table></div>
  <h2>Units and conventions</h2>
  <ul>
    <li>Voxel sizes come from the file (ImageJ <code>spacing</code> / <code>unit</code> and X/YResolution, or OME PhysicalSizeX/Y/Z) and
    are shown in µm; a file without them is shown in pixels, and every size can be set by hand.</li>
    <li>Positions are voxel centres: voxel i spans i·d to (i + 1)·d, its position is (i + 0.5)·d.</li>
    <li>Deskewed volumes (default array orders) are in grid units of camera row pixel / shift factor along the two sheared axes and one camera
    pixel across; the transform treats one scan step as one grid unit.</li>
    <li>The demo volumes are synthetic, made by <code>scripts/make_demo.py</code>; no microscope data ships with the repository.</li>
  </ul>
  <h2>Run it</h2>
  <p>The plugin: clone the repository into flika's plugins folder (<code>~/.flika/plugins/volumeSlider</code>) and start flika; it appears under
  Plugins → VolumeSlider. The web app (needs Python 3.10+):</p>
  <pre>pip install -r requirements-web.txt
python run_web.py          # http://127.0.0.1:8233</pre>
  <p>The local app adds two Python cross-checks: reading your TIFF with tifffile, and running the plugin's own shear transform on the demo to
  compare with the browser's result.</p>
  <h2>Credits</h2>
  <p>VolumeSlider by George Dickinson, MIT licence. Built on <a href="https://github.com/flika-org/flika">flika</a>, pyqtgraph, NumPy and
  scikit-image (from the README's acknowledgments). The web version uses no external libraries.</p>`;
});
