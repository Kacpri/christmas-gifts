import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { exchangeCode, getMe } from "@/lib/spotify";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { origin } = url;
  const code = url.searchParams.get("code");
  const failed = () => NextResponse.redirect(`${origin}/?spotify=error`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_organizer")
    .eq("id", user.id)
    .single();
  if (!profile?.is_organizer) {
    return NextResponse.redirect(`${origin}/`);
  }
  if (!code) return failed();

  try {
    const tokens = await exchangeCode(code, `${origin}/spotify/callback`);
    console.error(
      "[spotify] callback: kod wymieniony, scope w odpowiedzi:",
      tokens.scope ?? "(brak pola scope)"
    );
    const me = await getMe(tokens.access_token);
    console.error(
      "[spotify] callback: /me ok, spotify_id:",
      me.id,
      "display_name:",
      me.display_name ?? "(brak)"
    );
    const { error } = await supabase
      .from("spotify_accounts")
      .upsert(
        {
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          spotify_id: me.id,
          display_name: me.display_name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (error) {
      console.error("[spotify] callback: błąd zapisu konta:", error.message);
      return failed();
    }
    return NextResponse.redirect(`${origin}/?spotify=ok`);
  } catch (e) {
    console.error("[spotify] callback: błąd:", e);
    return failed();
  }
}
