import { redirect } from "next/navigation";

import {
  type DmParticipant,
  type DmThread,
  type Thread,
} from "@/components/chats-panel";
import { Dashboard, type GiftsData } from "@/components/dashboard";
import type { Wish } from "@/components/wish-form";
import type { DishCategory } from "@/lib/dishes";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: participants },
    { data: myWishes },
    { data: myTheme },
    { data: myAssignments },
    { data: myAsDrawee },
    { data: myMessages },
    { data: myReads },
    { data: allDishes },
    { data: allLikes },
    { data: partyRow },
    { data: myDmMessages },
    { data: myDmReads },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, is_organizer, is_ready")
      .eq("id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("id, full_name, is_ready")
      .order("full_name"),
    supabase
      .from("wishes")
      .select("id, text, link, price")
      .eq("user_id", user.id)
      .order("pos"),
    supabase.from("themes").select("theme").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("assignments")
      .select("lottery_type, drawee_id")
      .eq("drawer_id", user.id),
    supabase
      .from("assignments")
      .select("lottery_type, drawer_id")
      .eq("drawee_id", user.id),
    supabase
      .from("messages")
      .select(
        "id, lottery_type, drawer_id, drawee_id, sender_id, text, created_at, edited_at, deleted_at"
      )
      .or(`drawer_id.eq.${user.id},drawee_id.eq.${user.id}`)
      .order("created_at"),
    supabase
      .from("thread_reads")
      .select("lottery_type, drawer_id, drawee_id, last_read_at")
      .eq("user_id", user.id),
    supabase
      .from("dishes")
      .select("id, user_id, name, category, quantity")
      .order("created_at"),
    supabase.from("dish_likes").select("dish_id, user_id"),
    supabase
      .from("party")
      .select("starts_at, location, notes, label, list_budget, theme_budget")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("dm_messages")
      .select(
        "id, sender_id, recipient_id, text, created_at, edited_at, deleted_at"
      )
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at"),
    supabase
      .from("dm_reads")
      .select("peer_id, last_read_at")
      .eq("user_id", user.id),
  ]);

  const lotteryDone = (myAssignments?.length ?? 0) === 2;
  const isReady = profile?.is_ready ?? false;
  const themeLocked = lotteryDone || isReady;
  const themeLockReason = lotteryDone
    ? "losowanie się już odbyło"
    : isReady
      ? "oznaczyłeś się jako gotowy"
      : null;

  const nameById = new Map((participants ?? []).map((p) => [p.id, p.full_name]));
  const likeCountByDish = new Map<number, number>();
  const myLikedDishIds = new Set<number>();
  for (const l of allLikes ?? []) {
    likeCountByDish.set(l.dish_id, (likeCountByDish.get(l.dish_id) ?? 0) + 1);
    if (l.user_id === user.id) myLikedDishIds.add(l.dish_id);
  }
  const dishes = (allDishes ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category as DishCategory,
    author: nameById.get(d.user_id) ?? "??",
    isMine: d.user_id === user.id,
    quantity: d.quantity,
    likeCount: likeCountByDish.get(d.id) ?? 0,
    likedByMe: myLikedDishIds.has(d.id),
  }));

  const { data: lotteryActiveData } = await supabase.rpc("lottery_active");
  const lotteryActive = lotteryActiveData === true;
  const isLateJoiner = !lotteryDone && lotteryActive;

  let lotteryParticipants: {
    id: string;
    full_name: string;
    is_ready: boolean;
    has_theme: boolean;
    wish_count: number;
  }[] = [];
  let lateJoiners: { id: string; full_name: string }[] = [];
  if (profile?.is_organizer) {
    const [
      { data: themesData },
      { data: wishRows },
      { data: assignmentRows },
    ] = await Promise.all([
      supabase.from("themes").select("user_id"),
      supabase.from("wishes").select("user_id"),
      supabase.from("assignments").select("drawer_id, drawee_id"),
    ]);
    const themeIds = new Set((themesData ?? []).map((t) => t.user_id));
    const wishCountById = new Map<string, number>();
    for (const w of wishRows ?? []) {
      wishCountById.set(w.user_id, (wishCountById.get(w.user_id) ?? 0) + 1);
    }
    const inLotteryIds = new Set<string>();
    for (const a of assignmentRows ?? []) {
      inLotteryIds.add(a.drawer_id);
      inLotteryIds.add(a.drawee_id);
    }
    const lotteryActive = (assignmentRows ?? []).length > 0;
    const status = (participants ?? []).map((p) => ({
      profile_id: p.id,
      full_name: p.full_name,
      is_ready: p.is_ready,
      in_lottery: lotteryActive ? inLotteryIds.has(p.id) : true,
      has_theme: themeIds.has(p.id),
      wish_count: wishCountById.get(p.id) ?? 0,
    }));
    lotteryParticipants = status
      .filter((p) => p.in_lottery)
      .map((p) => ({
        id: p.profile_id,
        full_name: p.full_name,
        is_ready: p.is_ready,
        has_theme: p.has_theme,
        wish_count: p.wish_count,
      }));
    lateJoiners = status
      .filter((p) => !p.in_lottery)
      .map((p) => ({ id: p.profile_id, full_name: p.full_name }));
  }

  const { data: groupMessagesData } = await supabase
    .from("group_messages")
    .select("id, sender_id, text, created_at, edited_at, deleted_at")
    .order("created_at");
  const groupMessages = (groupMessagesData ?? []) as {
    id: number;
    sender_id: string;
    text: string;
    created_at: string;
    edited_at: string | null;
    deleted_at: string | null;
  }[];

  let listGift: { person: string; wishes: Wish[] } | null = null;
  let themeGift: { person: string; theme: string } | null = null;
  let threads: Thread[] = [];

  if (lotteryDone) {
    const listDrawee = myAssignments!.find((a) => a.lottery_type === 1)!;
    const themeDrawee = myAssignments!.find((a) => a.lottery_type === 2)!;
    const draweeIds = [listDrawee.drawee_id, themeDrawee.drawee_id];

    const [
      { data: drawees },
      { data: draweeWishes },
      { data: draweeThemes },
    ] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", draweeIds),
      supabase
        .from("wishes")
        .select("id, user_id, text, link, price")
        .in("user_id", draweeIds)
        .order("pos"),
      supabase.from("themes").select("user_id, theme").in("user_id", draweeIds),
    ]);

    const nameOf = (id: string) =>
      drawees?.find((p) => p.id === id)?.full_name ?? "??";
    listGift = {
      person: nameOf(listDrawee.drawee_id),
      wishes: (draweeWishes ?? []).filter(
        (w) => w.user_id === listDrawee.drawee_id
      ),
    };
    themeGift = {
      person: nameOf(themeDrawee.drawee_id),
      theme:
        draweeThemes?.find((t) => t.user_id === themeDrawee.drawee_id)
          ?.theme ?? "",
    };

    const threadKeyOf = (
      a: { lottery_type: number; drawer_id: string; drawee_id: string }
    ) => `${a.lottery_type}-${a.drawer_id}-${a.drawee_id}`;
    const typeLabel = (t: number) => (t === 1 ? "z listy" : "tematyczny");
    const buildThread = (
      a: { lottery_type: number; drawer_id: string; drawee_id: string },
      label: string
    ): Thread => {
      const key = threadKeyOf(a);
      const msgs = (myMessages ?? []).filter((m) => {
        const mk = `${m.lottery_type}-${m.drawer_id}-${m.drawee_id}`;
        return mk === key;
      });
      const read = myReads?.find(
        (r) =>
          r.lottery_type === a.lottery_type &&
          r.drawer_id === a.drawer_id &&
          r.drawee_id === a.drawee_id
      );
      return {
        lotteryType: a.lottery_type,
        drawerId: a.drawer_id,
        draweeId: a.drawee_id,
        label,
        messages: msgs.map((m) => ({
          id: m.id,
          senderId: m.sender_id,
          text: m.text,
          createdAt: m.created_at,
          editedAt: m.edited_at,
          deleted: m.deleted_at != null,
        })),
        unread: msgs.filter(
          (m) =>
            m.deleted_at == null &&
            m.sender_id !== user.id &&
            (!read || m.created_at > read.last_read_at)
        ).length,
      };
    };
    threads = [
      ...myAssignments!.map((a) =>
        buildThread(
          { lottery_type: a.lottery_type, drawer_id: user.id, drawee_id: a.drawee_id },
          `Dla ${nameOf(a.drawee_id)} — ${typeLabel(a.lottery_type)}`
        )
      ),
      ...(myAsDrawee ?? []).map((a) =>
        buildThread(
          { lottery_type: a.lottery_type, drawer_id: a.drawer_id, drawee_id: user.id },
          `Tajemniczy Mikołaj — ${typeLabel(a.lottery_type)}`
        )
      ),
    ].sort((x, y) => {
      const lx = x.messages[x.messages.length - 1]?.createdAt ?? "";
      const ly = y.messages[y.messages.length - 1]?.createdAt ?? "";
      return lx < ly ? -1 : lx > ly ? 1 : x.label.localeCompare(y.label);
    });
  }

  const dmParticipants: DmParticipant[] = (participants ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
  }));
  const dmMsgs = (myDmMessages ?? []) as {
    id: number;
    sender_id: string;
    recipient_id: string;
    text: string;
    created_at: string;
    edited_at: string | null;
    deleted_at: string | null;
  }[];
  const dmReads = (myDmReads ?? []) as {
    peer_id: string;
    last_read_at: string;
  }[];
  const dmPeerIds = new Set<string>();
  for (const m of dmMsgs) {
    dmPeerIds.add(m.sender_id === user.id ? m.recipient_id : m.sender_id);
  }
  const dmThreads: DmThread[] = [...dmPeerIds].map((peerId) => {
    const peerMsgs = dmMsgs.filter(
      (m) => (m.sender_id === user.id ? m.recipient_id : m.sender_id) === peerId
    );
    const read = dmReads.find((r) => r.peer_id === peerId);
    return {
      peerId,
      label: nameById.get(peerId) ?? "??",
      messages: peerMsgs.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        text: m.text,
        createdAt: m.created_at,
        editedAt: m.edited_at,
        deleted: m.deleted_at != null,
      })),
      unread: peerMsgs.filter(
        (m) =>
          m.deleted_at == null &&
          m.sender_id !== user.id &&
          (!read || m.created_at > read.last_read_at)
      ).length,
    };
  });

  const gifts: GiftsData =
    lotteryDone && listGift && themeGift
      ? { kind: "done", listGift, themeGift }
      : isLateJoiner
        ? { kind: "late" }
        : { kind: "waiting", count: participants?.length ?? 0 };

  return (
    <Dashboard
      userName={profile?.full_name ?? ""}
      profile={{ fullName: profile?.full_name ?? "" }}
      gifts={gifts}
      chats={{
        me: user.id,
        threads,
        lotteryDone,
        lateJoiner: isLateJoiner,
        participants: dmParticipants,
        dmThreads,
      }}
      groupChat={{
        me: user.id,
        messages: groupMessages.map((m) => ({
          id: m.id,
          senderId: m.sender_id,
          text: m.text,
          createdAt: m.created_at,
          editedAt: m.edited_at,
          deleted: m.deleted_at != null,
        })),
      }}
      wishes={{
        wishes: myWishes ?? [],
        theme: myTheme?.theme ?? null,
        themeLocked: themeLocked,
        themeLockReason: themeLockReason,
      }}
      dishes={dishes}
      party={{
        startsAt: partyRow?.starts_at ?? null,
        location: partyRow?.location ?? null,
        notes: partyRow?.notes ?? null,
        label: partyRow?.label ?? "imprezy",
        isOrganizer: Boolean(profile?.is_organizer),
        listBudget: partyRow?.list_budget ?? null,
        themeBudget: partyRow?.theme_budget ?? null,
      }}
      ready={{
        hasWish: (myWishes ?? []).length >= 2,
        hasTheme: Boolean(myTheme?.theme),
        isReady,
        lotteryDone,
        lateJoiner: isLateJoiner,
      }}
      organizer={
        profile?.is_organizer
          ? {
              participants: lotteryParticipants,
              lateJoiners,
              lotteryDone,
            }
          : null
      }
    />
  );
}
