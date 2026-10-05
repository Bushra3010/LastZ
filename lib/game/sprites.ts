/* ------------------------------------------------------------------ */
/*  High-res cached character sprites.                                 */
/*  Everything is drawn once at SPR px per art-unit, outlined, cached, */
/*  then drawImage'd (scaled) by the engine every frame.               */
/*  Art units: feet at (0,0), up is -y. A soldier is ~36 units tall.  */
/* ------------------------------------------------------------------ */

export const SPR = 4;
export type Sprite = { c: HTMLCanvasElement; ax: number; ay: number };

const TAU = Math.PI * 2;
const cache = new Map<string, Sprite>();
type G = CanvasRenderingContext2D;

const mk = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

function outline(src: HTMLCanvasElement, r: number, color: string) {
  const sil = mk(src.width, src.height);
  const s = sil.getContext("2d")!;
  s.drawImage(src, 0, 0);
  s.globalCompositeOperation = "source-in";
  s.fillStyle = color;
  s.fillRect(0, 0, sil.width, sil.height);
  const out = mk(src.width, src.height);
  const o = out.getContext("2d")!;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    o.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r);
  }
  o.drawImage(src, 0, 0);
  return out;
}

function build(key: string, x0: number, y0: number, x1: number, y1: number, draw: (g: G) => void, line = 2.2): Sprite {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = mk((x1 - x0) * SPR, (y1 - y0) * SPR);
  const g = c.getContext("2d")!;
  g.scale(SPR, SPR);
  g.translate(-x0, -y0);
  g.lineCap = "round";
  g.lineJoin = "round";
  draw(g);
  const fin = line > 0 ? outline(c, line, "rgba(12,14,18,0.92)") : c;
  const s = { c: fin, ax: -x0 * SPR, ay: -y0 * SPR };
  cache.set(key, s);
  return s;
}

/** White hit-flash copy of a sprite. */
export function flashOf(key: string, s: Sprite): Sprite {
  const k = "flash:" + key;
  const hit = cache.get(k);
  if (hit) return hit;
  const c = mk(s.c.width, s.c.height);
  const g = c.getContext("2d")!;
  g.drawImage(s.c, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = "rgba(255,255,255,0.82)";
  g.fillRect(0, 0, c.width, c.height);
  const out = { c, ax: s.ax, ay: s.ay };
  cache.set(k, out);
  return out;
}

/* ----------------------------- helpers ----------------------------- */

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round(r + (t - r) * p); gg = Math.round(gg + (t - gg) * p); b = Math.round(b + (t - b) * p);
  return `rgb(${r},${gg},${b})`;
}
const rr = (g: G, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
};
const circ = (g: G, x: number, y: number, r: number) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
const ell = (g: G, x: number, y: number, rx: number, ry: number, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); };
const ln = (g: G, pts: number[], w: number, color: string | CanvasGradient) => {
  g.strokeStyle = color; g.lineWidth = w;
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
};
const lg = (g: G, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
};
const rg = (g: G, x: number, y: number, r0: number, r1: number, stops: [number, string][], ox = 0, oy = 0) => {
  const gr = g.createRadialGradient(x + ox, y + oy, r0, x, y, r1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
};

/* ------------------------------ guns ------------------------------- */

/** Gun mount in soldier art space. Local gun +x points along the barrel. */
export const GUN = { ax: 5.2, ay: -23.4, ang: -1.24, scale: 1.32, tip: [6.9, 10.6, 15.6, 15.2, 16] };
const CA = Math.cos(GUN.ang), SA = Math.sin(GUN.ang);
export const gunPt = (lx: number, ly: number) => ({
  x: GUN.ax + (lx * CA - ly * SA) * GUN.scale,
  y: GUN.ay + (lx * SA + ly * CA) * GUN.scale,
});
const GRIP: { r: [number, number]; l: [number, number] }[] = [
  { r: [1.3, 2.2], l: [1.9, 1.4] },
  { r: [1.0, 2.4], l: [6.6, 0.9] },
  { r: [0.9, 2.6], l: [8.6, 1.1] },
  { r: [-1.2, 1.8], l: [3.2, -3.6] },
  { r: [1.0, 2.4], l: [8.2, 1.2] },
];

function drawGun(g: G, tier: number, f: number) {
  const metal = "#24272d", metalHi = "#5d646e", poly = "#2f3238";
  if (tier === 0) {
    g.fillStyle = lg(g, 0, -1.2, 0, 0.8, [[0, metalHi], [0.35, "#3a3e45"], [1, metal]]);
    rr(g, 0, -1.2, 6.9, 2, 0.4); g.fill();
    g.fillStyle = "rgba(0,0,0,0.45)";
    for (let i = 0; i < 4; i++) g.fillRect(0.6 + i * 0.45, -1, 0.18, 1.6);
    g.fillStyle = poly; rr(g, 0.4, 0.6, 2.2, 3.4, 0.5); g.fill();
    g.strokeStyle = metal; g.lineWidth = 0.35; g.beginPath(); g.arc(3.1, 1.1, 0.8, 0, Math.PI); g.stroke();
  } else if (tier === 1) {
    g.fillStyle = poly; rr(g, -3.2, -0.7, 3, 1.3, 0.4); g.fill();
    g.fillStyle = lg(g, 0, -1.4, 0, 1.4, [[0, metalHi], [0.4, "#3a3e45"], [1, metal]]);
    rr(g, -0.6, -1.4, 7.8, 2.8, 0.6); g.fill();
    g.fillStyle = metal; rr(g, 7, -0.55, 3.6, 1.1, 0.3); g.fill();
    g.fillStyle = "#1a1c20"; rr(g, 2.6, 1.2, 1.6, 4.6, 0.4); g.fill();
    g.fillStyle = poly; rr(g, 0.2, 1.2, 1.5, 2.8, 0.5); g.fill();
    g.fillStyle = "#15171a"; rr(g, 1.2, -2.2, 2.6, 0.9, 0.3); g.fill();
  } else if (tier === 2) {
    const tan = "#6b5e45";
    g.fillStyle = lg(g, 0, -1.3, 0, 1.8, [[0, shade(tan, 0.25)], [1, shade(tan, -0.35)]]);
    g.beginPath(); g.moveTo(-5.2, -1.1); g.lineTo(-1, -0.9); g.lineTo(-1, 1.2); g.lineTo(-5.2, 1.9); g.closePath(); g.fill();
    g.fillStyle = lg(g, 0, -1.5, 0, 1.4, [[0, metalHi], [0.45, "#373b42"], [1, metal]]);
    rr(g, -1.2, -1.5, 7.6, 2.8, 0.5); g.fill();
    g.fillStyle = lg(g, 0, -1.2, 0, 1.2, [[0, shade(tan, 0.2)], [1, shade(tan, -0.4)]]);
    rr(g, 6.2, -1.2, 6.2, 2.4, 0.6); g.fill();
    g.fillStyle = "rgba(0,0,0,0.5)";
    for (let i = 0; i < 4; i++) rr(g, 6.9 + i * 1.35, -0.55, 0.75, 1.1, 0.3), g.fill();
    g.fillStyle = metal; rr(g, 12.2, -0.45, 3.2, 0.9, 0.2); g.fill();
    rr(g, 14.6, -0.7, 1, 1.4, 0.2); g.fill();
    g.fillStyle = "#1c1e22";
    g.beginPath(); g.moveTo(2.4, 1.2); g.lineTo(4.2, 1.2); g.quadraticCurveTo(5, 3.6, 5.8, 5.4); g.lineTo(4.2, 5.9); g.quadraticCurveTo(3.4, 3.8, 2.4, 1.2); g.fill();
    g.fillStyle = poly; rr(g, 0.1, 1.1, 1.5, 3, 0.5); g.fill();
    // scope
    g.fillStyle = "#15171a"; rr(g, 1.4, -2.2, 0.6, 0.9, 0.1); g.fill(); rr(g, 4, -2.2, 0.6, 0.9, 0.1); g.fill();
    g.fillStyle = lg(g, 0, -3.6, 0, -2, [[0, "#555c66"], [1, "#16181b"]]);
    rr(g, 0.6, -3.6, 5, 1.6, 0.7); g.fill();
    g.fillStyle = "#4fd1ff"; ell(g, 5.6, -2.8, 0.3, 0.65); g.fill();
  } else if (tier === 3) {
    // ammo box + belt
    g.fillStyle = lg(g, -3.6, 0, 1, 0, [[0, "#5a6447"], [1, "#39402c"]]);
    rr(g, -3.6, 1.6, 4.4, 4.6, 0.6); g.fill();
    g.fillStyle = "#c9a24a";
    for (let i = 0; i < 6; i++) rr(g, 0.6 + i * 0.75, 1.6 + Math.sin(i) * 0.2, 0.6, 1.3, 0.2), g.fill();
    // body
    g.fillStyle = lg(g, 0, -2.8, 0, 2.8, [[0, "#9aa1aa"], [0.4, "#5d646e"], [1, "#2a2e34"]]);
    rr(g, -1.2, -2.8, 7.6, 5.6, 1.6); g.fill();
    // barrels
    g.fillStyle = lg(g, 0, -2, 0, 2, [[0, "#6c737d"], [0.5, "#2b2f35"], [1, "#16181b"]]);
    rr(g, 6, -2, 9.2, 4, 0.8); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.6)"; g.lineWidth = 0.3;
    const off = (f % 2) * 0.6;
    for (let i = 0; i < 3; i++) { const y = -1.3 + i * 1.3 + off * 0.3; g.beginPath(); g.moveTo(6.2, y); g.lineTo(15, y); g.stroke(); }
    g.fillStyle = "#1a1c20";
    for (const x of [8, 11.2, 14.2]) rr(g, x, -2.3, 0.8, 4.6, 0.3), g.fill();
    // carry handle
    g.strokeStyle = "#1d2025"; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(0.8, -2.7); g.quadraticCurveTo(3.2, -5.4, 5.4, -2.7); g.stroke();
  } else {
    // plasma rifle
    g.fillStyle = lg(g, 0, -1.8, 0, 1.6, [[0, "#f3f6fa"], [0.5, "#b9c3cf"], [1, "#6c7887"]]);
    g.beginPath();
    g.moveTo(-4, -0.6); g.lineTo(-0.5, -1.8); g.lineTo(10, -1.6); g.lineTo(13.5, -0.8); g.lineTo(13.5, 0.9);
    g.lineTo(8, 1.5); g.lineTo(1.6, 1.5); g.lineTo(-4, 1.4); g.closePath(); g.fill();
    g.fillStyle = "#2a3340"; rr(g, 13.2, -0.65, 2.6, 1.3, 0.4); g.fill();
    g.save();
    g.shadowColor = "#3fd3ff"; g.shadowBlur = 10;
    g.fillStyle = "#5fe0ff";
    for (const x of [4.2, 6.2, 8.2]) rr(g, x, -1.2, 1.1, 2.3, 0.4), g.fill();
    rr(g, 15.2, -0.85, 0.8, 1.7, 0.3); g.fill();
    g.fillStyle = "#b8f2ff"; rr(g, 1.4, 1.4, 2.2, 3.4, 0.6); g.fill();
    g.restore();
    g.fillStyle = "#2a3340"; rr(g, 0, 1.3, 1.5, 3, 0.5); g.fill();
  }
}

/* ----------------------------- soldier ----------------------------- */

const HAIR = ["#2b2118", "helmet", "#5a3a22"];

export function soldierSprite(f: number, hair: number, tier: number, rc: number): Sprite {
  return build(`s${f}_${hair}_${tier}_${rc}`, -11, -52, 23, 4, (g) => {
    const sw = Math.sin((f / 8) * TAU);
    const off = -rc * 1.3;
    const grip = GRIP[tier];
    const R = gunPt(grip.r[0] + off, grip.r[1]);
    const L = gunPt(grip.l[0] + off, grip.l[1]);
    // support arm reaches forward behind the torso
    ln(g, [-5.4, -26, 1.5, -29.5, L.x, L.y], 3, "#1f4ea8");
    // legs
    for (const s of [-1, 1]) {
      const k = s < 0 ? sw : -sw;
      const lift = Math.max(0, k) * 2.6;
      const hx = s * 2.5, hy = -14;
      const kx = s * 2.9, ky = -7.6 - lift * 0.6;
      const fx = s * 2.8 + k * 0.3, fy = -1.4 - lift;
      ln(g, [hx, hy, kx, ky, fx, fy], 4.1, k > 0 ? "#253049" : "#2f3d5c");
      g.fillStyle = "#16191f"; rr(g, kx - 1.5, ky - 1.6, 3, 2.6, 0.8); g.fill();
      g.fillStyle = lg(g, fx - 2, 0, fx + 2, 0, [[0, "#232326"], [0.5, "#3e3e43"], [1, "#121214"]]);
      rr(g, fx - 2.1, fy - 1.6, 4.2, 3.1, 1); g.fill();
    }
    // shirt / shoulders (blue uniform)
    g.fillStyle = lg(g, -6.8, 0, 6.8, 0, [[0, "#1f4ea8"], [0.35, "#4c92f2"], [1, "#183f90"]]);
    rr(g, -6.8, -28.2, 13.6, 15.2, 4); g.fill();
    // plate carrier (bulletproof vest)
    g.fillStyle = lg(g, -6, -27.4, 6, -14, [[0, "#646e55"], [0.5, "#4a523f"], [1, "#2b3125"]]);
    rr(g, -6, -27.4, 12, 13.2, 2.6); g.fill();
    g.fillStyle = "rgba(0,0,0,0.28)"; rr(g, -6, -27.4, 1.6, 13.2, 1.2); g.fill(); rr(g, 4.4, -27.4, 1.6, 13.2, 1.2); g.fill();
    // shoulder straps
    g.fillStyle = "#535b45";
    rr(g, -5.4, -29, 2.6, 3.6, 0.8); g.fill(); rr(g, 2.8, -29, 2.6, 3.6, 0.8); g.fill();
    g.fillStyle = "#2a2f22"; rr(g, -4.6, -27.6, 1, 1, 0.3); g.fill(); rr(g, 3.6, -27.6, 1, 1, 0.3); g.fill();
    // MOLLE webbing
    g.strokeStyle = "rgba(22,26,17,0.7)"; g.lineWidth = 0.55;
    for (const y of [-20.8, -18.6, -16.4]) { g.beginPath(); g.moveTo(-5, y); g.lineTo(5, y); g.stroke(); }
    g.lineWidth = 0.3;
    for (const x of [-3.6, -1.2, 1.2, 3.6]) for (const y of [-20.8, -18.6, -16.4]) { g.beginPath(); g.moveTo(x, y - 0.5); g.lineTo(x, y + 0.5); g.stroke(); }
    // back panel + FIB patch
    g.fillStyle = lg(g, 0, -26.6, 0, -21.8, [[0, "#5d6650"], [1, "#3e4535"]]);
    rr(g, -4, -26.6, 8, 4.8, 1); g.fill();
    g.fillStyle = "#16203a"; rr(g, -3.2, -26, 6.4, 2.9, 0.6); g.fill();
    g.fillStyle = "#f2f4f7"; g.font = "bold 2.4px Arial"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("FIB", 0, -24.5);
    // drag handle
    g.strokeStyle = "#22261d"; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-1.4, -27.2); g.quadraticCurveTo(0, -29, 1.4, -27.2); g.stroke();
    // vest highlight
    g.fillStyle = "rgba(255,255,255,0.09)"; rr(g, -4.6, -21.6, 2.6, 6.6, 1.2); g.fill();
    // belt + pouches
    g.fillStyle = "#1b1d22"; rr(g, -6.4, -15.2, 12.8, 2.3, 0.8); g.fill();
    g.fillStyle = lg(g, 0, -16, 0, -12.6, [[0, "#5d6650"], [1, "#363c2e"]]);
    rr(g, -6, -16, 3, 3.4, 0.6); g.fill(); rr(g, 3, -16, 3, 3.4, 0.6); g.fill();
    g.fillStyle = "#9aa0a8"; rr(g, -0.9, -14.8, 1.8, 1.5, 0.3); g.fill();

    // gun (held at right shoulder, pointing forward / up-screen)
    g.save();
    g.translate(GUN.ax, GUN.ay); g.rotate(GUN.ang); g.scale(GUN.scale, GUN.scale); g.translate(off, 0);
    drawGun(g, tier, f);
    g.restore();

    // trigger arm
    ln(g, [6, -25.6, 9.2, -22.2, R.x, R.y], 3.2, "#3473d8");
    g.fillStyle = "#4d5444"; rr(g, 6.6, -26.4, 2.6, 2.6, 0.7); g.fill(); // shoulder pad
    g.fillStyle = "#17181b"; circ(g, R.x, R.y, 1.55); g.fill(); circ(g, L.x, L.y, 1.55); g.fill();

    // neck + head (from behind)
    g.fillStyle = "#c99877"; rr(g, -1.8, -30, 3.6, 2.8, 1); g.fill();
    g.fillStyle = rg(g, 0, -31.6, 0.5, 4.8, [[0, "#f0c7a2"], [1, "#c48f6c"]], -1.4, -1.4);
    circ(g, 0, -31.6, 4.5); g.fill();
    g.fillStyle = "#c48f6c"; ell(g, -4.3, -31.2, 0.9, 1.3); g.fill(); ell(g, 4.3, -31.2, 0.9, 1.3); g.fill();
    const h = HAIR[hair % HAIR.length];
    if (h === "helmet") {
      g.fillStyle = rg(g, 0, -33, 0.5, 6, [[0, "#7d8768"], [1, "#3b4231"]], -1.6, -1.8);
      g.beginPath(); g.arc(0, -32.4, 5.3, Math.PI * 0.95, Math.PI * 2.05); g.closePath(); g.fill();
      g.fillStyle = "#2f3527"; rr(g, -5.5, -32.4, 11, 1.3, 0.6); g.fill();
      g.fillStyle = "#23281d"; rr(g, -1.6, -35.2, 3.2, 2.2, 0.5); g.fill();
      g.strokeStyle = "#1c1f17"; g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(-4.6, -31.4); g.lineTo(-3.4, -28.6); g.moveTo(4.6, -31.4); g.lineTo(3.4, -28.6); g.stroke();
    } else {
      g.fillStyle = rg(g, 0, -32.4, 0.4, 5, [[0, shade(h, 0.25)], [1, h]], -1.2, -1.6);
      g.beginPath(); g.arc(0, -31.8, 4.65, Math.PI * 0.82, Math.PI * 2.18);
      g.quadraticCurveTo(0, -27.6, -4.3, -29.4); g.closePath(); g.fill();
      g.strokeStyle = shade(h, 0.3); g.lineWidth = 0.35;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 1.4, -35.6); g.quadraticCurveTo(i * 1.6, -32.5, i * 1.3, -30.2); g.stroke(); }
    }
  });
}

/* ------------------------------ zombies ----------------------------- */

type Look = { skin: string; shirt: string; pants: string; hair: string | null; kind: "tee" | "hoodie" | "tank" | "suit" | "jacket" | "worker" | "track" };
export const LOOKS: Look[] = [
  { skin: "#8fa66b", shirt: "#5b4a3a", pants: "#2b2b33", hair: "#2a2a22", kind: "tee" },
  { skin: "#9bb07a", shirt: "#3f4f63", pants: "#3b3428", hair: "#4a3a22", kind: "hoodie" },
  { skin: "#a3a88a", shirt: "#ddd8c8", pants: "#26303a", hair: null, kind: "tank" },
  { skin: "#7f9a63", shirt: "#6b3434", pants: "#3a3a3a", hair: "#1e1e1e", kind: "tee" },
  { skin: "#b6b58f", shirt: "#4a5a3a", pants: "#2b2b33", hair: "#6b5a3a", kind: "jacket" },
  { skin: "#8c9c78", shirt: "#2b3442", pants: "#22252b", hair: "#222222", kind: "suit" },
  { skin: "#a7b28a", shirt: "#e0b23a", pants: "#3b3428", hair: null, kind: "worker" },
  { skin: "#93a57b", shirt: "#7d7466", pants: "#26303a", hair: "#3a2a1a", kind: "tee" },
];
export const RUNNER_LOOK = 8;
LOOKS.push({ skin: "#b9a37a", shirt: "#9a2a2a", pants: "#7a2020", hair: "#1a1a1a", kind: "track" });

function bloodSplat(g: G, x: number, y: number, r: number, seed: number) {
  g.fillStyle = "rgba(110,12,16,0.85)";
  ell(g, x, y, r, r * 0.8, seed); g.fill();
  for (let i = 0; i < 4; i++) {
    const a = seed * 3 + i * 1.7;
    circ(g, x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.1, r * 0.3); g.fill();
  }
  g.fillRect(x - r * 0.15, y, r * 0.3, r * 2.2);
}

export function zombieSprite(look: number, f: number): Sprite {
  return build(`z${look}_${f}`, -13, -44, 13, 4, (g) => {
    const L = LOOKS[look];
    const sw = Math.sin((f / 8) * TAU);
    const lean = L.kind === "track" ? 1.2 : 0;
    // legs
    for (const s of [-1, 1]) {
      const k = s < 0 ? sw : -sw;
      const lift = Math.max(0, k) * 2;
      const hx = s * 2.6, hy = -14;
      const kx = s * 3.1, ky = -7.4 - lift * 0.5;
      const fx = s * 3.1 + k * 0.7, fy = -1.2 - lift;
      if (s > 0 && look % 2 === 0) {
        ln(g, [hx, hy, kx, ky], 4, L.pants);
        ln(g, [kx, ky + 0.6, fx, fy], 2.6, shade(L.skin, -0.15));
        g.fillStyle = shade(L.pants, -0.2);
        g.beginPath(); g.moveTo(kx - 2, ky - 0.4); g.lineTo(kx - 1, ky + 1); g.lineTo(kx, ky); g.lineTo(kx + 1, ky + 1.2); g.lineTo(kx + 2, ky - 0.4); g.fill();
      } else {
        ln(g, [hx, hy, kx, ky, fx, fy], 4, k > 0 ? shade(L.pants, -0.15) : L.pants);
      }
      g.fillStyle = "#24201c"; rr(g, fx - 2, fy - 1.2, 4, 2.6, 1); g.fill();
    }
    // arms behind torso when reaching (upper part)
    const armColor = L.kind === "tank" ? L.skin : L.shirt;
    const reachL = 1.5 + Math.max(0, sw) * 2.5, reachR = 1.5 + Math.max(0, -sw) * 2.5;
    // torso with jagged hem
    g.fillStyle = lg(g, -7, 0, 7, 0, [[0, shade(L.shirt, 0.18)], [0.45, L.shirt], [1, shade(L.shirt, -0.42)]]);
    g.beginPath();
    g.moveTo(-6.4, -28 + lean); g.quadraticCurveTo(0, -29.4 + lean, 6.4, -28 + lean);
    g.lineTo(6.9, -14.6);
    const hem = [6.9, 5.4, 4.1, 2.6, 1.1, -0.6, -2.2, -3.8, -5.3, -6.9];
    hem.forEach((x, i) => g.lineTo(x, -14.4 + (i % 2 ? 1.4 : 0) + ((i * 7) % 3) * 0.2));
    g.closePath(); g.fill();
    if (L.kind === "tank") {
      g.fillStyle = L.skin; ell(g, -5.4, -26.8, 2.2, 1.6); g.fill(); ell(g, 5.4, -26.8, 2.2, 1.6); g.fill();
    }
    if (L.kind === "suit") {
      g.fillStyle = "#e9e4d8";
      g.beginPath(); g.moveTo(-2.2, -28.4); g.lineTo(2.2, -28.4); g.lineTo(0, -21); g.closePath(); g.fill();
      g.fillStyle = "#8b1a1a";
      g.beginPath(); g.moveTo(-0.6, -27.8); g.lineTo(0.6, -27.8); g.lineTo(0.9, -21.4); g.lineTo(0, -20.2); g.lineTo(-0.9, -21.4); g.closePath(); g.fill();
      g.strokeStyle = shade(L.shirt, -0.5); g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(-2.4, -28.4); g.lineTo(-1, -21); g.moveTo(2.4, -28.4); g.lineTo(1, -21); g.stroke();
    }
    if (L.kind === "worker") {
      g.fillStyle = "#c9cdd3";
      g.fillRect(-6.6, -21.6, 13.2, 1.3); g.fillRect(-6.6, -18, 13.2, 1.3);
      g.fillRect(-3.6, -28, 1.3, 13); g.fillRect(2.3, -28, 1.3, 13);
    }
    if (L.kind === "jacket") {
      g.strokeStyle = shade(L.shirt, -0.5); g.lineWidth = 0.45;
      g.beginPath(); g.moveTo(0, -27.8); g.lineTo(0, -15); g.stroke();
      g.fillStyle = shade(L.shirt, -0.25); rr(g, -5, -20, 3, 2.6, 0.4); g.fill(); rr(g, 2, -20, 3, 2.6, 0.4); g.fill();
      g.fillStyle = shade(L.shirt, 0.15);
      g.beginPath(); g.moveTo(-3.6, -28.4); g.lineTo(0, -25.6); g.lineTo(3.6, -28.4); g.lineTo(2.6, -29.2); g.lineTo(-2.6, -29.2); g.fill();
    }
    if (L.kind === "hoodie") {
      g.fillStyle = shade(L.shirt, -0.2); rr(g, -3.6, -19.6, 7.2, 3.2, 1); g.fill();
      g.strokeStyle = "#ddd"; g.lineWidth = 0.35;
      g.beginPath(); g.moveTo(-1, -27.6); g.lineTo(-1.2, -24.4); g.moveTo(1, -27.6); g.lineTo(1.2, -24.4); g.stroke();
    }
    if (L.kind === "track") {
      g.fillStyle = "#f0f0f0"; g.fillRect(-6.4, -27.4, 1, 12.6); g.fillRect(5.4, -27.4, 1, 12.6);
    }
    // torn holes + blood
    g.fillStyle = shade(L.skin, -0.2); ell(g, 2.6, -19.4, 1.4, 1.1); g.fill();
    g.fillStyle = "rgba(60,10,10,0.6)"; ell(g, 2.6, -19.2, 0.8, 0.6); g.fill();
    bloodSplat(g, -2.4 + (look % 3), -23 + (look % 2) * 3, 1.3, look);
    // arms reaching toward the camera
    for (const s of [-1, 1]) {
      const reach = s < 0 ? reachL : reachR;
      const sx = s * 6.2, sy = -26.4 + lean;
      const ex = s * 8.6, ey = -21.6 - reach * 0.3;
      const hx = s * 6.8, hy = -17.6 - reach;
      ln(g, [sx, sy, ex, ey], 3.3, s < 0 ? shade(armColor, 0.08) : shade(armColor, -0.2));
      ln(g, [ex, ey, hx, hy], 2.9, L.kind === "suit" || L.kind === "jacket" || L.kind === "hoodie" ? shade(armColor, -0.1) : L.skin);
      g.fillStyle = rg(g, hx, hy, 0.2, 2.3, [[0, shade(L.skin, 0.15)], [1, shade(L.skin, -0.25)]]);
      circ(g, hx, hy, 2.1); g.fill();
      g.strokeStyle = "#2b2420"; g.lineWidth = 0.35;
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(hx + i * 0.8, hy + 1.2); g.lineTo(hx + i * 0.9, hy + 2.3); g.stroke(); }
    }
    // neck + head
    g.fillStyle = shade(L.skin, -0.2); rr(g, -1.7, -30.4 + lean, 3.4, 3, 1); g.fill();
    g.save();
    g.translate(0.5 * sw, -32.4 + lean * 1.6);
    g.rotate(sw * 0.07 + (look % 3 - 1) * 0.08);
    if (L.kind === "hoodie") { g.fillStyle = shade(L.shirt, -0.3); ell(g, 0, 1.5, 5.8, 5); g.fill(); }
    g.fillStyle = rg(g, 0, 0, 0.5, 5.4, [[0, shade(L.skin, 0.2)], [0.7, L.skin], [1, shade(L.skin, -0.35)]], -1.4, -1.8);
    ell(g, 0, 0, 4.6, 5.1); g.fill();
    g.fillStyle = shade(L.skin, -0.25); ell(g, -4.5, 0.4, 0.9, 1.3); g.fill(); ell(g, 4.5, 0.4, 0.9, 1.3); g.fill();
    if (L.hair) {
      g.fillStyle = L.hair;
      g.beginPath(); g.moveTo(-4.6, -0.6);
      g.quadraticCurveTo(-5, -5.6, 0, -5.4); g.quadraticCurveTo(5, -5.6, 4.6, -0.6);
      g.lineTo(3.6, -2.4); g.lineTo(2.4, -1.4); g.lineTo(1, -3); g.lineTo(-0.6, -1.8); g.lineTo(-2, -3.1); g.lineTo(-3.4, -1.8);
      g.closePath(); g.fill();
    } else {
      g.strokeStyle = "rgba(90,40,70,0.45)"; g.lineWidth = 0.3;
      g.beginPath(); g.moveTo(-2, -4.4); g.quadraticCurveTo(-1, -2.4, -2.4, -1); g.moveTo(1.6, -4.6); g.quadraticCurveTo(2.6, -3, 1.8, -1.6); g.stroke();
    }
    // eyes
    g.fillStyle = "#2a1818"; ell(g, -1.75, 0, 1.3, 1.05); g.fill(); ell(g, 1.75, 0, 1.3, 1.05); g.fill();
    g.save(); g.shadowColor = "#ffdc4a"; g.shadowBlur = 6;
    g.fillStyle = "#ffe56b"; circ(g, -1.7, 0.1, 0.55); g.fill(); circ(g, 1.7, 0.1, 0.55); g.fill();
    g.restore();
    // nose + mouth
    g.fillStyle = shade(L.skin, -0.35); ell(g, 0, 1.7, 0.5, 0.7); g.fill();
    g.fillStyle = "#2a0b0b"; ell(g, 0, 3.4, 1.7, 1 + Math.abs(sw) * 0.4); g.fill();
    g.fillStyle = "#e8e0c8";
    for (let i = -1; i <= 1; i++) g.fillRect(i * 0.6 - 0.22, 2.5, 0.44, 0.6);
    g.fillStyle = "rgba(130,10,14,0.9)"; g.fillRect(0.6, 3.8, 0.45, 1.9);
    g.strokeStyle = "rgba(120,20,20,0.7)"; g.lineWidth = 0.35;
    g.beginPath(); g.moveTo(2.6, -1.8); g.lineTo(3.6, 1.2); g.moveTo(3.1, -1.6); g.lineTo(3.9, 0.6); g.stroke();
    g.restore();
  });
}

/* ---------------------------- brute / boss --------------------------- */

export function bruteSprite(boss: boolean, f: number, wind: number): Sprite {
  return build(`b${boss ? 1 : 0}_${f}_${wind}`, -23, -48, 23, 5, (g) => {
    const sw = Math.sin((f / 8) * TAU);
    const flesh = boss ? "#d98a80" : "#d9ada2";
    const dark = boss ? "#8f3f3a" : "#a07268";
    const up = wind * 3.4;
    // legs
    for (const s of [-1, 1]) {
      const k = s < 0 ? sw : -sw;
      g.fillStyle = lg(g, s * 5 - 3.5, 0, s * 5 + 3.5, 0, [[0, "#4a3a32"], [1, "#2a201b"]]);
      rr(g, s * 5 - 3.6, -12, 7.2, 11.2 - Math.max(0, k) * 1.6, 2.2); g.fill();
      g.fillStyle = shade(flesh, -0.15); ell(g, s * 5 + k * 0.4, -1.2 - Math.max(0, k) * 1.6, 4.2, 2); g.fill();
    }
    // upper arms (behind)
    for (const s of [-1, 1]) {
      const k = s < 0 ? sw : -sw;
      g.fillStyle = rg(g, s * 13.5, -18 - up, 1, 9, [[0, shade(flesh, 0.1)], [1, dark]], -s * 2, -2);
      ell(g, s * 13.5, -17.5 + k * 1.4 - up, 5.4, 10, -s * 0.28); g.fill();
    }
    // body
    g.fillStyle = rg(g, 0, -19, 2, 14, [[0, shade(flesh, 0.32)], [0.6, flesh], [1, shade(flesh, -0.35)]], -3, -4);
    ell(g, 0, -19, 12.4, 12.2); g.fill();
    // muscle definition
    g.strokeStyle = shade(flesh, -0.3); g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(-7, -25); g.quadraticCurveTo(-2, -21, 0, -25); g.quadraticCurveTo(2, -21, 7, -25); g.stroke();
    g.beginPath(); g.moveTo(0, -24); g.lineTo(0, -10); g.stroke();
    g.beginPath(); g.moveTo(-4, -17); g.lineTo(4, -17); g.moveTo(-4, -13.6); g.lineTo(4, -13.6); g.stroke();
    // wounds / stitches
    g.fillStyle = "#8a1018"; ell(g, 5.4, -22, 2.2, 1.4, 0.4); g.fill();
    g.fillStyle = "#c0303a"; ell(g, 5.2, -22.2, 1.2, 0.7, 0.4); g.fill();
    g.strokeStyle = "#3a1a1a"; g.lineWidth = 0.4;
    g.beginPath(); g.moveTo(-8, -14); g.lineTo(-3, -9); g.stroke();
    for (let i = 0; i < 5; i++) { const x = -7.4 + i, y = -13.4 + i; g.beginPath(); g.moveTo(x - 0.6, y + 0.6); g.lineTo(x + 0.6, y - 0.6); g.stroke(); }
    g.strokeStyle = "rgba(110,40,120,0.45)"; g.lineWidth = 0.4;
    g.beginPath(); g.moveTo(-9, -24); g.quadraticCurveTo(-7, -21, -9, -18); g.moveTo(8, -16); g.quadraticCurveTo(9.5, -13, 7.6, -11); g.stroke();
    // torn pants waist
    g.fillStyle = "#3a2c25";
    g.beginPath(); g.moveTo(-11, -10.6); g.lineTo(11, -10.6); g.lineTo(10, -8); g.lineTo(7, -9); g.lineTo(4, -7.6); g.lineTo(0, -9); g.lineTo(-4, -7.6); g.lineTo(-8, -9); g.lineTo(-10.4, -7.8); g.closePath(); g.fill();
    if (boss) {
      // bone spikes on shoulders
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        const bx = s * (7 + i * 2.6), by = -29 + i * 1.6 - up * 0.4;
        g.fillStyle = lg(g, bx - 1, by, bx + 1, by, [[0, "#f4efe0"], [1, "#a89f88"]]);
        g.beginPath(); g.moveTo(bx - 1.2, by + 1); g.lineTo(bx + s * 1.2, by - 4.6 + i * 0.6); g.lineTo(bx + 1.2, by + 1); g.closePath(); g.fill();
      }
      // tumor bulges
      g.fillStyle = shade(flesh, -0.12); circ(g, -7.6, -10.6, 2); g.fill(); circ(g, 8.8, -27, 1.8); g.fill();
    }
    // forearms + fists in front
    for (const s of [-1, 1]) {
      const k = s < 0 ? sw : -sw;
      const fx = s * 15, fy = -8 + k * 1.4 - up * 1.7;
      ln(g, [s * 14.6, -15 - up, fx, fy], 6.4, dark);
      g.fillStyle = rg(g, fx, fy, 0.5, 4.6, [[0, shade(flesh, 0.25)], [1, shade(flesh, -0.3)]], -s, -1.4);
      circ(g, fx, fy, 4.4); g.fill();
      g.strokeStyle = shade(flesh, -0.45); g.lineWidth = 0.4;
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(fx + i * 1.3, fy + 1.4); g.lineTo(fx + i * 1.3, fy + 3.6); g.stroke(); }
      if (boss) {
        g.fillStyle = "#e9e2cf";
        g.beginPath(); g.moveTo(fx - s * 3, fy - 3); g.lineTo(fx - s * 5.8, fy - 7.4); g.lineTo(fx - s * 1.4, fy - 4.2); g.closePath(); g.fill();
      }
    }
    // head
    g.fillStyle = rg(g, 0, -31, 0.4, 5.4, [[0, shade(flesh, 0.25)], [1, shade(flesh, -0.3)]], -1.4, -1.6);
    ell(g, 0, -31.2, 4.8, 4.6); g.fill();
    g.fillStyle = "#2b0d0d"; ell(g, -1.8, -32, 1.2, 0.9); g.fill(); ell(g, 1.8, -32, 1.2, 0.9); g.fill();
    g.save(); g.shadowColor = boss ? "#ff4a2a" : "#ffd23f"; g.shadowBlur = 8;
    g.fillStyle = boss ? "#ff7a4a" : "#ffe36b"; circ(g, -1.8, -32, 0.6); g.fill(); circ(g, 1.8, -32, 0.6); g.fill();
    g.restore();
    g.fillStyle = "#2a0a0a"; rr(g, -2.6, -29.6, 5.2, 2 + wind * 0.4, 0.8); g.fill();
    g.fillStyle = "#efe6cc";
    g.beginPath(); g.moveTo(-2.2, -28); g.lineTo(-1.6, -31); g.lineTo(-1, -28); g.fill();
    g.beginPath(); g.moveTo(2.2, -28); g.lineTo(1.6, -31); g.lineTo(1, -28); g.fill();
  }, 2.6);
}

/* ------------------------------ props ------------------------------- */

export function barrelSprite(): Sprite {
  return build("barrel", -17, -40, 17, 3, (g) => {
    g.fillStyle = lg(g, -15, 0, 15, 0, [[0, "#3e2210"], [0.25, "#8a5424"], [0.45, "#c07a38"], [0.6, "#a5642a"], [1, "#3e2210"]]);
    g.beginPath();
    g.moveTo(-14, -34); g.quadraticCurveTo(-16.4, -17, -14, 0); g.lineTo(14, 0); g.quadraticCurveTo(16.4, -17, 14, -34); g.closePath(); g.fill();
    g.strokeStyle = "rgba(30,15,5,0.5)"; g.lineWidth = 0.5;
    for (const x of [-9, -4.5, 0, 4.5, 9]) { g.beginPath(); g.moveTo(x, -33); g.quadraticCurveTo(x * 1.12, -17, x, -1); g.stroke(); }
    for (const y of [-29.5, -5]) {
      g.fillStyle = lg(g, -15, 0, 15, 0, [[0, "#1e1e20"], [0.45, "#7c8188"], [0.55, "#9aa0a8"], [1, "#1e1e20"]]);
      rr(g, -15.4, y, 30.8, 2.8, 0.6); g.fill();
      g.fillStyle = "#c9ced4";
      for (const x of [-11, -3, 5, 12]) circ(g, x, y + 1.4, 0.35), g.fill();
    }
    g.fillStyle = "rgba(255,230,190,0.12)"; rr(g, -6, -27, 3, 20, 1.5); g.fill();
    g.fillStyle = lg(g, -14, -34, 14, -34, [[0, "#5a3416"], [0.5, "#9a6230"], [1, "#5a3416"]]);
    ell(g, 0, -34, 14, 3.8); g.fill();
    g.strokeStyle = "#2a1a0e"; g.lineWidth = 0.9; g.stroke();
    g.strokeStyle = "rgba(40,20,8,0.6)"; g.lineWidth = 0.4;
    for (const x of [-7, 0, 7]) { g.beginPath(); g.moveTo(x, -37.3); g.lineTo(x, -30.7); g.stroke(); }
    g.fillStyle = "#2c2c2e"; circ(g, 5, -34.2, 1.2); g.fill();
  }, 2.4);
}

export function carSprite(color: string, v: number): Sprite {
  return build(`car${color}${v}`, -21, -30, 21, 3, (g) => {
    g.fillStyle = "rgba(0,0,0,0.0)";
    // tyres
    g.fillStyle = "#151515"; rr(g, -18.5, -6, 6, 6.4, 1.4); g.fill(); rr(g, 12.5, -6, 6, 6.4, 1.4); g.fill();
    // body
    g.fillStyle = lg(g, 0, -18, 0, -2, [[0, shade(color, 0.25)], [0.5, color], [1, shade(color, -0.45)]]);
    rr(g, -19.5, -18, 39, 15, 3.4); g.fill();
    // roof + rear window
    g.fillStyle = lg(g, 0, -28, 0, -18, [[0, shade(color, 0.1)], [1, shade(color, -0.2)]]);
    g.beginPath(); g.moveTo(-14, -18); g.lineTo(-11, -27.5); g.lineTo(11, -27.5); g.lineTo(14, -18); g.closePath(); g.fill();
    g.fillStyle = lg(g, 0, -26.4, 0, -18.6, [[0, "#9fb6c4"], [0.5, "#3a4b58"], [1, "#1a232b"]]);
    g.beginPath(); g.moveTo(-12.4, -18.8); g.lineTo(-10, -26.4); g.lineTo(10, -26.4); g.lineTo(12.4, -18.8); g.closePath(); g.fill();
    if (v % 2) {
      g.strokeStyle = "rgba(230,240,245,0.75)"; g.lineWidth = 0.35;
      g.beginPath(); g.moveTo(3, -22); g.lineTo(-2, -25.4); g.moveTo(3, -22); g.lineTo(8, -24.8); g.moveTo(3, -22); g.lineTo(6.4, -19.2); g.moveTo(3, -22); g.lineTo(-3.4, -20); g.stroke();
    }
    // trunk line, plate, lights
    g.strokeStyle = shade(color, -0.5); g.lineWidth = 0.5;
    g.beginPath(); g.moveTo(-14, -14.6); g.lineTo(14, -14.6); g.stroke();
    g.fillStyle = "#e9e4cf"; rr(g, -4, -11, 8, 3, 0.5); g.fill();
    g.save(); g.shadowColor = "#ff2a2a"; g.shadowBlur = 6;
    g.fillStyle = "#d42020"; rr(g, -18.4, -15.6, 6, 3, 1); g.fill(); rr(g, 12.4, -15.6, 6, 3, 1); g.fill();
    g.restore();
    g.fillStyle = "#24262a"; rr(g, -19.8, -6.6, 39.6, 3.2, 1.2); g.fill();
    // rust / dirt
    g.fillStyle = "rgba(110,60,25,0.45)"; ell(g, -12, -8, 3, 1.6); g.fill(); ell(g, 9, -16, 2, 1); g.fill();
  }, 2.2);
}

/* --------------------------- soft effects --------------------------- */

export function softDot(color: string): HTMLCanvasElement {
  const key = "dot" + color;
  const hit = cache.get(key);
  if (hit) return hit.c;
  const c = mk(64, 64);
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(0.45, color.replace(/[\d.]+\)$/, (m) => String(parseFloat(m) * 0.45) + ")"));
  gr.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  cache.set(key, { c, ax: 32, ay: 32 });
  return c;
}

export function shadowSprite(): HTMLCanvasElement {
  return softDot("rgba(0,0,0,0.55)");
}

/** Muzzle flash pointing along +x from (0, 0). */
export function muzzleSprite(tier: number): Sprite {
  const cols = [["#fff7d0", "#ffc23a"], ["#fff2c0", "#ffa82e"], ["#ffeec0", "#ff8a2b"], ["#fff0d0", "#ff6a2b"], ["#e8fbff", "#3fd3ff"]];
  const [core, outer] = cols[tier];
  return build(`muzzle${tier}`, -3, -7, 18, 7, (g) => {
    g.save();
    g.shadowColor = outer; g.shadowBlur = 14;
    g.fillStyle = outer;
    g.beginPath();
    g.moveTo(0, -1.6); g.lineTo(5, -5.6); g.lineTo(6, -1.6); g.lineTo(16, 0); g.lineTo(6, 1.6); g.lineTo(5, 5.6); g.lineTo(0, 1.6);
    g.lineTo(-1.6, 3.4); g.lineTo(-0.6, 0); g.lineTo(-1.6, -3.4); g.closePath(); g.fill();
    g.fillStyle = core;
    g.beginPath(); g.moveTo(0, -0.9); g.lineTo(4, -2.4); g.lineTo(10, 0); g.lineTo(4, 2.4); g.lineTo(0, 0.9); g.closePath(); g.fill();
    g.fillStyle = "#ffffff"; circ(g, 1.2, 0, 1.3); g.fill();
    g.restore();
  }, 0);
}
