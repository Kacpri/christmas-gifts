"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useActionState,
} from "react";

import {
  deleteGroupMessage,
  editGroupMessage,
  sendGroupMessage,
  type ActionResult,
} from "@/app/actions";
import {
  DateSeparator,
  MessageBubble,
  dayKey,
  type ChatMessage,
} from "@/components/message-bubble";
import { notify } from "@/lib/notify";
import { createClient } from "@/lib/supabase/client";
import { useMediaQuery } from "@/lib/use-media-query";

const empty: ActionResult = { ok: false };

export function GroupChatSection({
  me,
  messages,
  collapsed,
  onUnreadChange,
}: {
  me: string;
  messages: ChatMessage[];
  collapsed: boolean;
  onUnreadChange?: (total: number) => void;
}) {
  const [local, setLocal] = useState<ChatMessage[]>(messages);
  const [unread, setUnread] = useState(0);
  const [value, setValue] = useState("");
  const [state, sendAction, pending] = useActionState(sendGroupMessage, empty);
  const [visibleCount, setVisibleCount] = useState(20);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const boxRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<number | null>(null);
  const firstRunRef = useRef(true);
  const prevCollapsedRef = useRef(collapsed);
  const lastSentRef = useRef("");
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const localRef = useRef(local);
  localRef.current = local;

  useEffect(() => {
    if (!state.ok && state.error) {
      setValue((v) => v || lastSentRef.current);
    }
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
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("group_messages")
        .select("id, sender_id, text, created_at, edited_at, deleted_at")
        .order("created_at");
      if (cancelled || !data) return;
      setLocal((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        for (const m of data) {
          byId.set(m.id, {
            id: m.id,
            senderId: m.sender_id,
            text: m.text,
            createdAt: m.created_at,
            editedAt: m.edited_at,
            deleted: m.deleted_at != null,
          });
        }
        return [...byId.values()].sort((a, b) => a.id - b.id);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!collapsed) setUnread(0);
  }, [collapsed]);

  useEffect(() => {
    onUnreadChange?.(unread);
  }, [unread, onUnreadChange]);

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
              if (
                !localRef.current.some((x) => x.id === m.id) &&
                m.sender_id !== me &&
                collapsedRef.current
              ) {
                setUnread((n) => n + 1);
              }
              if (m.sender_id !== me) {
                notify("Czat wspólny", "Nowa wiadomość w czacie wspólnym");
              }
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
  }, [me]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const justExpanded = prevCollapsedRef.current && !collapsed;
    prevCollapsedRef.current = collapsed;
    if (collapsed) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    const last = localRef.current[localRef.current.length - 1];
    if (
      firstRunRef.current ||
      justExpanded ||
      atBottom ||
      last?.senderId === me
    ) {
      el.scrollTop = el.scrollHeight;
    }
    firstRunRef.current = false;
  }, [local.length, collapsed, me]);

  const visible = isDesktop ? local : local.slice(-visibleCount);
  const hasOlder = !isDesktop && local.length > visibleCount;

  function loadOlder() {
    anchorRef.current = document.documentElement.scrollHeight;
    setVisibleCount((c) => c + 20);
  }

  useLayoutEffect(() => {
    const prev = anchorRef.current;
    if (prev == null) return;
    anchorRef.current = null;
    const delta = document.documentElement.scrollHeight - prev;
    if (delta > 0) window.scrollBy(0, delta);
  }, [visibleCount]);

  return (
    <>
      <p className="text-sm text-faint">
        Anonimowy — nikt nie wie, kto co napisał.
      </p>
      <div
        className={`mt-3 flex flex-col overflow-hidden rounded-[14px] bg-mist ${
          isDesktop ? "h-96" : ""
        }`}
      >
        <div
          ref={boxRef}
          className={`flex flex-col gap-1.5 p-4 ${
            isDesktop ? "flex-1 overflow-y-auto" : ""
          }`}
        >
          {hasOlder && (
            <button
              type="button"
              onClick={loadOlder}
              className="mx-auto flex h-11 items-center justify-center rounded-full border border-input-line bg-surface px-4 text-sm font-medium text-muted hover:bg-mist"
            >
              Załaduj starsze
            </button>
          )}
          {local.length === 0 && (
            <p className="text-sm text-faint">
              Brak wiadomości. Napisz pierwszą!
            </p>
          )}
          {visible.map((m, i) => {
            const prev = visible[i - 1];
            return (
              <Fragment key={m.id}>
                {(!prev ||
                  dayKey(prev.createdAt) !== dayKey(m.createdAt)) && (
                  <DateSeparator createdAt={m.createdAt} />
                )}
                <MessageBubble
                  message={m}
                  isOwn={m.senderId === me}
                  editAction={editGroupMessage}
                  deleteAction={deleteGroupMessage}
                />
              </Fragment>
            );
          })}
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
          </button>
        </form>
      </div>
      {!state.ok && state.error && (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      )}
    </>
  );
}
