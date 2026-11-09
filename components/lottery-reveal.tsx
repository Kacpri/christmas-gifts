"use client";

import { useEffect, useMemo, useState } from "react";

const COLORS = [
  "#b91c1c",
  "#e0a800",
  "#165a32",
  "#fff3c4",
  "#ffffff",
  "#d94f76",
];

type Piece = {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  drift: number;
  spin: number;
};

export function LotteryReveal({ onDone }: { onDone: () => void }) {
  const [closing, setClosing] = useState(false);

  const pieces = useMemo<Piece[]>(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 2.6 + Math.random() * 2.2,
        size: 6 + Math.random() * 9,
        color: COLORS[i % COLORS.length],
        drift: (Math.random() - 0.5) * 240,
        spin: 360 + Math.random() * 720,
      })),
    []
  );

  useEffect(() => {
    const t1 = setTimeout(() => setClosing(true), 4200);
    const t2 = setTimeout(onDone, 4900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-accent-deep/70 backdrop-blur-[2px] transition-opacity duration-700 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      onClick={onDone}
      role="presentation"
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        {pieces.map((p, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 1.6,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--drift" as string]: `${p.drift}px`,
              ["--spin" as string]: `${p.spin}deg`,
            }}
          />
        ))}
      </div>
      <div className="relative mx-4 flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-surface p-8 text-center shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        <span className="text-5xl" aria-hidden>
          🎄
        </span>
        <h2 className="text-[28px] text-accent">Losowanie zakończone!</h2>
        <p className="text-sm text-muted">
          Twoje wyniki są gotowe. Wesołego kupowania prezentów!
        </p>
        <p className="text-xs text-faint">Kliknij, aby zamknąć</p>
      </div>
    </div>
  );
}
