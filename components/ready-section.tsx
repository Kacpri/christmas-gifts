"use client";

import { useActionState } from "react";

import { markReady, type ActionResult } from "@/app/actions";
import { plural } from "@/lib/format";

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

  if (lotteryDone || lateJoiner) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        Czekamy na losowanie. W grze bierze udział{" "}
        <strong>{count}</strong> {plural(count, ["osoba", "osoby", "osób"])}.
      </p>
      {!isReady && (
        <form
          action={(formData: FormData) => {
            if (
              window.confirm(
                "Po potwierdzeniu gotowości nie będziesz mógł zmieniać tematu ani imienia i nazwiska. Listę życzeń nadal będziesz mógł edytować do losowania. Tej operacji nie można cofnąć."
              )
            ) {
              formAction(formData);
            }
          }}
          className="flex flex-col gap-2"
        >
          <button
            type="submit"
            disabled={pending || !hasWish || !hasTheme}
            className="w-fit inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
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
