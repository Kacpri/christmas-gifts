"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";

export function Menu({
  trigger,
  children,
  align = "end",
  panelClassName = "",
}: {
  trigger: (p: {
    open: boolean;
    toggle: () => void;
    ref: Ref<HTMLButtonElement>;
  }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("[role=menuitem]")
        ?.focus();
    });
    return () => cancelAnimationFrame(t);
  }, [open]);

  function onPanelKeyDown(e: ReactKeyboardEvent) {
    if (
      e.key !== "ArrowDown" &&
      e.key !== "ArrowUp" &&
      e.key !== "Home" &&
      e.key !== "End"
    ) {
      return;
    }
    e.preventDefault();
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []
    );
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    let next = idx;
    if (e.key === "ArrowDown") next = idx === -1 ? 0 : (idx + 1) % items.length;
    else if (e.key === "ArrowUp")
      next =
        idx === -1 ? items.length - 1 : (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else next = items.length - 1;
    items[next]?.focus();
  }

  return (
    <div ref={rootRef} className="relative">
      {trigger({
        open,
        toggle: () => setOpen((o) => !o),
        ref: triggerRef,
      })}
      {open && (
        <div
          ref={panelRef}
          role="menu"
          onKeyDown={onPanelKeyDown}
          onClick={() => setOpen(false)}
          className={`absolute top-full z-40 mt-1.5 min-w-44 rounded-xl border border-cream/20 bg-background p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${
            align === "end" ? "right-0" : "left-0"
          } ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  onClick,
  active,
  danger,
  radio,
  children,
}: {
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  radio?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={radio ? "menuitemradio" : "menuitem"}
      aria-checked={radio ? active ?? false : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm ${
        danger
          ? "font-semibold text-[#e0685c] hover:bg-[#e0685c]/15"
          : active
            ? "font-semibold text-cream"
            : "text-cream hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
