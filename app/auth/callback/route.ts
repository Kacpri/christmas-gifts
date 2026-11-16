import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        try {
          await supabase.rpc("ensure_profile");
        } catch {
          // samonaprawiajacy profil jest best-effort; nie blokuje logowania
        }
        const picture = user.user_metadata?.picture;
        if (typeof picture === "string" && picture) {
          await supabase
            .from("profiles")
            .update({ oauth_avatar_url: picture })
            .eq("id", user.id);
        }
      }
      return NextResponse.redirect(`${origin}/`);
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}
