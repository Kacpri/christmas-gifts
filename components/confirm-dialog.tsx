"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, onClose]);

  if (!state) return null;

  const tone = state.tone ?? "danger";
  const confirmClass =
    tone === "danger"
      ? "bg-[#a3201a] text-white hover:bg-[#8a1a15]"
      : "bg-accent text-white hover:bg-accent/90";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      >
        <p className="text-sm leading-relaxed text-ink">{state.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-input-line bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-mist"
          >
            {state.cancelLabel ?? "Anuluj"}
          </button>
          <button
            type="button"
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${confirmClass}`}
          >
            {state.confirmLabel ?? "Potwierdź"}
          </button>
        </div>
      </div>
    </div>
  );
}
