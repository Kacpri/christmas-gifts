import { redirect } from "next/navigation";

import {
  type AnonDmThread,
  type DmParticipant,
  type DmThread,
  type Thread,
} from "@/components/chats-panel";
import { Dashboard, type GiftsData } from "@/components/dashboard";
import type { Wish } from "@/components/wish-form";
import { declineName } from "@/lib/declension";
import type { DishCategory } from "@/lib/dishes";
import { reactionsFor, reactionRowsByMessage } from "@/lib/reactions";
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
    { data: myAnonConvs },
    { data: myAnonMessages },
    { data: myAnonReads },
    { data: childRows },
    { data: childParentRows },
    { data: childWishRows },
    { data: childReservationRows },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, is_organizer, is_ready, gift_ready, avatar_path, avatar_updated_at, oauth_avatar_url"
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("id, full_name, is_ready, gift_ready, avatar_path, avatar_updated_at, oauth_avatar_url")
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
        "id, lottery_type, drawer_id, drawee_id, sender_id, text, image_path, created_at, edited_at, deleted_at"
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
      .select(
        "starts_at, location, notes, label, list_budget, theme_budget, panel_visibility"
      )
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("dm_messages")
      .select(
        "id, sender_id, recipient_id, text, image_path, created_at, edited_at, deleted_at"
      )
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at"),
    supabase
      .from("dm_reads")
      .select("peer_id, last_read_at")
      .eq("user_id", user.id),
    supabase
      .from("anon_dm_conversations")
      .select("id, sender_id, recipient_id")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`),
    supabase
      .from("anon_dm_messages")
      .select(
        "id, conversation_id, sender_id, text, created_at, edited_at, deleted_at"
      )
      .order("created_at"),
    supabase
      .from("anon_dm_reads")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id),
    supabase
      .from("children")
      .select("id, name, avatar_path, avatar_updated_at")
      .order("created_at"),
    supabase
      .from("child_parents")
      .select("child_id, user_id, is_creator"),
    supabase
      .from("child_wishes")
      .select("id, child_id, text, link, price")
      .order("pos"),
    supabase.rpc("child_reservation_data"),
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
  const avatarBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars`;
  const avatarUrlOf = (
    p:
      | {
          avatar_path: string | null;
          avatar_updated_at: string | null;
          oauth_avatar_url: string | null;
        }
      | null
      | undefined
  ): string | null =>
    p?.avatar_path
      ? `${avatarBase}/${p.avatar_path}${
          p.avatar_updated_at ? `?v=${encodeURIComponent(p.avatar_updated_at)}` : ""
        }`
      : (p?.oauth_avatar_url ?? null);
  const avatarById = new Map(
    (participants ?? []).map((p) => [p.id, avatarUrlOf(p)])
  );
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

  const reservations = (childReservationRows ?? []) as {
    child_wish_id: number;
    state: string;
    is_mine: boolean;
    reserver_name: string | null;
  }[];
  const kids = (childRows ?? []).map((c) => {
    const parents = (childParentRows ?? [])
      .filter((p) => p.child_id === c.id)
      .map((p) => ({
        id: p.user_id,
        name: nameById.get(p.user_id) ?? "??",
        isCreator: p.is_creator,
      }));
    return {
      id: c.id,
      name: c.name,
      avatarUrl: c.avatar_path
        ? `${avatarBase}/${c.avatar_path}${
            c.avatar_updated_at
              ? `?v=${encodeURIComponent(c.avatar_updated_at)}`
              : ""
          }`
        : null,
      isMyChild: parents.some((p) => p.id === user.id),
      parents,
      wishes: (childWishRows ?? [])
        .filter((w) => w.child_id === c.id)
        .map((w) => {
          const r = reservations.find((x) => x.child_wish_id === w.id);
          return {
            id: w.id,
            text: w.text,
            link: w.link,
            price: w.price,
            reservation: r
              ? {
                  state: r.state as "reserved" | "purchased",
                  isMine: r.is_mine,
                  reserverName: r.reserver_name,
                }
              : null,
          };
        }),
    };
  });

  const { data: lotteryActiveData } = await supabase.rpc("lottery_active");
  const lotteryActive = lotteryActiveData === true;
  const isLateJoiner = !lotteryDone && lotteryActive;

  let lotteryParticipants: {
    id: string;
    full_name: string;
    is_ready: boolean;
    gift_ready: boolean;
    has_theme: boolean;
    wish_count: number;
    theme_text: string | null;
    avatar_url: string | null;
  }[] = [];
  let lateJoiners: { id: string; full_name: string; avatar_url: string | null }[] = [];
  let errorReports: {
    id: number;
    description: string;
    full_name: string;
    created_at: string;
    screenshot_url: string | null;
    avatar_url: string | null;
  }[] = [];
  if (profile?.is_organizer) {
    const [
      { data: themesData },
      { data: wishRows },
      { data: statusRows },
      { data: reportRows },
    ] = await Promise.all([
      supabase.from("themes").select("user_id, theme"),
      supabase.from("wishes").select("user_id"),
      supabase.rpc("participant_status"),
      supabase
        .from("error_reports")
        .select("id, description, created_at, user_id, screenshot_path")
        .order("created_at", { ascending: false }),
    ]);
    const themeTextById = new Map(
      (themesData ?? []).map((t) => [t.user_id as string, t.theme as string])
    );
    const themeIds = new Set(themeTextById.keys());
    const wishCountById = new Map<string, number>();
    for (const w of wishRows ?? []) {
      wishCountById.set(w.user_id, (wishCountById.get(w.user_id) ?? 0) + 1);
    }
    const inLotteryById = new Map<string, boolean>();
    let lotteryActive = false;
    for (const s of statusRows ?? []) {
      inLotteryById.set(s.profile_id, s.in_lottery);
      if (s.in_lottery) lotteryActive = true;
    }
    const status = (participants ?? []).map((p) => ({
      profile_id: p.id,
      full_name: p.full_name,
      is_ready: p.is_ready,
      gift_ready: p.gift_ready,
      in_lottery: lotteryActive ? (inLotteryById.get(p.id) ?? false) : true,
      has_theme: themeIds.has(p.id),
      wish_count: wishCountById.get(p.id) ?? 0,
      theme_text: themeTextById.get(p.id) ?? null,
      avatar_url: avatarUrlOf(p),
    }));
    lotteryParticipants = status
      .filter((p) => p.in_lottery)
      .map((p) => ({
        id: p.profile_id,
        full_name: p.full_name,
        is_ready: p.is_ready,
        gift_ready: p.gift_ready,
        has_theme: p.has_theme,
        wish_count: p.wish_count,
        theme_text: p.theme_text,
        avatar_url: p.avatar_url,
      }));
    lateJoiners = status
      .filter((p) => !p.in_lottery)
      .map((p) => ({
        id: p.profile_id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
      }));
    const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/error-reports`;
    errorReports = (reportRows ?? []).map((r) => ({
      id: r.id,
      description: r.description,
      full_name: nameById.get(r.user_id) ?? "??",
      created_at: r.created_at,
      screenshot_url: r.screenshot_path ? `${storageBase}/${r.screenshot_path}` : null,
      avatar_url: avatarById.get(r.user_id) ?? null,
    }));
  }

  const { data: groupMessagesData } = await supabase
    .from("group_messages")
    .select("id, sender_id, text, image_path, created_at, edited_at, deleted_at")
    .order("created_at");
  const groupMessages = (groupMessagesData ?? []) as {
    id: number;
    sender_id: string;
    text: string;
    image_path: string | null;
    created_at: string;
    edited_at: string | null;
    deleted_at: string | null;
  }[];

  const myMessageIds = (myMessages ?? []).map((m) => m.id);
  const myDmMessageIds = (myDmMessages ?? []).map((m) => m.id);
  const groupMessageIds = groupMessages.map((m) => m.id);
  const myAnonMessageIds = (myAnonMessages ?? []).map(
    (m: { id: number }) => m.id
  );
  const [
    { data: lotteryReactionRows },
    { data: groupReactionRows },
    { data: dmReactionRows },
    { data: anonReactionRows },
  ] = await Promise.all([
    myMessageIds.length > 0
      ? supabase
          .from("message_reactions")
          .select("message_id, user_id, emoji")
          .in("message_id", myMessageIds)
      : Promise.resolve({ data: [] as { message_id: number; user_id: string; emoji: string }[] }),
    groupMessageIds.length > 0
      ? supabase
          .from("group_message_reactions")
          .select("message_id, user_id, emoji")
          .in("message_id", groupMessageIds)
      : Promise.resolve({ data: [] as { message_id: number; user_id: string; emoji: string }[] }),
    myDmMessageIds.length > 0
      ? supabase
          .from("dm_message_reactions")
          .select("message_id, user_id, emoji")
          .in("message_id", myDmMessageIds)
      : Promise.resolve({ data: [] as { message_id: number; user_id: string; emoji: string }[] }),
    myAnonMessageIds.length > 0
      ? supabase
          .from("anon_dm_message_reactions")
          .select("message_id, user_id, emoji")
          .in("message_id", myAnonMessageIds)
      : Promise.resolve({ data: [] as { message_id: number; user_id: string; emoji: string }[] }),
  ]);
  const lotteryReactionsByMsg = reactionRowsByMessage(lotteryReactionRows);
  const groupReactionsByMsg = reactionRowsByMessage(groupReactionRows);
  const dmReactionsByMsg = reactionRowsByMessage(dmReactionRows);
  const anonReactionsByMsg = reactionRowsByMessage(anonReactionRows);
  const photoBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat-photos`;

  let listGift: { person: string; avatarUrl: string | null; wishes: Wish[] } | null = null;
  let themeGift: { person: string; avatarUrl: string | null; theme: string } | null = null;
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
      supabase
        .from("profiles")
        .select("id, full_name, avatar_path, avatar_updated_at, oauth_avatar_url")
        .in("id", draweeIds),
      supabase
        .from("wishes")
        .select("id, user_id, text, link, price")
        .in("user_id", draweeIds)
        .order("pos"),
      supabase.from("themes").select("user_id, theme").in("user_id", draweeIds),
    ]);

    const nameOf = (id: string) =>
      drawees?.find((p) => p.id === id)?.full_name ?? "??";
    const avatarOf = (id: string) =>
      avatarUrlOf(drawees?.find((p) => p.id === id));
    listGift = {
      person: nameOf(listDrawee.drawee_id),
      avatarUrl: avatarOf(listDrawee.drawee_id),
      wishes: (draweeWishes ?? []).filter(
        (w) => w.user_id === listDrawee.drawee_id
      ),
    };
    themeGift = {
      person: nameOf(themeDrawee.drawee_id),
      avatarUrl: avatarOf(themeDrawee.drawee_id),
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
          imageUrl: m.image_path ? `${photoBase}/${m.image_path}` : null,
          reactions: reactionsFor(lotteryReactionsByMsg, m.id),
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
          `Dla ${declineName(nameOf(a.drawee_id), "gen")} — ${typeLabel(
            a.lottery_type
          )}`
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
    avatarUrl: avatarUrlOf(p),
  }));
  const dmMsgs = (myDmMessages ?? []) as {
    id: number;
    sender_id: string;
    recipient_id: string;
    text: string;
    image_path: string | null;
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
      avatarUrl: avatarById.get(peerId) ?? null,
      messages: peerMsgs.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        text: m.text,
        createdAt: m.created_at,
        editedAt: m.edited_at,
        deleted: m.deleted_at != null,
        imageUrl: m.image_path ? `${photoBase}/${m.image_path}` : null,
        reactions: reactionsFor(dmReactionsByMsg, m.id),
      })),
      unread: peerMsgs.filter(
        (m) =>
          m.deleted_at == null &&
          m.sender_id !== user.id &&
          (!read || m.created_at > read.last_read_at)
      ).length,
    };
  });

  const anonConvs = (myAnonConvs ?? []) as {
    id: number;
    sender_id: string;
    recipient_id: string;
  }[];
  const anonMsgsAll = (myAnonMessages ?? []) as {
    id: number;
    conversation_id: number;
    sender_id: string;
    text: string;
    created_at: string;
    edited_at: string | null;
    deleted_at: string | null;
  }[];
  const anonReads = (myAnonReads ?? []) as {
    conversation_id: number;
    last_read_at: string;
  }[];
  const anonThreads: AnonDmThread[] = anonConvs.map((c) => {
    const isAnonSender = c.sender_id === user.id;
    const peerId = isAnonSender ? c.recipient_id : c.sender_id;
    const convMsgs = anonMsgsAll.filter((m) => m.conversation_id === c.id);
    const read = anonReads.find((r) => r.conversation_id === c.id);
    return {
      conversationId: c.id,
      isAnonSender,
      peerName: isAnonSender ? (nameById.get(peerId) ?? "??") : "Anonim",
      peerAvatarUrl: isAnonSender ? (avatarById.get(peerId) ?? null) : null,
      messages: convMsgs.map((m) => ({
        id: m.id,
        senderId: m.sender_id === user.id ? user.id : "anon",
        text: m.text,
        createdAt: m.created_at,
        editedAt: m.edited_at,
        deleted: m.deleted_at != null,
        imageUrl: null,
        reactions: reactionsFor(anonReactionsByMsg, m.id),
      })),
      unread: convMsgs.filter(
        (m) =>
          m.deleted_at == null &&
          m.sender_id !== user.id &&
          (!read || m.created_at > read.last_read_at)
      ).length,
    };
  });

  const gifts: GiftsData =
    lotteryDone && listGift && themeGift
      ? { kind: "done", listGift, themeGift, giftReady: profile?.gift_ready ?? false }
      : isLateJoiner
        ? { kind: "late" }
        : { kind: "waiting", count: participants?.length ?? 0 };

  return (
    <Dashboard
      userName={profile?.full_name ?? ""}
      profile={{
        fullName: profile?.full_name ?? "",
        avatarUrl: avatarUrlOf(profile),
        hasUpload: Boolean(profile?.avatar_path),
      }}
      gifts={gifts}
      chats={{
        me: user.id,
        threads,
        lotteryDone,
        lateJoiner: isLateJoiner,
        participants: dmParticipants,
        dmThreads,
        anonThreads,
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
          imageUrl: m.image_path ? `${photoBase}/${m.image_path}` : null,
          reactions: reactionsFor(groupReactionsByMsg, m.id),
        })),
      }}
      wishes={{
        wishes: myWishes ?? [],
        theme: myTheme?.theme ?? null,
        themeLocked: themeLocked,
        themeLockReason: themeLockReason,
      }}
      dishes={dishes}
      kids={{
        me: user.id,
        kids,
        users: (participants ?? []).map((p) => ({
          id: p.id,
          fullName: p.full_name,
        })),
      }}
      party={{
        startsAt: partyRow?.starts_at ?? null,
        label: partyRow?.label ?? "imprezy",
        isOrganizer: Boolean(profile?.is_organizer),
        listBudget: partyRow?.list_budget ?? null,
        themeBudget: partyRow?.theme_budget ?? null,
        hiddenPanels: Array.isArray(partyRow?.panel_visibility?.hidden)
          ? partyRow.panel_visibility.hidden.filter(
              (x: unknown): x is string => typeof x === "string"
            )
          : [],
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
              startsAt: partyRow?.starts_at ?? null,
              location: partyRow?.location ?? null,
              notes: partyRow?.notes ?? null,
              label: partyRow?.label ?? "imprezy",
              listBudget: partyRow?.list_budget ?? null,
              themeBudget: partyRow?.theme_budget ?? null,
              errorReports,
            }
          : null
      }
    />
  );
}
