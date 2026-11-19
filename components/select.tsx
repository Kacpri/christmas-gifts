"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "@/lib/use-media-query";
import { Presence } from "./presence";

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
  placeholder,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  name?: string;
  className?: string;
  direction?: "down" | "up";
  scrollable?: boolean;
  leadingIcon?: ReactNode;
  placeholder?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        ref.current &&
        !ref.current.contains(target) &&
        (!sheetRef.current || !sheetRef.current.contains(target))
      ) {
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

  useEffect(() => {
    if (!open || isDesktop) return;
    const raf = requestAnimationFrame(() => {
      const list = listRef.current;
      const item = selectedRef.current;
      if (!list || !item) return;
      const listRect = list.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      if (itemRect.top < listRect.top) {
        list.scrollTop += itemRect.top - listRect.top;
      } else if (itemRect.bottom > listRect.bottom) {
        list.scrollTop += itemRect.bottom - listRect.bottom;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, isDesktop]);

  const selected = options.find((o) => o.value === value);
  const chevronUp = !isDesktop || direction === "up";

  const optionItems = options.map((o) => (
    <li key={o.value} ref={o.value === value ? selectedRef : undefined}>
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
  ));

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        id={id}
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
        <span
          className={`min-w-0 flex-1 truncate ${
            selected ? "" : "text-placeholder"
          }`}
        >
          {selected?.label ?? placeholder ?? ""}
        </span>
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
            open
              ? chevronUp
                ? ""
                : "rotate-180"
              : chevronUp
                ? "rotate-180"
                : ""
          }`}
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && isDesktop && (
        <ul
          role="listbox"
          ref={listRef}
          className={`absolute z-30 ${
            direction === "up" ? "bottom-full mb-1" : "mt-1"
          } ${scrollable ? "max-h-64 overflow-auto" : ""} w-full rounded-xl border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]`}
        >
          {optionItems}
        </ul>
      )}
      {open &&
        !isDesktop &&
        createPortal(
          <div ref={sheetRef}>
            <Presence
              open={open}
              className="fixed inset-0 z-50 flex items-end justify-center"
              onClick={() => setOpen(false)}
              backdrop
              sheetClassName="relative w-full"
              sheetOnClick={(e) => e.stopPropagation()}
            >
              <div className="flex max-h-[60vh] flex-col rounded-t-2xl bg-surface shadow-lg">
                <div className="flex shrink-0 justify-center pb-2 pt-3" aria-hidden>
                  <div className="h-1 w-10 rounded-full bg-line" />
                </div>
                <ul role="listbox" ref={listRef} className="min-h-0 overflow-y-auto py-1">
                  {optionItems}
                </ul>
              </div>
            </Presence>
          </div>,
          document.body
        )}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
