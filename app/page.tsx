import { redirect } from "next/navigation";

import { ChatSection, type Thread } from "@/components/chat-section";
import { LogoutButton } from "@/components/logout-button";
import { NameForm } from "@/components/name-form";
import { OrganizerPanel } from "@/components/organizer-panel";
import { ReadySection } from "@/components/ready-section";
import { WishForm, type Wish } from "@/components/wish-form";
import { formatPrice } from "@/lib/format";
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
      .order("created_at"),
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
  ]);

  const lotteryDone = (myAssignments?.length ?? 0) === 2;
  const isReady = profile?.is_ready ?? false;
  const locked = lotteryDone || isReady;

  const { data: lotteryActiveData } = await supabase.rpc("lottery_active");
  const lotteryActive = lotteryActiveData === true;
  const isLateJoiner = !lotteryDone && lotteryActive;

  let lotteryParticipants: {
    id: string;
    full_name: string;
    is_ready: boolean;
  }[] = [];
  let lateJoiners: { id: string; full_name: string }[] = [];
  if (profile?.is_organizer) {
    const { data: statusData } = await supabase.rpc("participant_status");
    const status = (statusData ?? []) as {
      profile_id: string;
      full_name: string;
      is_ready: boolean;
      in_lottery: boolean;
    }[];
    lotteryParticipants = status
      .filter((p) => p.in_lottery)
      .map((p) => ({
        id: p.profile_id,
        full_name: p.full_name,
        is_ready: p.is_ready,
      }));
    lateJoiners = status
      .filter((p) => !p.in_lottery)
      .map((p) => ({ id: p.profile_id, full_name: p.full_name }));
  }

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
        .order("created_at"),
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
    const typeLabel = (t: number) => (t === 1 ? "lista" : "temat");
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
          `Anonimowy Mikołaj — ${typeLabel(a.lottery_type)}`
        )
      ),
    ].sort((x, y) => {
      const lx = x.messages[x.messages.length - 1]?.createdAt ?? "";
      const ly = y.messages[y.messages.length - 1]?.createdAt ?? "";
      return lx < ly ? -1 : lx > ly ? 1 : x.label.localeCompare(y.label);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Świąteczne Losowanie</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-600">{profile?.full_name}</span>
          <LogoutButton />
        </div>
      </header>

      <NameForm fullName={profile?.full_name ?? ""} locked={locked} />

      {lotteryDone && listGift && themeGift ? (
        <section className="flex flex-col gap-4">
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Prezent z listy</h2>
            <p className="mt-1 text-sm text-stone-600">
              Kupujesz prezent dla: <strong>{listGift.person}</strong>
            </p>
            {listGift.wishes.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {listGift.wishes.map((wish) => (
                  <li
                    key={wish.id}
                    className="rounded-lg bg-stone-50 p-3 text-sm"
                  >
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

          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Prezent tematyczny</h2>
            <p className="mt-1 text-sm text-stone-600">
              Kupujesz prezent dla: <strong>{themeGift.person}</strong>
            </p>
            <p className="mt-3 text-sm">
              Temat: <em>{themeGift.theme}</em>
            </p>
          </div>
        </section>
      ) : isLateJoiner ? (
        <section className="rounded-xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
          Losowanie już się odbyło. Dołączyłeś po jego rozpoczęciu.
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-stone-300 bg-white p-5 text-sm text-stone-600">
          Czekamy na losowanie. W grze bierze udział{" "}
          <strong>{participants?.length ?? 0}</strong> osób.
        </section>
      )}

      <ChatSection
        me={user.id}
        threads={threads}
        lotteryDone={lotteryDone}
        lateJoiner={isLateJoiner}
      />

      <WishForm
        wishes={myWishes ?? []}
        theme={myTheme?.theme ?? null}
        locked={locked}
      />

      <ReadySection
        hasWish={(myWishes ?? []).length > 0}
        hasTheme={Boolean(myTheme?.theme)}
        isReady={isReady}
        lotteryDone={lotteryDone}
        lateJoiner={isLateJoiner}
      />

      {profile?.is_organizer && (
        <OrganizerPanel
          participants={lotteryParticipants}
          lateJoiners={lateJoiners}
          lotteryDone={lotteryDone}
        />
      )}
    </main>
  );
}
