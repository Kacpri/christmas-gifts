import type { CSSProperties } from "react";

function rand(i: number, salt: number) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const FLAKES = Array.from({ length: 70 }, (_, i) => ({
  left: rand(i, 1) * 100,
  size: 2 + rand(i, 2) * 3,
  duration: 9 + rand(i, 3) * 12,
  delay: -rand(i, 4) * 21,
  opacity: 0.3 + rand(i, 5) * 0.4,
  drift: -30 + rand(i, 6) * 60,
}));

export function Snow() {
  return (
    <div aria-hidden className="snow-container">
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="snowflake"
          style={
            {
              left: `${f.left}%`,
              width: `${f.size}px`,
              height: `${f.size}px`,
              opacity: f.opacity,
              animationDuration: `${f.duration}s`,
              animationDelay: `${f.delay}s`,
              "--drift": `${f.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
