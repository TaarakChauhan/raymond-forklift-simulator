// Training modes: free drive, pre shift inspection, pick and place, stacking, timed course.
import * as THREE from 'three';
import { PALLET, RACK } from './warehouse.js';
import { LB } from './trucks.js';

export const MODES = [
  { id: 'free', name: 'Free drive', desc: 'Drive anywhere in the warehouse. Pallets are waiting in the staging lanes and on the low rack level. No score.' },
  { id: 'inspect', name: 'Pre shift inspection', desc: 'Walk around the truck and test its controls before you drive. One thing on this truck is faulty. Find it.' },
  { id: 'pick', name: 'Pick and place', desc: 'Pick up a pallet and put it on the highlighted rack spot. With the orderpicker you pick cases instead. With the pallet truck you load a trailer.' },
  { id: 'stack', name: 'Stacking challenge', desc: 'Stack three pallets three high inside the yellow box. With the pallet truck, line them up side by side.' },
  { id: 'course', name: 'Timed course', desc: 'Pick up a load, weave through the cones, cross the crosswalk safely, drop the load and park. You start with 100 points.' },
];

export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const PENALTY = (ev) => {
  if (ev.type === 'tip') return 50;
  if (ev.type === 'collision') return ev.sev >= 2 ? 10 : 5;
  if (ev.type === 'violation') return ev.sev >= 3 ? 25 : ev.sev >= 2 ? 10 : 5;
  return 0;
};

// ---------- helpers that add temporary things for a mode ----------
export class ModeKit {
  constructor(ctx) { this.ctx = ctx; this.objs = []; this.c2 = []; this.c3 = []; }
  add(o) { this.ctx.scene.add(o); this.objs.push(o); return o; }
  zone(x, z, w, l, color = 0xf2c200, label = null) {
    const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4 });
    const bar = (bx, bz, bw, bl) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(bw, bl), m); p.rotation.x = -Math.PI / 2; p.position.set(bx, 0.006, bz); p.receiveShadow = true; g.add(p); };
    bar(0, -l / 2, w, 0.1); bar(0, l / 2, w, 0.1); bar(-w / 2, 0, 0.1, l); bar(w / 2, 0, 0.1, l);
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.007; g.add(fill);
    g.position.set(x, 0, z); return this.add(g);
  }
  cone(x, z) {
    const g = new THREE.Group();
    const o = new THREE.MeshStandardMaterial({ color: 0xff5a00, roughness: 0.55 }), w = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4, emissive: 0x333333 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.38), o); base.position.y = 0.015; g.add(base);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 20, 1, true), o); c.position.y = 0.38; g.add(c);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.12, 20, 1, true), w); s.position.y = 0.42; g.add(s);
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    g.position.set(x, 0, z); this.add(g);
    const c2 = { minX: x - 0.18, maxX: x + 0.18, minZ: z - 0.18, maxZ: z + 0.18, name: 'cone' }; this.ctx.world.colliders2D.push(c2); this.c2.push(c2);
    const c3 = { min: new THREE.Vector3(x - 0.18, 0, z - 0.18), max: new THREE.Vector3(x + 0.18, 0.75, z + 0.18), name: 'cone' }; this.ctx.world.colliders3D.push(c3); this.c3.push(c3);
    return g;
  }
  pillar() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 14, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x33ff88, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    m.position.y = 7; g.add(m);
    const r = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.8, 32), new THREE.MeshBasicMaterial({ color: 0x33ff88, transparent: true, opacity: 0.7, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.02; g.add(r);
    g.renderOrder = 5; return this.add(g);
  }
  slotBox(slot) {
    const g = new THREE.Group(); const h = 1.25;
    const geo = new THREE.BoxGeometry(PALLET.W + 0.12, h, PALLET.L + 0.04);
    const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x33ff88, transparent: true, opacity: 0.18, depthWrite: false })); g.add(b);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x33ff88 })); g.add(e);
    g.position.set(slot.x, slot.y + h / 2 + 0.01, slot.z); g.rotation.y = slot.yaw; return this.add(g);
  }
  cleanup() {
    for (const o of this.objs) this.ctx.scene.remove(o);
    const W = this.ctx.world; W.colliders2D = W.colliders2D.filter(c => !this.c2.includes(c)); W.colliders3D = W.colliders3D.filter(c => !this.c3.includes(c));
    this.objs = []; this.c2 = []; this.c3 = [];
  }
}

const laneX = i => -19 + i * 2.6;
const LANE_Z = 14.3;

function emptyPalletOnForks(ctx) {
  const { world, sim } = ctx;
  const p = world.addPallet(0, 0, 0, { massKg: 25, loadH: 0.02, kind: 'cartons', variant: 1, id: 'PICK' });
  p.loadMesh.visible = false; p.rel = new THREE.Matrix4().makeTranslation(0, -PALLET.pocketHigh, PALLET.L / 2 + 0.02);
  p.state = 'carried'; sim.carried = p; sim.pose(); p.cases = 0; return p;
}

function inZone(p, z) { return Math.abs(p.x - z.x) < z.w / 2 && Math.abs(p.z - z.z) < z.l / 2; }

// ---------- mode setups ----------
export function setupMode(id, ctx) {
  const { world, sim, spec } = ctx; const R = ctx.rand; const kit = new ModeKit(ctx); const K = spec.kind;
  const M = { id, kit, score: 100, penalties: [], startT: null, done: false, objective: '', detail: '', pillar: null, scoring: id === 'course' || id === 'pick' || id === 'stack' };
  world.clearPallets(); world.clearPeds();
  const pedsDefault = () => {
    world.addPedestrian([[-27.5, -18], [-27.5, 18]], 1.2, 0xff7a00);
    world.addPedestrian([[-8.5, -1.3], [-8.5, 9]], 1.0, 0xc6ff00);
    world.addPedestrian([[3, 21], [19, 21]], 1.1, 0xff7a00);
  };
  const keep = [];
  M.finish = (ok, title, lines = []) => { if (M.done) return; M.done = true; ctx.onFinish({ ok, title, lines, score: Math.max(0, Math.round(M.score)), penalties: M.penalties, time: M.startT === null ? 0 : sim.time - M.startT, scoring: M.scoring }); };
  M.onEvent = (ev) => {
    if (!M.scoring || M.done) return; const p = PENALTY(ev); if (!p) return;
    M.score -= p; M.penalties.push({ msg: ev.msg, pts: p, t: M.startT === null ? 0 : sim.time - M.startT });
    if (ev.type === 'tip') M.finish(false, 'The truck tipped over', ['A tip over ends the run. Slow down before turning and keep loads low.']);
  };
  M.update = () => {};

  if (id === 'free') {
    const lanes = [[0, 450, 'cartons', 0, 1.1], [1, 700, 'cartons', 2, 1.3], [2, 3175, 'crate', 0, 1.2], [3, 300, 'cartons', 1, 0.8], [4, 900, 'cartons', 3, 1.4], [5, 550, 'crate', 0, 1.0], [6, 600, 'cartons', 0, 1.2], [7, 400, 'cartons', 2, 1.0]];
    for (const [i, kg, kind, v, h] of lanes) world.addPallet(laneX(i), LANE_Z, 0, { massKg: kg, kind, variant: v, loadH: h, id: `L${i + 1}` });
    const free = world.slots.filter(s => s.row === 'E' && s.level === 0 && s.bay >= 4 && s.bay <= 7);
    free.forEach((s, j) => { keep.push(s.id); if (j % 2 === 0) world.addPallet(s.x, s.z, s.yaw, { y: s.y, massKg: 500 + j * 60, loadH: 1.1, variant: j % 4, id: s.id }); });
    for (const s of world.slots.filter(s => s.row === 'E' && (s.level === 1 || s.level === 2) && s.bay >= 4 && s.bay <= 7)) keep.push(s.id);
    world.fillRacks(R, keep); pedsDefault();
    ctx.place(K === 'orderpicker' ? 19 : -0.8, K === 'orderpicker' ? -10.3 : 9.6, K === 'orderpicker' ? -Math.PI / 2 : 0);
    if (K === 'orderpicker') emptyPalletOnForks(ctx);
    M.objective = 'Free drive. Pallets wait in the staging lanes. Lane 3 holds a 7,000 lb crate that is over capacity for every truck here, so try lifting it to see the capacity warning.';
    if (K === 'pallet') M.objective = 'Free drive. Pallets wait in the staging lanes, and the trailer at dock door 3 is open. Lane 3 holds a 7,000 lb crate that is too heavy for this truck.';
  }

  if (id === 'inspect') {
    world.fillRacks(R, []); pedsDefault(); ctx.place(8, 9, Math.PI * 0.75);
    if (K === 'orderpicker') emptyPalletOnForks(ctx);
    sim.keyOn = true; sim.parkBrake = true;
    const defects = ['leak', 'fork', 'tire', 'horn', 'beacon']; const d = defects[Math.floor(R() * defects.length)]; M.defect = d;
    const parts = ctx.parts;
    if (d === 'leak') {
      const pud = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), new THREE.MeshPhysicalMaterial({ color: 0x1a120a, roughness: 0.05, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -6 }));
      pud.rotation.x = -Math.PI / 2; pud.scale.set(1.3, 0.8, 1); const w = new THREE.Vector3(0.15, 0.008, K === 'pallet' ? -1.6 : -0.35); parts.root.localToWorld(w); pud.position.copy(w); kit.add(pud);
    }
    if (d === 'fork') {
      const ff = parts.mast.forkFrame; const crack = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.006, 0.025), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }));
      crack.position.set(sim.spread / 2, 0.001, 0.12); crack.rotation.y = 0.5; ff.add(crack); M.cleanupExtra = () => ff.remove(crack);
      const rust = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.004, 0.12), new THREE.MeshStandardMaterial({ color: 0x7a3a12, roughness: 1 })); rust.position.set(sim.spread / 2, 0.0, 0.14); ff.add(rust);
      const prev = M.cleanupExtra; M.cleanupExtra = () => { prev(); ff.remove(rust); };
    }
    if (d === 'tire') {
      const w = parts.driveWheel || parts.wheels[0]; const chunk = new THREE.Mesh(new THREE.BoxGeometry(w.r * 0.9, w.r * 0.5, w.r * 0.6), new THREE.MeshStandardMaterial({ color: 0x9c9c9c, roughness: 0.6, metalness: 0.5 }));
      chunk.position.set(0, w.r * 0.85, 0); w.spin.add(chunk); M.cleanupExtra = () => w.spin.remove(chunk);
    }
    if (d === 'horn') ctx.setHornDead(true);
    if (d === 'beacon') { const b = parts.beacon; M.savedOn = b.userData.onMat; b.userData.onMat = b.userData.offMat; M.cleanupExtra = () => { b.userData.onMat = M.savedOn; }; }
    M.objective = 'Pre shift inspection. Look around the truck (drag to orbit), test the horn, lights and controls, then mark each item OK or Fault.';
    ctx.showInspection(spec, (answers) => {
      const items = INSPECTION_ITEMS(spec); let wrong = 0; const lines = [];
      for (const it of items) { const bad = it.defect === d; const said = answers[it.id]; if ((said === 'fault') !== bad) { wrong++; lines.push(bad ? `Missed: ${it.text}` : `Marked as a fault but it was fine: ${it.text}`); } }
      const ok = wrong === 0; M.score = Math.max(0, 100 - wrong * 20); M.scoring = true;
      lines.unshift(`The faulty item was: ${items.find(i => i.defect === d).text}.`);
      lines.push(ok ? 'Correct. In a real shift you would tag the truck out of service, take the key and tell your supervisor. Never drive a truck with a known fault.' : 'Review the items above. In a real shift any fault means the truck is tagged out and not driven until it is repaired.');
      M.finish(ok, ok ? 'Inspection passed' : 'Inspection needs work', lines);
    });
  }

  if (id === 'pick') {
    if (K === 'orderpicker') {
      const cands = world.slots.filter(s => (s.row === 'C' || s.row === 'D') && s.level >= 1 && s.level <= 3 && s.bay >= 3 && s.bay <= 11);
      const targets = []; while (targets.length < 3) { const s = cands[Math.floor(R() * cands.length)]; if (!targets.includes(s) && !targets.some(t => t.bay === s.bay && t.row === s.row)) targets.push(s); }
      let cnt = 0; world.fillRacks(() => (cnt++ % 3 === 0 ? 0.9 : R()), []);
      pedsDefault(); ctx.place(19, -10.3, -Math.PI / 2); const p = emptyPalletOnForks(ctx);
      M.targets = targets; M.cur = 0; M.boxes = targets.map(t => kit.slotBox(t)); M.drop = { x: laneX(7), z: 16.5, w: 2.2, l: 3 }; kit.zone(M.drop.x, M.drop.z, M.drop.w, M.drop.l, 0x33ff88);
      M.pillar = kit.pillar();
      const caseMat = ctx.mats.carton[2];
      M.onAction = () => {
        if (M.cur >= targets.length) return; const t = targets[M.cur];
        const eye = ctx.eyeWorld(); const dx = eye.x - t.x, dz = eye.z - (t.front + t.dir * 0.3); const hd = Math.hypot(dx, dz); const dy = eye.y - t.y;
        if (Math.abs(sim.v) > 0.05) return ctx.toast('Stop the truck before you pick.', 'warn');
        if (hd > 2.3) return ctx.toast(`Too far from ${t.id}. Drive closer to the highlighted spot.`, 'warn');
        if (dy < 0.6 || dy > 2.4) return ctx.toast(dy < 0.6 ? 'Raise the platform so the cases are at waist to chest height.' : 'Lower the platform. The cases are below your feet.', 'warn');
        if (!sim.restraint) { sim.emit('violation', 'You leaned out to pick at height without your tether clipped in. Press B to clip in.', 2, 'tetherpick', 2); return; }
        const n = p.cases++; const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.5), caseMat); box.castShadow = true;
        box.position.set((n % 2) * 0.45 - 0.22, PALLET.H + 0.15 + Math.floor(n / 2) * 0.31, 0); p.group.add(box); p.massKg += 18;
        M.boxes[M.cur].visible = false; M.cur++; ctx.chime(true);
        ctx.toast(M.cur < targets.length ? `Case picked from ${t.id}. Next: ${targets[M.cur].id}.` : 'All cases picked. Lower the platform and take the load to the green box in lane 8.', 'good');
      };
      M.update = () => {
        if (M.startT === null && Math.abs(sim.v) > 0.05) M.startT = sim.time;
        if (M.cur < targets.length) { const t = targets[M.cur]; M.pillar.position.set(t.x, 0, t.front + t.dir * 1.0); M.detail = `Pick ${M.cur + 1} of 3 at ${t.id}: row ${t.row}, bay ${t.bay}, level ${'ABCDE'[t.level]} (beam at ${Math.round(t.y / 0.0254)} in). Stop beside it, raise the platform, then press Enter.`; }
        else { M.pillar.position.set(M.drop.x, 0, M.drop.z); M.detail = 'Lower the platform fully and stop in the green box in lane 8.'; if (Math.abs(sim.x - M.drop.x) < 1.6 && Math.abs(sim.z - M.drop.z) < 2.5 && sim.lift < 0.25 && Math.abs(sim.v) < 0.05) M.finish(true, 'Order picked', ['Three cases picked and delivered.']); }
      };
      M.objective = 'Case picking with the orderpicker. Drive into aisle C and D, stop at each green spot, raise the platform and press Enter to pick a case. Clip in your tether with B first.';
    } else if (K === 'pallet') {
      world.fillRacks(R, []); pedsDefault();
      const kg = 600 + Math.round(R() * 6) * 100; const pal = world.addPallet(laneX(5), LANE_Z, 0, { massKg: kg, variant: 1, loadH: 1.2, id: 'LOAD1' }); pal.marker.visible = true;
      const tr = world.trailer; M.zoneT = { x: tr.x, z: tr.z0 + tr.L - 0.9, w: 2.3, l: 1.6 }; kit.zone(M.zoneT.x, M.zoneT.z, M.zoneT.w, M.zoneT.l, 0x33ff88);
      ctx.place(laneX(5), 9.5, 0); M.pillar = kit.pillar(); M.pal = pal;
      M.objective = 'Load the trailer. Pick up the marked pallet in lane 6, drive through dock door 3 and set it down at the front of the trailer (the far end).';
      M.update = () => {
        if (M.startT === null && Math.abs(sim.v) > 0.05) M.startT = sim.time;
        const placed = pal.state === 'rest' && inZone(pal, M.zoneT); pal.marker.visible = !sim.carried && !placed;
        M.pillar.position.set(sim.carried ? M.zoneT.x : pal.x, 0, sim.carried ? M.zoneT.z : pal.z);
        M.detail = sim.carried ? 'Carry the load low into the trailer. Go slowly over the dock plate.' : placed ? 'Load placed. Back out of the trailer.' : 'Pick up the marked pallet.';
        if (placed && !sim.engaged && !sim.carried && sim.z < tr.z0 - 0.2) M.finish(true, 'Trailer loaded', [`${pal.lb.toLocaleString('en-US')} lb pallet loaded at the trailer nose.`]);
      };
    } else {
      const lv = K === 'reach' ? 1 + Math.floor(R() * 3) : 1 + Math.floor(R() * 2);
      const row = K === 'reach' ? 'D' : 'E';
      const cands = world.slots.filter(s => s.row === row && s.level === lv && s.bay >= 3 && s.bay <= 10);
      const slot = cands[Math.floor(R() * cands.length)];
      const keepIds = world.slots.filter(s => s.row === slot.row && s.bay === slot.bay && s.level === slot.level).map(s => s.id);
      world.fillRacks(R, keepIds); pedsDefault();
      const kg = 450 + Math.round(R() * 6) * 70; const pal = world.addPallet(laneX(7), LANE_Z, 0, { massKg: kg, variant: 0, loadH: 1.1, id: 'PUT1' }); pal.marker.visible = true;
      ctx.place(laneX(7), 9.6, 0); kit.slotBox(slot); M.pillar = kit.pillar(); M.slot = slot; M.pal = pal;
      M.objective = `Put away. Pick up the pallet with the green marker in lane 8 and put it on rack spot ${slot.id}: row ${slot.row}, bay ${slot.bay}, level ${'ABCDE'[slot.level]}.`;
      M.update = () => {
        if (M.startT === null && Math.abs(sim.v) > 0.05) M.startT = sim.time;
        const sp = pal.support; const onSlot = pal.state === 'rest' && sp && sp.kind === 'beam' && sp.ref.row === slot.row && sp.ref.bay === slot.bay && sp.ref.level === slot.level && Math.abs(pal.x - slot.x) < 0.35 && Math.abs(pal.z - slot.z) < 0.2;
        pal.marker.visible = !sim.carried && !onSlot && pal.state === 'rest' && !(sp && sp.kind === 'beam');
        const fh = sim.forkTop();
        M.pillar.position.set(sim.carried || onSlot ? slot.x : pal.x, 0, sim.carried || onSlot ? slot.front + slot.dir * 1.2 : pal.z);
        M.detail = sim.carried ? `Beam top is ${Math.round(slot.y / 0.0254)} in. Your forks are at ${Math.round(fh / 0.0254)} in. Stop square to the rack, raise the load above the beam, drive or reach in, then lower.` : onSlot ? 'Placed. Lower the forks a little, back out straight, then lower the forks to travel height.' : 'Drive the forks fully into the pallet, lift it a few inches and back out.';
        if (pal.state === 'rest' && sp && sp.kind === 'beam' && !onSlot && !M.wrongWarned) { M.wrongWarned = true; ctx.toast('That is not the highlighted spot. Pick it up again and move it.', 'warn'); }
        if (onSlot && !sim.carried && !sim.engaged && fh < 0.45 && sim.reach < 0.05) M.finish(true, 'Pallet put away', [`${pal.lb.toLocaleString('en-US')} lb pallet stored at ${slot.id}.`]);
      };
    }
  }

  if (id === 'stack') {
    world.fillRacks(R, []); pedsDefault();
    const zone = { x: 9, z: 14.5, w: K === 'pallet' ? 4.2 : 1.7, l: K === 'pallet' ? 1.9 : 1.9 };
    if (K === 'orderpicker') return setupMode('pick', ctx);
    kit.zone(zone.x, zone.z, zone.w, zone.l);
    const pals = [5, 6, 7].map((i, j) => world.addPallet(laneX(i), LANE_Z, 0, { massKg: 350 + j * 40, kind: 'crate', loadH: 0.95, id: `S${j + 1}` }));
    pals.forEach(p => p.marker.visible = true);
    ctx.place(laneX(6), 9.6, 0); M.pillar = kit.pillar(); M.pillar.position.set(zone.x, 0, zone.z);
    M.objective = K === 'pallet' ? 'Move the three crates from lanes 6, 7 and 8 into the yellow box and line them up side by side.' : 'Stack the three crates from lanes 6, 7 and 8 three high inside the yellow box. Line each one up square on the one below.';
    M.update = () => {
      if (M.startT === null && Math.abs(sim.v) > 0.05) M.startT = sim.time;
      for (const p of pals) p.marker.visible = p.state === 'rest' && !inZone(p, zone);
      const inside = pals.filter(p => p.state === 'rest' && inZone(p, zone));
      let ok = false;
      if (K === 'pallet') ok = inside.length === 3;
      else { const ys = inside.map(p => p.y).sort((a, b) => a - b); ok = inside.length === 3 && ys[2] > 2 && ys[1] > 1; }
      const fh = sim.forkTop();
      M.detail = K === 'pallet' ? `${inside.length} of 3 crates in the box.` : `${inside.length} of 3 crates in the box. Stack height ${inside.length ? Math.max(...inside.map(p => p.topY)).toFixed(1) : '0.0'} m.`;
      if (pals.some(p => p.damaged)) { M.finish(false, 'A load fell', ['A crate fell while stacking. Line the load up square on the one below before you lower it.']); }
      if (ok && !sim.carried && !sim.engaged && fh < 0.5) M.finish(true, K === 'pallet' ? 'Crates lined up' : 'Stack complete', ['Three crates placed in the box.']);
    };
  }

  if (id === 'course') {
    world.fillRacks(R, []); pedsDefault();
    const steps = [];
    let pal = null;
    if (K !== 'orderpicker') { pal = world.addPallet(laneX(7), LANE_Z, 0, { massKg: 500, variant: 3, loadH: 1.0, id: 'RUN1' }); pal.marker.visible = true; steps.push({ kind: 'pick', label: 'Pick up the pallet in lane 8', x: laneX(7), z: LANE_Z }); }
    const gates = [[4, 10.2], [7.5, 7.2], [11, 10.2]];
    for (const [gx, gz] of gates) { kit.cone(gx - 1.45, gz); kit.cone(gx + 1.45, gz); steps.push({ kind: 'gate', label: 'Drive between the cones', x: gx, z: gz, r: 1.3 }); }
    for (const [cx, cz] of [[5.8, 8.7], [9.3, 8.7]]) kit.cone(cx, cz);
    steps.push({ kind: 'gate', label: 'Cross the crosswalk. Sound the horn and watch for people', x: -8.5, z: 0.3, r: 2.2 });
    const drop = { x: -22.5, z: 4, w: 2.2, l: 2.2 }; kit.zone(drop.x, drop.z, drop.w, drop.l, 0x33ff88);
    if (pal) steps.push({ kind: 'drop', label: 'Set the load down in the green box', x: drop.x, z: drop.z });
    const park = { x: -23, z: 10.5, w: 2.6, l: 4.2 }; kit.zone(park.x, park.z, park.w, park.l, 0x3aa0ff);
    steps.push({ kind: 'park', label: 'Park in the blue box: forks fully down, then set the parking brake (P)', x: park.x, z: park.z });
    ctx.place(laneX(7), 9.6, 0); if (K === 'orderpicker') { ctx.place(laneX(7), 9.6, 0); emptyPalletOnForks(ctx); }
    M.pillar = kit.pillar(); M.steps = steps; M.i = 0; M.par = 150;
    M.objective = 'Timed course. Follow the green light. Every collision or safety violation costs points. Par time is 2 minutes 30 seconds.';
    M.update = () => {
      if (M.done) return;
      if (M.startT === null && Math.abs(sim.v) > 0.05) M.startT = sim.time;
      const s = steps[M.i]; M.pillar.position.set(s.x, 0, s.z); M.detail = `Step ${M.i + 1} of ${steps.length}: ${s.label}.`;
      const next = () => { M.i++; ctx.chime(true); };
      if (s.kind === 'pick' && sim.carried === pal && sim.forkTop() > 0.08) next();
      else if (s.kind === 'gate' && Math.hypot(sim.x - s.x, sim.z - s.z) < s.r) next();
      else if (s.kind === 'drop' && pal.state === 'rest' && inZone(pal, drop) && !sim.engaged) next();
      else if (s.kind === 'park') {
        const inBox = Math.abs(sim.x - park.x) < park.w / 2 && Math.abs(sim.z - park.z) < park.l / 2;
        const down = sim.lift <= sim.liftMin + 0.03 && (K !== 'reach' || sim.reach < 0.05);
        if (inBox && sim.parkBrake && Math.abs(sim.v) < 0.02) {
          if (!down) { ctx.toast('Lower the forks fully before you park.', 'warn'); sim.parkBrake = false; return; }
          const t = sim.time - (M.startT || sim.time); const over = Math.max(0, t - M.par); const tp = Math.min(30, Math.round(over / 5));
          if (tp) { M.score -= tp; M.penalties.push({ msg: `Over par time by ${Math.round(over)} s`, pts: tp, t }); }
          M.finish(true, 'Course complete', [`Time ${fmtTime(t)} (par ${fmtTime(M.par)}).`]);
        }
      }
      if (pal && pal.damaged) M.finish(false, 'The load fell', ['A dropped load ends the run.']);
    };
  }
  M.cleanup = () => { kit.cleanup(); if (M.cleanupExtra) M.cleanupExtra(); ctx.setHornDead(false); };
  return M;
}

export function fmtTime(t) { t = Math.max(0, t); const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, '0')}`; }

export function INSPECTION_ITEMS(spec) {
  const k = spec.kind;
  return [
    { id: 'plate', text: 'Data plate is on the truck and readable' },
    { id: 'forks', text: 'Forks have no cracks, bends or heavy wear', defect: 'fork' },
    { id: 'mast', text: k === 'pallet' ? 'Lift linkage and load wheels look normal' : 'Mast, chains, hoses and load backrest look normal' },
    { id: 'leak', text: 'No fluid leaks or puddles under the truck', defect: 'leak' },
    { id: 'tires', text: 'Tires and wheels have no chunks, cuts or flat spots', defect: 'tire' },
    { id: 'guard', text: k === 'pallet' ? 'Tiller head and belly button switch are not damaged' : 'Overhead guard is not damaged' },
    { id: 'battery', text: 'Battery is charged and the cables and connector are not damaged' },
    { id: 'horn', text: 'Horn works (press H)', defect: 'horn' },
    { id: 'lights', text: 'Warning light flashes when the truck is on', defect: 'beacon' },
    { id: 'restraint', text: k === 'cbSit' ? 'Seat belt latches and releases (press B)' : k === 'orderpicker' ? 'Fall protection harness and tether are in good shape (press B)' : 'Operator compartment and presence pedal or switch work' },
    { id: 'controls', text: 'Lift, lower and other load controls work smoothly' },
    { id: 'steer', text: 'Steering responds normally' },
    { id: 'brakes', text: 'Brakes and parking brake hold (press Space and P)' },
    { id: 'disconnect', text: 'Emergency power disconnect is in reach and works' },
  ];
}
