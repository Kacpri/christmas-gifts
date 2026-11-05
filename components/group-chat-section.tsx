"use client";

import { useEffect, useRef, useState, useActionState } from "react";

import {
  deleteGroupMessage,
  editGroupMessage,
  sendGroupMessage,
  type ActionResult,
} from "@/app/actions";
import {
  MessageBubble,
  type ChatMessage,
} from "@/components/message-bubble";
import { createClient } from "@/lib/supabase/client";

const empty: ActionResult = { ok: false };

export function GroupChatSection({
  me,
  open,
  messages,
}: {
  me: string;
  open: boolean;
  messages: ChatMessage[];
}) {
  const [local, setLocal] = useState<ChatMessage[]>(messages);
  const [value, setValue] = useState("");
  const [state, sendAction, pending] = useActionState(sendGroupMessage, empty);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.ok) setValue("");
  }, [state]);

  useEffect(() => {
    setLocal((prev) => {
      const prevIds = new Set(prev.map((m) => m.id));
      const missing = messages.filter((m) => !prevIds.has(m.id));
      if (missing.length === 0) return prev;
      return [...prev, ...missing].sort((a, b) => a.id - b.id);
    });
  }, [messages]);

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
        .channel("group-chat")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "group_messages" },
          (payload) => {
            const m = payload.new as {
              id: number;
              sender_id: string;
              text: string;
              created_at: string;
            };
            setLocal((prev) => {
              if (prev.some((x) => x.id === m.id)) return prev;
              return [
                ...prev,
                {
                  id: m.id,
                  senderId: m.sender_id,
                  text: m.text,
                  createdAt: m.created_at,
                  editedAt: null,
                  deleted: false,
                },
              ];
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "group_messages" },
          (payload) => {
            const m = payload.new as {
              id: number;
              text: string;
              edited_at: string | null;
              deleted_at: string | null;
            };
            setLocal((prev) =>
              prev.some((x) => x.id === m.id)
                ? prev.map((x) =>
                    x.id === m.id
                      ? {
                          ...x,
                          text: m.text,
                          editedAt: m.edited_at,
                          deleted: m.deleted_at != null,
                        }
                      : x
                  )
                : prev
            );
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [local.length]);

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-xl">Czat wspólny</h2>
      <p className="mt-0.5 text-xs text-stone-400">
        Anonimowy — nikt nie wie, kto co napisał.
      </p>
      {!open ? (
        <p className="mt-3 text-sm text-stone-500">
          Czat wspólny pojawi się po losowaniu.
        </p>
      ) : (
        <div className="mt-3 flex h-96 flex-col rounded-lg border border-stone-200">
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
            {local.length === 0 && (
              <p className="text-sm text-stone-400">
                Brak wiadomości. Napisz pierwszą!
              </p>
            )}
            {local.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                isOwn={m.senderId === me}
                editAction={editGroupMessage}
                deleteAction={deleteGroupMessage}
              />
            ))}
            <div ref={bottomRef} />
          </div>
          <form
            action={sendAction}
            className="flex gap-2 border-t border-stone-200 p-3"
          >
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
      )}
      {!state.ok && state.error && (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      )}
    </section>
  );
}
