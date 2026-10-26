// Truck physics: steering kinematics, hydraulics, pallet handling, collisions, capacity and stability.
import * as THREE from 'three';
import { MPH, IN, LB, FPM, poseTruck } from './trucks.js';
import { PALLET } from './warehouse.js';

const G = 9.81;
const tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4();

const LBK = 0.45359237;
export class TruckSim {
  constructor(spec, parts, world) {
    this.spec = spec; this.parts = parts; this.world = world;
    this.capKg = spec.capacityLb * LB; this.lcRated = spec.lcIn * IN;
    this.maxH = parts.maxH; this.liftMin = spec.liftMin || 0;
    this.forkLen = spec.kind === 'pallet' ? 48 * IN : 42 * IN; this.spread = spec.kind === 'pallet' ? 0.52 : 0.5; this.forkW = spec.kind === 'pallet' ? 0.17 : 0.1;
    this.events = []; this.carried = null; this.engaged = null;
    this.lastHorn = -99; this.time = 0; this.cool = {};
    this.reset(0, 0, 0);
  }
  reset(x, z, yaw) {
    Object.assign(this, { x, z, yaw, v: 0, steer: 0, lift: this.liftMin, tilt: 0, reach: 0, side: 0, odo: 0, keyOn: true, parkBrake: false, restraint: false, hornOn: false, tipped: null, tipT: 0, accel: 0 });
    this.carried = null; this.engaged = null; this.parts.body.rotation.set(0, 0, 0); this.parts.body.position.set(0, 0, 0);
    this.longIdx = 0; this.latIdx = 0; this.loadRatio = 0; this.lcAct = 0; this.capEff = this.capKg; this.flags = {};
    this.pose();
  }
  get state() { return this; }
  emit(type, msg, sev = 1, key = null, cooldown = 3) {
    const k = key || type + msg; if (this.cool[k] && this.time - this.cool[k] < cooldown) return; this.cool[k] = this.time;
    this.events.push({ type, msg, sev, t: this.time });
  }
  forkTop() { this.parts.mast.forkFrame.getWorldPosition(tmpV); return tmpV.y; }
  pose() {
    const r = this.parts.root; r.position.set(this.x, 0, this.z); r.rotation.set(0, this.yaw, 0);
    poseTruck(this.parts, this, this.spec, this.time);
    r.updateMatrixWorld(true);
    if (this.carried) this.placeCarried();
  }
  placeCarried() {
    const p = this.carried; tmpM.multiplyMatrices(this.parts.mast.forkFrame.matrixWorld, p.rel);
    p.group.matrixAutoUpdate = false; p.group.matrix.copy(tmpM); p.group.matrixWorldNeedsUpdate = true;
    const e = tmpM.elements; p.x = e[12]; p.y = e[13]; p.z = e[14]; p.yaw = Math.atan2(e[8], e[10]);
  }
  // ----- geometry helpers -----
  bodyOBB(core = false) {
    const f = core ? this.parts.core : this.parts.foot; const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const pts = [[f.x0, f.z0], [f.x1, f.z0], [f.x1, f.z1], [f.x0, f.z1]].map(([a, b]) => ({ x: this.x + a * c + b * s, z: this.z - a * s + b * c }));
    return pts;
  }
  forkPoints() {
    const ff = this.parts.mast.forkFrame, out = []; const t = this.parts.forkT;
    for (const sg of [-1, 1]) for (const z of [0.06, this.forkLen * 0.5, this.forkLen - 0.03]) {
      const v = new THREE.Vector3(sg * this.spread / 2, -t / 2, z); ff.localToWorld(v); v.fork = sg; v.tip = z > this.forkLen * 0.8; v.heel = z < 0.1; out.push(v);
    }
    return out;
  }
  loadPoints() {
    const p = this.carried; if (!p) return [];
    const out = []; const hw = PALLET.W / 2, hl = PALLET.L / 2;
    for (const y of [0.03, PALLET.H + p.loadH * 0.5, PALLET.H + p.loadH - 0.03]) for (const [a, b] of [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl], [0, hl], [0, -hl], [hw, 0], [-hw, 0]]) {
      const v = new THREE.Vector3(a, y, b).applyMatrix4(p.group.matrix); out.push(v);
    }
    return out;
  }
  // ----- collision -----
  check() {
    const W = this.world; const hits = [];
    const near = (b) => !(b.max.x < this.x - 9 || b.min.x > this.x + 9 || b.max.z < this.z - 9 || b.min.z > this.z + 9);
    // body vs 2D colliders
    const obb = this.bodyOBB(), core = this.bodyOBB(true);
    for (const c of W.colliders2D) {
      const poly = c.name === 'rack' && this.spec.kind === 'stacker' ? core : obb;
      if (satRect(poly, c)) hits.push(c.name);
    }
    for (const p of W.pallets) if (p !== this.carried && p.state === 'rest' && p.y < 1.0) { if (satPoly(core, p.corners())) hits.push('pallet'); }
    // forks and load vs 3D boxes
    const fp = this.forkPoints(), lp = this.loadPoints();
    const boxes = W.colliders3D.filter(near).concat((W.staticColliders || []).filter(near));
    for (const v of fp.concat(lp)) for (const b of boxes) if (v.x > b.min.x && v.x < b.max.x && v.y > b.min.y && v.y < b.max.y && v.z > b.min.z && v.z < b.max.z) { hits.push(b.name); break; }
    // forks vs resting pallets (pocket logic)
    this.engaged = null; this.liftCandidate = null;
    const fw = this.forkW / 2, ft = this.parts.forkT / 2;
    for (const p of W.pallets) {
      if (p === this.carried || p.state !== 'rest') continue;
      if (Math.hypot(p.x - this.x, p.z - this.z) > 6) continue;
      let inside = false, bad = false, lowBad = false, topHit = false, tipB = null, heelB = null;
      for (const v of fp) {
        const l = p.toLocal(v.x, v.z), yy = v.y - p.y;
        if (Math.abs(l.a) > PALLET.W / 2 || Math.abs(l.b) > PALLET.L / 2 || yy < -ft || yy > PALLET.H + p.loadH + ft) continue;
        inside = true;
        const latOK = Math.abs(l.a) - fw >= PALLET.stringerHalf && Math.abs(l.a) + fw <= PALLET.pocketEdge;
        const lowOK = yy - ft >= PALLET.pocketLow - 0.012;
        const highOK = yy + ft <= PALLET.pocketHigh + 0.004;
        if (!latOK) bad = true; else if (!lowOK) lowBad = true; else if (!highOK) topHit = true;
        if (v.tip) tipB = l.b; if (v.heel) heelB = l.b;
      }
      // tip may be outside footprint (forks longer than pallet); estimate insertion from heel and fork direction
      if (!inside) continue;
      const dir = (() => { const a = p.toLocal(fp[0].x, fp[0].z).b, b2 = p.toLocal(fp[2].x, fp[2].z).b; return Math.sign(b2 - a) || 1; })();
      const tipLocal = p.toLocal(fp[2].x, fp[2].z).b;
      const insertion = dir > 0 ? Math.min(PALLET.L, tipLocal + PALLET.L / 2) : Math.min(PALLET.L, PALLET.L / 2 - tipLocal);
      const heelLocal = p.toLocal(fp[0].x, fp[0].z).b;
      const pushed = dir > 0 ? heelLocal > -PALLET.L / 2 + 0.01 : heelLocal < PALLET.L / 2 - 0.01;
      if (bad) { hits.push('pallet'); continue; }
      if (lowBad) { hits.push(this.carried ? 'pallet' : 'pallet bottom'); this.emit('hint', 'The forks are touching the bottom boards. Raise them a little, about 2 inches.', 0, 'low', 5); continue; }
      if (pushed) { hits.push('pallet face'); continue; }
      this.engaged = p; this.insertion = insertion;
      if (topHit) {
        if (insertion < PALLET.L * 0.6) { hits.push('pallet top'); this.emit('hint', 'Drive the forks fully under the pallet before you lift.', 0, 'insert', 4); }
        else this.liftCandidate = p;
      }
    }
    // other dynamic pallets vs carried load and forks (load boxes)
    for (const p of W.pallets) {
      if (p === this.carried || p.state !== 'rest') continue;
      const pts = lp; if (!pts.length) continue;
      for (const v of pts) { const l = p.toLocal(v.x, v.z); if (Math.abs(l.a) < PALLET.W / 2 && Math.abs(l.b) < PALLET.L / 2 && v.y > p.y + 0.02 && v.y < p.topY - 0.01) { hits.push('another load'); break; } }
    }
    // pedestrians
    for (const ped of W.peds) {
      const c = { x: ped.x, z: ped.z };
      if (pointInPoly(c, obb) || distPoly(c, obb) < 0.3) { hits.push('pedestrian'); continue; }
      for (const v of fp.concat(lp)) if (Math.hypot(v.x - c.x, v.z - c.z) < 0.35 && v.y < 1.8) { hits.push('pedestrian'); break; }
    }
    return hits;
  }

  update(dt, inp) {
    this.time += dt; const S = this.spec;
    if (this.tipped) { this.animateTip(dt); return; }
    const loaded = !!this.carried; const loadKg = loaded ? this.carried.massKg : 0;
    // ---- restraint and key ----
    this.hornOn = !!inp.horn; if (this.hornOn) this.lastHorn = this.time;
    // ---- hydraulics ----
    const prevH = { lift: this.lift, tilt: this.tilt, reach: this.reach, side: this.side };
    const liftUp = S.liftFpm[loaded ? 1 : 0] * FPM, liftDn = S.lowerFpm * FPM;
    let li = inp.lift || 0;
    if (this.keyOn) {
      if (li > 0 && loaded && this.loadRatio > 1.1) { li = 0; this.emit('warn', 'Overloaded. The relief valve stops the lift. Set the load down.', 2, 'overlift', 4); }
      if (li > 0 && S.restraint === 'tether' && !this.restraint && this.lift > 0.9) { this.emit('violation', 'Clip in your fall protection tether before raising the platform.', 2, 'tether', 6); }
      this.lift = clamp(this.lift + li * (li > 0 ? liftUp : liftDn) * dt, this.liftMin, this.liftMin + this.maxH);
      if (S.tilt[1] > 0) {
        if (S.autoLevel && inp.level) this.tilt += clamp(-this.tilt, -dt * 4, dt * 4);
        this.tilt = clamp(this.tilt + (inp.tilt || 0) * 4 * dt, S.tilt[0], S.tilt[1]);
      }
      if (S.reach) this.reach = clamp(this.reach + (inp.reach || 0) * 0.35 * dt, 0, S.reach);
      if (S.sideshift) this.side = clamp(this.side + (inp.side || 0) * 0.12 * dt, -S.sideshift, S.sideshift);
    }
    this.pose();
    let hits = this.check();
    if (this.liftCandidate && li > 0) {
      const c = this.liftCandidate, ff = this.parts.mast.forkFrame; ff.updateMatrixWorld(true);
      const loc = ff.worldToLocal(new THREE.Vector3(c.x, ff.getWorldPosition(new THREE.Vector3()).y, c.z));
      const capHere = this.capKg * this.lcRated / Math.max(this.lcRated, Math.abs(loc.z));
      if (c.massKg > capHere * 1.1) {
        Object.assign(this, prevH); this.pose(); hits = [];
        this.emit('warn', `Overloaded. This load is about ${c.lb.toLocaleString('en-US')} lb and the truck is rated ${Math.round(capHere / LBK / 10) * 10 > 0 ? (Math.round(capHere / LBK / 10) * 10).toLocaleString('en-US') : 0} lb here. The relief valve will not lift it. Check the load weight before you lift.`, 2, 'overlift', 4);
      } else { this.pickUp(c); this.pose(); hits = this.check(); }
    }
    if (hits.length) {
      const moved = Math.abs(this.lift - prevH.lift) + Math.abs(this.reach - prevH.reach) + Math.abs(this.side - prevH.side) + Math.abs(this.tilt - prevH.tilt) * 0.01;
      Object.assign(this, prevH); this.pose();
      if (moved > 0.0005) this.reportHits(hits, 0.3, true);
    }
    // set down the carried load on a support
    if (this.carried) this.checkSetDown();

    // ---- steering ----
    const maxSt = S.maxSteerDeg * Math.PI / 180;
    if (inp.steerAbs !== undefined && inp.steerAbs !== null) this.steer += clamp(inp.steerAbs * maxSt - this.steer, -2.5 * dt, 2.5 * dt);
    else if (inp.steer) this.steer = clamp(this.steer + inp.steer * 1.8 * dt, -maxSt, maxSt);
    else if (inp.autoCenter) this.steer -= clamp(this.steer, -0.9 * dt, 0.9 * dt);

    // ---- travel ----
    let vmax = (loaded ? S.speedLoadedMph : S.speedMph) * MPH;
    const fh = this.forkTop();
    const raised = S.kind === 'orderpicker' ? this.lift > 1.5 : fh > 0.45;
    if (raised) vmax *= S.kind === 'orderpicker' ? 0.3 : (fh > 2 ? 0.15 : 0.35);
    if (S.kind === 'reach' && this.reach > 0.05) vmax *= 0.5;
    const thr = this.keyOn && !this.parkBrake ? (inp.throttle || 0) : 0;
    const target = thr * vmax;
    let a;
    if (inp.brake) a = -Math.sign(this.v) * Math.min(Math.abs(this.v) / dt, 3.5);
    else if (thr === 0) a = -Math.sign(this.v) * Math.min(Math.abs(this.v) / dt, 1.6);
    else { const acc = (loaded ? 0.9 : 1.3) * (S.kind === 'stacker' ? 0.7 : 1); const dv = target - this.v; a = clamp(dv / dt, (Math.sign(dv) !== Math.sign(this.v) && this.v !== 0) ? -2.4 : -acc, (Math.sign(dv) !== Math.sign(this.v) && this.v !== 0) ? 2.4 : acc); }
    const prev = { x: this.x, z: this.z, yaw: this.yaw, odo: this.odo };
    this.v += a * dt; if (Math.abs(this.v) < 0.005 && thr === 0) this.v = 0;
    this.accel = a;
    let vP, w;
    if (S.steer === 'driveSteer') { vP = this.v * Math.cos(this.steer); w = this.v * Math.sin(this.steer) / S.L; }
    else { vP = this.v; w = this.v * Math.tan(clamp(this.steer, -1.45, 1.45)) / S.L; }
    this.omega = w; this.vP = vP;
    this.yaw += w * dt; this.x += Math.sin(this.yaw) * vP * dt; this.z += Math.cos(this.yaw) * vP * dt; this.odo += this.v * dt;
    if (Math.abs(this.v) > 0.001) {
      this.pose(); hits = this.check();
      if (hits.length) { const sp = Math.abs(this.v); Object.assign(this, prev); this.v = 0; this.pose(); this.reportHits(hits, sp, false); }
    }
    // engaged pallet stays put; if pushing without lift, flagged by check

    // ---- stability ----
    this.computeStability();
    // ---- rule checks ----
    this.rules(dt, raised, fh);
  }

  reportHits(hits, speed, hyd) {
    const names = [...new Set(hits)];
    for (const n of names) {
      if (n === 'pedestrian') { this.emit('violation', 'You struck a pedestrian. Stop, set the brake and get help. In a real workplace this is a reportable incident.', 3, 'ped', 3); continue; }
      if (n === 'pallet top' || n === 'pallet bottom') continue;
      if (n === 'pallet face' && !hyd && speed <= 1.2) { this.emit('hint', 'The pallet is against the load backrest. Stop, then lift a little.', 0, 'seated', 4); continue; }
      if (speed > 0.25 || hyd) {
        const nice = n === 'pallet' ? 'a pallet' : n === 'pallet face' ? 'the pallet face (pushing the load)' : n;
        this.emit('collision', `Contact with ${nice}.`, speed > 1.0 ? 2 : 1, 'col' + n, 2);
      }
    }
  }

  pickUp(p) {
    const ff = this.parts.mast.forkFrame; ff.updateMatrixWorld(true);
    // put pallet so its deck underside touches fork top
    p.group.matrixAutoUpdate = true; p.sync(); p.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(ff.matrixWorld).invert();
    p.rel = new THREE.Matrix4().multiplyMatrices(inv, p.group.matrixWorld);
    const e = p.rel.elements; e[13] = -PALLET.pocketHigh; // bottom of pallet relative to fork top
    p.state = 'carried'; this.carried = p; p.marker.visible = p.marker.visible;
    this.lcAct = Math.abs(e[14]);
    this.emit('info', `Load picked up: ${p.lb.toLocaleString('en-US')} lb.`, 0, 'pick', 1);
  }

  checkSetDown() {
    const p = this.carried; const sup = this.world.supportUnder(p, p.y + 0.06);
    if (p.y <= sup.y + 0.001) {
      this.carried = null; p.group.matrixAutoUpdate = true; p.rel = null;
      if (sup.full) {
        p.state = 'rest'; p.y = sup.y; p.tilt = 0; p.sync(); p.support = sup;
        this.emit('placed', sup.kind === 'beam' ? `Load set on rack ${sup.ref.row} bay ${sup.ref.bay} level ${'ABCDE'[sup.ref.level]}.` : sup.kind === 'pallet' ? 'Load stacked.' : 'Load set on the floor.', 0, 'place', 0.5);
      } else {
        p.state = 'falling'; p.fallV = 0; p.support = null;
        this.emit('violation', 'The load was not fully on the beams and fell. Square up and centre the load before you lower it.', 3, 'fall', 2);
      }
    }
  }

  computeStability() {
    const S = this.spec, p = this.carried; const fh = this.forkTop();
    if (!p) { this.loadRatio = 0; this.longIdx = 0; this.capEff = this.capKg; }
    else {
      const lc = Math.max(this.lcRated, Math.abs(p.rel.elements[14])); this.lcAct = Math.abs(p.rel.elements[14]);
      let cap = this.capKg * this.lcRated / lc;
      const hf = this.maxH > 1 ? (fh - this.liftMin) / this.maxH : 0; if (hf > 0.6) cap *= 1 - 0.3 * (hf - 0.6) / 0.4;
      this.capEff = cap; this.loadRatio = p.massKg / cap;
      const fwdTilt = Math.max(0, -this.tilt);
      const decel = this.v > 0.1 ? Math.max(0, -this.accel) : 0;
      this.longIdx = this.loadRatio * (1 + 0.035 * fwdTilt) * (1 + decel / G * (fh + 0.6) / 0.9);
    }
    const ml = p ? p.massKg : 0, mt = S.truckKg;
    const hcg = (mt * S.cgY + ml * (fh + (p ? p.loadH / 2 + 0.14 : 0))) / (mt + ml);
    const aLat = Math.abs(this.vP * this.omega);
    const b = S.track / 2 * (S.steer === 'rearSteer' ? 0.5 : 0.75);
    this.latIdx = aLat * hcg / (G * b); this.hcg = hcg;
    if (this.latIdx > 1.0) return this.tip('side');
    if (this.longIdx > 1.3) return this.tip('forward');
    if (this.latIdx > 0.65) this.emit('warn', 'Tip over risk. Slow down before turning, especially with the load raised.', 2, 'latwarn', 3);
    if (this.longIdx > 0.95) this.emit('warn', 'Forward tip risk. The load is near or over capacity for this height and load centre.', 2, 'longwarn', 3);
  }

  tip(dir) {
    this.tipped = dir; this.tipT = 0; this.v = 0;
    const msg = this.spec.stance === 'seated' ? 'The truck tipped over. In a sit down truck: stay in the seat with the belt on, hold the wheel, brace your feet and lean away from the fall.' :
      'The truck tipped over. On a stand up truck: step off backward, away from the falling truck, if you can do it safely.';
    this.emit('tip', msg, 4, 'tip', 10);
  }
  animateTip(dt) {
    this.tipT = Math.min(1, this.tipT + dt * 1.3); const e = this.tipT * this.tipT;
    const b = this.parts.body;
    if (this.tipped === 'side') { const s = this.omega > 0 ? -1 : 1; b.rotation.z = s * e * 1.35; b.position.y = e * 0.15; b.position.x = s * e * 0.2; }
    else { b.rotation.x = e * 0.55; b.position.y = e * 0.1; }
    this.parts.root.updateMatrixWorld(true); if (this.carried) this.placeCarried();
  }

  rules(dt, raised, fh) {
    const S = this.spec, sp = Math.abs(this.v);
    // travelling with the load raised
    if (this.carried && fh > 0.5 && sp > 0.6 && S.kind !== 'orderpicker') { this.flags.raisedT = (this.flags.raisedT || 0) + dt; if (this.flags.raisedT > 1.5) this.emit('violation', 'Travelling with the load raised. Carry loads low, about 4 to 6 inches off the floor.', 2, 'raised', 8); }
    else this.flags.raisedT = 0;
    // site speed limit
    if (sp > 5.4 * MPH) { this.flags.spdT = (this.flags.spdT || 0) + dt; if (this.flags.spdT > 1) this.emit('violation', 'Over the 5 mph site speed limit.', 1, 'speed', 8); } else this.flags.spdT = 0;
    // restraint
    if (S.restraint === 'seatbelt' && !this.restraint && sp > 0.3) this.emit('violation', 'Seat belt not fastened. Press B to buckle up before driving.', 2, 'belt', 15);
    // pedestrians close
    for (const ped of this.world.peds) { const d = Math.hypot(ped.x - this.x, ped.z - this.z); if (d < 2.2 && sp > 1.0) this.emit('violation', 'Too close to a pedestrian at speed. Slow down and give way.', 2, 'pednear', 6); }
    // horn at intersections
    for (const hz of this.world.hornZones) {
      const d = Math.hypot(hz.x - this.x, hz.z - this.z);
      const inside = d < hz.r; const k = 'hz' + hz.x + hz.z;
      if (inside && !this.flags[k] && sp > 0.3) { this.flags[k] = true; if (this.time - this.lastHorn > 4) this.emit('violation', `No horn at the ${hz.name}. Slow down and sound the horn at intersections and blind spots.`, 1, k, 6); else this.emit('good', 'Horn sounded at the intersection. Good.', 0, k + 'g', 6); }
      if (!inside && d > hz.r + 1) this.flags[k] = false;
    }
    // tilt forward while carrying high
    if (this.carried && this.tilt < -1 && fh > 2 && sp > 0.1) this.emit('violation', 'Do not travel with the mast tilted forward and the load raised.', 2, 'tiltfwd', 8);
  }
}

// falling pallets
export function updateFalling(world, dt) {
  for (const p of world.pallets) if (p.state === 'falling') {
    p.fallV += 9.81 * dt; p.y -= p.fallV * dt; p.tilt = Math.min(0.5, (p.tilt || 0) + dt * 1.2);
    const sup = world.supportUnder(p, p.y + 0.3); const floorY = sup.full ? sup.y : 0;
    if (p.y <= floorY) { p.y = floorY; p.state = 'rest'; p.damaged = true; p.tilt = 0.08; p.yaw += 0.3; }
    p.group.matrixAutoUpdate = true; p.sync();
  }
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function satRect(poly, r) {
  const rp = [{ x: r.minX, z: r.minZ }, { x: r.maxX, z: r.minZ }, { x: r.maxX, z: r.maxZ }, { x: r.minX, z: r.maxZ }];
  return satPoly(poly, rp);
}
function satPoly(A, B) {
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const p1 = P[i], p2 = P[(i + 1) % P.length]; const nx = -(p2.z - p1.z), nz = p2.x - p1.x;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const q of A) { const d = q.x * nx + q.z * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const q of B) { const d = q.x * nx + q.z * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}
function pointInPoly(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) c = !c; } return c; }
function distPoly(p, poly) { let m = Infinity; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const dx = b.x - a.x, dz = b.z - a.z; const t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz), 0, 1); m = Math.min(m, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z)); } return m; }
