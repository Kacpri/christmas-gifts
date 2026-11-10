"use client";

import { useEffect, useMemo, useRef, useState, useActionState } from "react";

import {
  deleteDm,
  editDm,
  markDmRead,
  sendDm,
  type ActionResult,
} from "@/app/actions";
import {
  MessageBubble,
  type ChatMessage,
} from "@/components/message-bubble";
import { timeOf } from "@/lib/format";
import { notify } from "@/lib/notify";
import { createClient } from "@/lib/supabase/client";

export type DmThread = {
  peerId: string;
  label: string;
  messages: ChatMessage[];
  unread: number;
};

export type DmParticipant = {
  id: string;
  fullName: string;
};

const empty: ActionResult = { ok: false };

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function UserIcon() {
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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

export function DmSection({
  me,
  participants,
  dmThreads,
  collapsed,
  onUnreadChange,
}: {
  me: string;
  participants: DmParticipant[];
  dmThreads: DmThread[];
  collapsed: boolean;
  onUnreadChange?: (total: number) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [messagesByPeer, setMessagesByPeer] = useState<
    Record<string, ChatMessage[]>
  >(() => Object.fromEntries(dmThreads.map((t) => [t.peerId, t.messages])));
  const [unreadByPeer, setUnreadByPeer] = useState<Record<string, number>>(
    () => Object.fromEntries(dmThreads.map((t) => [t.peerId, t.unread]))
  );
  const [value, setValue] = useState("");
  const [state, sendAction, pending] = useActionState(sendDm, empty);
  const [pickerOpen, setPickerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef("");
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;

  const nameById = useMemo(
    () => new Map(participants.map((p) => [p.id, p.fullName])),
    [participants]
  );
  const nameByIdRef = useRef(nameById);
  nameByIdRef.current = nameById;

  const selectedThread =
    selected != null
      ? {
          peerId: selected,
          label: nameById.get(selected) ?? selected,
        }
      : null;
  const selectedMessages = selected
    ? (messagesByPeer[selected] ?? [])
    : [];

  const threadList = useMemo(() => {
    const list = [...dmThreads];
    if (selected && !list.some((t) => t.peerId === selected)) {
      list.push({
        peerId: selected,
        label: nameById.get(selected) ?? selected,
        messages: messagesByPeer[selected] ?? [],
        unread: unreadByPeer[selected] ?? 0,
      });
    }
    const lastOf = (peerId: string) => {
      const msgs = messagesByPeer[peerId] ?? [];
      return msgs.length ? msgs[msgs.length - 1].createdAt : "";
    };
    return list.sort((a, b) => {
      const la = lastOf(a.peerId);
      const lb = lastOf(b.peerId);
      if (la === lb) return a.label.localeCompare(b.label, "pl");
      return la < lb ? 1 : -1;
    });
  }, [dmThreads, selected, messagesByPeer, unreadByPeer, nameById]);

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
        .channel("dm-messages")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "dm_messages" },
          (payload) => {
            const m = payload.new as {
              id: number;
              sender_id: string;
              recipient_id: string;
              text: string;
              created_at: string;
            };
            const peer = m.sender_id === me ? m.recipient_id : m.sender_id;
            if (peer === me) return;
            setMessagesByPeer((prev) => {
              const list = prev[peer] ?? [];
              if (list.some((x) => x.id === m.id)) return prev;
              return {
                ...prev,
                [peer]: [
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
            if (peer === selectedRef.current && !collapsedRef.current) {
              setUnreadByPeer((prev) => ({ ...prev, [peer]: 0 }));
              const fd = new FormData();
              fd.set("peer_id", peer);
              markDmRead(fd);
            } else {
              setUnreadByPeer((prev) => ({
                ...prev,
                [peer]: (prev[peer] ?? 0) + 1,
              }));
              const who = nameByIdRef.current.get(peer) ?? "Nowa wiadomość";
              notify("Nowa wiadomość", who);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "dm_messages" },
          (payload) => {
            const m = payload.new as {
              id: number;
              sender_id: string;
              recipient_id: string;
              text: string;
              created_at: string;
              edited_at: string | null;
              deleted_at: string | null;
            };
            const peer = m.sender_id === me ? m.recipient_id : m.sender_id;
            if (peer === me) return;
            setMessagesByPeer((prev) => {
              const list = prev[peer] ?? [];
              if (!list.some((x) => x.id === m.id)) return prev;
              return {
                ...prev,
                [peer]: list.map((x) =>
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
    if (collapsed) return;
    const key = selectedRef.current;
    if (!key) return;
    setUnreadByPeer((prev) => ({ ...prev, [key]: 0 }));
    const fd = new FormData();
    fd.set("peer_id", key);
    markDmRead(fd);
  }, [collapsed]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected, selectedMessages.length]);

  useEffect(() => {
    onUnreadChange?.(
      Object.values(unreadByPeer).reduce((a, b) => a + b, 0)
    );
  }, [unreadByPeer, onUnreadChange]);

  function openThread(peerId: string) {
    setSelected(peerId);
    setUnreadByPeer((prev) => ({ ...prev, [peerId]: 0 }));
    const fd = new FormData();
    fd.set("peer_id", peerId);
    markDmRead(fd);
  }

  const others = participants.filter((p) => p.id !== me);

  return (
    <div className="mt-3 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-accent px-3.5 py-2 text-sm font-medium text-accent hover:bg-mist"
      >
        <PlusIcon />
        Nowy czat
      </button>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex flex-col gap-2 md:w-[250px]">
          {threadList.length === 0 && (
            <p className="text-sm text-faint">
              Jeszcze nie masz osobistych czatów.
            </p>
          )}
          {threadList.map((t) => {
            const msgs = messagesByPeer[t.peerId] ?? [];
            const last = msgs.length ? msgs[msgs.length - 1] : null;
            const unread = unreadByPeer[t.peerId] ?? 0;
            return (
              <button
                key={t.peerId}
                type="button"
                onClick={() => openThread(t.peerId)}
                aria-current={selected === t.peerId}
                className={`w-full rounded-xl border border-l-4 p-[11px_14px] text-left text-sm transition-colors ${
                  selected === t.peerId
                    ? "border-line border-l-accent bg-sage-100"
                    : "border-line border-l-transparent hover:border-sage-300 hover:bg-sage-50"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-ink">
                    {t.label}
                  </span>
                  {unread > 0 && (
                    <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </span>
                {last && (
                  <span className="mt-[5px] flex items-center justify-between gap-2.5">
                    <span className="min-w-0 truncate text-[13px] text-faint">
                      {last.deleted ? "Wiadomość usunięta" : last.text}
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
                  {selectedThread.label}
                </span>
                <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-sage-200 px-2 text-[11px] font-bold text-list-ink">
                  osobiste
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
                    editAction={editDm}
                    deleteAction={deleteDm}
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
                <input
                  type="hidden"
                  name="recipient_id"
                  value={selectedThread.peerId}
                />
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
                  <UserIcon />
                </span>
                <p className="max-w-[220px] text-sm leading-[1.45] text-muted">
                  Wybierz osobę, aby rozpocząć rozmowę.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {!state.ok && state.error && (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      )}

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-surface p-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 px-1 text-sm font-semibold text-ink">
              Nowy czat
            </p>
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {others.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    openThread(p.id);
                    setPickerOpen(false);
                  }}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-mist"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage-150 text-accent">
                    {p.fullName.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{p.fullName}</span>
                </button>
              ))}
              {others.length === 0 && (
                <p className="px-3 py-2 text-sm text-faint">
                  Brak innych uczestników.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-medium text-muted hover:bg-mist"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
