"use client";

import { useActionState, useState } from "react";

import {
  cancelLottery,
  removeUser,
  runLottery,
  sendLotteryEmails,
  sendReadyReminders,
  setNameForUser,
  setReadyForUser,
  type ActionResult,
} from "@/app/actions";
import { ConfirmDialog, type ConfirmState } from "@/components/confirm-dialog";

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
  participants: {
    id: string;
    full_name: string;
    is_ready: boolean;
    has_theme: boolean;
    wish_count: number;
  }[];
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
  const [remindState, remindAction, remindPending] = useActionState(
    sendReadyReminders,
    empty
  );
  const [nameState, setNameAction, namePending] = useActionState(
    setNameForUser,
    empty
  );
  const [readyState, setReadyAction, readyPending] = useActionState(
    setReadyForUser,
    empty
  );
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [menuParticipant, setMenuParticipant] = useState<
    (typeof participants)[number] | null
  >(null);

  function startEditName(p: { id: string; full_name: string }) {
    setEditingNameId(p.id);
    setEditNameValue(p.full_name);
  }

  function toggleReady(p: {
    id: string;
    full_name: string;
    is_ready: boolean;
    has_theme: boolean;
    wish_count: number;
  }) {
    const fd = new FormData();
    fd.set("id", p.id);
    fd.set("is_ready", String(!p.is_ready));
    if (!p.is_ready) {
      const missing: string[] = [];
      if (!p.has_theme) missing.push("tematu");
      if (p.wish_count < 2) missing.push("min. 2 życzeń");
      if (missing.length > 0) {
        setConfirm({
          message: `${p.full_name} nie ma: ${missing.join(" i ")}. Oznaczyć jako gotowego mimo to?`,
          confirmLabel: "Oznacz mimo to",
          tone: "primary",
          onConfirm: () => setReadyAction(fd),
        });
        return;
      }
    }
    setReadyAction(fd);
  }

  const readyCount = participants.filter((p) => p.is_ready).length;
  const allReady =
    participants.length > 0 && participants.every((p) => p.is_ready);
  const notReadyNames = participants
    .filter((p) => !p.is_ready)
    .map((p) => p.full_name);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted">
          {participants.length}{" "}
          {plural(participants.length, ["osoba", "osoby", "osób"])} w losowaniu,{" "}
          {readyCount} {plural(readyCount, ["gotowa", "gotowe", "gotowych"])}.
          Losowanie wymaga minimum 3 osób.
        </p>
      </div>

      <form
        className="flex flex-col items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (lotteryDone) {
            setConfirm({
              message: "Powtórzyć losowanie? Obecne wyniki zostaną zastąpione.",
              confirmLabel: "Powtórz",
              tone: "danger",
              onConfirm: () => formAction(fd),
            });
            return;
          }
          formAction(fd);
        }}
      >
        <button
          type="submit"
          disabled={pending || !allReady}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
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
          <span className="text-xs text-muted">
            Czekamy na: {notReadyNames.join(", ")}
          </span>
        )}
      </form>
      {!state.ok && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      {!lotteryDone && notReadyNames.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setConfirm({
              message: `Wysłać przypomnienie mailem do: ${notReadyNames.join(
                ", "
              )}?`,
              confirmLabel: "Wyślij",
              tone: "primary",
              onConfirm: () => remindAction(fd),
            });
          }}
        >
          <button
            type="submit"
            disabled={remindPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-mist disabled:opacity-50"
          >
            {remindPending ? (
              <>
                <SpinnerIcon />
                Wysyłanie…
              </>
            ) : (
              `Wyślij przypomnienia (${notReadyNames.length})`
            )}
          </button>
        </form>
      )}
      {remindState.ok && (
        <p className="text-sm font-medium text-accent">Przypomnienia wysłane ✓</p>
      )}
      {!remindState.ok && remindState.error && (
        <p className="text-sm text-red-600">{remindState.error}</p>
      )}

      {lotteryDone && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setConfirm({
              message:
                "Anulować losowanie? Wyniki zostaną usunięte, a życzenia i tematy odblokowane.",
              confirmLabel: "Tak, anuluj",
              cancelLabel: "Wróć",
              tone: "danger",
              onConfirm: () => cancelAction(fd),
            });
          }}
        >
          <button
            type="submit"
            disabled={cancelPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {cancelPending ? (
              <>
                <SpinnerIcon />
                Anulowanie…
              </>
            ) : (
              "Anuluj losowanie"
            )}
          </button>
        </form>
      )}
      {!cancelState.ok && cancelState.error && (
        <p className="text-sm text-red-600">{cancelState.error}</p>
      )}

      {lotteryDone && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setConfirm({
              message:
                "Wysłać maile z wynikami losowania do wszystkich uczestników?",
              confirmLabel: "Wyślij",
              tone: "primary",
              onConfirm: () => emailAction(fd),
            });
          }}
        >
          <button
            type="submit"
            disabled={emailPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-mist disabled:opacity-50"
          >
            {emailPending ? (
              <>
                <SpinnerIcon />
                Wysyłanie…
              </>
            ) : (
              "Wyślij wyniki mailem"
            )}
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
        <h3 className="text-sm font-medium text-muted">Uczestnicy</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {participants.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-[10px] bg-mist px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {p.full_name}
                  </span>
                  <span
                    className={
                      p.is_ready
                        ? "shrink-0 text-xs font-medium text-accent"
                        : "shrink-0 text-xs text-faint"
                    }
                  >
                    {p.is_ready ? "gotowy" : "oczekuje"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuParticipant(p)}
                  aria-label={`Opcje: ${p.full_name}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-icon-hover"
                >
                  <MoreIcon />
                </button>
              </div>
              {editingNameId === p.id && (
                <form
                  action={(formData) => {
                    formData.set("id", p.id);
                    setNameAction(formData);
                  }}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <input
                    name="full_name"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    required
                    maxLength={100}
                    className="flex-1 rounded-lg border border-input-line bg-surface px-3 py-1.5 text-sm text-ink"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={namePending}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
                    >
                      {namePending ? "Zapisywanie…" : "Zapisz"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingNameId(null)}
                      disabled={namePending}
                      className="rounded-lg border border-input-line bg-surface px-3 py-1.5 text-xs font-medium hover:bg-mist disabled:opacity-50"
                    >
                      Anuluj
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
        {nameState.error && (
          <p className="mt-2 text-sm text-red-600">{nameState.error}</p>
        )}
        {readyState.error && (
          <p className="mt-2 text-sm text-red-600">{readyState.error}</p>
        )}
      </div>

      {lateJoiners.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted">
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
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    setConfirm({
                      message: `Usunąć ${p.full_name}?`,
                      confirmLabel: "Usuń",
                      tone: "danger",
                      onConfirm: () => removeUser(fd),
                    });
                  }}
                >
                  <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      aria-label="Usuń"
                      title="Usuń"
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
                    >
                      <TrashIcon />
                    </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {menuParticipant && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={() => setMenuParticipant(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-surface p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 truncate text-sm font-semibold text-ink">
              {menuParticipant.full_name}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  startEditName(menuParticipant);
                  setMenuParticipant(null);
                }}
                className="flex items-center gap-2 rounded-xl border border-input-line bg-mist px-4 py-2.5 text-sm font-medium text-ink hover:bg-icon-hover"
              >
                <PencilIcon />
                Edytuj
              </button>
              <button
                type="button"
                disabled={readyPending}
                onClick={() => {
                  toggleReady(menuParticipant);
                  setMenuParticipant(null);
                }}
                className="flex items-center gap-2 rounded-xl border border-input-line bg-mist px-4 py-2.5 text-sm font-medium text-ink hover:bg-icon-hover disabled:opacity-50"
              >
                {menuParticipant.is_ready ? <CheckSlashIcon /> : <CheckIcon />}
                {menuParticipant.is_ready
                  ? "Odznacz gotowego"
                  : "Oznacz gotowego"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = menuParticipant;
                  setMenuParticipant(null);
                  setConfirm({
                    message: `Usunąć ${target.full_name} z losowania?`,
                    confirmLabel: "Usuń",
                    tone: "danger",
                    onConfirm: () => {
                      const fd = new FormData();
                      fd.set("id", target.id);
                      removeUser(fd);
                    },
                  });
                }}
                className="flex items-center gap-2 rounded-xl border border-danger-soft bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger hover:opacity-80"
              >
                <TrashIcon />
                Usuń
              </button>
              <button
                type="button"
                onClick={() => setMenuParticipant(null)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted hover:bg-mist"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
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

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

function PencilIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
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

function CheckSlashIcon() {
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
      <path d="M9 11.5 11.5 14 16 9" />
      <path d="M12 22a10 10 0 1 0-9.92-11" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
