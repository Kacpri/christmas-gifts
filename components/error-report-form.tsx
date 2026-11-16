"use client";

import { useEffect, useActionState, useState } from "react";

import { createErrorReport, type ActionResult } from "@/app/actions";
import { Presence } from "@/components/presence";

const empty: ActionResult = { ok: false };

export function ErrorReportForm({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createErrorReport, empty);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) {
      setSent(true);
      setError(null);
    } else if (state.error) {
      setError(state.error);
    }
  }, [state]);

  useEffect(() => {
    if (open) {
      setSent(false);
      setError(null);
    }
  }, [open]);

  return (
    <Presence
      open={open}
      className="fixed inset-0 z-50 flex items-end justify-center p-4"
      onClick={onClose}
      backdrop
      sheetClassName="relative w-full max-w-xs"
      sheetOnClick={(e) => e.stopPropagation()}
    >
      <div className="rounded-2xl bg-surface p-4 shadow-lg">
        <p className="mb-3 text-sm font-semibold text-ink">Zgłoś błąd</p>
        {sent ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              Dziękujemy! Zgłoszenie zostało wysłane do organizatora.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Zamknij
            </button>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-3">
            <textarea
              name="description"
              required
              maxLength={500}
              rows={4}
              placeholder="Co się stało? (np. coś nie działa, nie wyświetla się)"
              className="w-full resize-none rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
              >
                {pending ? "Wysyłanie…" : "Wyślij"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium hover:bg-mist"
              >
                Anuluj
              </button>
            </div>
          </form>
        )}
      </div>
    </Presence>
  );
}
