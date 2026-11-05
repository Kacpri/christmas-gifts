"use client";

import { useActionState } from "react";

import { markReady, type ActionResult } from "@/app/actions";

const empty: ActionResult = { ok: false };

export function ReadySection({
  hasWish,
  hasTheme,
  isReady,
  lotteryDone,
  lateJoiner,
}: {
  hasWish: boolean;
  hasTheme: boolean;
  isReady: boolean;
  lotteryDone: boolean;
  lateJoiner: boolean;
}) {
  const [state, formAction, pending] = useActionState(markReady, empty);

  if (lotteryDone || lateJoiner) {
    return (
      <p className="text-sm text-stone-500">
        {lateJoiner
          ? "Losowanie już się odbyło — gotowość nie jest wymagana."
          : "Losowanie już się odbyło."}
      </p>
    );
  }

  const missing = [
    !hasWish && "przynajmniej dwa życzenia",
    !hasTheme && "temat prezentu",
  ]
    .filter(Boolean)
    .join(" i ");

  return (
    <>
      {isReady ? (
        <p className="text-sm font-medium text-accent">
          Jesteś gotowy ✓
        </p>
      ) : (
        <>
          <p className="text-sm text-stone-500">
            Potwierdź gotowość, gdy uzupełnisz listę życzeń i temat.
          </p>
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
            className="mt-3 flex flex-col gap-2"
          >
            <button
              type="submit"
              disabled={pending || !hasWish || !hasTheme}
              className="w-fit rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {pending ? "Zapisywanie…" : "Jestem gotowy"}
            </button>
            {(!hasWish || !hasTheme) && (
              <span className="text-xs text-stone-500">
                Brakuje: {missing}
              </span>
            )}
            {!state.ok && state.error && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}
          </form>
        </>
      )}
    </>
  );
}
