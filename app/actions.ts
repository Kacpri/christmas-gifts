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
