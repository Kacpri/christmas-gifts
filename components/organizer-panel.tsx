"use client";

import {
  useEffect,
  useActionState,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  cancelLottery,
  deleteErrorReport,
  removeUser,
  runLottery,
  savePanelVisibility,
  saveParty,
  savePartyBudgets,
  sendLotteryEmails,
  sendReadyReminders,
  setNameForUser,
  setReadyForUser,
  type ActionResult,
} from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { BottomSheet } from "@/components/bottom-sheet";
import { ConfirmDialog, type ConfirmState } from "@/components/confirm-dialog";
import { Presence } from "@/components/presence";
import { ToggleSwitch } from "@/components/toggle-switch";
import { declineName } from "@/lib/declension";
import { useMediaQuery } from "@/lib/use-media-query";

const empty: ActionResult = { ok: false };

const SECTIONS_KEY = "organizer-sections-v1";

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

const plural = (n: number, forms: [string, string, string]) => {
  if (n === 1) return forms[0];
  const d = n % 10;
  const h = n % 100;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return forms[1];
  return forms[2];
};

const PANEL_VISIBILITY_OPTIONS = [
  { id: "wishes", title: "Życzenia" },
  { id: "potrawy", title: "Potrawy" },
  { id: "children", title: "Dzieci" },
  { id: "group-chat", title: "Czat wspólny" },
] as const;

export function OrganizerPanel({
  participants,
  lateJoiners,
  lotteryDone,
  listBudget,
  themeBudget,
  errorReports,
  hiddenPanels,
  startsAt,
  location,
  notes,
  label,
}: {
  participants: {
    id: string;
    full_name: string;
    is_ready: boolean;
    gift_ready: boolean;
    has_theme: boolean;
    wish_count: number;
    theme_text: string | null;
    avatar_url: string | null;
  }[];
  lateJoiners: { id: string; full_name: string; avatar_url: string | null }[];
  lotteryDone: boolean;
  listBudget: number | null;
  themeBudget: number | null;
  errorReports: {
    id: number;
    description: string;
    full_name: string;
    created_at: string;
    screenshot_url: string | null;
    avatar_url: string | null;
  }[];
  hiddenPanels: string[];
  startsAt: string | null;
  location: string | null;
  notes: string | null;
  label: string;
}) {
  const [partyState, partyAction, partyPending] = useActionState(
    saveParty,
    empty
  );
  const [partySaved, setPartySaved] = useState(false);
  const [startsValue, setStartsValue] = useState(toLocalInput(startsAt));
  const [sectionCollapsed, setSectionCollapsed] = useState<
    Record<string, boolean>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(SECTIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      // localStorage niedostępny — ignoruj
    }
    return {};
  });
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
  const [budgetState, budgetAction, budgetPending] = useActionState(
    savePartyBudgets,
    empty
  );
  const [visibilityState, visibilityAction, visibilityPending] =
    useActionState(savePanelVisibility, empty);
  const [reportState, deleteReportAction, deleteReportPending] =
    useActionState(deleteErrorReport, empty);
  const [budgetSaved, setBudgetSaved] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [menuParticipant, setMenuParticipant] = useState<
    (typeof participants)[number] | null
  >(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (partyState.ok) setPartySaved(true);
  }, [partyState.ok]);

  useEffect(() => {
    if (budgetState.ok) setBudgetSaved(true);
  }, [budgetState]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SECTIONS_KEY,
        JSON.stringify(sectionCollapsed)
      );
    } catch {
      // localStorage niedostępny — ignoruj
    }
  }, [sectionCollapsed]);

  function toggleSection(id: string) {
    setSectionCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handlePartySubmit(e: FormEvent<HTMLFormElement>) {
    if (partyPending) {
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

  useEffect(() => {
    if (nameState.ok) setEditingNameId(null);
  }, [nameState]);

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
  const giftCount = participants.filter((p) => p.gift_ready).length;
  const allReady =
    participants.length > 0 && participants.every((p) => p.is_ready);
  const notReadyNames = participants
    .filter((p) => !p.is_ready)
    .map((p) => p.full_name);

  const menuActions = menuParticipant ? (
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
            message: `Usunąć ${declineName(target.full_name, "acc")} z losowania?`,
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
  ) : null;

  return (
    <div className="flex flex-col">
      <div className="pb-2">
        <p className="text-sm text-muted">
          {participants.length}{" "}
          {plural(participants.length, ["osoba", "osoby", "osób"])} w losowaniu,{" "}
          {readyCount} {plural(readyCount, ["gotowa", "gotowe", "gotowych"])}.
          Losowanie wymaga minimum 3 osób.
        </p>
        {lotteryDone && (
          <p className="mt-1 text-sm text-muted">
            Prezenty gotowe:{" "}
            <strong className="font-semibold text-ink">
              {giftCount} z {participants.length}
            </strong>
          </p>
        )}
      </div>

      <CollapsibleSection
        title="Szczegóły imprezy"
        collapsed={!!sectionCollapsed["party"]}
        onToggle={() => toggleSection("party")}
      >
        <form
          action={partyAction}
          className="flex flex-col gap-3"
          onSubmit={handlePartySubmit}
        >
          <input type="hidden" name="starts_at" defaultValue={startsAt ?? ""} />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="party-label"
              className="text-[13px] font-medium text-faint"
            >
              Do czego odliczamy?
            </label>
            <input
              id="party-label"
              name="label"
              type="text"
              defaultValue={label}
              maxLength={100}
              placeholder="np. sylwester, urodziny"
              autoComplete="off"
              onChange={() => setPartySaved(false)}
              className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-faint"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="party-starts"
              className="text-[13px] font-medium text-faint"
            >
              Data i godzina
            </label>
            <input
              id="party-starts"
              name="starts_at_local"
              type="datetime-local"
              value={startsValue}
              autoComplete="off"
              onChange={(e) => {
                setStartsValue(e.target.value);
                setPartySaved(false);
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
            <label
              htmlFor="party-location"
              className="text-[13px] font-medium text-faint"
            >
              Lokalizacja
            </label>
            <input
              id="party-location"
              name="location"
              type="text"
              defaultValue={location ?? ""}
              maxLength={200}
              placeholder="np. u Ani, ul. Świerkowa 12"
              autoComplete="off"
              onChange={() => setPartySaved(false)}
              className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-faint"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="party-notes"
              className="text-[13px] font-medium text-faint"
            >
              Notatki (opcjonalnie)
            </label>
            <textarea
              id="party-notes"
              name="notes"
              defaultValue={notes ?? ""}
              maxLength={1000}
              rows={3}
              placeholder="np. strój świąteczny, weź coś do picia"
              autoComplete="off"
              onChange={() => setPartySaved(false)}
              className="resize-y rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-faint"
            />
          </div>
          <button
            type="submit"
            disabled={partyPending || partySaved}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
          >
            {partyPending ? (
              <>
                <SpinnerIcon />
                Zapisywanie…
              </>
            ) : partySaved ? (
              <>
                <CheckIcon />
                Zapisano
              </>
            ) : (
              "Zapisz szczegóły"
            )}
          </button>
          {!partyState.ok && partyState.error && (
            <p className="text-sm text-red-600">{partyState.error}</p>
          )}
        </form>
      </CollapsibleSection>

      <CollapsibleSection
        title="Losowanie"
        collapsed={!!sectionCollapsed["lottery"]}
        onToggle={() => toggleSection("lottery")}
      >
      <div className={lotteryDone ? "grid gap-2 md:grid-cols-3" : undefined}>
        <form
          className="flex flex-col items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (lotteryDone) {
              setConfirm({
                message:
                  "Powtórzyć losowanie? Obecne wyniki zostaną zastąpione.",
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-danger-soft px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
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
      </div>
      {!state.ok && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {!cancelState.ok && cancelState.error && (
        <p className="text-sm text-red-600">{cancelState.error}</p>
      )}
      {emailState.ok && (
        <p className="text-sm font-medium text-accent">Maile wysłane ✓</p>
      )}
      {!emailState.ok && emailState.error && (
        <p className="text-sm text-red-600">{emailState.error}</p>
      )}
      </CollapsibleSection>

      {!lotteryDone && notReadyNames.length > 0 && (
        <CollapsibleSection
          title="Przypomnienia"
          collapsed={!!sectionCollapsed["reminders"]}
          onToggle={() => toggleSection("reminders")}
        >
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
        {remindState.ok && (
          <p className="mt-2 text-sm font-medium text-accent">
            Przypomnienia wysłane ✓
          </p>
        )}
        {!remindState.ok && remindState.error && (
          <p className="mt-2 text-sm text-red-600">{remindState.error}</p>
        )}
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Budżety"
        collapsed={!!sectionCollapsed["budgets"]}
        onToggle={() => toggleSection("budgets")}
      >
        <form
          action={(formData) => budgetAction(formData)}
          className="flex flex-col gap-2"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="org-list-budget"
                className="text-[13px] font-medium text-faint"
              >
                Budżet – lista (zł)
              </label>
              <input
                id="org-list-budget"
                name="list_budget"
                type="number"
                min={1}
                max={10000}
                step={1}
                defaultValue={listBudget ?? ""}
                placeholder="np. 150"
                autoComplete="off"
                onChange={() => setBudgetSaved(false)}
                className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-faint"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="org-theme-budget"
                className="text-[13px] font-medium text-faint"
              >
                Budżet – temat (zł)
              </label>
              <input
                id="org-theme-budget"
                name="theme_budget"
                type="number"
                min={1}
                max={10000}
                step={1}
                defaultValue={themeBudget ?? ""}
                placeholder="np. 100"
                autoComplete="off"
                onChange={() => setBudgetSaved(false)}
                className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-faint"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={budgetPending || budgetSaved}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
          >
            {budgetPending ? (
              <>
                <SpinnerIcon />
                Zapisywanie…
              </>
            ) : budgetSaved ? (
              <>
                <CheckIcon />
                Zapisano
              </>
            ) : (
              "Zapisz budżety"
            )}
          </button>
          {!budgetState.ok && budgetState.error && (
            <p className="text-sm text-red-600">{budgetState.error}</p>
          )}
        </form>
      </CollapsibleSection>

      <CollapsibleSection
        title="Widoczność paneli"
        collapsed={!!sectionCollapsed["visibility"]}
        onToggle={() => toggleSection("visibility")}
      >
        <p className="text-xs text-faint">
          Ukryte panele znikają u uczestników — u Ciebie zostają widoczne.
        </p>
        <div className="mt-2 flex flex-col gap-1">
          {PANEL_VISIBILITY_OPTIONS.map((opt) => {
            const hidden = hiddenPanels.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                disabled={visibilityPending}
                aria-pressed={!hidden}
                onClick={() => {
                  const next = hidden
                    ? hiddenPanels.filter((p) => p !== opt.id)
                    : [...hiddenPanels, opt.id];
                  const fd = new FormData();
                  fd.set("hidden", next.join(","));
                  visibilityAction(fd);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-mist disabled:opacity-50"
              >
                <span className="flex-1 text-sm font-medium text-ink">
                  {opt.title}
                </span>
                <ToggleSwitch on={!hidden} tone="light" />
              </button>
            );
          })}
        </div>
        {!visibilityState.ok && visibilityState.error && (
          <p className="mt-2 text-sm text-red-600">{visibilityState.error}</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Uczestnicy"
        collapsed={!!sectionCollapsed["participants"]}
        onToggle={() => toggleSection("participants")}
      >
        <ul className="flex flex-col gap-2">
          {participants.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-[10px] bg-mist px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={p.full_name} src={p.avatar_url} size={28} />
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
                    {lotteryDone && p.gift_ready && (
                      <span
                        className="shrink-0 text-accent"
                        title="Prezent gotowy"
                        aria-label="Prezent gotowy"
                      >
                        <GiftIcon />
                      </span>
                    )}
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
              <p className="truncate text-xs text-faint">
                Życzenia: {p.wish_count} · Temat: {p.theme_text ?? "brak"}
              </p>
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
      </CollapsibleSection>

      {lateJoiners.length > 0 && (
        <CollapsibleSection
          title="Dołączyli po losowaniu"
          collapsed={!!sectionCollapsed["lateJoiners"]}
          onToggle={() => toggleSection("lateJoiners")}
        >
          <ul className="flex flex-col gap-1">
            {lateJoiners.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar name={p.full_name} src={p.avatar_url} size={24} />
                  <span className="truncate">{p.full_name}</span>
                </span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    setConfirm({
                      message: `Usunąć ${declineName(p.full_name, "acc")}?`,
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
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Zgłoszenia błędów"
        collapsed={!!sectionCollapsed["reports"]}
        onToggle={() => toggleSection("reports")}
      >
        {errorReports.length === 0 ? (
          <p className="mt-2 text-sm text-faint">Brak zgłoszeń.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {errorReports.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 rounded-[10px] bg-mist px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 break-words text-sm text-ink">
                    {r.description}
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      setConfirm({
                        message: "Usunąć to zgłoszenie?",
                        confirmLabel: "Usuń",
                        tone: "danger",
                        onConfirm: () => deleteReportAction(fd),
                      });
                    }}
                  >
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      type="submit"
                      disabled={deleteReportPending}
                      aria-label="Usuń zgłoszenie"
                      title="Usuń"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-danger-soft disabled:opacity-50"
                    >
                      <TrashIcon />
                    </button>
                  </form>
                </div>
                {r.screenshot_url && (
                  <a
                    href={r.screenshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={r.screenshot_url}
                      alt="Zrzut ekranu do zgłoszenia"
                      className="max-h-40 w-auto rounded-lg border border-input-line"
                    />
                  </a>
                )}
                <p className="flex items-center gap-1.5 text-xs text-faint">
                  <Avatar name={r.full_name} src={r.avatar_url} size={18} />
                  {r.full_name} ·{" "}
                  {new Date(r.created_at).toLocaleString("pl-PL", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
        {!reportState.ok && reportState.error && (
          <p className="mt-2 text-sm text-red-600">{reportState.error}</p>
        )}
      </CollapsibleSection>

      {!isDesktop && (
        <BottomSheet
          open={!!menuParticipant}
          onClose={() => setMenuParticipant(null)}
          title={
            menuParticipant && (
              <span className="flex items-center gap-2">
                <Avatar
                  name={menuParticipant.full_name}
                  src={menuParticipant.avatar_url}
                  size={28}
                />
                <span className="min-w-0 truncate">
                  {menuParticipant.full_name}
                </span>
              </span>
            )
          }
          closeOnBackdrop
        >
          {menuActions}
        </BottomSheet>
      )}
      {isDesktop && (
        <Presence
          open={!!menuParticipant}
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          onClick={() => setMenuParticipant(null)}
          backdrop
          sheetClassName="relative w-full max-w-xs"
          sheetOnClick={(e) => e.stopPropagation()}
        >
          {menuParticipant && (
            <div className="rounded-2xl bg-surface p-4 shadow-lg">
              <div className="mb-3 flex items-center gap-2">
                <Avatar
                  name={menuParticipant.full_name}
                  src={menuParticipant.avatar_url}
                  size={28}
                />
                <p className="min-w-0 truncate text-sm font-semibold text-ink">
                  {menuParticipant.full_name}
                </p>
              </div>
              {menuActions}
            </div>
          )}
        </Presence>
      )}

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function CollapsibleSection({
  title,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const prevRef = useRef(collapsed);
  const [displayCollapsed, setDisplayCollapsed] = useState(collapsed);
  const [animH, setAnimH] = useState<number | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = collapsed;
    if (prev === collapsed) return;
    const wrap = wrapRef.current;
    if (
      !wrap ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setAnimH(null);
      setDisplayCollapsed(collapsed);
      return;
    }
    cancelAnimationFrame(rafRef.current);
    const from = wrap.getBoundingClientRect().height;
    const to = collapsed ? 0 : wrap.scrollHeight;
    if (from === to) {
      setAnimH(null);
      setDisplayCollapsed(collapsed);
      return;
    }
    const start = performance.now();
    const DURATION = 200;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const e = 1 - Math.pow(1 - t, 3);
      setAnimH(from + (to - from) * e);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setAnimH(null);
        setDisplayCollapsed(collapsed);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [collapsed]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <section className="border-t border-line">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="no-press-scale flex w-full select-none items-center justify-between gap-2 py-3 text-left"
        >
          <span className="text-sm font-medium text-muted">{title}</span>
          <span
            aria-hidden
            className={`shrink-0 text-muted transition-transform duration-200 ease-out motion-reduce:transition-none ${
              collapsed ? "rotate-0" : "rotate-180"
            }`}
          >
            <ChevronIcon />
          </span>
        </button>
      </h3>
      <div
        ref={wrapRef}
        style={{
          height:
            animH != null ? `${animH}px` : displayCollapsed ? "0px" : undefined,
          overflow: animH != null || displayCollapsed ? "hidden" : "visible",
          visibility:
            displayCollapsed && animH == null ? "hidden" : undefined,
        }}
      >
        <div className="pb-4">{children}</div>
      </div>
    </section>
  );
}

function ChevronIcon() {
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
      <path d="m6 9 6 6 6-6" />
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

function GiftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
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
