// 4D viewer (the plugin's 3D viewer docks, in the browser): orthogonal XY / ZY / XZ slices or max projections, a raw
// WebGL2 volume render, z / y / x plane sliders, a volume (time) slider with playback, a cursor readout and PNG export.
// Everything is drawn at physical aspect from the voxel size; positions are voxel centres, (i + 0.5) * voxel.
import { esc, animate, download } from './core.js';
import { CHANNEL_LUTS, LUTS, VIEWS, composite, displayRanges, draw, colourVolume } from './render.js';
import { createVolumeView } from './volume3d.js';

const TARGET_PX = 760;  // internal canvas width of XY + ZY
const FPS = [1, 2, 5, 10];
const fmt = v => +v.toFixed(3);

export function mountViewer(host) {
  host.innerHTML = `
  <div class="toolbar">
    <span class="chans" role="group" aria-label="Channels"></span>
    <label class="inl"><input type="checkbox" class="mip"> Max projection</label>
    <label class="inl">Display range <select class="rng" aria-label="Display range">
      <option value="series">min–max over all volumes</option><option value="frame">min–max of this volume</option></select></label>
    <label class="inl">brightness <input type="range" class="sat" min="0.1" max="1" step="0.05" value="1" aria-label="Brightness: top of the display range"></label>
  </div>
  <div class="views">
    <div class="ortho">
      <figure><canvas data-v="xy" role="img" aria-label="XY view"></canvas><figcaption data-c="xy"></figcaption></figure>
      <figure><canvas data-v="zy" role="img" aria-label="ZY view"></canvas><figcaption data-c="zy"></figcaption></figure>
      <figure><canvas data-v="xz" role="img" aria-label="XZ view"></canvas><figcaption data-c="xz"></figcaption></figure>
    </div>
    <figure class="v3d"><canvas class="c3d" width="520" height="520" tabindex="0" role="img" aria-label="3D volume render: drag or use the arrow keys to rotate"></canvas>
      <figcaption class="cap3d"></figcaption>
      <div class="row3d"><label class="inl">3D <select class="mode3d" aria-label="3D render mode"><option value="0">max intensity</option><option value="1">translucent</option></select></label>
        <label class="inl">gain <input type="range" class="gain" min="0.2" max="4" step="0.1" value="1" aria-label="3D gain"></label>
        <button type="button" class="alt reset3d">Reset view</button></div></figure>
  </div>
  <div class="planes"></div>
  <div class="toolbar exports"><span class="small mute">PNG:</span>
    ${['xy', 'zy', 'xz'].map(v => `<button type="button" class="alt" data-png="${v}">${v.toUpperCase()}</button>`).join('')}
    <button type="button" class="alt" data-png="3d">3D</button></div>
  <div class="readout" aria-live="polite"></div>`;
  const q = s => host.querySelector(s);
  const S = { s: null, pos: [0, 0, 0], t: 0, mip: false, enabled: [], luts: [], ranges: [], rmode: 'series', sat: 1, stop: null, fps: 2, hover: null };
  const vol = createVolumeView(q('.c3d'));
  if (!vol) q('.cap3d').textContent = '3D view needs WebGL2, which this browser does not provide.';

  function setSample(s, { keepView = false } = {}) {
    const same = keepView && S.s && S.s.size.join() === s.size.join();
    S.s = s; S.t = Math.min(S.t, s.T - 1);
    if (!same) S.pos = s.size.map(n => Math.floor(n / 2));
    if (S.enabled.length !== s.C) { S.enabled = s.names.map(() => true); S.luts = s.names.map((_, c) => (s.C === 1 ? 'gray' : CHANNEL_LUTS[c % 4])); }
    if (S.stop && s.T < 2) togglePlay();
    setup(); render();
  }

  function setup() {
    const s = S.s, [nz, , nx] = s.size, [vz, , vx] = s.voxel;
    q('.ortho').style.gridTemplateColumns = `${nx * vx}fr ${nz * vz}fr`;
    q('.chans').innerHTML = s.names.map((n, c) => `<span class="chan"><label class="inl"><input type="checkbox" data-c="${c}" ${S.enabled[c] ? 'checked' : ''}> ${esc(n)}</label>
      <select data-lut="${c}" aria-label="Colour of ${esc(n)}">${Object.keys(LUTS).map(l => `<option ${l === S.luts[c] ? 'selected' : ''}>${l}</option>`).join('')}</select></span>`).join('');
    host.querySelectorAll('.chans input').forEach(i => i.addEventListener('change', () => { S.enabled[+i.dataset.c] = i.checked; render(); }));
    host.querySelectorAll('[data-lut]').forEach(i => i.addEventListener('change', () => { S.luts[+i.dataset.lut] = i.value; render(); }));
    q('.planes').innerHTML = [['z', 0], ['y', 1], ['x', 2]].map(([a, i]) => `<div class="ctl"><label for="pl-${a}">${a} plane <b data-pv="${a}"></b></label>
      <input type="range" id="pl-${a}" data-pl="${i}" min="0" max="${s.size[i] - 1}" value="${S.pos[i]}"></div>`).join('') +
      `<div class="ctl trow"><label for="pl-t">volume <b data-pv="t"></b></label>
        <input type="range" id="pl-t" min="0" max="${s.T - 1}" value="${S.t}" ${s.T < 2 ? 'disabled' : ''}>
        <button type="button" class="alt play" ${s.T < 2 ? 'disabled' : ''}>${S.stop ? 'Pause' : 'Play'}</button>
        <label class="inl">speed <select class="fps" aria-label="Playback speed">${FPS.map(f => `<option value="${f}" ${f === S.fps ? 'selected' : ''}>${f} volumes/s</option>`).join('')}</select></label></div>`;
    host.querySelectorAll('[data-pl]').forEach(el => el.addEventListener('input', e => { S.pos[+el.dataset.pl] = +e.target.value; render(); }));
    q('#pl-t').addEventListener('input', e => { S.t = +e.target.value; render(); });
    q('.play').addEventListener('click', togglePlay);
    q('.fps').addEventListener('change', e => { S.fps = +e.target.value; });
  }

  function togglePlay() {
    const btn = q('.play');
    if (S.stop) { S.stop(); S.stop = null; if (btn) btn.textContent = 'Play'; return; }
    if (btn) btn.textContent = 'Pause';
    let last = 0;
    S.stop = animate(now => {
      if (now - last < 1000 / S.fps) return;
      last = now; S.t = (S.t + 1) % S.s.T; q('#pl-t').value = S.t; render();
    });
  }

  const centre = i => (S.pos[i] + 0.5) * S.s.voxel[i];
  function render() {
    const s = S.s;
    if (!s) return;
    const [nz, ny, nx] = s.size, [vz, vy, vx] = s.voxel, ext = [nz * vz, ny * vy, nx * vx], u = s.unit;
    const k = TARGET_PX / (ext[2] + ext[0]);
    S.ranges = displayRanges(s, S.t, S.rmode, S.sat);
    const views = { xy: [vx, vy, [centre(2), centre(1)]], zy: [vz, vy, [centre(0), centre(1)]], xz: [vx, vz, [centre(2), centre(0)]] };
    for (const [v, [uw, uh, cross]] of Object.entries(views)) {
      const comp = composite(s, S.t, v, S.pos, S.mip, S.enabled, S.ranges, S.luts);
      draw(q(`[data-v="${v}"]`), comp, uw, uh, k, { cross: S.mip ? null : cross, bar: v !== 'zy' || ext[0] > ext[2] / 3, unit: u });
      const ax = VIEWS[v].across, i = { z: 0, y: 1, x: 2 }[ax];
      q(`[data-c="${v}"]`).textContent = S.mip ? `${VIEWS[v].label}: max projection along ${ax}` : `${VIEWS[v].label} at ${ax} = ${S.pos[i]} (${fmt(centre(i))} ${u})`;
    }
    ['z', 'y', 'x'].forEach((a, i) => { q(`[data-pv="${a}"]`).textContent = `${S.pos[i]} / ${s.size[i] - 1} · ${fmt(centre(i))} ${u}`; });
    q('[data-pv="t"]').textContent = `${S.t + 1} / ${s.T}`;
    if (vol) {
      vol.setVolume(colourVolume(s, S.t, S.enabled, S.ranges, S.luts), s.size, s.voxel);
      q('.cap3d').textContent = `3D: ${q('.mode3d').selectedOptions[0].text}, volume ${S.t + 1} · box ${ext.slice().reverse().map(fmt).join(' × ')} ${u} (x × y × z)`;
    }
    readout();
  }

  function readout() {
    const s = S.s, u = s.unit, ext = s.size.map((n, i) => n * s.voxel[i]);
    const rows = [
      ['Volume (z, y, x)', `${s.size.join(' × ')} voxels`], ['Voxel size (z, y, x)', `${s.voxel.map(fmt).join(' × ')} ${u}`],
      ['Extent (z, y, x)', `${ext.map(fmt).join(' × ')} ${u}`], ['Volumes', String(s.T)], ...(s.info || []),
    ];
    const stats = s.names.map((n, c) => `<div><span>${esc(n)} display</span><b>${S.ranges[c].map(v => +v.toPrecision(5)).join(' – ')}</b></div>`).join('');
    let hover = '';
    if (S.hover) {
      const [z, y, x] = S.hover, i = (z * s.size[1] + y) * s.size[2] + x;
      hover = `<h3>Cursor</h3><div><span>voxel (z, y, x)</span><b>${z}, ${y}, ${x}</b></div>
        <div><span>position (${u})</span><b>${[(z + .5) * s.voxel[0], (y + .5) * s.voxel[1], (x + .5) * s.voxel[2]].map(fmt).join(', ')}</b></div>` +
        s.names.map((n, c) => `<div><span>${esc(n)}</span><b>${+s.data[S.t][c][i].toPrecision(6)}</b></div>`).join('');
    }
    q('.readout').innerHTML = rows.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('') + stats + hover;
  }

  // click a slice view to move the other planes there; hover for the readout
  const AXES = { xy: [2, 1], zy: [0, 1], xz: [2, 0] };
  const voxelAt = (e, v) => {
    const r = e.target.getBoundingClientRect(), [ia, ib] = AXES[v], p = [...S.pos];
    p[ia] = Math.max(0, Math.min(S.s.size[ia] - 1, Math.floor((e.clientX - r.left) / r.width * S.s.size[ia])));
    p[ib] = Math.max(0, Math.min(S.s.size[ib] - 1, Math.floor((e.clientY - r.top) / r.height * S.s.size[ib])));
    return p;
  };
  host.querySelectorAll('[data-v]').forEach(cv => {
    const v = cv.dataset.v;
    cv.addEventListener('click', e => {
      if (!S.s) return;
      S.pos = voxelAt(e, v);
      ['z', 'y', 'x'].forEach((a, i) => { q(`#pl-${a}`).value = S.pos[i]; });
      render();
    });
    cv.addEventListener('mousemove', e => { if (S.s) { S.hover = voxelAt(e, v); readout(); } });
  });
  q('.mip').addEventListener('change', e => { S.mip = e.target.checked; render(); });
  q('.rng').addEventListener('change', e => { S.rmode = e.target.value; render(); });
  q('.sat').addEventListener('input', e => { S.sat = +e.target.value; render(); });
  q('.mode3d').addEventListener('change', e => { if (vol) { vol.set({ mode: +e.target.value }); render(); } });
  q('.gain').addEventListener('input', e => vol && vol.set({ gain: +e.target.value }));
  q('.reset3d').addEventListener('click', () => vol && vol.reset());

  const save = (canvas, name) => canvas.toBlob(b => download(name, b), 'image/png');
  host.querySelectorAll('[data-png]').forEach(b => b.addEventListener('click', () => {
    if (!S.s) return;
    const v = b.dataset.png, tag = `${S.s.filename || 'volume'}_v${S.t + 1}${S.mip ? '_mip' : ''}`;
    if (v === '3d') { if (vol) { vol.draw(); save(q('.c3d'), `${tag}_3d.png`); } return; }
    save(q(`[data-v="${v}"]`), `${tag}_${v}.png`);
  }));

  return {
    setSample, render,
    setMip(on) { S.mip = on; q('.mip').checked = on; render(); },
    stop() { if (S.stop) { S.stop(); S.stop = null; } },
    get state() { return S; },
  };
}
