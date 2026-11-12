"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { DISH_CATEGORY_VALUES } from "@/lib/dishes";

export type ActionResult = { ok: boolean; error?: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function addWish(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();

  if (!text) return { ok: false, error: "Wpisz, czego sobie życzysz." };
  if (link && !/^https?:\/\/\S+$/i.test(link)) {
    return { ok: false, error: "Link musi zaczynać się od http:// lub https://" };
  }
  let price: number | null = null;
  if (priceRaw) {
    price = Number(priceRaw.replace(",", "."));
    if (Number.isNaN(price) || price < 0) {
      return { ok: false, error: "Cena musi być dodatnią liczbą." };
    }
  }

  const { count, error: countError } = await supabase
    .from("wishes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) return { ok: false, error: countError.message };
  if ((count ?? 0) >= 5) {
    return { ok: false, error: "Maksymalnie 5 życzeń." };
  }

  const { data: top } = await supabase
    .from("wishes")
    .select("pos")
    .eq("user_id", user.id)
    .order("pos", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("wishes").insert({
    user_id: user.id,
    text,
    link: link || null,
    price,
    pos: (top?.pos ?? 0) + 1,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function editWish(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = Number(formData.get("id"));
  const text = String(formData.get("text") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  if (!Number.isInteger(id)) return { ok: false, error: "Nieprawidłowe życzenie." };
  if (!text) return { ok: false, error: "Wpisz, czego sobie życzysz." };
  if (link && !/^https?:\/\/\S+$/i.test(link)) {
    return { ok: false, error: "Link musi zaczynać się od http:// lub https://" };
  }
  let price: number | null = null;
  if (priceRaw) {
    price = Number(priceRaw.replace(",", "."));
    if (Number.isNaN(price) || price < 0) {
      return { ok: false, error: "Cena musi być dodatnią liczbą." };
    }
  }
  const { error } = await supabase
    .from("wishes")
    .update({ text, link: link || null, price })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "Po losowaniu nie można edytować życzeń."
          : error.message,
    };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function removeWish(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, error: "Nieprawidłowe życzenie." };
  const { error } = await supabase.from("wishes").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "Po losowaniu nie można usuwać życzeń."
          : error.message,
    };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function addDish(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const quantity = String(formData.get("quantity") ?? "").trim();
  if (!name || name.length > 120) {
    return { ok: false, error: "Nazwa potrawy: 1–120 znaków." };
  }
  if (!(DISH_CATEGORY_VALUES as string[]).includes(category)) {
    return { ok: false, error: "Wybierz kategorię." };
  }
  const { error } = await supabase
    .from("dishes")
    .insert({ user_id: user.id, name, category, quantity: quantity || null });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function editDish(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const quantity = String(formData.get("quantity") ?? "").trim();
  if (!Number.isInteger(id)) return { ok: false, error: "Nieprawidłowa potrawa." };
  if (!name || name.length > 120) {
    return { ok: false, error: "Nazwa potrawy: 1–120 znaków." };
  }
  if (!(DISH_CATEGORY_VALUES as string[]).includes(category)) {
    return { ok: false, error: "Wybierz kategorię." };
  }
  const { error } = await supabase
    .from("dishes")
    .update({ name, category, quantity: quantity || null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function removeDish(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, error: "Nieprawidłowa potrawa." };
  const { error } = await supabase
    .from("dishes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function toggleDishLike(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, error: "Nieprawidłowe danie." };
  const { data: existing } = await supabase
    .from("dish_likes")
    .select("dish_id")
    .eq("dish_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("dish_likes")
      .delete()
      .eq("dish_id", id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("dish_likes")
      .insert({ dish_id: id, user_id: user.id });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function saveName(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("full_name") ?? "").trim();
  if (!name || name.length > 100) {
    return { ok: false, error: "Imię i nazwisko: 1–100 znaków." };
  }
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: name })
    .eq("id", user.id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Imię i nazwisko są już zablokowane." };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function markReady(
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { count, error: countError } = await supabase
    .from("wishes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) return { ok: false, error: countError.message };
  if ((count ?? 0) < 2) {
    return { ok: false, error: "Dodaj przynajmniej dwa życzenia." };
  }
  const { data: theme } = await supabase
    .from("themes")
    .select("theme")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!theme) return { ok: false, error: "Wpisz temat prezentu." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_ready")
    .eq("id", user.id)
    .single();
  if (profile?.is_ready) return { ok: false, error: "Jesteś już gotowy." };
  const { count: assignmentCount, error: assignError } = await supabase
    .from("assignments")
    .select("id", { count: "exact", head: true });
  if (assignError) return { ok: false, error: assignError.message };
  if ((assignmentCount ?? 0) > 0) {
    return { ok: false, error: "Losowanie już się odbyło." };
  }
  const { error } = await supabase
    .from("profiles")
    .update({ is_ready: true })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function saveTheme(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const theme = String(formData.get("theme") ?? "").trim();
  if (!theme) return { ok: false, error: "Wpisz temat prezentu." };
  const { error } = await supabase
    .from("themes")
    .upsert({ user_id: user.id, theme }, { onConflict: "user_id" });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "Po losowaniu temat jest zablokowany."
          : error.message,
    };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function runLottery(
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("run_lottery");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

async function touchThreadRead(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  lotteryType: number,
  drawerId: string,
  draweeId: string
) {
  await supabase.from("thread_reads").upsert(
    {
      lottery_type: lotteryType,
      drawer_id: drawerId,
      drawee_id: draweeId,
      user_id: userId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "lottery_type,drawer_id,drawee_id,user_id" }
  );
}

export async function sendMessage(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  const lotteryType = Number(formData.get("lottery_type"));
  const drawerId = String(formData.get("drawer_id") ?? "");
  const draweeId = String(formData.get("drawee_id") ?? "");
  if (!text || text.length > 500) {
    return { ok: false, error: "Wiadomość: 1–500 znaków." };
  }
  if (!Number.isInteger(lotteryType) || !drawerId || !draweeId) {
    return { ok: false, error: "Nieprawidłowy wątek." };
  }
  const { data: mine } = await supabase
    .from("assignments")
    .select("lottery_type, drawer_id, drawee_id")
    .or(`drawer_id.eq.${user.id},drawee_id.eq.${user.id}`);
  const isMember = (mine ?? []).some(
    (a) =>
      a.lottery_type === lotteryType &&
      a.drawer_id === drawerId &&
      a.drawee_id === draweeId
  );
  if (!isMember) return { ok: false, error: "Nie masz dostępu do tego wątku." };
  const { error } = await supabase.from("messages").insert({
    lottery_type: lotteryType,
    drawer_id: drawerId,
    drawee_id: draweeId,
    sender_id: user.id,
    text,
  });
  if (error) return { ok: false, error: error.message };
  await touchThreadRead(supabase, user.id, lotteryType, drawerId, draweeId);
  revalidatePath("/");
  return { ok: true };
}

export async function editMessage(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = Number(formData.get("id"));
  const text = String(formData.get("text") ?? "").trim();
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Nieprawidłowa wiadomość." };
  }
  if (!text || text.length > 500) {
    return { ok: false, error: "Wiadomość: 1–500 znaków." };
  }
  const { error } = await supabase
    .from("messages")
    .update({ text, edited_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function deleteMessage(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Nieprawidłowa wiadomość." };
  }
  const { error } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function sendGroupMessage(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  if (!text || text.length > 500) {
    return { ok: false, error: "Wiadomość: 1–500 znaków." };
  }
  const { error } = await supabase
    .from("group_messages")
    .insert({ sender_id: user.id, text });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function editGroupMessage(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = Number(formData.get("id"));
  const text = String(formData.get("text") ?? "").trim();
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Nieprawidłowa wiadomość." };
  }
  if (!text || text.length > 500) {
    return { ok: false, error: "Wiadomość: 1–500 znaków." };
  }
  const { error } = await supabase
    .from("group_messages")
    .update({ text, edited_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function deleteGroupMessage(
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Nieprawidłowa wiadomość." };
  }
  const { error } = await supabase
    .from("group_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function markThreadRead(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const lotteryType = Number(formData.get("lottery_type"));
  const drawerId = String(formData.get("drawer_id") ?? "");
  const draweeId = String(formData.get("drawee_id") ?? "");
  if (!Number.isInteger(lotteryType) || !drawerId || !draweeId) return;
  await touchThreadRead(supabase, user.id, lotteryType, drawerId, draweeId);
}

export async function sendDm(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  const recipientId = String(formData.get("recipient_id") ?? "");
  if (!text || text.length > 500) {
    return { ok: false, error: "Wiadomość: 1–500 znaków." };
  }
  if (!recipientId || recipientId === user.id) {
    return { ok: false, error: "Wybierz osobę." };
  }
  const { error } = await supabase
    .from("dm_messages")
    .insert({ sender_id: user.id, recipient_id: recipientId, text });
  if (error) return { ok: false, error: error.message };
  await supabase
    .from("dm_reads")
    .upsert(
      {
        user_id: user.id,
        peer_id: recipientId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "user_id,peer_id" }
    );
  revalidatePath("/");
  return { ok: true };
}

export async function editDm(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = Number(formData.get("id"));
  const text = String(formData.get("text") ?? "").trim();
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Nieprawidłowa wiadomość." };
  }
  if (!text || text.length > 500) {
    return { ok: false, error: "Wiadomość: 1–500 znaków." };
  }
  const { error } = await supabase
    .from("dm_messages")
    .update({ text, edited_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function deleteDm(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Nieprawidłowa wiadomość." };
  }
  const { error } = await supabase
    .from("dm_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function markDmRead(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const peerId = String(formData.get("peer_id") ?? "");
  if (!peerId) return;
  await supabase
    .from("dm_reads")
    .upsert(
      {
        user_id: user.id,
        peer_id: peerId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "user_id,peer_id" }
    );
}

export async function cancelLottery(
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("cancel_lottery");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function removeUser(formData: FormData): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id || id === user.id) {
    return { ok: false, error: "Nie można usunąć samego siebie." };
  }
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

async function requireOrganizer() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_organizer")
    .eq("id", user.id)
    .single();
  if (!profile?.is_organizer) return null;
  return { supabase, user };
}

export async function setNameForUser(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrganizer();
  if (!org) {
    return { ok: false, error: "Tylko organizator może zarządzać uczestnikami." };
  }
  const { supabase } = org;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("full_name") ?? "").trim();
  if (!id) return { ok: false, error: "Nieprawidłowy uczestnik." };
  if (!name || name.length > 100) {
    return { ok: false, error: "Imię i nazwisko: 1–100 znaków." };
  }
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: name })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Nie udało się zapisać nazwy." };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function setReadyForUser(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrganizer();
  if (!org) {
    return { ok: false, error: "Tylko organizator może zarządzać uczestnikami." };
  }
  const { supabase } = org;
  const id = String(formData.get("id") ?? "");
  const isReady = formData.get("is_ready") === "true";
  if (!id) return { ok: false, error: "Nieprawidłowy uczestnik." };
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_ready: isReady })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Nie udało się zmienić gotowości." };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function sendLotteryEmails(
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_organizer")
    .eq("id", user.id)
    .single();
  if (!profile?.is_organizer) {
    return { ok: false, error: "Tylko organizator może wysyłać wyniki." };
  }

  const { data, error } = await supabase.rpc("lottery_email_data");
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as {
    recipient_email: string;
    recipient_name: string;
    list_drawee_name: string;
    list_wishes: { text: string; price: number | null; link: string | null }[];
    theme_drawee_name: string;
    theme_text: string | null;
  }[];
  if (rows.length === 0) {
    return { ok: false, error: "Losowanie się jeszcze nie odbyło." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Brak sesji." };

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-lottery-emails`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        emails: rows.map((r) => ({
          to: r.recipient_email,
          name: r.recipient_name,
          listPerson: r.list_drawee_name,
          listWishes: r.list_wishes ?? [],
          themePerson: r.theme_drawee_name,
          theme: r.theme_text ?? "",
        })),
      }),
    }
  );
  const payload = (await res.json()) as {
    error?: string;
    results?: { to: string; ok: boolean; error?: string }[];
  };
  if (!res.ok) {
    return { ok: false, error: payload.error ?? "Błąd wysyłki." };
  }
  const failed = (payload.results ?? []).filter((r) => !r.ok);
  if (failed.length > 0) {
    return {
      ok: false,
      error: `Nie udało się wysłać: ${failed.map((f) => f.to).join(", ")}`,
    };
  }
  return { ok: true };
}

export async function saveParty(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const org = await requireOrganizer();
  if (!org) {
    return { ok: false, error: "Tylko organizator może edytować imprezę." };
  }
  const { supabase } = org;
  const startsRaw = String(formData.get("starts_at") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  let startsAt: string | null = null;
  if (startsRaw) {
    const d = new Date(startsRaw);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, error: "Nieprawidłowa data lub godzina imprezy." };
    }
    startsAt = d.toISOString();
  }
  if (location.length > 200) {
    return { ok: false, error: "Lokalizacja: maks. 200 znaków." };
  }
  if (notes.length > 1000) {
    return { ok: false, error: "Notatki: maks. 1000 znaków." };
  }
  if (label.length > 100) {
    return { ok: false, error: "Etykieta: maks. 100 znaków." };
  }
  const { error } = await supabase
    .from("party")
    .upsert(
      {
        id: 1,
        starts_at: startsAt,
        location: location || null,
        notes: notes || null,
        label: label || "imprezy",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function sendReadyReminders(
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const org = await requireOrganizer();
  if (!org) {
    return { ok: false, error: "Tylko organizator może wysyłać przypomnienia." };
  }
  const { supabase } = org;
  const { data, error } = await supabase.rpc("not_ready_emails");
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as { email: string; full_name: string }[];
  if (rows.length === 0) {
    return { ok: false, error: "Wszyscy uczestnicy są już gotowi." };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Brak sesji." };

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-reminders`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        reminders: rows.map((r) => ({ to: r.email, name: r.full_name })),
      }),
    }
  );
  const payload = (await res.json()) as {
    error?: string;
    results?: { to: string; ok: boolean; error?: string }[];
  };
  if (!res.ok) {
    return { ok: false, error: payload.error ?? "Błąd wysyłki." };
  }
  const failed = (payload.results ?? []).filter((r) => !r.ok);
  if (failed.length > 0) {
    return {
      ok: false,
      error: `Nie udało się wysłać: ${failed.map((f) => f.to).join(", ")}`,
    };
  }
  return { ok: true };
}
