"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
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

function PanelCard({
  id,
  title,
  badge,
  collapsed,
  onToggle,
  editMode,
  children,
}: {
  id: PanelId;
  title: string;
  badge: number;
  collapsed: boolean;
  onToggle: () => void;
  editMode: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editMode });

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`rounded-xl border border-stone-200 bg-white p-5 ${
        isDragging ? "relative z-10 shadow-lg" : ""
      } ${editMode ? "ring-2 ring-amber-300" : ""}`}
    >
      <div className="flex items-center gap-2">
        {editMode && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Przeciągnij: ${title}`}
            className="cursor-grab touch-none rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 active:cursor-grabbing"
          >
            <GripIcon />
          </button>
        )}
        <h2 className="flex-1 text-xl">{title}</h2>
        {badge > 0 && (
          <span className="rounded-full bg-red-700 px-2 py-0.5 text-xs font-medium text-white">
            {badge}
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Rozwiń: ${title}` : `Zwiń: ${title}`}
          className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
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
      <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
        Losowanie już się odbyło. Dołączyłeś po jego rozpoczęciu.
      </div>
    );
  }
  if (gifts.kind === "waiting") {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-stone-600">
        Czekamy na losowanie. W grze bierze udział{" "}
        <strong>{gifts.count}</strong> osób.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-stone-200 p-4">
        <h3 className="text-base font-semibold">Prezent z listy</h3>
        <p className="mt-1 text-sm text-stone-600">
          Kupujesz prezent dla: <strong>{gifts.listGift.person}</strong>
        </p>
        {gifts.listGift.wishes.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {gifts.listGift.wishes.map((wish) => (
              <li key={wish.id} className="rounded-lg bg-stone-50 p-3 text-sm">
                <p>{wish.text}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-stone-500">
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
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone-500">
            Ta osoba jeszcze nie dodała życzeń.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-stone-200 p-4">
        <h3 className="text-base font-semibold">Prezent tematyczny</h3>
        <p className="mt-1 text-sm text-stone-600">
          Kupujesz prezent dla: <strong>{gifts.themeGift.person}</strong>
        </p>
        <p className="mt-3 text-sm">
          Temat: <em>{gifts.themeGift.theme}</em>
        </p>
      </div>
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [chatUnread, setChatUnread] = useState(() =>
    chats.threads.reduce((sum, t) => sum + t.unread, 0)
  );

  useEffect(() => {
    const saved = loadLayout();
    if (saved) {
      setOrder(normalizeOrder(saved.order));
      setCollapsed(saved.collapsed ?? {});
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

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as PanelId);
      const newIndex = prev.indexOf(over.id as PanelId);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function resetLayout() {
    setOrder(DEFAULT_ORDER);
    setCollapsed({});
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
    >
      {panels[id].body}
    </PanelCard>
  ));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl text-red-800">Świąteczne Losowanie</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-600">{userName}</span>
          {editMode ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetLayout}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
              >
                Resetuj układ
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
              >
                Gotowe
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
              >
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
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={visible}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-6">{cards}</div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="flex flex-col gap-6">{cards}</div>
      )}
    </main>
  );
}
