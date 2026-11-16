"use client";

import { useCallback, useEffect, useActionState, useState } from "react";
import { domToBlob } from "modern-screenshot";

import { createErrorReport, type ActionResult } from "@/app/actions";
import { Presence } from "@/components/presence";

const empty: ActionResult = { ok: false };

export function ErrorReportForm({
  open,
  onClose,
  activePanel,
}: {
  open: boolean;
  onClose: () => void;
  activePanel: string | null;
}) {
  const [state, formAction, pending] = useActionState(createErrorReport, empty);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async () => {
    if (!activePanel) return;
    const el = document.getElementById(`panel-${activePanel}`);
    if (!el) return;
    setCapturing(true);
    try {
      const blob = await domToBlob(el, { scale: 2, type: "image/png" });
      setScreenshot(new File([blob], "screenshot.png", { type: "image/png" }));
    } catch {
      // błąd zrzutu ignorujemy — zgłoszenie bez obrazka
    } finally {
      setCapturing(false);
    }
  }, [activePanel]);

  useEffect(() => {
    if (open) {
      setSent(false);
      setError(null);
      setScreenshot(null);
      void capture();
    }
  }, [open, capture]);

  useEffect(() => {
    if (state.ok) {
      setSent(true);
      setError(null);
    } else if (state.error) {
      setError(state.error);
    }
  }, [state]);

  useEffect(() => {
    if (!screenshot) return;
    const url = URL.createObjectURL(screenshot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

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
          <form
            action={(formData) => {
              if (screenshot) formData.append("screenshot", screenshot);
              return formAction(formData);
            }}
            className="flex flex-col gap-3"
          >
            <textarea
              name="description"
              required
              maxLength={500}
              rows={4}
              placeholder="Co się stało? (np. coś nie działa, nie wyświetla się)"
              className="w-full resize-none rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
            />
            {screenshot && previewUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={previewUrl}
                  alt="Podgląd zrzutu ekranu"
                  className="h-20 w-20 shrink-0 rounded-lg border border-input-line object-cover"
                />
                <div className="flex flex-col gap-1 text-left">
                  <button
                    type="button"
                    onClick={() => void capture()}
                    className="text-xs text-accent-deep hover:underline"
                  >
                    Zrób ponownie
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreenshot(null)}
                    className="text-xs text-danger hover:underline"
                  >
                    Usuń zrzut
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void capture()}
                disabled={capturing}
                className="self-start text-xs text-accent-deep hover:underline disabled:opacity-50"
              >
                {capturing ? "Robię zrzut…" : "Dodaj zrzut ekranu"}
              </button>
            )}
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
