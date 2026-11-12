"use client";

import { useActionState, useState } from "react";

import { markReady, type ActionResult } from "@/app/actions";
import { ConfirmDialog, type ConfirmState } from "@/components/confirm-dialog";
import { participationVerb, plural } from "@/lib/format";

const empty: ActionResult = { ok: false };

export function ReadySection({
  hasWish,
  hasTheme,
  isReady,
  lotteryDone,
  lateJoiner,
  count,
}: {
  hasWish: boolean;
  hasTheme: boolean;
  isReady: boolean;
  lotteryDone: boolean;
  lateJoiner: boolean;
  count: number;
}) {
  const [state, formAction, pending] = useActionState(markReady, empty);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  if (lotteryDone || lateJoiner) return null;

  return (
    <div className="flex flex-col gap-2">
      {isReady && (
        <p className="text-sm text-muted">
          Czekamy na losowanie. W grze {participationVerb(count)} udział{" "}
          <strong>{count}</strong> {plural(count, ["osoba", "osoby", "osób"])}.
        </p>
      )}
      {!isReady && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setConfirm({
              message:
                "Po potwierdzeniu gotowości nie będziesz mógł zmieniać tematu. Listę życzeń nadal będziesz mógł edytować do losowania. Tej operacji nie można cofnąć.",
              confirmLabel: "Wszystko gotowe",
              tone: "primary",
              onConfirm: () => formAction(fd),
            });
          }}
          className="flex flex-col gap-2"
        >
          <button
            type="submit"
            disabled={pending || !hasWish || !hasTheme}
            className="w-fit inline-flex items-center gap-2 rounded-xl border border-accent bg-surface px-4 py-2 text-sm font-medium text-accent hover:bg-mist disabled:border-line disabled:text-faint disabled:hover:bg-surface"
          >
            {pending ? (
              <>
                <SpinnerIcon />
                Zapisywanie…
              </>
            ) : (
              "Wszystko gotowe"
            )}
          </button>
          {!state.ok && state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
        </form>
      )}

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
