"use client";

import {
  useEffect,
  useRef,
  useState,
  useActionState,
  type ReactNode,
} from "react";

import {
  deleteMessage,
  editMessage,
  markThreadRead,
  sendMessage,
  type ActionResult,
} from "@/app/actions";
import { createClient } from "@/lib/supabase/client";

export type ChatMessage = {
  id: number;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
};

export type Thread = {
  lotteryType: number;
  drawerId: string;
  draweeId: string;
  label: string;
  messages: ChatMessage[];
  unread: number;
};

const empty: ActionResult = { ok: false };

const threadKey = (t: {
  lotteryType: number;
  drawerId: string;
  draweeId: string;
}) => `${t.lotteryType}-${t.drawerId}-${t.draweeId}`;

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });

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

export function ChatSection({
  me,
  threads,
  lotteryDone,
  lateJoiner,
}: {
  me: string;
  threads: Thread[];
  lotteryDone: boolean;
  lateJoiner: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [messagesByThread, setMessagesByThread] = useState<
    Record<string, ChatMessage[]>
  >(() => Object.fromEntries(threads.map((t) => [threadKey(t), t.messages])));
  const [unreadByThread, setUnreadByThread] = useState<Record<string, number>>(
    () => Object.fromEntries(threads.map((t) => [threadKey(t), t.unread]))
  );
  const [value, setValue] = useState("");
  const [state, sendAction, pending] = useActionState(sendMessage, empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editState, editAction, editPending] = useActionState(
    editMessage,
    empty
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const selectedThread =
    threads.find((t) => threadKey(t) === selected) ?? null;
  const selectedMessages = selected
    ? (messagesByThread[selected] ?? [])
    : [];

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) return;
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (cancelled) return;
      channel = supabase
        .channel("chat-messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const m = payload.new as {
              id: number;
              lottery_type: number;
              drawer_id: string;
              drawee_id: string;
              sender_id: string;
              text: string;
              created_at: string;
            };
            const key = `${m.lottery_type}-${m.drawer_id}-${m.drawee_id}`;
            setMessagesByThread((prev) => {
              const list = prev[key];
              if (!list || list.some((x) => x.id === m.id)) return prev;
              return {
                ...prev,
                [key]: [
                  ...list,
                  {
                    id: m.id,
                    senderId: m.sender_id,
                    text: m.text,
                    createdAt: m.created_at,
                    editedAt: null,
                    deleted: false,
                  },
                ],
              };
            });
            if (m.sender_id === me) return;
            if (key === selectedRef.current) {
              setUnreadByThread((prev) => ({ ...prev, [key]: 0 }));
              const fd = new FormData();
              fd.set("lottery_type", String(m.lottery_type));
              fd.set("drawer_id", m.drawer_id);
              fd.set("drawee_id", m.drawee_id);
              markThreadRead(fd);
            } else {
              setUnreadByThread((prev) => ({
                ...prev,
                [key]: (prev[key] ?? 0) + 1,
              }));
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          (payload) => {
            const m = payload.new as {
              id: number;
              lottery_type: number;
              drawer_id: string;
              drawee_id: string;
              sender_id: string;
              text: string;
              created_at: string;
              edited_at: string | null;
              deleted_at: string | null;
            };
            const key = `${m.lottery_type}-${m.drawer_id}-${m.drawee_id}`;
            setMessagesByThread((prev) => {
              const list = prev[key];
              if (!list || !list.some((x) => x.id === m.id)) return prev;
              return {
                ...prev,
                [key]: list.map((x) =>
                  x.id === m.id
                    ? {
                        ...x,
                        text: m.text,
                        editedAt: m.edited_at,
                        deleted: m.deleted_at != null,
                      }
                    : x
                ),
              };
            });
            if (
              m.deleted_at != null &&
              m.sender_id !== me &&
              key !== selectedRef.current
            ) {
              setUnreadByThread((prev) => ({
                ...prev,
                [key]: Math.max(0, (prev[key] ?? 0) - 1),
              }));
            }
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [me]);

  useEffect(() => {
    if (state.ok) setValue("");
  }, [state]);

  useEffect(() => {
    if (editState.ok) setEditingId(null);
  }, [editState]);

  const [menu, setMenu] = useState<{
    messageId: number;
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const touchTimer = useRef<number | null>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId != null) editInputRef.current?.focus();
  }, [editingId]);

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

  useEffect(() => {
    setMessagesByThread((prev) => {
      let changed = false;
      const next: Record<string, ChatMessage[]> = {};
      for (const t of threads) {
        const key = threadKey(t);
        const existing = prev[key] ?? [];
        const existingIds = new Set(existing.map((m) => m.id));
        const missing = t.messages.filter((m) => !existingIds.has(m.id));
        if (missing.length > 0) {
          next[key] = [...existing, ...missing].sort((a, b) => a.id - b.id);
          changed = true;
        } else {
          next[key] = existing;
        }
      }
      return changed ? next : prev;
    });
  }, [threads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected, selectedMessages.length]);

  function openThread(t: Thread) {
    const key = threadKey(t);
    setSelected(key);
    setUnreadByThread((prev) => ({ ...prev, [key]: 0 }));
    const fd = new FormData();
    fd.set("lottery_type", String(t.lotteryType));
    fd.set("drawer_id", t.drawerId);
    fd.set("drawee_id", t.draweeId);
    markThreadRead(fd);
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Czaty</h2>
      {!lotteryDone ? (
        <p className="mt-1 text-sm text-stone-500">
          {lateJoiner
            ? "Czaty są dostępne tylko dla uczestników losowania."
            : "Czaty pojawią się po losowaniu."}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-4 md:flex-row">
          <div className="flex flex-col gap-2 md:w-72">
            {threads.map((t) => {
              const key = threadKey(t);
              const msgs = messagesByThread[key] ?? [];
              const last = msgs[msgs.length - 1];
              const unread = unreadByThread[key] ?? 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openThread(t)}
                  className={`rounded-lg border p-3 text-left text-sm hover:bg-stone-50 ${
                    selected === key
                      ? "border-red-300 bg-red-50"
                      : "border-stone-200"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t.label}</span>
                    {unread > 0 && (
                      <span className="rounded-full bg-red-700 px-2 py-0.5 text-xs font-medium text-white">
                        {unread}
                      </span>
                    )}
                  </span>
                  {last && (
                    <span className="mt-1 flex items-center justify-between gap-2 text-xs text-stone-500">
                      <span className="truncate">
                        {last.deleted
                          ? "Wiadomość usunięta"
                          : `${last.senderId === me ? "Ty: " : ""}${last.text}`}
                      </span>
                      <span suppressHydrationWarning className="shrink-0">
                        {timeOf(last.createdAt)}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="min-w-0 flex-1">
            {selectedThread ? (
              <div className="flex h-96 flex-col rounded-lg border border-stone-200">
                <div className="border-b border-stone-200 px-3 py-2 text-sm font-medium">
                  {selectedThread.label}
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                  {selectedMessages.length === 0 && (
                    <p className="text-sm text-stone-400">
                      Brak wiadomości. Napisz pierwszą!
                    </p>
                  )}
                  {selectedMessages.map((m) => {
                    const canMenu =
                      m.senderId === me && !m.deleted && editingId !== m.id;
                    return (
                      <div
                        key={m.id}
                        className={`max-w-[80%] select-none rounded-lg px-3 py-2 ${
                          editingId === m.id ? "min-w-48" : ""
                        } ${
                          m.senderId === me
                            ? "self-end bg-red-700 text-white"
                            : "self-start bg-stone-100"
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
                                setMenu({
                                  messageId: m.id,
                                  text: m.text,
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                              }
                            : undefined
                        }
                        onTouchStart={
                          canMenu
                            ? (e) => {
                                const t = e.touches[0];
                                touchOrigin.current = {
                                  x: t.clientX,
                                  y: t.clientY,
                                };
                                if (touchTimer.current != null) {
                                  window.clearTimeout(touchTimer.current);
                                }
                                touchTimer.current = window.setTimeout(
                                  () => {
                                    touchTimer.current = null;
                                    setMenu({
                                      messageId: m.id,
                                      text: m.text,
                                      x: t.clientX,
                                      y: t.clientY,
                                    });
                                  },
                                  500
                                );
                              }
                            : undefined
                        }
                        onTouchMove={
                          canMenu
                            ? (e) => {
                                if (
                                  touchTimer.current == null ||
                                  !touchOrigin.current
                                ) {
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
                      {m.deleted ? (
                        <p
                          className={`text-sm italic ${
                            m.senderId === me
                              ? "text-red-200"
                              : "text-stone-400"
                          }`}
                        >
                          Wiadomość usunięta
                        </p>
                      ) : editingId === m.id ? (
                        <form action={editAction} className="flex flex-col gap-2">
                          <input type="hidden" name="id" value={m.id} />
                          <input
                            ref={editInputRef}
                            name="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            required
                            maxLength={500}
                            className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900 focus:outline-none"
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
                              onClick={() => setEditingId(null)}
                              className="text-[10px] underline"
                            >
                              Anuluj
                            </button>
                            {!editState.ok && editState.error && (
                              <span className="text-[10px] text-red-200">
                                {editState.error}
                              </span>
                            )}
                          </div>
                        </form>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {renderMessageText(m.text)}
                          </p>
                          <p
                            suppressHydrationWarning
                            className={`mt-0.5 text-right text-[10px] ${
                              m.senderId === me
                                ? "text-red-200"
                                : "text-stone-400"
                            }`}
                          >
                            {timeOf(m.createdAt)}
                            {m.editedAt ? " · edytowano" : ""}
                          </p>
                        </>
                      )}
                    </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
                <form
                  action={sendAction}
                  className="flex gap-2 border-t border-stone-200 p-3"
                >
                  <input type="hidden" name="lottery_type" value={selectedThread.lotteryType} />
                  <input type="hidden" name="drawer_id" value={selectedThread.drawerId} />
                  <input type="hidden" name="drawee_id" value={selectedThread.draweeId} />
                  <input
                    name="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                    maxLength={500}
                    placeholder="Napisz wiadomość…"
                    className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={pending || !value.trim()}
                    className="shrink-0 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
                  >
                    {pending ? "…" : "Wyślij"}
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-stone-500">
                Wybierz wątek, aby rozpocząć rozmowę.
              </p>
            )}
          </div>
        </div>
      )}
      {!state.ok && state.error && (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      )}
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
            className="fixed z-50 min-w-28 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 text-sm shadow-lg"
            style={{
              left: Math.max(8, Math.min(menu.x, window.innerWidth - 128)),
              top: Math.max(8, Math.min(menu.y, window.innerHeight - 96)),
            }}
          >
            <button
              type="button"
              className="block w-full px-3 py-1.5 text-left hover:bg-stone-100"
              onClick={() => {
                const id = menu.messageId;
                const text = menu.text;
                setMenu(null);
                setEditingId(id);
                setEditValue(text);
              }}
            >
              Edytuj
            </button>
            <form
              action={(fd: FormData) => {
                deleteMessage(fd);
              }}
              onSubmit={(e) => {
                if (!window.confirm("Usunąć wiadomość?")) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={menu.messageId} />
              <button
                type="submit"
                onClick={() => setMenu(null)}
                className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-stone-100"
              >
                Usuń
              </button>
            </form>
          </div>
        </>
      )}
    </section>
  );
}
