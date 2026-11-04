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
  const [dirty, setDirty] = useState(false);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Twoje dane</h2>
      <p className="text-sm text-stone-500">
        {locked
          ? "Imię i nazwisko są zablokowane."
          : "Tak zobaczą Cię inni uczestnicy."}
      </p>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <input
          name="full_name"
          defaultValue={fullName}
          required
          maxLength={100}
          disabled={locked}
          onChange={() => setDirty(true)}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500"
        />
        {!locked && (
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {pending ? "Zapisywanie…" : "Zapisz"}
            </button>
            {state.ok && !dirty && (
              <span className="text-sm text-green-700">Zapisano ✓</span>
            )}
          </div>
        )}
        {!state.ok && state.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
      </form>
    </section>
  );
}
