"use client";

import { useEffect, useRef, useState, useActionState } from "react";

import {
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

export function ChatSection({
  me,
  threads,
  lotteryDone,
}: {
  me: string;
  threads: Thread[];
  lotteryDone: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [messagesByThread, setMessagesByThread] = useState<
    Record<string, ChatMessage[]>
  >(() => Object.fromEntries(threads.map((t) => [threadKey(t), t.messages])));
  const [unreadByThread, setUnreadByThread] = useState<Record<string, number>>(
    () => Object.fromEntries(threads.map((t) => [threadKey(t), t.unread]))
  );
  const [value, setValue] = useState("");
  const [rtStatus, setRtStatus] = useState("łączenie…");
  const [state, sendAction, pending] = useActionState(sendMessage, empty);
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
    const channel = supabase
      .channel("chat-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          console.log("[chat] realtime event", payload);
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
      .subscribe((status) => {
        setRtStatus(status);
        console.log("[chat] realtime status", status);
      });
    return () => {
      supabase.removeChannel(channel);
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Czaty</h2>
        <span className="text-xs text-stone-400">realtime: {rtStatus}</span>
      </div>
      {!lotteryDone ? (
        <p className="mt-1 text-sm text-stone-500">
          Czaty pojawią się po losowaniu.
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
                        {last.senderId === me ? "Ty: " : ""}
                        {last.text}
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
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        m.senderId === me
                          ? "self-end bg-red-700 text-white"
                          : "self-start bg-stone-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {m.text}
                      </p>
                      <p
                        suppressHydrationWarning
                        className={`mt-0.5 text-right text-[10px] ${
                          m.senderId === me ? "text-red-200" : "text-stone-400"
                        }`}
                      >
                        {timeOf(m.createdAt)}
                      </p>
                    </div>
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
    </section>
  );
}
