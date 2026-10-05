import { EngineCallbacks, Upgrades, WEAPONS } from "./types";
import {
  GUN, RUNNER_LOOK, SPR, Sprite, barrelSprite, bruteSprite, carSprite, flashOf, gunPt,
  muzzleSprite, shadowSprite, softDot, soldierSprite, zombieSprite,
} from "./sprites";
import { sfx } from "./audio";

/* ------------------------------------------------------------------ */
/*  World constants                                                    */
/*  x: -1..1 across the road, z: distance ahead of the squad (0)       */
/* ------------------------------------------------------------------ */
const D0 = 16; // camera distance to z = 0
const FAR = 32; // spawn distance
const NEAR = -4; // behind the squad (still on screen)
const SCROLL = 3.4; // world units / sec
const MAX_VIS = 60; // max soldiers rendered
const MAX_SHOOTERS = 8;
const FONT = '"Russo One", "Arial Black", Impact, sans-serif';

type Mode = "idle" | "play" | "paused" | "ending";
type ZKind = "walker" | "runner" | "brute" | "boss";

interface Troop { ox: number; oz: number; tx: number; tz: number; recoil: number; phase: number; hair: number }
interface Zombie {
  kind: ZKind; x: number; z: number; hp: number; maxHp: number; speed: number; size: number;
  steer: number; phase: number; hit: number; attackT: number; dead: boolean;
  skin: string; shirt: string; pants: string; wob: number; look: number;
}
interface Bullet { x: number; z: number; prevZ: number; vx: number; vz: number; dmg: number; pierce: number; tier: number; dead: boolean; hits: Zombie[] }
interface GateSide { op: "+" | "x" | "÷"; v: number; acc: number; flash: number }
interface Gate { z: number; sides: [GateSide, GateSide]; used: boolean; fade: number; chosen: number }
type Reward = "weapon" | "squad" | "coins";
interface Barrel { x: number; z: number; hp: number; maxHp: number; reward: Reward; amount: number; flash: number; dead: boolean }
type PKind = "blood" | "spark" | "fire" | "smoke" | "debris" | "star" | "shell";
interface Particle { k: PKind; x: number; z: number; y: number; vx: number; vz: number; vy: number; life: number; max: number; size: number; color: string }
interface Decal { x: number; z: number; r: number; color: string; a: number }
interface FText { x: number; z: number; y: number; text: string; color: string; life: number; size: number }
type LevelEvent =
  | { at: number; t: "horde"; n: number; runners: number; brutes: number }
  | { at: number; t: "gate"; sides: [GateSide, GateSide] }
  | { at: number; t: "barrels"; items: { x: number; reward: Reward; amount: number; hp: number }[] }
  | { at: number; t: "boss" };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const SKINS = ["#8fa66b", "#9bb07a", "#7f9a63", "#a3a88a", "#b6b58f", "#8c9c78"];
const SHIRTS = ["#5b4a3a", "#3f4f63", "#6b3434", "#4a5a3a", "#6a6a6a", "#7a5a2a", "#2f3b4a", "#7d7466"];
const PANTS = ["#2b2b33", "#3b3428", "#26303a", "#3a3a3a"];

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: EngineCallbacks;

  private w = 0; private h = 0; private dpr = 1;
  private cx = 0; private horizon = 0; private K = 0; private C = 0; private R0 = 1;

  private raf = 0; private last = 0; private destroyed = false;
  private mode: Mode = "idle";
  private time = 0;
  private roadOffset = 0;
  private theme = 0;

  // run state
  private level = 1;
  private upg: Upgrades = { squad: 0, damage: 0, rate: 0 };
  private count = 5;
  private squadX = 0; private targetX = 0;
  private troops: Troop[] = [];
  private weapon = 0;
  private fireAcc = 0;
  private zombies: Zombie[] = [];
  private bullets: Bullet[] = [];
  private gates: Gate[] = [];
  private barrels: Barrel[] = [];
  private particles: Particle[] = [];
  private decals: Decal[] = [];
  private texts: FText[] = [];
  private events: LevelEvent[] = []; private evIdx = 0;
  private dist = 0; private levelLen = 1;
  private coins = 0; private kills = 0;
  private boss: Zombie | null = null;
  private shake = 0;
  private endTimer = -1; private endVictory = false;
  private hudTimer = 0;
  private quick = false;
  private fireGlow = 0;
  private warm: (() => void)[] = [];
  private keys = { left: false, right: false };
  private drag: { px: number; tx: number } | null = null;
  private ro: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cb = cb;
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
    this.syncTroops();
    this.queueWarm(0);
    canvas.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
  }

  /** Pre-render sprites a few per frame so gameplay never hitches. */
  private queueWarm(tier: number) {
    for (let f = 0; f < 8; f++) for (let h = 0; h < 3; h++) for (const rc of [0, 1]) this.warm.push(() => soldierSprite(f, h, tier, rc));
    this.warm.push(() => muzzleSprite(tier));
    if (tier > 0) return;
    this.warm.push(() => barrelSprite());
    for (let l = 0; l <= RUNNER_LOOK; l++) for (let f = 0; f < 8; f++) this.warm.push(() => zombieSprite(l, f));
    for (let f = 0; f < 8; f++) { this.warm.push(() => bruteSprite(false, f, 0)); this.warm.push(() => bruteSprite(true, f, 0)); }
    for (const c of ["#7a2a2a", "#2f4a6a", "#c9c4b4", "#3b5a3a"]) for (const v of [0, 1]) this.warm.push(() => carSprite(c, v));
  }

  /* ---------------------------- public API ---------------------------- */

  start(level: number, upg: Upgrades, quick = false) {
    this.quick = quick;
    this.level = level;
    this.upg = upg;
    this.theme = (level - 1) % 2;
    this.count = 5 + upg.squad;
    this.troops = [];
    this.syncTroops();
    this.squadX = 0; this.targetX = 0;
    this.weapon = 0; this.fireAcc = 0;
    this.zombies = []; this.bullets = []; this.gates = []; this.barrels = [];
    this.particles = []; this.decals = []; this.texts = [];
    this.coins = 0; this.kills = 0; this.boss = null;
    this.dist = 0; this.endTimer = -1; this.shake = 0;
    this.buildLevel();
    this.mode = "play";
    this.emitHud();
    sfx.startMusic();
  }

  pause(p: boolean) {
    if (p && this.mode === "play") { this.mode = "paused"; sfx.duckMusic(true); }
    else if (!p && this.mode === "paused") { this.mode = "play"; this.last = performance.now(); sfx.duckMusic(false); }
  }

  quit() {
    sfx.stopMusic();
    sfx.duckMusic(false);
    this.mode = "idle";
    this.zombies = []; this.bullets = []; this.gates = []; this.barrels = [];
    this.boss = null;
    this.count = Math.max(this.count, 5);
    this.syncTroops();
  }

  /* ------------------------------ input ------------------------------ */

  private onDown = (e: PointerEvent) => {
    this.drag = { px: e.clientX, tx: this.targetX };
  };
  private onMove = (e: PointerEvent) => {
    if (this.mode !== "play") return;
    if (this.drag) {
      this.targetX = this.drag.tx + ((e.clientX - this.drag.px) / this.R0) * 1.25;
    } else if (e.pointerType === "mouse") {
      const r = this.canvas.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        this.targetX = (e.clientX - r.left - this.cx) / this.R0;
      }
    }
  };
  private onUp = () => { this.drag = null; };
  private onKey = (e: KeyboardEvent) => {
    const down = e.type === "keydown";
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") this.keys.left = down;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") this.keys.right = down;
  };

  /* ---------------------------- projection ---------------------------- */

  private resize() {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth ?? 400;
    const h = parent?.clientHeight ?? 800;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.cx = w / 2;
    this.R0 = w * 0.47;
    this.horizon = -0.2 * h;
    const y0 = 0.78 * h;
    this.K = this.R0 * D0;
    this.C = (y0 - this.horizon) * D0;
  }

  private proj(x: number, z: number, hgt = 0) {
    const d = Math.max(0.5, z + D0);
    const s = this.K / d;
    return { x: this.cx + x * s, y: this.horizon + this.C / d - hgt * s, s };
  }

  /* --------------------------- level script --------------------------- */

  private buildLevel() {
    const L = this.level;
    const ev: LevelEvent[] = [];
    this.levelLen = this.quick ? 70 : 150 + L * 22;
    ev.push({ at: 3, t: "horde", n: 4 + L * 2, runners: 0, brutes: 0 });
    ev.push({ at: 8, t: "gate", sides: [{ op: "+", v: 4 + L, acc: 0, flash: 0 }, { op: "x", v: 2, acc: 0, flash: 0 }] });
    ev.push({ at: 18, t: "barrels", items: this.barrelRow(true) });
    let at = 22;
    let lastType = "barrels";
    while (at < this.levelLen - 14) {
      at += rand(9, 13);
      const r = Math.random();
      if (r < 0.46 || lastType !== "horde") {
        const n = Math.round(10 + L * 4 + rand(0, 6) + at * 0.04);
        ev.push({ at, t: "horde", n, runners: L >= 2 ? randi(0, 2 + L) : randi(0, 2), brutes: L >= 2 && Math.random() < 0.35 ? 1 : 0 });
        lastType = "horde";
      } else if (r < 0.72) {
        ev.push({ at, t: "gate", sides: this.randomGate() });
        lastType = "gate";
      } else {
        ev.push({ at, t: "barrels", items: this.barrelRow(Math.random() < 0.5) });
        lastType = "barrels";
      }
    }
    ev.push({ at: this.levelLen - 6, t: "horde", n: 12 + L * 5, runners: 2 + L, brutes: L >= 3 ? 1 : 0 });
    ev.push({ at: this.levelLen, t: "boss" });
    ev.sort((a, b) => a.at - b.at);
    this.events = ev;
    this.evIdx = 0;
  }

  private randomGate(): [GateSide, GateSide] {
    const L = this.level;
    const good = (): GateSide => Math.random() < 0.6
      ? { op: "+", v: randi(3, 6 + L * 2), acc: 0, flash: 0 }
      : { op: "x", v: Math.random() < 0.75 ? 2 : 3, acc: 0, flash: 0 };
    const bad = (): GateSide => Math.random() < 0.7
      ? { op: "+", v: -randi(2, 5 + L), acc: 0, flash: 0 }
      : { op: "÷", v: 2, acc: 0, flash: 0 };
    const a = good();
    const b = Math.random() < 0.25 ? good() : bad();
    return Math.random() < 0.5 ? [a, b] : [b, a];
  }

  private barrelRow(withWeapon: boolean) {
    const L = this.level;
    const xs = [-0.64, 0, 0.64];
    const n = Math.random() < 0.4 ? 2 : 3;
    const slots = n === 3 ? xs : Math.random() < 0.5 ? [xs[0], xs[2]] : [xs[0], xs[1]];
    const weaponSlot = withWeapon ? randi(0, slots.length - 1) : -1;
    return slots.map((x, i) => {
      const reward: Reward = i === weaponSlot ? "weapon" : Math.random() < 0.55 ? "squad" : "coins";
      const base = reward === "weapon" ? 14 + L * 10 : 7 + L * 5;
      return { x, reward, amount: reward === "squad" ? randi(2, 3 + L) : randi(10, 25), hp: Math.round(base + rand(0, base * 0.6)) };
    });
  }

  private spawn(e: LevelEvent) {
    if (e.t === "horde") {
      const spread = 2 + e.n * 0.09;
      for (let i = 0; i < e.n; i++) this.zombies.push(this.makeZombie("walker", rand(-0.92, 0.92), FAR + rand(0, spread)));
      for (let i = 0; i < e.runners; i++) this.zombies.push(this.makeZombie("runner", rand(-0.9, 0.9), FAR + rand(0, spread)));
      for (let i = 0; i < e.brutes; i++) this.zombies.push(this.makeZombie("brute", rand(-0.5, 0.5), FAR + spread + 1));
    } else if (e.t === "gate") {
      this.gates.push({ z: FAR, sides: e.sides, used: false, fade: 1, chosen: -1 });
    } else if (e.t === "barrels") {
      for (const it of e.items) this.barrels.push({ x: it.x, z: FAR, hp: it.hp, maxHp: it.hp, reward: it.reward, amount: it.amount, flash: 0, dead: false });
    } else if (e.t === "boss") {
      const b = this.makeZombie("boss", 0, FAR - 5);
      b.hp = b.maxHp = b.maxHp * Math.max(1, Math.pow(this.count / 10, 0.85));
      this.boss = b;
      this.zombies.push(b);
      for (let i = 0; i < 6 + this.level * 2; i++) this.zombies.push(this.makeZombie("walker", rand(-0.9, 0.9), FAR + rand(0, 3)));
      this.cb.onToast("BOSS INCOMING!", "boss");
      sfx.roar();
      this.shake = 6;
    }
  }

  private makeZombie(kind: ZKind, x: number, z: number): Zombie {
    const L = this.level;
    let hp = 2 + L * 1.3, speed = rand(0.6, 1.1), size = rand(0.92, 1.08), steer = 0.22;
    if (kind === "runner") { hp = 1.4 + L * 0.8; speed = rand(2.2, 2.8); size = 0.9; steer = 0.45; }
    if (kind === "brute") { hp = (26 + L * 14) * Math.max(1, Math.pow(this.count / 15, 0.7)); speed = 0.55; size = 1.9; steer = 0.12; }
    if (kind === "boss") { hp = 260 + L * 190; speed = 0.8; size = 3.6; steer = 0.35; }
    return {
      kind, x, z, hp, maxHp: hp, speed, size, steer, phase: rand(0, 6.28), hit: 0, attackT: 0, dead: false,
      skin: kind === "runner" ? "#b9a37a" : pick(SKINS),
      shirt: kind === "runner" ? "#8a2b2b" : pick(SHIRTS),
      pants: pick(PANTS), wob: rand(0, 6.28),
      look: kind === "runner" ? RUNNER_LOOK : randi(0, 7),
    };
  }

  /* ------------------------------ squad ------------------------------ */

  private syncTroops() {
    const n = Math.min(this.count, MAX_VIS);
    while (this.troops.length < n) this.troops.push({ ox: rand(-0.05, 0.05), oz: -0.3, tx: 0, tz: 0, recoil: 0, phase: rand(0, 6.28), hair: randi(0, 2) });
    while (this.troops.length > n) this.troops.pop();
    for (let i = 0; i < this.troops.length; i++) {
      const r = 0.088 * Math.sqrt(i);
      const th = i * 2.39996;
      this.troops[i].tx = r * Math.cos(th);
      this.troops[i].tz = r * Math.sin(th) * 0.72;
    }
  }

  private squadHalfW() {
    let m = 0;
    for (const t of this.troops) m = Math.max(m, Math.abs(t.tx));
    return m + 0.07;
  }
  private frontZ() {
    let m = -1;
    for (const t of this.troops) m = Math.max(m, t.oz);
    return this.troops.length ? m : 0;
  }

  private killTroop(i: number) {
    sfx.hurt();
    const t = this.troops[i];
    if (t) {
      this.blood(this.squadX + t.ox, t.oz, 0.15, "#b3141b", 10);
      this.decals.push({ x: this.squadX + t.ox, z: t.oz, r: 0.09, color: "#7a0c10", a: 0.8 });
    }
    this.count = Math.max(0, this.count - 1);
    if (this.troops.length > this.count) this.troops.splice(i, 1);
    this.syncTroops();
  }

  private killNearestTroops(x: number, n: number) {
    for (let k = 0; k < n && this.troops.length; k++) {
      let bi = 0, bd = Infinity;
      this.troops.forEach((t, i) => {
        const d = Math.abs(this.squadX + t.ox - x) - t.oz * 0.5;
        if (d < bd) { bd = d; bi = i; }
      });
      this.killTroop(bi);
    }
  }

  /* ------------------------------ loop ------------------------------ */

  private loop = (now: number) => {
    if (this.destroyed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.time += dt;
    for (let i = 0; i < 6 && this.warm.length; i++) this.warm.shift()!();
    if (this.mode === "paused") return;
    const speed = this.mode === "idle" ? SCROLL * 0.6 : SCROLL;
    this.roadOffset += speed * dt;

    for (const t of this.troops) {
      t.ox += (t.tx - t.ox) * Math.min(1, dt * 8);
      t.oz += (t.tz - t.oz) * Math.min(1, dt * 8);
      t.recoil = Math.max(0, t.recoil - dt * 9);
    }
    this.updateFx(dt, speed);
    if (this.mode === "idle") return;

    const playing = this.mode === "play";
    if (playing) {
      this.dist += SCROLL * dt;
      while (this.evIdx < this.events.length && this.dist >= this.events[this.evIdx].at) this.spawn(this.events[this.evIdx++]);
      if (this.keys.left) this.targetX -= 2.4 * dt;
      if (this.keys.right) this.targetX += 2.4 * dt;
    }
    const hw = this.squadHalfW();
    const lim = Math.max(0, 1 - hw);
    this.targetX = clamp(this.targetX, -lim, lim);
    this.squadX += (this.targetX - this.squadX) * Math.min(1, dt * 12);

    if (this.count > 0) this.fire(dt);
    this.updateBullets(dt);
    this.updateZombies(dt);
    this.updateGates(dt);
    this.updateBarrels(dt);

    if (playing) {
      if (this.count <= 0) {
        this.mode = "ending"; this.endVictory = false; this.endTimer = 1.6;
        this.cb.onToast("SQUAD WIPED OUT", "bad");
        sfx.stopMusic(); sfx.defeat();
      } else if (this.boss && this.boss.dead) {
        this.mode = "ending"; this.endVictory = true; this.endTimer = 2.2;
        for (const z of this.zombies) if (!z.dead) { this.blood(z.x, z.z, 0.2, "#4f7a2b", 8); z.dead = true; }
        this.cb.onToast("STAGE CLEAR!", "good");
        sfx.stopMusic(); sfx.victory();
      }
    }
    if (this.mode === "ending") {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        const victory = this.endVictory;
        if (victory) this.coins += 50 + this.level * 25;
        this.emitHud();
        this.cb.onEnd({ victory, level: this.level, coins: this.coins, kills: this.kills, squad: this.count });
        this.mode = "idle";
        this.zombies = []; this.bullets = []; this.gates = []; this.barrels = [];
        if (this.count === 0) { this.count = 5; this.syncTroops(); }
      }
    }

    this.shake = Math.max(0, this.shake - dt * 20);
    this.fireGlow = Math.max(0, this.fireGlow - dt * 6);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) { this.hudTimer = 0.1; this.emitHud(); }
  }

  private emitHud() {
    const wp = WEAPONS[this.weapon];
    this.cb.onHud({
      squad: this.count, level: this.level, progress: clamp(this.dist / this.levelLen, 0, 1),
      coins: this.coins, kills: this.kills, weapon: wp.name, weaponTier: this.weapon,
      bossHp: this.boss && !this.boss.dead ? this.boss.hp / this.boss.maxHp : null,
    });
  }

  private fire(dt: number) {
    if (!this.troops.length) return;
    const wp = WEAPONS[this.weapon];
    const shooters = Math.min(this.count, MAX_SHOOTERS);
    const rate = wp.rate * (1 + this.upg.rate * 0.1) * shooters;
    const dmg = wp.dmg * (1 + this.upg.damage * 0.15) * Math.pow(this.count / shooters, 0.8);
    this.fireAcc += dt * rate;
    if (this.fireAcc < 1) return;
    // auto-aim: nearest few zombies in front of the squad
    const targets: { x: number; z: number; speed: number }[] = this.zombies.filter((z) => !z.dead && z.z > 0.4 && z.z < FAR - 6);
    for (const br of this.barrels) {
      if (!br.dead && br.z > 0.4 && br.z < FAR - 6 && Math.abs(br.x - this.squadX) < 0.4) targets.push({ x: br.x, z: br.z - 0.3, speed: 0 });
    }
    targets.sort((a, b) => a.z - b.z);
    targets.length = Math.min(targets.length, 5);
    while (this.fireAcc >= 1) {
      this.fireAcc -= 1;
      const t = this.troops[Math.floor(Math.random() * this.troops.length)];
      t.recoil = 1;
      const z = t.oz + 0.12;
      const x = this.squadX + t.ox + 0.012;
      let vx = rand(-0.15, 0.15);
      if (targets.length) {
        const tg = targets[Math.floor(Math.random() * targets.length)];
        const tz = Math.max(0.5, tg.z - (SCROLL + tg.speed) * ((tg.z - z) / wp.speed));
        vx = clamp(((tg.x - x) / (tz - z)) * wp.speed, -wp.speed * 0.35, wp.speed * 0.35);
      }
      this.bullets.push({ x, z, prevZ: z, vx, vz: wp.speed, dmg, pierce: wp.pierce, tier: this.weapon, dead: false, hits: [] });
      if (this.weapon !== 4 && this.particles.length < 700 && Math.random() < 0.45) {
        this.particles.push({ k: "shell", x: x + 0.03, z: t.oz, y: 0.27, vx: rand(0.5, 1.1), vz: rand(-0.4, 0.2), vy: rand(0.7, 1.4), life: 0.7, max: 0.7, size: 0.011, color: "#e2b24c" });
      }
    }
    this.fireGlow = 1;
    sfx.shot(this.weapon);
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      b.prevZ = b.z;
      b.z += b.vz * dt;
      b.x += b.vx * dt;
      if (Math.abs(b.x) > 1.2) { b.dead = true; continue; }
      if (b.z > FAR - 2) { b.dead = true; continue; }
      for (const g of this.gates) {
        if (g.used || g.z < b.prevZ - 0.05 || g.z > b.z + 0.05) continue;
        this.hitGate(g, b.x < 0 ? 0 : 1, b.dmg);
        this.sparks(b.x, g.z, 0.35, "#bfe3ff", 2);
        sfx.ping();
        b.dead = true; break;
      }
      if (b.dead) continue;
      for (const br of this.barrels) {
        if (br.dead || Math.abs(b.x - br.x) > 0.19 || br.z - 0.12 > b.z || br.z + 0.12 < b.prevZ) continue;
        br.hp -= b.dmg; br.flash = 0.08;
        this.sparks(b.x, br.z - 0.1, 0.25, "#ffd27a", 2);
        sfx.ping();
        if (br.hp <= 0) this.destroyBarrel(br, true);
        b.dead = true; break;
      }
      if (b.dead) continue;
      for (const z of this.zombies) {
        if (z.dead || b.hits.includes(z)) continue;
        const r = 0.065 * z.size + 0.03;
        if (Math.abs(b.x - z.x) > r || z.z - r > b.z || z.z + r < b.prevZ) continue;
        this.damageZombie(z, b.dmg);
        if (b.pierce > 0) { b.pierce--; b.hits.push(z); }
        else { b.dead = true; break; }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  private hitGate(g: Gate, side: number, dmg: number) {
    const s = g.sides[side];
    s.flash = 0.06;
    if (s.op !== "+") return;
    s.acc += dmg;
    const need = (5 + this.level * 1.5) * (1 + this.count / 8);
    while (s.acc >= need) { s.acc -= need; s.v = Math.min(25 + this.level * 5, s.v + 1); }
  }

  private damageZombie(z: Zombie, dmg: number) {
    z.hp -= dmg;
    z.hit = 0.07;
    if (Math.random() < 0.35) this.blood(z.x, z.z, 0.2 * z.size, z.kind === "boss" || z.kind === "brute" ? "#9b1d24" : "#5d8a2f", 2);
    if (z.hp <= 0) {
      z.dead = true;
      this.kills++;
      const big = z.kind === "boss" || z.kind === "brute";
      sfx.splat();
      if (big) sfx.explosion(z.kind === "boss");
      this.coins += z.kind === "boss" ? 100 : z.kind === "brute" ? 10 : 1;
      this.blood(z.x, z.z, 0.15 * z.size, big ? "#a4161f" : "#4f7a2b", big ? 40 : 9);
      this.decals.push({ x: z.x, z: z.z, r: 0.08 * z.size, color: big ? "#6a0d12" : "#3d5a22", a: 0.75 });
      if (big) {
        this.explosion(z.x, z.z, z.kind === "boss" ? 2 : 1);
        this.shake = z.kind === "boss" ? 14 : 6;
        this.texts.push({ x: z.x, z: z.z, y: 0.6 * z.size * 0.4, text: z.kind === "boss" ? "+100" : "+10", color: "#ffd84a", life: 1.2, size: 0.13 });
      }
    }
  }

  private updateZombies(dt: number) {
    const front = this.frontZ();
    const back = this.troops.reduce((m, t) => Math.min(m, t.oz), 0);
    for (const z of this.zombies) {
      if (z.dead) continue;
      z.hit -= dt;
      z.phase += dt * (5 + z.speed * 3);
      if (z.kind === "boss") {
        const stop = front + 0.75;
        if (z.z > stop) z.z -= (SCROLL * 0.6 + z.speed) * dt;
        else {
          z.z = stop;
          if (this.count > 0) {
            z.attackT += dt;
            if (z.attackT > 1.2) {
              z.attackT = 0;
              this.killNearestTroops(z.x, Math.min(2 + Math.floor(this.level / 3), this.count));
              this.shake = 10;
              sfx.smash();
              for (let i = 0; i < 10; i++) this.particles.push({ k: "smoke", x: z.x + rand(-0.3, 0.3), z: front + 0.2, y: 0.02, vx: rand(-0.6, 0.6), vz: rand(-0.3, 0.3), vy: rand(0.1, 0.4), life: 0.8, max: 0.8, size: 0.08, color: "#9a8f80" });
            }
          }
        }
        z.x += clamp(this.squadX - z.x, -1, 1) * z.steer * dt;
        z.x = clamp(z.x, -0.7, 0.7);
        continue;
      }
      z.z -= (SCROLL + z.speed) * dt;
      if (z.z < 14 && Math.random() < dt * 0.12) sfx.growl();
      if (z.z < 20) z.x += clamp(this.squadX - z.x, -0.6, 0.6) * z.steer * dt;
      z.x += Math.sin(this.time * 1.7 + z.wob) * 0.04 * dt;
      z.x = clamp(z.x, -0.95, 0.95);

      if (this.count > 0 && z.z <= front + 0.06 && z.z >= back - 0.25) {
        const reach = 0.055 * z.size + 0.06;
        let hitIdx = -1;
        for (let i = 0; i < this.troops.length; i++) {
          const t = this.troops[i];
          if (Math.abs(this.squadX + t.ox - z.x) < reach && Math.abs(t.oz - z.z) < 0.14) { hitIdx = i; break; }
        }
        if (hitIdx >= 0) {
          if (z.kind === "brute") { this.killNearestTroops(z.x, 3); this.shake = 6; this.explosion(z.x, z.z, 1); }
          else this.killTroop(hitIdx);
          z.dead = true;
          this.blood(z.x, z.z, 0.15, "#4f7a2b", 6);
        }
      }
      if (z.z < NEAR + 0.5) z.dead = true;
    }
    this.zombies = this.zombies.filter((z) => !z.dead);
  }

  private updateGates(dt: number) {
    for (const g of this.gates) {
      g.z -= SCROLL * dt;
      for (const s of g.sides) s.flash -= dt;
      if (!g.used && g.z <= 0.05) {
        g.used = true;
        const side = this.squadX < 0 ? 0 : 1;
        g.chosen = side;
        this.applyGate(g.sides[side]);
      }
      if (g.used) g.fade -= dt * 3;
    }
    this.gates = this.gates.filter((g) => g.fade > 0 && g.z > NEAR);
  }

  private applyGate(s: GateSide) {
    const before = this.count;
    if (s.op === "+") this.count = Math.max(0, this.count + s.v);
    else if (s.op === "x") this.count = this.count * s.v;
    else this.count = Math.ceil(this.count / s.v);
    this.count = Math.min(this.count, 300);
    this.syncTroops();
    const diff = this.count - before;
    const good = diff >= 0;
    sfx.gate(good);
    this.texts.push({ x: this.squadX, z: 0.4, y: 0.5, text: (good ? "+" : "") + diff, color: good ? "#6fd0ff" : "#ff5a5a", life: 1.1, size: 0.16 });
    for (let i = 0; i < 24; i++) {
      this.particles.push({ k: "star", x: this.squadX + rand(-0.4, 0.4), z: rand(-0.3, 0.4), y: rand(0, 0.3), vx: rand(-0.3, 0.3), vz: rand(-0.2, 0.2), vy: rand(0.3, 0.9), life: 0.9, max: 0.9, size: 0.018, color: good ? "#7fd8ff" : "#ff6b6b" });
    }
  }

  private updateBarrels(dt: number) {
    const hw = this.squadHalfW();
    const front = this.frontZ();
    for (const br of this.barrels) {
      if (br.dead) continue;
      br.z -= SCROLL * dt;
      br.flash -= dt;
      if (this.count > 0 && br.z <= front + 0.15 && Math.abs(br.x - this.squadX) < hw + 0.16) {
        this.killNearestTroops(br.x, 1);
        this.destroyBarrel(br, false);
      }
      if (br.z < NEAR + 0.5) br.dead = true;
    }
    this.barrels = this.barrels.filter((b) => !b.dead);
  }

  private destroyBarrel(br: Barrel, reward: boolean) {
    br.dead = true;
    sfx.wood();
    sfx.explosion();
    this.explosion(br.x, br.z, 1);
    this.shake = Math.max(this.shake, 5);
    for (let i = 0; i < 12; i++) this.particles.push({ k: "debris", x: br.x, z: br.z, y: 0.2, vx: rand(-1.2, 1.2), vz: rand(-0.6, 1.2), vy: rand(0.8, 2.2), life: 1.2, max: 1.2, size: 0.03, color: pick(["#6b3b1a", "#8a5226", "#3a2a20"]) });
    if (!reward) return;
    if (br.reward === "weapon") {
      if (this.weapon < WEAPONS.length - 1) {
        this.weapon++;
        sfx.upgrade();
        this.queueWarm(this.weapon);
        this.cb.onToast(WEAPONS[this.weapon].name.toUpperCase() + " UNLOCKED!", "weapon");
        this.texts.push({ x: br.x, z: br.z, y: 0.5, text: WEAPONS[this.weapon].name, color: "#8dff5a", life: 1.3, size: 0.12 });
      } else {
        this.coins += 40;
        this.texts.push({ x: br.x, z: br.z, y: 0.5, text: "+40", color: "#ffd84a", life: 1.2, size: 0.12 });
      }
    } else if (br.reward === "squad") {
      this.count = Math.min(300, this.count + br.amount);
      this.syncTroops();
      sfx.pickup();
      this.texts.push({ x: br.x, z: br.z, y: 0.5, text: "+" + br.amount, color: "#6fd0ff", life: 1.2, size: 0.14 });
    } else {
      sfx.pickup();
      this.coins += br.amount;
      this.texts.push({ x: br.x, z: br.z, y: 0.5, text: "+" + br.amount, color: "#ffd84a", life: 1.2, size: 0.12 });
    }
  }

  /* ------------------------------- fx -------------------------------- */

  private blood(x: number, z: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ k: "blood", x, z, y, vx: rand(-0.8, 0.8), vz: rand(-0.3, 1.2), vy: rand(0.3, 1.6), life: rand(0.4, 0.8), max: 0.8, size: rand(0.012, 0.028), color });
    }
  }
  private sparks(x: number, z: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ k: "spark", x, z, y, vx: rand(-1, 1), vz: rand(-1.5, 0), vy: rand(0.2, 1.5), life: 0.25, max: 0.25, size: 0.012, color });
    }
  }
  private explosion(x: number, z: number, scale: number) {
    for (let i = 0; i < 18 * scale; i++) {
      this.particles.push({ k: "fire", x: x + rand(-0.1, 0.1) * scale, z: z + rand(-0.1, 0.1), y: rand(0.05, 0.3) * scale, vx: rand(-0.8, 0.8) * scale, vz: rand(-0.5, 0.8), vy: rand(0.2, 1.4) * scale, life: rand(0.35, 0.7), max: 0.7, size: rand(0.05, 0.12) * scale, color: pick(["#ffdf6b", "#ffa53b", "#ff6a2b"]) });
    }
    for (let i = 0; i < 10 * scale; i++) {
      this.particles.push({ k: "smoke", x: x + rand(-0.15, 0.15) * scale, z, y: rand(0.1, 0.4) * scale, vx: rand(-0.3, 0.3), vz: rand(-0.2, 0.3), vy: rand(0.3, 0.7), life: rand(0.8, 1.3), max: 1.3, size: rand(0.08, 0.16) * scale, color: "#5a5550" });
    }
  }

  private updateFx(dt: number, scroll: number) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.z += (p.vz - scroll) * dt;
      p.y += p.vy * dt;
      if (p.k === "blood" || p.k === "debris" || p.k === "spark" || p.k === "shell") {
        p.vy -= 5 * dt;
        if (p.y < 0) {
          p.y = 0; p.vy *= -0.25; p.vx *= 0.5; p.vz *= 0.5;
          if (p.k === "blood" && Math.random() < 0.08 && this.decals.length < 120) this.decals.push({ x: p.x, z: p.z, r: 0.03, color: p.color, a: 0.6 });
        }
      } else if (p.k === "smoke" || p.k === "fire") {
        p.size += dt * 0.08;
        p.vx *= 0.96; p.vz *= 0.96;
      } else if (p.k === "star") {
        p.vy -= 1.2 * dt;
      }
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    for (const d of this.decals) { d.z -= scroll * dt; d.a -= dt * 0.05; }
    this.decals = this.decals.filter((d) => d.z > NEAR && d.a > 0);
    for (const t of this.texts) { t.y += dt * 0.4; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  /* ----------------------------- rendering ----------------------------- */

  private render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
    this.drawBackground();
    this.drawRoadDetail();

    for (const d of this.decals) {
      const p = this.proj(d.x, d.z);
      ctx.globalAlpha = Math.min(1, d.a);
      ctx.fillStyle = d.color;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, d.r * p.s, d.r * p.s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // muzzle light pool on the asphalt
    if (this.fireGlow > 0 && this.count > 0) {
      const p = this.proj(this.squadX, 0.35);
      const r = (0.5 + this.squadHalfW()) * p.s * 1.1;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = this.fireGlow * rand(0.22, 0.34);
      ctx.translate(p.x, p.y);
      ctx.scale(1, 0.45);
      ctx.drawImage(softDot(this.weapon === 4 ? "rgba(80,200,255,1)" : "rgba(255,170,70,1)"), -r, -r, r * 2, r * 2);
      ctx.restore();
    }

    const list: { z: number; f: () => void }[] = [];
    this.collectProps(list);
    const lampStep = 9;
    const lo = this.roadOffset % lampStep;
    for (let k = 0; k < 9; k++) {
      const z = k * lampStep - lo - 3;
      if (z > FAR + 6) break;
      list.push({ z: z + 0.01, f: () => this.drawLamp(-1.12, z) });
      list.push({ z: z + 0.01, f: () => this.drawLamp(1.12, z) });
    }
    for (const g of this.gates) list.push({ z: g.z, f: () => this.drawGate(g) });
    for (const b of this.barrels) list.push({ z: b.z, f: () => this.drawBarrel(b) });
    for (const z of this.zombies) if (!z.dead) list.push({ z: z.z, f: () => (z.kind === "brute" || z.kind === "boss" ? this.drawBrute(z) : this.drawZombie(z)) });
    if (this.mode !== "ending" || this.count > 0) {
      this.troops.forEach((t) => list.push({ z: t.oz, f: () => this.drawSoldier(t) }));
    }
    list.sort((a, b) => b.z - a.z);
    for (const it of list) it.f();

    this.drawBullets();
    this.drawParticles();
    this.drawFog();
    this.drawGrade();
    this.drawTexts();
    if (this.mode !== "idle" && this.count > 0) this.drawSquadBadge();
    if (this.boss && !this.boss.dead && this.boss.z < 16) this.drawBossBar(this.boss);
    ctx.restore();
    this.drawVignette();
  }

  private poly(pts: { x: number; y: number }[]) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }
  private groundQuad(x0: number, x1: number, z0: number, z1: number, h = 0) {
    this.poly([this.proj(x0, z0, h), this.proj(x1, z0, h), this.proj(x1, z1, h), this.proj(x0, z1, h)]);
  }

  private drawBackground() {
    const ctx = this.ctx, w = this.w, h = this.h;
    const bridge = this.theme === 0;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    if (bridge) { bg.addColorStop(0, "#1b5f78"); bg.addColorStop(1, "#0d4d66"); }
    else { bg.addColorStop(0, "#6f7378"); bg.addColorStop(1, "#5a5e63"); }
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    const step = 2.2;
    const base = Math.floor(this.roadOffset / step);
    const off = this.roadOffset % step;
    if (bridge) {
      ctx.strokeStyle = "rgba(190,235,255,0.22)";
      ctx.lineCap = "round";
      for (let k = 0; k < 30; k++) {
        const z = k * step - off + NEAR;
        if (z > FAR + 8) break;
        for (let j = 0; j < 4; j++) {
          const hv = hash((base + k) * 7 + j);
          const side = j % 2 ? 1 : -1;
          const x = side * (1.35 + hv * 2.2);
          const a = this.proj(x - 0.15, z), b = this.proj(x + 0.15, z);
          ctx.lineWidth = Math.max(1, a.s * 0.012);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    } else {
      // sidewalks with tiles + curbs
      ctx.fillStyle = "#9a958c";
      this.groundQuad(-2.2, -1.12, NEAR, FAR + 12); ctx.fill();
      this.groundQuad(1.12, 2.2, NEAR, FAR + 12); ctx.fill();
      ctx.strokeStyle = "rgba(60,55,50,0.25)";
      ctx.lineWidth = 1;
      for (let k = 0; k < 30; k++) {
        const z = k * step - off + NEAR;
        if (z > FAR + 8) break;
        for (const [x0, x1] of [[-2.2, -1.12], [1.12, 2.2]]) {
          const a = this.proj(x0, z), b = this.proj(x1, z);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      // building bases
      ctx.fillStyle = "#3d4249";
      this.groundQuad(-6, -2.2, NEAR, FAR + 12); ctx.fill();
      this.groundQuad(2.2, 6, NEAR, FAR + 12); ctx.fill();
    }

    // road
    const road = ctx.createLinearGradient(0, this.proj(0, FAR).y, 0, h);
    road.addColorStop(0, "#5f6267"); road.addColorStop(1, "#77797d");
    ctx.fillStyle = road;
    this.groundQuad(-1.12, 1.12, NEAR, FAR + 12); ctx.fill();

    // asphalt patches
    const pstep = 3.7;
    const pbase = Math.floor(this.roadOffset / pstep);
    const poff = this.roadOffset % pstep;
    ctx.fillStyle = "rgba(40,40,45,0.12)";
    for (let k = 0; k < 18; k++) {
      const z = k * pstep - poff + NEAR;
      if (z > FAR + 6) break;
      const hv = hash(pbase + k);
      const x = -0.9 + hv * 1.8;
      const p = this.proj(x, z);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, (0.12 + hv * 0.18) * p.s, (0.05 + hv * 0.05) * p.s, 0, 0, Math.PI * 2); ctx.fill();
    }

    // lane dashes
    ctx.fillStyle = "rgba(240,240,235,0.78)";
    const dstep = 3;
    const doff = this.roadOffset % dstep;
    for (let k = 0; k < 24; k++) {
      const z = k * dstep - doff + NEAR;
      if (z > FAR + 6) break;
      for (const x of [-0.36, 0.36]) { this.groundQuad(x - 0.018, x + 0.018, z, z + 1.4); ctx.fill(); }
    }
    // edge lines
    ctx.fillStyle = bridge ? "rgba(255,214,90,0.85)" : "rgba(240,240,235,0.8)";
    this.groundQuad(-1.0, -0.975, NEAR, FAR + 12); ctx.fill();
    this.groundQuad(0.975, 1.0, NEAR, FAR + 12); ctx.fill();

    // barriers (bridge) / curbs (city)
    const bh = bridge ? 0.12 : 0.04;
    for (const side of [-1, 1]) {
      const xi = side * 1.06, xo = side * 1.14;
      ctx.fillStyle = bridge ? "#a9adb1" : "#b9b4aa";
      this.poly([this.proj(xi, NEAR, 0), this.proj(xi, FAR + 12, 0), this.proj(xi, FAR + 12, bh), this.proj(xi, NEAR, bh)]); ctx.fill();
      ctx.fillStyle = bridge ? "#d4d7da" : "#cfcac0";
      this.poly([this.proj(xi, NEAR, bh), this.proj(xi, FAR + 12, bh), this.proj(xo, FAR + 12, bh), this.proj(xo, NEAR, bh)]); ctx.fill();
      if (bridge) {
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        const bstep = 1.5, boff = this.roadOffset % bstep;
        for (let k = 0; k < 44; k++) {
          const z = k * bstep - boff + NEAR;
          if (z > FAR + 6) break;
          this.poly([this.proj(xi, z, 0), this.proj(xi, z + 0.06, 0), this.proj(xi, z + 0.06, bh), this.proj(xi, z, bh)]); ctx.fill();
        }
      }
    }
  }

  private drawRoadDetail() {
    const ctx = this.ctx;
    const off = this.roadOffset;
    // tyre skid marks
    const ts = 13, tb = Math.floor(off / ts), to = off % ts;
    ctx.fillStyle = "rgba(25,25,28,0.16)";
    for (let k = 0; k < 6; k++) {
      const z = k * ts - to + NEAR;
      if (z > FAR + 4) break;
      const h = hash((tb + k) * 3.7);
      if (h < 0.35) continue;
      const x = -0.75 + h * 1.3;
      for (const dx of [0, 0.2]) {
        this.poly([this.proj(x + dx, z), this.proj(x + dx + 0.04, z), this.proj(x + dx + 0.07, z + 5), this.proj(x + dx + 0.03, z + 5)]);
        ctx.fill();
      }
    }
    // cracks
    const cs = 5.3, cb = Math.floor(off / cs), co = off % cs;
    ctx.strokeStyle = "rgba(30,30,32,0.45)";
    ctx.lineCap = "round";
    for (let k = 0; k < 14; k++) {
      const z = k * cs - co + NEAR;
      if (z > FAR + 4) break;
      const h = hash((cb + k) * 1.93 + 5);
      if (h < 0.4) continue;
      let x = -0.85 + h * 1.7, zz = z;
      const p0 = this.proj(x, zz);
      ctx.lineWidth = Math.max(0.6, p0.s * 0.006);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
      for (let j = 0; j < 5; j++) {
        x += (hash(cb + k + j * 7.1) - 0.5) * 0.18; zz += 0.25 + hash(cb + k * 3 + j) * 0.3;
        const q = this.proj(x, zz); ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
    // manholes
    const ms = 19, mb = Math.floor(off / ms), mo = off % ms;
    for (let k = 0; k < 4; k++) {
      const z = k * ms - mo + NEAR + 6;
      if (z > FAR + 2) break;
      const x = (hash(mb + k + 0.3) - 0.5) * 1.2;
      const p = this.proj(x, z);
      ctx.fillStyle = "#3b3c40";
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.13 * p.s, 0.055 * p.s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(140,140,145,0.55)"; ctx.lineWidth = Math.max(0.6, p.s * 0.008);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.1 * p.s, 0.042 * p.s, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x - 0.07 * p.s, p.y); ctx.lineTo(p.x + 0.07 * p.s, p.y); ctx.stroke();
    }
    if (this.theme === 0) {
      // water sparkles
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const ws = 1.3, wb = Math.floor(off / ws), wo = off % ws;
      for (let k = 0; k < 44; k++) {
        const z = k * ws - wo + NEAR;
        if (z > FAR + 6) break;
        for (let j = 0; j < 3; j++) {
          const h = hash((wb + k) * 11 + j * 3.3);
          const tw = Math.sin(this.time * 4 + h * 40);
          if (tw < 0.55) continue;
          const side = j % 2 ? 1 : -1;
          const p = this.proj(side * (1.3 + h * 2.6), z);
          const r = p.s * 0.035 * (tw - 0.4);
          ctx.globalAlpha = (tw - 0.55) * 1.6;
          ctx.drawImage(softDot("rgba(220,245,255,1)"), p.x - r * 2, p.y - r * 0.6, r * 4, r * 1.2);
        }
      }
      ctx.restore();
      // foam along the bridge
      ctx.fillStyle = "rgba(230,248,255,0.18)";
      this.groundQuad(-1.3, -1.16, NEAR, FAR + 12); ctx.fill();
      this.groundQuad(1.16, 1.3, NEAR, FAR + 12); ctx.fill();
    }
  }

  /** Railings, buildings and parked cars – depth sorted with the characters. */
  private collectProps(list: { z: number; f: () => void }[]) {
    const off = this.roadOffset;
    if (this.theme === 0) {
      const rs = 1.6, ro = off % rs;
      for (let k = 0; k < 40; k++) {
        const z = k * rs - ro + NEAR;
        if (z > FAR + 8) break;
        list.push({ z: z + 0.02, f: () => this.drawRailPost(z) });
      }
      list.push({ z: FAR + 20, f: () => this.drawRails() });
      return;
    }
    // city: building facades (far first) + parked cars
    const bs = 6.5, bb = Math.floor(off / bs), bo = off % bs;
    for (let k = 9; k >= 0; k--) {
      const z = k * bs - bo + NEAR;
      if (z > FAR + 14) continue;
      const idx = bb + k;
      list.push({ z: FAR + 30 - k, f: () => { this.drawBuilding(-2.25, z, z + bs, idx); this.drawBuilding(2.25, z, z + bs, idx + 17); } });
    }
    const cs = 8.5, cb = Math.floor(off / cs), co = off % cs;
    const colors = ["#7a2a2a", "#2f4a6a", "#c9c4b4", "#3b5a3a"];
    for (let k = 0; k < 8; k++) {
      const z = k * cs - co + NEAR + 1;
      if (z > FAR + 4) break;
      const h = hash((cb + k) * 2.31);
      if (h < 0.3) continue;
      const side = h > 0.65 ? 1 : -1;
      const color = colors[Math.floor(h * 97) % colors.length];
      const v = Math.floor(h * 13) % 2;
      list.push({ z, f: () => {
        const p = this.proj(side * 1.62, z);
        const u = p.s * 0.0122;
        this.shadow(p.x, p.y, 22 * u, 5 * u);
        this.blit(carSprite(color, v), p.x, p.y, u / SPR);
      } });
    }
  }

  private drawRailPost(z: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "#59616b";
    for (const x of [-1.1, 1.1]) {
      const a = this.proj(x, z, 0.12), b = this.proj(x, z, 0.34);
      const w = Math.max(1, a.s * 0.016);
      ctx.fillRect(a.x - w / 2, b.y, w, a.y - b.y);
    }
  }

  private drawRails() {
    const ctx = this.ctx;
    for (const x of [-1.1, 1.1]) {
      for (const [h, c] of [[0.34, "#9aa3ad"], [0.24, "#6d7680"]] as [number, string][]) {
        const a = this.proj(x, NEAR, h), b = this.proj(x, FAR + 12, h);
        const g = ctx.createLinearGradient(0, b.y, 0, a.y);
        g.addColorStop(0, c); g.addColorStop(1, c);
        ctx.strokeStyle = g;
        ctx.lineWidth = Math.max(1, a.s * 0.012);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }

  private drawBuilding(x: number, z0: number, z1: number, idx: number) {
    const ctx = this.ctx;
    const h = hash(idx * 1.37);
    const H = 2.2 + h * 3.2;
    const cols = ["#6b6258", "#5a6470", "#7a6a5a", "#4f5560", "#80766a"];
    const col = cols[Math.floor(h * 31) % cols.length];
    const zA = Math.max(NEAR, z0), zB = z1 - 0.15;
    if (zB <= zA) return;
    const g = ctx.createLinearGradient(0, this.proj(x, zB, H).y, 0, this.proj(x, zA, 0).y);
    g.addColorStop(0, col); g.addColorStop(1, "#2b2e33");
    ctx.fillStyle = g;
    this.poly([this.proj(x, zA, 0), this.proj(x, zB, 0), this.proj(x, zB, H), this.proj(x, zA, H)]);
    ctx.fill();
    // windows
    for (let wh = 0.6; wh < H - 0.4; wh += 0.75) {
      for (let wz = zA + 0.4; wz < zB - 0.5; wz += 1.2) {
        const lit = hash(idx * 7 + wh * 13 + wz * 3) > 0.82;
        ctx.fillStyle = lit ? "rgba(255,214,140,0.75)" : "rgba(25,35,48,0.75)";
        this.poly([this.proj(x, wz, wh), this.proj(x, wz + 0.6, wh), this.proj(x, wz + 0.6, wh + 0.42), this.proj(x, wz, wh + 0.42)]);
        ctx.fill();
      }
    }
    // roof edge
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    this.poly([this.proj(x, zA, H - 0.12), this.proj(x, zB, H - 0.12), this.proj(x, zB, H), this.proj(x, zA, H)]);
    ctx.fill();
  }

  private drawGrade() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, this.w, this.h);
    g.addColorStop(0, "rgba(255,196,130,0.10)");
    g.addColorStop(0.5, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(10,30,70,0.16)");
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
  }

  private drawLamp(x: number, z: number) {
    if (z < NEAR) return;
    const ctx = this.ctx;
    const a = this.proj(x, z, 0.12), b = this.proj(x, z, 1.25);
    const hx = this.proj(x - Math.sign(x) * 0.22, z, 1.25);
    ctx.strokeStyle = "#3b4048";
    ctx.lineWidth = Math.max(1, a.s * 0.022);
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(hx.x, hx.y); ctx.stroke();
    ctx.fillStyle = "#fff4c2";
    ctx.beginPath(); ctx.ellipse(hx.x, hx.y + a.s * 0.012, a.s * 0.035, a.s * 0.014, 0, 0, Math.PI * 2); ctx.fill();
  }

  private drawFog() {
    const ctx = this.ctx;
    const yTop = this.proj(0, FAR + 10).y;
    const yBot = this.proj(0, FAR - 16).y;
    const g = ctx.createLinearGradient(0, yTop - 10, 0, yBot);
    const c = this.theme === 0 ? "176,214,226" : "190,196,204";
    g.addColorStop(0, `rgba(${c},1)`);
    g.addColorStop(0.35, `rgba(${c},0.7)`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, this.w + 40, yBot + 20);
  }

  private drawVignette() {
    const ctx = this.ctx, w = this.w, h = this.h;
    const g = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, h * 0.8);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private shadow(x: number, y: number, rx: number, ry: number) {
    this.ctx.drawImage(shadowSprite(), x - rx * 1.3, y - ry * 1.3, rx * 2.6, ry * 2.6);
  }
  private blit(sp: Sprite, x: number, y: number, k: number) {
    this.ctx.drawImage(sp.c, x - sp.ax * k, y - sp.ay * k, sp.c.width * k, sp.c.height * k);
  }
  private line(x0: number, y0: number, x1: number, y1: number) {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  private circle(x: number, y: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); ctx.fill();
  }
  private rrect(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  }

  private drawZombie(zb: Zombie) {
    const p = this.proj(zb.x, zb.z);
    const u = p.s * 0.0122 * zb.size;
    const f = Math.floor((zb.phase / (Math.PI * 2)) * 8) & 7;
    this.shadow(p.x, p.y, 9 * u, 2.8 * u);
    const sp = zombieSprite(zb.look, f);
    this.blit(zb.hit > 0 ? flashOf(`z${zb.look}_${f}`, sp) : sp, p.x, p.y, u / SPR);
  }

  private drawBrute(zb: Zombie) {
    const ctx = this.ctx;
    const p = this.proj(zb.x, zb.z);
    const u = p.s * 0.0122 * zb.size;
    const boss = zb.kind === "boss";
    const f = Math.floor((zb.phase * 0.7 / (Math.PI * 2)) * 8) & 7;
    const wind = boss ? clamp(Math.floor(((zb.attackT - 0.6) / 0.6) * 4), 0, 3) : 0;
    this.shadow(p.x, p.y, 15 * u, 4 * u);
    const sp = bruteSprite(boss, f, wind);
    this.blit(zb.hit > 0 ? flashOf(`b${boss ? 1 : 0}_${f}_${wind}`, sp) : sp, p.x, p.y, u / SPR);
    if (!boss) {
      const bw = 24 * u, by = p.y - 44 * u;
      ctx.fillStyle = "rgba(0,0,0,0.6)"; this.rrect(p.x - bw / 2 - 1, by - 1, bw + 2, 2.6 * u + 2, 2); ctx.fill();
      ctx.fillStyle = "#ff4646"; this.rrect(p.x - bw / 2, by, bw * Math.max(0, zb.hp / zb.maxHp), 2.6 * u, 2); ctx.fill();
    }
  }

  private drawSoldier(t: Troop) {
    const ctx = this.ctx;
    const p = this.proj(this.squadX + t.ox, t.oz);
    const u = p.s * 0.0122;
    const k = u / SPR;
    const moving = this.mode === "play" || this.mode === "ending";
    const f = moving ? Math.floor(((this.time * 12 + t.phase) / (Math.PI * 2)) * 8) & 7 : 0;
    const rc = t.recoil > 0.5 ? 1 : 0;
    this.shadow(p.x, p.y, 8.5 * u, 2.7 * u);
    this.blit(soldierSprite(f, t.hair, this.weapon, rc), p.x, p.y, k);
    if (t.recoil > 0.4) {
      const tier = this.weapon;
      const tip = gunPt(GUN.tip[tier] - rc * 1.3, 0);
      const mx = p.x + tip.x * u, my = p.y + tip.y * u;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const gr = (9 + tier * 2) * u * t.recoil;
      ctx.drawImage(softDot(tier === 4 ? "rgba(70,200,255,0.9)" : "rgba(255,180,70,0.9)"), mx - gr, my - gr, gr * 2, gr * 2);
      const m = muzzleSprite(tier);
      ctx.translate(mx, my);
      ctx.rotate(GUN.ang + rand(-0.12, 0.12));
      const sc = k * (0.75 + tier * 0.12) * rand(0.8, 1.25);
      ctx.scale(sc, sc * rand(0.75, 1.2));
      ctx.drawImage(m.c, -m.ax, -m.ay);
      ctx.restore();
    }
  }

  private gateLabel(s: GateSide) {
    if (s.op === "+") return s.v >= 0 ? "+" + s.v : "−" + Math.abs(s.v);
    return (s.op === "x" ? "x" : "÷") + s.v;
  }

  private drawGate(g: Gate) {
    const ctx = this.ctx;
    ctx.globalAlpha = clamp(g.fade, 0, 1);
    const H = 0.62;
    for (let side = 0; side < 2; side++) {
      const s = g.sides[side];
      const x0 = side === 0 ? -1.0 : 0.035, x1 = side === 0 ? -0.035 : 1.0;
      const a = this.proj(x0, g.z, 0), b = this.proj(x1, g.z, 0), top = this.proj(x0, g.z, H);
      const good = (s.op === "+" && s.v >= 0) || s.op === "x";
      const chosen = g.used && g.chosen === side;
      const grad = ctx.createLinearGradient(0, top.y, 0, a.y);
      if (good) { grad.addColorStop(0, "rgba(60,170,255,0.78)"); grad.addColorStop(1, "rgba(20,90,220,0.38)"); }
      else { grad.addColorStop(0, "rgba(255,80,80,0.78)"); grad.addColorStop(1, "rgba(200,20,30,0.38)"); }
      ctx.fillStyle = grad;
      ctx.fillRect(a.x, top.y, b.x - a.x, a.y - top.y);
      if (s.flash > 0 || chosen) { ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(a.x, top.y, b.x - a.x, a.y - top.y); }
      // moving glass shine
      ctx.save();
      ctx.beginPath(); ctx.rect(a.x, top.y, b.x - a.x, a.y - top.y); ctx.clip();
      const gw = b.x - a.x, gh = a.y - top.y;
      const sx = a.x + (((this.time * 0.5 + side * 0.3) % 1.4) - 0.2) * gw;
      const sg = ctx.createLinearGradient(sx - gw * 0.12, 0, sx + gw * 0.12, 0);
      sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,0.32)"); sg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.moveTo(sx - gw * 0.1, a.y); ctx.lineTo(sx + gw * 0.02, a.y); ctx.lineTo(sx + gw * 0.18, top.y); ctx.lineTo(sx + gw * 0.06, top.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(a.x, top.y, gw, gh * 0.4);
      ctx.restore();
      ctx.strokeStyle = good ? "rgba(120,200,255,0.45)" : "rgba(255,120,120,0.45)";
      ctx.lineWidth = Math.max(4, a.s * 0.035);
      ctx.strokeRect(a.x, top.y, b.x - a.x, a.y - top.y);
      ctx.strokeStyle = good ? "#d8f0ff" : "#ffd6d6";
      ctx.lineWidth = Math.max(1.5, a.s * 0.012);
      ctx.strokeRect(a.x, top.y, b.x - a.x, a.y - top.y);
      // top band
      ctx.fillStyle = good ? "#1d6fe0" : "#d42a35";
      ctx.fillRect(a.x, top.y, b.x - a.x, (a.y - top.y) * 0.14);
      // label
      const fs = Math.max(10, a.s * 0.27);
      ctx.font = `900 ${fs}px ${FONT}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = fs * 0.14; ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineJoin = "round";
      const tx = (a.x + b.x) / 2, ty = top.y + (a.y - top.y) * 0.56;
      const label = this.gateLabel(s);
      ctx.strokeText(label, tx, ty);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, tx, ty);
      ctx.textBaseline = "alphabetic";
    }
    // posts
    ctx.fillStyle = "#33373d";
    for (const x of [-1.0, 0, 1.0]) {
      const a = this.proj(x, g.z, 0), t = this.proj(x, g.z, H + 0.05);
      const pw = Math.max(2, a.s * 0.03);
      ctx.fillRect(a.x - pw / 2, t.y, pw, a.y - t.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawGun(x: number, y: number, s: number, color: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.35);
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(10,40,0,0.8)";
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(-1.6 * s, -0.25 * s); ctx.lineTo(1.7 * s, -0.25 * s); ctx.lineTo(1.7 * s, 0.05 * s);
    ctx.lineTo(0.5 * s, 0.05 * s); ctx.lineTo(0.35 * s, 0.75 * s); ctx.lineTo(0.05 * s, 0.75 * s);
    ctx.lineTo(0.05 * s, 0.2 * s); ctx.lineTo(-0.5 * s, 0.2 * s); ctx.lineTo(-0.7 * s, 0.6 * s);
    ctx.lineTo(-1.0 * s, 0.6 * s); ctx.lineTo(-0.95 * s, 0.2 * s); ctx.lineTo(-1.6 * s, 0.35 * s);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillRect(-0.4 * s, -0.5 * s, 0.9 * s, 0.22 * s);
    ctx.restore();
  }

  private drawBarrel(br: Barrel) {
    const ctx = this.ctx;
    const p = this.proj(br.x, br.z);
    const u = p.s * 0.0122;
    const sx = p.x, sy = p.y;
    const bh = 34 * u;
    this.shadow(sx, sy, 18 * u, 4.6 * u);
    const sp = barrelSprite();
    this.blit(br.flash > 0 ? flashOf("barrel", sp) : sp, sx, sy, u / SPR);
    // hp number
    const fs = Math.max(10, 14 * u);
    ctx.font = `900 ${fs}px ${FONT}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineJoin = "round"; ctx.lineWidth = fs * 0.18; ctx.strokeStyle = "#1a1a1a";
    const txt = String(Math.max(1, Math.ceil(br.hp)));
    ctx.strokeText(txt, sx, sy - bh * 0.52);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(txt, sx, sy - bh * 0.52);
    // reward
    const ry = sy - bh - 13 * u + Math.sin(this.time * 3 + br.x * 5) * 1.5 * u;
    if (br.reward === "weapon") {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(120,255,80,0.25)";
      this.circle(sx, ry, 12 * u);
      ctx.globalCompositeOperation = "source-over";
      this.drawGun(sx, ry, 6.5 * u, "#7dff4d");
    } else if (br.reward === "squad") {
      ctx.fillStyle = "rgba(15,40,90,0.85)";
      this.rrect(sx - 10 * u, ry - 6 * u, 20 * u, 12 * u, 4 * u); ctx.fill();
      ctx.strokeStyle = "#6fd0ff"; ctx.lineWidth = 1 * u; ctx.stroke();
      ctx.font = `900 ${Math.max(8, 8 * u)}px ${FONT}`;
      ctx.fillStyle = "#9fe2ff";
      ctx.fillText("+" + br.amount + "👤", sx, ry + 0.5 * u);
    } else {
      ctx.fillStyle = "#f5c542";
      this.circle(sx, ry, 6 * u);
      ctx.strokeStyle = "#a87b12"; ctx.lineWidth = 1.2 * u; ctx.stroke();
      ctx.fillStyle = "#a87b12";
      ctx.font = `900 ${Math.max(7, 7 * u)}px ${FONT}`;
      ctx.fillText("$", sx, ry + 0.5 * u);
    }
    ctx.textBaseline = "alphabetic";
  }

  private drawBullets() {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const b of this.bullets) {
      const w = WEAPONS[b.tier];
      const k = 0.7 / b.vz;
      const a = this.proj(b.x - b.vx * k, b.z - 0.7, 0.3), c = this.proj(b.x, b.z, 0.3);
      const sc = c.s / this.R0;
      const tg = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
      tg.addColorStop(0, "rgba(255,255,255,0)");
      tg.addColorStop(1, w.glow);
      ctx.strokeStyle = tg;
      ctx.lineWidth = w.width * 2.6 * sc;
      this.line(a.x, a.y, c.x, c.y);
      ctx.strokeStyle = w.color;
      ctx.lineWidth = Math.max(1, w.width * sc);
      const m = this.proj(b.x - b.vx * k * 0.5, b.z - 0.35, 0.3);
      this.line(m.x, m.y, c.x, c.y);
      const r = w.width * 3.2 * sc;
      ctx.drawImage(softDot(b.tier === 4 ? "rgba(90,210,255,0.9)" : "rgba(255,200,110,0.9)"), c.x - r, c.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const q = this.proj(p.x, p.z, p.y);
      const a = clamp(p.life / p.max, 0, 1);
      const r = p.size * q.s;
      if (p.k === "fire") {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a * 0.5;
        const rr = r * 1.8;
        ctx.drawImage(softDot(a > 0.8 ? "rgba(255,210,120,1)" : "rgba(255,110,30,1)"), q.x - rr, q.y - rr, rr * 2, rr * 2);
        ctx.globalCompositeOperation = "source-over";
      } else if (p.k === "spark" || p.k === "star") {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        this.circle(q.x, q.y, r);
        const rr = r * 4;
        ctx.drawImage(softDot(p.k === "star" ? (p.color === "#ff6b6b" ? "rgba(255,90,90,0.8)" : "rgba(120,210,255,0.8)") : "rgba(255,210,120,0.8)"), q.x - rr, q.y - rr, rr * 2, rr * 2);
        ctx.globalCompositeOperation = "source-over";
      } else if (p.k === "smoke") {
        ctx.globalAlpha = a * 0.5;
        const rr = r * 2;
        ctx.drawImage(softDot("rgba(60,56,52,1)"), q.x - rr, q.y - rr, rr * 2, rr * 2);
      } else if (p.k === "shell") {
        ctx.globalAlpha = a;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(p.life * 22);
        ctx.fillStyle = p.color;
        ctx.fillRect(-r, -r * 0.4, r * 2, r * 0.8);
        ctx.fillStyle = "#fff3c4";
        ctx.fillRect(-r, -r * 0.4, r * 2, r * 0.25);
        ctx.restore();
      } else if (p.k === "debris") {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(q.x - r, q.y - r, r * 2, r * 1.4);
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        this.circle(q.x, q.y, r);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTexts() {
    const ctx = this.ctx;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
    for (const t of this.texts) {
      const p = this.proj(t.x, t.z, t.y);
      const fs = Math.max(14, t.size * p.s);
      ctx.globalAlpha = clamp(t.life * 2, 0, 1);
      ctx.font = `900 ${fs}px ${FONT}`;
      ctx.lineWidth = fs * 0.16; ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.strokeText(t.text, p.x, p.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = "alphabetic";
  }

  private drawSquadBadge() {
    const ctx = this.ctx;
    const p = this.proj(this.squadX, this.frontZ() + 0.1, 0.52);
    const txt = String(this.count);
    const fs = Math.max(14, this.R0 * 0.1);
    ctx.font = `900 ${fs}px ${FONT}`;
    const tw = ctx.measureText(txt).width + fs * 0.9;
    ctx.fillStyle = "rgba(20,70,170,0.92)";
    this.rrect(p.x - tw / 2, p.y - fs * 0.75, tw, fs * 1.4, fs * 0.35); ctx.fill();
    ctx.strokeStyle = "#8fd3ff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x - 5, p.y + fs * 0.65); ctx.lineTo(p.x + 5, p.y + fs * 0.65); ctx.lineTo(p.x, p.y + fs * 0.65 + 6); ctx.closePath();
    ctx.fillStyle = "rgba(20,70,170,0.92)"; ctx.fill();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(txt, p.x, p.y);
    ctx.textBaseline = "alphabetic";
  }

  private drawBossBar(b: Zombie) {
    const ctx = this.ctx;
    const p = this.proj(b.x, b.z, 0.42 * b.size);
    const bw = Math.min(this.w * 0.6, 34 * p.s * 0.0122 * b.size * 1.6);
    const bh = Math.max(6, bw * 0.06);
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    this.rrect(p.x - bw / 2 - 2, p.y - 2, bw + 4, bh + 4, 4); ctx.fill();
    ctx.fillStyle = "#ff3b3b";
    this.rrect(p.x - bw / 2, p.y, bw * clamp(b.hp / b.maxHp, 0, 1), bh, 3); ctx.fill();
    ctx.font = `900 ${Math.max(10, bh * 1.3)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillText(Math.ceil(Math.max(0, b.hp)).toLocaleString(), p.x, p.y - 4);
  }
}
