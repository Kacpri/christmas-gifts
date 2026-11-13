"use client";

import { useEffect, useState } from "react";

export function Countdown({
  startsAt,
  label,
}: {
  startsAt: string | null;
  label: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!startsAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startsAt]);

  if (!startsAt || now == null) return null;
  const diff = new Date(startsAt).getTime() - now;
  if (diff <= 0) {
    return (
      <p className="text-sm text-cream/90">
        Impreza trwa lub się już odbyła 🎄
      </p>
    );
  }

  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  if (days > 0 || hours > 0 || mins > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);

  return (
    <p role="timer" aria-live="off" className="text-sm text-cream/90">
      Do {label}:{" "}
      <span suppressHydrationWarning className="font-semibold tabular-nums text-cream">
        {parts.join(" ")}
      </span>
    </p>
  );
}
