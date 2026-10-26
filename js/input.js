// Keyboard, touch and gamepad input merged into one control state.
export class Input {
  constructor(root) {
    this.keys = new Set(); this.edges = new Set(); this.touch = { thr: 0, steer: null, hold: new Set() }; this.gpEdges = {};
    addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      const k = e.code; if (!this.keys.has(k)) this.edges.add(k); this.keys.add(k);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    this.buildTouch(root);
    this.gamepadName = null;
    addEventListener('gamepadconnected', e => { this.gamepadName = e.gamepad.id; this.onGamepad && this.onGamepad(e.gamepad.id); });
  }
  buildTouch(root) {
    const t = document.createElement('div'); t.id = 'touch'; root.appendChild(t);
    t.innerHTML = `<div id="stick"><div id="knob"></div></div>
      <div id="tbtns">
        <button data-a="liftUp">Lift up</button><button data-a="tiltBack">Tilt back</button><button data-a="reachOut">Reach out</button><button data-a="sideL">Shift left</button>
        <button data-a="liftDown">Lower</button><button data-a="tiltFwd">Tilt fwd</button><button data-a="reachIn">Reach in</button><button data-a="sideR">Shift right</button>
        <button data-a="horn" class="horn">Horn</button><button data-a="brake" class="brake">Brake</button><button data-e="KeyC">Camera</button><button data-e="KeyB">Belt</button>
      </div>`;
    const stick = t.querySelector('#stick'), knob = t.querySelector('#knob'); let id = null;
    const move = (e) => { const r = stick.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; this.touch.thr = Math.abs(dy) < 0.12 ? 0 : -dy; this.touch.steer = -dx; };
    stick.addEventListener('pointerdown', e => { id = e.pointerId; stick.setPointerCapture(id); move(e); this.usedTouch = true; });
    stick.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
    const end = () => { id = null; knob.style.transform = ''; this.touch.thr = 0; this.touch.steer = null; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    t.querySelectorAll('button[data-a]').forEach(b => {
      const a = b.dataset.a;
      b.addEventListener('pointerdown', e => { e.preventDefault(); this.touch.hold.add(a); b.classList.add('on'); this.usedTouch = true; });
      const up = () => { this.touch.hold.delete(a); b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    });
    t.querySelectorAll('button[data-e]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); this.edges.add(b.dataset.e); }));
  }
  edge(code) { const has = this.edges.has(code); return has; }
  read() {
    const k = this.keys, h = this.touch.hold;
    const ax = (p, n) => (p ? 1 : 0) - (n ? 1 : 0);
    const inp = {
      throttle: ax(k.has('KeyW') || k.has('ArrowUp'), k.has('KeyS') || k.has('ArrowDown')),
      steer: ax(k.has('KeyA') || k.has('ArrowLeft'), k.has('KeyD') || k.has('ArrowRight')),
      steerAbs: null, autoCenter: true,
      brake: k.has('Space') || h.has('brake'),
      lift: ax(k.has('KeyR') || h.has('liftUp'), k.has('KeyF') || h.has('liftDown')),
      tilt: ax(k.has('KeyT') || h.has('tiltBack'), k.has('KeyG') || h.has('tiltFwd')),
      reach: ax(k.has('KeyZ') || h.has('reachOut'), k.has('KeyX') || h.has('reachIn')),
      side: ax(k.has('KeyQ') || h.has('sideL'), k.has('KeyE') || h.has('sideR')),
      horn: k.has('KeyH') || h.has('horn'), level: k.has('KeyL'),
      edges: new Set(this.edges),
    };
    if (this.touch.thr) inp.throttle = this.touch.thr;
    if (this.touch.steer !== null) inp.steerAbs = this.touch.steer;
    // gamepad
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gps) {
      if (!gp) continue; const b = i => gp.buttons[i] ? gp.buttons[i].value : 0; const dz = v => Math.abs(v) < 0.15 ? 0 : v;
      const thr = b(7) - b(6) || -dz(gp.axes[1] || 0); if (thr) inp.throttle = thr;
      const sx = dz(gp.axes[0] || 0); if (sx) inp.steerAbs = -sx;
      const ly = -dz(gp.axes[3] || 0); if (ly) inp.lift = ly;
      if (b(12)) inp.tilt = 1; if (b(13)) inp.tilt = -1; if (b(14)) inp.side = 1; if (b(15)) inp.side = -1;
      if (b(5)) inp.reach = 1; if (b(4)) inp.reach = -1; if (b(0)) inp.horn = true; if (b(1)) inp.brake = true;
      const map = { 3: 'KeyC', 2: 'KeyB', 9: 'Escape', 8: 'KeyP' };
      for (const [i, code] of Object.entries(map)) { const p = b(+i) > 0.5; if (p && !this.gpEdges[i]) inp.edges.add(code); this.gpEdges[i] = p; }
      break;
    }
    this.edges.clear();
    return inp;
  }
}
