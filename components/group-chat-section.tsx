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
  clearGroupChat,
  deleteGroupMessage,
  editGroupMessage,
  sendGroupMessage,
  type ActionResult,
} from "@/app/actions";
import {
  ConfirmDialog,
  type ConfirmState,
} from "@/components/confirm-dialog";
import {
  DateSeparator,
  MessageBubble,
  dayKey,
  type ChatMessage,
} from "@/components/message-bubble";
import { notify } from "@/lib/notify";
import { chatPhotoUrl } from "@/lib/chat-photo";
import { applyReaction } from "@/lib/reactions";
import { createClient } from "@/lib/supabase/client";
import { usePhotoAttachment } from "@/lib/use-photo-attachment";
import { useMediaQuery } from "@/lib/use-media-query";

const empty: ActionResult = { ok: false };

export function GroupChatSection({
  me,
  messages,
  collapsed,
  isOrganizer,
  onUnreadChange,
}: {
  me: string;
  messages: ChatMessage[];
  collapsed: boolean;
  isOrganizer: boolean;
  onUnreadChange?: (total: number) => void;
}) {
  const [local, setLocal] = useState<ChatMessage[]>(messages);
  const [unread, setUnread] = useState(0);
  const [value, setValue] = useState("");
  const [state, sendAction, pending] = useActionState(sendGroupMessage, empty);
  const [clearState, clearAction, clearPending] = useActionState(
    clearGroupChat,
    empty
  );
  const photo = usePhotoAttachment();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const boxRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<number | null>(null);
  const firstRunRef = useRef(true);
  const prevCollapsedRef = useRef(collapsed);
  const prevDesktopRef = useRef(isDesktop);
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

  const photoClearRef = useRef(photo.clear);
  photoClearRef.current = photo.clear;

  useEffect(() => {
    if (state.ok) photoClearRef.current();
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
        .select(
          "id, sender_id, text, image_path, created_at, edited_at, deleted_at"
        )
        .order("created_at");
      if (cancelled || !data) return;
      setLocal((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        for (const m of data) {
          const cur = byId.get(m.id);
          byId.set(m.id, {
            id: m.id,
            senderId: m.sender_id,
            text: m.text,
            createdAt: m.created_at,
            editedAt: m.edited_at,
            deleted: m.deleted_at != null,
            imageUrl: m.image_path ? chatPhotoUrl(m.image_path) : null,
            reactions: cur?.reactions ?? [],
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
              image_path: string | null;
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
                    imageUrl: m.image_path ? chatPhotoUrl(m.image_path) : null,
                    reactions: [],
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
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "group_messages" },
          (payload) => {
            const m = payload.old as { id: number };
            setLocal((prev) => prev.filter((x) => x.id !== m.id));
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "group_message_reactions" },
          (payload) => {
            const r = payload.new as {
              message_id: number;
              user_id: string;
              emoji: string;
            };
            setLocal((prev) =>
              prev.some((x) => x.id === r.message_id)
                ? prev.map((x) =>
                    x.id === r.message_id
                      ? {
                          ...x,
                          reactions: applyReaction(
                            x.reactions,
                            r.emoji,
                            r.user_id,
                            true
                          ),
                        }
                      : x
                  )
                : prev
            );
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "group_message_reactions" },
          (payload) => {
            const r = payload.old as {
              message_id: number;
              user_id: string;
              emoji: string;
            };
            setLocal((prev) =>
              prev.some((x) => x.id === r.message_id)
                ? prev.map((x) =>
                    x.id === r.message_id
                      ? {
                          ...x,
                          reactions: applyReaction(
                            x.reactions,
                            r.emoji,
                            r.user_id,
                            false
                          ),
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
    const wasCollapsed = prevCollapsedRef.current;
    const wasDesktop = prevDesktopRef.current;
    prevCollapsedRef.current = collapsed;
    prevDesktopRef.current = isDesktop;
    if (collapsed || !isDesktop) return;
    const justExpanded = wasCollapsed && !collapsed;
    const justDesktop = !wasDesktop && isDesktop;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    const last = localRef.current[localRef.current.length - 1];
    if (
      firstRunRef.current ||
      justExpanded ||
      justDesktop ||
      atBottom ||
      last?.senderId === me
    ) {
      el.scrollTop = el.scrollHeight;
    }
    firstRunRef.current = false;
  }, [local.length, collapsed, isDesktop, me]);

  const nonDeleted = local.filter((m) => !m.deleted);
  const visible = isDesktop ? nonDeleted : nonDeleted.slice(-visibleCount);
  const hasOlder = !isDesktop && nonDeleted.length > visibleCount;

  function loadOlder() {
    anchorRef.current = document.documentElement.scrollHeight;
    setVisibleCount((c) => c + 20);
  }

  function toggleReaction(messageId: number, emoji: string) {
    const cur = local.find((m) => m.id === messageId);
    const add = !cur?.reactions.some(
      (r) => r.emoji === emoji && r.users.includes(me)
    );
    setLocal((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, reactions: applyReaction(m.reactions, emoji, me, add) }
          : m
      )
    );
    createClient()
      .rpc("toggle_message_reaction", {
        p_kind: 2,
        p_message_id: messageId,
        p_emoji: emoji,
      })
      .then(({ error }) => {
        if (error) {
          console.error("toggle_message_reaction (group):", error.message);
          setLocal((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    reactions: applyReaction(m.reactions, emoji, me, !add),
                  }
                : m
            )
          );
        }
      });
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--chat-header-sub)]">
          Anonimowy — nikt nie wie, kto co napisał.
        </p>
        {isOrganizer && (
          <button
            type="button"
            disabled={clearPending}
            onClick={() =>
              setConfirm({
                message:
                  "Wyczyścić czat wspólny? Wszystkie wiadomości zostaną usunięte.",
                confirmLabel: "Wyczyść",
                cancelLabel: "Wróć",
                tone: "danger",
                onConfirm: () => {
                  const fd = new FormData();
                  clearAction(fd);
                },
              })
            }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-danger hover:bg-[var(--chat-clear-hover)] disabled:opacity-50"
          >
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
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            {clearPending ? "Czyszczenie…" : "Wyczyść czat"}
          </button>
        )}
      </div>
      <div
        className={`mt-3 flex flex-col overflow-hidden rounded-[14px] bg-mist ${
          isDesktop ? "h-96" : ""
        }`}
      >
        <div
          ref={boxRef}
          className={`chat-scroll chat-fade relative z-1 flex flex-col px-3 py-4 ${
            isDesktop ? "flex-1 overflow-y-auto" : ""
          }`}
        >
          {hasOlder && (
            <button
              type="button"
              onClick={loadOlder}
              className="mx-auto mb-3 flex h-11 items-center justify-center rounded-full border border-input-line bg-surface px-4 text-sm font-medium text-muted hover:bg-mist"
            >
              Załaduj starsze
            </button>
          )}
          {visible.length === 0 && (
            <p className="text-sm text-faint">
              Brak wiadomości. Napisz pierwszą!
            </p>
          )}
          {visible.map((m, i) => {
            const prev = visible[i - 1];
            const sameDay =
              prev != null && dayKey(prev.createdAt) === dayKey(m.createdAt);
            return (
              <Fragment key={m.id}>
                {(!prev || !sameDay) && (
                  <DateSeparator createdAt={m.createdAt} />
                )}
                <div
                  className={`flex ${
                    m.senderId === me ? "justify-end" : "justify-start"
                  } ${
                    prev && sameDay
                      ? prev.senderId === m.senderId
                        ? "mt-2"
                        : "mt-3"
                      : ""
                  }`}
                >
                  <MessageBubble
                    message={m}
                    isOwn={m.senderId === me}
                    meId={me}
                    onToggleReaction={toggleReaction}
                    editAction={editGroupMessage}
                    deleteAction={deleteGroupMessage}
                  />
                </div>
              </Fragment>
            );
          })}
        </div>
        <form
          action={sendAction}
          onSubmit={(e) => {
            lastSentRef.current = value;
            setValue("");
            if (photo.file) {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("image", photo.file);
              sendAction(fd);
            }
          }}
          className="flex flex-col gap-2 bg-surface p-3"
        >
          {photo.previewUrl && (
            <span className="relative inline-block">
              <img
                src={photo.previewUrl}
                alt="Podgląd zdjęcia"
                className="h-16 w-16 rounded-[10px] border border-input-line object-cover"
              />
              <button
                type="button"
                onClick={photo.clear}
                aria-label="Usuń zdjęcie"
                className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[#14532d] text-xs font-bold text-white hover:bg-accent-deep dark:bg-accent"
              >
                ×
              </button>
            </span>
          )}
          {photo.error && (
            <p className="text-sm text-red-600">{photo.error}</p>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={photo.inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => photo.pick(e.target.files?.[0] ?? null)}
            />
            <input
              name="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={500}
              placeholder="Napisz wiadomość…"
              className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--chat-composer-line)] bg-surface px-3.5 text-sm text-ink placeholder:text-[var(--chat-placeholder)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532d]"
            />
            <button
              type="button"
              onClick={() => photo.inputRef.current?.click()}
              aria-label="Dodaj zdjęcie"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--chat-composer-line)] bg-surface text-ink hover:bg-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532d]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={pending || (!value.trim() && !photo.hasPhoto)}
              aria-label="Wyślij"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#14532d] text-white hover:bg-accent-deep disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150 dark:bg-accent dark:hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532d]"
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
          </div>
        </form>
      </div>
      {!state.ok && state.error && (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      )}
      {!clearState.ok && clearState.error && (
        <p className="mt-2 text-sm text-red-600">{clearState.error}</p>
      )}
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
