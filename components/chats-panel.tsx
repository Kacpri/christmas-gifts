"use client";

import { useEffect, useState, type ReactNode } from "react";

import { ChatSection, type Thread } from "@/components/chat-section";
import {
  DmSection,
  type DmParticipant,
  type DmThread,
} from "@/components/dm-section";

export function ChatsPanel({
  me,
  threads,
  lotteryDone,
  lateJoiner,
  collapsed,
  participants,
  dmThreads,
  onUnreadChange,
}: {
  me: string;
  threads: Thread[];
  lotteryDone: boolean;
  lateJoiner: boolean;
  collapsed: boolean;
  participants: DmParticipant[];
  dmThreads: DmThread[];
  onUnreadChange?: (total: number) => void;
}) {
  const [tab, setTab] = useState<"lottery" | "dm">("lottery");
  const [lotteryUnread, setLotteryUnread] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);

  useEffect(() => {
    onUnreadChange?.(lotteryUnread + dmUnread);
  }, [lotteryUnread, dmUnread, onUnreadChange]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        <TabButton
          active={tab === "lottery"}
          onClick={() => setTab("lottery")}
          badge={tab !== "lottery" && lotteryUnread > 0}
        >
          Wątki losowania
        </TabButton>
        <TabButton
          active={tab === "dm"}
          onClick={() => setTab("dm")}
          badge={tab !== "dm" && dmUnread > 0}
        >
          Osobiste
        </TabButton>
      </div>
      <div className={tab === "lottery" ? "" : "hidden"}>
        <ChatSection
          me={me}
          threads={threads}
          lotteryDone={lotteryDone}
          lateJoiner={lateJoiner}
          collapsed={collapsed}
          onUnreadChange={setLotteryUnread}
        />
      </div>
      <div className={tab === "dm" ? "" : "hidden"}>
        <DmSection
          me={me}
          participants={participants}
          dmThreads={dmThreads}
          collapsed={collapsed}
          onUnreadChange={setDmUnread}
        />
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  badge: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-lg px-3 py-1.5 text-sm font-medium ${
        active ? "bg-accent text-white" : "text-muted hover:bg-mist"
      }`}
    >
      {children}
      {badge && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-600"
        />
      )}
    </button>
  );
}
