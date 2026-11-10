"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type SelectOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

export function Select({
  value,
  onChange,
  options,
  name,
  className,
  direction = "down",
  scrollable = true,
  leadingIcon,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  name?: string;
  className?: string;
  direction?: "down" | "up";
  scrollable?: boolean;
  leadingIcon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-left text-sm text-ink"
      >
        {(selected?.icon ?? leadingIcon) && (
          <span className="shrink-0 text-muted" aria-hidden>
            {selected?.icon ?? leadingIcon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? ""}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-muted transition-transform ${
            direction === "up"
              ? open
                ? ""
                : "rotate-180"
              : open
                ? "rotate-180"
                : ""
          }`}
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className={`absolute z-30 ${
            direction === "up" ? "bottom-full mb-1" : "mt-1"
          } ${scrollable ? "max-h-64 overflow-auto" : ""} w-full rounded-xl border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]`}
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm ${
                  o.value === value
                    ? "bg-sage-100 font-medium text-accent"
                    : "text-ink hover:bg-mist"
                }`}
              >
                {o.icon && (
                  <span className="shrink-0 text-muted" aria-hidden>
                    {o.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
