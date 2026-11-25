import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";
import { getTrack, searchTracks, SpotifyError } from "@/lib/spotify";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nie zalogowano." }, { status: 401 });
  }
  if (isRateLimited(`spotify-search:${user.id}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "Zbyt wiele wyszukiwań. Poczekaj chwilę." },
      { status: 429 }
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Nieprawidłowe żądanie." },
      { status: 400 }
    );
  }
  const query =
    typeof (body as { query?: unknown })?.query === "string"
      ? ((body as { query: string }).query).trim()
      : "";
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json(
      { error: "Wpisz co najmniej 2 znaki." },
      { status: 400 }
    );
  }
  try {
    const trackMatch = query.match(
      /(?:open\.spotify\.com\/track\/|spotify:track:)([a-zA-Z0-9]{22})/
    );
    if (trackMatch) {
      const track = await getTrack(trackMatch[1]);
      return NextResponse.json({ tracks: [track] });
    }
    const tracks = await searchTracks(query, 8);
    return NextResponse.json({ tracks });
  } catch (e) {
    const message =
      e instanceof SpotifyError
        ? e.message
        : "Wyszukiwanie teraz nie działa. Spróbuj później.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
