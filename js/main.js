import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/addons/RoomEnvironment.js';
import { OrbitControls } from '../vendor/addons/OrbitControls.js';
import * as T from './textures.js';
import { World, PALLET } from './warehouse.js';
import { SPECS, buildTruck, MPH, IN, LB } from './trucks.js';
import { TruckSim, updateFalling } from './sim.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { MODES, setupMode, rng, fmtTime, INSPECTION_ITEMS } from './modes.js';

const $ = s => document.querySelector(s);
const app = $('#app');
const params = new URLSearchParams(location.search);

// ---------- renderer ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
} catch (e) { $('#loading').innerHTML = '<p>Your browser could not start 3D graphics (WebGL). Try Chrome, Edge or Safari with hardware acceleration turned on.</p>'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x30353c);
scene.fog = new THREE.Fog(0x30353c, 40, 95);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 220);
const hemi = new THREE.HemisphereLight(0xfff6ea, 0x3b352e, 0.75); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dd, 2.1); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 60;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5); fill.position.set(-20, 10, 30); scene.add(fill);
const orbit = new OrbitControls(camera, renderer.domElement); orbit.enabled = false; orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * 0.49; orbit.minDistance = 1.5; orbit.maxDistance = 25;

// ---------- materials ----------
function makeMats() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const tr = T.tread(); tr.repeat.set(1, 3);
  const w = T.wood(); const crate = T.wood(); crate.repeat.set(2, 2);
  const wrapTex = T.shrinkWrap();
  return {
    red: new THREE.MeshPhysicalMaterial({ color: 0xc8102e, roughness: 0.38, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
    black: std({ color: 0x1b1c1e, roughness: 0.55, metalness: 0.3 }),
    grey: std({ color: 0x6d7378, roughness: 0.45, metalness: 0.55 }),
    chrome: std({ color: 0xe0e3e6, roughness: 0.12, metalness: 1.0 }),
    rubber: std({ color: 0x1a1a1a, roughness: 0.92, map: tr }),
    rubberDark: std({ color: 0x0e0e0e, roughness: 0.95 }),
    poly: std({ color: 0xd8a640, roughness: 0.55 }),
    hub: std({ color: 0x8e959b, roughness: 0.35, metalness: 0.8 }),
    fork: std({ color: 0x26282b, roughness: 0.5, metalness: 0.6 }),
    chain: std({ color: 0x5a5e62, roughness: 0.35, metalness: 0.9 }),
    screen: std({ map: T.screen(['READY', 'BATT 86%', 'HGT 0 IN']), emissive: 0xffffff, emissiveMap: T.screen(['READY', 'BATT 86%', 'HGT 0 IN']), emissiveIntensity: 0.8, roughness: 0.2 }),
    decal: std({ map: T.label('CAPACITY\nSEE DATA PLATE', { w: 256, h: 128, size: 30, bg: '#f4f4f4', fg: '#111', border: '#111', borderW: 6 }), roughness: 0.5 }),
    stripe: std({ map: T.stripes(), roughness: 0.5 }),
    yellow: std({ color: 0xf2c200, roughness: 0.45 }), orange: std({ color: 0xff7a00, roughness: 0.5 }),
    seat: std({ color: 0x222325, roughness: 0.75 }), skin: std({ color: 0xc58c64, roughness: 0.7 }),
    vest: std({ color: 0xc6ff00, roughness: 0.6, emissive: 0x3a4a00, emissiveIntensity: 0.4 }), pants: std({ color: 0x23324a, roughness: 0.8 }), helmet: std({ color: 0xffffff, roughness: 0.3 }),
    beacon: std({ color: 0x7a4a00, roughness: 0.3, transparent: true, opacity: 0.9 }), beaconOn: std({ color: 0xffb000, emissive: 0xffa000, emissiveIntensity: 4 }),
    wood: std({ map: w, roughness: 0.85, color: 0xd9c19a }),
    carton: [0, 1, 2, 3].map(v => std({ map: T.cardboard(v), roughness: 0.8 })),
    crate: std({ map: crate, roughness: 0.8, color: 0xb59a6e }),
    wrap: new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: wrapTex, transparent: true, opacity: 0.35, roughness: 0.15, metalness: 0, depthWrite: false }),
  };
}
const mats = makeMats();
const world = new World(scene, mats);
world.fillRacks(rng(7), []);

// ---------- state ----------
const input = new Input(app); const audio = new Audio();
let truckId = params.get('truck') || localStorage.getItem('fs_truck') || '7500';
let modeId = params.get('mode') || 'free';
let camMode = 'chase'; const CAMS = ['operator', 'chase', 'overhead', 'orbit'];
const CAM_NAMES = { operator: 'Operator view', chase: 'Chase view', overhead: 'Overhead view', orbit: 'Walk around (drag to look)' };
let spec, parts, sim, mode, paused = true, hornDead = false, lookYaw = 0, lookPitch = -0.12, lookBack = false;
const truckCache = {};
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let seed = (Date.now() / 1000) | 0;

function loadTruck(id) {
  if (parts) scene.remove(parts.root);
  spec = SPECS.find(s => s.id === id) || SPECS[0]; truckId = spec.id; localStorage.setItem('fs_truck', spec.id);
  parts = truckCache[spec.id] || (truckCache[spec.id] = buildTruck(spec, mats));
  scene.add(parts.root); sim = new TruckSim(spec, parts, world);
  const vis = (a, on) => document.querySelectorAll(`#tbtns [data-a=${a}]`).forEach(b => b.style.display = on ? '' : 'none');
  vis('reachOut', spec.reach); vis('reachIn', spec.reach); vis('tiltBack', spec.tilt[1] > 0); vis('tiltFwd', spec.tilt[1] > 0); vis('sideL', spec.sideshift); vis('sideR', spec.sideshift);
}

const ctx = {
  scene, world, mats, get sim() { return sim; }, get spec() { return spec; }, get parts() { return parts; },
  rand: null,
  place(x, z, yaw) { sim.reset(x, z, yaw); sim.restraint = false; snapCam(); },
  onFinish: (r) => showResults(r),
  toast: (m, k) => toast(m, k), chime: g => audio.chime(g),
  setHornDead(v) { hornDead = v; },
  eyeWorld() { const p = (parts.eyeParent || parts.body); return p.localToWorld(parts.eye.clone()); },
  showInspection: (spec, cb) => showInspection(spec, cb),
};

function startMode(id) {
  if (mode) mode.cleanup();
  hideAll(); modeId = id; seed++;
  ctx.rand = rng(params.has('seed') ? +params.get('seed') : seed);
  if (parts) { parts.body.rotation.set(0, 0, 0); parts.body.position.set(0, 0, 0); }
  mode = setupMode(id, ctx);
  if (id === 'inspect') setCam('orbit'); else if (camMode === 'orbit') setCam('chase');
  $('#modeName').textContent = MODES.find(m => m.id === id).name + ' with the ' + spec.short;
  $('#objective').textContent = mode.objective; $('#score').style.display = mode.scoring && id !== 'inspect' ? '' : 'none';
  $('#log').innerHTML = ''; paused = false; inGame = true; $('#hud').classList.remove('hidden');
}

// ---------- cameras ----------
function setCam(m) { camMode = m; orbit.enabled = m === 'orbit'; parts && (parts.op.visible = m !== 'operator'); if (m === 'orbit') { orbit.target.set(sim.x, 1, sim.z); camera.position.set(sim.x + 4, 2.4, sim.z + 4); } $('#camName').textContent = CAM_NAMES[m]; snapCam(); }
function snapCam() { camPos.set(NaN, 0, 0); }
let dragging = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; audio.start(); });
addEventListener('pointerup', () => dragging = false);
addEventListener('pointermove', e => { if (!dragging || camMode !== 'operator') return; lookYaw -= (e.clientX - lastX) * 0.004; lookPitch = THREE.MathUtils.clamp(lookPitch - (e.clientY - lastY) * 0.004, -1.2, 1.2); lastX = e.clientX; lastY = e.clientY; });
renderer.domElement.addEventListener('dblclick', () => { lookYaw = 0; lookPitch = -0.12; });

function updateCamera(dt) {
  const r = parts.root; const fh = sim.forkTop();
  if (camMode === 'operator') {
    const eye = ctx.eyeWorld(); camera.position.copy(eye);
    const yaw = sim.yaw + lookYaw + (lookBack ? Math.PI : 0); const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(lookPitch), Math.sin(lookPitch), Math.cos(yaw) * Math.cos(lookPitch));
    camera.lookAt(eye.clone().add(dir)); camera.fov = 70;
  } else if (camMode === 'chase') {
    const back = spec.kind === 'pallet' ? 9 : 7.2;
    const want = new THREE.Vector3(1.2, 3.2 + fh * 0.35, -back); r.localToWorld(want);
    const look = new THREE.Vector3(0, 1.1 + fh * 0.55, 1.4); r.localToWorld(look);
    const from = new THREE.Vector3(0, 1.6, 0); r.localToWorld(from);
    const blockedAt = (w) => { for (let i = 1; i <= 24; i++) { const t = i / 24; const px = from.x + (w.x - from.x) * t, pz = from.z + (w.z - from.z) * t;
      if (world.colliders2D.some(c => c.name !== 'cone' && px > c.minX - 0.35 && px < c.maxX + 0.35 && pz > c.minZ - 0.35 && pz < c.maxZ + 0.35)) return t; } return 1; };
    if (blockedAt(want) < 1) {
      let best = null;
      for (const off of [1.6, -1.6, 3, -3, 4.5, -4.5]) { const w = new THREE.Vector3(1.2 + off, 3.2 + fh * 0.35, -back * (1 - Math.abs(off) * 0.06)); r.localToWorld(w); if (blockedAt(w) === 1) { best = w; break; } }
      if (best) want.copy(best); else { const t = Math.max(0.22, blockedAt(want) - 0.06); want.lerpVectors(from, want, t); want.y = Math.max(want.y, from.y + 1.6 * (1 - t)); }
    }
    if (isNaN(camPos.x)) { camPos.copy(want); camLook.copy(look); }
    const k = 1 - Math.exp(-dt * 4); camPos.lerp(want, k); camLook.lerp(look, 1 - Math.exp(-dt * 8));
    camera.position.copy(camPos); camera.lookAt(camLook); camera.fov = 58;
  } else if (camMode === 'overhead') {
    const want = new THREE.Vector3(sim.x, 10.6, sim.z + 4.5); if (isNaN(camPos.x)) camPos.copy(want); camPos.lerp(want, 1 - Math.exp(-dt * 3));
    camera.position.copy(camPos); camera.lookAt(camPos.x, 0, camPos.z - 4.5); camera.fov = 62;
  } else { orbit.target.lerp(new THREE.Vector3(sim.x, 1 + fh * 0.4, sim.z), 1 - Math.exp(-dt * 3)); orbit.update(); camera.fov = 55; }
  camera.updateProjectionMatrix();
  sun.position.set(sim.x + 7, 16, sim.z + 5); sun.target.position.set(sim.x, 0, sim.z);
}

// ---------- UI ----------
const fmtLb = kg => Math.round(kg / LB / 10) * 10;
const clean = s => String(s).replace(/[\u2010-\u2015\u2212-]/g, ' ').replace(/\s+/g, ' ').trim();
function toast(msg, kind = 'info') {
  const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = msg; $('#toasts').appendChild(d);
  setTimeout(() => d.classList.add('out'), 4200); setTimeout(() => d.remove(), 5000);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function hideAll() { document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden')); }
function showPanel(id) { hideAll(); $(id).classList.remove('hidden'); paused = true; }

function buildMenu() {
  const tc = $('#truckCards'); tc.innerHTML = '';
  for (const s of SPECS) {
    const b = document.createElement('button'); b.className = 'card' + (s.id === truckId ? ' sel' : ''); b.dataset.id = s.id;
    b.innerHTML = `<b>${s.short}</b><span>${s.blurb}</span><small>${s.capacityLb.toLocaleString('en-US')} lb rated · ${s.speedMph} mph · lifts ${Math.round(s.maxLiftIn)} in</small>`;
    b.onclick = () => { truckId = s.id; tc.querySelectorAll('.card').forEach(c => c.classList.toggle('sel', c.dataset.id === s.id)); showSpec(s); };
    tc.appendChild(b);
  }
  const mc = $('#modeCards'); mc.innerHTML = '';
  for (const m of MODES) {
    const b = document.createElement('button'); b.className = 'card mode' + (m.id === modeId ? ' sel' : ''); b.dataset.id = m.id;
    b.innerHTML = `<b>${m.name}</b><span>${m.desc}</span>`;
    b.onclick = () => { modeId = m.id; mc.querySelectorAll('.card').forEach(c => c.classList.toggle('sel', c.dataset.id === m.id)); };
    mc.appendChild(b);
  }
  showSpec(SPECS.find(s => s.id === truckId));
}
function showSpec(s) {
  $('#specBox').innerHTML = `<h3>${s.name}</h3><p>${s.blurb}</p><table>${s.facts.map(([k, v, src]) => `<tr><th>${k}</th><td>${clean(v)} <em class="${src}">${src === 'raymond' ? 'Raymond published' : 'simulator value'}</em></td></tr>`).join('')}</table>`;
}
$('#startBtn').onclick = () => { audio.start(); if (!parts || spec.id !== truckId) loadTruck(truckId); startMode(modeId); };
$('#helpBtn').onclick = () => { backTo = '#menu'; showPanel('#help'); };
$('#catBtn').onclick = () => { backTo = '#menu'; showPanel('#catalog'); buildCatalog(); };
let backTo = '#menu', inGame = false;
document.querySelectorAll('.back').forEach(b => b.onclick = () => { if (backTo === 'game' && inGame && mode && !mode.done) { hideAll(); paused = false; } else openMenu(); });
$('#menuBtn').onclick = () => openMenu();
$('#hudHelp').onclick = () => { backTo = 'game'; showPanel('#help'); };
$('#camBtn').onclick = () => cycleCam();
$('#muteBtn').onclick = () => { audio.on = !audio.on; $('#muteBtn').textContent = audio.on ? 'Sound on' : 'Sound off'; };
$('#againBtn').onclick = () => startMode(modeId);
$('#resMenuBtn').onclick = () => openMenu();
function openMenu() { buildMenu(); showPanel('#menu'); $('#resumeBtn').style.display = inGame && mode && !mode.done ? '' : 'none'; }
$('#resumeBtn').onclick = () => { hideAll(); paused = false; };
function cycleCam() { setCam(CAMS[(CAMS.indexOf(camMode) + 1) % CAMS.length]); }

let catalog = null;
async function buildCatalog() {
  if (!catalog) { try { catalog = await (await fetch('data/raymond-models.json')).json(); } catch (e) { $('#catBody').innerHTML = '<tr><td>Could not load the catalog file.</td></tr>'; return; } }
  const q = ($('#catSearch').value || '').toLowerCase(); const sims = new Set(SPECS.map(s => s.catalogId));
  const rows = catalog.models.filter(m => !q || JSON.stringify(m).toLowerCase().includes(q));
  $('#catCount').textContent = `${rows.length} of ${catalog.models.length} Raymond models. Source: raymondcorp.com, checked ${new Date(catalog.retrieved + 'T12:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`;
  $('#catBody').innerHTML = rows.map(m => `<tr><td><b>${clean(m.model)}</b>${sims.has(m.id) ? '<span class="drive">in simulator</span>' : ''}<br><small>${clean(m.series || '')}</small></td><td>${clean(m.type)}</td><td>${clean(m.operatorPosition || '')}</td><td>${clean(m.ratedCapacity)}</td><td>${clean(m.maxLiftHeight)}</td><td>${clean(m.travelSpeed)}</td><td>${clean(m.battery)}</td><td><a href="${m.source}" target="_blank" rel="noopener">page</a></td></tr>`).join('');
}
$('#catSearch').addEventListener('input', buildCatalog);

function showInspection(spec, cb) {
  const items = INSPECTION_ITEMS(spec); const ans = {};
  $('#inspList').innerHTML = items.map(it => `<li data-id="${it.id}"><span>${it.text}</span><button data-v="ok">OK</button><button data-v="fault">Fault</button></li>`).join('');
  $('#inspList').querySelectorAll('li').forEach(li => li.querySelectorAll('button').forEach(b => b.onclick = () => { ans[li.dataset.id] = b.dataset.v; li.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); li.className = b.dataset.v; }));
  $('#inspSubmit').onclick = () => {
    const missing = items.filter(i => !ans[i.id]).length; if (missing) return toast(`Mark all items first. ${missing} left.`, 'warn');
    $('#inspect').classList.add('hidden'); cb(ans);
  };
  $('#inspect').classList.remove('hidden');
}

function showResults(r) {
  setTimeout(() => {
    $('#resTitle').textContent = r.title; $('#resTitle').className = r.ok ? 'ok' : 'bad';
    const pen = r.penalties.length ? `<h4>Points lost</h4><ul>${r.penalties.map(p => `<li>${p.msg} <b>${p.pts}</b></li>`).join('')}</ul>` : (r.scoring ? '<p>No points lost. Clean run.</p>' : '');
    const grade = r.score >= 90 ? 'Excellent' : r.score >= 75 ? 'Good' : r.score >= 60 ? 'Pass' : 'Needs more practice';
    $('#resBody').innerHTML = (r.scoring ? `<div class="big">${r.score}<small>/100 · ${grade}</small></div>` : '') + (r.time ? `<p>Time ${fmtTime(r.time)}</p>` : '') + r.lines.map(l => `<p>${l}</p>`).join('') + pen;
    showPanel('#results');
  }, 600);
}

// ---------- HUD ----------
let hudT = 0;
function updateHud() {
  const sp = Math.abs(sim.v) / MPH, fh = sim.forkTop();
  $('#spd').textContent = sp.toFixed(1); $('#kmh').textContent = (sp * 1.609).toFixed(1) + ' km/h';
  $('#dir').textContent = sim.v > 0.02 ? 'Forks first' : sim.v < -0.02 ? (spec.kind === 'pallet' ? 'Tiller first' : 'Power unit first') : (sim.parkBrake ? 'Parking brake on' : 'Stopped');
  $('#hgt').textContent = `${Math.max(0, Math.round(fh / IN))} in`; $('#hgtm').textContent = `${Math.max(0, fh).toFixed(2)} m`;
  const extra = [];
  if (spec.tilt[1] > 0) extra.push(`Tilt ${Math.abs(sim.tilt).toFixed(1)}° ${sim.tilt > 0.05 ? 'back' : sim.tilt < -0.05 ? 'forward' : 'level'}`);
  if (spec.reach) extra.push(`Reach ${Math.round(sim.reach / IN)} in`);
  if (spec.sideshift) extra.push(`Shift ${Math.round(Math.abs(sim.side) / IN)} in ${sim.side > 0.003 ? 'left' : sim.side < -0.003 ? 'right' : ''}`);
  $('#mastx').textContent = extra.join(' · ');
  const p = sim.carried;
  $('#load').textContent = p ? `${fmtLb(p.massKg).toLocaleString('en-US')} lb` : 'No load';
  const capLb = Math.round(sim.capEff / LB / 10) * 10;
  $('#cap').textContent = p ? `Capacity here ${capLb.toLocaleString('en-US')} lb at ${Math.round(Math.max(sim.lcAct, 0) / IN)} in load centre` : `Rated ${spec.capacityLb.toLocaleString('en-US')} lb at ${spec.lcIn} in load centre`;
  const used = Math.min(1.3, sim.loadRatio); const ub = $('#capbar'); ub.style.width = Math.min(100, used * 100) + '%'; ub.className = used > 1 ? 'bad' : used > 0.85 ? 'warn' : '';
  const stab = Math.max(sim.latIdx, sim.longIdx / 1.3); const sb = $('#stabbar'); sb.style.width = Math.min(100, stab * 100) + '%'; sb.className = stab > 0.8 ? 'bad' : stab > 0.5 ? 'warn' : '';
  const flags = [];
  if (spec.restraint === 'seatbelt') flags.push(sim.restraint ? '<i class="g">Belt on</i>' : '<i class="r">Belt off (B)</i>');
  if (spec.restraint === 'tether') flags.push(sim.restraint ? '<i class="g">Tether clipped</i>' : '<i class="r">Tether off (B)</i>');
  if (sim.parkBrake) flags.push('<i class="y">Park brake</i>'); if (!sim.keyOn) flags.push('<i class="r">Key off (K)</i>');
  if (sim.hornOn) flags.push('<i class="y">Horn</i>');
  $('#flags').innerHTML = flags.join('');
  if (mode) {
    $('#detail').textContent = mode.detail || '';
    $('#score').textContent = `Score ${Math.max(0, Math.round(mode.score))}`;
    $('#timer').textContent = mode.startT !== null && !mode.done ? fmtTime(sim.time - mode.startT) : (mode.done ? '' : '0:00');
  }
}
function logEvent(ev) {
  if (ev.type === 'violation' || ev.type === 'collision' || ev.type === 'tip') {
    const li = document.createElement('li'); li.textContent = ev.msg; li.className = ev.type; $('#log').prepend(li); while ($('#log').children.length > 5) $('#log').lastChild.remove();
  }
}

// ---------- main loop ----------
let last = performance.now(), simTime = 0, frames = 0, fpsT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now; if (!sim) return;
  const inp = input.read();
  for (const e of inp.edges) {
    if (e === 'Escape') { if (paused && inGame && mode && !mode.done && !$('#menu').classList.contains('hidden')) { hideAll(); paused = false; } else if (!paused) openMenu(); }
    if (paused) continue;
    if (e === 'KeyC') cycleCam();
    if (e === 'KeyB') { sim.restraint = !sim.restraint; toast(spec.restraint === 'tether' ? (sim.restraint ? 'Tether clipped in.' : 'Tether unclipped.') : spec.restraint === 'seatbelt' ? (sim.restraint ? 'Seat belt fastened.' : 'Seat belt off.') : 'This truck has no belt or tether. Keep your body inside the operator compartment.', 'info'); }
    if (e === 'KeyP') { sim.parkBrake = !sim.parkBrake; if (sim.parkBrake) sim.v = 0; toast(sim.parkBrake ? 'Parking brake set.' : 'Parking brake released.'); }
    if (e === 'KeyK') { sim.keyOn = !sim.keyOn; toast(sim.keyOn ? 'Key on.' : 'Key off.'); }
    if (e === 'KeyV') lookBack = !lookBack;
    if (e === 'KeyM') $('#muteBtn').click();
    if (e === 'Enter' && mode && mode.onAction) mode.onAction();
    if (e === 'Digit1') setCam('operator'); if (e === 'Digit2') setCam('chase'); if (e === 'Digit3') setCam('overhead'); if (e === 'Digit4') setCam('orbit');
  }
  if (!paused) {
    if (hornDead) inp.horn = false;
    if (camMode === 'orbit' && modeId === 'inspect') inp.autoCenter = true;
    sim.update(dt, inp); updateFalling(world, dt); world.updatePeds(dt, sim);
    for (const ev of sim.events) {
      logEvent(ev); if (mode) mode.onEvent(ev);
      if (ev.type === 'collision') audio.thud(ev.sev >= 2 ? 1 : 0.5);
      if (ev.type === 'violation' || ev.type === 'tip') audio.chime(false);
      if (ev.type === 'placed') audio.thud(0.25);
      toast(ev.msg, { violation: 'bad', collision: 'bad', tip: 'bad', warn: 'warn', good: 'good', placed: 'good', hint: 'info' }[ev.type] || 'info');
    }
    sim.events.length = 0; if (mode) mode.update(dt);
    lookBack = lookBack && camMode === 'operator';
  } else sim.pose();
  audio.update(now / 1000, { v: paused ? 0 : sim.v, keyOn: sim.keyOn && !paused, hornOn: !paused && sim.hornOn, pumping: !paused && (inp.lift || inp.tilt || inp.reach || inp.side) !== 0 && sim.keyOn, reversing: sim.v < -0.05 && !paused });
  updateCamera(dt);
  hudT += dt; if (hudT > 0.1) { hudT = 0; updateHud(); }
  renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT > 2) { window.__fps = frames / fpsT; frames = 0; fpsT = 0; }
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
input.onGamepad = id => toast('Game controller connected.', 'good');
$('#shadowBtn').onclick = () => { renderer.shadowMap.enabled = !renderer.shadowMap.enabled; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); $('#shadowBtn').textContent = renderer.shadowMap.enabled ? 'Shadows on' : 'Shadows off'; };

// boot
loadTruck(truckId); buildMenu();
setupPreview();
function setupPreview() { ctx.rand = rng(11); mode = setupMode('free', ctx); mode.scoring = false; setCam('orbit'); camera.position.set(sim.x + 5, 3, sim.z + 5); paused = true; }
$('#loading').classList.add('hidden');
if (params.has('autostart')) { $('#startBtn').click(); if (params.get('cam')) setCam(params.get('cam')); }
else openMenu();
requestAnimationFrame(frame);
// test hooks
window.__sim = { get sim() { return sim; }, get mode() { return mode; }, world, setCam, startMode, loadTruck: (id) => { loadTruck(id); }, SPECS, camera, renderer, scene, hud: updateHud };
