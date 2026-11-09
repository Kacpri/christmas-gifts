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
import { notify } from "@/lib/notify";
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

type DbMessage = {
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

type DbRead = {
  lottery_type: number;
  drawer_id: string;
  drawee_id: string;
  last_read_at: string;
};

function ChatBubbleIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 14L4 9l5-5" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

export function ChatSection({
  me,
  threads,
  lotteryDone,
  lateJoiner,
  collapsed,
  onUnreadChange,
}: {
  me: string;
  threads: Thread[];
  lotteryDone: boolean;
  lateJoiner: boolean;
  collapsed: boolean;
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
  const lastSentRef = useRef("");
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const threadsRef = useRef(threads);
  threadsRef.current = threads;

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
            if (key === selectedRef.current && !collapsedRef.current) {
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
              const t = threadsRef.current.find((x) => threadKey(x) === key);
              const who = t
                ? t.label.replace(/ — (lista|temat)$/, "")
                : "Nowa wiadomość";
              notify("Nowa wiadomość", who);
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
    if (!state.ok && state.error) {
      setValue((v) => v || lastSentRef.current);
    }
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
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [msgsRes, readsRes] = await Promise.all([
        supabase
          .from("messages")
          .select(
            "id, lottery_type, drawer_id, drawee_id, sender_id, text, created_at, edited_at, deleted_at"
          )
          .or(`drawer_id.eq.${me},drawee_id.eq.${me}`)
          .order("created_at"),
        supabase
          .from("thread_reads")
          .select("lottery_type, drawer_id, drawee_id, last_read_at")
          .eq("user_id", me),
      ]);
      if (cancelled) return;
      const dbMsgs = (msgsRes.data ?? []) as DbMessage[];
      const dbReads = (readsRes.data ?? []) as DbRead[];
      setMessagesByThread((prev) => {
        let changed = false;
        const next: Record<string, ChatMessage[]> = { ...prev };
        for (const t of threads) {
          const key = threadKey(t);
          const byId = new Map<number, ChatMessage>(
            (next[key] ?? []).map((m) => [m.id, m])
          );
          for (const m of dbMsgs) {
            if (`${m.lottery_type}-${m.drawer_id}-${m.drawee_id}` !== key)
              continue;
            const mapped: ChatMessage = {
              id: m.id,
              senderId: m.sender_id,
              text: m.text,
              createdAt: m.created_at,
              editedAt: m.edited_at,
              deleted: m.deleted_at != null,
            };
            const cur = byId.get(m.id);
            if (
              !cur ||
              cur.text !== mapped.text ||
              cur.editedAt !== mapped.editedAt ||
              cur.deleted !== mapped.deleted
            ) {
              byId.set(m.id, mapped);
              changed = true;
            }
          }
          next[key] = [...byId.values()].sort((a, b) => a.id - b.id);
        }
        return changed ? next : prev;
      });
      setUnreadByThread((prev) => {
        let changed = false;
        const next: Record<string, number> = { ...prev };
        for (const t of threads) {
          const key = threadKey(t);
          const read = dbReads.find(
            (r) =>
              r.lottery_type === t.lotteryType &&
              r.drawer_id === t.drawerId &&
              r.drawee_id === t.draweeId
          );
          const count = dbMsgs.filter(
            (m) =>
              `${m.lottery_type}-${m.drawer_id}-${m.drawee_id}` === key &&
              m.deleted_at == null &&
              m.sender_id !== me &&
              (!read || m.created_at > read.last_read_at)
          ).length;
          if (next[key] !== count) {
            next[key] = count;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [me, threads]);

  useEffect(() => {
    if (collapsed) return;
    const key = selectedRef.current;
    if (!key) return;
    const t = threadsRef.current.find((x) => threadKey(x) === key);
    if (!t) return;
    setUnreadByThread((prev) => ({ ...prev, [key]: 0 }));
    const fd = new FormData();
    fd.set("lottery_type", String(t.lotteryType));
    fd.set("drawer_id", t.drawerId);
    fd.set("drawee_id", t.draweeId);
    markThreadRead(fd);
  }, [collapsed]);

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
        <p className="mt-1 text-sm text-muted">
          {lateJoiner
            ? "Czaty są dostępne tylko dla uczestników losowania."
            : "Czaty pojawią się po losowaniu."}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-4 md:flex-row">
          <div className="flex flex-col gap-2 md:w-[250px]">
            {threads.map((t) => {
              const key = threadKey(t);
              const msgs = messagesByThread[key] ?? [];
              const last = msgs[msgs.length - 1];
              const unread = unreadByThread[key] ?? 0;
              const isList = t.lotteryType === 1;
              const who = t.label.replace(/ — (lista|temat)$/, "");
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openThread(t)}
                  aria-current={selected === key}
                  className={`w-full rounded-xl border border-l-4 p-[11px_14px] text-left text-sm transition-colors ${
                    selected === key
                      ? "border-line border-l-accent bg-sage-100"
                      : "border-line border-l-transparent hover:border-sage-300 hover:bg-sage-50"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-ink">{who}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-bold ${
                          isList
                            ? "bg-sage-200 text-list-ink"
                            : "bg-honey-200 text-honey-800"
                        }`}
                      >
                        {isList ? "lista" : "temat"}
                      </span>
                      {unread > 0 && (
                        <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                          {unread}
                        </span>
                      )}
                    </span>
                  </span>
                  {last && (
                    <span className="mt-[5px] flex items-center justify-between gap-2.5">
                      <span className="flex min-w-0 items-center gap-[5px] text-[13px] text-faint">
                        {last.senderId === me && !allLastMine && !last.deleted && (
                          <span className="shrink-0">
                            <ReplyIcon />
                          </span>
                        )}
                        <span className="truncate">
                          {last.deleted ? "Wiadomość usunięta" : last.text}
                        </span>
                      </span>
                      <span
                        suppressHydrationWarning
                        className="shrink-0 text-xs text-faint"
                      >
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
              <div className="flex h-96 flex-col overflow-hidden rounded-[14px] bg-mist">
                <div className="flex items-center gap-2.5 border-b border-line bg-surface px-4.5 py-3.5">
                  <span className="truncate text-[15px] font-bold text-accent">
                    {selectedThread.label.replace(/ — (lista|temat)$/, "")}
                  </span>
                  <span
                    className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-bold ${
                      selectedThread.lotteryType === 1
                        ? "bg-sage-200 text-list-ink"
                        : "bg-honey-200 text-honey-800"
                    }`}
                  >
                    {selectedThread.lotteryType === 1 ? "lista" : "temat"}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-4">
                  {selectedMessages.length === 0 && (
                    <p className="text-sm text-faint">
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
                  onSubmit={() => {
                    lastSentRef.current = value;
                    setValue("");
                  }}
                  className="flex items-center gap-2 border-t border-line bg-surface p-3"
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
                    className="h-11 min-w-0 flex-1 rounded-xl border border-input-line bg-input-bg px-3.5 text-sm text-ink placeholder:text-faint"
                  />
                  <button
                    type="submit"
                    disabled={pending || !value.trim()}
                    aria-label="Wyślij"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
                  >
                    <SendIcon />
                  </button>
                </form>
              </div>
            ) : (
              <div className="grid h-96 place-items-center rounded-[14px] bg-mist">
                <div className="flex flex-col items-center gap-3 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-sage-150 text-accent">
                    <ChatBubbleIcon />
                  </span>
                  <p className="max-w-[220px] text-sm leading-[1.45] text-muted">
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
