// Entry point: lazy page modules, the mode label, a faint slanted light-sheet background, then the router.
import { $, app, isStatic, lazy, route, start } from './core.js';

const PAGES = { 'home.js': ['home'], 'view.js': ['view'], 'deskew.js': ['deskew'], 'about.js': ['about'] };
lazy(Object.fromEntries(Object.entries(PAGES).flatMap(([file, names]) => names.map(n => [n, () => import('./' + file)]))));
route('notfound', () => { app().innerHTML = '<h1>Not found</h1><p><a href="#/">Back to the start</a></p>'; });

$('#mode').textContent = isStatic()
  ? 'static site: files are read and transformed in your browser'
  : 'local app: in-browser viewer + Python (tifffile, the plugin\'s shear transform) on this computer';

// Background: a tilted sheet of light sweeping slowly across. Static under prefers-reduced-motion.
function background(canvas) {
  if (!canvas) return;
  const g = canvas.getContext('2d'), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fit = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  fit(); addEventListener('resize', () => { fit(); if (still) paint(0.3); });
  function paint(f) {
    const w = canvas.width, h = canvas.height, x = -0.3 * w + f * 1.6 * w;
    g.clearRect(0, 0, w, h);
    const gr = g.createLinearGradient(x - 120, 0, x + 120, 0);
    gr.addColorStop(0, 'rgba(70,200,255,0)'); gr.addColorStop(0.5, 'rgba(70,200,255,.22)'); gr.addColorStop(1, 'rgba(70,200,255,0)');
    g.save(); g.translate(x, h / 2); g.transform(1, 0, -1, 1, 0, 0); g.translate(-x, -h / 2);
    g.fillStyle = gr; g.fillRect(x - 120, 0, 240, h); g.restore();
  }
  if (still) { paint(0.3); return; }
  let last = 0;
  const tick = t => {
    requestAnimationFrame(tick);
    if (document.hidden || t - last < 60) return;
    last = t; paint((t / 40000) % 1);
  };
  requestAnimationFrame(tick);
}
background($('#bg'));
start();
