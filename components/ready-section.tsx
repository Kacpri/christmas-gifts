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

  if (lotteryDone || lateJoiner || isReady) return null;

  return (
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
        className="w-fit rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
      >
        {pending ? "Zapisywanie…" : "Wszystko gotowe"}
      </button>
      {!state.ok && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
