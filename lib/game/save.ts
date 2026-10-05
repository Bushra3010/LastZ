import { Upgrades } from "./types";

export type SaveData = {
  coins: number;
  gems: number;
  level: number;
  totalKills: number;
  upgrades: Upgrades;
};

const KEY = "lastz-demo-save-v1";

export const DEFAULT_SAVE: SaveData = {
  coins: 200,
  gems: 44096,
  level: 1,
  totalKills: 0,
  upgrades: { squad: 0, damage: 0, rate: 0 },
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SAVE;
    const s = JSON.parse(raw);
    return { ...DEFAULT_SAVE, ...s, upgrades: { ...DEFAULT_SAVE.upgrades, ...(s.upgrades ?? {}) } };
  } catch {
    return DEFAULT_SAVE;
  }
}

export function writeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — progress stays in memory */
  }
}

export const UPGRADE_INFO: { key: keyof Upgrades; name: string; desc: (lvl: number) => string; max: number }[] = [
  { key: "squad", name: "Squad", desc: (l) => `Start with ${5 + l} soldiers`, max: 12 },
  { key: "damage", name: "Firepower", desc: (l) => `+${l * 15}% damage`, max: 15 },
  { key: "rate", name: "Fire Rate", desc: (l) => `+${l * 10}% fire rate`, max: 15 },
];

export const upgradeCost = (lvl: number) => Math.round(100 * Math.pow(1.55, lvl));

export const powerOf = (s: SaveData) =>
  98_000_000 + s.level * 125_310 + (s.upgrades.squad + s.upgrades.damage + s.upgrades.rate) * 48_217 + s.totalKills * 37;
