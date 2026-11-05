"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.from("wishes").insert({
    user_id: user.id,
    text,
    link: link || null,
    price,
  });
  if (error) return { ok: false, error: error.message };
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
  if ((count ?? 0) < 1) {
    return { ok: false, error: "Dodaj przynajmniej jedno życzenie." };
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

export async function markThreadRead(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const lotteryType = Number(formData.get("lottery_type"));
  const drawerId = String(formData.get("drawer_id") ?? "");
  const draweeId = String(formData.get("drawee_id") ?? "");
  if (!Number.isInteger(lotteryType) || !drawerId || !draweeId) return;
  await touchThreadRead(supabase, user.id, lotteryType, drawerId, draweeId);
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
