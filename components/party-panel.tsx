"use client";

import { useEffect, useActionState, useState } from "react";

import { saveParty, type ActionResult } from "@/app/actions";

const empty: ActionResult = { ok: false };

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    dateStyle: "full",
    timeStyle: "short",
  });
}

export function PartyPanel({
  startsAt,
  location,
  notes,
  isOrganizer,
}: {
  startsAt: string | null;
  location: string | null;
  notes: string | null;
  isOrganizer: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveParty, empty);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.ok) setSaved(true);
  }, [state.ok]);

  if (!isOrganizer) {
    const hasDetails = startsAt || location || notes;
    if (!hasDetails) {
      return (
        <p className="text-sm text-faint">
          Organizator nie ustawił jeszcze szczegółów imprezy.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2.5">
        {startsAt && (
          <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span aria-hidden className="shrink-0 text-accent dark:text-[#7cc99a]">
              <CalendarIcon />
            </span>
            {formatDateTime(startsAt)}
          </p>
        )}
        {location && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <span aria-hidden className="shrink-0 text-accent dark:text-[#7cc99a]">
              <MapPinIcon />
            </span>
            {location}
          </p>
        )}
        {notes && (
          <p className="whitespace-pre-wrap rounded-[10px] bg-mist px-3.5 py-3 text-sm text-muted">
            {notes}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        if (pending) e.preventDefault();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="party-starts" className="text-xs font-medium text-faint">
          Data i godzina
        </label>
        <input
          id="party-starts"
          name="starts_at"
          type="datetime-local"
          defaultValue={toLocalInput(startsAt)}
          onChange={() => setSaved(false)}
          className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="party-location" className="text-xs font-medium text-faint">
          Lokalizacja
        </label>
        <input
          id="party-location"
          name="location"
          type="text"
          defaultValue={location ?? ""}
          maxLength={200}
          placeholder="np. u Ani, ul. Świerkowa 12"
          onChange={() => setSaved(false)}
          className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-faint"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="party-notes" className="text-xs font-medium text-faint">
          Notatki (opcjonalnie)
        </label>
        <textarea
          id="party-notes"
          name="notes"
          defaultValue={notes ?? ""}
          maxLength={1000}
          rows={3}
          placeholder="np. strój świąteczny, weź coś do picia"
          onChange={() => setSaved(false)}
          className="resize-y rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-faint"
        />
      </div>
      <button
        type="submit"
        disabled={pending || saved}
        className="inline-flex min-w-[152px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
      >
        {pending ? (
          <>
            <SpinnerIcon />
            Zapisywanie…
          </>
        ) : saved ? (
          <>
            <CheckIcon />
            Zapisano
          </>
        ) : (
          "Zapisz szczegóły"
        )}
      </button>
      {!state.ok && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
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
