"use client";

import { useActionState } from "react";

import {
  cancelLottery,
  removeUser,
  runLottery,
  sendLotteryEmails,
  type ActionResult,
} from "@/app/actions";

const empty: ActionResult = { ok: false };

const plural = (n: number, forms: [string, string, string]) => {
  if (n === 1) return forms[0];
  const d = n % 10;
  const h = n % 100;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return forms[1];
  return forms[2];
};

export function OrganizerPanel({
  participants,
  lateJoiners,
  lotteryDone,
}: {
  participants: { id: string; full_name: string; is_ready: boolean }[];
  lateJoiners: { id: string; full_name: string }[];
  lotteryDone: boolean;
}) {
  const [state, formAction, pending] = useActionState(runLottery, empty);
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelLottery,
    empty
  );
  const [emailState, emailAction, emailPending] = useActionState(
    sendLotteryEmails,
    empty
  );

  const readyCount = participants.filter((p) => p.is_ready).length;
  const allReady =
    participants.length > 0 && participants.every((p) => p.is_ready);
  const notReadyNames = participants
    .filter((p) => !p.is_ready)
    .map((p) => p.full_name);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-stone-500">
          {participants.length}{" "}
          {plural(participants.length, ["osoba", "osoby", "osób"])} w losowaniu,{" "}
          {readyCount} {plural(readyCount, ["gotowa", "gotowe", "gotowych"])}.
          Losowanie wymaga minimum 3 osób.
        </p>
      </div>

      <form
        className="flex flex-col items-start gap-2"
        action={(formData: FormData) => {
          if (
            lotteryDone &&
            !window.confirm(
              "Powtórzyć losowanie? Obecne wyniki zostaną zastąpione."
            )
          ) {
            return;
          }
          formAction(formData);
        }}
      >
        <button
          type="submit"
          disabled={pending || !allReady}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
        >
          {pending ? (
            <>
              <SpinnerIcon />
              Losowanie…
            </>
          ) : lotteryDone ? (
            "Powtórz losowanie"
          ) : (
            "Start losowania"
          )}
        </button>
        {!allReady && (
          <span className="text-xs text-stone-500">
            Czekamy na: {notReadyNames.join(", ")}
          </span>
        )}
      </form>
      {!state.ok && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      {lotteryDone && (
        <form
          action={(formData: FormData) => {
            if (
              window.confirm(
                "Anulować losowanie? Wyniki zostaną usunięte, a życzenia i tematy odblokowane."
              )
            ) {
              cancelAction(formData);
            }
          }}
        >
          <button
            type="submit"
            disabled={cancelPending}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {cancelPending ? "Anulowanie…" : "Anuluj losowanie"}
          </button>
        </form>
      )}
      {!cancelState.ok && cancelState.error && (
        <p className="text-sm text-red-600">{cancelState.error}</p>
      )}

      {lotteryDone && (
        <form
          action={(formData: FormData) => {
            if (
              window.confirm(
                "Wysłać maile z wynikami losowania do wszystkich uczestników?"
              )
            ) {
              emailAction(formData);
            }
          }}
        >
          <button
            type="submit"
            disabled={emailPending}
            className="rounded-xl border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-mist disabled:opacity-50"
          >
            {emailPending ? "Wysyłanie…" : "Wyślij wyniki mailem"}
          </button>
        </form>
      )}
      {emailState.ok && (
        <p className="text-sm font-medium text-accent">Maile wysłane ✓</p>
      )}
      {!emailState.ok && emailState.error && (
        <p className="text-sm text-red-600">{emailState.error}</p>
      )}

      <div>
        <h3 className="text-sm font-medium text-stone-600">Uczestnicy</h3>
        <ul className="mt-2 flex flex-col gap-1">
          {participants.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2">
                <span>{p.full_name}</span>
                <span
                  className={
                    p.is_ready
                      ? "text-xs font-medium text-accent"
                      : "text-xs text-faint"
                  }
                >
                  {p.is_ready ? "gotowy" : "oczekuje"}
                </span>
              </span>
              <form
                action={(formData) => {
                  removeUser(formData);
                }}
                onSubmit={(e) => {
                  if (!window.confirm(`Usunąć ${p.full_name} z losowania?`)) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  className="text-xs text-red-600 hover:underline"
                >
                  usuń
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>

      {lateJoiners.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-stone-600">
            Dołączyli po losowaniu
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {lateJoiners.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{p.full_name}</span>
                <form
                  action={(formData) => {
                    removeUser(formData);
                  }}
                  onSubmit={(e) => {
                    if (!window.confirm(`Usunąć ${p.full_name}?`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:underline"
                  >
                    usuń
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
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
