"use client";

import { useActionState } from "react";

import { markReady, type ActionResult } from "@/app/actions";

const empty: ActionResult = { ok: false };

export function ReadySection({
  hasWish,
  hasTheme,
  isReady,
  lotteryDone,
}: {
  hasWish: boolean;
  hasTheme: boolean;
  isReady: boolean;
  lotteryDone: boolean;
}) {
  const [state, formAction, pending] = useActionState(markReady, empty);

  if (lotteryDone) {
    return (
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Gotowość do losowania</h2>
        <p className="mt-1 text-sm text-stone-500">
          Losowanie już się odbyło.
        </p>
      </section>
    );
  }

  const missing = [
    !hasWish && "przynajmniej jedno życzenie",
    !hasTheme && "temat prezentu",
  ]
    .filter(Boolean)
    .join(" i ");

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Gotowość do losowania</h2>
      {isReady ? (
        <p className="mt-1 text-sm font-medium text-green-700">
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
                  "Po potwierdzeniu gotowości nie będziesz mógł usuwać życzeń, zmieniać tematu ani imienia i nazwiska. Dodawanie nowych życzeń nadal będzie możliwe. Tej operacji nie można cofnąć."
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
              className="w-fit rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
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
    </section>
  );
}
