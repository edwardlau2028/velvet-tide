// VELVET TIDE — all sound is synthesized live with WebAudio: no audio files.
// Three original radio stations (sequenced loops), engine hum, sirens and SFX.
import { RADIO_STATIONS } from './config.js';

export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false;
    this.station = 0; this.step = 0; this.nextNote = 0; this.engineOsc = null;
    this.engineGain = null; this.sirenOsc = null; this.sirenGain = null;
    this.radioOn = true;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.nextNote = this.ctx.currentTime + 0.1;
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 52;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      this.engineOsc.connect(filt); filt.connect(this.engineGain);
      this.engineGain.connect(this.master); this.engineOsc.start();
      // Police siren: alternating tone, silent until wanted.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine'; this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch { this.ctx = null; }
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }
  setEngine(speed01, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.02 + speed01 * 0.05 : 0, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, t, 0.1);
  }
  setSiren(on, t) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.018 : 0, this.ctx.currentTime, 0.2);
    if (on) this.sirenOsc.frequency.value = (Math.floor(t * 1.6) % 2 === 0) ? 720 : 980;
  }
  // Radio sequencer: called every frame; schedules notes ahead of time.
  updateRadio() {
    if (!this.ctx || !this.radioOn || this.muted) return;
    const st = RADIO_STATIONS[this.station];
    const spb = 60 / st.bpm / 2; // eighth notes
    while (this.nextNote < this.ctx.currentTime + 0.25) {
      const s = this.step;
      const root = 110;
      if (s % 4 === 0) this.note(st.bass, root / 2, spb * 3.6, 'sine', 0.16, this.nextNote);
      if (s % 2 === 0) {
        const deg = st.scale[(s * 7 + 3) % st.scale.length];
        this.note(0, root * Math.pow(2, deg / 12) * 2, spb * 0.9, st.wave, 0.05, this.nextNote);
      }
      if (s % 8 === 6) this.note(0, root * 2.5, spb * 0.5, 'triangle', 0.04, this.nextNote);
      this.nextNote += spb; this.step = (this.step + 1) % 64;
    }
  }
  note(freq, f, dur, wave, vol, when) {
    const o = this.ctx.createOscillator();
    o.type = wave || 'sine';
    o.frequency.value = freq || f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(this.master);
    o.start(when); o.stop(when + dur + 0.02);
  }
  cycleStation() {
    this.station = (this.station + 1) % RADIO_STATIONS.length;
    this.step = 0;
    return 'Radio: ' + RADIO_STATIONS[this.station].name;
  }
  blip(freq, dur, wave, vol) {
    if (!this.ctx || this.muted) return;
    this.note(freq, freq, dur, wave || 'sine', vol ?? 0.12, this.ctx.currentTime);
  }
  noise(dur, vol) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.master); src.start();
  }
  shoot() { this.noise(0.14, 0.3); this.blip(180, 0.08, 'square', 0.1); }
  punch() { this.noise(0.08, 0.2); this.blip(90, 0.1, 'sine', 0.2); }
  pickup() { this.blip(660, 0.12, 'sine', 0.14); this.blip(990, 0.18, 'sine', 0.12); }
  coin() { this.blip(880, 0.1, 'triangle', 0.16); this.blip(1320, 0.22, 'triangle', 0.14); }
  jingle() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this.note(f, f, 0.22, 'triangle', 0.14, t0 + i * 0.11));
  }
  busted() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    [392, 311, 233].forEach((f, i) => this.note(f, f, 0.3, 'sawtooth', 0.1, t0 + i * 0.16));
  }
}
