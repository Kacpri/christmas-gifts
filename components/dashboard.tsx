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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";

import {
  ChatsPanel,
  type DmParticipant,
  type DmThread,
  type Thread,
} from "@/components/chats-panel";
import { Countdown } from "@/components/countdown";
import {
  GroupChatSection,
} from "@/components/group-chat-section";
import type { ChatMessage } from "@/components/message-bubble";
import { LogoutButton } from "@/components/logout-button";
import { Menu, MenuItem } from "@/components/menu";
import { LotteryReveal } from "@/components/lottery-reveal";
import { ThemeToggle } from "@/components/theme-toggle";
import { NameForm } from "@/components/name-form";
import { NotificationToggle } from "@/components/notification-toggle";
import { DishForm, type Dish } from "@/components/dish-form";
import { OrganizerPanel } from "@/components/organizer-panel";
import { PartyPanel } from "@/components/party-panel";
import { Presence } from "@/components/presence";
import { ReadySection } from "@/components/ready-section";
import { WishForm, type Wish } from "@/components/wish-form";
import {
  effectiveListBudget,
  effectiveThemeBudget,
} from "@/lib/budget";
import { declineName, possessive } from "@/lib/declension";
import { formatPrice, participationVerb, plural } from "@/lib/format";
import { useMediaQuery } from "@/lib/use-media-query";

export type PanelId =
  | "profile"
  | "gifts"
  | "chats"
  | "group-chat"
  | "wishes"
  | "potrawy"
  | "ready"
  | "impreza"
  | "organizer";

const ALL_PANELS: PanelId[] = [
  "profile",
  "ready",
  "impreza",
  "gifts",
  "chats",
  "group-chat",
  "wishes",
  "potrawy",
  "organizer",
];

type Layout = {
  order: PanelId[];
  wide: PanelId[];
};

const DEFAULT_LAYOUT: Layout = {
  order: [
    "profile",
    "gifts",
    "ready",
    "wishes",
    "impreza",
    "potrawy",
    "group-chat",
    "organizer",
    "chats",
  ],
  wide: ["chats"],
};

const STORAGE_KEY = "dashboard-v1";

type SavedLayout = {
  left?: string[];
  right?: string[];
  wide?: string[];
  order?: string[];
  collapsed: Record<string, boolean>;
  view?: "1col" | "2col";
};

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
    if (
      !Array.isArray(parsed.left) &&
      !Array.isArray(parsed.right) &&
      !Array.isArray(parsed.wide) &&
      !Array.isArray(parsed.order)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeLayout(saved: SavedLayout | null): Layout {
  const valid = new Set<string>(ALL_PANELS);
  const pick = (arr: string[] | undefined) =>
    (arr ?? []).filter((id) => valid.has(id)) as PanelId[];

  let order: PanelId[];
  let wide: PanelId[];

  if (Array.isArray(saved?.order)) {
    order = pick(saved.order);
    wide = pick(saved.wide);
  } else {
    const left = pick(saved?.left);
    const right = pick(saved?.right);
    const wideOld = pick(saved?.wide);
    const interleaved: PanelId[] = [];
    const maxLen = Math.max(left.length, right.length);
    for (let i = 0; i < maxLen; i++) {
      if (right[i]) interleaved.push(right[i]);
      if (left[i]) interleaved.push(left[i]);
    }
    order = [...interleaved, ...wideOld];
    wide = wideOld;
  }

  const seen = new Set<string>();
  const dedup = (arr: PanelId[]) =>
    arr.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
  order = dedup(order);
  wide = dedup(wide);
  for (const id of ALL_PANELS) {
    if (!seen.has(id)) {
      order.push(id);
      seen.add(id);
    }
  }
  for (const id of wide) {
    if (!order.includes(id)) order.push(id);
  }
  return { order, wide };
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

function WidthIcon({ wide }: { wide: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="2" y="5" width="12" height="6" rx="1" />
      {!wide && <line x1="8" y1="4" x2="8" y2="12" strokeDasharray="2 1.5" />}
    </svg>
  );
}

function SlidersIcon() {
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
      <path d="M2 4.5h6.5" />
      <path d="M12.5 4.5H14" />
      <path d="M2 11.5h1.5" />
      <path d="M7.5 11.5H14" />
      <circle cx="10.5" cy="4.5" r="2" />
      <circle cx="5.5" cy="11.5" r="2" />
    </svg>
  );
}

function TwoColIcon() {
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
      <rect x="2" y="2" width="5" height="12" rx="1" />
      <rect x="9" y="2" width="5" height="12" rx="1" />
    </svg>
  );
}

function OneColIcon() {
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
      <rect x="2" y="2" width="12" height="12" rx="1" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path
        d="M2 4h12"
        className={`[transform-origin:8px_4px] transition-transform duration-200 motion-reduce:transition-none ${
          open ? "translate-y-1 rotate-45" : ""
        }`}
      />
      <path
        d="M2 8h12"
        className={`transition-opacity duration-200 motion-reduce:transition-none ${
          open ? "opacity-0" : ""
        }`}
      />
      <path
        d="M2 12h12"
        className={`[transform-origin:8px_12px] transition-transform duration-200 motion-reduce:transition-none ${
          open ? "-translate-y-1 -rotate-45" : ""
        }`}
      />
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

function ExternalLinkIcon() {
  return (
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
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function LockIcon() {
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
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function PanelIconSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function ProfileIcon() {
  return (
    <PanelIconSvg>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </PanelIconSvg>
  );
}

function ReadyIcon() {
  return (
    <PanelIconSvg>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </PanelIconSvg>
  );
}

function PartyIcon() {
  return (
    <PanelIconSvg>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </PanelIconSvg>
  );
}

function GiftsIcon() {
  return (
    <PanelIconSvg>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C9.5 3 12 5 12 8c0-3 2.5-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </PanelIconSvg>
  );
}

function ChatsIcon() {
  return (
    <PanelIconSvg>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </PanelIconSvg>
  );
}

function GroupChatIcon() {
  return (
    <PanelIconSvg>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </PanelIconSvg>
  );
}

function WishesIcon() {
  return (
    <PanelIconSvg>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </PanelIconSvg>
  );
}

function PotrawyIcon() {
  return (
    <PanelIconSvg>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </PanelIconSvg>
  );
}

function OrganizerIcon() {
  return (
    <PanelIconSvg>
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="2" x2="6" y1="14" y2="14" />
      <line x1="10" x2="14" y1="8" y2="8" />
      <line x1="18" x2="22" y1="16" y2="16" />
    </PanelIconSvg>
  );
}

const PANEL_ICONS: Record<PanelId, ReactNode> = {
  profile: <ProfileIcon />,
  ready: <ReadyIcon />,
  impreza: <PartyIcon />,
  gifts: <GiftsIcon />,
  chats: <ChatsIcon />,
  "group-chat": <GroupChatIcon />,
  wishes: <WishesIcon />,
  potrawy: <PotrawyIcon />,
  organizer: <OrganizerIcon />,
};

function PanelCard({
  id,
  title,
  titleIcon,
  titleBadge,
  badge,
  subtitle,
  headerRight,
  noCollapse,
  compact,
  collapsed,
  onToggle,
  editMode,
  isHole,
  isWide,
  onToggleWidth,
  enterDelay,
  children,
}: {
  id: PanelId;
  title: string;
  titleIcon?: ReactNode;
  titleBadge?: ReactNode;
  badge: number;
  subtitle?: string;
  headerRight?: ReactNode;
  noCollapse?: boolean;
  compact?: boolean;
  collapsed: boolean;
  onToggle: () => void;
  editMode: boolean;
  isHole: boolean;
  isWide: boolean;
  onToggleWidth?: () => void;
  enterDelay?: number;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: !editMode });

  const [settled, setSettled] = useState(true);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 250);
    return () => clearTimeout(t);
  }, [collapsed]);

  return (
    <section
      id={`panel-${id}`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...(enterDelay != null ? { animationDelay: `${enterDelay}ms` } : {}),
      }}
      className={`scroll-mt-[80px] rounded-2xl border shadow-[0_8px_24px_rgba(0,0,0,0.18)] md:scroll-mt-4 ${
        isWide ? "md:col-span-2" : ""
      } ${
        compact ? "px-5 py-3.5" : "p-5"
      } ${
        isHole
          ? "border-dashed border-amber-400 bg-amber-50/60 opacity-60"
           : `border-line bg-surface ${editMode ? "ring-2 ring-amber-300" : ""}`
        } ${enterDelay != null ? "panel-enter" : ""}`}
    >
      <div className="flex items-center gap-2">
        {editMode && !isHole && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Przeciągnij: ${title}`}
            className="cursor-grab touch-none rounded p-1 text-muted active:cursor-grabbing"
          >
            <GripIcon />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {titleIcon && (
              <span aria-hidden className="shrink-0 text-[#c0392b] dark:text-cream">
                {titleIcon}
              </span>
            )}
            <h2
              className={`${compact ? "text-[22px]" : "text-[26px]"} text-accent dark:text-[#7cc99a]`}
            >
              {title}
            </h2>
            {titleBadge}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
          )}
        </div>
        {editMode && !isHole && onToggleWidth && (
          <button
            type="button"
            onClick={onToggleWidth}
            aria-label={
              isWide ? `Zmień na wąski: ${title}` : `Zmień na szeroki: ${title}`
            }
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-mist hover:text-ink"
          >
            <WidthIcon wide={isWide} />
          </button>
        )}
        {headerRight !== undefined ? (
          headerRight
        ) : (
          <>
            {badge > 0 && (
              <span
                key={badge}
                aria-label={`${badge} ${plural(badge, [
                  "nieprzeczytana wiadomość",
                  "nieprzeczytane wiadomości",
                  "nieprzeczytanych wiadomości",
                ])}`}
                className="badge-pop inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#14532d] px-1.5 text-xs font-bold text-white dark:bg-accent"
              >
                {badge}
              </span>
            )}
            {!noCollapse && (
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={!collapsed}
                aria-label={collapsed ? `Rozwiń sekcję ${title}` : `Zwiń sekcję ${title}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-mist hover:text-ink"
              >
                <ChevronIcon
                  className={`${collapsed ? "rotate-0" : "rotate-180"} transition-transform duration-200 ease-out motion-reduce:transition-none`}
                />
              </button>
            )}
          </>
        )}
      </div>
      {children ? (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
          style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
        >
          <div
            className={`${
              collapsed || !settled ? "overflow-hidden" : "overflow-visible"
            } transition-[visibility] duration-200 ${
              collapsed ? "invisible" : "visible"
            }`}
          >
            <div className="mt-3">{children}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function GiftsBody({
  gifts,
  listBudget,
  themeBudget,
}: {
  gifts: GiftsData;
  listBudget: number;
  themeBudget: number;
}) {
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
        Czekamy na losowanie. W grze {participationVerb(gifts.count)} udział{" "}
        <strong>{gifts.count}</strong>{" "}
        {plural(gifts.count, ["osoba", "osoby", "osób"])}.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <article className="flex flex-col gap-2.5 rounded-[14px] bg-mist p-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-sage-200 px-2.5 text-xs font-bold text-list-ink">
            <ListIcon />
            Z listy życzeń
          </span>
          <span className="ml-auto flex flex-col items-end">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4a5c50] dark:text-muted">
              Budżet
            </span>
            <span className="text-base font-bold tabular-nums text-[#15251b] dark:text-ink">
              do {listBudget} zł
            </span>
          </span>
        </div>
        <p className="text-sm text-[#4a5c50] dark:text-muted">
          Kupujesz prezent dla
        </p>
        <p className="text-[28px] font-bold leading-tight text-[#0f3d24] dark:text-[#7cc99a]">
          {declineName(gifts.listGift.person, "gen")}
        </p>
        <p className="text-sm text-[#4a5c50] dark:text-muted">
          Ułożone według {possessive(gifts.listGift.person)} preferencji, od
          najbardziej wymarzonego.
        </p>
        {gifts.listGift.wishes.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {gifts.listGift.wishes.map((wish, index) => (
              <GiftWishRow key={wish.id} wish={wish} index={index} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#4a5c50] dark:text-muted">
            Ta osoba nie dodała jeszcze życzeń.
          </p>
        )}
      </article>

      <article className="flex flex-col gap-2.5 rounded-[14px] bg-honey-50 p-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-honey-200 px-2.5 text-xs font-bold text-honey-800">
            <TagIcon />
            Prezent tematyczny
          </span>
          <span className="ml-auto flex flex-col items-end">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5b5240] dark:text-honey-800">
              Budżet
            </span>
            <span className="text-base font-bold tabular-nums text-[#15251b] dark:text-ink">
              do {themeBudget} zł
            </span>
          </span>
        </div>
        <p className="text-sm text-[#4a5c50] dark:text-muted">
          Kupujesz prezent dla
        </p>
        <p className="text-[28px] font-bold leading-tight text-[#0f3d24] dark:text-[#7cc99a]">
          {declineName(gifts.themeGift.person, "gen")}
        </p>
        <div className="rounded-[10px] bg-surface px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5b5240] dark:text-honey-800">
            Temat
          </p>
          <p className="mt-1.5 text-[26px] font-bold leading-snug text-[#0f3d24] dark:text-[#7cc99a]">
            {capitalizeFirst(gifts.themeGift.theme)}
          </p>
          <p className="mt-2 text-sm text-[#4a5c50] dark:text-muted">
            Wybierz prezent związany z tym tematem. Pomysł zostawiamy Tobie.
          </p>
        </div>
      </article>

      <p className="flex items-center gap-2 text-sm text-[#4a5c50] dark:text-muted">
        <LockIcon />
        Tylko Ty widzisz, komu kupujesz prezent.
      </p>
    </div>
  );
}

function GiftWishRow({ wish, index }: { wish: Wish; index: number }) {
  const rowClass =
    "flex min-h-[60px] items-center justify-between gap-3 rounded-[10px] bg-surface px-3.5 py-3";
  const name = (
    <>
      <span className="block text-[15px] leading-snug">
        <span className="select-none font-medium text-[#4a5c50] dark:text-muted">
          {index + 1}.
        </span>{" "}
        <span className="font-semibold text-ink">{wish.text}</span>
      </span>
      {wish.link && (
        <span className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-[#14532d] dark:text-list-ink">
          Zobacz w sklepie
          <ExternalLinkIcon />
        </span>
      )}
    </>
  );
  const price =
    wish.price != null ? (
      <span className="shrink-0 whitespace-nowrap text-base font-semibold tabular-nums text-[#15251b] dark:text-ink">
        {formatPrice(wish.price)}
      </span>
    ) : (
      <span className="shrink-0 whitespace-nowrap text-[13px] text-[#4a5c50] dark:text-muted">
        Brak ceny
      </span>
    );
  if (wish.link) {
    return (
      <li>
        <a
          href={wish.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`${rowClass} transition-colors hover:bg-[#f3f8f4] dark:hover:bg-sage-150 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-[#1d6b3d] focus-visible:outline-offset-2`}
        >
          <span className="min-w-0">{name}</span>
          {price}
        </a>
      </li>
    );
  }
  return (
    <li>
      <div className={rowClass}>
        <span className="min-w-0">{name}</span>
        {price}
      </div>
    </li>
  );
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ReadyDoneBadge() {
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-sage-200 px-2.5 text-xs font-bold text-list-ink">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
      Gotowe
    </span>
  );
}

function readyHeader(
  ready: {
    hasWish: boolean;
    hasTheme: boolean;
    isReady: boolean;
    lotteryDone: boolean;
    lateJoiner: boolean;
  },
  onMissingClick: () => void
): { subtitle: string; badge: ReactNode } {
  if (ready.lateJoiner) {
    return {
      subtitle: "Losowanie już się odbyło — gotowość nie jest wymagana.",
      badge: null,
    };
  }
  if (ready.lotteryDone) {
    return { subtitle: "Losowanie już się odbyło.", badge: null };
  }
  if (ready.isReady) {
    return { subtitle: "Dodane: życzenia i temat prezentu", badge: <ReadyDoneBadge /> };
  }
  if (ready.hasWish && ready.hasTheme) {
    return {
      subtitle: "Wszystko uzupełnione — potwierdź gotowość.",
      badge: (
        <span className="inline-flex h-[26px] items-center rounded-full bg-honey-200 px-2.5 text-xs font-bold text-honey-800">
          Do potwierdzenia
        </span>
      ),
    };
  }
  const missing = [
    !ready.hasWish && "życzenia",
    !ready.hasTheme && "temat",
  ]
    .filter(Boolean)
    .join(" i ");
  return {
    subtitle: "Potwierdź gotowość, gdy uzupełnisz listę życzeń i temat.",
    badge: (
      <button
        type="button"
        onClick={onMissingClick}
        className="inline-flex h-[26px] items-center rounded-full bg-honey-200 px-2.5 text-xs font-bold text-honey-800 hover:opacity-80"
      >
        Brakuje: {missing}
      </button>
    ),
  };
}

export function Dashboard({
  userName,
  profile,
  gifts,
  chats,
  groupChat,
  wishes,
  dishes,
  party,
  ready,
  organizer,
}: {
  userName: string;
  profile: { fullName: string };
  gifts: GiftsData;
  chats: {
    me: string;
    threads: Thread[];
    lotteryDone: boolean;
    lateJoiner: boolean;
    participants: DmParticipant[];
    dmThreads: DmThread[];
  };
  groupChat: { me: string; messages: ChatMessage[] };
  wishes: {
    wishes: Wish[];
    theme: string | null;
    themeLocked: boolean;
    themeLockReason: string | null;
  };
  dishes: Dish[];
  party: {
    startsAt: string | null;
    location: string | null;
    notes: string | null;
    label: string;
    isOrganizer: boolean;
    listBudget: number | null;
    themeBudget: number | null;
  };
  ready: {
    hasWish: boolean;
    hasTheme: boolean;
    isReady: boolean;
    lotteryDone: boolean;
    lateJoiner: boolean;
  };
  organizer: {
    participants: {
      id: string;
      full_name: string;
      is_ready: boolean;
      has_theme: boolean;
      wish_count: number;
      theme_text: string | null;
    }[];
    lateJoiners: { id: string; full_name: string }[];
    lotteryDone: boolean;
    listBudget: number | null;
    themeBudget: number | null;
  } | null;
}) {
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    profile: true,
  });
  const [view, setView] = useState<"1col" | "2col">("2col");
  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState<PanelId | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(() =>
    chats.threads.reduce((sum, t) => sum + t.unread, 0)
  );
  const [groupUnread, setGroupUnread] = useState(0);
  const [wishCount, setWishCount] = useState(wishes.wishes.length);
  const [revealed, setRevealed] = useState(false);
  const [topBarHidden, setTopBarHidden] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const lastScrollY = useRef(0);
  const visibleIdsRef = useRef<PanelId[]>([]);
  const chipNavRef = useRef<HTMLElement>(null);
  const desktopChipNavRef = useRef<HTMLElement>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [chipFades, setChipFades] = useState({ left: false, right: false });
  const [entering, setEntering] = useState(false);
  const lastActivePanel = useRef<PanelId | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem("lottery-revealed-v1")) setRevealed(true);
    } catch {
      // localStorage niedostępny — ignoruj
    }
  }, []);

  const markRevealed = useCallback(() => {
    try {
      localStorage.setItem("lottery-revealed-v1", "1");
    } catch {
      // localStorage niedostępny — ignoruj
    }
    setRevealed(true);
  }, []);

  useEffect(() => {
    const saved = loadLayout();
    if (saved) {
      setLayout(normalizeLayout(saved));
      setCollapsed((prev) => ({ ...prev, ...(saved.collapsed ?? {}) }));
      if (saved.view === "2col" || saved.view === "1col") setView(saved.view);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setEntering(true);
    const t = window.setTimeout(() => setEntering(false), 1500);
    return () => window.clearTimeout(t);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ order: layout.order, wide: layout.wide, collapsed, view })
      );
    } catch {
      // localStorage niedostępny — ignoruj
    }
  }, [layout, collapsed, view, hydrated]);

  const handleUnreadChange = useCallback(
    (total: number) => setChatUnread(total),
    []
  );

  const handleGroupUnreadChange = useCallback(
    (total: number) => setGroupUnread(total),
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
    const activeId = active.id as PanelId;
    const overId = over.id as PanelId;
    setLayout((prev) => {
      const oldIndex = prev.order.indexOf(activeId);
      const newIndex = prev.order.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return { ...prev, order: arrayMove(prev.order, oldIndex, newIndex) };
    });
  }

  function toggleWidth(id: PanelId) {
    setLayout((prev) => {
      const isWide = prev.wide.includes(id);
      const wide = isWide
        ? prev.wide.filter((x) => x !== id)
        : [...prev.wide, id];
      return { ...prev, wide };
    });
  }

  function onDragCancel() {
    setActiveId(null);
  }

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT);
    setCollapsed({ profile: true });
    setView("2col");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignoruj
    }
  }

  const isVisible = (id: PanelId) =>
    (id !== "organizer" || organizer) &&
    (id !== "ready" || !(ready.lotteryDone || ready.lateJoiner)) &&
    (id !== "gifts" || gifts.kind !== "waiting") &&
    (id !== "chats" || chats.lotteryDone);

  const visible = layout.order.filter(isVisible);
  const isWide = (id: PanelId) => id === "chats" || layout.wide.includes(id);

  visibleIdsRef.current = visible;

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (y < 8 || y < lastScrollY.current - 4) {
        setTopBarHidden(false);
      } else if (y > lastScrollY.current + 4) {
        setTopBarHidden(true);
      }
      lastScrollY.current = y;
      let current: PanelId | null = null;
      for (const id of visibleIdsRef.current) {
        const el = document.getElementById(`panel-${id}`);
        if (el && el.getBoundingClientRect().top <= 120) current = id;
      }
      if (current !== lastActivePanel.current) {
        if (lastActivePanel.current !== null && current !== null) {
          const nav = (isDesktop ? desktopChipNavRef : chipNavRef).current;
          const chip = nav?.querySelector<HTMLElement>(
            `[data-chip="${current}"]`
          );
          if (nav && chip) {
            const reduced = window.matchMedia(
              "(prefers-reduced-motion: reduce)"
            ).matches;
            nav.scrollTo({
              left: chip.offsetLeft - (nav.clientWidth - chip.offsetWidth) / 2,
              behavior: reduced ? "auto" : "smooth",
            });
          }
        }
        lastActivePanel.current = current;
      }
      setActivePanel((prev) => (prev === current ? prev : current));
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [isDesktop]);

  const updateChipFades = useCallback(() => {
    const el = (isDesktop ? desktopChipNavRef : chipNavRef).current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setChipFades((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right }
    );
  }, [isDesktop]);

  const visibleKey = visible.join(",");

  useEffect(() => {
    updateChipFades();
    window.addEventListener("resize", updateChipFades);
    return () => window.removeEventListener("resize", updateChipFades);
  }, [updateChipFades, visibleKey]);

  const isTwoCol = view === "2col";

  const panels: Record<PanelId, { title: string; body: ReactNode }> = {
    profile: {
      title: "Twoje dane",
      body: <NameForm fullName={profile.fullName} />,
    },
    gifts: {
      title: "Prezenty",
      body: (
        <GiftsBody
          gifts={gifts}
          listBudget={effectiveListBudget(party.listBudget)}
          themeBudget={effectiveThemeBudget(party.themeBudget)}
        />
      ),
    },
    chats: {
      title: "Czaty",
      body: (
        <ChatsPanel
          me={chats.me}
          threads={chats.threads}
          lotteryDone={chats.lotteryDone}
          lateJoiner={chats.lateJoiner}
          collapsed={!!collapsed["chats"]}
          participants={chats.participants}
          dmThreads={chats.dmThreads}
          onUnreadChange={handleUnreadChange}
        />
      ),
    },
    "group-chat": {
      title: "Czat wspólny",
      body: (
        <GroupChatSection
          me={groupChat.me}
          messages={groupChat.messages}
          collapsed={!!collapsed["group-chat"]}
          onUnreadChange={handleGroupUnreadChange}
        />
      ),
    },
    wishes: {
      title: "Życzenia",
      body: (
        <WishForm
          wishes={wishes.wishes}
          theme={wishes.theme}
          themeLocked={wishes.themeLocked}
          themeLockReason={wishes.themeLockReason}
          listBudget={effectiveListBudget(party.listBudget)}
          themeBudget={effectiveThemeBudget(party.themeBudget)}
          onCountChange={setWishCount}
        />
      ),
    },
    potrawy: {
      title: "Potrawy",
      body: <DishForm dishes={dishes} />,
    },
    ready: {
      title: "Gotowość",
      body: (
        <ReadySection
          {...ready}
          count={gifts.kind === "waiting" ? gifts.count : 0}
        />
      ),
    },
    impreza: {
      title: "Odliczanie",
      body: <PartyPanel {...party} />,
    },
    organizer: {
      title: "Panel organizatora",
      body: organizer ? <OrganizerPanel {...organizer} /> : null,
    },
  };

  function goToWishes() {
    goToPanel("wishes");
  }

  function goToPanel(id: PanelId) {
    setCollapsed((prev) => ({ ...prev, [id]: false }));
    document
      .getElementById(`panel-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderCard(id: PanelId, index: number, wide: boolean) {
    const isReadyPanel = id === "ready";
    const readyInfo = isReadyPanel
      ? readyHeader(ready, goToWishes)
      : null;
    return (
      <PanelCard
        key={id}
        id={id}
        title={panels[id].title}
        titleIcon={PANEL_ICONS[id]}
        titleBadge={
          id === "wishes" ? (
            <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-accent dark:bg-sage-300 dark:text-[#e6f6ec]">
              {wishCount}/5
            </span>
          ) : undefined
        }
        badge={
          id === "chats" && collapsed[id]
            ? chatUnread
            : id === "group-chat" && collapsed[id]
              ? groupUnread
              : 0
        }
        subtitle={readyInfo?.subtitle}
        headerRight={readyInfo ? readyInfo.badge : undefined}
        noCollapse={isReadyPanel}
        compact={isReadyPanel}
        collapsed={isReadyPanel ? false : !!collapsed[id]}
        onToggle={() =>
          setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
        }
        editMode={editMode}
        isHole={activeId === id}
        isWide={wide}
        onToggleWidth={id === "chats" ? undefined : () => toggleWidth(id)}
        enterDelay={entering ? index * 50 : undefined}
      >
        {isReadyPanel &&
        (ready.lotteryDone || ready.lateJoiner)
          ? null
          : panels[id].body}
      </PanelCard>
    );
  }

  function renderChipNav(ref: Ref<HTMLElement>) {
    return (
      <div className="relative min-w-0 flex-1">
        <nav
          ref={ref}
          aria-label="Przejdź do sekcji"
          onScroll={updateChipFades}
          className="no-scrollbar flex gap-2 overflow-x-auto px-1"
        >
          {visible.map((id) => {
            const unread =
              id === "chats"
                ? chatUnread
                : id === "group-chat"
                  ? groupUnread
                  : 0;
            return (
              <button
                key={id}
                type="button"
                data-chip={id}
                onClick={() => goToPanel(id)}
                aria-current={activePanel === id ? "true" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
                  activePanel === id
                    ? "border-cream bg-cream text-[#0d4024]"
                    : "border-cream/55 bg-white/10 text-cream hover:bg-white/20"
                }`}
              >
                {panels[id].title}
                {unread > 0 && (
                  <span
                    key={unread}
                    aria-label={`${unread} ${plural(unread, [
                      "nieprzeczytana wiadomość",
                      "nieprzeczytane wiadomości",
                      "nieprzeczytanych wiadomości",
                    ])}`}
                    className={`badge-pop inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                      activePanel === id
                        ? "bg-[#0d4024] text-cream"
                        : "bg-cream text-[#0d4024]"
                    }`}
                  >
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        {chipFades.left && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#0d4024] to-transparent dark:from-[#061a13]"
          />
        )}
        {chipFades.right && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#0d4024] to-transparent dark:from-[#061a13]"
          />
        )}
      </div>
    );
  }

  return (
    <main
      className={`mx-auto flex w-full flex-1 flex-col gap-5 px-5 pb-16 pt-0 md:pt-7 ${
        isTwoCol ? "max-w-[1200px]" : "max-w-[800px]"
      }`}
    >
      {hydrated && gifts.kind === "done" && !revealed && (
        <LotteryReveal onDone={markRevealed} />
      )}
      <div
        className={`sticky top-0 z-30 -mx-5 flex h-[52px] items-center gap-1.5 bg-[#0d4024] px-3 transition-transform duration-200 dark:bg-[#061a13] md:hidden ${
          topBarHidden ? "-translate-y-full" : ""
        }`}
      >
        {editMode ? (
          <div className="flex w-full items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetLayout}
              className="inline-flex h-9 items-center rounded-[10px] border border-cream/55 bg-white/10 px-3 text-sm font-semibold text-cream hover:bg-white/20"
            >
              Resetuj
            </button>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="inline-flex h-9 items-center rounded-[10px] bg-accent px-3 text-sm font-semibold text-white hover:bg-accent/90"
            >
              Gotowe
            </button>
          </div>
        ) : (
          <>
            {renderChipNav(chipNavRef)}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "Zamknij menu" : "Otwórz menu"}
              aria-expanded={mobileMenuOpen}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-cream/55 bg-white/10 text-cream hover:bg-white/20"
            >
              <MenuIcon open={mobileMenuOpen} />
            </button>
          </>
        )}
      </div>
      <header className="flex flex-col gap-2">
        <h1 className="text-[38px] leading-tight text-cream">
          Świąteczne Losowanie
        </h1>
        <Countdown startsAt={party.startsAt} label={party.label} />
      </header>
      <div className="sticky top-0 z-30 hidden -mx-5 border-b border-cream/10 bg-[#0d4024] px-5 dark:bg-[#061a13] md:block">
        {editMode ? (
          <div className="flex items-center justify-end gap-2 py-2">
            <button
              type="button"
              onClick={resetLayout}
              className="inline-flex h-11 items-center rounded-[10px] border border-cream/55 bg-white/10 px-4 text-sm font-semibold text-cream hover:bg-white/20"
            >
              Resetuj układ
            </button>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="inline-flex h-11 items-center rounded-[10px] bg-accent px-4 text-sm font-semibold text-white hover:bg-accent/90"
            >
              Gotowe
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 py-2">
            {renderChipNav(desktopChipNavRef)}
            <Menu
              align="end"
              panelClassName="w-64"
              trigger={({ open, toggle, ref }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={toggle}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-label={open ? "Zamknij menu" : "Otwórz menu"}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-cream/55 bg-white/10 text-cream hover:bg-white/20"
                >
                  <MenuIcon open={open} />
                </button>
              )}
            >
              <div className="flex items-center gap-2.5 px-3 py-2">
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cream text-sm font-bold text-accent-deep dark:text-[#0d4024]"
                >
                  {userName.trim().charAt(0).toUpperCase()}
                </span>
                <span className="truncate font-medium text-cream">
                  {userName}
                </span>
              </div>
              <div className="mx-1 my-1 border-t border-cream/20" />
              <MenuItem onClick={() => setEditMode(true)}>
                <SlidersIcon />
                Dostosuj układ
              </MenuItem>
              <MenuItem
                radio
                active={view === "1col"}
                onClick={() => setView("1col")}
              >
                <OneColIcon />
                1 kolumna
              </MenuItem>
              <MenuItem
                radio
                active={view === "2col"}
                onClick={() => setView("2col")}
              >
                <TwoColIcon />
                2 kolumny
              </MenuItem>
              <div className="mx-1 my-1 border-t border-cream/20" />
              <NotificationToggle variant="row" />
              <ThemeToggle variant="row" />
              <div className="mx-1 my-1 border-t border-cream/20" />
              <LogoutButton variant="row" />
            </Menu>
          </div>
        )}
      </div>

      <Presence
        open={mobileMenuOpen && !editMode}
        className="fixed inset-0 z-50 md:hidden"
        onClick={() => setMobileMenuOpen(false)}
        sheetClassName="absolute right-4 top-[52px] w-60"
        sheetFrom="-translate-y-2 opacity-0"
        sheetTo="translate-y-0 opacity-100"
        sheetOnClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl border border-cream/20 bg-background p-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cream text-sm font-bold text-accent-deep dark:text-[#0d4024]"
            >
              {userName.trim().charAt(0).toUpperCase()}
            </span>
            <span className="truncate font-medium text-cream">{userName}</span>
          </div>
          <div className="mx-1 border-t border-cream/20" />
          <button
            type="button"
            onClick={() => {
              setEditMode(true);
              setMobileMenuOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-cream hover:bg-white/10"
          >
            <SlidersIcon />
            Dostosuj układ
          </button>
          <div className="mt-1 flex flex-col">
            <NotificationToggle variant="row" />
            <ThemeToggle variant="row" />
          </div>
          <div className="mt-1 border-t border-cream/20 pt-1">
            <LogoutButton variant="row" />
          </div>
        </div>
      </Presence>

      {hydrated && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div
            className={`grid grid-cols-1 gap-5 ${
              isTwoCol ? "md:grid-cols-2 md:items-start" : ""
            }`}
          >
            <SortableContext items={visible} strategy={rectSortingStrategy}>
              {visible.map((id, i) => renderCard(id, i, isWide(id)))}
            </SortableContext>
          </div>
          <DragOverlay>
          {activeId ? (
            <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] ring-2 ring-amber-300">
              <div className="flex items-center gap-2">
                <span aria-hidden className="shrink-0 text-muted">
                  <GripIcon />
                </span>
                <span
                  aria-hidden
                  className="shrink-0 text-[#c0392b] dark:text-cream"
                >
                  {PANEL_ICONS[activeId]}
                </span>
                <h2 className="min-w-0 flex-1 text-[26px] text-accent dark:text-[#7cc99a]">
                  {panels[activeId].title}
                </h2>
                {activeId !== "ready" && (
                  <ChevronIcon
                    className={`shrink-0 text-muted ${collapsed[activeId] ? "rotate-0" : "rotate-180"} transition-transform duration-200 ease-out motion-reduce:transition-none`}
                  />
                )}
              </div>
              {(activeId === "ready" || !collapsed[activeId]) && (
                <div className="mt-3">{panels[activeId].body}</div>
              )}
            </section>
          ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </main>
  );
}
