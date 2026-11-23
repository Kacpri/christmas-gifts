"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Presence } from "./presence";

function useVisualViewportPadding(active: boolean) {
  const [padding, setPadding] = useState(0);

  useEffect(() => {
    if (!active) {
      setPadding(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const p = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setPadding((prev) => (prev === p ? prev : p));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [active]);

  return padding;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  tall = false,
  zClass = "z-50",
  className = "",
  contentClassName = "min-h-0 overflow-y-auto px-4 pb-4 pt-1",
  closeOnBackdrop = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tall?: boolean;
  zClass?: string;
  className?: string;
  contentClassName?: string;
  closeOnBackdrop?: boolean;
}) {
  const kbPadding = useVisualViewportPadding(open);
  const lastTitle = useRef<ReactNode>(undefined);
  if (title != null) lastTitle.current = title;
  const shownTitle = title ?? lastTitle.current;

  return (
    <Presence
      open={open}
      className={`fixed inset-0 ${zClass} flex items-end justify-center${
        className ? ` ${className}` : ""
      }`}
      style={{ paddingBottom: kbPadding }}
      onClick={onClose}
      backdrop
      sheetClassName={`relative flex h-full w-full flex-col justify-end${
        closeOnBackdrop ? " pointer-events-none" : ""
      }`}
      sheetOnClick={(e) => e.stopPropagation()}
    >
      <div
        className={`flex ${
          tall ? "max-h-[85%]" : "max-h-[60%]"
        } flex-col rounded-t-2xl bg-surface shadow-lg${
          closeOnBackdrop ? " pointer-events-auto" : ""
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="flex shrink-0 justify-center pb-2 pt-3 transition-colors active:bg-mist"
        >
          <span className="h-1 w-10 rounded-full bg-line" aria-hidden />
        </button>
        {shownTitle != null && (
          <div className="shrink-0 truncate px-4 pb-2 text-sm font-semibold text-ink">
            {shownTitle}
          </div>
        )}
        <div className={contentClassName}>{children}</div>
        {footer != null && (
          <div className="shrink-0 border-t border-line px-4 pb-4 pt-3">
            {footer}
          </div>
        )}
      </div>
    </Presence>
  );
}
