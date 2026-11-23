"use client";

import { useEffect, useRef } from "react";

import { BottomSheet } from "@/components/bottom-sheet";
import { useMediaQuery } from "@/lib/use-media-query";

export type ConfirmState = {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
};

export function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmState | null;
  onClose: () => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const lastState = useRef<ConfirmState | null>(null);
  if (state) lastState.current = state;
  const s = state ?? lastState.current;

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!s) return null;

  const tone = s.tone ?? "danger";
  const confirmClass =
    tone === "danger"
      ? "bg-danger text-white hover:bg-danger-deep"
      : "bg-accent text-white hover:bg-accent/90";

  const buttons = (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-mist"
      >
        {s.cancelLabel ?? "Anuluj"}
      </button>
      <button
        type="button"
        onClick={() => {
          s.onConfirm();
          onClose();
        }}
        className={`rounded-xl px-4 py-2 text-sm font-medium ${confirmClass}`}
      >
        {s.confirmLabel ?? "Potwierdź"}
      </button>
    </div>
  );

  if (isDesktop) {
    if (!state) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
            {s.message}
          </p>
          <div className="mt-5">{buttons}</div>
        </div>
      </div>
    );
  }

  return (
    <BottomSheet
      open={!!state}
      onClose={onClose}
      zClass="z-[60]"
      closeOnBackdrop
      footer={buttons}
    >
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
        {s.message}
      </p>
    </BottomSheet>
  );
}
