"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { ChatSection, type Thread } from "@/components/chat-section";
import {
  GroupChatSection,
} from "@/components/group-chat-section";
import type { ChatMessage } from "@/components/message-bubble";
import { LogoutButton } from "@/components/logout-button";
import { NameForm } from "@/components/name-form";
import { OrganizerPanel } from "@/components/organizer-panel";
import { ReadySection } from "@/components/ready-section";
import { WishForm, type Wish } from "@/components/wish-form";
import { formatPrice } from "@/lib/format";

export type PanelId =
  | "profile"
  | "gifts"
  | "chats"
  | "group-chat"
  | "wishes"
  | "ready"
  | "organizer";

const DEFAULT_ORDER: PanelId[] = [
  "profile",
  "gifts",
  "chats",
  "group-chat",
  "wishes",
  "ready",
  "organizer",
];

const STORAGE_KEY = "dashboard-v1";

type SavedLayout = { order: string[]; collapsed: Record<string, boolean> };

export type GiftsData =
  | {
      kind: "done";
      listGift: { person: string; wishes: Wish[] };
      themeGift: { person: string; theme: string };
    }
  | { kind: "late" }
  | { kind: "waiting"; count: number };

function loadLayout(): SavedLayout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLayout;
    if (!Array.isArray(parsed.order)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeOrder(saved: string[] | null): PanelId[] {
  const valid = new Set<string>(DEFAULT_ORDER);
  const known = saved
    ? (saved.filter((id) => valid.has(id)) as PanelId[])
    : [];
  const missing = DEFAULT_ORDER.filter((id) => !known.includes(id));
  return [...known, ...missing];
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="5" cy="3" r="1.5" />
      <circle cx="11" cy="3" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="13" r="1.5" />
      <circle cx="11" cy="13" r="1.5" />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="2" y="2" width="12" height="5" rx="1" />
      <rect x="2" y="9" width="12" height="5" rx="1" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function ListIcon() {
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
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  );
}

function TagIcon() {
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
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <path d="M7.5 7.5h.01" />
    </svg>
  );
}

function PanelCard({
  id,
  title,
  badge,
  collapsed,
  onToggle,
  editMode,
  isHole,
  children,
}: {
  id: PanelId;
  title: string;
  badge: number;
  collapsed: boolean;
  onToggle: () => void;
  editMode: boolean;
  isHole: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: !editMode });

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`rounded-2xl p-5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] ${
        isHole
          ? "border border-dashed border-amber-400 bg-amber-50/60 opacity-60"
          : `bg-white ${editMode ? "ring-2 ring-amber-300" : ""}`
      }`}
    >
      <div className="flex items-center gap-2">
        {editMode && !isHole && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Przeciągnij: ${title}`}
            className="cursor-grab touch-none rounded p-1 text-muted hover:bg-mist hover:text-ink active:cursor-grabbing"
          >
            <GripIcon />
          </button>
        )}
        <h2 className="flex-1 text-[26px] text-accent">{title}</h2>
        {badge > 0 && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">
            {badge}
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Rozwiń: ${title}` : `Zwiń: ${title}`}
          className="rounded p-1 text-muted hover:bg-mist hover:text-ink"
        >
          <ChevronIcon className={collapsed ? "" : "rotate-180"} />
        </button>
      </div>
      {!collapsed && <div className="mt-3">{children}</div>}
    </section>
  );
}

function GiftsBody({ gifts }: { gifts: GiftsData }) {
  if (gifts.kind === "late") {
    return (
      <div className="rounded-[10px] border border-dashed border-line bg-mist p-4 text-sm text-muted">
        Losowanie już się odbyło. Dołączyłeś po jego rozpoczęciu.
      </div>
    );
  }
  if (gifts.kind === "waiting") {
    return (
      <div className="rounded-[10px] border border-dashed border-honey-200 bg-honey-50 p-4 text-sm text-muted">
        Czekamy na losowanie. W grze bierze udział{" "}
        <strong>{gifts.count}</strong> osób.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <article className="flex flex-col gap-2.5 rounded-[14px] bg-mist p-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-sage-200 px-2.5 text-xs font-bold text-list-ink">
            <ListIcon />
            Z listy
          </span>
          <span className="text-sm text-muted">Kupujesz prezent dla</span>
        </div>
        <p className="text-[22px] font-bold leading-tight text-accent">
          {gifts.listGift.person}
        </p>
        {gifts.listGift.wishes.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-2">
            {gifts.listGift.wishes.map((wish) => (
              <li key={wish.id} className="rounded-[10px] bg-white px-3.5 py-3">
                <p className="text-[15px] font-semibold text-ink">
                  {wish.text}
                </p>
                {(wish.price != null || wish.link) && (
                  <p className="mt-1 flex flex-wrap gap-x-3 text-[13px] italic text-faint">
                    {wish.price != null && (
                      <span>{formatPrice(wish.price)}</span>
                    )}
                    {wish.link && (
                      <a
                        href={wish.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        link
                      </a>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-faint">
            Ta osoba jeszcze nie dodała życzeń.
          </p>
        )}
      </article>

      <article className="flex flex-col gap-2.5 rounded-[14px] bg-honey-50 p-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-honey-200 px-2.5 text-xs font-bold text-honey-800">
            <TagIcon />
            Tematyczny
          </span>
          <span className="text-sm text-muted">Kupujesz prezent dla</span>
        </div>
        <p className="text-[22px] font-bold leading-tight text-accent">
          {gifts.themeGift.person}
        </p>
        <div className="mt-1 flex items-center gap-2.5 rounded-[10px] bg-white px-3.5 py-3">
          <span className="text-[13px] text-faint">Temat</span>
          <span className="text-[15px] font-semibold italic text-ink">
            {gifts.themeGift.theme}
          </span>
        </div>
      </article>
    </div>
  );
}

export function Dashboard({
  userName,
  profile,
  gifts,
  chats,
  groupChat,
  wishes,
  ready,
  organizer,
}: {
  userName: string;
  profile: { fullName: string; locked: boolean };
  gifts: GiftsData;
  chats: {
    me: string;
    threads: Thread[];
    lotteryDone: boolean;
    lateJoiner: boolean;
  };
  groupChat: { me: string; open: boolean; messages: ChatMessage[] };
  wishes: { wishes: Wish[]; theme: string | null; locked: boolean };
  ready: {
    hasWish: boolean;
    hasTheme: boolean;
    isReady: boolean;
    lotteryDone: boolean;
    lateJoiner: boolean;
  };
  organizer: {
    participants: { id: string; full_name: string; is_ready: boolean }[];
    lateJoiners: { id: string; full_name: string }[];
    lotteryDone: boolean;
  } | null;
}) {
  const [order, setOrder] = useState<PanelId[]>(DEFAULT_ORDER);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    profile: true,
  });
  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState<PanelId | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [chatUnread, setChatUnread] = useState(() =>
    chats.threads.reduce((sum, t) => sum + t.unread, 0)
  );

  useEffect(() => {
    const saved = loadLayout();
    if (saved) {
      setOrder(normalizeOrder(saved.order));
      setCollapsed((prev) => ({ ...prev, ...(saved.collapsed ?? {}) }));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ order, collapsed })
      );
    } catch {
      // localStorage niedostępny — ignoruj
    }
  }, [order, collapsed, hydrated]);

  const handleUnreadChange = useCallback(
    (total: number) => setChatUnread(total),
    []
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function onDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as PanelId);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as PanelId);
      const newIndex = prev.indexOf(over.id as PanelId);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function onDragCancel() {
    setActiveId(null);
  }

  function resetLayout() {
    setOrder(DEFAULT_ORDER);
    setCollapsed({ profile: true });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignoruj
    }
  }

  const visible = order.filter((id) => id !== "organizer" || organizer);

  const panels: Record<PanelId, { title: string; body: ReactNode }> = {
    profile: {
      title: "Twoje dane",
      body: <NameForm fullName={profile.fullName} locked={profile.locked} />,
    },
    gifts: {
      title: "Prezenty",
      body: <GiftsBody gifts={gifts} />,
    },
    chats: {
      title: "Czaty",
      body: (
        <ChatSection
          me={chats.me}
          threads={chats.threads}
          lotteryDone={chats.lotteryDone}
          lateJoiner={chats.lateJoiner}
          onUnreadChange={handleUnreadChange}
        />
      ),
    },
    "group-chat": {
      title: "Czat wspólny",
      body: (
        <GroupChatSection
          me={groupChat.me}
          open={groupChat.open}
          messages={groupChat.messages}
        />
      ),
    },
    wishes: {
      title: "Życzenia",
      body: (
        <WishForm
          wishes={wishes.wishes}
          theme={wishes.theme}
          locked={wishes.locked}
        />
      ),
    },
    ready: {
      title: "Gotowość",
      body: <ReadySection {...ready} />,
    },
    organizer: {
      title: "Panel organizatora",
      body: organizer ? <OrganizerPanel {...organizer} /> : null,
    },
  };

  const cards = visible.map((id) => (
    <PanelCard
      key={id}
      id={id}
      title={panels[id].title}
      badge={id === "chats" && collapsed[id] ? chatUnread : 0}
      collapsed={!!collapsed[id]}
      onToggle={() =>
        setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
      }
      editMode={editMode}
      isHole={activeId === id}
    >
      {panels[id].body}
    </PanelCard>
  ));

  return (
    <main className="mx-auto flex w-full max-w-[680px] flex-1 flex-col gap-5 px-5 pb-16 pt-7">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[38px] leading-tight text-cream">
          Świąteczne Losowanie
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <div className="mr-1.5 flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cream text-sm font-bold text-accent-deep"
            >
              {userName.trim().charAt(0).toUpperCase()}
            </span>
            <span className="font-medium text-cream">{userName}</span>
          </div>
          {editMode ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetLayout}
                className="h-9 rounded-[10px] border border-cream/55 bg-white/10 px-3.5 text-sm font-semibold text-cream hover:bg-white/20"
              >
                Resetuj układ
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="h-9 rounded-[10px] bg-accent px-3.5 text-sm font-semibold text-white hover:bg-accent/90"
              >
                Gotowe
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="flex h-9 items-center gap-1.5 rounded-[10px] border border-cream/55 bg-white/10 px-3.5 text-sm font-semibold text-cream hover:bg-white/20"
              >
                <LayoutIcon />
                Układ
              </button>
              <LogoutButton />
            </>
          )}
        </div>
      </header>

      {editMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <SortableContext
            items={visible}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-5">{cards}</div>
          </SortableContext>
          <DragOverlay>
            {activeId ? (
              <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] ring-2 ring-amber-300">
                <div className="flex items-center gap-2">
                  <GripIcon />
                  <h2 className="flex-1 text-xl">{panels[activeId].title}</h2>
                  <ChevronIcon
                    className={collapsed[activeId] ? "" : "rotate-180"}
                  />
                </div>
                {!collapsed[activeId] && (
                  <div className="mt-3">{panels[activeId].body}</div>
                )}
              </section>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="flex flex-col gap-5">{cards}</div>
      )}
    </main>
  );
}
