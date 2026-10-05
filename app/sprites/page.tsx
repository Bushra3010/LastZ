"use client";

import { useEffect, useRef } from "react";
import { GUN, RUNNER_LOOK, SPR, Sprite, barrelSprite, bruteSprite, carSprite, gunPt, muzzleSprite, soldierSprite, zombieSprite } from "@/lib/game/sprites";

/** Character gallery: renders the game sprites large for review. */
export default function SpritesPage() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    const W = 1100, H = 900;
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = W + "px"; c.style.height = H + "px";
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    g.fillStyle = "#6d7075"; g.fillRect(0, 0, W, H);
    const draw = (s: Sprite, x: number, y: number, u: number) => {
      const k = u / SPR;
      g.drawImage(s.c, x - s.ax * k, y - s.ay * k, s.c.width * k, s.c.height * k);
    };
    for (let t = 0; t < 5; t++) {
      const x = 90 + t * 200, y = 300, u = 6;
      draw(soldierSprite(2, t % 3, t, 1), x, y, u);
      const tip = gunPt(GUN.tip[t] - 1.3, 0);
      const m = muzzleSprite(t);
      g.save(); g.globalCompositeOperation = "lighter";
      g.translate(x + tip.x * u, y + tip.y * u); g.rotate(GUN.ang);
      g.scale(u / SPR, u / SPR); g.drawImage(m.c, -m.ax, -m.ay); g.restore();
    }
    for (let l = 0; l <= RUNNER_LOOK; l++) draw(zombieSprite(l, l), 60 + l * 120, 580, 5);
    draw(bruteSprite(false, 0, 0), 150, 880, 6);
    draw(bruteSprite(true, 0, 3), 470, 880, 6);
    draw(barrelSprite(), 720, 860, 5);
    draw(carSprite("#7a2a2a", 1), 950, 860, 5);
  }, []);
  return <canvas ref={ref} style={{ display: "block" }} />;
}
