/**
 * sakura-qr-tree.js — voxel QR code <-> cherry-blossom tree (Three.js, ES module)
 *
 *   import { createSakuraQR } from './sakura-qr-tree.js';
 *   const app = createSakuraQR(document.getElementById('root'), { url: 'https://example.com' });
 *
 * Requires: `three` (import map) and a QR encoder (global `qrcode` from qrcode-generator,
 * or pass options.encode(text) => boolean[][]).
 */
import * as THREE from 'three';

/* ───────────────────────── palettes ───────────────────────── */
export const PALETTES = {
  pink:   { swatch: '#f4a3b7', base: '#f6a9bb', light: '#fff1ef', dark: '#ec88a3', qr: '#d92d5f' },
  purple: { swatch: '#b79cf2', base: '#b79cee', light: '#f1e9ff', dark: '#9370d6', qr: '#7a3fd1' },
  red:    { swatch: '#e8465f', base: '#e8546b', light: '#ffc6cd', dark: '#c3304a', qr: '#c61f3c' },
  amber:  { swatch: '#f6b43f', base: '#f7b955', light: '#ffeec8', dark: '#e0952a', qr: '#d9860f' },
  blue:   { swatch: '#4a93e0', base: '#9cc6f4', light: '#edf6ff', dark: '#6ea4de', qr: '#1f66c8' },
  white:  { swatch: '#f6efee', base: '#f4ecea', light: '#ffffff', dark: '#d9cbcc', qr: '#6c5b60' },
};
const BARK = { dark: '#5a3626', base: '#7b4f38', light: '#a06e50' };
const CREAM = '#f6ece6', PIT = '#bfaca6';

/* ───────────────────────── small helpers ───────────────────────── */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c = 1.9; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function hash3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const h = (a, b, c) => hash3(xi + a, yi + b, zi + c);
  return lerp(
    lerp(lerp(h(0, 0, 0), h(1, 0, 0), u), lerp(h(0, 1, 0), h(1, 1, 0), u), v),
    lerp(lerp(h(0, 0, 1), h(1, 0, 1), u), lerp(h(0, 1, 1), h(1, 1, 1), u), v), w);
}
const fbm = (x, y, z) => noise3(x, y, z) * 0.6 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.1;

/* ───────────────────────── QR encoding ───────────────────────── */
function defaultEncode(text) {
  const qr = globalThis.qrcode;
  if (!qr) throw new Error('sakura-qr-tree: load qrcode-generator (global `qrcode`) or pass options.encode');
  const q = qr(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}

/* ───────────────────────── procedural voxel tree ─────────────────────────
 * Units are "plate cells" (1 QR module = 1 unit). Plate top is y = 0.
 * Returns flat arrays: pos(xyz), size, tone(0..1), kind(1 bark, 2 leaf, 3 bush), order(0..1 growth order)
 */
export function buildTree(seed = 7) {
  const rand = rng(seed * 9973 + 13);
  const V = 0.6;
  const cells = new Map();
  const key = (i, j, k) => (i + 200) + (j + 20) * 400 + (k + 200) * 40000;
  const set = (i, j, k, kind) => { const kk = key(i, j, k); const o = cells.get(kk); if (o && o.kind === 1 && kind === 2) return; cells.set(kk, { i, j, k, kind }); };
  const sd = seed * 17.3;
  function stamp(cx, cy, cz, rx, ry, rz, kind, amp = 0) {
    const m = 1 + amp;
    for (let i = Math.floor((cx - rx * m) / V); i <= Math.ceil((cx + rx * m) / V); i++)
      for (let j = Math.max(0, Math.floor((cy - ry * m) / V)); j <= Math.ceil((cy + ry * m) / V); j++)
        for (let k = Math.floor((cz - rz * m) / V); k <= Math.ceil((cz + rz * m) / V); k++) {
          const x = (i + 0.5) * V, y = (j + 0.5) * V, z = (k + 0.5) * V;
          const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
          const lim = 1 + (amp ? (fbm(x * 0.22 + sd, y * 0.22, z * 0.22) - 0.5) * 2 * amp : 0);
          if (dx * dx + dy * dy + dz * dz < lim * lim) set(i, j, k, kind);
        }
  }
  const trunkAt = (t) => ({ x: 1.7 * Math.sin(t * 4 + 0.6) * t, y: t * 15, z: 1.3 * Math.cos(t * 3.3 + 0.4) * t, r: Math.max(1.7, 3.5 - 1.8 * t) });
  // trunk
  for (let t = 0; t <= 1.0001; t += 0.012) {
    const p = trunkAt(t); const r = p.r * (1 + (noise3(t * 7 + sd, 1, 2) - 0.5) * 0.25);
    stamp(p.x, p.y, p.z, r, r * 1.05, r, 1);
  }
  // roots
  const nRoots = 6;
  for (let n = 0; n < nRoots; n++) {
    const a = (n / nRoots) * Math.PI * 2 + rand() * 0.7, len = 6 + rand() * 3.5, curl = (rand() - 0.5) * 1.2;
    for (let s = 0; s <= 1; s += 0.03) {
      const h = 1.2 + s * len, ang = a + curl * s;
      const y = 4.2 * Math.pow(1 - s, 2.2) + 0.5, r = 1.6 * (1 - s) + 0.6;
      stamp(Math.cos(ang) * h, y, Math.sin(ang) * h, r, r * 0.85, r, 1);
    }
  }
  // branches + canopy blobs
  const blobs = [];
  const nBr = 6;
  for (let n = 0; n < nBr; n++) {
    const tb = 0.5 + 0.35 * (n / (nBr - 1)) + (rand() - 0.5) * 0.06, a = n * 2.4 + rand() * 0.8;
    const p0 = trunkAt(tb), reach = 6 + rand() * 4.5, rise = 5 + rand() * 4;
    let end = null;
    for (let s = 0; s <= 1; s += 0.03) {
      const hh = s * reach, x = p0.x + Math.cos(a) * hh, z = p0.z + Math.sin(a) * hh, y = p0.y + rise * Math.pow(s, 0.8) + Math.sin(s * 3) * 0.7;
      const r = 1.5 * (1 - s) + 0.6; stamp(x, y, z, r, r, r, 1); end = { x, y, z };
    }
    blobs.push({ ...end, y: end.y + 3.2, r: 4.3 + rand() * 1.3 });
  }
  const top = trunkAt(1);
  blobs.push({ x: top.x, y: 22.5, z: top.z, r: 7 });
  blobs.push({ x: top.x + 0.8, y: 26.5, z: top.z - 0.8, r: 4.8 });
  for (let n = 0; n < 7; n++) { const a = n * 0.9 + rand(); const d = 5.5 + rand() * 3.5; blobs.push({ x: top.x + Math.cos(a) * d, y: 18.5 + rand() * 5, z: top.z + Math.sin(a) * d, r: 4.2 + rand() * 1.3 }); }
  // each blob = cluster of small lumps ("cauliflower" look)
  for (const b of blobs) {
    const lumps = 18 + ((b.r * 3) | 0);
    for (let q = 0; q < lumps; q++) {
      const u = rand() * 2 - 1, th = rand() * Math.PI * 2, rr = Math.sqrt(1 - u * u), f = 0.35 + rand() * 0.7;
      const lr = 1.2 + rand() * 1.5;
      stamp(b.x + rr * Math.cos(th) * b.r * f, b.y + u * b.r * f * 0.8, b.z + rr * Math.sin(th) * b.r * f, lr, lr * 0.9, lr, 2, 0.45);
    }
  }

  // ragged outline: sprinkle single voxels around the canopy surface
  const D6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]];
  for (const c of [...cells.values()]) if (c.kind === 2 && rand() < 0.06) { const d = D6[(rand() * 5) | 0]; if (!cells.has(key(c.i + d[0], c.j + d[1], c.k + d[2]))) set(c.i + d[0], c.j + d[1], c.k + d[2], 2); }
  // surface-only voxels
  const pos = [], size = [], tone = [], kind = [], order = [];
  const has = (i, j, k) => cells.has(key(i, j, k));
  const cc = { x: top.x, y: 22, z: top.z };
  for (const c of cells.values()) {
    if (c.j > 0 && has(c.i + 1, c.j, c.k) && has(c.i - 1, c.j, c.k) && has(c.i, c.j + 1, c.k) && has(c.i, c.j - 1, c.k) && has(c.i, c.j, c.k + 1) && has(c.i, c.j, c.k - 1)) continue;
    const x = (c.i + 0.5) * V, y = (c.j + 0.5) * V, z = (c.k + 0.5) * V;
    let t, o;
    if (c.kind === 1) {
      t = clamp(fbm(x * 0.35 + sd, y * 0.35, z * 0.35) * 1.25 - 0.1 + (rand() - 0.5) * 0.25 - y * 0.012);
      o = clamp(y / 14) * 0.3;
    } else {
      const n = fbm(x * 0.15 + 7 + sd, y * 0.15, z * 0.15) + (y - 21) * 0.012 + (rand() - 0.5) * 0.28;
      t = smooth(0.3, 0.7, n); t = 0.34 + t * 0.66;
      o = 0.3 + clamp(Math.hypot(x - cc.x, (y - cc.y) * 1.2, z - cc.z) / 15) * 0.62 + rand() * 0.08;
    }
    pos.push(x, y, z); size.push(V * 1.02); tone.push(t); kind.push(c.kind); order.push(o);
  }
  // little flower bushes on the plate
  const bushes = [[-9.5, -7.5], [9.5, -8.5], [-5.5, 10.5]];
  for (const [bx, bz] of bushes) {
    for (let s = 0; s < 16; s++) {
      const a = rand() * Math.PI * 2, d = rand() * 1.7, lean = 0.12 + rand() * 0.28, hgt = 1.6 + rand() * 2.4;
      for (let h = 0.25; h < hgt; h += 0.36) {
        pos.push(bx + Math.cos(a) * (d + h * lean), h + 0.2, bz + Math.sin(a) * (d + h * lean));
        size.push(0.4); tone.push(clamp(h / hgt * 0.9 + rand() * 0.2 - 0.1)); kind.push(3); order.push(0.85 + rand() * 0.15);
      }
    }
  }
  return { n: kind.length, pos: Float32Array.from(pos), size: Float32Array.from(size), tone: Float32Array.from(tone), kind: Uint8Array.from(kind), order: Float32Array.from(order) };
}

/* ───────────────────────── UI (DOM) ───────────────────────── */
const ICON = {
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  flower: '<circle cx="12" cy="12" r="2"/><path d="M12 10c-2-1-3-3-2-5s4-2 4 0-1 4-2 5zM14 12c1-2 3-3 5-2s2 4 0 4-4-1-5-2zM13 14c2 1 3 3 2 5s-4 2-4 0 1-4 2-5zM11 13c-1 2-3 3-5 2s-2-4 0-4 4 1 5 2z"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8a2.5 2.5 0 1 1-2.5 2.5"/>',
  mute: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9l5 6M21 9l-5 6"/>',
  sound: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  tap: '<path d="M9 11V5a1.5 1.5 0 0 1 3 0v6l4.5 1a2 2 0 0 1 1.5 2l-.5 4.5a2 2 0 0 1-2 1.5h-4a2 2 0 0 1-1.6-.8L7 15.5"/><path d="M5 5L3.5 3.5M12 2.5V1M5.5 9H3" opacity=".7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dusk: '<path d="M6 17a6 6 0 0 1 12 0M12 5v2M4.9 9.9l1.4 1.4M19.1 9.9l-1.4 1.4M2 17h20M5 21h14"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  download: '<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
const svg = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const CSS = `
.sqt{--ink:#7d5563;--soft:#a8858d;--accent:#c4566f;--pill:rgba(255,236,236,.72);--fa:#fffdfc;--fb:#fbf1ee;--seg:rgba(255,246,243,.55);--on:#fffaf8;--div:rgba(150,100,110,.18);--ba:#cf6b83;--bb:#b84f69;--toast:#7d4455;--shadow:rgba(176,110,110,.14);
 position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:420px;overflow:hidden;isolation:isolate;color:var(--ink);font-family:Nunito,ui-rounded,"SF Pro Rounded",system-ui,sans-serif;transition:color .6s}
.sqt[data-theme=dusk]{--ink:#7a4658;--soft:#a77a86;--accent:#b8456a;--pill:rgba(255,232,220,.6);--fa:#fff7f1;--fb:#fbe7dd;--seg:rgba(255,238,228,.5);--on:#fff4ee;--div:rgba(130,70,90,.2);--ba:#cc5f7d;--bb:#a8426a;--toast:#6d3550;--shadow:rgba(150,80,90,.18)}
.sqt[data-theme=night]{--ink:#ddd6f6;--soft:#8f88b8;--accent:#f4a3c0;--pill:rgba(44,34,92,.62);--fa:#2e2756;--fb:#251f49;--seg:rgba(40,32,84,.6);--on:#3c3472;--div:rgba(190,180,255,.18);--ba:#dc6e9b;--bb:#a8447a;--toast:#463b86;--shadow:rgba(0,0,0,.35)}
.sqt *{box-sizing:border-box}
.sqt-bg{position:absolute;inset:0;z-index:-1;opacity:0;transition:opacity 1s}
.sqt-bg.on{opacity:1}
.sqt-bg.day{background:radial-gradient(120% 80% at 50% 25%,#fbf1ed 0%,#f8e8e3 55%,#f4dfda 100%)}
.sqt-bg.dusk{background:radial-gradient(55% 38% at 50% 30%,rgba(255,240,205,.8),transparent 72%),linear-gradient(180deg,#ffd8c2 0%,#f8b6ae 40%,#d68ca2 74%,#b3769b 100%)}
.sqt-bg.night{background:radial-gradient(50% 36% at 50% 32%,rgba(150,120,255,.22),transparent 70%),linear-gradient(180deg,#110d2a 0%,#221949 55%,#392664 100%)}
.sqt-stars{position:absolute;inset:0;animation:sqt-tw 4.5s ease-in-out infinite alternate}
@keyframes sqt-tw{from{opacity:.55}to{opacity:1}}
@keyframes sqt-tap{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.sqt-stage{position:relative;flex:1;min-height:0}
.sqt-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:pan-y;outline:none}
.sqt-stage canvas.drag{cursor:grabbing}
.sqt button:focus-visible,.sqt canvas:focus-visible,.sqt-sw button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.sqt-url:focus-within{box-shadow:0 0 0 2px var(--accent),0 4px 16px var(--shadow)}
.sqt-hint{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;padding:8px 18px;border-radius:999px;font-size:13px;font-weight:600;color:var(--accent);
 background:var(--pill);box-shadow:0 2px 14px var(--shadow);backdrop-filter:blur(6px);pointer-events:none;transition:opacity .25s;white-space:nowrap}
.sqt-hint .ic{display:flex;animation:sqt-tap 1.8s ease-in-out infinite}
.sqt-cap{position:absolute;left:50%;top:10px;transform:translate(-50%,-10px);display:flex;align-items:center;gap:8px;max-width:calc(100% - 32px);padding:7px 14px;border-radius:999px;font-size:13px;font-weight:700;color:var(--accent);
 background:var(--pill);box-shadow:0 2px 14px var(--shadow);backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .35s,transform .35s}
.sqt-cap.show{opacity:1;transform:translate(-50%,0)}
.sqt-cap.show a{pointer-events:auto}
.sqt-cap a,.sqt-cap span{color:inherit;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;gap:7px;align-items:center}
.sqt-cap a:hover{text-decoration:underline}
.sqt-ui{display:flex;flex-direction:column;align-items:center;gap:18px;padding:14px 16px 26px}
.sqt-row{display:flex;gap:12px;width:min(100%,600px)}
.sqt-url{flex:1;min-width:0;display:flex;align-items:center;gap:12px;height:54px;padding:0 20px;border-radius:999px;background:linear-gradient(var(--fa),var(--fb));box-shadow:0 4px 16px var(--shadow),inset 0 0 0 1px rgba(255,255,255,.12);color:var(--soft);transition:box-shadow .2s}
.sqt-url.bad{box-shadow:0 0 0 2px #e5576f,0 4px 16px var(--shadow)}
.sqt-url input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:16px;color:var(--ink)}
.sqt-url input::placeholder{color:var(--soft)}
.sqt-share,.sqt-icon{display:flex;align-items:center;justify-content:center;gap:9px;height:54px;border-radius:999px;border:0;cursor:pointer;font:inherit;transition:transform .15s}
.sqt-share{padding:0 26px;font-weight:700;font-size:16px;color:#fff;background:linear-gradient(var(--ba),var(--bb));box-shadow:0 8px 20px rgba(184,79,105,.3),inset 0 1px 0 rgba(255,255,255,.35)}
.sqt-icon{width:54px;flex:none;color:var(--ink);background:linear-gradient(var(--fa),var(--fb));box-shadow:0 4px 16px var(--shadow)}
.sqt-share:active,.sqt-icon:active{transform:scale(.96)}
.sqt-modes{display:flex;align-items:center;padding:5px;border-radius:999px;background:var(--seg);box-shadow:inset 0 0 0 1px var(--div)}
.sqt-modes button{display:flex;align-items:center;gap:8px;height:42px;padding:0 18px;border:0;border-radius:999px;background:transparent;cursor:pointer;font:inherit;font-weight:600;font-size:15px;color:var(--ink);position:relative;transition:background .2s}
.sqt-modes button+button::before{content:"";position:absolute;left:0;top:11px;bottom:11px;width:1px;background:var(--div)}
.sqt-modes button.on{background:var(--on);box-shadow:0 2px 10px var(--shadow)}
.sqt-modes button.on::before,.sqt-modes button.on+button::before{opacity:0}
.sqt-sw{display:flex;gap:11px;height:18px;align-items:center;transition:opacity .25s,transform .25s}
.sqt-sw.hide{opacity:0;transform:translateY(-6px);pointer-events:none}
.sqt-sw button{width:15px;height:15px;padding:0;border:0;border-radius:50%;cursor:pointer;display:block;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);transition:transform .15s}
.sqt-sw button.on{transform:scale(1.28);box-shadow:0 0 0 2px var(--on),0 0 0 3.5px currentColor}
.sqt-toast{position:absolute;left:50%;top:14px;z-index:3;transform:translate(-50%,-30px);padding:9px 18px;border-radius:999px;background:var(--toast);color:#fff;font-size:14px;opacity:0;transition:.3s;pointer-events:none}
.sqt-toast.show{opacity:1;transform:translate(-50%,0)}
@media (max-width:520px){.sqt-ui{gap:13px;padding:10px 14px 18px}.sqt-row{flex-wrap:wrap;gap:10px}.sqt-url{flex:1 1 100%;height:48px}.sqt-share{flex:1;height:48px}.sqt-icon{width:48px;height:48px}
 .sqt-modes button{padding:0 11px;height:38px;font-size:14px}.sqt-hint{font-size:12px;padding:7px 14px}}
@media (max-width:440px){.sqt-modes button:not([data-snd]):not([data-th]) svg{display:none}}
@media (prefers-reduced-motion:reduce){.sqt *,.sqt-hint .ic,.sqt-stars{animation:none!important;transition-duration:.01s!important}}
`;

/* ───────────────────────── audio (optional) ───────────────────────── */
function makeAudio() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  const ctx = new AC(), master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.5;
  const wg = ctx.createGain(); wg.gain.value = 0.05;
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.18; lg.gain.value = 0.035; lfo.connect(lg).connect(wg.gain);
  src.connect(bp).connect(wg).connect(master); src.start(); lfo.start();
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  return {
    setOn(on) { ctx.resume(); master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.15); },
    wind(a) { wg.gain.setTargetAtTime(0.05 * a, ctx.currentTime, 0.4); },
    chime(n = 3) {
      for (let i = 0; i < n; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + i * 0.09;
        o.type = 'sine'; o.frequency.value = scale[(Math.random() * scale.length) | 0];
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.08, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
        o.connect(g).connect(master); o.start(t0); o.stop(t0 + 1.5);
      }
    },
    close() { try { ctx.close(); } catch (e) { /* noop */ } },
  };
}

/* ───────────────────────── scene themes ───────────────────────── */
const THEMES = {
  day:   { hemiSky: '#fff3f0', hemiGround: '#e8cbc6', hemiI: 1.6,  sun: '#ffffff', sunI: 1.6, sunPos: [34, 58, 30],  shadow: '#8c5058', shadowO: 0.16, cream: '#f6ece6', pit: '#bfaca6', slab: '#dcc9c2', glow: 0 },
  dusk:  { hemiSky: '#ffd6c2', hemiGround: '#b98aa0', hemiI: 1.35, sun: '#ffb487', sunI: 2.1, sunPos: [54, 24, 22],  shadow: '#5e2c4a', shadowO: 0.27, cream: '#f1d6cc', pit: '#a38790', slab: '#c9a8a6', glow: 0.08 },
  night: { hemiSky: '#8fa0ff', hemiGround: '#3b2d63', hemiI: 1.3, sun: '#c4cdff', sunI: 1.3, sunPos: [-30, 58, 34], shadow: '#05030f', shadowO: 0.4, cream: '#e2def5', pit: '#6a6390', slab: '#8a84ad', glow: 0.4 },
};
const THEME_ORDER = ['day', 'dusk', 'night'], THEME_ICON = { day: 'sun', dusk: 'dusk', night: 'moon' };
const TCOL = ['hemiSky', 'hemiGround', 'sun', 'shadow', 'cream', 'pit', 'slab'], TNUM = ['hemiI', 'sunI', 'shadowO', 'glow'];
const mkTheme = (t) => { const r = { sunPos: new THREE.Vector3(...t.sunPos) }; for (const k of TCOL) r[k] = new THREE.Color(t[k]); for (const k of TNUM) r[k] = t[k]; return r; };
const cloneTheme = (t) => { const r = { sunPos: t.sunPos.clone() }; for (const k of TCOL) r[k] = t[k].clone(); for (const k of TNUM) r[k] = t[k]; return r; };
const autoTheme = () => { const h = new Date().getHours(); return h >= 6 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'dusk' : 'night'; };

/* ───────────────────────── url helpers ───────────────────────── */
function normalizeUrl(u) { return /^[a-z][a-z0-9+.-]*:/i.test(u) || !/^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(u) ? u : 'https://' + u; }
function httpUrl(u) { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x : null; } catch (e) { return null; } }

/* ───────────────────────── main factory ───────────────────────── */
const DEFAULTS = {
  url: 'https://yoursite.com', color: 'pink', mode: 'spring', state: 'tree', theme: 'day', ui: true, sound: false, seed: 7, petals: 460, duration: 1.7,
  intro: false, adaptive: true, caption: true, encode: null, onToggle: null, onShare: null, onChange: null, placeholder: 'https://yoursite.com',
};

export function createSakuraQR(container, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const encode = o.encode || defaultEncode;
  const TXT = { tree: 'Tap the tree to see QR code', qr: 'Tap to see the tree' };
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const dur = reduce ? 0.6 : o.duration;
  const timers = []; const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  let ready = false;

  /* DOM (user-provided strings are only ever assigned via DOM properties, never interpolated into HTML) */
  if (!document.getElementById('sqt-css')) { const st = document.createElement('style'); st.id = 'sqt-css'; st.textContent = CSS; document.head.appendChild(st); }
  const root = document.createElement('div'); root.className = 'sqt';
  root.innerHTML = `<div class="sqt-bg day"></div><div class="sqt-bg dusk"></div><div class="sqt-bg night"><div class="sqt-stars"></div></div>
    <div class="sqt-stage"><canvas tabindex="0" role="button" aria-label="Sakura QR code. Press Enter to switch between the tree and the QR code, arrow keys to rotate."></canvas>
      <div class="sqt-cap"></div><div class="sqt-hint" aria-live="polite"><span class="ic">${svg('tap', 16)}</span><span class="tx"></span></div></div>` +
    (o.ui ? `<div class="sqt-ui"><div class="sqt-row"><label class="sqt-url">${svg('link')}<input type="text" inputmode="url" aria-label="Link to encode" autocomplete="off" spellcheck="false"></label>
      <button class="sqt-share" type="button">${svg('share')}<span>Share</span></button>
      <button class="sqt-icon" type="button" data-dl aria-label="Save QR code as PNG" title="Save as PNG">${svg('download')}</button></div>
      <div class="sqt-modes" role="group" aria-label="Scene"><button type="button" data-m="spring">${svg('flower')}<span>Spring</span></button><button type="button" data-m="bloom">${svg('flower')}<span>Bloom</span></button><button type="button" data-m="breeze">${svg('wind')}<span>Breeze</span></button>
        <button type="button" data-th aria-label="Change time of day" title="Time of day">${svg('sun')}</button><button type="button" data-snd aria-label="Sound" aria-pressed="false">${svg('mute')}</button></div>
      <div class="sqt-sw hide" role="radiogroup" aria-label="Blossom colour">${Object.entries(PALETTES).map(([k, p]) => `<button type="button" role="radio" aria-checked="false" aria-label="${k}" data-c="${k}" style="background:${p.swatch};color:${p.swatch}"></button>`).join('')}</div></div><div class="sqt-toast" role="status"></div>` : '');
  container.appendChild(root);
  const stage = root.querySelector('.sqt-stage'), canvas = root.querySelector('canvas'), hint = root.querySelector('.sqt-hint'), hintTx = hint.querySelector('.tx'), cap = root.querySelector('.sqt-cap');
  const $ = (q) => root.querySelector(q), $$ = (q) => [...root.querySelectorAll(q)];
  const inp = $('.sqt-url input'); if (inp) { inp.placeholder = o.placeholder; inp.value = o.url === o.placeholder ? '' : o.url; }
  { const r = rng(11), dots = []; for (let i = 0; i < 46; i++) dots.push(`radial-gradient(${(r() * 1.2 + 0.7).toFixed(1)}px ${(r() * 1.2 + 0.7).toFixed(1)}px at ${(r() * 100).toFixed(1)}% ${(r() * 78).toFixed(1)}%,rgba(255,255,255,${(0.5 + r() * 0.5).toFixed(2)}),transparent)`); $('.sqt-stars').style.background = dots.join(','); }
  const toast = (t) => { const el = $('.sqt-toast'); if (!el) return; el.textContent = t; el.classList.add('show'); later(() => el.classList.remove('show'), 2000); };

  /* renderer / scene */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!o.preserveDrawingBuffer });
  const dprMax = Math.min(window.devicePixelRatio || 1, 2); renderer.setPixelRatio(dprMax);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; // static scene -> re-render shadows only when something moved
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 600);
  const hemi = new THREE.HemisphereLight(0xfff3f0, 0xe8cbc6, 1.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(34, 58, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 10, far: 160 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.35; sun.shadow.radius = 5; scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ color: 0x8c5058, opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1.02; floor.receiveShadow = true; scene.add(floor);
  let shadowDirty = true;

  /* uniforms for sway */
  const U = { time: { value: 0 }, sway: { value: 0.35 } };
  const swayMat = (m) => { m.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.time; sh.uniforms.uSway = U.sway; sh.vertexShader = 'uniform float uTime;uniform float uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz; float hh=clamp((ip.y-5.)/24.,0.,1.); hh*=hh;
      transformed.x+=(sin(uTime*1.1+ip.z*.15+ip.y*.1)+.5*sin(uTime*2.3+ip.x*.2))*uSway*hh;
      transformed.z+=cos(uTime*.9+ip.x*.13)*uSway*hh*.6;`); }; return m; };
  const box = new THREE.BoxGeometry(1, 1, 1);

  /* ── theme (day / dusk / night) ── */
  const TH = Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, mkTheme(v)]));
  const cur = mkTheme(THEMES.day); let thFrom = TH.day, thTo = TH.day, thK = 1, themeName = 'day';
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xdcc9c2, roughness: 0.9 });
  const cCream = new THREE.Color(CREAM), cPit = new THREE.Color(PIT), cWhite = new THREE.Color(1, 1, 1);
  function mixTheme(k) {
    for (const c of TCOL) cur[c].copy(thFrom[c]).lerp(thTo[c], k);
    cur.sunPos.copy(thFrom.sunPos).lerp(thTo.sunPos, k); for (const n of TNUM) cur[n] = lerp(thFrom[n], thTo[n], k);
  }
  function applyTheme() {
    hemi.color.copy(cur.hemiSky); hemi.groundColor.copy(cur.hemiGround); hemi.intensity = cur.hemiI;
    sun.color.copy(cur.sun); sun.intensity = cur.sunI; sun.position.copy(cur.sunPos);
    floor.material.color.copy(cur.shadow); floor.material.opacity = cur.shadowO; slabMat.color.copy(cur.slab);
    cCream.copy(cur.cream); cPit.copy(cur.pit); treeMat.emissiveIntensity = cur.glow * 0.3;
    plateDirty = true; shadowDirty = true; recolorPetals();
  }
  function setTheme(name, instant) {
    const n = name === 'auto' ? autoTheme() : (TH[name] ? name : 'day'); themeName = n;
    thFrom = cloneTheme(cur); thTo = TH[n]; thK = instant ? 1 : 0; if (instant) { mixTheme(1); applyTheme(); }
    root.dataset.theme = n; $$('.sqt-bg').forEach((b) => b.classList.toggle('on', b.classList.contains(n)));
    const tb = $('[data-th]'); if (tb) tb.innerHTML = svg(THEME_ICON[n]);
    if (ready) o.onChange && o.onChange({ theme: n });
  }

  /* ── plate (QR columns) ── */
  let matrix, N, G, plate, slab, modOrder, modRand, isDark;
  const plateMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const cTmp = new THREE.Color();
  const mkPal = () => ({ base: new THREE.Color(), light: new THREE.Color(), dark: new THREE.Color(), qr: new THREE.Color() });
  const pal = mkPal(), palFrom = mkPal(), palTo = mkPal();
  let palK = 1, colorName = o.color;
  function setPalTarget(name, instant) {
    const p = PALETTES[name] || PALETTES.pink; colorName = PALETTES[name] ? name : 'pink';
    for (const k of Object.keys(pal)) { palFrom[k].copy(pal[k]); palTo[k].set(p[k]); }
    palK = instant ? 1 : 0; if (instant) for (const k of Object.keys(pal)) pal[k].copy(palTo[k]);
    $$('.sqt-sw button').forEach((b) => { const on = b.dataset.c === colorName; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  }
  function buildPlate(mat) {
    matrix = mat; N = matrix.length; G = N + 2;
    if (plate) { scene.remove(plate, slab); plate.dispose(); slab.geometry.dispose(); }
    plate = new THREE.InstancedMesh(box, plateMat, G * G); plate.castShadow = plate.receiveShadow = true; plate.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    plate.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(G * G * 3), 3);
    slab = new THREE.Mesh(new THREE.BoxGeometry(G + 0.15, 0.7, G + 0.15), slabMat); slab.position.y = -0.7; slab.receiveShadow = true;
    scene.add(plate, slab);
    isDark = new Uint8Array(G * G); modOrder = new Float32Array(G * G); modRand = new Float32Array(G * G);
    const r = rng(o.seed + 5), c0 = (G - 1) / 2, maxD = Math.hypot(c0, c0);
    for (let row = 0; row < G; row++) for (let col = 0; col < G; col++) {
      const i = row * G + col; isDark[i] = row > 0 && col > 0 && row <= N && col <= N && matrix[row - 1][col - 1] ? 1 : 0;
      modOrder[i] = Math.hypot(row - c0, col - c0) / maxD; modRand[i] = r();
    }
    plateDirty = true;
  }
  const dummy = new THREE.Object3D();
  function updatePlate(m) {
    const c0 = (G - 1) / 2;
    for (let row = 0; row < G; row++) for (let col = 0; col < G; col++) {
      const i = row * G + col, ord = modOrder[i], rv = modRand[i];
      let top = 0, k = 0;
      if (isDark[i]) { k = easeOutBack(clamp((m - (0.18 + ord * 0.36 + rv * 0.07)) / 0.34)); top = lerp(-0.62, 0.5, k); }
      const h = top + 1;
      dummy.position.set(col - c0, (top - 1) / 2, row - c0); dummy.scale.set(0.93, Math.max(h, 0.01), 0.93); dummy.updateMatrix();
      plate.setMatrixAt(i, dummy.matrix);
      if (isDark[i]) cTmp.copy(cPit).lerp(pal.qr, clamp(k));
      else { cTmp.copy(cCream); cTmp.multiplyScalar(0.96 + rv * 0.06 + ((row + col) & 1) * 0.015); }
      plate.setColorAt(i, cTmp);
    }
    plate.instanceMatrix.needsUpdate = true; plate.instanceColor.needsUpdate = true;
  }

  /* ── tree ── */
  const tree = buildTree(o.seed);
  const treeMat = swayMat(new THREE.MeshStandardMaterial({ roughness: 0.78, emissive: 0xff9ec4, emissiveIntensity: 0 }));
  const treeMesh = new THREE.InstancedMesh(box, treeMat, tree.n); treeMesh.castShadow = treeMesh.receiveShadow = true; treeMesh.frustumCulled = false;
  treeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); treeMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(tree.n * 3), 3);
  scene.add(treeMesh);
  const cB = ['dark', 'base', 'light'].map((k) => new THREE.Color(BARK[k]));
  const leafIdx = []; for (let i = 0; i < tree.n; i++) if (tree.kind[i] === 2) leafIdx.push(i);
  function recolorTree() {
    for (let i = 0; i < tree.n; i++) {
      const t = tree.tone[i];
      if (tree.kind[i] === 1) { if (t < 0.5) cTmp.copy(cB[0]).lerp(cB[1], t * 2); else cTmp.copy(cB[1]).lerp(cB[2], (t - 0.5) * 2); }
      else if (t < 0.5) cTmp.copy(pal.dark).lerp(pal.base, t * 2); else cTmp.copy(pal.base).lerp(pal.light, (t - 0.5) * 2);
      treeMesh.setColorAt(i, cTmp);
    }
    treeMesh.instanceColor.needsUpdate = true; treeMat.emissive.copy(pal.base);
  }
  let bloomK = 1;
  function updateTree(m) {
    const a = treeMesh.instanceMatrix.array;
    for (let i = 0; i < tree.n; i++) {
      const kd = tree.kind[i], ord = tree.order[i], start = (1 - ord) * 0.3;
      let s = 1 - smooth(0, 1, clamp((m - start) / 0.3));
      if (kd !== 1) s *= easeOutBack(clamp(bloomK * 1.7 - ord * 0.7));
      s = Math.max(s, 0) * tree.size[i];
      const b = i * 16; a[b] = a[b + 5] = a[b + 10] = s; a[b + 1] = a[b + 2] = a[b + 3] = a[b + 4] = a[b + 6] = a[b + 7] = a[b + 8] = a[b + 9] = a[b + 11] = 0;
      a[b + 12] = tree.pos[i * 3]; a[b + 13] = tree.pos[i * 3 + 1]; a[b + 14] = tree.pos[i * 3 + 2]; a[b + 15] = 1;
    }
    treeMesh.instanceMatrix.needsUpdate = true; treeMesh.visible = m < 0.995;
  }

  /* ── petals ── */
  const NP = o.petals, petalMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  const petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.28), petalMat, NP); petals.frustumCulled = false;
  petals.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NP * 3), 3); scene.add(petals);
  const P = Array.from({ length: NP }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), ph: Math.random() * 6.28, sp: new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1), age: Math.random() * 10, tone: Math.random() }));
  const wind = { v: 1.3 }; let petalFrac = 0.55, petalCap = 1;
  function spawnPetal(q, burst) {
    const i = leafIdx[(Math.random() * leafIdx.length) | 0];
    q.p.set(tree.pos[i * 3], tree.pos[i * 3 + 1], tree.pos[i * 3 + 2]); q.age = 0;
    if (burst) { const dir = new THREE.Vector3(q.p.x, 0, q.p.z).normalize(); q.v.set(dir.x * (2 + Math.random() * 6), 3 + Math.random() * 6, dir.z * (2 + Math.random() * 6)); }
    else q.v.set((Math.random() - 0.5) * 0.6, -(0.9 + Math.random() * 1.1), (Math.random() - 0.5) * 0.6);
  }
  function recolorPetals() { for (let i = 0; i < NP; i++) { const t = P[i].tone; cTmp.copy(pal.base).lerp(t < 0.5 ? pal.dark : pal.light, Math.abs(t - 0.5) * 1.6).lerp(cWhite, cur.glow * 0.6); petals.setColorAt(i, cTmp); } petals.instanceColor.needsUpdate = true; }
  P.forEach((q) => { spawnPetal(q, false); q.p.y = Math.random() * 28; });
  function burstPetals(n, toTree) {
    for (let i = 0; i < Math.min(n, NP); i++) {
      const q = P[(Math.random() * NP) | 0];
      if (toTree) { q.p.set((Math.random() - 0.5) * 20, 0.5, (Math.random() - 0.5) * 20); q.v.set((Math.random() - 0.5) * 5, 4 + Math.random() * 7, (Math.random() - 0.5) * 5); q.age = 0; }
      else spawnPetal(q, true);
    }
  }
  function updatePetals(dt, m) {
    const act = Math.floor(NP * petalFrac * petalCap * lerp(1, 0.35, smooth(0.5, 1, m))), vis = lerp(1, 0.6, smooth(0.5, 1, m)), tm = U.time.value, k = Math.min(1, dt * 0.9);
    for (let i = 0; i < NP; i++) {
      const q = P[i];
      q.age += dt; q.v.y = lerp(q.v.y, -(1 + (i % 7) * 0.12), k);
      q.v.x = lerp(q.v.x, wind.v * (0.5 + (i % 5) * 0.2) + Math.sin(tm * 0.8 + q.ph) * 0.6, k);
      q.v.z = lerp(q.v.z, Math.cos(tm * 0.6 + q.ph) * 0.5, k);
      q.p.addScaledVector(q.v, dt);
      if (q.p.y < -1.2 || q.age > 22) { if (m < 0.6) spawnPetal(q, false); else q.p.y = -50; }
      if (i >= act) dummy.scale.setScalar(0); else dummy.scale.setScalar(vis * (0.8 + (i % 5) * 0.12));
      dummy.position.copy(q.p); dummy.rotation.set(q.ph + q.age * q.sp.x * 3, q.age * q.sp.y * 3, q.age * q.sp.z * 3); dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
  }

  /* ── camera (drag to orbit, hover parallax) ── */
  const view = { az: 0, v: 0, mx: 0 };
  function placeCamera(m, aspect) {
    const e = easeInOut(clamp(m)), tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distTree = Math.max(24.5 / tanH, 23 / (tanH * aspect)) * 1.08, distQr = Math.max((G * 0.66) / tanH, (G * 0.62) / (tanH * aspect));
    const el = THREE.MathUtils.degToRad(lerp(29, 89.6, e)), az = lerp(THREE.MathUtils.degToRad(-24) + view.az + view.mx, 0, e), dist = lerp(distTree, distQr, e), ty = lerp(11, 0, e);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, ty + Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist); camera.lookAt(0, ty, 0);
  }
  function resize() { const w = stage.clientWidth || 1, h = stage.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(resize); ro.observe(stage);
  let visible = true; const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }) : null; io && io.observe(root);

  /* ── adaptive quality (0 = full, 1 = lower DPR, 2 = DPR 1 + small shadow map + fewer petals) ── */
  let q = 0, ema = 16, slow = 0; const t0 = performance.now();
  function setQuality(l) {
    q = l; renderer.setPixelRatio(l === 0 ? dprMax : l === 1 ? Math.min(dprMax, 1.25) : 1);
    if (l >= 2) { sun.shadow.mapSize.set(1024, 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } petalCap = 0.6; shadowDirty = true; }
    resize(); o.onChange && o.onChange({ quality: l });
  }

  /* ── state machine ── */
  let m = o.state === 'qr' || o.intro ? 1 : 0, target = m, plateDirty = true, treeDirty = true, last = performance.now(), raf = 0, soundOn = false, audio = null, mode = o.mode, swayBase = 0.35, hintTimer = 0;
  function setHint(state) { hint.style.opacity = 0; clearTimeout(hintTimer); hintTimer = later(() => { hintTx.textContent = TXT[state]; hint.style.opacity = 1; }, 160); }
  function setState(s, silent, instant) {
    const t = s === 'qr' ? 1 : 0; if (instant) { m = target = t; hintTx.textContent = TXT[s]; plateDirty = treeDirty = true; return; }
    if (t === target) return; target = t; setHint(s);
    burstPetals(t ? 260 : 150, !t); if (audio) audio.chime(t ? 4 : 3);
    if (!silent) { o.onToggle && o.onToggle(s); o.onChange && o.onChange({ state: s }); }
  }
  function applyMode(k) {
    mode = k; $$('.sqt-modes [data-m]').forEach((b) => { b.classList.toggle('on', b.dataset.m === k); b.setAttribute('aria-pressed', b.dataset.m === k); });
    swayBase = (k === 'breeze' ? 1.5 : k === 'bloom' ? 0.45 : 0.35) * (reduce ? 0.2 : 1); wind.v = (k === 'breeze' ? 7 : 1.3) * (reduce ? 0.3 : 1); petalFrac = (k === 'spring' ? 0.55 : 1) * (reduce ? 0.3 : 1);
    if (audio) audio.wind(k === 'breeze' ? 3 : 1);
    if (k === 'bloom' && target === 0 && !reduce) { bloomK = 0; treeDirty = true; later(() => burstPetals(200, false), 900); }
    if (ready) o.onChange && o.onChange({ mode: k });
  }

  /* ── url / caption / export ── */
  function updateCaption() {
    const u = httpUrl(o.url), label = u ? u.host + (u.pathname.length > 1 ? u.pathname : '') : o.url;
    cap.textContent = '';
    if (u) { const a = document.createElement('a'); a.href = u.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.innerHTML = svg('open', 15); a.append(document.createTextNode(label)); cap.appendChild(a); }
    else { const sp = document.createElement('span'); sp.textContent = label; cap.appendChild(sp); }
  }
  function setUrl(raw) {
    const text = normalizeUrl(String(raw == null ? '' : raw).trim()) || o.placeholder, wrap = $('.sqt-url');
    try { const mat = encode(text); buildPlate(mat); o.url = text; wrap && wrap.classList.remove('bad'); if (text.length > 110) toast('Long link — the QR gets dense and harder to scan'); updateCaption(); if (ready) o.onChange && o.onChange({ url: text }); return true; }
    catch (e) { wrap && wrap.classList.add('bad'); toast('Too long to fit in a QR code'); return false; }
  }
  function exportPNG({ size = 1024, ink } = {}) {
    const n = matrix.length, cell = size / (n + 8), c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    g.fillStyle = '#fffaf7'; g.fillRect(0, 0, size, size);
    g.fillStyle = ink || '#' + new THREE.Color(PALETTES[colorName].qr).multiplyScalar(0.85).getHexString();
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (matrix[r][k]) { const x = (k + 4) * cell, y = (r + 4) * cell; g.beginPath(); (g.roundRect ? g.roundRect(x, y, cell + 0.5, cell + 0.5, cell * 0.2) : g.rect(x, y, cell + 0.5, cell + 0.5)); g.fill(); }
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }
  async function download() {
    const blob = await exportPNG(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sakura-qr.png'; document.body.appendChild(a); a.click(); a.remove(); later(() => URL.revokeObjectURL(a.href), 4000); toast('QR code saved');
  }

  /* ── input ── */
  const drag = { on: false, moved: false, x: 0, lx: 0, az0: 0 };
  canvas.addEventListener('pointerdown', (e) => { drag.on = true; drag.moved = false; drag.x = drag.lx = e.clientX; drag.az0 = view.az; view.v = 0; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* noop */ } });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    if (drag.on) {
      if (Math.abs(e.clientX - drag.x) > 8) drag.moved = true;
      if (drag.moved && m < 0.3) { view.az = drag.az0 + (e.clientX - drag.x) * 0.0085; view.v = (e.clientX - drag.lx) * 0.0085 * 0.6; canvas.classList.add('drag'); }
      drag.lx = e.clientX;
    } else view.mx = ((e.clientX - r.left) / r.width - 0.5) * 0.12;
  });
  const endDrag = (e) => { if (!drag.on) return; drag.on = false; canvas.classList.remove('drag'); if (!drag.moved && e.type === 'pointerup') setState(target ? 'tree' : 'qr'); };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setState(target ? 'tree' : 'qr'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); view.v = 0.05; } else if (e.key === 'ArrowRight') { e.preventDefault(); view.v = -0.05; }
  });
  if (o.ui) {
    let deb; inp.addEventListener('input', () => { clearTimeout(deb); deb = later(() => setUrl(inp.value), 280); });
    $('.sqt-share').addEventListener('click', async () => {
      const u = o.url; if (o.onShare) return o.onShare(u);
      try { if (navigator.share) await navigator.share({ url: u, title: 'My link' }); else { await navigator.clipboard.writeText(u); toast('Link copied'); } } catch (e) { /* user cancelled */ }
    });
    $('[data-dl]').addEventListener('click', download);
    $$('.sqt-modes [data-m]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.m === 'spring') $('.sqt-sw').classList.toggle('hide'); applyMode(b.dataset.m); }));
    $$('.sqt-sw button').forEach((b) => b.addEventListener('click', () => setColor(b.dataset.c)));
    $('[data-th]').addEventListener('click', () => setTheme(THEME_ORDER[(THEME_ORDER.indexOf(themeName) + 1) % 3]));
    $('[data-snd]').addEventListener('click', () => setSound(!soundOn));
  }
  function setColor(n) { setPalTarget(n, false); if (ready) o.onChange && o.onChange({ color: colorName }); }
  function setSound(on) {
    soundOn = on; if (on && !audio) audio = makeAudio(); if (audio) audio.setOn(on);
    const b = $('[data-snd]'); if (b) { b.innerHTML = svg(on ? 'sound' : 'mute'); b.setAttribute('aria-pressed', on); } if (ready) o.onChange && o.onChange({ sound: on });
  }

  /* ── loop ── */
  let capOn = false;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) { last = now; return; }
    const raw = now - last, dt = Math.min(0.05, raw / 1000); last = now; U.time.value += dt;
    if (o.adaptive && q < 2 && now - t0 > 3000) { ema = ema * 0.94 + Math.min(raw, 200) * 0.06; if (ema > 36) { if (++slow > 100) { setQuality(q + 1); slow = 0; ema = 16; } } else slow = Math.max(0, slow - 2); }
    U.sway.value = lerp(U.sway.value, swayBase, Math.min(1, dt * 2));
    let moving = false, themeMoving = false;
    if (m !== target) { const d = dt / dur; m = m < target ? Math.min(target, m + d) : Math.max(target, m - d); moving = true; }
    if (bloomK < 1) { bloomK = Math.min(1, bloomK + dt / 2.4); treeDirty = true; }
    if (palK < 1) { palK = Math.min(1, palK + dt / 0.6); for (const k of Object.keys(pal)) pal[k].copy(palFrom[k]).lerp(palTo[k], palK); recolorTree(); recolorPetals(); plateDirty = true; }
    if (thK < 1) { thK = Math.min(1, thK + dt / 0.9); mixTheme(easeInOut(thK)); applyTheme(); themeMoving = true; }
    if (!drag.on && view.v) { view.az += view.v; view.v *= 0.92; if (Math.abs(view.v) < 1e-4) view.v = 0; }
    if (moving || plateDirty || treeDirty || themeMoving || shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    if (moving || plateDirty) { updatePlate(m); plateDirty = false; }
    if (moving || treeDirty) { updateTree(m); treeDirty = false; }
    updatePetals(dt, m);
    const want = o.caption && m > 0.9 && target === 1; if (want !== capOn) { capOn = want; cap.classList.toggle('show', want); }
    placeCamera(m, camera.aspect); renderer.render(scene, camera);
  }

  /* init */
  setPalTarget(colorName, true); setTheme(o.theme, true); setUrl(o.url || o.placeholder) || buildPlate(encode(o.placeholder));
  recolorTree(); recolorPetals(); resize(); applyMode(mode); hintTx.textContent = TXT[m ? 'qr' : 'tree'];
  if (o.sound) setSound(true);
  updatePlate(m); updateTree(m); raf = requestAnimationFrame(frame); ready = true;
  if (o.intro && o.state !== 'qr') later(() => setState('tree', true), 700);

  return {
    toggle: () => setState(target ? 'tree' : 'qr'), setState, snap: (s) => setState(s, true, true), seek: (v) => { m = target = clamp(v); plateDirty = treeDirty = true; },
    setUrl, setColor, setMode: applyMode, setTheme, setSound, exportPNG,
    get state() { return target ? 'qr' : 'tree'; }, get theme() { return themeName; }, get quality() { return q; }, get progress() { return m; }, get matrix() { return matrix; },
    canvas, root, renderer,
    destroy() {
      cancelAnimationFrame(raf); timers.forEach(clearTimeout); ro.disconnect(); io && io.disconnect(); if (audio) audio.close();
      scene.traverse((ob) => { if (ob.geometry) ob.geometry.dispose(); const mt = ob.material; if (mt) (Array.isArray(mt) ? mt : [mt]).forEach((x) => x.dispose()); });
      if (sun.shadow.map) sun.shadow.map.dispose(); renderer.dispose(); renderer.forceContextLoss(); root.remove();
    },
  };
}

export default createSakuraQR;
