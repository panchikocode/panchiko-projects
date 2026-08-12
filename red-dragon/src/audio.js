/* =========================================================================
   audio.js — a 2A03-flavoured sound chip in WebAudio.
   Two pulse channels, a triangle bass, a noise channel. No samples.
   ========================================================================= */
'use strict';

const NOTE_OFF = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function n2f(s) {
  if (!s || s === '-' || s === '.') return 0;
  const m = /^([A-G]#?)(-?\d)$/.exec(s);
  if (!m) return 0;
  const midi = NOTE_OFF[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class Chip {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuf = null;
    this.seq = null;
    this.step = 0;
    this.timer = null;
    this.track = null;
    this.nextTime = 0;
    this.bpm = 132;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    /* a gentle lowpass keeps the square waves from shredding ears */
    this.filt = this.ctx.createBiquadFilter();
    this.filt.type = 'lowpass';
    this.filt.frequency.value = 7200;
    this.filt.connect(this.master);
    this.master.connect(this.ctx.destination);

    const len = this.ctx.sampleRate * 0.6;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let lfsr = 0x7f;
    for (let i = 0; i < len; i++) {
      /* 15-bit LFSR, the NES noise generator */
      const bit = ((lfsr ^ (lfsr >> 1)) & 1);
      lfsr = (lfsr >> 1) | (bit << 14);
      d[i] = (lfsr & 1) ? 0.6 : -0.6;
    }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.55; }

  /** one pulse/triangle voice */
  tone(o) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + (o.delay || 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = o.type || 'square';
    const f0 = o.f0 || 440, f1 = o.f1 === undefined ? f0 : o.f1;
    const dur = o.dur || 0.12;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const vol = (o.vol === undefined ? 0.18 : o.vol);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dry ? this.master : this.filt);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  /** noise burst */
  noise(o) {
    if (!this.ctx || this.muted || !this.noiseBuf) return;
    const t = this.ctx.currentTime + (o.delay || 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = o.rate || 1;
    const bp = this.ctx.createBiquadFilter();
    bp.type = o.filter || 'bandpass';
    bp.frequency.setValueAtTime(o.f0 || 1200, t);
    if (o.f1) bp.frequency.exponentialRampToValueAtTime(Math.max(60, o.f1), t + (o.dur || 0.1));
    bp.Q.value = o.q || 1.0;
    const g = this.ctx.createGain();
    const vol = o.vol === undefined ? 0.2 : o.vol;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.1));
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + (o.dur || 0.1) + 0.02);
  }

  /* ---------------- sound effects ---------------- */
  jump()      { this.tone({ type: 'square', f0: 320, f1: 720, dur: 0.11, vol: 0.14 }); }
  doubleJump(){ this.tone({ type: 'square', f0: 520, f1: 980, dur: 0.10, vol: 0.13 });
                this.tone({ type: 'triangle', f0: 880, f1: 1500, dur: 0.14, vol: 0.08, delay: 0.02 }); }
  land()      { this.noise({ f0: 700, f1: 160, dur: 0.09, vol: 0.13, rate: 0.7 }); }
  dash()      { this.noise({ f0: 2600, f1: 500, dur: 0.20, vol: 0.16, rate: 1.5, filter: 'bandpass', q: 0.6 });
                this.tone({ type: 'sawtooth', f0: 180, f1: 600, dur: 0.14, vol: 0.07 }); }
  swing(i)    { this.noise({ f0: 1800 + i * 500, f1: 380, dur: 0.10, vol: 0.13, rate: 1.3 });
                this.tone({ type: 'square', f0: 640 + i * 120, f1: 300, dur: 0.07, vol: 0.09 }); }
  hit()       { this.noise({ f0: 900, f1: 180, dur: 0.09, vol: 0.19, rate: 0.9 });
                this.tone({ type: 'square', f0: 260, f1: 90, dur: 0.09, vol: 0.13 }); }
  clang()     { this.tone({ type: 'square', f0: 1500, f1: 1200, dur: 0.06, vol: 0.10 });
                this.tone({ type: 'square', f0: 2100, f1: 1700, dur: 0.10, vol: 0.07, delay: 0.02 }); }
  kill()      { this.noise({ f0: 1400, f1: 120, dur: 0.26, vol: 0.20, rate: 0.8 });
                this.tone({ type: 'square', f0: 420, f1: 70, dur: 0.24, vol: 0.12 }); }
  hurt()      { this.tone({ type: 'sawtooth', f0: 380, f1: 90, dur: 0.30, vol: 0.17 });
                this.noise({ f0: 500, f1: 100, dur: 0.22, vol: 0.13, rate: 0.5 }); }
  scroll()    { [0, 0.05, 0.10].forEach((d, i) => this.tone({ type: 'square', f0: n2f(['E5', 'A5', 'C6'][i]), dur: 0.10, vol: 0.13, delay: d })); }
  combo(n)    { this.tone({ type: 'square', f0: n2f('A5') * Math.pow(2, Math.min(10, n) / 24), dur: 0.07, vol: 0.10 }); }
  coin()      { [0, 0.06, 0.12, 0.18].forEach((d, i) => this.tone({ type: 'square', f0: n2f(['A5', 'C6', 'E6', 'A6'][i]), dur: 0.11, vol: 0.12, delay: d })); }
  orb()       { [0, 0.08, 0.16, 0.24, 0.32].forEach((d, i) => this.tone({ type: 'triangle', f0: n2f(['D4', 'A4', 'D5', 'F#5', 'A5'][i]), dur: 0.30, vol: 0.15, delay: d })); }
  chi()       { this.tone({ type: 'triangle', f0: n2f('D5'), f1: n2f('A5'), dur: 0.20, vol: 0.14 }); }
  breakWall() { this.noise({ f0: 2400, f1: 150, dur: 0.34, vol: 0.22, rate: 1.1, filter: 'lowpass', q: 0.4 }); }
  crumble()   { this.noise({ f0: 400, f1: 90, dur: 0.5, vol: 0.14, rate: 0.4, filter: 'lowpass' }); }
  fire()      { this.noise({ f0: 900, f1: 2200, dur: 0.22, vol: 0.11, rate: 0.6, filter: 'bandpass', q: 0.4 }); }
  charge()    { this.tone({ type: 'triangle', f0: 200, f1: 900, dur: 0.60, vol: 0.10 }); }
  blast()     { this.tone({ type: 'sawtooth', f0: 900, f1: 140, dur: 0.30, vol: 0.16 });
                this.noise({ f0: 2600, f1: 300, dur: 0.30, vol: 0.15, rate: 1.2 }); }
  roar()      { this.tone({ type: 'sawtooth', f0: 90, f1: 40, dur: 1.4, vol: 0.24 });
                this.tone({ type: 'square', f0: 135, f1: 58, dur: 1.2, vol: 0.11, delay: 0.05 });
                this.noise({ f0: 300, f1: 60, dur: 1.3, vol: 0.16, rate: 0.35, filter: 'lowpass' }); }
  select()    { this.tone({ type: 'square', f0: n2f('E5'), dur: 0.05, vol: 0.12 }); }
  start()     { ['A4', 'C5', 'E5', 'A5', 'E5', 'A5'].forEach((n, i) => this.tone({ type: 'square', f0: n2f(n), dur: 0.11, vol: 0.14, delay: i * 0.07 })); }
  gameOver()  { ['A4', 'G4', 'F4', 'E4', 'D4', 'A3'].forEach((n, i) => this.tone({ type: 'triangle', f0: n2f(n), dur: 0.42, vol: 0.17, delay: i * 0.24 })); }
  fanfare()   { ['D5', 'F#5', 'A5', 'D6', 'A5', 'D6', 'F#6'].forEach((n, i) => {
                  this.tone({ type: 'square', f0: n2f(n), dur: 0.24, vol: 0.15, delay: i * 0.16 });
                  this.tone({ type: 'triangle', f0: n2f(n) / 2, dur: 0.30, vol: 0.11, delay: i * 0.16 }); }); }

  /* ---------------- music ---------------- */
  play(name) {
    this.init();
    if (this.track === name) return;
    this.stop();
    this.track = name;
    const T = MUSIC[name];
    if (!T) return;
    this.bpm = T.bpm;
    this.step = 0;
    this.nextTime = this.ctx ? this.ctx.currentTime + 0.06 : 0;
    const stepDur = () => 60 / this.bpm / 4;
    this.timer = setInterval(() => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      while (this.nextTime < now + 0.16) {
        this._emit(T, this.step, this.nextTime - now);
        this.nextTime += stepDur();
        this.step = (this.step + 1) % T.len;
      }
    }, 30);
  }
  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.track = null;
  }
  _emit(T, s, delay) {
    if (this.muted) return;
    const sd = 60 / this.bpm / 4;
    const lead = T.lead[s % T.lead.length];
    const harm = T.harm ? T.harm[s % T.harm.length] : null;
    const bass = T.bass[s % T.bass.length];
    const drum = T.drum[s % T.drum.length];
    if (lead && lead !== '.') this.tone({ type: 'square', f0: n2f(lead), dur: sd * (T.legato || 1.7), vol: 0.085, delay });
    if (harm && harm !== '.') this.tone({ type: 'square', f0: n2f(harm), dur: sd * 1.4, vol: 0.045, delay: delay + 0.012 });
    if (bass && bass !== '.') this.tone({ type: 'triangle', f0: n2f(bass), dur: sd * 1.9, vol: 0.13, delay });
    if (drum === 'k') this.noise({ f0: 240, f1: 60, dur: 0.10, vol: 0.15, rate: 0.4, filter: 'lowpass', delay });
    else if (drum === 's') this.noise({ f0: 1700, f1: 700, dur: 0.10, vol: 0.11, rate: 1.0, delay });
    else if (drum === 'h') this.noise({ f0: 6500, f1: 4500, dur: 0.035, vol: 0.05, rate: 1.6, delay });
  }
}

/* -------------------------------------------------------------------------
   The cartridge's three tunes. Pentatonic, as a 1994 Shanghai studio would.
   ------------------------------------------------------------------------- */
const _ = '.';
const MUSIC = {
  title: {
    bpm: 96, len: 32, legato: 2.4,
    lead: ['A4',_,_,_, 'C5',_,'D5',_, 'E5',_,_,_, 'D5',_,'C5',_,
           'A4',_,_,_, 'G4',_,'A4',_, 'E4',_,_,_,_,_,_,_],
    harm: ['E4',_,_,_, 'A4',_,'A4',_, 'A4',_,_,_, 'A4',_,'E4',_,
           'E4',_,_,_, 'D4',_,'E4',_, 'C4',_,_,_,_,_,_,_],
    bass: ['A2',_,_,_, 'A2',_,_,_, 'F2',_,_,_, 'F2',_,_,_,
           'C3',_,_,_, 'C3',_,_,_, 'E2',_,_,_, 'E2',_,_,_],
    drum: [_,_,_,_, _,_,_,_, _,_,_,_, _,_,_,_, _,_,_,_, _,_,_,_, _,_,_,_, _,_,_,_]
  },

  level: {
    bpm: 138, len: 64, legato: 1.5,
    lead: [
      'A4',_,'C5',_, 'E5',_,'D5',_, 'C5',_,'A4',_, 'G4',_,_,_,
      'A4',_,'C5',_, 'E5',_,'G5',_, 'A5',_,'G5',_, 'E5',_,'D5',_,
      'C5',_,'D5',_, 'E5',_,'C5',_, 'A4',_,'G4',_, 'A4',_,_,_,
      'E5',_,'D5',_, 'C5',_,'A4',_, 'G4',_,'A4',_, 'C5',_,_,_
    ],
    harm: [
      'E4',_,_,_, 'A4',_,_,_, 'E4',_,_,_, 'D4',_,_,_,
      'E4',_,_,_, 'A4',_,_,_, 'E5',_,_,_, 'A4',_,_,_,
      'A4',_,_,_, 'A4',_,_,_, 'E4',_,_,_, 'E4',_,_,_,
      'A4',_,_,_, 'E4',_,_,_, 'D4',_,_,_, 'E4',_,_,_
    ],
    bass: [
      'A2',_,'A2',_, 'E2',_,'A2',_, 'F2',_,'F2',_, 'G2',_,'G2',_,
      'A2',_,'A2',_, 'E2',_,'A2',_, 'F2',_,'C3',_, 'G2',_,'G2',_,
      'F2',_,'F2',_, 'C3',_,'C3',_, 'A2',_,'A2',_, 'E2',_,'E2',_,
      'A2',_,'A2',_, 'F2',_,'F2',_, 'G2',_,'G2',_, 'A2',_,'E2',_
    ],
    drum: [
      'k',_,'h',_, 's',_,'h',_, 'k',_,'h','k', 's',_,'h',_,
      'k',_,'h',_, 's',_,'h',_, 'k',_,'h','k', 's',_,'h','h',
      'k',_,'h',_, 's',_,'h',_, 'k',_,'h','k', 's',_,'h',_,
      'k',_,'h',_, 's',_,'h',_, 'k','k','h',_, 's',_,'h','h'
    ]
  },

  boss: {
    bpm: 168, len: 64, legato: 1.2,
    lead: [
      'D5',_,'D5',_, 'F5',_,'E5',_, 'D5',_,'C5',_, 'D5',_,_,_,
      'A5',_,'A5',_, 'G5',_,'F5',_, 'E5',_,'D5',_, 'C5',_,_,_,
      'D5','E5','F5',_, 'A5',_,'F5',_, 'E5',_,'D5',_, 'A4',_,_,_,
      'F5',_,'E5',_, 'D5',_,'C5',_, 'A4',_,'C5',_, 'D5',_,_,_
    ],
    harm: [
      'A4',_,_,_, 'A4',_,_,_, 'F4',_,_,_, 'A4',_,_,_,
      'D5',_,_,_, 'C5',_,_,_, 'A4',_,_,_, 'G4',_,_,_,
      'A4',_,_,_, 'D5',_,_,_, 'A4',_,_,_, 'E4',_,_,_,
      'C5',_,_,_, 'A4',_,_,_, 'F4',_,_,_, 'A4',_,_,_
    ],
    bass: [
      'D2','D2',_,'D2', 'D2',_,'D2',_, 'D2','D2',_,'D2', 'A2',_,'A2',_,
      'D2','D2',_,'D2', 'D2',_,'D2',_, 'C2','C2',_,'C2', 'C2',_,'C2',_,
      'A#1','A#1',_,'A#1', 'A#1',_,'A#1',_, 'F2','F2',_,'F2', 'F2',_,'F2',_,
      'G2','G2',_,'G2', 'G2',_,'G2',_, 'A2','A2',_,'A2', 'A2','A2','A2','A2'
    ],
    drum: [
      'k','h','h','h', 's','h','k','h', 'k','h','h','h', 's','h','h','h',
      'k','h','h','h', 's','h','k','h', 'k','h','h','h', 's','h','s','h',
      'k','h','h','h', 's','h','k','h', 'k','h','h','h', 's','h','h','h',
      'k','h','h','h', 's','h','k','h', 'k','k','h','h', 's','s','s','s'
    ]
  }
};

const SND = new Chip();
window.SND = SND;
window.MUSIC = MUSIC;
