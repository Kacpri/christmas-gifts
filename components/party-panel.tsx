"use client";

import {
  useEffect,
  useActionState,
  useState,
  type FormEvent,
} from "react";

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

function LocalDateTime({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(formatDateTime(iso));
  }, [iso]);
  if (!text) return null;
  return <>{text}</>;
}

export function PartyPanel({
  startsAt,
  location,
  notes,
  label,
  isOrganizer,
  listBudget,
  themeBudget,
}: {
  startsAt: string | null;
  location: string | null;
  notes: string | null;
  label: string;
  isOrganizer: boolean;
  listBudget: number | null;
  themeBudget: number | null;
}) {
  const [state, formAction, pending] = useActionState(saveParty, empty);
  const [saved, setSaved] = useState(false);
  const [startsValue, setStartsValue] = useState(toLocalInput(startsAt));

  useEffect(() => {
    if (state.ok) setSaved(true);
  }, [state.ok]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (pending) {
      e.preventDefault();
      return;
    }
    const form = e.currentTarget;
    const localInput = form.elements.namedItem(
      "starts_at_local"
    ) as HTMLInputElement | null;
    const hidden = form.elements.namedItem(
      "starts_at"
    ) as HTMLInputElement | null;
    if (localInput && hidden) {
      if (localInput.value) {
        const d = new Date(localInput.value);
        hidden.value = Number.isNaN(d.getTime()) ? "" : d.toISOString();
      } else {
        hidden.value = "";
      }
    }
  }

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
        <p className="text-[15px] font-bold text-accent dark:text-[#7cc99a]">
          Do {label.trim() || "imprezy"}:
        </p>
        {startsAt && (
          <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span aria-hidden className="shrink-0 text-accent dark:text-[#7cc99a]">
              <CalendarIcon />
            </span>
            <LocalDateTime iso={startsAt} />
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
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="starts_at" defaultValue={startsAt ?? ""} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="party-label" className="text-xs font-medium text-faint">
          Do czego odliczamy?
        </label>
        <input
          id="party-label"
          name="label"
          type="text"
          defaultValue={label}
          maxLength={100}
          placeholder="np. sylwester, urodziny"
          onChange={() => setSaved(false)}
          className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-faint"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="party-starts" className="text-xs font-medium text-faint">
          Data i godzina
        </label>
        <input
          id="party-starts"
          name="starts_at_local"
          type="datetime-local"
          value={startsValue}
          onChange={(e) => {
            setStartsValue(e.target.value);
            setSaved(false);
          }}
          className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink"
        />
        {startsValue && (
          <p className="text-xs text-faint">
            <LocalDateTime iso={startsValue} />
          </p>
        )}
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="party-list-budget"
            className="text-xs font-medium text-faint"
          >
            Budżet – lista (zł)
          </label>
          <input
            id="party-list-budget"
            name="list_budget"
            type="number"
            min={1}
            max={10000}
            step={1}
            defaultValue={listBudget ?? ""}
            placeholder="np. 150"
            onChange={() => setSaved(false)}
            className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-faint"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="party-theme-budget"
            className="text-xs font-medium text-faint"
          >
            Budżet – temat (zł)
          </label>
          <input
            id="party-theme-budget"
            name="theme_budget"
            type="number"
            min={1}
            max={10000}
            step={1}
            defaultValue={themeBudget ?? ""}
            placeholder="np. 100"
            onChange={() => setSaved(false)}
            className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-faint"
          />
        </div>
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
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
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
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
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
