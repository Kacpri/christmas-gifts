import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { authorizeUrl } from "@/lib/spotify";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
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
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return NextResponse.json(
      {
        error:
          "Spotify nie jest skonfigurowany. Ustaw SPOTIFY_CLIENT_ID i SPOTIFY_CLIENT_SECRET.",
      },
      { status: 503 }
    );
  }
  const redirectUri = `${origin}/spotify/callback`;
  return NextResponse.redirect(
    authorizeUrl(process.env.SPOTIFY_CLIENT_ID, redirectUri)
  );
}
