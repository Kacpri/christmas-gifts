"use client";

import { useEffect, useRef, useState, useActionState } from "react";

import {
  deleteMessage,
  editMessage,
  markThreadRead,
  sendMessage,
  type ActionResult,
} from "@/app/actions";
import {
  MessageBubble,
  type ChatMessage,
} from "@/components/message-bubble";
import { timeOf } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

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

function ChatBubbleIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-stone-300"
      aria-hidden
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function ChatSection({
  me,
  threads,
  lotteryDone,
  lateJoiner,
  onUnreadChange,
}: {
  me: string;
  threads: Thread[];
  lotteryDone: boolean;
  lateJoiner: boolean;
  onUnreadChange?: (total: number) => void;
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const allLastMine =
    threads.length > 1 &&
    threads.every((t) => {
      const msgs = messagesByThread[threadKey(t)] ?? [];
      const last = msgs[msgs.length - 1];
      return !last || last.senderId === me;
    });

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

  useEffect(() => {
    onUnreadChange?.(
      Object.values(unreadByThread).reduce((a, b) => a + b, 0)
    );
  }, [unreadByThread, onUnreadChange]);

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
    <>
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
                  className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                    selected === key
                      ? "border-[#165a32] bg-[#eaf5ee]"
                      : "border-stone-200 hover:bg-[#f3faf5]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{t.label}</span>
                    {unread > 0 && (
                      <span className="shrink-0 rounded-full bg-red-700 px-2 py-0.5 text-xs font-medium text-white">
                        {unread}
                      </span>
                    )}
                  </span>
                  {last && (
                    <span className="mt-1 flex items-center justify-between gap-2 text-[13px] text-[#777]">
                      <span className="truncate">
                        {last.deleted
                          ? "Wiadomość usunięta"
                          : `${
                              last.senderId === me && !allLastMine
                                ? "Ty: "
                                : ""
                            }${last.text}`}
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
                  {selectedMessages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      isOwn={m.senderId === me}
                      editAction={editMessage}
                      deleteAction={deleteMessage}
                    />
                  ))}
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
              <div className="grid h-96 place-items-center rounded-xl border border-dashed border-stone-200">
                <div className="flex flex-col items-center gap-3 text-center">
                  <ChatBubbleIcon />
                  <p className="text-sm text-stone-500">
                    Wybierz wątek, aby rozpocząć rozmowę.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {!state.ok && state.error && (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      )}
    </>
  );
}
