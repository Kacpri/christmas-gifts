"use client";

import {
  useEffect,
  useRef,
  useState,
  useActionState,
  type ReactNode,
} from "react";

import { type ActionResult } from "@/app/actions";
import { ConfirmDialog, type ConfirmState } from "@/components/confirm-dialog";
import { timeOf } from "@/lib/format";
import { REACTION_EMOJIS, type ReactionGroup } from "@/lib/reactions";
import { useMediaQuery } from "@/lib/use-media-query";

const empty: ActionResult = { ok: false };

export type ChatMessage = {
  id: number;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  imageUrl: string | null;
  reactions: ReactionGroup[];
};

export const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function DateSeparator({ createdAt }: { createdAt: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date(createdAt);
    const now = new Date();
    const startOfDay = (x: Date) =>
      new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
    let text: string;
    if (diffDays <= 0) {
      text = "Dziś";
    } else if (diffDays === 1) {
      text = "Wczoraj";
    } else {
      const opts: Intl.DateTimeFormatOptions = {
        day: "numeric",
        month: "long",
      };
      if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
      text = d.toLocaleDateString("pl-PL", opts);
    }
    setLabel(text);
  }, [createdAt]);
  if (!label) return null;
  return (
    <div className="flex justify-center pt-2 pb-3" aria-hidden>
      <span className="rounded-full bg-[#dcebe1] px-2.5 py-1 text-xs font-medium leading-4 text-[#4a5c50] dark:bg-sage-200 dark:text-muted">
        {label}
      </span>
    </div>
  );
}

const URL_RE = /(https?:\/\/[^\s]+)/g;

function renderMessageText(text: string) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const idx = match.index ?? 0;
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <a
        key={`${idx}-${match[0]}`}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        {match[0]}
      </a>
    );
    last = idx + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MessageBubble({
  message,
  isOwn,
  meId,
  editAction,
  deleteAction,
  onToggleReaction,
}: {
  message: ChatMessage;
  isOwn: boolean;
  meId: string;
  editAction: (
    prev: ActionResult,
    formData: FormData
  ) => Promise<ActionResult>;
  deleteAction: (formData: FormData) => Promise<ActionResult>;
  onToggleReaction?: (messageId: number, emoji: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editState, editFormAction, editPending] = useActionState(
    editAction,
    empty
  );
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [picker, setPicker] = useState<{ x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const touchTimer = useRef<number | null>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (editing) editInputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (editState.ok) {
      setEditing(false);
      setEditValue("");
    }
  }, [editState]);

  useEffect(() => {
    if (!menu && !picker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setPicker(null);
      }
    };
    const onScroll = () => {
      setMenu(null);
      setPicker(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu, picker]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const canMenu = isOwn && !message.deleted && !editing;

  return (
    <>
      <div
        className={`flex max-w-[78%] flex-col ${
          isOwn ? "items-end" : "items-start"
        } ${editing ? "min-w-48" : ""}`}
      >
      <div
        className={`group w-full select-none px-[14px] pt-2.5 pb-2 ${
          isOwn
            ? "rounded-[16px_16px_6px_16px] bg-accent text-white"
            : "rounded-[16px_16px_16px_6px] border border-[var(--chat-bubble-border)] bg-surface"
        }`}
        onContextMenu={
          canMenu
            ? (e) => {
                if (
                  e.target instanceof HTMLElement &&
                  e.target.closest("a")
                ) {
                  return;
                }
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY });
              }
            : undefined
        }
        onTouchStart={
          canMenu
            ? (e) => {
                const t = e.touches[0];
                touchOrigin.current = { x: t.clientX, y: t.clientY };
                if (touchTimer.current != null) {
                  window.clearTimeout(touchTimer.current);
                }
                touchTimer.current = window.setTimeout(() => {
                  touchTimer.current = null;
                  setMenu({ x: t.clientX, y: t.clientY });
                }, 500);
              }
            : undefined
        }
        onTouchMove={
          canMenu
            ? (e) => {
                if (touchTimer.current == null || !touchOrigin.current) {
                  return;
                }
                const t = e.touches[0];
                const o = touchOrigin.current;
                if (
                  Math.abs(t.clientX - o.x) > 10 ||
                  Math.abs(t.clientY - o.y) > 10
                ) {
                  window.clearTimeout(touchTimer.current);
                  touchTimer.current = null;
                }
              }
            : undefined
        }
        onTouchEnd={
          canMenu
            ? () => {
                if (touchTimer.current != null) {
                  window.clearTimeout(touchTimer.current);
                  touchTimer.current = null;
                }
              }
            : undefined
        }
      >
        {message.deleted ? (
          <>
            <p
              className={`text-[15px] italic leading-5 ${
                isOwn ? "text-white/70" : "text-placeholder"
              }`}
            >
              Wiadomość usunięta
            </p>
            <p
              suppressHydrationWarning
              className={`mt-1 text-right text-xs tabular-nums ${
                isOwn ? "text-white/80" : "text-[var(--chat-time)]"
              }`}
            >
              {timeOf(message.createdAt)}
            </p>
          </>
        ) : editing ? (
          <form action={editFormAction} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={message.id} />
            <input
              ref={editInputRef}
              name="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              required
              maxLength={500}
              className="w-full rounded border border-input-line bg-surface px-2 py-1 text-sm text-ink"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={editPending || !editValue.trim()}
                className="text-[10px] font-medium underline disabled:opacity-50"
              >
                Zapisz
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-[10px] underline"
              >
                Anuluj
              </button>
              {!editState.ok && editState.error && (
                <span className="text-[10px] text-white/70">
                  {editState.error}
                </span>
              )}
            </div>
          </form>
        ) : (
          <>
            {message.imageUrl && (
              <button
                type="button"
                onClick={() => setLightbox(true)}
                aria-label="Powiększ zdjęcie"
                className="mb-1 block overflow-hidden rounded-lg"
              >
                <img
                  src={message.imageUrl}
                  alt=""
                  loading="lazy"
                  className="max-h-52 w-auto max-w-full"
                />
              </button>
            )}
            {message.text && (
              <p className="whitespace-pre-wrap break-words text-[15px] leading-5">
                {renderMessageText(message.text)}
              </p>
            )}
            <div className="mt-1 flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPicker({ x: e.clientX, y: e.clientY });
                }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                aria-label="Dodaj reakcję"
                title="Dodaj reakcję"
                className={`-my-1 flex h-6 w-6 items-center justify-center rounded ${
                  isOwn
                    ? "text-white/60 hover:text-white"
                    : "text-faint hover:text-ink"
                } ${
                  isDesktop
                    ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    : "opacity-100"
                }`}
              >
                <SmileyIcon />
              </button>
              <p
                suppressHydrationWarning
                className={`text-right text-xs tabular-nums ${
                  isOwn ? "text-white/80" : "text-[var(--chat-time)]"
                }`}
              >
                {timeOf(message.createdAt)}
                {message.editedAt ? " · edytowano" : ""}
              </p>
            </div>
          </>
        )}
      </div>
      {!message.deleted && !editing && message.reactions.length > 0 && (
        <div
          className={`-mt-2 flex flex-wrap gap-1.5 ${
            isOwn ? "mr-2.5" : "ml-2.5"
          }`}
        >
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onToggleReaction?.(message.id, r.emoji)}
              aria-label={`Reakcja ${r.emoji}: ${r.users.length}`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] leading-5 ${
                r.users.includes(meId)
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-[var(--chat-chip-border)] bg-[var(--chat-chip-bg)] text-[var(--chat-chip-ink)]"
              }`}
            >
              <span aria-hidden className="text-[15px] leading-none">
                {r.emoji}
              </span>
              <span className="tabular-nums">{r.users.length}</span>
            </button>
          ))}
        </div>
      )}
      </div>
      {menu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(null);
            }}
          />
          <div
            className="fixed z-50 min-w-28 overflow-hidden rounded-lg border border-line bg-surface py-1 text-sm shadow-lg"
            style={{
              left: Math.max(8, Math.min(menu.x, window.innerWidth - 128)),
              top: Math.max(8, Math.min(menu.y, window.innerHeight - 96)),
            }}
          >
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left hover:bg-sage-150"
              onClick={() => {
                setMenu(null);
                setEditValue(message.text);
                setEditing(true);
              }}
            >
              Edytuj
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setMenu(null);
                setConfirm({
                  message: "Usunąć wiadomość?",
                  confirmLabel: "Usuń",
                  tone: "danger",
                  onConfirm: () => deleteAction(fd),
                });
              }}
            >
              <input type="hidden" name="id" value={message.id} />
              <button
                type="submit"
                className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-sage-150"
              >
                Usuń
              </button>
            </form>
          </div>
        </>
      )}
      {picker && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setPicker(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setPicker(null);
            }}
          />
          <div
            className="fixed z-50 flex gap-0.5 rounded-full border border-line bg-surface p-1 shadow-lg"
            style={{
              left: Math.max(8, Math.min(picker.x, window.innerWidth - 224)),
              top: Math.max(8, Math.min(picker.y, window.innerHeight - 48)),
            }}
          >
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onToggleReaction?.(message.id, e);
                  setPicker(null);
                }}
                aria-label={`Reakcja ${e}`}
                className="grid h-8 w-8 place-items-center rounded-full text-lg hover:bg-mist"
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
      {lightbox && message.imageUrl && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(false)}
          role="presentation"
        >
          <img
            src={message.imageUrl}
            alt=""
            className="max-h-full max-w-full rounded-lg"
          />
        </div>
      )}

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function SmileyIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
    </svg>
  );
}
