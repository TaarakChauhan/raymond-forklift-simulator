// Synthesised sounds with Web Audio. No audio files.
export class Audio {
  constructor() { this.ctx = null; this.on = true; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC(); this.master = c.createGain(); this.master.gain.value = 0.5; this.master.connect(c.destination);
    // motor whine
    this.motor = c.createOscillator(); this.motor.type = 'sawtooth'; this.motorF = c.createBiquadFilter(); this.motorF.type = 'lowpass'; this.motorF.frequency.value = 600;
    this.motorG = c.createGain(); this.motorG.gain.value = 0; this.motor.connect(this.motorF).connect(this.motorG).connect(this.master); this.motor.start();
    // hydraulic pump
    this.pump = c.createOscillator(); this.pump.type = 'square'; this.pump.frequency.value = 95; this.pumpF = c.createBiquadFilter(); this.pumpF.type = 'lowpass'; this.pumpF.frequency.value = 380;
    this.pumpG = c.createGain(); this.pumpG.gain.value = 0; this.pump.connect(this.pumpF).connect(this.pumpG).connect(this.master); this.pump.start();
    // horn
    this.hornG = c.createGain(); this.hornG.gain.value = 0; this.hornG.connect(this.master);
    for (const f of [415, 520]) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f * 1.5; fl.Q.value = 0.8; o.connect(fl).connect(this.hornG); o.start(); }
    // alarm beeper
    this.beepG = c.createGain(); this.beepG.gain.value = 0; const b = c.createOscillator(); b.frequency.value = 1050; b.type = 'sine'; b.connect(this.beepG).connect(this.master); b.start();
  }
  update(t, st) {
    if (!this.ctx || !this.on) { if (this.ctx) { this.motorG.gain.value = 0; this.pumpG.gain.value = 0; this.hornG.gain.value = 0; this.beepG.gain.value = 0; } return; }
    const now = this.ctx.currentTime, sp = Math.abs(st.v);
    this.motor.frequency.setTargetAtTime(70 + sp * 120, now, 0.08);
    this.motorG.gain.setTargetAtTime(st.keyOn ? 0.012 + Math.min(0.06, sp * 0.02) : 0, now, 0.1);
    this.pumpG.gain.setTargetAtTime(st.pumping ? 0.05 : 0, now, 0.05);
    this.hornG.gain.setTargetAtTime(st.hornOn ? 0.18 : 0, now, 0.01);
    const beepOn = (st.reversing && sp > 0.05) || st.alarm; const ph = (t * 2) % 1 < 0.5;
    this.beepG.gain.setTargetAtTime(beepOn && ph ? 0.06 : 0, now, 0.01);
  }
  thud(strength = 1) {
    if (!this.ctx || !this.on) return; const c = this.ctx, n = c.createBufferSource(); const buf = c.createBuffer(1, c.sampleRate * 0.35, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    n.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; const g = c.createGain(); g.gain.value = 0.5 * strength; n.connect(f).connect(g).connect(this.master); n.start();
  }
  chime(good = true) {
    if (!this.ctx || !this.on) return; const c = this.ctx; const o = c.createOscillator(), g = c.createGain(); o.frequency.value = good ? 880 : 220; o.type = good ? 'sine' : 'triangle';
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.15, c.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5);
    o.connect(g).connect(this.master); o.start(); o.stop(c.currentTime + 0.55);
    if (good) { const o2 = c.createOscillator(); o2.frequency.value = 1320; o2.connect(g); o2.start(c.currentTime + 0.12); o2.stop(c.currentTime + 0.55); }
  }
}
