"use client";

import { useEffect, useState } from "react";

import { ToggleSwitch } from "@/components/toggle-switch";

export function ThemeToggle({
  variant = "icon",
}: {
  variant?: "icon" | "row";
}) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute(
      "data-theme",
      next ? "dark" : "light"
    );
    setDark(next);
  }

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={dark}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-cream hover:bg-white/10"
      >
        {dark ? <SunIcon /> : <MoonIcon />}
        <span className="flex-1 text-sm font-medium">Tryb ciemny</span>
        <ToggleSwitch on={dark} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
      className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-cream/55 bg-white/10 text-cream hover:bg-white/20"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function MoonIcon() {
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
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}
