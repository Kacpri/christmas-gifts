"use client";

import { useEffect } from "react";

function expectedTheme(): string | null {
  try {
    const t = localStorage.getItem("theme");
    if (t) return t === "dark" ? "dark" : "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return null;
  }
}

function applyTheme() {
  const theme = expectedTheme();
  if (theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export function ThemeSync() {
  useEffect(() => {
    applyTheme();
    const el = document.documentElement;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== "attributes" || m.attributeName !== "data-theme") {
          continue;
        }
        const expected = expectedTheme();
        if (expected && el.getAttribute("data-theme") !== expected) {
          el.setAttribute("data-theme", expected);
        }
      }
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return null;
}
