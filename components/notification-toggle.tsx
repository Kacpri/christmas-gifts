"use client";

import { useEffect, useState } from "react";

import {
  isNotifyMuted,
  notifyPermission,
  requestNotifyPermission,
  setNotifyMuted,
} from "@/lib/notify";

type Perm = NotificationPermission | "unsupported";

export function NotificationToggle() {
  const [perm, setPerm] = useState<Perm>("default");
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setPerm(notifyPermission());
    setMuted(isNotifyMuted());
  }, []);

  async function onClick() {
    if (perm === "unsupported") return;
    if (perm !== "granted") {
      const p = await requestNotifyPermission();
      setPerm(p);
      if (p === "granted") {
        setNotifyMuted(false);
        setMuted(false);
      }
      return;
    }
    const next = !muted;
    setNotifyMuted(next);
    setMuted(next);
  }

  if (perm === "unsupported") return null;

  const active = perm === "granted" && !muted;
  const label =
    perm === "denied"
      ? "Powiadomienia zablokowane w przeglądarce"
      : perm !== "granted"
        ? "Włącz powiadomienia o nowych wiadomościach"
        : muted
          ? "Włącz powiadomienia o nowych wiadomościach"
          : "Wyłącz powiadomienia o nowych wiadomościach";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-[10px] border border-cream/55 bg-white/10 hover:bg-white/20 ${
        active ? "text-cream" : "text-cream/60"
      }`}
    >
      <BellIcon muted={muted || perm === "denied"} />
    </button>
  );
}

function BellIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      {muted && <path d="M2 2l20 20" />}
    </svg>
  );
}
