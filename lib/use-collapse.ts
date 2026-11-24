"use client";

import { useEffect, useState } from "react";

export function useCollapse(open: boolean, duration = 220) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), duration);
    return () => window.clearTimeout(t);
  }, [open, duration]);

  return { mounted, shown };
}
