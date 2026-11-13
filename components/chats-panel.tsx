"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useActionState,
} from "react";

import {
  deleteDm,
  deleteMessage,
  editDm,
  editMessage,
  markDmRead,
  markThreadRead,
  sendDm,
  sendMessage,
  type ActionResult,
} from "@/app/actions";
import {
  DateSeparator,
  MessageBubble,
  dayKey,
  type ChatMessage,
} from "@/components/message-bubble";
import { Presence } from "@/components/presence";
import { listTimeOf, plural } from "@/lib/format";
import { notify } from "@/lib/notify";
import { createClient } from "@/lib/supabase/client";
import { useMediaQuery } from "@/lib/use-media-query";

export type Thread = {
  lotteryType: number;
  drawerId: string;
  draweeId: string;
  label: string;
  messages: ChatMessage[];
  unread: number;
};

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

const ltKey = (t: {
  lotteryType: number;
  drawerId: string;
  draweeId: string;
}) => `lt:${t.lotteryType}-${t.drawerId}-${t.draweeId}`;

const dmKey = (peerId: string) => `dm:${peerId}`;
const dmPeerOf = (key: string) => key.slice(3);

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

type Tag = "z listy" | "tematyczny" | "prywatny";

type ListItem = {
  key: string;
  name: string;
  tag: Tag;
  last: ChatMessage | null;
  unread: number;
  kind: "lottery" | "dm";
  lotteryType?: number;
  drawerId?: string;
  draweeId?: string;
  peerId?: string;
};

function tagClass(tag: Tag) {
  if (tag === "z listy") return "bg-sage-200 text-list-ink";
  if (tag === "tematyczny") return "bg-honey-200 text-honey-800";
  return "bg-sky-200 text-sky-800";
}

function TagPillIcon({ tag }: { tag: Tag }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (tag === "z listy") {
    return (
      <svg {...common}>
        <line x1="8" x2="21" y1="6" y2="6" />
        <line x1="8" x2="21" y1="12" y2="12" />
        <line x1="8" x2="21" y1="18" y2="18" />
        <line x1="3" x2="3.01" y1="6" y2="6" />
        <line x1="3" x2="3.01" y1="12" y2="12" />
        <line x1="3" x2="3.01" y1="18" y2="18" />
      </svg>
    );
  }
  if (tag === "tematyczny") {
    return (
      <svg {...common}>
        <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
        <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function TagPill({ tag }: { tag: Tag }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-bold leading-4 ${tagClass(tag)}`}
    >
      <TagPillIcon tag={tag} />
      {tag}
    </span>
  );
}

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

function ArrowLeftIcon() {
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
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

export function ChatsPanel({
  me,
  threads,
  lotteryDone,
  lateJoiner,
  collapsed,
  participants,
  dmThreads,
  onUnreadChange,
  narrow = false,
}: {
  me: string;
  threads: Thread[];
  lotteryDone: boolean;
  lateJoiner: boolean;
  collapsed: boolean;
  participants: DmParticipant[];
  dmThreads: DmThread[];
  onUnreadChange?: (total: number) => void;
  narrow?: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [lotteryMsgs, setLotteryMsgs] = useState<
    Record<string, ChatMessage[]>
  >(() => Object.fromEntries(threads.map((t) => [ltKey(t), t.messages])));
  const [dmMsgs, setDmMsgs] = useState<Record<string, ChatMessage[]>>(
    () => Object.fromEntries(dmThreads.map((t) => [t.peerId, t.messages]))
  );
  const [lotteryUnread, setLotteryUnread] = useState<Record<string, number>>(
    () => Object.fromEntries(threads.map((t) => [ltKey(t), t.unread]))
  );
  const [dmUnread, setDmUnread] = useState<Record<string, number>>(
    () => Object.fromEntries(dmThreads.map((t) => [t.peerId, t.unread]))
  );
  const [value, setValue] = useState("");
  const [lotteryState, lotterySend, lotteryPending] = useActionState(
    sendMessage,
    empty
  );
  const [dmState, dmSend, dmPending] = useActionState(sendDm, empty);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [listFade, setListFade] = useState(false);
  const [listExpanded, setListExpanded] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const useMobileLayout = !isDesktop || narrow;
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef("");
  const selectedRef = useRef(selectedKey);
  selectedRef.current = selectedKey;
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const threadsRef = useRef(threads);
  threadsRef.current = threads;

  const nameById = useMemo(
    () => new Map(participants.map((p) => [p.id, p.fullName])),
    [participants]
  );
  const nameByIdRef = useRef(nameById);
  nameByIdRef.current = nameById;

  const listItems = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    if (lotteryDone) {
      for (const t of threads) {
        const key = ltKey(t);
        const msgs = lotteryMsgs[key] ?? [];
        const last = msgs.length ? msgs[msgs.length - 1] : null;
        items.push({
          key,
          name: t.label.replace(/ — (z listy|tematyczny)$/, ""),
          tag: t.lotteryType === 1 ? "z listy" : "tematyczny",
          last,
          unread: lotteryUnread[key] ?? 0,
          kind: "lottery",
          lotteryType: t.lotteryType,
          drawerId: t.drawerId,
          draweeId: t.draweeId,
        });
      }
    }
    const peerIds = new Set(dmThreads.map((t) => t.peerId));
    if (selectedKey?.startsWith("dm:")) peerIds.add(dmPeerOf(selectedKey));
    for (const peerId of peerIds) {
      const msgs = dmMsgs[peerId] ?? [];
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      items.push({
        key: dmKey(peerId),
        name: nameById.get(peerId) ?? peerId,
        tag: "prywatny",
        last,
        unread: dmUnread[peerId] ?? 0,
        kind: "dm",
        peerId,
      });
    }
    return items.sort((a, b) => {
      const la = a.last?.createdAt ?? "";
      const lb = b.last?.createdAt ?? "";
      if (la === lb) return a.name.localeCompare(b.name, "pl");
      return la < lb ? 1 : -1;
    });
  }, [
    lotteryDone,
    threads,
    dmThreads,
    selectedKey,
    lotteryMsgs,
    dmMsgs,
    lotteryUnread,
    dmUnread,
    nameById,
  ]);

  const updateListFade = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const canScroll = el.scrollHeight > el.clientHeight;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 4;
    setListFade(canScroll && !atBottom);
  }, []);

  useEffect(() => {
    updateListFade();
  }, [listItems, updateListFade]);

  const latestActivity = useMemo(() => {
    let max = "";
    for (const item of listItems) {
      const t = item.last?.createdAt ?? "";
      if (t > max) max = t;
    }
    return max;
  }, [listItems]);

  const prevLatestRef = useRef(latestActivity);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isNew = latestActivity > prevLatestRef.current;
    prevLatestRef.current = latestActivity;
    if (!isNew || el.scrollTop <= 0) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, [latestActivity]);

  const selectedItem = useMemo(() => {
    if (!selectedKey) return null;
    if (selectedKey.startsWith("dm:")) {
      const peerId = dmPeerOf(selectedKey);
      return {
        kind: "dm" as const,
        key: selectedKey,
        name: nameById.get(peerId) ?? peerId,
        tag: "prywatny" as Tag,
        peerId,
        messages: dmMsgs[peerId] ?? [],
      };
    }
    const t = threads.find((x) => ltKey(x) === selectedKey);
    if (!t) return null;
    return {
      kind: "lottery" as const,
      key: selectedKey,
      name: t.label.replace(/ — (z listy|tematyczny)$/, ""),
      tag: (t.lotteryType === 1 ? "z listy" : "tematyczny") as Tag,
      lotteryType: t.lotteryType,
      drawerId: t.drawerId,
      draweeId: t.draweeId,
      messages: lotteryMsgs[selectedKey] ?? [],
    };
  }, [selectedKey, threads, dmMsgs, lotteryMsgs, nameById]);

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
            const key = `lt:${m.lottery_type}-${m.drawer_id}-${m.drawee_id}`;
            setLotteryMsgs((prev) => {
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
              setLotteryUnread((prev) => ({ ...prev, [key]: 0 }));
              const fd = new FormData();
              fd.set("lottery_type", String(m.lottery_type));
              fd.set("drawer_id", m.drawer_id);
              fd.set("drawee_id", m.drawee_id);
              markThreadRead(fd);
            } else {
              setLotteryUnread((prev) => ({
                ...prev,
                [key]: (prev[key] ?? 0) + 1,
              }));
              const t = threadsRef.current.find((x) => ltKey(x) === key);
              const who = t
                ? t.label.replace(/ — (z listy|tematyczny)$/, "")
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
            const key = `lt:${m.lottery_type}-${m.drawer_id}-${m.drawee_id}`;
            setLotteryMsgs((prev) => {
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
              setLotteryUnread((prev) => ({
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
            setDmMsgs((prev) => {
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
            if (dmKey(peer) === selectedRef.current && !collapsedRef.current) {
              setDmUnread((prev) => ({ ...prev, [peer]: 0 }));
              const fd = new FormData();
              fd.set("peer_id", peer);
              markDmRead(fd);
            } else {
              setDmUnread((prev) => ({
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
            setDmMsgs((prev) => {
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
    if (!lotteryState.ok && lotteryState.error) {
      setValue((v) => v || lastSentRef.current);
    }
  }, [lotteryState]);

  useEffect(() => {
    if (!dmState.ok && dmState.error) {
      setValue((v) => v || lastSentRef.current);
    }
  }, [dmState]);

  useEffect(() => {
    setLotteryMsgs((prev) => {
      let changed = false;
      const next: Record<string, ChatMessage[]> = {};
      for (const t of threads) {
        const key = ltKey(t);
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
      setLotteryMsgs((prev) => {
        let changed = false;
        const next: Record<string, ChatMessage[]> = { ...prev };
        for (const t of threads) {
          const key = ltKey(t);
          const byId = new Map<number, ChatMessage>(
            (next[key] ?? []).map((m) => [m.id, m])
          );
          for (const m of dbMsgs) {
            if (`${m.lottery_type}-${m.drawer_id}-${m.drawee_id}` !== key.slice(3))
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
      setLotteryUnread((prev) => {
        let changed = false;
        const next: Record<string, number> = { ...prev };
        for (const t of threads) {
          const key = ltKey(t);
          const read = dbReads.find(
            (r) =>
              r.lottery_type === t.lotteryType &&
              r.drawer_id === t.drawerId &&
              r.drawee_id === t.draweeId
          );
          const count = dbMsgs.filter(
            (m) =>
              `${m.lottery_type}-${m.drawer_id}-${m.drawee_id}` ===
                key.slice(3) &&
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
    if (key.startsWith("dm:")) {
      const peerId = dmPeerOf(key);
      setDmUnread((prev) => ({ ...prev, [peerId]: 0 }));
      const fd = new FormData();
      fd.set("peer_id", peerId);
      markDmRead(fd);
    } else {
      const t = threadsRef.current.find((x) => ltKey(x) === key);
      if (!t) return;
      setLotteryUnread((prev) => ({ ...prev, [key]: 0 }));
      const fd = new FormData();
      fd.set("lottery_type", String(t.lotteryType));
      fd.set("drawer_id", t.drawerId);
      fd.set("drawee_id", t.draweeId);
      markThreadRead(fd);
    }
  }, [collapsed]);

  const prevKeyRef = useRef(selectedKey);
  const prevLenRef = useRef(selectedItem?.messages.length ?? 0);
  const prevCollapsedRef = useRef(collapsed);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !selectedItem) return;
    const justExpanded = prevCollapsedRef.current && !collapsed;
    prevCollapsedRef.current = collapsed;
    if (collapsed) return;
    const len = selectedItem.messages.length;
    const keyChanged = prevKeyRef.current !== selectedKey;
    const lenChanged = prevLenRef.current !== len;
    prevKeyRef.current = selectedKey;
    prevLenRef.current = len;
    if (!keyChanged && !lenChanged && !justExpanded) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    const last = selectedItem.messages[len - 1];
    if (keyChanged || justExpanded || atBottom || last?.senderId === me) {
      el.scrollTop = el.scrollHeight;
    }
  }, [selectedKey, selectedItem?.messages.length, selectedItem, me, collapsed]);

  useEffect(() => {
    const total =
      Object.values(lotteryUnread).reduce((a, b) => a + b, 0) +
      Object.values(dmUnread).reduce((a, b) => a + b, 0);
    onUnreadChange?.(total);
  }, [lotteryUnread, dmUnread, onUnreadChange]);

  function openLottery(t: Thread) {
    const key = ltKey(t);
    setSelectedKey(key);
    setLotteryUnread((prev) => ({ ...prev, [key]: 0 }));
    const fd = new FormData();
    fd.set("lottery_type", String(t.lotteryType));
    fd.set("drawer_id", t.drawerId);
    fd.set("drawee_id", t.draweeId);
    markThreadRead(fd);
  }

  function openDm(peerId: string) {
    const key = dmKey(peerId);
    setSelectedKey(key);
    setDmUnread((prev) => ({ ...prev, [peerId]: 0 }));
    const fd = new FormData();
    fd.set("peer_id", peerId);
    markDmRead(fd);
  }

  if (lateJoiner) {
    return (
      <p className="mt-1 text-sm text-muted">
        Czaty są dostępne tylko dla uczestników losowania.
      </p>
    );
  }

  if (!lotteryDone && dmThreads.length === 0) {
    return (
      <p className="mt-1 text-sm text-muted">
        Czaty pojawią się po losowaniu.
      </p>
    );
  }

  const others = participants.filter((p) => p.id !== me);
  const isDm = selectedItem?.kind === "dm";
  const pending = isDm ? dmPending : lotteryPending;
  const visibleListItems =
    isDesktop || listExpanded ? listItems : listItems.slice(0, 5);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`mt-3 flex flex-col gap-4 ${
          !useMobileLayout ? "flex-row" : ""
        }`}
      >
        {(!useMobileLayout || !selectedItem) && (
        <div
          className={`flex flex-col gap-3 ${
            isDesktop ? "h-96 pb-3" : ""
          } ${!useMobileLayout ? "w-72" : ""}`}
        >
          <div className="relative min-h-0 flex-1">
            <div
              ref={listRef}
              onScroll={updateListFade}
              className={`flex flex-col gap-2 pr-0.5 ${
                isDesktop ? "h-full overflow-y-auto" : ""
              }`}
            >
            {visibleListItems.length === 0 && (
              <p className="text-sm text-faint">Brak czatów.</p>
            )}
            {visibleListItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  item.kind === "dm"
                    ? openDm(item.peerId!)
                    : openLottery(
                        threads.find((x) => ltKey(x) === item.key)!
                      )
                }
                aria-current={selectedKey === item.key}
                className={`w-full shrink-0 rounded-[14px] border p-3 px-3.5 text-left transition-colors ${
                  selectedKey === item.key
                    ? "border-[#b9d4c1] bg-[#e3efe7] shadow-[inset_3px_0_0_#14532d] dark:border-line dark:bg-sage-100 dark:shadow-[inset_3px_0_0_var(--color-accent)]"
                    : "border-[#dfe9e2] bg-surface hover:bg-sage-50 dark:border-line"
                }`}
              >
                <span className="flex items-center justify-between gap-2 leading-5">
                  <span
                    className={`min-w-0 truncate text-base text-ink ${
                      item.unread > 0
                        ? "font-bold"
                        : selectedKey === item.key
                          ? "font-semibold"
                          : "font-medium"
                    }`}
                  >
                    {item.name}
                  </span>
                  {item.last && (
                    <span
                      suppressHydrationWarning
                      className="shrink-0 text-xs tabular-nums text-[#4a5c50] dark:text-muted"
                    >
                      {listTimeOf(item.last.createdAt)}
                    </span>
                  )}
                </span>
                <span className="mt-1 flex min-h-6 items-center gap-2">
                  <TagPill tag={item.tag} />
                  {item.last ? (
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${
                        item.last.deleted
                          ? "italic text-faint"
                          : item.unread > 0
                            ? "font-semibold text-[#4a5c50] dark:text-muted"
                            : "text-[#4a5c50] dark:text-muted"
                      }`}
                    >
                      {item.last.deleted
                        ? "Wiadomość usunięta"
                        : `${item.last.senderId === me ? "Ty: " : ""}${item.last.text}`}
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm text-faint">
                      Brak wiadomości
                    </span>
                  )}
                  {item.unread > 0 && (
                    <span
                      aria-label={`${item.unread} ${plural(item.unread, [
                        "nieprzeczytana wiadomość",
                        "nieprzeczytane wiadomości",
                        "nieprzeczytanych wiadomości",
                      ])}`}
                      className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#14532d] px-1.5 text-xs font-bold text-white dark:bg-accent"
                    >
                      {item.unread}
                    </span>
                  )}
                </span>
              </button>
            ))}
            </div>
            {listFade && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-surface to-transparent"
              />
            )}
          </div>
          {!isDesktop && listItems.length > 5 && (
            <button
              type="button"
              onClick={() => setListExpanded(!listExpanded)}
              className="flex h-11 w-full items-center justify-center rounded-[14px] border border-input-line bg-surface text-sm font-medium text-ink hover:bg-mist"
            >
              {listExpanded
                ? "Zwiń"
                : `Pokaż wszystkie (${listItems.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[#14532d] bg-surface text-base font-semibold text-[#14532d] hover:bg-mist dark:border-accent dark:text-accent"
          >
            <PlusIcon />
            Nowy czat
          </button>
        </div>
        )}

        {(!useMobileLayout || selectedItem) && (
        <div
          className={`flex min-w-0 flex-1 flex-col gap-3 pb-3 ${
            useMobileLayout ? "h-[440px]" : "h-96"
          }`}
        >
          {selectedItem ? (
            <>
              <div className="flex min-h-11 flex-col justify-center gap-0.5 px-1">
                <div className="flex items-center gap-2">
                  {useMobileLayout && (
                    <button
                      type="button"
                      onClick={() => setSelectedKey(null)}
                      aria-label="Wróć do listy czatów"
                      className="-ml-2 flex h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-muted hover:bg-mist"
                    >
                      <ArrowLeftIcon />
                      Wróć
                    </button>
                  )}
                  <span className="min-w-0 truncate text-xl font-bold text-[#0f3d24] dark:text-[#7cc99a]">
                    {selectedItem.name}
                  </span>
                  <TagPill tag={selectedItem.tag} />
                </div>
                {selectedItem.kind === "lottery" &&
                  selectedItem.name === "Tajemniczy Mikołaj" && (
                    <p className="text-sm text-[#4a5c50] dark:text-muted">
                      Ta osoba kupuje Ci prezent. Nie wiesz, kim jest.
                    </p>
                  )}
              </div>
              <div
                ref={boxRef}
                className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[14px] bg-[#eef5f0] p-4 dark:bg-sage-100"
              >
                <div className="mt-auto flex flex-col gap-2">
                  {selectedItem.messages.length === 0 && (
                    <p className="text-sm text-faint">
                      Brak wiadomości. Napisz pierwszą!
                    </p>
                  )}
                {selectedItem.messages.map((m, i) => {
                  const prev = selectedItem.messages[i - 1];
                  return (
                    <Fragment key={m.id}>
                      {(!prev ||
                        dayKey(prev.createdAt) !== dayKey(m.createdAt)) && (
                        <DateSeparator createdAt={m.createdAt} />
                      )}
                      <MessageBubble
                        message={m}
                        isOwn={m.senderId === me}
                        editAction={isDm ? editDm : editMessage}
                        deleteAction={isDm ? deleteDm : deleteMessage}
                      />
                    </Fragment>
                  );
                })}
                  </div>
                </div>
                <form
                  action={isDm ? dmSend : lotterySend}
                  onSubmit={() => {
                    lastSentRef.current = value;
                    setValue("");
                  }}
                  className="flex gap-3"
                >
                {isDm ? (
                  <input
                    type="hidden"
                    name="recipient_id"
                    value={selectedItem.peerId}
                  />
                ) : (
                  <>
                    <input
                      type="hidden"
                      name="lottery_type"
                      value={selectedItem.lotteryType}
                    />
                    <input
                      type="hidden"
                      name="drawer_id"
                      value={selectedItem.drawerId}
                    />
                    <input
                      type="hidden"
                      name="drawee_id"
                      value={selectedItem.draweeId}
                    />
                  </>
                )}
                <input
                  name="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                  maxLength={500}
                  placeholder="Napisz wiadomość…"
                  className="h-[54px] min-w-0 flex-1 rounded-[14px] border border-input-line bg-mist px-[18px] text-base text-ink placeholder:text-faint"
                />
                <button
                  type="submit"
                  disabled={pending || !value.trim()}
                  aria-label="Wyślij wiadomość"
                  className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[14px] bg-[#14532d] text-white hover:bg-accent-deep disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150 dark:bg-accent dark:hover:bg-accent/90"
                >
                  <SendIcon />
                </button>
              </form>
            </>
          ) : (
            <div className="my-4 grid min-h-0 flex-1 place-items-center rounded-[14px] bg-mist md:my-0">
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-sage-150 text-accent">
                  <ChatBubbleIcon />
                </span>
                <p className="max-w-[220px] text-sm leading-[1.45] text-muted">
                  Wybierz czat, aby rozpocząć rozmowę.
                </p>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {(!lotteryState.ok && lotteryState.error) ||
        (!dmState.ok && dmState.error) ? (
        <p className="mt-2 text-sm text-red-600">
          {dmState.ok ? lotteryState.error : dmState.error}
        </p>
      ) : null}

      <Presence
        open={pickerOpen}
        className="fixed inset-0 z-50 flex items-end justify-center"
        onClick={() => setPickerOpen(false)}
        backdrop
        sheetClassName="relative w-full max-w-md"
        sheetOnClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-t-2xl bg-surface p-3 shadow-lg">
          <p className="mb-2 px-1 text-sm font-semibold text-ink">
            Nowy czat
          </p>
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {others.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  openDm(p.id);
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
      </Presence>
    </div>
  );
}
