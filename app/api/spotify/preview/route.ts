import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";
import { findItunesPreview } from "@/lib/itunes";
import { getTrack } from "@/lib/spotify";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });
  }
  if (isRateLimited(`spotify-preview:${user.id}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "Zbyt wiele podglądów. Poczekaj chwilę." },
      { status: 429 }
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie." }, { status: 400 });
  }
  const b = body as { trackId?: unknown; name?: unknown; artists?: unknown };
  const trackId = typeof b.trackId === "string" ? b.trackId.trim() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const artists = typeof b.artists === "string" ? b.artists.trim() : "";
  if (!trackId || !name || !artists) {
    return NextResponse.json({ error: "Nieprawidłowy utwór." }, { status: 400 });
  }
  try {
    const track = await getTrack(trackId);
    if (track.previewUrl) {
      return NextResponse.json({ previewUrl: track.previewUrl });
    }
  } catch {
    // Spotify niedostępne albo brak preview_url — idziemy do iTunes
  }
  try {
    const previewUrl = await findItunesPreview(name, artists);
    return NextResponse.json({ previewUrl });
  } catch {
    return NextResponse.json(
      { error: "Podgląd teraz nie działa." },
      { status: 502 }
    );
  }
}
