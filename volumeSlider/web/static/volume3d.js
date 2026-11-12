// Simple 3D volume render in raw WebGL2 (no library): the colour volume (render.colourVolume) as a 3D texture,
// ray-marched in an orthographic view per pixel, either as a maximum intensity projection (MIP) or translucent
// (front-to-back emission-absorption). The box keeps the physical aspect of the volume (voxel size per axis).
// Drag or use the arrow keys to rotate. Returns null when WebGL2 is not available.

const VS = `#version 300 es
in vec2 aPos; out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 vNdc; out vec4 frag;
uniform sampler3D uVol; uniform mat3 uRot; uniform vec3 uHalf; uniform vec2 uScale; uniform float uGain;
uniform int uSteps; uniform int uMode;
void main() {
  vec3 o = uRot * vec3(vNdc * uScale, -2.0), d = uRot * vec3(0.0, 0.0, 1.0);
  vec3 inv = 1.0 / d, t0 = (-uHalf - o) * inv, t1 = (uHalf - o) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z), tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tf <= tn) { frag = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float dt = (tf - tn) / float(uSteps);
  vec3 acc = vec3(0.0); float alpha = 0.0;
  for (int i = 0; i < 1024; i++) {
    if (i >= uSteps) break;
    vec3 p = o + d * (tn + (float(i) + 0.5) * dt);
    vec3 tc = vec3(p.x / (2.0 * uHalf.x) + 0.5, 0.5 - p.y / (2.0 * uHalf.y), p.z / (2.0 * uHalf.z) + 0.5);
    vec4 s = texture(uVol, tc);
    if (uMode == 0) acc = max(acc, s.rgb);
    else {
      float a = clamp(s.a * uGain * 0.08, 0.0, 1.0);
      acc += (1.0 - alpha) * a * s.rgb / max(s.a, 1e-3); alpha += (1.0 - alpha) * a;
      if (alpha > 0.98) break;
    }
  }
  frag = vec4(uMode == 0 ? acc * uGain : acc, 1.0);
}`;

const LVS = `#version 300 es
in vec3 aPos; uniform mat3 uRotT; uniform vec2 uScale;
void main() { vec3 v = uRotT * aPos; gl_Position = vec4(v.xy / uScale, 0.0, 1.0); }`;
const LFS = `#version 300 es
precision mediump float; out vec4 frag; void main() { frag = vec4(1.0, 1.0, 1.0, 0.35); }`;

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

// Rotation (object <- view): yaw about y, then pitch about x; column-major for uniformMatrix3fv
function rotation(yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  // R = Ry(yaw) * Rx(pitch)
  const R = [[cy, sy * sp, sy * cp], [0, cp, -sp], [-sy, cy * sp, cy * cp]];
  const col = M => [M[0][0], M[1][0], M[2][0], M[0][1], M[1][1], M[2][1], M[0][2], M[1][2], M[2][2]];
  const T = [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]];
  return { R: col(R), RT: col(T) };
}

export function createVolumeView(canvas, { onRotate = () => {} } = {}) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: true });
  if (!gl) return null;
  let prog, lprog;
  try { prog = program(gl, VS, FS); lprog = program(gl, LVS, LFS); } catch (e) { console.warn('volume shader:', e.message); return null; }
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const lines = gl.createBuffer(), tex = gl.createTexture();
  const S = { yaw: 0.6, pitch: -0.45, gain: 1.0, mode: 0, half: [0.5, 0.5, 0.5], steps: 128, ready: false };

  function setVolume(rgba, size, voxel_um) {
    const [nz, ny, nx] = size, ext = [nx * voxel_um[2], ny * voxel_um[1], nz * voxel_um[0]], m = Math.max(...ext);
    S.half = ext.map(e => 0.5 * e / m);
    S.steps = Math.min(1024, Math.ceil(1.8 * Math.max(nx, ny, nz)));
    gl.bindTexture(gl.TEXTURE_3D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, nx, ny, nz, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_3D, k, v);
    const [hx, hy, hz] = S.half, c = [];
    for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) {
      for (const i of [a, b]) c.push(i & 1 ? hx : -hx, i & 2 ? hy : -hy, i & 4 ? hz : -hz);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, lines);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(c), gl.STATIC_DRAW);
    S.ready = true;
    draw();
  }

  function draw() {
    if (!S.ready) return;
    const w = canvas.width, h = canvas.height, sc = 0.95, scale = w >= h ? [sc * w / h, sc] : [sc, sc * h / w];
    const { R, RT } = rotation(S.yaw, S.pitch);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const ap = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, 'uVol'), 0);
    gl.uniformMatrix3fv(gl.getUniformLocation(prog, 'uRot'), false, R);
    gl.uniform3fv(gl.getUniformLocation(prog, 'uHalf'), S.half);
    gl.uniform2fv(gl.getUniformLocation(prog, 'uScale'), scale);
    gl.uniform1f(gl.getUniformLocation(prog, 'uGain'), S.gain);
    gl.uniform1i(gl.getUniformLocation(prog, 'uSteps'), S.steps);
    gl.uniform1i(gl.getUniformLocation(prog, 'uMode'), S.mode);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(ap);
    gl.useProgram(lprog);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, lines);
    const lp = gl.getAttribLocation(lprog, 'aPos');
    gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix3fv(gl.getUniformLocation(lprog, 'uRotT'), false, RT);
    gl.uniform2fv(gl.getUniformLocation(lprog, 'uScale'), scale);
    gl.drawArrays(gl.LINES, 0, 24);
    gl.disableVertexAttribArray(lp); gl.disable(gl.BLEND);
  }

  const turn = (dy, dp) => {
    S.yaw += dy; S.pitch = Math.max(-1.55, Math.min(1.55, S.pitch + dp));
    draw(); onRotate(S);
  };
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    turn((e.clientX - drag[0]) * 0.01, (e.clientY - drag[1]) * 0.01); drag = [e.clientX, e.clientY];
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('keydown', e => {
    const k = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
    if (k) { e.preventDefault(); turn(...k); }
  });
  return {
    setVolume, draw,
    set(opts) { Object.assign(S, opts); draw(); },
    reset() { S.yaw = 0.6; S.pitch = -0.45; draw(); },
    get state() { return { ...S }; },
  };
}
