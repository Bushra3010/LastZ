export type Upgrades = { squad: number; damage: number; rate: number };

export type HudState = {
  squad: number;
  level: number;
  progress: number;
  coins: number;
  kills: number;
  weapon: string;
  weaponTier: number;
  bossHp: number | null;
};

export type EndResult = {
  victory: boolean;
  level: number;
  coins: number;
  kills: number;
  squad: number;
};

export type ToastKind = "good" | "bad" | "boss" | "weapon";

export type EngineCallbacks = {
  onHud: (s: HudState) => void;
  onEnd: (r: EndResult) => void;
  onToast: (text: string, kind: ToastKind) => void;
};

export type WeaponDef = {
  name: string;
  rate: number; // shots / sec / shooter
  dmg: number;
  speed: number;
  pierce: number;
  color: string;
  glow: string;
  width: number;
};

export const WEAPONS: WeaponDef[] = [
  { name: "Pistol", rate: 2.2, dmg: 1, speed: 30, pierce: 0, color: "#fff2a8", glow: "rgba(255,210,63,0.55)", width: 2 },
  { name: "SMG", rate: 4.4, dmg: 1, speed: 34, pierce: 0, color: "#ffe08a", glow: "rgba(255,176,46,0.55)", width: 2 },
  { name: "Assault Rifle", rate: 4, dmg: 2.2, speed: 38, pierce: 0, color: "#ffd0a0", glow: "rgba(255,138,61,0.6)", width: 2.6 },
  { name: "Minigun", rate: 9, dmg: 2, speed: 42, pierce: 0, color: "#ffc3a0", glow: "rgba(255,94,58,0.6)", width: 2.6 },
  { name: "Plasma Rifle", rate: 5, dmg: 6, speed: 46, pierce: 2, color: "#d8f6ff", glow: "rgba(70,200,255,0.75)", width: 4.5 },
];
