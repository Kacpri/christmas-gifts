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
        <input
          name="full_name"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          required
          maxLength={100}
          disabled={locked}
          className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink disabled:bg-mist disabled:text-faint"
        />
        {!locked && (
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {pending ? "Zapisywanie…" : "Zapisz"}
            </button>
            {nameValue.trim() !== "" && nameValue.trim() === fullName && (
              <span className="text-sm text-accent">Zapisano ✓</span>
            )}
          </div>
        )}
        {!state.ok && state.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
      </form>
    </>
  );
}
