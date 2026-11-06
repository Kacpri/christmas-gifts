"use client";

import { useState, useActionState } from "react";

import { saveName, type ActionResult } from "@/app/actions";

const empty: ActionResult = { ok: false };

export function NameForm({
  fullName,
  locked,
}: {
  fullName: string;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveName, empty);
  const [nameValue, setNameValue] = useState(fullName);

  return (
    <>
      <p className="text-sm text-stone-600">
        {locked
          ? "Imię i nazwisko są zablokowane."
          : "Tak zobaczą Cię inni uczestnicy."}
      </p>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <div className="relative">
          <input
            name="full_name"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            required
            maxLength={100}
            readOnly={locked}
            onKeyDown={(e) => {
              if (locked && e.key === "Enter") e.preventDefault();
            }}
            className={`rounded-xl border border-input-line px-3.5 py-2.5 text-sm ${
              locked ? "bg-mist pr-10 text-faint" : "bg-input-bg text-ink"
            }`}
          />
          {locked && (
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-faint">
              <LockIcon />
            </span>
          )}
        </div>
        {!locked && (
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending || nameValue.trim() === fullName}
              aria-live="polite"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {pending ? (
                <>
                  <SpinnerIcon />
                  Zapisuję…
                </>
              ) : nameValue.trim() === fullName && fullName.trim() !== "" ? (
                <>
                  <CheckIcon />
                  Zapisano
                </>
              ) : (
                "Zapisz"
              )}
            </button>
          </div>
        )}
        {!state.ok && state.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
      </form>
    </>
  );
}

function LockIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
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
