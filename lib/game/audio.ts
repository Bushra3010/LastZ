/* ------------------------------------------------------------------ */
/*  Procedural sound effects + music using the Web Audio API.          */
/*  No audio files needed. Must be unlocked from a user gesture.      */
/* ------------------------------------------------------------------ */

type FilterOpt = { type: BiquadFilterType; freq: number; to?: number; q?: number };

const MUTE_KEY = "lastz-demo-muted";
const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private fx!: GainNode;
  private music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private last: Record<string, number> = {};
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextStep = 0;
  private step = 0;
  muted = false;

  constructor() {
    try { this.muted = typeof window !== "undefined" && localStorage.getItem(MUTE_KEY) === "1"; } catch { /* ignore */ }
  }

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.fx = ctx.createGain(); this.fx.gain.value = 0.8;
      this.music = ctx.createGain(); this.music.gain.value = 0.32;
      this.fx.connect(comp); this.music.connect(comp); comp.connect(this.master); this.master.connect(ctx.destination);
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? "1" : "0"); } catch { /* ignore */ }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.02);
  }

  private ready() {
    return !!this.ctx && this.ctx.state === "running" && !this.muted;
  }
  private throttle(name: string, gap: number) {
    const t = this.ctx!.currentTime;
    if (t - (this.last[name] ?? -9) < gap) return false;
    this.last[name] = t;
    return true;
  }

  private noise(t: number, dur: number, f: FilterOpt, gain: number, dest: AudioNode = this.fx, attack = 0.002) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = f.type;
    fl.frequency.setValueAtTime(f.freq, t);
    if (f.to) fl.frequency.exponentialRampToValueAtTime(f.to, t + dur);
    fl.Q.value = f.q ?? 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(g).connect(dest);
    src.start(t, Math.random() * 0.8);
    src.stop(t + dur + 0.05);
  }

  private tone(t: number, dur: number, type: OscillatorType, f0: number, f1: number, gain: number, dest: AudioNode = this.fx, lp?: number, attack = 0.004) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) {
      const fl = ctx.createBiquadFilter();
      fl.type = "lowpass"; fl.frequency.value = lp;
      node.connect(fl); node = fl;
    }
    node.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /* ------------------------------ sfx ------------------------------ */

  shot(tier: number) {
    if (!this.ready()) return;
    const gaps = [0.075, 0.06, 0.065, 0.045, 0.1];
    if (!this.throttle("shot", gaps[tier] ?? 0.07)) return;
    const t = this.ctx!.currentTime;
    const v = 0.85 + Math.random() * 0.3;
    switch (tier) {
      case 0:
        this.noise(t, 0.1, { type: "bandpass", freq: 2600, to: 700, q: 0.8 }, 0.4 * v);
        this.tone(t, 0.08, "sine", 190, 55, 0.45 * v);
        break;
      case 1:
        this.noise(t, 0.07, { type: "bandpass", freq: 3200, to: 1100, q: 0.7 }, 0.32 * v);
        this.tone(t, 0.05, "sine", 230, 70, 0.3 * v);
        break;
      case 2:
        this.noise(t, 0.16, { type: "lowpass", freq: 6000, to: 500 }, 0.45 * v);
        this.tone(t, 0.11, "sine", 150, 42, 0.55 * v);
        this.noise(t + 0.02, 0.2, { type: "lowpass", freq: 900, to: 200 }, 0.12 * v);
        break;
      case 3:
        this.noise(t, 0.055, { type: "bandpass", freq: 2400, to: 900, q: 0.6 }, 0.33 * v);
        this.tone(t, 0.045, "sine", 125, 50, 0.32 * v);
        break;
      default:
        this.tone(t, 0.18, "sawtooth", 1700, 160, 0.14 * v, this.fx, 3500);
        this.tone(t, 0.14, "sine", 980, 260, 0.2 * v);
        this.noise(t, 0.08, { type: "highpass", freq: 4500 }, 0.08 * v);
    }
  }

  ping() {
    if (!this.ready() || !this.throttle("ping", 0.07)) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 0.05, "triangle", 1900 + Math.random() * 400, 1200, 0.05);
    this.noise(t, 0.04, { type: "bandpass", freq: 1200, q: 2 }, 0.08);
  }

  splat() {
    if (!this.ready() || !this.throttle("splat", 0.06)) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.13, { type: "lowpass", freq: 1400, to: 180 }, 0.3);
    this.tone(t, 0.1, "sine", 110, 40, 0.18);
  }

  growl() {
    if (!this.ready() || !this.throttle("growl", 0.9)) return;
    const t = this.ctx!.currentTime;
    const f = 70 + Math.random() * 40;
    this.tone(t, 0.6, "sawtooth", f, f * 0.7, 0.07, this.fx, 600, 0.08);
    this.noise(t, 0.5, { type: "bandpass", freq: 500, q: 3 }, 0.05, this.fx, 0.08);
  }

  hurt() {
    if (!this.ready() || !this.throttle("hurt", 0.12)) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 0.16, "square", 320, 110, 0.08, this.fx, 1400);
    this.noise(t, 0.1, { type: "bandpass", freq: 900, q: 1.2 }, 0.18);
  }

  explosion(big = false) {
    if (!this.ready() || !this.throttle("boom", 0.08)) return;
    const t = this.ctx!.currentTime;
    const d = big ? 1.4 : 0.8;
    this.noise(t, d, { type: "lowpass", freq: 1800, to: 60 }, big ? 0.9 : 0.7, this.fx, 0.004);
    this.tone(t, d * 0.8, "sine", 85, 24, big ? 0.9 : 0.7);
    this.noise(t, 0.12, { type: "highpass", freq: 2500 }, 0.2);
  }

  wood() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.25, { type: "bandpass", freq: 700, to: 300, q: 2.5 }, 0.45);
    this.noise(t + 0.03, 0.15, { type: "bandpass", freq: 1600, q: 3 }, 0.25);
  }

  gate(good: boolean) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    if (good) {
      [72, 76, 79, 84].forEach((n, i) => this.tone(t + i * 0.065, 0.18, "triangle", NOTE(n), NOTE(n), 0.22));
      this.noise(t, 0.4, { type: "highpass", freq: 6000 }, 0.06);
    } else {
      [67, 63, 60, 55].forEach((n, i) => this.tone(t + i * 0.08, 0.2, "square", NOTE(n), NOTE(n) * 0.97, 0.08, this.fx, 1800));
    }
  }

  pickup() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 0.18, "sine", 600, 1400, 0.2);
    this.tone(t + 0.08, 0.18, "triangle", 900, 1800, 0.12);
  }

  upgrade() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone(t + i * 0.05, 0.22, "square", NOTE(n), NOTE(n), 0.07, this.fx, 3000));
    this.tone(t + 0.35, 0.5, "triangle", NOTE(84), NOTE(84), 0.18);
    this.noise(t + 0.3, 0.5, { type: "highpass", freq: 7000 }, 0.08);
    // reload clack
    this.noise(t, 0.05, { type: "bandpass", freq: 2500, q: 4 }, 0.3);
    this.noise(t + 0.12, 0.05, { type: "bandpass", freq: 1800, q: 4 }, 0.3);
  }

  roar() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 1.6);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9;
    const lg = ctx.createGain(); lg.gain.value = 14;
    lfo.connect(lg).connect(o.frequency);
    const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    o.connect(fl).connect(g).connect(this.fx);
    o.start(t); lfo.start(t); o.stop(t + 1.8); lfo.stop(t + 1.8);
    this.noise(t, 1.5, { type: "bandpass", freq: 450, q: 1.5 }, 0.3, this.fx, 0.15);
  }

  smash() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 0.5, "sine", 70, 28, 0.9);
    this.noise(t, 0.5, { type: "lowpass", freq: 1200, to: 80 }, 0.6);
  }

  click() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 0.06, "triangle", 900, 650, 0.18);
  }

  victory() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const mel: [number, number, number][] = [[72, 0, 0.14], [72, 0.15, 0.14], [72, 0.3, 0.14], [76, 0.45, 0.35], [74, 0.85, 0.14], [76, 1.0, 0.14], [79, 1.15, 0.7]];
    for (const [n, at, d] of mel) {
      this.tone(t + at, d + 0.1, "square", NOTE(n), NOTE(n), 0.08, this.fx, 3200);
      this.tone(t + at, d + 0.1, "triangle", NOTE(n - 12), NOTE(n - 12), 0.14);
    }
  }

  defeat() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    [64, 62, 60, 55].forEach((n, i) => this.tone(t + i * 0.32, 0.5, "sawtooth", NOTE(n), NOTE(n) * 0.98, 0.1, this.fx, 1400));
    this.tone(t + 1.2, 1.2, "sine", NOTE(43), NOTE(36), 0.3);
  }

  /* ----------------------------- music ----------------------------- */

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.music.gain.setTargetAtTime(0.32, this.ctx.currentTime, 0.1);
    this.step = 0;
    this.nextStep = this.ctx.currentTime + 0.08;
    this.musicTimer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  duckMusic(paused: boolean) {
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(paused ? 0 : 0.32, this.ctx.currentTime, 0.05);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const stepDur = 60 / 132 / 2;
    while (this.nextStep < ctx.currentTime + 0.12) {
      if (!this.muted) this.playStep(this.step, this.nextStep);
      this.nextStep += stepDur;
      this.step++;
    }
  }

  private playStep(s: number, t: number) {
    const m = this.music;
    const i = s % 16;
    const bar = Math.floor(s / 16) % 4;
    if (i % 4 === 0 || i === 10) this.tone(t, 0.22, "sine", 150, 42, 0.75, m, undefined, 0.002);
    if (i === 4 || i === 12) {
      this.noise(t, 0.16, { type: "bandpass", freq: 1900, q: 0.7 }, 0.35, m);
      this.tone(t, 0.09, "triangle", 220, 160, 0.14, m);
    }
    this.noise(t, 0.035, { type: "highpass", freq: 8000 }, i % 2 ? 0.05 : 0.09, m);
    const roots = [45, 45, 43, 41];
    const pat = [0, 0, -1, 0, 12, -1, 0, -1, 0, 0, -1, 3, -1, 0, 7, -1];
    if (pat[i] >= 0) {
      const n = roots[bar] - 12 + pat[i];
      this.tone(t, 0.2, "sawtooth", NOTE(n), NOTE(n), 0.16, m, 520, 0.005);
    }
    if (i === 0) {
      const chord = bar === 2 ? [55, 59, 62] : bar === 3 ? [53, 57, 60] : [57, 60, 64];
      for (const n of chord) this.tone(t, 1.6, "triangle", NOTE(n), NOTE(n), 0.025, m, 1600, 0.2);
    }
    if (bar >= 2 && (i === 6 || i === 14)) {
      const n = [69, 72, 76, 74][(s >> 3) % 4];
      this.tone(t, 0.18, "square", NOTE(n), NOTE(n), 0.03, m, 2400);
    }
  }
}

export const sfx = new Sfx();
