// Warehouse world: building, racking, dock, markings, pallets, pedestrians and collision data.
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/BufferGeometryUtils.js';
import * as T from './textures.js';

export const IN = 0.0254, LB = 0.45359237;
export const PALLET = { L: 48 * IN, W: 40 * IN, H: 0.14, pocketLow: 0.016, pocketHigh: 0.124, stringers: [-0.47, 0, 0.47], stringerHalf: 0.019, pocketEdge: 0.451 };
export const RACK = { bay: 2.74, depth: 1.07, levels: [0, 1.7, 3.4, 5.1, 6.8], beamH: 0.12, beamD: 0.05, upright: 0.08, top: 8.3, x0: -20, bays: 13 };
export const BOUNDS = { minX: -30, maxX: 30, minZ: -24, maxZ: 24, h: 12 };

const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };

let palletGeo = null;
export function getPalletGeometry() {
  if (palletGeo) return palletGeo;
  const P = PALLET, parts = [];
  for (const z of [-0.54, 0, 0.54]) parts.push(box(P.W, 0.016, 0.14, 0, 0.008, z));
  for (const x of P.stringers) parts.push(box(0.038, 0.108, P.L, x, 0.07, 0));
  for (let i = 0; i < 7; i++) parts.push(box(P.W, 0.016, 0.135, 0, 0.132, -P.L / 2 + 0.0675 + i * (P.L - 0.135) / 6));
  palletGeo = mergeGeometries(parts); return palletGeo;
}

export class World {
  constructor(scene, mats) {
    this.scene = scene; this.mats = mats;
    this.colliders2D = []; // {minX,maxX,minZ,maxZ,name}
    this.colliders3D = []; // {min:Vector3,max:Vector3,name}
    this.supports = [];    // rack beam pairs
    this.slots = [];       // rack pallet positions {x,z,y,yaw,row,bay,level,occupied}
    this.pallets = [];     // dynamic pallets
    this.peds = [];
    this.hornZones = [];   // {x,z,r,name}
    this.group = new THREE.Group(); scene.add(this.group);
    this.dynGroup = new THREE.Group(); scene.add(this.dynGroup);
    this.build();
  }

  addMesh(geo, mat, x = 0, y = 0, z = 0, cast = true, recv = true, parent = this.group) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m;
  }
  wall2D(minX, maxX, minZ, maxZ, name = 'wall') { this.colliders2D.push({ minX, maxX, minZ, maxZ, name }); this.colliders3D.push({ min: new THREE.Vector3(minX, -1, minZ), max: new THREE.Vector3(maxX, 20, maxZ), name }); }

  build() {
    const B = BOUNDS, M = this.mats;
    // floor
    const conc = T.concrete(); conc.map.repeat.set(12, 10); conc.rough.repeat.set(12, 10);
    const floorMat = new THREE.MeshStandardMaterial({ map: conc.map, roughnessMap: conc.rough, roughness: 0.85, metalness: 0.0, envMapIntensity: 0.6 });
    const floor = this.addMesh(new THREE.PlaneGeometry(B.maxX - B.minX, B.maxZ - B.minZ), floorMat, 0, 0, 0, false, true); floor.rotation.x = -Math.PI / 2;
    // yard outside the dock (lower)
    const yard = this.addMesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x4a4a48, roughness: 0.95 }), 0, -1.2, B.maxZ + 20, false, true); yard.rotation.x = -Math.PI / 2;
    // walls
    const corr = T.corrugated(); corr.repeat.set(30, 1);
    const wallMat = new THREE.MeshStandardMaterial({ map: corr, color: 0xdfe3e6, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide });
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: 0.9 });
    const W = B.maxX - B.minX, D = B.maxZ - B.minZ, H = B.h;
    const walls = [[W, 0, B.minZ, 0], [D, B.minX, 0, Math.PI / 2], [D, B.maxX, 0, -Math.PI / 2]];
    for (const [len, x, z, ry] of walls) {
      const m = this.addMesh(new THREE.PlaneGeometry(len, H), wallMat, x, H / 2, z, false, true); m.rotation.y = ry;
      const k = this.addMesh(new THREE.BoxGeometry(len, 1.2, 0.2), blockMat, x, 0.6, z, false, true); k.rotation.y = ry;
    }
    // south wall with dock doors
    this.doors = [-15, -5, 5, 15]; this.openDoor = 5;
    const southMat = wallMat.clone(); southMat.map = corr.clone(); southMat.map.repeat.set(4, 1); southMat.map.needsUpdate = true;
    let last = B.minX;
    for (const dx of this.doors) {
      const a = dx - 1.6; const seg = a - last; const m = this.addMesh(new THREE.PlaneGeometry(seg, H), southMat, last + seg / 2, H / 2, B.maxZ, false, true); m.rotation.y = Math.PI;
      const top = this.addMesh(new THREE.PlaneGeometry(3.2, H - 3.4), southMat, dx, 3.4 + (H - 3.4) / 2, B.maxZ, false, true); top.rotation.y = Math.PI;
      last = dx + 1.6;
      // door frame and bumpers
      const frame = new THREE.MeshStandardMaterial({ map: T.stripes(), roughness: 0.6 });
      this.addMesh(new THREE.BoxGeometry(0.15, 3.4, 0.25), frame, dx - 1.68, 1.7, B.maxZ - 0.05);
      this.addMesh(new THREE.BoxGeometry(0.15, 3.4, 0.25), frame, dx + 1.68, 1.7, B.maxZ - 0.05);
      this.addMesh(new THREE.BoxGeometry(0.25, 0.35, 0.12), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }), dx - 1.2, 0.0 - 0.6, B.maxZ + 0.08);
      this.addMesh(new THREE.BoxGeometry(0.25, 0.35, 0.12), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }), dx + 1.2, 0.0 - 0.6, B.maxZ + 0.08);
      // dock edge stripe
      const edge = this.addMesh(new THREE.BoxGeometry(3.2, 0.02, 0.3), new THREE.MeshStandardMaterial({ map: T.stripes(), roughness: 0.6 }), dx, 0.01, B.maxZ - 0.15, false, true);
      if (dx !== this.openDoor) {
        const door = this.addMesh(new THREE.BoxGeometry(3.2, 3.4, 0.06), new THREE.MeshStandardMaterial({ map: (() => { const t = T.corrugated(); t.rotation = Math.PI / 2; t.repeat.set(1, 6); return t; })(), color: 0xc9ccd0, metalness: 0.4, roughness: 0.5 }), dx, 1.7, B.maxZ - 0.03);
        this.wall2D(dx - 1.6, dx + 1.6, B.maxZ - 0.1, B.maxZ + 1, 'dock door');
      } else {
        // dock leveler plate
        this.addMesh(new THREE.BoxGeometry(2.0, 0.04, 0.6), new THREE.MeshStandardMaterial({ color: 0x5c5f63, metalness: 0.7, roughness: 0.45 }), dx, 0.02, B.maxZ + 0.25);
        this.buildTrailer(dx);
        // drop off the dock beside the leveler
        this.wall2D(dx - 1.6, dx - 1.0, B.maxZ, B.maxZ + 1, 'dock edge');
        this.wall2D(dx + 1.0, dx + 1.6, B.maxZ, B.maxZ + 1, 'dock edge');
      }
    }
    { const seg = B.maxX - last; const m = this.addMesh(new THREE.PlaneGeometry(seg, H), southMat, last + seg / 2, H / 2, B.maxZ, false, true); m.rotation.y = Math.PI; }
    this.addMesh(new THREE.BoxGeometry(W, 1.2, 0.2), blockMat, 0, -0.6, B.maxZ + 0.1, false, true);
    // wall colliders (south wall segments)
    this.wall2D(B.minX - 1, B.maxX + 1, B.minZ - 1, B.minZ + 0.1, 'wall');
    this.wall2D(B.minX - 1, B.minX + 0.1, B.minZ, B.maxZ, 'wall');
    this.wall2D(B.maxX - 0.1, B.maxX + 1, B.minZ, B.maxZ, 'wall');
    last = B.minX; for (const dx of this.doors) { this.wall2D(last, dx - 1.6, B.maxZ - 0.1, B.maxZ + 1, 'wall'); last = dx + 1.6; } this.wall2D(last, B.maxX, B.maxZ - 0.1, B.maxZ + 1, 'wall');

    // roof, trusses, skylights and light fixtures
    const roof = this.addMesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.8, side: THREE.DoubleSide }), 0, H, 0, false, false); roof.rotation.x = Math.PI / 2;
    const steel = new THREE.MeshStandardMaterial({ color: 0x8b9298, metalness: 0.6, roughness: 0.5 });
    for (let x = B.minX + 5; x < B.maxX; x += 10) this.addMesh(new THREE.BoxGeometry(0.3, 0.8, D), steel, x, H - 0.5, 0, false, false);
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e8, emissiveIntensity: 2.2 });
    const housing = new THREE.MeshStandardMaterial({ color: 0x9a9fa5, metalness: 0.7, roughness: 0.35 });
    const fg = new THREE.CylinderGeometry(0.35, 0.45, 0.25, 20), lens = new THREE.CircleGeometry(0.42, 20);
    for (let x = B.minX + 5; x < B.maxX; x += 6.6) for (let z = B.minZ + 4; z < B.maxZ; z += 6) {
      this.addMesh(fg, housing, x, H - 1.4, z, false, false);
      const l = this.addMesh(lens, fixtureMat, x, H - 1.53, z, false, false); l.rotation.x = Math.PI / 2;
    }
    const sky = new THREE.MeshBasicMaterial({ color: 0xe8f2ff });
    for (let x = -20; x <= 20; x += 13.3) { const s = this.addMesh(new THREE.PlaneGeometry(3, D - 6), sky, x, H - 0.01, 0, false, false); s.rotation.x = Math.PI / 2; }

    this.buildRacks();
    this.buildMarkings();
    this.buildProps();
  }

  buildTrailer(dx) {
    const z0 = BOUNDS.maxZ + 0.55, L = 14.6, Wt = 2.5, Ht = 2.75;
    const g = new THREE.Group(); g.position.set(dx, 0, z0); this.group.add(g);
    const skin = new THREE.MeshStandardMaterial({ color: 0xe9ecef, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide });
    const floorM = new THREE.MeshStandardMaterial({ map: (() => { const t = T.wood(); t.repeat.set(1, 6); return t; })(), roughness: 0.8 });
    this.addMesh(new THREE.BoxGeometry(Wt, 0.05, L), floorM, 0, -0.025, L / 2, false, true, g);
    this.addMesh(new THREE.BoxGeometry(0.04, Ht, L), skin, -Wt / 2, Ht / 2, L / 2, true, true, g);
    this.addMesh(new THREE.BoxGeometry(0.04, Ht, L), skin, Wt / 2, Ht / 2, L / 2, true, true, g);
    this.addMesh(new THREE.BoxGeometry(Wt, 0.04, L), skin, 0, Ht, L / 2, true, true, g);
    this.addMesh(new THREE.BoxGeometry(Wt, Ht, 0.04), skin, 0, Ht / 2, L, true, true, g);
    const dark = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
    for (const z of [L - 1.2, L - 2.5]) for (const s of [-1, 1]) { const w = this.addMesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 24), dark, s * 0.95, -0.7, z, true, true, g); w.rotation.z = Math.PI / 2; }
    this.addMesh(new THREE.BoxGeometry(0.3, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: 0xf2c200 }), 0.7, -1.1, 3, true, true, g); // wheel chock
    // trailer interior walls as colliders
    this.wall2D(dx - Wt / 2 - 0.2, dx - Wt / 2 + 0.02, z0, z0 + L, 'trailer wall');
    this.wall2D(dx + Wt / 2 - 0.02, dx + Wt / 2 + 0.2, z0, z0 + L, 'trailer wall');
    this.wall2D(dx - 2, dx + 2, z0 + L - 0.02, z0 + L + 0.3, 'trailer wall');
    this.trailer = { x: dx, z0, L, W: Wt };
  }

  buildRacks() {
    const R = RACK, M = this.mats;
    // rows: front face z and facing direction (+1 faces +z, -1 faces -z)
    this.rows = [
      { name: 'A', front: -18.0, dir: 1 },
      { name: 'B', front: -14.4, dir: -1 }, { name: 'C', front: -12.11, dir: 1 },
      { name: 'D', front: -8.51, dir: -1 }, { name: 'E', front: -6.22, dir: 1 },
    ];
    const upMat = new THREE.MeshStandardMaterial({ color: 0x1f4fa0, metalness: 0.45, roughness: 0.45 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xe8611a, metalness: 0.35, roughness: 0.45 });
    const braceMat = upMat;
    const upGeo = new THREE.BoxGeometry(R.upright, R.top, R.upright);
    const beamGeo = new THREE.BoxGeometry(R.bay - R.upright, R.beamH, R.beamD);
    const braceGeo = new THREE.BoxGeometry(0.03, 0.03, R.depth);
    const ups = [], beams = [], braces = [];
    const lblMats = {};
    for (const row of this.rows) {
      const zf = row.front, zb = row.front - row.dir * R.depth; // back face
      const zmin = Math.min(zf, zb), zmax = Math.max(zf, zb);
      this.colliders2D.push({ minX: R.x0 - 0.05, maxX: R.x0 + R.bays * R.bay + 0.05, minZ: zmin, maxZ: zmax, name: 'rack' });
      for (let b = 0; b <= R.bays; b++) {
        const x = R.x0 + b * R.bay;
        for (const z of [zf - row.dir * R.upright / 2, zb + row.dir * R.upright / 2]) {
          ups.push(new THREE.Matrix4().makeTranslation(x, R.top / 2, z));
          this.colliders3D.push({ min: new THREE.Vector3(x - R.upright / 2, 0, z - R.upright / 2), max: new THREE.Vector3(x + R.upright / 2, R.top, z + R.upright / 2), name: 'rack upright' });
        }
        for (let y = 0.4; y < R.top; y += 1.0) { braces.push(new THREE.Matrix4().makeTranslation(x, y, (zf + zb) / 2)); }
        // column guard at aisle end
        if (b === 0 || b === R.bays) this.addMesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), new THREE.MeshStandardMaterial({ map: T.stripes(), roughness: 0.5 }), x, 0.3, zf - row.dir * 0.08);
      }
      for (let b = 0; b < R.bays; b++) {
        const xc = R.x0 + b * R.bay + R.bay / 2;
        for (let li = 0; li < R.levels.length; li++) {
          const y = R.levels[li];
          if (li > 0) {
            for (const z of [zf - row.dir * R.beamD / 2, zb + row.dir * R.beamD / 2]) {
              beams.push(new THREE.Matrix4().makeTranslation(xc, y - R.beamH / 2, z));
              this.colliders3D.push({ min: new THREE.Vector3(xc - R.bay / 2, y - R.beamH, z - R.beamD / 2), max: new THREE.Vector3(xc + R.bay / 2, y, z + R.beamD / 2), name: 'rack beam' });
            }
            this.supports.push({ minX: xc - R.bay / 2 + R.upright / 2, maxX: xc + R.bay / 2 - R.upright / 2, frontZ: zf - row.dir * R.beamD / 2, backZ: zb + row.dir * R.beamD / 2, y, row: row.name, bay: b + 1, level: li });
          }
          for (const k of [0, 1]) {
            const x = xc + (k ? 0.67 : -0.67);
            const zc = zf - row.dir * (R.depth / 2);
            this.slots.push({ x, z: zc, y, yaw: row.dir > 0 ? Math.PI : 0, row: row.name, bay: b + 1, level: li, pos: k + 1, dir: row.dir, front: zf, occupied: false, id: `${row.name}${String(b + 1).padStart(2, '0')}${'ABCDE'[li]}${k + 1}` });
          }
        }
        // location label on first beam
        const key = row.name + (b + 1);
        const t = T.label(`${row.name} ${String(b + 1).padStart(2, '0')}`, { w: 256, h: 96, size: 56, bg: '#ffe14d' });
        const lm = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
        const pl = this.addMesh(new THREE.PlaneGeometry(0.5, 0.18), lm, xc, R.levels[1] - 0.06, zf + row.dir * 0.002, false, false);
        pl.rotation.y = row.dir > 0 ? 0 : Math.PI;
      }
    }
    const inst = (geo, mat, list) => { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; this.group.add(im); return im; };
    inst(upGeo, upMat, ups); inst(beamGeo, beamMat, beams); inst(braceGeo, braceMat, braces);
  }

  fillRacks(rng, keepFree = []) {
    // decorative static pallets in about 70% of rack slots
    if (this.staticGroup) { this.scene.remove(this.staticGroup); }
    this.staticGroup = new THREE.Group(); this.scene.add(this.staticGroup);
    this.staticColliders = [];
    const pal = [], loads = [[], [], [], []];
    for (const s of this.slots) {
      s.occupied = false;
      if (keepFree.includes(s.id)) continue;
      if (rng() < 0.3) continue;
      s.occupied = true;
      const h = 0.7 + rng() * 0.7; const v = rng() * 4 | 0;
      const m = new THREE.Matrix4().makeRotationY(s.yaw); m.setPosition(s.x, s.y, s.z); pal.push(m);
      const lm = new THREE.Matrix4().compose(new THREE.Vector3(s.x, s.y + PALLET.H + h / 2, s.z), new THREE.Quaternion(), new THREE.Vector3(PALLET.W - 0.04, h, PALLET.L - 0.06));
      loads[v].push(lm);
      this.staticColliders.push({ min: new THREE.Vector3(s.x - PALLET.W / 2, s.y, s.z - PALLET.L / 2), max: new THREE.Vector3(s.x + PALLET.W / 2, s.y + PALLET.H + h, s.z + PALLET.L / 2), name: 'stored pallet' });
    }
    const pim = new THREE.InstancedMesh(getPalletGeometry(), this.mats.wood, pal.length); pal.forEach((m, i) => pim.setMatrixAt(i, m)); pim.castShadow = pim.receiveShadow = true; this.staticGroup.add(pim);
    loads.forEach((l, v) => { if (!l.length) return; const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.mats.carton[v], l.length); l.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = im.receiveShadow = true; this.staticGroup.add(im); });
  }

  buildMarkings() {
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
    const green = new THREE.MeshStandardMaterial({ color: 0x1f9d55, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
    const line = (x1, z1, x2, z2, w, mat) => { const len = Math.hypot(x2 - x1, z2 - z1); const m = this.addMesh(new THREE.PlaneGeometry(w, len), mat, (x1 + x2) / 2, 0.003, (z1 + z2) / 2, false, true); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(x2 - x1, z2 - z1); return m; };
    // rack row boundary lines
    for (const r of this.rows) line(RACK.x0, r.front + r.dir * 0.1, RACK.x0 + RACK.bays * RACK.bay, r.front + r.dir * 0.1, 0.1, yellow);
    // main travel aisle edges
    line(-28, -1.5, 28, -1.5, 0.1, yellow); line(-28, 22, 28, 22, 0.1, yellow);
    // pedestrian walkway along west side and a crosswalk
    line(-26.5, -22, -26.5, 22, 0.1, green); line(-28.5, -22, -28.5, 22, 0.1, green);
    for (let x = -10; x <= -7; x += 0.6) line(x, -1.4, x, 2.0, 0.3, white);
    this.hornZones.push({ x: -8.5, z: 0.3, r: 3.2, name: 'crosswalk' });
    // stop bars and horn zones at aisle ends
    const aisles = [[-18.0, -14.4], [-12.11, -8.51], [-6.22, -2.62]];
    this.aisles = aisles.map(([a, b]) => ({ z: (a + b) / 2, a, b }));
    for (const [a, b] of aisles) {
      for (const x of [RACK.x0 - 0.3, RACK.x0 + RACK.bays * RACK.bay + 0.3]) {
        line(x, a + 0.2, x, b - 0.2, 0.25, white);
        this.hornZones.push({ x, z: (a + b) / 2, r: 2.0, name: 'aisle end' });
      }
    }
    // staging lanes in front of the dock
    this.lanes = [];
    for (let i = 0; i < 8; i++) {
      const x = -19 + i * 2.6; const z1 = 13.5, z2 = 20.5;
      line(x - 1.1, z1, x - 1.1, z2, 0.07, white); line(x + 1.1, z1, x + 1.1, z2, 0.07, white); line(x - 1.1, z1, x + 1.1, z1, 0.07, white);
      this.lanes.push({ x, z1, z2 });
      const t = T.label(`LANE ${i + 1}`, { w: 256, h: 64, size: 40, bg: 'rgba(0,0,0,0)', fg: '#f0f0f0' });
      const m = this.addMesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshStandardMaterial({ map: t, transparent: true, polygonOffset: true, polygonOffsetFactor: -3 }), x, 0.004, z1 - 0.4, false, true); m.rotation.x = -Math.PI / 2;
    }
  }

  buildProps() {
    // building columns
    const colMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.5, roughness: 0.5 });
    const guard = new THREE.MeshStandardMaterial({ map: T.stripes(), roughness: 0.5 });
    for (const [x, z] of [[-14, 6], [0, 6], [14, 6], [24, -12], [24, 0]]) {
      this.addMesh(new THREE.BoxGeometry(0.4, BOUNDS.h, 0.4), colMat, x, BOUNDS.h / 2, z);
      this.addMesh(new THREE.BoxGeometry(0.55, 1.2, 0.55), guard, x, 0.6, z);
      this.wall2D(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 'building column');
    }
    // battery charging area
    const charger = new THREE.MeshStandardMaterial({ color: 0x2b2f35, metalness: 0.4, roughness: 0.5 });
    for (let i = 0; i < 3; i++) {
      this.addMesh(new THREE.BoxGeometry(0.6, 1.2, 0.45), charger, -29.6, 1.4, 10 + i * 2.2);
      const s = this.addMesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x22cc66, emissiveIntensity: 1.5 }), -29.29, 1.6, 10 + i * 2.2, false, false); s.rotation.y = Math.PI / 2;
    }
    this.sign('BATTERY CHARGING\nNO SMOKING', -29.88, 3.2, 12.2, Math.PI / 2, '#ffffff', '#c8102e');
    // safety signs
    this.sign('SPEED LIMIT\n5 MPH', -10, 3.5, -23.85, 0, '#ffffff', '#111111');
    this.sign('SOUND HORN AT\nAISLE ENDS', 10, 3.5, -23.85, 0, '#ffe14d', '#111111');
    this.sign('PEDESTRIANS\nUSE WALKWAY', -29.88, 3.2, -5, Math.PI / 2, '#1f9d55', '#ffffff');
    this.sign('DOCK 3\nTRAILER IN PLACE', 5, 4.0, 23.85, Math.PI, '#ffffff', '#111111');
    this.sign('STOP\nLOOK BOTH WAYS', 22.5, 2.6, -1.0, -Math.PI / 2, '#c8102e', '#ffffff');
    // office block with window
    const office = new THREE.MeshStandardMaterial({ color: 0xcfd4d8, roughness: 0.7 });
    this.addMesh(new THREE.BoxGeometry(6, 3.2, 5), office, 26.5, 1.6, 15);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fc6e0, roughness: 0.05, metalness: 0.1, transmission: 0.0, opacity: 0.6, transparent: true });
    const w = this.addMesh(new THREE.PlaneGeometry(3.5, 1.2), glass, 23.48, 1.8, 15, false, false); w.rotation.y = -Math.PI / 2;
    this.wall2D(23.4, 30, 12.4, 17.6, 'office');
    const rail = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5, metalness: 0.3 });
    this.addMesh(new THREE.BoxGeometry(0.12, 1.1, 6.2), rail, 22.9, 0.55, 15); this.wall2D(22.8, 23.4, 11.9, 18.1, 'guard rail');
    // fire extinguisher
    this.addMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.3, metalness: 0.2 }), -29.8, 1.2, -2);
  }

  sign(text, x, y, z, ry, bg, fg) {
    const t = T.label(text, { w: 512, h: 256, size: 64, bg, fg, border: fg, borderW: 12 });
    const m = this.addMesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), x, y, z, false, false); m.rotation.y = ry; return m;
  }

  // ---------- dynamic pallets ----------
  clearPallets() { for (const p of this.pallets) this.dynGroup.remove(p.group); this.pallets = []; }
  addPallet(x, z, yaw, opts = {}) {
    const p = new Pallet(this, x, z, yaw, opts); this.pallets.push(p); this.dynGroup.add(p.group); return p;
  }

  // highest support under a footprint (corners in world xz), returns {y, full, kind, ref}
  supportUnder(p, bottomY) {
    let best = { y: 0, full: true, kind: 'floor' };
    const c = p.corners();
    const xs = c.map(q => q.x), zs = c.map(q => q.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    for (const s of this.supports) {
      if (s.y > bottomY + 0.02 || s.y <= best.y) continue;
      if (maxX < s.minX || minX > s.maxX) continue;
      const fz1 = Math.min(s.frontZ, s.backZ) - 0.025, fz2 = Math.max(s.frontZ, s.backZ) + 0.025;
      if (maxZ < fz1 || minZ > fz2) continue;
      const spansFront = minZ <= Math.min(s.frontZ, s.backZ) && maxZ >= Math.max(s.frontZ, s.backZ);
      const inX = minX >= s.minX - 0.02 && maxX <= s.maxX + 0.02;
      best = { y: s.y, full: spansFront && inX, kind: 'beam', ref: s };
    }
    for (const q of this.pallets) {
      if (q === p || q.state !== 'rest') continue;
      const top = q.y + PALLET.H + q.loadH;
      if (top > bottomY + 0.02 || top <= best.y) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d > 1.1) continue;
      best = { y: top, full: d < 0.25 && Math.abs(Math.sin(q.yaw - p.yaw)) < 0.2 && q.stackable, kind: 'pallet', ref: q };
    }
    return best;
  }

  // ---------- pedestrians ----------
  addPedestrian(path, speed = 1.25, color = 0xff7a00) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xc58c64, roughness: 0.7 });
    const vest = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.15 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x23324a, roughness: 0.8 });
    const helmet = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.45, 6, 12), vest); torso.position.y = 1.22;
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x888888, metalness: 0.6, roughness: 0.2 })); stripe.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin); head.position.y = 1.65;
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), helmet); hat.position.y = 1.68;
    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.6, 4, 8), pants); legL.geometry.translate(0, -0.37, 0); legL.position.set(-0.1, 0.9, 0);
    const legR = legL.clone(); legR.position.x = 0.1;
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), vest); armL.geometry.translate(0, -0.3, 0); armL.position.set(-0.26, 1.48, 0);
    const armR = armL.clone(); armR.position.x = 0.26;
    [torso, stripe, head, hat, legL, legR, armL, armR].forEach(m => { m.castShadow = true; g.add(m); });
    this.dynGroup.add(g);
    const ped = { g, path, i: 0, speed, x: path[0][0], z: path[0][1], yaw: 0, t: 0, legL, legR, armL, armR, wait: 0, stopped: false };
    g.position.set(ped.x, 0, ped.z); this.peds.push(ped); return ped;
  }
  clearPeds() { for (const p of this.peds) this.dynGroup.remove(p.g); this.peds = []; }
  updatePeds(dt, truck) {
    for (const p of this.peds) {
      const [tx, tz] = p.path[(p.i + 1) % p.path.length];
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      // stop if the truck is close ahead or the horn was sounded nearby
      let stop = p.wait > 0; if (p.wait > 0) p.wait -= dt;
      if (truck) {
        const tdx = truck.x - p.x, tdz = truck.z - p.z, td = Math.hypot(tdx, tdz);
        if (td < 4.5 && (tdx * dx + tdz * dz) / (d * td + 1e-6) > 0.2) stop = true;
        if (truck.hornOn && td < 14) { p.wait = 2.5; stop = true; p.heard = true; }
      }
      p.stopped = stop;
      if (!stop && d > 0.05) {
        const s = Math.min(d, p.speed * dt); p.x += dx / d * s; p.z += dz / d * s; p.t += dt * p.speed * 3.2;
        const target = Math.atan2(dx, dz); let dy = target - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * Math.min(1, dt * 6);
      }
      if (d < 0.1) p.i = (p.i + 1) % p.path.length;
      const sw = stop ? 0 : Math.sin(p.t) * 0.5;
      p.legL.rotation.x = sw; p.legR.rotation.x = -sw; p.armL.rotation.x = -sw * 0.8; p.armR.rotation.x = sw * 0.8;
      if (stop && truck) { const look = Math.atan2(truck.x - p.x, truck.z - p.z); let dy = look - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * Math.min(1, dt * 3); }
      p.g.position.set(p.x, 0, p.z); p.g.rotation.y = p.yaw;
    }
  }
}

export class Pallet {
  constructor(world, x, z, yaw, opts) {
    this.world = world; this.x = x; this.z = z; this.yaw = yaw; this.y = opts.y || 0;
    this.massKg = opts.massKg || 600; this.loadH = opts.loadH || 1.0; this.stackable = opts.stackable !== false;
    this.kind = opts.kind || 'cartons'; this.state = 'rest'; this.id = opts.id || 'P' + Math.floor(Math.random() * 1e4);
    this.rel = null; this.fallV = 0; this.tilt = 0;
    const g = new THREE.Group(); this.group = g;
    const pm = new THREE.Mesh(getPalletGeometry(), world.mats.wood); pm.castShadow = pm.receiveShadow = true; g.add(pm);
    let lm;
    if (this.kind === 'crate') {
      lm = new THREE.Mesh(new THREE.BoxGeometry(PALLET.W - 0.02, this.loadH, PALLET.L - 0.02), world.mats.crate);
    } else {
      lm = new THREE.Mesh(new THREE.BoxGeometry(PALLET.W - 0.04, this.loadH, PALLET.L - 0.06), world.mats.carton[opts.variant || 0]);
      const wrap = new THREE.Mesh(new THREE.BoxGeometry(PALLET.W - 0.02, this.loadH + 0.02, PALLET.L - 0.04), world.mats.wrap); wrap.position.y = 0; lm.add(wrap);
    }
    lm.position.y = PALLET.H + this.loadH / 2; lm.castShadow = lm.receiveShadow = true; g.add(lm); this.loadMesh = lm;
    // weight tag on both ends
    const lb = Math.round(this.massKg / LB / 10) * 10;
    this.lb = lb;
    const tagT = T.label(`${lb.toLocaleString('en-US')} lb\n${this.id}`, { w: 256, h: 160, size: 48, bg: '#ffffff', fg: '#111', border: '#111', borderW: 6 });
    const tagM = new THREE.MeshStandardMaterial({ map: tagT, roughness: 0.6 });
    for (const s of [1, -1]) { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.21), tagM); t.position.set(0, PALLET.H + Math.min(0.55, this.loadH * 0.6), s * (PALLET.L / 2 - 0.01 + (this.kind === 'crate' ? 0.0 : 0.02))); if (s < 0) t.rotation.y = Math.PI; g.add(t); }
    // highlight ring (shown when this pallet is a task target)
    const ring = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), new THREE.MeshStandardMaterial({ color: 0x22dd66, emissive: 0x22dd66, emissiveIntensity: 1.2 }));
    ring.rotation.x = Math.PI; ring.position.y = PALLET.H + this.loadH + 0.7; ring.visible = false; g.add(ring); this.marker = ring;
    this.sync();
  }
  get topY() { return this.y + PALLET.H + this.loadH; }
  corners() {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw), hw = PALLET.W / 2, hl = PALLET.L / 2;
    return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([a, b]) => ({ x: this.x + a * c + b * s, z: this.z - a * s + b * c }));
  }
  toLocal(px, pz) { const dx = px - this.x, dz = pz - this.z, c = Math.cos(this.yaw), s = Math.sin(this.yaw); return { a: dx * c - dz * s, b: dx * s + dz * c }; }
  sync() { this.group.position.set(this.x, this.y, this.z); this.group.rotation.set(this.tiltX || 0, this.yaw, this.tilt || 0, 'YXZ'); }
}
