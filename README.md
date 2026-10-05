# Last Z — Survival Shooter (Web Demo)

A playable Next.js demo of a Last Z–style squad survival shooter. No backend: progress is saved in `localStorage`.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. On desktop it renders inside a phone frame; on mobile it goes full screen.

- **Demo shortcut:** http://localhost:3000/?quick gives a short stage, so you reach the boss in about 20 seconds.
- **Character gallery:** http://localhost:3000/sprites shows every soldier, weapon, zombie and boss sprite at large size.
- **Reset progress:** run `localStorage.removeItem("lastz-demo-save-v1")` in the browser console.

## Controls

- **Mobile:** drag left or right.
- **Desktop:** move the mouse, or use ← → / A D.
- **Pause:** P or Esc.
- **Sound:** the speaker button at the top left mutes and unmutes. Audio starts on the first tap or click, because browsers block it before that.

## Gameplay

- **Squad runner:** the squad auto-fires and auto-aims at the nearest zombies.
- **Math gates** (`+N`, `−N`, `xN`, `÷N`): walk through one side to change squad size. Shooting a gate raises its number, which turns red gates blue.
- **Barrels** show their HP. Destroy one to get its reward: a weapon upgrade (Pistol → SMG → Assault Rifle → Minigun → Plasma), extra soldiers, or coins. Running into a barrel costs a soldier.
- **Zombies:** walkers, fast runners (red shirts) and brutes (big, with an HP bar).
- **Boss** at the end of every stage. It stops in front of the squad and smashes soldiers.
- **Base screen:** spend coins on Squad size, Firepower and Fire Rate. Stages get harder and alternate between Bridge and City themes.

## Code layout

| File | Purpose |
| --- | --- |
| `lib/game/engine.ts` | Canvas engine: pseudo-3D road projection, entities, collisions, level generator, rendering |
| `lib/game/sprites.ts` | Character art (soldiers with vests and 5 guns, 9 zombie looks, brute, boss, barrel, cars), drawn once at high resolution and cached |
| `lib/game/audio.ts` | Synthesized sound effects and background music (Web Audio API, no audio files) |
| `app/sprites/page.tsx` | Character gallery page |
| `lib/game/types.ts` | Shared types and the weapon table |
| `lib/game/save.ts` | localStorage save data, upgrade costs |
| `components/Game.tsx` | React UI: HUD, menu, upgrades, pause and result screens |
| `components/Icons.tsx` | Inline SVG icons |

Supabase can be added later by replacing `loadSave` / `writeSave` in `lib/game/save.ts`.
