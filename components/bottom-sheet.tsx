"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Presence } from "./presence";

function useVisualViewportRect(active: boolean) {
  const [rect, setRect] = useState<{ top: number; height: number } | null>(
    null
  );

  useEffect(() => {
    if (!active) {
      setRect(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setRect((prev) =>
        prev && prev.top === vv.offsetTop && prev.height === vv.height
          ? prev
          : { top: vv.offsetTop, height: vv.height }
      );
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);

  return rect;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const viewport = useVisualViewportRect(open);

  return (
    <Presence
      open={open}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={
        viewport ? { top: viewport.top, height: viewport.height } : undefined
      }
      onClick={onClose}
      backdrop
      sheetClassName="relative flex h-full w-full flex-col justify-end"
      sheetOnClick={(e) => e.stopPropagation()}
    >
      <div className="flex max-h-[60%] flex-col rounded-t-2xl bg-surface shadow-lg">
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="flex shrink-0 justify-center pb-2 pt-3"
        >
          <span className="h-1 w-10 rounded-full bg-line" aria-hidden />
        </button>
        {title && (
          <div className="shrink-0 px-4 pb-2 text-sm font-semibold text-ink">
            {title}
          </div>
        )}
        <div className="min-h-0 overflow-y-auto px-4 pb-4 pt-1">
          {children}
        </div>
      </div>
    </Presence>
  );
}
