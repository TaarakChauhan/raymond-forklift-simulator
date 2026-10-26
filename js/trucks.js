// Six Raymond truck types, modelled procedurally. Numbers marked src:'raymond' come from raymondcorp.com
// (see research/raymond-models.md). Numbers marked src:'sim' are simulator settings where Raymond does not publish a value.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/addons/RoundedBoxGeometry.js';

export const MPH = 0.44704, IN = 0.0254, LB = 0.45359237, FPM = 0.00508;

export const SPECS = [
  {
    id: '7500', catalogId: '7500US', name: 'Raymond 7500 Reach Truck', short: '7500 Reach Truck', kind: 'reach',
    blurb: 'Stand up, side stance reach truck for narrow aisles. The forks reach out on a scissor so the load sits over the load wheels while you drive.',
    capacityLb: 4500, lcIn: 24, maxLiftIn: 366, publishedMaxIn: 444,
    speedMph: 8.0, speedLoadedMph: 7.0, liftFpm: [168, 90], lowerFpm: 230,
    steer: 'driveSteer', L: 1.45, maxSteerDeg: 90, width: 1.12,
    reach: 0.75, tilt: [-3, 5], sideshift: 0.1, freeLift: 1.9, stages: 3,
    truckKg: 3900, cgZ: -1.2, cgY: 0.8, track: 1.04,
    restraint: null, stance: 'stand side',
    facts: [
      ['Rated capacity', '3,500 to 4,500 lb', 'raymond'], ['Max lift height', 'up to 444 in (the simulator uses a 366 in mast)', 'raymond'],
      ['Travel speed', '8.0 mph in any direction (7000 Series brochure)', 'raymond'], ['Battery', '36 V', 'raymond'],
      ['Lift and lower speed', 'Simulator uses the 7000 Series High Capacity brochure values: lift 168 fpm empty, 90 fpm loaded, lower 230 fpm', 'raymond'],
      ['Controls', 'Single axis control handle, steer tiller, 7 inch touchscreen, height and tilt indicator', 'raymond'],
      ['Reach distance, tilt range, loaded travel speed', 'Not published on the model page. Simulator values: reach 30 in, tilt 3 degrees down to 5 degrees back, 7.0 mph loaded', 'sim'],
    ],
  },
  {
    id: '5600', catalogId: '5600', name: 'Raymond 5600 Orderpicker', short: '5600 Orderpicker', kind: 'orderpicker',
    blurb: 'The operator platform rises with the forks so you can pick cases by hand from high rack levels. Always clip in your fall protection tether.',
    capacityLb: 3000, lcIn: 24, maxLiftIn: 366, publishedMaxIn: 456,
    speedMph: 6.0, speedLoadedMph: 6.0, liftFpm: [90, 70], lowerFpm: 110,
    steer: 'driveSteer', L: 2.15, maxSteerDeg: 90, width: 1.12,
    reach: 0, tilt: [0, 0], sideshift: 0, freeLift: 0.0, stages: 3,
    truckKg: 4300, cgZ: -1.9, cgY: 0.7, track: 1.0,
    restraint: 'tether', stance: 'platform',
    facts: [
      ['Rated capacity', '3,000 lb at 24 in load center', 'raymond'], ['Max lift height', 'up to 456 in (the simulator uses 366 in)', 'raymond'],
      ['Battery', '36 V', 'raymond'], ['Travel speed', 'Not published. Raymond says travel speed is optimized at height based on load height and weight. Simulator uses 6.0 mph lowered', 'sim'],
      ['Lift and lower speed', 'Not published. Simulator uses 90 fpm lift and 110 fpm lower', 'sim'],
    ],
  },
  {
    id: '4750', catalogId: '4750', name: 'Raymond 4750 Sit Down Counterbalanced', short: '4750 Sit Down', kind: 'cbSit',
    blurb: 'Four wheel sit down counterbalanced truck. Rear wheel steering, so the back end swings out when you turn. Wear the seat belt.',
    capacityLb: 5000, lcIn: 24, maxLiftIn: 189, publishedMaxIn: null,
    speedMph: 11.5, speedLoadedMph: 10.5, liftFpm: [124, 84], lowerFpm: 110,
    steer: 'rearSteer', L: 1.5, maxSteerDeg: 78, width: 1.1,
    reach: 0, tilt: [-5, 6], sideshift: 0.1, freeLift: 1.3, stages: 3,
    truckKg: 4200, cgZ: -1.0, cgY: 0.7, track: 0.92,
    restraint: 'seatbelt', stance: 'seated',
    facts: [
      ['Rated capacity', '3,000 to 12,000 lb by model (the simulator uses a 5,000 lb truck)', 'raymond'], ['Travel speed', 'up to 12 mph; 11.5 mph on the 3,000 lb sell sheet', 'raymond'],
      ['Lift speed', '84 fpm loaded, 124 fpm empty (3,000 lb sell sheet)', 'raymond'], ['Battery', '36 or 48 V', 'raymond'],
      ['Max lift height, tilt, sideshift', 'Not published on the model page. Simulator uses 189 in, 5 degrees forward to 6 degrees back, 4 in sideshift', 'sim'],
    ],
  },
  {
    id: '4260', catalogId: '4260', name: 'Raymond 4260 Stand Up Counterbalanced', short: '4260 Stand Up', kind: 'cbStand',
    blurb: 'Compact stand up counterbalanced truck for docks and trailers. Steer tiller, single axis control handle, sideshift and automatic tilt leveling.',
    capacityLb: 4000, lcIn: 24, maxLiftIn: 189, publishedMaxIn: null,
    speedMph: 8.0, speedLoadedMph: 7.5, liftFpm: [110, 80], lowerFpm: 110,
    steer: 'rearSteer', L: 1.3, maxSteerDeg: 80, width: 1.07,
    reach: 0, tilt: [-5, 6], sideshift: 0.1, freeLift: 1.2, stages: 3,
    truckKg: 3700, cgZ: -0.95, cgY: 0.65, track: 0.9,
    restraint: null, stance: 'stand rear', autoLevel: true,
    facts: [
      ['Rated capacity', '3,000 to 5,000 lb (the simulator uses 4,000 lb)', 'raymond'], ['Travel speed', '8.0 mph', 'raymond'], ['Battery', '36 V', 'raymond'],
      ['Controls', 'Single axis control handle, steer tiller, 4 in sideshift, automatic tilt leveling', 'raymond'],
      ['Max lift height, lift speed', 'Not published on the model page. Simulator uses 189 in and 110 fpm empty, 80 fpm loaded', 'sim'],
    ],
  },
  {
    id: '8510', catalogId: '8510', name: 'Raymond 8510 Center Rider Pallet Truck', short: '8510 Pallet Truck', kind: 'pallet',
    blurb: 'Rider pallet truck for moving pallets along the floor and loading trailers. The forks only lift a few inches.',
    capacityLb: 6000, lcIn: 24, maxLiftIn: 6.5, publishedMaxIn: null,
    speedMph: 9.0, speedLoadedMph: 6.2, liftFpm: [40, 30], lowerFpm: 50,
    steer: 'driveSteer', L: 1.95, maxSteerDeg: 90, width: 0.9, liftMin: 0.085,
    reach: 0, tilt: [0, 0], sideshift: 0, freeLift: 0, stages: 0,
    truckKg: 1500, cgZ: -1.5, cgY: 0.45, track: 0.7,
    restraint: null, stance: 'stand center',
    facts: [
      ['Rated capacity', '6,000 or 8,000 lb (the simulator uses 6,000 lb)', 'raymond'], ['Travel speed', '9 mph empty; 6.2 to 6.5 mph loaded', 'raymond'],
      ['Fork lift height and lift speed', 'Not published on the model page. Simulator uses 6.5 in of lift', 'sim'],
    ],
  },
  {
    id: '6310', catalogId: '6310', name: 'Raymond 6310 Walkie Straddle Stacker', short: '6310 Walkie Stacker', kind: 'stacker',
    blurb: 'Walk behind stacker. You steer with the tiller arm and walk with the truck. Good for light stacking and low racking.',
    capacityLb: 3000, lcIn: 24, maxLiftIn: 189, publishedMaxIn: 189,
    speedMph: 3.5, speedLoadedMph: 3.5, liftFpm: [60, 40], lowerFpm: 70,
    steer: 'driveSteer', L: 1.75, maxSteerDeg: 90, width: 1.3,
    reach: 0, tilt: [0, 0], sideshift: 0.1, freeLift: 1.2, stages: 3,
    truckKg: 1500, cgZ: -0.9, cgY: 0.6, track: 1.2,
    restraint: null, stance: 'walk',
    facts: [
      ['Rated capacity', '2,200, 3,000 or 4,000 lb (the simulator uses 3,000 lb)', 'raymond'], ['Max lift height', '189 in', 'raymond'],
      ['Travel speed', '3.5 mph', 'raymond'], ['Sideshift', 'available', 'raymond'],
      ['Lift speed', 'Not published on the model page. Simulator uses 60 fpm empty, 40 fpm loaded', 'sim'],
    ],
  },
];

// ---------- model helpers ----------
function M(geo, mat, x, y, z, parent, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
const RB = (w, h, d, r = 0.04) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01));
const BX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CY = (r1, r2, h, s = 20) => new THREE.CylinderGeometry(r1, r2, h, s);

function wheel(mats, r, w, x, y, z, parent, tyre = 'rubber') {
  const steer = new THREE.Group(); steer.position.set(x, y, z); parent.add(steer);
  const spin = new THREE.Group(); steer.add(spin);
  M(CY(r, r, w, 28), tyre === 'poly' ? mats.poly : mats.rubber, 0, 0, 0, spin, 0, 0, Math.PI / 2);
  M(CY(r * 0.62, r * 0.62, w + 0.01, 20), mats.hub, 0, 0, 0, spin, 0, 0, Math.PI / 2);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; M(CY(0.012, 0.012, w + 0.02, 6), mats.chrome, 0, Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, spin, 0, 0, Math.PI / 2); }
  return { steer, spin, r };
}

function overheadGuard(mats, w, z0, z1, h, parent, frontPosts = true, rearPosts = true) {
  const g = new THREE.Group(); parent.add(g); const t = 0.07;
  if (frontPosts) for (const s of [-1, 1]) M(BX(t, h, t), mats.black, s * (w / 2 - t / 2), h / 2, z1, g);
  if (rearPosts) for (const s of [-1, 1]) M(BX(t, h, t), mats.black, s * (w / 2 - t / 2), h / 2, z0, g);
  M(BX(w, 0.06, t), mats.black, 0, h, z1, g); M(BX(w, 0.06, t), mats.black, 0, h, z0, g);
  for (const s of [-1, 1]) M(BX(t, 0.06, z1 - z0), mats.black, s * (w / 2 - t / 2), h, (z0 + z1) / 2, g);
  const n = Math.max(3, Math.round((z1 - z0) / 0.13));
  for (let i = 1; i < n; i++) M(BX(w - 0.1, 0.035, 0.035), mats.black, 0, h + 0.01, z0 + (z1 - z0) * i / n, g);
  return g;
}

function operator(mats, pose) {
  const g = new THREE.Group();
  const skin = mats.skin, vest = mats.vest, pants = mats.pants;
  const sit = pose === 'seated';
  const torso = M(new THREE.CapsuleGeometry(0.17, 0.42, 6, 12), vest, 0, sit ? 0.95 : 1.25, 0, g);
  M(new THREE.SphereGeometry(0.115, 16, 12), skin, 0, sit ? 1.38 : 1.68, 0.01, g);
  M(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.helmet, 0, sit ? 1.41 : 1.71, 0.01, g);
  if (sit) {
    for (const s of [-1, 1]) { M(new THREE.CapsuleGeometry(0.07, 0.38, 4, 8), pants, s * 0.1, 0.62, 0.22, g, Math.PI / 2); M(new THREE.CapsuleGeometry(0.065, 0.36, 4, 8), pants, s * 0.1, 0.38, 0.44, g); }
    for (const s of [-1, 1]) M(new THREE.CapsuleGeometry(0.05, 0.4, 4, 8), vest, s * 0.22, 1.05, 0.18, g, 1.1);
  } else {
    for (const s of [-1, 1]) M(new THREE.CapsuleGeometry(0.075, 0.7, 4, 8), pants, s * 0.1, 0.5, 0, g);
    for (const s of [-1, 1]) M(new THREE.CapsuleGeometry(0.05, 0.42, 4, 8), vest, s * 0.22, 1.25, 0.12, g, 0.9);
  }
  return g;
}

// mast with telescoping stages, chains, cylinders, carriage, backrest and forks
function buildMast(mats, o) {
  const mast = new THREE.Group();
  const stages = [];
  const n = o.stages, W = o.width, C = o.C;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Group(); mast.add(s); stages.push(s);
    const x = W / 2 - 0.05 - i * 0.075, z = -i * 0.03;
    for (const sg of [-1, 1]) {
      M(BX(0.05, C, 0.11), mats.black, sg * x, C / 2, z, s);           // web
      M(BX(0.09, C, 0.016), mats.black, sg * (x - 0.02), C / 2, z + 0.055, s); // flange
      M(BX(0.09, C, 0.016), mats.black, sg * (x - 0.02), C / 2, z - 0.055, s);
    }
    M(BX(2 * x + 0.05, 0.09, 0.1), mats.black, 0, C - 0.05, z, s);       // top tie bar
    if (i === 0) M(BX(2 * x + 0.05, 0.12, 0.1), mats.black, 0, 0.12, z, s);
    if (i > 0) for (const sg of [-1, 1]) M(CY(0.05, 0.05, 0.05, 16), mats.chrome, sg * (x - 0.07), C - 0.05, z + 0.07, s, 0, 0, Math.PI / 2); // chain sheaves
  }
  // lift cylinders (barrels on outer stage, rods move)
  const rods = [];
  for (const sg of [-1, 1]) {
    M(CY(0.045, 0.045, C * 0.92, 16), mats.black, sg * (W / 2 - 0.2), C * 0.46, -0.1, stages[0]);
    const rod = M(CY(0.028, 0.028, C * 0.9, 12), mats.chrome, sg * (W / 2 - 0.2), C * 0.46, -0.1, mast); rods.push(rod);
  }
  // carriage
  const carriage = new THREE.Group(); mast.add(carriage);
  const cw = o.carriageW;
  const reachG = new THREE.Group(); carriage.add(reachG);
  const plate = new THREE.Group(); reachG.add(plate); // sideshift group
  M(BX(cw, 0.11, 0.06), mats.black, 0, 0.36, 0.08, plate); M(BX(cw, 0.11, 0.06), mats.black, 0, 0.06, 0.08, plate);
  for (const sg of [-1, 1]) M(BX(0.06, 0.45, 0.06), mats.black, sg * (cw / 2 - 0.03), 0.21, 0.08, plate);
  // load backrest
  const lbr = o.backrest;
  for (let i = 0; i <= 6; i++) M(BX(0.025, lbr, 0.025), mats.black, -cw / 2 + 0.03 + i * (cw - 0.06) / 6, 0.42 + lbr / 2, 0.08, plate);
  M(BX(cw, 0.04, 0.04), mats.black, 0, 0.42 + lbr, 0.08, plate);
  M(BX(cw, 0.04, 0.04), mats.black, 0, 0.42 + lbr * 0.55, 0.08, plate);
  // forks
  const forkFrame = new THREE.Object3D(); forkFrame.position.set(0, 0, 0.12); plate.add(forkFrame);
  const ft = o.forkT, fw = 0.1, fl = o.forkLen;
  for (const sg of [-1, 1]) {
    const f = new THREE.Group(); f.position.set(sg * o.spread / 2, 0, 0.12); plate.add(f);
    M(BX(fw, 0.48, ft), mats.fork, 0, 0.24 - ft / 2 + ft / 2, -ft / 2, f);
    const blade = new THREE.Shape(); blade.moveTo(0, 0); blade.lineTo(fl, 0); blade.lineTo(fl, ft * 0.35); blade.lineTo(fl - 0.12, ft); blade.lineTo(0, ft); blade.lineTo(0, 0);
    const bg = new THREE.ExtrudeGeometry(blade, { depth: fw, bevelEnabled: false }); bg.rotateY(-Math.PI / 2); bg.translate(fw / 2, -ft, 0);
    M(bg, mats.fork, 0, ft / 2 * 0 , 0, f).position.y = 0;
    M(BX(fw + 0.02, 0.06, 0.05), mats.fork, 0, 0.36, -0.06, f); // hook
  }
  // chains: from sheave on inner stage down to carriage
  const chains = [];
  for (const sg of [-1, 1]) { const ch = M(BX(0.035, 1, 0.02), mats.chain, sg * (W / 2 - 0.2), 0.5, 0.0, mast); chains.push(ch); }
  return { mast, stages, carriage, reachG, plate, forkFrame, chains, rods, C, n };
}

export function buildTruck(spec, mats) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const parts = { root, body, wheels: [], steerWheels: [], driveWheel: null };
  const red = mats.red, black = mats.black, grey = mats.grey;
  const maxH = spec.maxLiftIn * IN;
  const k = spec.kind;
  let mastInfo = null;

  const addMast = (z, width, C, extra = {}) => {
    mastInfo = buildMast(mats, Object.assign({ stages: spec.stages, width, C, carriageW: width + 0.08, backrest: 1.0, forkT: 0.045, forkLen: 42 * IN, spread: 0.5 }, extra));
    const tilt = new THREE.Group(); tilt.position.set(0, extra.baseY || 0.05, z); tilt.add(mastInfo.mast); body.add(tilt); mastInfo.tiltG = tilt; return mastInfo;
  };

  if (k === 'reach') {
    // power unit
    M(RB(1.12, 0.95, 1.2, 0.08), red, 0, 0.6, -1.35, body);
    M(RB(1.1, 0.12, 1.18, 0.03), mats.rubberDark, 0, 0.08, -1.35, body);
    M(RB(0.5, 0.35, 0.42, 0.05), red, -0.28, 1.25, -1.05, body); // control console
    M(BX(0.22, 0.14, 0.02), mats.screen, -0.28, 1.36, -0.835, body, -0.35);
    M(CY(0.025, 0.025, 0.22, 10), black, -0.15, 1.5, -1.05, body, 0.3); // control handle
    M(new THREE.SphereGeometry(0.05, 12, 10), mats.rubberDark, -0.15, 1.6, -1.02, body);
    M(CY(0.12, 0.12, 0.03, 20), black, -0.42, 1.43, -1.25, body, 0, 0, 0.6); // steer tiller disc
    M(BX(0.45, 0.04, 0.55), mats.rubberDark, 0.18, 0.18, -1.55, body); // operator floor mat
    // battery cover and side panels
    M(BX(1.0, 0.03, 0.7), grey, 0, 1.08, -1.6, body);
    for (const s of [-1, 1]) M(BX(0.02, 0.3, 1.0), mats.decal, s * 0.565, 0.75, -1.35, body);
    overheadGuard(mats, 1.12, -1.9, -0.82, 2.35, body);
    // baselegs with load wheels
    for (const s of [-1, 1]) {
      M(RB(0.14, 0.2, 1.05, 0.03), red, s * 0.52, 0.13, -0.38, body);
      M(BX(0.14, 0.03, 0.15), mats.stripe, s * 0.52, 0.235, 0.07, body);
      const w = wheel(mats, 0.09, 0.1, s * 0.52, 0.09, 0.0, body, 'poly'); parts.wheels.push(w);
    }
    const dw = wheel(mats, 0.17, 0.12, 0.25, 0.17, -1.45, body, 'poly'); parts.driveWheel = dw; parts.steerWheels.push(dw); parts.wheels.push(dw);
    const cw = wheel(mats, 0.08, 0.08, -0.38, 0.08, -1.45, body, 'poly'); parts.wheels.push(cw);
    addMast(-0.68, 0.95, (maxH - spec.freeLift) / 2 + 0.55, { carriageW: 1.0 });
    mastInfo.faceZ = 0.18; // fork face ahead of mast when retracted
    // scissor arms
    mastInfo.scissor = [];
    for (const s of [-1, 1]) { const a = M(BX(0.04, 0.05, 1), black, s * 0.3, 0.25, 0, mastInfo.carriage); mastInfo.scissor.push(a); }
    parts.op = operator(mats, 'stand'); parts.op.position.set(0.15, 0.2, -1.5); parts.op.rotation.y = Math.PI / 2; body.add(parts.op);
    parts.eye = new THREE.Vector3(0.12, 1.85, -1.45);
    parts.foot = { x0: -0.56, x1: 0.56, z0: -1.95, z1: 0.17 }; parts.core = { x0: -0.56, x1: 0.56, z0: -1.95, z1: -0.7 };
  }

  if (k === 'orderpicker') {
    M(RB(1.12, 1.0, 0.85, 0.08), red, 0, 0.62, -2.3, body);
    M(RB(1.1, 0.12, 0.83, 0.03), mats.rubberDark, 0, 0.08, -2.3, body);
    for (const s of [-1, 1]) M(BX(0.02, 0.3, 0.7), mats.decal, s * 0.565, 0.75, -2.3, body);
    for (const s of [-1, 1]) {
      M(RB(0.14, 0.17, 2.0, 0.03), red, s * 0.53, 0.11, -0.65, body);
      const w = wheel(mats, 0.08, 0.1, s * 0.53, 0.08, 0.0, body, 'poly'); parts.wheels.push(w);
    }
    const dw = wheel(mats, 0.17, 0.12, 0.0, 0.17, -2.15, body, 'poly'); parts.driveWheel = dw; parts.steerWheels.push(dw); parts.wheels.push(dw);
    addMast(-1.75, 1.0, (maxH) / 2 + 0.6, { carriageW: 1.05, backrest: 0.01, forkLen: 42 * IN, baseY: 0.2 });
    mastInfo.faceZ = 1.2; // carriage sits forward of mast: platform between
    // operator platform rides with the carriage
    const plat = new THREE.Group(); mastInfo.plate.add(plat); mastInfo.platform = plat;
    M(BX(1.05, 0.08, 1.0), mats.grey, 0, 0.04, -0.55, plat); M(BX(1.0, 0.01, 0.95), mats.rubberDark, 0, 0.085, -0.55, plat);
    M(RB(0.9, 0.95, 0.18, 0.04), red, 0, 0.55, -0.12, plat); // front console
    M(BX(0.3, 0.18, 0.02), mats.screen, 0, 0.98, -0.21, plat, -0.4);
    for (const s of [-1, 1]) M(CY(0.03, 0.03, 0.3, 10), black, s * 0.25, 1.1, -0.2, plat, 0.2);
    overheadGuard(mats, 1.05, -1.0, -0.1, 2.15, plat);
    for (const s of [-1, 1]) { M(BX(0.04, 0.04, 0.9), mats.yellow, s * 0.5, 1.0, -0.55, plat); M(BX(0.04, 1.0, 0.04), mats.yellow, s * 0.5, 0.5, -0.95, plat); }
    // tether anchor point
    M(new THREE.TorusGeometry(0.05, 0.012, 8, 16), mats.yellow, 0, 2.05, -0.55, plat);
    parts.tether = M(CY(0.01, 0.01, 0.9, 6), mats.yellow, 0, 1.6, -0.55, plat); parts.tether.visible = false;
    parts.op = operator(mats, 'stand'); parts.op.position.set(0, 0.09, -0.55); plat.add(parts.op);
    parts.eyeParent = plat; parts.eye = new THREE.Vector3(0, 1.8, -0.5);
    parts.foot = { x0: -0.6, x1: 0.6, z0: -2.75, z1: 0.35 }; parts.core = { x0: -0.6, x1: 0.6, z0: -2.75, z1: -1.1 };
  }

  if (k === 'cbSit' || k === 'cbStand') {
    const sit = k === 'cbSit';
    const len = sit ? 2.25 : 1.95, w = spec.width;
    // counterweight (rounded rear)
    M(RB(w, 1.05, sit ? 0.75 : 0.65, 0.16), red, 0, 0.62, -len + (sit ? 0.42 : 0.37), body);
    M(RB(w - 0.02, 0.28, 0.2, 0.08), red, 0, 1.12, -len + 0.15, body);
    M(BX(w - 0.2, 0.06, 0.05), mats.rubberDark, 0, 0.35, -len + 0.03, body);
    // frame and battery compartment
    M(RB(w, 0.65, len - 0.7, 0.05), red, 0, 0.5, -len / 2 + 0.05, body);
    M(BX(w - 0.12, 0.03, 0.75), grey, 0, 0.84, -0.75, body);
    // fenders and steps
    for (const s of [-1, 1]) { M(RB(0.18, 0.12, 0.7, 0.04), black, s * (w / 2 - 0.05), 0.68, 0, body); M(BX(0.25, 0.04, 0.3), mats.stripe, s * (w / 2 - 0.1), 0.24, -0.45, body); }
    for (const s of [-1, 1]) M(BX(0.02, 0.25, 0.9), mats.decal, s * (w / 2 + 0.005), 0.55, -0.9, body);
    if (sit) {
      M(RB(0.5, 0.12, 0.48, 0.05), mats.seat, 0, 0.98, -1.05, body); M(RB(0.5, 0.5, 0.1, 0.05), mats.seat, 0, 1.28, -1.3, body);
      M(BX(0.6, 0.35, 0.25), red, 0, 1.02, -0.35, body); // cowl
      const sw = M(new THREE.TorusGeometry(0.17, 0.02, 10, 28), black, 0, 1.33, -0.55, body, -1.0); parts.steeringWheel = sw;
      M(CY(0.025, 0.025, 0.35, 10), black, 0, 1.2, -0.48, body, -1.0);
      for (let i = 0; i < 4; i++) M(CY(0.012, 0.012, 0.18, 6), black, -0.3 + i * 0.05, 1.22, -0.35, body, -0.3);
      M(BX(0.14, 0.1, 0.02), mats.screen, 0.18, 1.28, -0.38, body, -0.5);
      parts.belt = M(BX(0.45, 0.05, 0.02), mats.orange, 0, 1.05, -0.88, body, 0, 0, 0.4); parts.belt.visible = false;
      overheadGuard(mats, w, -1.55, -0.2, 2.15, body);
      parts.op = operator(mats, 'seated'); parts.op.position.set(0, 0.45, -1.05); body.add(parts.op);
      parts.eye = new THREE.Vector3(0, 1.75, -1.0);
    } else {
      M(BX(0.7, 0.04, 0.55), mats.rubberDark, 0, 0.2, -0.95, body);
      M(RB(0.55, 0.45, 0.18, 0.04), red, 0, 1.1, -0.62, body); // dash
      M(BX(0.16, 0.1, 0.02), mats.screen, 0.12, 1.28, -0.53, body, -0.4);
      M(CY(0.025, 0.025, 0.2, 10), black, -0.2, 1.42, -0.62, body, 0.3); M(new THREE.SphereGeometry(0.05, 12, 10), mats.rubberDark, -0.2, 1.52, -0.6, body);
      const sw = M(CY(0.11, 0.11, 0.03, 20), black, 0.22, 1.36, -0.72, body, 0.5); parts.steeringWheel = sw;
      overheadGuard(mats, w, -1.35, -0.2, 2.15, body);
      parts.op = operator(mats, 'stand'); parts.op.position.set(0, 0.2, -0.95); body.add(parts.op);
      parts.eye = new THREE.Vector3(0, 1.88, -0.9);
    }
    // wheels: front drive (fixed), rear steer
    for (const s of [-1, 1]) { const fw = wheel(mats, sit ? 0.27 : 0.24, 0.2, s * (w / 2 - 0.13), sit ? 0.27 : 0.24, 0, body); parts.wheels.push(fw); }
    for (const s of [-1, 1]) { const rw = wheel(mats, 0.2, 0.15, s * (w / 2 - 0.16), 0.2, -spec.L, body); parts.wheels.push(rw); parts.steerWheels.push(rw); }
    addMast(0.28, 0.82, (maxH - spec.freeLift) / 2 + 0.45, { carriageW: 0.95, baseY: 0.08 });
    mastInfo.faceZ = 0.12;
    parts.foot = { x0: -w / 2 - 0.02, x1: w / 2 + 0.02, z0: -len - 0.05, z1: 0.39 }; parts.core = parts.foot;
  }

  if (k === 'pallet') {
    // power unit with center rider compartment, forks trailing
    M(RB(0.9, 0.95, 0.75, 0.08), red, 0, 0.58, -2.05, body);
    M(RB(0.88, 0.12, 0.73, 0.03), mats.rubberDark, 0, 0.08, -2.05, body);
    M(RB(0.9, 0.55, 0.45, 0.05), red, 0, 0.32, -1.5, body);
    M(BX(0.6, 0.04, 0.5), mats.rubberDark, 0, 0.62, -1.5, body); // rider platform raised deck
    M(RB(0.85, 0.45, 0.25, 0.06), red, 0, 0.85, -1.18, body); // backrest / load side
    for (const s of [-1, 1]) M(CY(0.025, 0.025, 1.0, 8), black, s * 0.38, 1.1, -1.65, body, Math.PI / 2);
    for (const s of [-1, 1]) M(BX(0.03, 0.5, 0.03), black, s * 0.38, 0.85, -1.15, body);
    const sw = M(CY(0.13, 0.13, 0.03, 20), black, 0, 1.35, -1.85, body, -0.6); parts.steeringWheel = sw;
    M(BX(0.14, 0.09, 0.02), mats.screen, 0.25, 1.15, -1.75, body, -0.6);
    for (const s of [-1, 1]) M(BX(0.02, 0.3, 0.6), mats.decal, s * 0.455, 0.65, -2.05, body);
    const dw = wheel(mats, 0.13, 0.11, 0.0, 0.13, -1.95, body, 'poly'); parts.driveWheel = dw; parts.steerWheels.push(dw); parts.wheels.push(dw);
    // fork assembly (lifts as a unit)
    const liftG = new THREE.Group(); body.add(liftG);
    const forkFrame = new THREE.Object3D(); forkFrame.position.set(0, 0, -0.95); liftG.add(forkFrame);
    M(BX(0.86, 0.35, 0.12), red, 0, 0.22, -1.0, liftG);
    for (const s of [-1, 1]) {
      M(BX(0.17, 0.06, 48 * IN), mats.black, s * 0.26, -0.03, -0.95 + 24 * IN, liftG);
      const lw = wheel(mats, 0.04, 0.12, s * 0.26, 0.04, 0.0, body, 'poly'); parts.wheels.push(lw);
    }
    mastInfo = { mast: liftG, stages: [], carriage: liftG, reachG: liftG, plate: liftG, forkFrame, chains: [], rods: [], C: 0, n: 0, faceZ: 0, tiltG: null, simple: true };
    parts.op = operator(mats, 'stand'); parts.op.position.set(0, 0.62, -1.5); body.add(parts.op);
    parts.eye = new THREE.Vector3(0, 2.25, -1.55);
    parts.foot = { x0: -0.46, x1: 0.46, z0: -2.45, z1: 0.3 }; parts.core = { x0: -0.46, x1: 0.46, z0: -2.45, z1: -1.05 };
    parts.forkT = 0.06; parts.forkBase = 0.085;
  }

  if (k === 'stacker') {
    M(RB(0.8, 1.1, 0.6, 0.08), red, 0, 0.65, -1.8, body);
    for (const s of [-1, 1]) M(BX(0.02, 0.3, 0.45), mats.decal, s * 0.405, 0.75, -1.8, body);
    M(RB(0.82, 0.12, 0.62, 0.03), mats.rubberDark, 0, 0.07, -1.8, body);
    // straddle legs outside the pallet
    for (const s of [-1, 1]) {
      M(RB(0.13, 0.12, 1.55, 0.03), red, s * 0.62, 0.07, -0.65, body);
      const w = wheel(mats, 0.065, 0.08, s * 0.62, 0.065, 0.0, body, 'poly'); parts.wheels.push(w);
    }
    M(BX(1.37, 0.12, 0.15), red, 0, 0.07, -1.45, body);
    const dw = wheel(mats, 0.12, 0.08, 0.0, 0.12, -1.75, body, 'poly'); parts.driveWheel = dw; parts.steerWheels.push(dw); parts.wheels.push(dw);
    // tiller arm
    const tiller = new THREE.Group(); tiller.position.set(0, 1.0, -2.05); body.add(tiller);
    M(CY(0.025, 0.025, 1.0, 10), black, 0, 0.0, -0.4, tiller, -1.0);
    M(RB(0.4, 0.08, 0.1, 0.03), black, 0, 0.25, -0.8, tiller, -0.2);
    parts.tiller = tiller;
    addMast(-1.4, 1.2, (maxH - spec.freeLift) / 2 + 0.5, { carriageW: 0.95, backrest: 0.8 });
    mastInfo.faceZ = 0.12;
    parts.op = operator(mats, 'stand'); parts.op.position.set(0, 0, -3.1); body.add(parts.op);
    parts.eye = new THREE.Vector3(0, 1.7, -3.0);
    parts.foot = { x0: -0.7, x1: 0.7, z0: -2.15, z1: 0.1 }; parts.core = { x0: -0.42, x1: 0.42, z0: -2.15, z1: -1.3 };
  }

  // amber beacon and blue pedestrian spot on top of guard / body
  const beacon = M(CY(0.05, 0.06, 0.1, 16), mats.beacon, 0, k === 'pallet' ? 1.5 : (k === 'stacker' ? 1.25 : (k === 'orderpicker' ? 1.3 : 2.45)), k === 'pallet' ? -2.25 : (k === 'stacker' ? -1.8 : (k === 'orderpicker' ? -2.4 : (k === 'reach' ? -1.85 : -1.5))), body);
  parts.beacon = beacon; beacon.userData = { onMat: mats.beaconOn, offMat: mats.beacon };
  parts.mast = mastInfo;
  parts.maxH = maxH;
  if (!parts.forkT) parts.forkT = 0.045;
  if (parts.forkBase === undefined) parts.forkBase = 0.045;
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return parts;
}

// Pose the model from the simulation state
export function poseTruck(parts, st, spec, time) {
  const m = parts.mast;
  for (const w of parts.wheels) w.spin.rotation.x = st.odo / w.r;
  for (const w of parts.steerWheels) w.steer.rotation.y = -st.steer;
  if (parts.steeringWheel) parts.steeringWheel.rotation.z = st.steer * 3;
  if (parts.tiller) parts.tiller.rotation.y = -st.steer;
  if (m.simple) {
    m.mast.position.y = st.lift;
  } else {
    const h = st.lift, F = spec.freeLift, C = m.C;
    const E = Math.max(0, h - F);
    if (m.n === 3) { m.stages[1].position.y = E / 2; m.stages[2].position.y = E; }
    else if (m.n === 2) m.stages[1].position.y = E;
    m.carriage.position.y = h;
    m.carriage.position.z = m.faceZ - 0.12;
    m.reachG.position.z = st.reach;
    m.plate.position.x = st.side;
    m.plate.rotation.x = spec.kind === 'reach' ? -st.tilt * Math.PI / 180 : 0;
    if (m.tiltG && spec.kind !== 'reach') m.tiltG.rotation.x = -st.tilt * Math.PI / 180;
    for (const r of m.rods) r.position.y = C * 0.46 + E;
    const sheave = m.n === 3 ? C - 0.05 + E : C;
    for (const ch of m.chains) { const top = (m.n === 3 ? E / 2 : 0) + C - 0.05; const bot = h + 0.3; const len = Math.max(0.05, top - bot); ch.scale.y = len; ch.position.y = bot + len / 2; ch.visible = top > bot; }
    if (m.scissor) for (const a of m.scissor) { const L = st.reach + 0.14; a.scale.z = Math.hypot(L, 0.25); a.position.set(a.position.x, 0.25, L / 2); a.rotation.x = (a.position.x > 0 ? 1 : -1) * Math.atan2(0.25, L); }
  }
  if (parts.tether) parts.tether.visible = !!st.restraint;
  if (parts.belt) parts.belt.visible = !!st.restraint;
  const on = Math.sin(time * 12) > 0.3 && st.keyOn;
  parts.beacon.material = on ? parts.beacon.userData.onMat || parts.beacon.material : parts.beacon.userData.offMat || parts.beacon.material;
}
