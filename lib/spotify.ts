import { createClient } from "@/lib/supabase/server";
import { findItunesPreview } from "@/lib/itunes";

const API = "https://api.spotify.com/v1";
const AUTH = "https://accounts.spotify.com";

export const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
].join(" ");

const REQUIRED_SCOPES = SPOTIFY_SCOPES.split(" ");

function tokenScopes(token: string): string[] {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64").toString("utf8")
    ) as { scope?: string };
    return (payload.scope ?? "").split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

export class SpotifyError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: string;
  url: string | null;
  image: string | null;
  coverUrl: string | null;
  durationMs: number | null;
  previewUrl: string | null;
};

type OrgAccount = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  display_name: string | null;
  spotify_id: string | null;
};

type RawTrack = {
  id: string;
  name: string;
  artists?: { name: string }[];
  external_urls?: { spotify?: string };
  album?: { images?: { url: string; width?: number; height?: number }[] };
  duration_ms?: number;
  preview_url?: string | null;
};

function tokenParams(clientId: string, clientSecret: string) {
  return new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
}

async function readSpotifyError(
  res: Response,
  url: string
): Promise<SpotifyError> {
  let body = "";
  try {
    body = await res.text();
  } catch {
    // brak ciała
  }
  console.error(
    "[spotify] nieudany request:",
    url,
    res.status,
    body.slice(0, 500)
  );
  let message = `Spotify: HTTP ${res.status}`;
  try {
    const data = JSON.parse(body) as {
      error?: { message?: string; reason?: string };
    };
    if (data.error?.message) message = `Spotify: ${data.error.message}`;
    else if (data.error?.reason)
      message = `Spotify: HTTP ${res.status} (${data.error.reason})`;
  } catch {
    if (body) message = `Spotify: HTTP ${res.status} — ${body.slice(0, 200)}`;
  }
  if (body) message += ` [${body.slice(0, 120)}]`;
  const hdr = [
    res.headers.get("server") && `server: ${res.headers.get("server")}`,
    res.headers.get("via") && `via: ${res.headers.get("via")}`,
    res.headers.get("x-vercel-id") && `vercel: ${res.headers.get("x-vercel-id")}`,
    res.headers.get("x-amz-request-id") &&
      `aws: ${res.headers.get("x-amz-request-id")}`,
  ]
    .filter(Boolean)
    .join(", ");
  if (hdr) message += ` (${hdr})`;
  return new SpotifyError(message, res.status);
}

async function apiFetch(
  path: string,
  init: RequestInit,
  token: string
): Promise<Response> {
  const url = `${API}${path}`;
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) throw await readSpotifyError(res, url);
  return res;
}

export function authorizeUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
  });
  return `${AUTH}/authorize?${params.toString()}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new SpotifyError("Spotify nie jest skonfigurowany.");
  }
  const body = tokenParams(clientId, clientSecret);
  body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("redirect_uri", redirectUri);
    const url = `${AUTH}/api/token`;
    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw await readSpotifyError(res, url);
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new SpotifyError("Spotify nie jest skonfigurowany.");
  }
  const body = tokenParams(clientId, clientSecret);
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  const url = `${AUTH}/api/token`;
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw await readSpotifyError(res, url);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

export async function getMe(
  accessToken: string
): Promise<{ id: string; display_name: string | null }> {
  const res = await apiFetch("/me", { method: "GET" }, accessToken);
  return (await res.json()) as { id: string; display_name: string | null };
}

export async function getOrgAccount(): Promise<OrgAccount | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("spotify_org_account");
  if (error) throw new SpotifyError(error.message);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return row as OrgAccount;
}

async function ensureValidToken(acc: OrgAccount): Promise<string> {
  const expiresMs = new Date(acc.expires_at).getTime();
  if (Number.isFinite(expiresMs) && expiresMs - Date.now() > 60_000) {
    return acc.access_token;
  }
  const refreshed = await refreshAccessToken(acc.refresh_token);
  const supabase = await createClient();
  await supabase.rpc("spotify_save_org_token", {
    p_user_id: acc.user_id,
    p_access_token: refreshed.access_token,
    p_refresh_token: refreshed.refresh_token ?? acc.refresh_token,
    p_expires_at: new Date(
      Date.now() + refreshed.expires_in * 1000
    ).toISOString(),
  });
  return refreshed.access_token;
}

export async function orgToken(): Promise<string | null> {
  const acc = await getOrgAccount();
  if (!acc) return null;
  let token: string;
  try {
    token = await ensureValidToken(acc);
  } catch (e) {
    if (e instanceof SpotifyError && e.status === 400) {
      return null;
    }
    throw e;
  }
  // Spotify zwraca tokeny nieprzezroczyste (nie-JWT) — scope da się
  // zweryfikować tylko dla JWT; dla pozostałych formatów sprawdzanie
  // pominij (brak uprawnień ujawni 403 z API).
  if (token.startsWith("eyJ") && token.split(".").length === 3) {
    const scopes = tokenScopes(token);
    const missing = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
    if (missing.length > 0) {
      throw new SpotifyError(
        `Token Spotify nie ma wymaganych uprawnień (brakuje: ${missing.join(
          ", "
        )}). Połącz Spotify ponownie.`
      );
    }
  }
  return token;
}

function requireToken(token: string | null): string {
  if (!token) {
    throw new SpotifyError(
      "Organizator nie połączył jeszcze konta Spotify."
    );
  }
  return token;
}

// Spotify zwraca okladki w 3 rozmiarach (640/300/100 px) —
// dobieramy najblizsza zadana szerokosci (dla swiezego obrazu
// przy 2x/3x DPI wystarczy 100 px do wyswietlenia i 300 px do
// zapisu w Storage).
function pickImage(
  images: { url: string; width?: number }[],
  target: number
): string | null {
  if (images.length === 0) return null;
  const withSize = images.filter((i) => typeof i.width === "number");
  if (withSize.length === 0) return images[0].url ?? null;
  const fitting = withSize.filter((i) => (i.width ?? 0) <= target);
  const pool = fitting.length > 0 ? fitting : withSize;
  return pool.reduce((best, i) =>
    Math.abs((i.width ?? 0) - target) < Math.abs((best.width ?? 0) - target)
      ? i
      : best
  ).url;
}

function mapTrack(t: RawTrack): SpotifyTrack {
  const images = t.album?.images ?? [];
  return {
    id: t.id,
    name: t.name,
    artists: (t.artists ?? []).map((a) => a.name).join(", "),
    url: t.external_urls?.spotify ?? null,
    image: pickImage(images, 100),
    coverUrl: pickImage(images, 300),
    durationMs: t.duration_ms ?? null,
    previewUrl: t.preview_url ?? null,
  };
}

export async function searchTracks(
  query: string,
  limit = 8
): Promise<SpotifyTrack[]> {
  const token = requireToken(await orgToken());
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: String(limit),
  });
  const res = await apiFetch(`/search?${params.toString()}`, { method: "GET" }, token);
  const body = (await res.json()) as { tracks?: { items?: RawTrack[] } };
  return (body.tracks?.items ?? []).map(mapTrack);
}

export async function getTrack(id: string): Promise<SpotifyTrack> {
  const token = requireToken(await orgToken());
  const res = await apiFetch(`/tracks/${id}`, { method: "GET" }, token);
  const body = (await res.json()) as RawTrack;
  return mapTrack(body);
}

export async function createPlaylist(
  name: string
): Promise<{ id: string; url: string | null }> {
  const token = requireToken(await orgToken());
  const res = await apiFetch(
    "/me/playlists",
    { method: "POST", body: JSON.stringify({ name, public: false }) },
    token
  );
  const body = (await res.json()) as {
    id: string;
    external_urls?: { spotify?: string };
  };
  return { id: body.id, url: body.external_urls?.spotify ?? null };
}

export async function getPlaylist(
  id: string
): Promise<{
  id: string;
  name: string;
  url: string | null;
  ownerName: string | null;
  ownerId: string | null;
}> {
  const token = requireToken(await orgToken());
  const res = await apiFetch(`/playlists/${id}`, { method: "GET" }, token);
  const body = (await res.json()) as {
    id: string;
    name: string;
    external_urls?: { spotify?: string };
    owner?: { id?: string; display_name?: string };
  };
  return {
    id: body.id,
    name: body.name,
    url: body.external_urls?.spotify ?? null,
    ownerName: body.owner?.display_name ?? null,
    ownerId: body.owner?.id ?? null,
  };
}

export async function getOrgSpotifyId(): Promise<string | null> {
  const acc = await getOrgAccount();
  return acc?.spotify_id ?? null;
}

export async function probePermissions(): Promise<string[]> {
  const token = requireToken(await orgToken());
  const describe = (e: unknown) =>
    e instanceof SpotifyError ? e.message : String(e);
  const results: string[] = [];
  try {
    await apiFetch("/me", { method: "GET" }, token);
    results.push("GET /me: OK");
  } catch (e) {
    results.push(`GET /me: ${describe(e)}`);
  }
  try {
    await apiFetch("/me/playlists", { method: "GET" }, token);
    results.push("GET /me/playlists: OK");
  } catch (e) {
    results.push(`GET /me/playlists: ${describe(e)}`);
  }
  try {
    const res = await apiFetch(
      "/me/playlists",
      {
        method: "POST",
        body: JSON.stringify({ name: `probe-${Date.now()}`, public: false }),
      },
      token
    );
    const created = (await res.json()) as { id: string };
    results.push("POST /me/playlists (utwórz): OK");
    try {
      await apiFetch(`/playlists/${created.id}`, { method: "DELETE" }, token);
    } catch {
      // sprzątanie best-effort
    }
  } catch (e) {
    results.push(`POST /me/playlists (utwórz): ${describe(e)}`);
  }
  try {
    const params = new URLSearchParams({
      q: "christmas",
      type: "track",
      limit: "8",
    });
    const res = await apiFetch(`/search?${params.toString()}`, { method: "GET" }, token);
    const body = (await res.json()) as {
      tracks?: { items?: { id: string; preview_url?: string | null }[] };
    };
    const items = body.tracks?.items ?? [];
    const withPreview = items.filter((t) => t.preview_url).length;
    results.push(
      `GET /search: ${withPreview}/${items.length} utworów z preview_url`
    );
  } catch (e) {
    results.push(`GET /search (preview): ${describe(e)}`);
  }
  try {
    const url = await findItunesPreview("Last Christmas", "Wham!");
    results.push(`iTunes preview: ${url ? "OK" : "brak dopasowania"}`);
  } catch (e) {
    results.push(`iTunes preview: ${describe(e)}`);
  }
  return results;
}

export async function addTracks(
  playlistId: string,
  trackIds: string[]
): Promise<void> {
  if (trackIds.length === 0) return;
  const token = requireToken(await orgToken());
  await apiFetch(
    `/playlists/${playlistId}/items`,
    {
      method: "POST",
      body: JSON.stringify({
        uris: trackIds.map((id) => `spotify:track:${id}`),
      }),
    },
    token
  );
}

export async function removeTracks(
  playlistId: string,
  trackIds: string[]
): Promise<void> {
  if (trackIds.length === 0) return;
  const token = requireToken(await orgToken());
  await apiFetch(
    `/playlists/${playlistId}/items`,
    {
      method: "DELETE",
      body: JSON.stringify({
        items: trackIds.map((id) => ({ uri: `spotify:track:${id}` })),
      }),
    },
    token
  );
}

const COVER_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Best-effort: pobiera okładkę albumu z CDN Spotify i wgrywa do
// bucketu album-covers. Zwraca ścieżkę lub null (brak okładki /
// błąd pobrania — utwór zostaje dodany bez okładki).
export async function storeAlbumCover(
  trackId: string,
  imageUrl: string
): Promise<string | null> {
  if (!imageUrl) return null;
  let res: Response;
  try {
    res = await fetch(imageUrl, { cache: "no-store" });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type")?.split(";")[0] ?? "";
  const ext = COVER_EXT[contentType] ?? "jpg";
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > 2 * 1024 * 1024) {
    return null;
  }
  const supabase = await createClient();
  const path = `${trackId}.${ext}`;
  const { error } = await supabase.storage
    .from("album-covers")
    .upload(path, new Blob([bytes], { type: contentType || "image/jpeg" }), {
      contentType: contentType || "image/jpeg",
      upsert: true,
    });
  if (error) {
    console.error("[spotify] upload okładki:", error.message);
    return null;
  }
  return path;
}
