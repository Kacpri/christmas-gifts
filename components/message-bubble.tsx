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

const empty: ActionResult = { ok: false };

export type ChatMessage = {
  id: number;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
};

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
  editAction,
  deleteAction,
}: {
  message: ChatMessage;
  isOwn: boolean;
  editAction: (
    prev: ActionResult,
    formData: FormData
  ) => Promise<ActionResult>;
  deleteAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editState, editFormAction, editPending] = useActionState(
    editAction,
    empty
  );
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const touchTimer = useRef<number | null>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    const onScroll = () => setMenu(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu]);

  const canMenu = isOwn && !message.deleted && !editing;

  return (
    <>
      <div
        className={`max-w-[80%] select-none px-3.5 py-2.5 ${
          editing ? "min-w-48" : ""
        } ${
          isOwn
            ? "self-end rounded-[16px_16px_4px_16px] bg-accent text-white"
            : "self-start rounded-[16px_16px_16px_4px] bg-surface"
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
          <p
            className={`text-sm italic ${
              isOwn ? "text-white/70" : "text-placeholder"
            }`}
          >
            Wiadomość usunięta
          </p>
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
            <p className="whitespace-pre-wrap break-words text-sm">
              {renderMessageText(message.text)}
            </p>
            <p
              suppressHydrationWarning
              className={`mt-0.5 text-right text-[11px] ${
                isOwn ? "text-white/70" : "text-faint"
              }`}
            >
              {timeOf(message.createdAt)}
              {message.editedAt ? " · edytowano" : ""}
            </p>
          </>
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

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
