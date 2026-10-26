// Procedural textures drawn on canvas. No external image files needed.
import * as THREE from 'three';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function tex(c, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function concrete() {
  const [c, g] = canvas(1024, 1024); const r = rand(7);
  g.fillStyle = '#8d8c88'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 26000; i++) { const v = 110 + r() * 60 | 0; g.fillStyle = `rgba(${v},${v},${v - 4},${0.08 + r() * 0.12})`; const s = 1 + r() * 3; g.fillRect(r() * 1024, r() * 1024, s, s); }
  for (let i = 0; i < 70; i++) { const x = r() * 1024, y = r() * 1024, rad = 30 + r() * 120; const gr = g.createRadialGradient(x, y, 0, x, y, rad); const d = r() < 0.5; gr.addColorStop(0, d ? 'rgba(60,58,55,0.10)' : 'rgba(190,190,185,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  // tyre marks
  g.strokeStyle = 'rgba(30,30,30,0.06)'; g.lineWidth = 7;
  for (let i = 0; i < 14; i++) { g.beginPath(); const x = r() * 1024, y = r() * 1024; g.moveTo(x, y); g.bezierCurveTo(x + r() * 400 - 200, y + r() * 400 - 200, x + r() * 400 - 200, y + r() * 400 - 200, x + r() * 600 - 300, y + r() * 600 - 300); g.stroke(); }
  // saw cut joints
  g.strokeStyle = 'rgba(40,40,40,0.55)'; g.lineWidth = 2; g.strokeRect(1, 1, 1022, 1022);
  const map = tex(c, 1, 1);
  const [c2, g2] = canvas(512, 512); const r2 = rand(3);
  g2.fillStyle = '#9a9a9a'; g2.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = 120 + r2() * 110 | 0; g2.fillStyle = `rgb(${v},${v},${v})`; g2.fillRect(r2() * 512, r2() * 512, 2, 2); }
  for (let i = 0; i < 40; i++) { const x = r2() * 512, y = r2() * 512, rad = 20 + r2() * 70; const gr = g2.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(70,70,70,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g2.fillStyle = gr; g2.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  const rough = tex(c2, 1, 1, false);
  return { map, rough };
}

export function wood() {
  const [c, g] = canvas(256, 256); const r = rand(11);
  g.fillStyle = '#b8935f'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 1) { const v = Math.sin(y * 0.35 + Math.sin(y * 0.05) * 4) * 18 + r() * 10; g.fillStyle = `rgba(${120 + v | 0},${88 + v | 0},${50 + v * 0.6 | 0},0.35)`; g.fillRect(0, y, 256, 1); }
  for (let i = 0; i < 6; i++) { const x = r() * 256, y = r() * 256; g.fillStyle = 'rgba(80,50,25,0.5)'; g.beginPath(); g.ellipse(x, y, 6 + r() * 6, 3, 0, 0, 7); g.fill(); }
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(60,40,20,${r() * 0.15})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 6, 1); }
  return tex(c);
}

export function cardboard(variant = 0) {
  const [c, g] = canvas(512, 512); const r = rand(21 + variant);
  const base = ['#b48a5a', '#a47b4c', '#c09566', '#9c7448'][variant % 4];
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 7000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,240,210' : '60,40,20'},${r() * 0.07})`; g.fillRect(r() * 512, r() * 512, 2, 1 + r() * 3); }
  // carton seams per 2x2 boxes in texture
  g.strokeStyle = 'rgba(70,45,20,0.75)'; g.lineWidth = 3;
  for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 256); g.lineTo(512, i * 256); g.stroke(); }
  // tape
  g.fillStyle = 'rgba(205,170,110,0.75)';
  for (let i = 0; i < 2; i++) { g.fillRect(i * 256 + 108, 0, 40, 512); }
  // labels and arrows
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * 256 + 24, y = (i / 2 | 0) * 256 + 150;
    g.fillStyle = '#f4f1ea'; g.fillRect(x, y, 70, 48);
    g.fillStyle = '#222'; for (let k = 0; k < 5; k++) g.fillRect(x + 6, y + 6 + k * 8, 30 + r() * 30, 3);
    g.strokeStyle = 'rgba(30,30,30,0.6)'; g.lineWidth = 3; const ax = x + 170, ay = y - 90;
    g.beginPath(); g.moveTo(ax, ay + 40); g.lineTo(ax, ay); g.moveTo(ax - 10, ay + 12); g.lineTo(ax, ay); g.lineTo(ax + 10, ay + 12); g.stroke();
    g.beginPath(); g.moveTo(ax + 26, ay + 40); g.lineTo(ax + 26, ay); g.moveTo(ax + 16, ay + 12); g.lineTo(ax + 26, ay); g.lineTo(ax + 36, ay + 12); g.stroke();
  }
  return tex(c);
}

export function corrugated() {
  const [c, g] = canvas(256, 256);
  for (let x = 0; x < 256; x++) { const v = 170 + Math.sin(x / 256 * Math.PI * 16) * 35; g.fillStyle = `rgb(${v | 0},${v + 3 | 0},${v + 6 | 0})`; g.fillRect(x, 0, 1, 256); }
  const r = rand(5); for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(90,90,90,${r() * 0.08})`; g.fillRect(r() * 256, r() * 256, 1, 4 + r() * 20); }
  return tex(c, 1, 1);
}

export function stripes(a = '#f2c200', b = '#151515', n = 8) {
  const [c, g] = canvas(256, 64); g.fillStyle = a; g.fillRect(0, 0, 256, 64); g.fillStyle = b;
  for (let i = -2; i < n + 2; i++) { g.beginPath(); const x = i * 256 / n; g.moveTo(x, 64); g.lineTo(x + 128 / n, 64); g.lineTo(x + 128 / n + 64, 0); g.lineTo(x + 64, 0); g.fill(); }
  return tex(c);
}

export function shrinkWrap() {
  const [c, g] = canvas(256, 256); const r = rand(9);
  g.fillStyle = 'rgba(255,255,255,0.0)'; g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.15})`; g.lineWidth = 1 + r() * 4; g.beginPath(); const y = r() * 256; g.moveTo(0, y); g.bezierCurveTo(80, y + r() * 30 - 15, 170, y + r() * 30 - 15, 256, y + r() * 20 - 10); g.stroke(); }
  return tex(c);
}

export function label(text, opts = {}) {
  const w = opts.w || 512, h = opts.h || 128; const [c, g] = canvas(w, h);
  g.fillStyle = opts.bg || '#ffffff'; g.fillRect(0, 0, w, h);
  if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = opts.borderW || 10; g.strokeRect(5, 5, w - 10, h - 10); }
  g.fillStyle = opts.fg || '#111'; g.font = `bold ${opts.size || 64}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = String(text).split('\n'); const lh = (opts.size || 64) * 1.1;
  lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function screen(lines) {
  const [c, g] = canvas(256, 160); g.fillStyle = '#06131c'; g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#39d0ff'; g.font = 'bold 22px Arial'; lines.forEach((l, i) => g.fillText(l, 12, 34 + i * 30));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function tread() {
  const [c, g] = canvas(64, 256); g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#0c0c0c'; for (let y = 0; y < 256; y += 16) { g.fillRect(0, y, 64, 5); }
  return tex(c, 1, 1);
}
