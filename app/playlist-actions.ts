"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addTracks,
  createPlaylist,
  getOrgSpotifyId,
  getPlaylist,
  probePermissions,
  removeTracks,
  SpotifyError,
} from "@/lib/spotify";
import { createClient } from "@/lib/supabase/server";

export type PlaylistActionResult = { ok: boolean; error?: string };

const MIN_TRACKS_PER_USER = 1;
const MAX_TRACKS_PER_USER = 20;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
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

function parsePlaylistId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const match = s.match(
    /(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/|spotify:playlist:)([a-zA-Z0-9]{22})/
  );
  if (match) return match[1];
  if (/^[a-zA-Z0-9]{22}$/.test(s)) return s;
  return null;
}

async function getPartySettings(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ playlistId: string | null; tracksPerUser: number }> {
  const { data } = await supabase
    .from("party")
    .select("spotify_playlist_id, tracks_per_user")
    .eq("id", 1)
    .maybeSingle();
  return {
    playlistId: data?.spotify_playlist_id ?? null,
    tracksPerUser:
      typeof data?.tracks_per_user === "number" ? data.tracks_per_user : 5,
  };
}

async function getPartyPlaylistId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const { playlistId } = await getPartySettings(supabase);
  return playlistId;
}

export async function createSpotifyPlaylist(
  _prev: PlaylistActionResult,
  formData: FormData
): Promise<PlaylistActionResult> {
  const org = await requireOrganizer();
  if (!org) {
    return { ok: false, error: "Tylko organizator może zarządzać playlistą." };
  }
  const { supabase } = org;
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 100) {
    return { ok: false, error: "Nazwa playlisty: 1–100 znaków." };
  }
  try {
    const playlist = await createPlaylist(name);
    const { error } = await supabase
      .from("party")
      .upsert(
        {
          id: 1,
          spotify_playlist_id: playlist.id,
          spotify_playlist_name: name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    if (error) return { ok: false, error: error.message };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof SpotifyError
          ? e.message
          : "Nie udało się utworzyć playlisty.",
    };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function attachSpotifyPlaylist(
  _prev: PlaylistActionResult,
  formData: FormData
): Promise<PlaylistActionResult> {
  const org = await requireOrganizer();
  if (!org) {
    return { ok: false, error: "Tylko organizator może zarządzać playlistą." };
  }
  const { supabase } = org;
  const raw = String(formData.get("playlist") ?? "").trim();
  const id = parsePlaylistId(raw);
  if (!id) {
    return {
      ok: false,
      error: "Wklej link do playlisty (open.spotify.com/playlist/…) lub jej ID.",
    };
  }
  try {
    const playlist = await getPlaylist(id);
    const orgSpotifyId = await getOrgSpotifyId();
    if (
      orgSpotifyId &&
      playlist.ownerId &&
      playlist.ownerId !== orgSpotifyId
    ) {
      return {
        ok: false,
        error:
          playlist.ownerName
            ? `To playlista użytkownika ${playlist.ownerName}. Podłącz playlistę z własnego konta Spotify (zalogowano jako ${orgSpotifyId}).`
            : "To playlista innego użytkownika. Podłącz playlistę z własnego konta Spotify.",
      };
    }
    const { error } = await supabase
      .from("party")
      .upsert(
        {
          id: 1,
          spotify_playlist_id: playlist.id,
          spotify_playlist_name: playlist.name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    if (error) return { ok: false, error: error.message };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof SpotifyError
          ? `Nie można podpiąć tej playlisty: ${e.message}`
          : "Nie można podpiąć tej playlisty.",
    };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function disconnectSpotify(
  _prev: PlaylistActionResult,
  _formData: FormData
): Promise<PlaylistActionResult> {
  const org = await requireOrganizer();
  if (!org) {
    return { ok: false, error: "Tylko organizator może zarządzać playlistą." };
  }
  const { supabase, user } = org;
  const { error } = await supabase
    .from("spotify_accounts")
    .delete()
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  const { error: partyError } = await supabase
    .from("party")
    .update({
      spotify_playlist_id: null,
      spotify_playlist_name: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (partyError) return { ok: false, error: partyError.message };
  revalidatePath("/");
  return { ok: true };
}

export async function probeSpotifyPermissions(
  _prev: PlaylistActionResult,
  _formData: FormData
): Promise<PlaylistActionResult> {
  const org = await requireOrganizer();
  if (!org) {
    return { ok: false, error: "Tylko organizator może zarządzać playlistą." };
  }
  try {
    const results = await probePermissions();
    return { ok: true, error: results.join("  •  ") };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof SpotifyError
          ? e.message
          : "Nie udało się przetestować uprawnień.",
    };
  }
}

export async function updateTrackLimit(
  _prev: PlaylistActionResult,
  formData: FormData
): Promise<PlaylistActionResult> {
  const org = await requireOrganizer();
  if (!org) {
    return { ok: false, error: "Tylko organizator może zarządzać playlistą." };
  }
  const { supabase } = org;
  const limit = Number(formData.get("limit"));
  if (
    !Number.isInteger(limit) ||
    limit < MIN_TRACKS_PER_USER ||
    limit > MAX_TRACKS_PER_USER
  ) {
    return {
      ok: false,
      error: `Limit: liczba całkowita ${MIN_TRACKS_PER_USER}–${MAX_TRACKS_PER_USER}.`,
    };
  }
  const { error } = await supabase
    .from("party")
    .update({
      tracks_per_user: limit,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true };
}

export async function addPlaylistTrack(
  _prev: PlaylistActionResult,
  formData: FormData
): Promise<PlaylistActionResult> {
  const { supabase, user } = await requireUser();
  const trackId = String(formData.get("track_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const artists = String(formData.get("artists") ?? "").trim();
  const trackUrl = String(formData.get("track_url") ?? "").trim();
  const durationMsRaw = Number(formData.get("duration_ms"));
  const durationMs =
    Number.isInteger(durationMsRaw) && durationMsRaw > 0
      ? durationMsRaw
      : null;
  if (!trackId || !name || !artists) {
    return { ok: false, error: "Nieprawidłowy utwór." };
  }
  const { playlistId, tracksPerUser } = await getPartySettings(supabase);
  if (!playlistId) {
    return { ok: false, error: "Organizator nie utworzył jeszcze playlisty." };
  }
  const { count, error: countError } = await supabase
    .from("playlist_tracks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) return { ok: false, error: countError.message };
  if ((count ?? 0) >= tracksPerUser) {
    return { ok: false, error: `Maksymalnie ${tracksPerUser} piosenek.` };
  }
  const { data: existing } = await supabase
    .from("playlist_tracks")
    .select("id")
    .eq("track_id", trackId)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "Ten utwór jest już na liście." };
  }
  const { data: inserted, error } = await supabase
    .from("playlist_tracks")
    .insert({
      user_id: user.id,
      track_id: trackId,
      name,
      artists,
      track_url: trackUrl || null,
      duration_ms: durationMs,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Nie udało się dodać." };
  }
  try {
    await addTracks(playlistId, [trackId]);
    await supabase
      .from("playlist_tracks")
      .update({ status: "ok" })
      .eq("id", inserted.id);
  } catch (e) {
    await supabase
      .from("playlist_tracks")
      .update({ status: "error" })
      .eq("id", inserted.id);
    revalidatePath("/");
    return {
      ok: false,
      error:
        e instanceof SpotifyError
          ? `Utwór jest na liście, ale Spotify zwrócił błąd: ${e.message}. Kliknij „Ponów”.`
          : "Utwór jest na liście, ale nie udało się dodać go na Spotify. Kliknij „Ponów”.",
    };
  }
  revalidatePath("/");
  return { ok: true };
}

export async function removePlaylistTrack(
  _prev: PlaylistActionResult,
  formData: FormData
): Promise<PlaylistActionResult> {
  const { supabase, user } = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) {
    return { ok: false, error: "Nieprawidłowy utwór." };
  }
  const { data: row } = await supabase
    .from("playlist_tracks")
    .select("id, user_id, track_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Utwór nie istnieje." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_organizer")
    .eq("id", user.id)
    .single();
  if (row.user_id !== user.id && !profile?.is_organizer) {
    return { ok: false, error: "Możesz usuwać tylko własne utwory." };
  }
  const { error } = await supabase
    .from("playlist_tracks")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (row.status === "ok") {
    const playlistId = await getPartyPlaylistId(supabase);
    if (playlistId) {
      try {
        await removeTracks(playlistId, [row.track_id]);
      } catch {
        // utwór zniknął z listy; sprzątanie po stronie Spotify jest best-effort
      }
    }
  }
  revalidatePath("/");
  return { ok: true };
}

export async function retryPlaylistTrack(
  _prev: PlaylistActionResult,
  formData: FormData
): Promise<PlaylistActionResult> {
  const { supabase, user } = await requireUser();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) {
    return { ok: false, error: "Nieprawidłowy utwór." };
  }
  const { data: row } = await supabase
    .from("playlist_tracks")
    .select("id, user_id, track_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Utwór nie istnieje." };
  if (row.user_id !== user.id) {
    return { ok: false, error: "Możesz ponawiać tylko własne utwory." };
  }
  const playlistId = await getPartyPlaylistId(supabase);
  if (!playlistId) {
    return { ok: false, error: "Organizator nie utworzył jeszcze playlisty." };
  }
  try {
    await addTracks(playlistId, [row.track_id]);
    await supabase
      .from("playlist_tracks")
      .update({ status: "ok" })
      .eq("id", id);
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof SpotifyError
          ? e.message
          : "Nie udało się dodać utworu na Spotify.",
    };
  }
  revalidatePath("/");
  return { ok: true };
}
