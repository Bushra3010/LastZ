"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "@/lib/game/engine";
import { sfx } from "@/lib/game/audio";
import { EndResult, HudState, ToastKind, WEAPONS } from "@/lib/game/types";
import { DEFAULT_SAVE, SaveData, UPGRADE_INFO, loadSave, powerOf, upgradeCost, writeSave } from "@/lib/game/save";
import {
  BuildingIcon, CoinIcon, GasMaskIcon, GemIcon, GlobeIcon, GunIcon, HammerIcon, MailIcon,
  MedalIcon, PauseIcon, RocketIcon, ShieldIcon, SkullIcon, SoundIcon, WoodIcon,
} from "./Icons";

type Screen = "menu" | "playing" | "paused" | "result";
type Toast = { id: number; text: string; kind: ToastKind };

const CHAT = [
  ["[KOR]Jun", "boss at stage 5 is crazy"],
  ["[IND]Arjun", "take the x3 gate always"],
  ["[USA]Mike", "minigun > plasma? 🤔"],
  ["[KOR]Jun", "rally at 21:00 server time"],
  ["[BRA]Leo", "anyone in alliance?"],
  ["[DEU]Max", "shoot the red gates to fix them!"],
];

const fmt = (n: number) => n.toLocaleString("en-US");
const fmtK = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n));

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uiAreaRef = useRef<HTMLDivElement>(null);
  const [ui, setUi] = useState({ w: 400, h: 820, s: 1 });
  const engineRef = useRef<GameEngine | null>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [hud, setHud] = useState<HudState | null>(null);
  const [result, setResult] = useState<EndResult | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [chatIdx, setChatIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  const persist = useCallback((s: SaveData) => {
    setSave(s);
    writeSave(s);
  }, []);

  useEffect(() => {
    setSave(loadSave());
    setMuted(sfx.muted);
    // browsers only allow audio after a user gesture
    const unlock = () => sfx.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const toggleMute = () => {
    sfx.unlock();
    sfx.setMuted(!muted);
    setMuted(!muted);
    if (muted) sfx.click();
  };

  // Scale the whole HUD/menu layer from a 400x820 design size to the actual frame.
  useEffect(() => {
    const el = uiAreaRef.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const sc = Math.max(0.68, Math.min(1.45, Math.min(w / 400, h / 800)));
      setUi({ w: w / sc, h: h / sc, s: sc });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setChatIdx((i) => (i + 1) % CHAT.length), 3500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let tid = 0;
    const engine = new GameEngine(canvas, {
      onHud: (s) => setHud(s),
      onToast: (text, kind) => {
        const id = ++tid;
        setToasts((t) => [...t.slice(-2), { id, text, kind }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1800);
      },
      onEnd: (r) => {
        const s = saveRef.current;
        const next: SaveData = {
          ...s,
          coins: s.coins + r.coins,
          totalKills: s.totalKills + r.kills,
          level: r.victory ? s.level + 1 : s.level,
          gems: r.victory ? s.gems + 25 : s.gems,
        };
        setSave(next);
        writeSave(next);
        setResult(r);
        setScreen("result");
      },
    });
    engineRef.current = engine;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __engine: GameEngine }).__engine = engine;
    return () => engine.destroy();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (screen === "playing") { engineRef.current?.pause(true); setScreen("paused"); }
        else if (screen === "paused") { engineRef.current?.pause(false); setScreen("playing"); }
      }
      if ((e.key === "Enter" || e.key === " ") && (screen === "menu" || screen === "result")) {
        e.preventDefault();
        startGame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const startGame = () => {
    sfx.unlock();
    sfx.click();
    setResult(null);
    setHud(null);
    engineRef.current?.start(saveRef.current.level, saveRef.current.upgrades, new URLSearchParams(window.location.search).has("quick"));
    setScreen("playing");
  };

  const buy = (key: keyof SaveData["upgrades"]) => {
    const lvl = save.upgrades[key];
    const cost = upgradeCost(lvl);
    const info = UPGRADE_INFO.find((u) => u.key === key)!;
    sfx.unlock();
    if (save.coins < cost || lvl >= info.max) return;
    sfx.pickup();
    persist({ ...save, coins: save.coins - cost, upgrades: { ...save.upgrades, [key]: lvl + 1 } });
  };

  const coinsShown = save.coins + (screen === "playing" || screen === "paused" ? hud?.coins ?? 0 : 0);
  const [chatA, chatB] = [CHAT[chatIdx], CHAT[(chatIdx + 1) % CHAT.length]];

  return (
    <div className="stage">
      <div className="phone">
        <canvas ref={canvasRef} className="game-canvas" />
        <div className="ui-area" ref={uiAreaRef}>
        <div className="ui" style={{ width: ui.w, height: ui.h, transform: `scale(${ui.s})` }}>

        {/* ---------- Top resource bar ---------- */}
        <div className="topbar">
          <div className="avatar">
            <GasMaskIcon />
            <div className="avatar-bar"><span style={{ width: "72%" }} /></div>
          </div>
          <div className="pills">
            <div className="pill"><ShieldIcon /><b>{fmt(powerOf(save))}</b></div>
            <div className="pill"><WoodIcon /><b>{fmtK(200000 + save.totalKills * 10)}</b></div>
            <div className="pill gem"><GemIcon /><b>{fmt(save.gems)}</b><span className="plus">+</span></div>
          </div>
        </div>
        <div className="subbar">
          <div className="mini-icons"><span className="mini"><MedalIcon size={14} /></span><span className="mini bolt">⚡</span></div>
          <div className="coins-pill"><CoinIcon size={16} /><b>{fmt(coinsShown)}</b></div>
        </div>
        <div className="vip">VIP 2</div>

        {/* ---------- In-game HUD ---------- */}
        {(screen === "playing" || screen === "paused") && hud && (
          <>
            <div className="progress-wrap">
              <div className="stage-label">STAGE {hud.level}</div>
              <div className="progress">
                <div className="progress-fill" style={{ width: `${hud.progress * 100}%` }} />
                <div className="progress-skull"><SkullIcon size={20} /></div>
              </div>
            </div>
            <button className="pause-btn" onClick={() => { engineRef.current?.pause(true); setScreen("paused"); }} aria-label="Pause">
              <PauseIcon />
            </button>
            <div className="weapon-chip">
              <GunIcon size={22} color={hud.weaponTier === 4 ? "#5fd4ff" : "#7dff4d"} />
              <span>{hud.weapon}</span>
              <div className="tier">{WEAPONS.map((_, i) => <i key={i} className={i <= hud.weaponTier ? "on" : ""} />)}</div>
            </div>
            <div className="kills-chip"><SkullIcon size={14} /> {hud.kills}</div>
            {hud.bossHp !== null && (
              <div className="boss-top">
                <span>BOSS</span>
                <div className="boss-track"><div style={{ width: `${hud.bossHp * 100}%` }} /></div>
              </div>
            )}
          </>
        )}

        <button className="mute-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
          <SoundIcon muted={muted} />
        </button>

        {/* ---------- Side buttons (decor, like the original) ---------- */}
        {screen !== "menu" && <div className="side right top-r">
          <div className="round gold"><MedalIcon /></div>
          <div className="round"><span className="badge">6</span><BuildingIcon /></div>
        </div>}
        <div className="side left bottom-l">
          <div className="round"><RocketIcon /></div>
          <div className="round"><HammerIcon /></div>
        </div>
        <div className="side right bottom-r">
          <div className="round"><ShieldIcon size={22} /></div>
          <div className="round"><MailIcon /></div>
          <div className="round"><BuildingIcon /></div>
        </div>

        {/* ---------- Bottom chat bar ---------- */}
        <div className="bottombar">
          <div className="s-badge">S</div>
          <div className="chat">
            <div><em>{chatA[0]}:</em> {chatA[1]}</div>
            <div><em>{chatB[0]}:</em> {chatB[1]}</div>
          </div>
          <div className="globe"><GlobeIcon /></div>
        </div>

        {/* ---------- Toasts ---------- */}
        <div className="toasts">
          {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
        </div>

        {/* ---------- Menu ---------- */}
        {screen === "menu" && (
          <div className="overlay menu">
            <div className="logo">
              <div className="logo-top"><span className="red">LAST</span> <span className="blue">Z</span></div>
              <div className="logo-sub">SURVIVAL SHOOTER</div>
            </div>

            <div className="stage-card">
              <div className="stage-card-title">STAGE {save.level}</div>
              <div className="stage-card-meta">
                <span><SkullIcon size={14} /> Boss: {save.level % 2 ? "Bridge Butcher" : "Street Brute"}</span>
                <span>{save.level % 2 ? "🌉 Bridge" : "🏙️ City"}</span>
              </div>
            </div>

            <div className="upgrades">
              {UPGRADE_INFO.map((u) => {
                const lvl = save.upgrades[u.key];
                const cost = upgradeCost(lvl);
                const maxed = lvl >= u.max;
                const can = !maxed && save.coins >= cost;
                return (
                  <button key={u.key} className={`upg ${can ? "" : "disabled"}`} onClick={() => buy(u.key)}>
                    <div className="upg-name">{u.name}</div>
                    <div className="upg-lvl">Lv.{lvl}</div>
                    <div className="upg-desc">{u.desc(lvl)}</div>
                    <div className="upg-cost">{maxed ? "MAX" : <><CoinIcon size={14} />{fmt(cost)}</>}</div>
                  </button>
                );
              })}
            </div>

            <button className="battle" onClick={startGame}>BATTLE</button>
            <div className="hint">Drag / mouse / ← → to move · shoot gates to raise their numbers</div>
          </div>
        )}

        {/* ---------- Pause ---------- */}
        {screen === "paused" && (
          <div className="overlay dim">
            <div className="panel">
              <div className="panel-title">PAUSED</div>
              <button className="battle small" onClick={() => { sfx.click(); engineRef.current?.pause(false); setScreen("playing"); }}>RESUME</button>
              <button className="ghost" onClick={() => { sfx.click(); engineRef.current?.quit(); setScreen("menu"); }}>QUIT TO BASE</button>
            </div>
          </div>
        )}

        {/* ---------- Result ---------- */}
        {screen === "result" && result && (
          <div className="overlay dim">
            <div className={`panel result ${result.victory ? "win" : "lose"}`}>
              <div className="ribbon">{result.victory ? "VICTORY!" : "DEFEATED"}</div>
              <div className="stars">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={result.victory && i < (result.squad > 30 ? 3 : result.squad > 10 ? 2 : 1) ? "on" : ""}>★</span>
                ))}
              </div>
              <div className="stats">
                <div><span>Stage</span><b>{result.level}</b></div>
                <div><span>Zombies killed</span><b>{fmt(result.kills)}</b></div>
                <div><span>Survivors</span><b>{result.squad}</b></div>
                <div className="reward"><span>Reward</span><b><CoinIcon size={16} /> {fmt(result.coins)}{result.victory && <> · <GemIcon size={16} /> 25</>}</b></div>
              </div>
              <button className="battle small" onClick={startGame}>{result.victory ? `STAGE ${save.level}` : "RETRY"}</button>
              <button className="ghost" onClick={() => { sfx.click(); setScreen("menu"); }}>BACK TO BASE</button>
            </div>
          </div>
        )}
        </div>
        </div>
      </div>
      <div className="rotate-hint">
        <div className="rotate-phone" />
        <p>Rotate your device to portrait to play</p>
      </div>
    </div>
  );
}
