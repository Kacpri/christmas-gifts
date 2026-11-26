"use client";

import {
  useEffect,
  useRef,
  useState,
  useActionState,
} from "react";

import {
  addPlaylistTrack,
  attachSpotifyPlaylist,
  createSpotifyPlaylist,
  disconnectSpotify,
  probeSpotifyPermissions,
  removePlaylistTrack,
  retryPlaylistTrack,
  updateTrackLimit,
  type PlaylistActionResult,
} from "@/app/playlist-actions";
import { ConfirmDialog, type ConfirmState } from "@/components/confirm-dialog";
import { plural } from "@/lib/format";
import {
  artistMatches,
  SIMILAR_TITLE_THRESHOLD,
  titleSimilarity,
} from "@/lib/title-match";

export type PlaylistTrackItem = {
  id: number;
  trackId: string;
  name: string;
  artists: string;
  trackUrl: string | null;
  durationMs: number | null;
  coverUrl: string | null;
  addedByName: string;
  addedByAvatarUrl: string | null;
  isMine: boolean;
  status: "pending" | "ok" | "error";
  addedAt: string;
};

export type PlaylistPanelData = {
  isOrganizer: boolean;
  spotifyLinked: boolean;
  spotifyDisplayName: string | null;
  playlistId: string | null;
  playlistName: string | null;
  playlistUrl: string | null;
  tracks: PlaylistTrackItem[];
  myCount: number;
  myLimit: number;
  myName: string;
  myAvatarUrl: string | null;
};

type SearchTrack = {
  id: string;
  name: string;
  artists: string;
  url: string | null;
  image: string | null;
  coverUrl: string | null;
  durationMs: number | null;
};

type PendingAdd = {
  trackId: string;
  name: string;
  artists: string;
  image: string | null;
};

const empty: PlaylistActionResult = { ok: false };
const DEFAULT_PLAYLIST_NAME = "Świąteczna Tablica – Playlista";

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

export function PlaylistPanel({ playlist }: { playlist: PlaylistPanelData }) {
  const [createState, createAction, creating] = useActionState(
    createSpotifyPlaylist,
    empty
  );
  const [attachState, attachAction, attaching] = useActionState(
    attachSpotifyPlaylist,
    empty
  );
  const [disconnectState, disconnectAction, disconnecting] = useActionState(
    disconnectSpotify,
    empty
  );
  const [addState, addAction, adding] = useActionState(addPlaylistTrack, empty);
  const [removeState, removeAction, removing] = useActionState(
    removePlaylistTrack,
    empty
  );
  const [retryState, retryAction, retrying] = useActionState(
    retryPlaylistTrack,
    empty
  );
  const [probeState, probeAction, probing] = useActionState(
    probeSpotifyPermissions,
    empty
  );
  const [limitState, limitAction, savingLimit] = useActionState(
    updateTrackLimit,
    empty
  );
  const [limitValue, setLimitValue] = useState(String(playlist.myLimit));
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);
  const [hiddenId, setHiddenId] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchTrack[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [authBanner, setAuthBanner] = useState<"ok" | "error" | null>(null);
  const searchSeq = useRef(0);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewSeq = useRef(0);

  function ensureCtx(): AudioContext {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }

  function stopSource() {
    const src = sourceRef.current;
    if (src) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        // juz zatrzymany
      }
      sourceRef.current = null;
    }
  }

  function stopPreview() {
    previewSeq.current++;
    stopSource();
    setPreviewingId(null);
    setPreviewLoadingId(null);
    setPreviewError(null);
  }

  async function handlePreview(track: SearchTrack) {
    if (previewingId === track.id) {
      stopPreview();
      return;
    }
    stopPreview();
    const ctx = ensureCtx();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const seq = ++previewSeq.current;
    setPreviewLoadingId(track.id);
    try {
      const res = await fetch("/api/spotify/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: track.id,
          name: track.name,
          artists: track.artists,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setPreviewError(`Podgląd: ${err?.error ?? res.status}`);
        return;
      }
      if (seq !== previewSeq.current) return;
      const audioBuf = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(audioBuf);
      if (seq !== previewSeq.current) return;
      if (ctx.state !== "running") {
        await ctx.resume().catch(() => {});
      }
      if (ctx.state !== "running") {
        setPreviewError("Przeglądarka zablokowała odtwarzanie.");
        return;
      }
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      src.onended = () => {
        if (sourceRef.current === src) {
          sourceRef.current = null;
          setPreviewingId(null);
        }
      };
      sourceRef.current = src;
      src.start();
      setPreviewingId(track.id);
    } catch (e) {
      setPreviewError(
        `Podgląd nie działa (${
          e instanceof Error ? `${e.name}: ${e.message}` : "błąd"
        }).`
      );
    } finally {
      if (seq === previewSeq.current) setPreviewLoadingId(null);
    }
  }

  useEffect(() => {
    return () => {
      stopPreview();
      void ctxRef.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("spotify");
    if (param === "ok" || param === "error") {
      setAuthBanner(param);
      window.history.replaceState({}, "", window.location.pathname);
      const t = window.setTimeout(() => setAuthBanner(null), 6000);
      return () => window.clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    setLimitValue(String(playlist.myLimit));
  }, [playlist.myLimit]);

  useEffect(() => {
    setPendingAdd((prev) =>
      prev &&
      playlist.tracks.some((t) => t.isMine && t.trackId === prev.trackId)
        ? null
        : prev
    );
  }, [playlist.tracks]);

  useEffect(() => {
    if (!addState.ok && addState.error) setPendingAdd(null);
  }, [addState]);

  useEffect(() => {
    if (removeState.ok || removeState.error) setHiddenId(null);
  }, [removeState]);

  useEffect(() => {
    function onClick(e: globalThis.MouseEvent) {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    stopPreview();
    const q = query.trim();
    setDropdownOpen(q.length > 0);
    if (q.length < 2) {
      setResults(null);
      setSearchError(null);
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchError(null);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/spotify/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        const body = (await res.json()) as {
          tracks?: SearchTrack[];
          error?: string;
        };
        if (seq !== searchSeq.current) return;
        if (!res.ok) {
          setResults(null);
          setSearchError(body.error ?? "Wyszukiwanie nie działa.");
        } else {
          setResults(body.tracks ?? []);
        }
      } catch {
        if (seq !== searchSeq.current) return;
        setResults(null);
        setSearchError("Wyszukiwanie nie działa. Spróbuj później.");
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  function handlePick(track: SearchTrack) {
    const fd = new FormData();
    fd.set("track_id", track.id);
    fd.set("name", track.name);
    fd.set("artists", track.artists);
    fd.set("track_url", track.url ?? "");
    fd.set("cover_url", track.coverUrl ?? track.image ?? "");
    if (track.durationMs != null) {
      fd.set("duration_ms", String(track.durationMs));
    }
    setPendingAdd({
      trackId: track.id,
      name: track.name,
      artists: track.artists,
      image: track.image,
    });
    stopPreview();
    addAction(fd);
    setQuery("");
    setResults(null);
    setDropdownOpen(false);
  }

  function handleRemove(track: PlaylistTrackItem) {
    setConfirm({
      message: `Usunąć „${track.name}” z playlisty?`,
      confirmLabel: "Usuń",
      tone: "danger",
      onConfirm: () => {
        const fd = new FormData();
        fd.set("id", String(track.id));
        setHiddenId(track.id);
        removeAction(fd);
      },
    });
  }

  const hasPlaylist = playlist.playlistId != null;
  const visibleTracks = playlist.tracks.filter((t) => t.id !== hiddenId);
  const effectiveMyCount = playlist.myCount + (pendingAdd ? 1 : 0);
  const totalDurationMs = visibleTracks.reduce(
    (sum, t) => sum + (t.durationMs ?? 0),
    0
  );
  const hasDuration = visibleTracks.some((t) => t.durationMs != null);

  return (
    <div className="flex flex-col gap-4">
      {authBanner && (
        <div
          className={`rounded-[10px] px-3 py-2.5 text-sm ${
            authBanner === "ok"
              ? "bg-sage-100 text-accent-deep dark:bg-sage-300 dark:text-[#e6f6ec]"
              : "bg-danger-soft text-danger"
          }`}
        >
          {authBanner === "ok"
            ? "Spotify zostało połączone."
            : "Nie udało się połączyć Spotify. Spróbuj ponownie."}
        </div>
      )}

      {playlist.isOrganizer && (
        <div className="flex flex-col gap-3">
          {!playlist.spotifyLinked ? (
            <div className="flex flex-col gap-2 rounded-[10px] border border-dashed border-input-line bg-mist p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                Połącz konto Spotify, aby utworzyć wspólną playlistę.
              </p>
              <a
                href="/spotify/connect"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                <SpotifyIcon />
                Połącz Spotify
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-[10px] bg-mist px-3 py-2.5">
              <p className="flex min-w-0 items-center gap-2 text-sm text-ink">
                <SpotifyIcon />
                <span className="truncate">
                  Połączono jako{" "}
                  <span className="font-medium">
                    {playlist.spotifyDisplayName ?? "konto Spotify"}
                  </span>
                </span>
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => probeAction(new FormData())}
                  disabled={probing}
                  className="rounded-lg border border-input-line bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-mist disabled:opacity-50"
                >
                  {probing ? "Testowanie…" : "Testuj uprawnienia"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirm({
                      message:
                        "Rozłączyć konto Spotify? Wspólna playlista przestanie działać, dopóki nie połączysz konta ponownie.",
                      confirmLabel: "Rozłącz",
                      tone: "danger",
                      onConfirm: () => disconnectAction(new FormData()),
                    })
                  }
                  disabled={disconnecting}
                  className="rounded-lg border border-input-line bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-mist disabled:opacity-50"
                >
                  {disconnecting ? "Rozłączanie…" : "Rozłącz"}
                </button>
              </div>
            </div>
          )}
          {probeState.error && (
            <div className="rounded-[10px] bg-mist px-3 py-2.5 text-xs leading-relaxed text-ink">
              {probeState.error}
            </div>
          )}
          {!disconnectState.ok && disconnectState.error && (
            <p className="text-sm text-red-600">{disconnectState.error}</p>
          )}

          <div className="flex items-center justify-between gap-2 rounded-[10px] bg-mist px-3 py-2.5">
            <label htmlFor="tracks-limit" className="text-sm text-ink">
              Limit piosenek na osobę
            </label>
            <div className="flex shrink-0 items-center gap-2">
              <input
                id="tracks-limit"
                type="number"
                min={1}
                max={20}
                value={limitValue}
                onChange={(e) => setLimitValue(e.target.value)}
                className="w-16 rounded-lg border border-input-line bg-surface px-2 py-1.5 text-sm text-ink"
              />
              <button
                type="button"
                onClick={() => {
                  const fd = new FormData();
                  fd.set("limit", limitValue);
                  limitAction(fd);
                }}
                disabled={savingLimit}
                className="rounded-lg border border-input-line bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-mist disabled:opacity-50"
              >
                {savingLimit ? "Zapisywanie…" : "Zapisz"}
              </button>
            </div>
          </div>
          {limitState.error && (
            <p className="text-sm text-red-600">{limitState.error}</p>
          )}
          {limitState.ok && (
            <p className="text-sm text-accent">Zapisano limit.</p>
          )}

          {playlist.spotifyLinked && !hasPlaylist && (
            <div className="flex flex-col gap-3 rounded-[10px] bg-mist p-3">
              <h4 className="text-sm font-semibold text-ink">
                Utwórz wspólną playlistę
              </h4>
              <form
                action={createAction}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <div className="flex flex-1 flex-col gap-1.5">
                  <label
                    htmlFor="playlist-name"
                    className="text-[13px] font-medium text-faint"
                  >
                    Nazwa
                  </label>
                  <input
                    id="playlist-name"
                    name="name"
                    defaultValue={DEFAULT_PLAYLIST_NAME}
                    required
                    maxLength={100}
                    autoComplete="off"
                    className="w-full rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex min-w-[152px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep"
                >
                  {creating ? "Tworzenie…" : "Utwórz playlistę"}
                </button>
              </form>
              {!createState.ok && createState.error && (
                <p className="text-sm text-red-600">{createState.error}</p>
              )}
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-line" aria-hidden />
                <span className="text-xs text-muted">lub</span>
                <span className="h-px flex-1 bg-line" aria-hidden />
              </div>
              <form
                action={attachAction}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <div className="flex flex-1 flex-col gap-1.5">
                  <label
                    htmlFor="playlist-attach"
                    className="text-[13px] font-medium text-faint"
                  >
                    Istniejąca playlista
                  </label>
                  <input
                    id="playlist-attach"
                    name="playlist"
                    placeholder="https://open.spotify.com/playlist/…"
                    autoComplete="off"
                    className="w-full rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
                  />
                </div>
                <button
                  type="submit"
                  disabled={attaching}
                  className="inline-flex min-w-[152px] items-center justify-center rounded-xl border border-input-line bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-mist disabled:opacity-50"
                >
                  {attaching ? "Podpinanie…" : "Podłącz"}
                </button>
              </form>
              {!attachState.ok && attachState.error && (
                <p className="text-sm text-red-600">{attachState.error}</p>
              )}
            </div>
          )}

          {playlist.spotifyLinked && hasPlaylist && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 text-sm text-ink">
                  <MusicNoteIcon />
                  <span className="truncate font-medium">
                    {playlist.playlistName ?? "Playlista"}
                  </span>
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAttachOpen((o) => !o)}
                    className="rounded-lg border border-input-line bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-mist"
                  >
                    Podłącz inną
                  </button>
                  {playlist.playlistUrl && (
                    <a
                      href={playlist.playlistUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-input-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-mist"
                    >
                      <ExternalLinkIcon />
                      Otwórz w Spotify
                    </a>
                  )}
                </div>
              </div>
              {attachOpen && (
                <form
                  action={attachAction}
                  className="flex flex-col gap-3 rounded-[10px] bg-mist p-3 sm:flex-row sm:items-end"
                >
                  <div className="flex flex-1 flex-col gap-1.5">
                    <label
                      htmlFor="playlist-attach-2"
                      className="text-[13px] font-medium text-faint"
                    >
                      Link do playlisty
                    </label>
                    <input
                      id="playlist-attach-2"
                      name="playlist"
                      placeholder="https://open.spotify.com/playlist/…"
                      autoComplete="off"
                      className="w-full rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={attaching}
                    className="inline-flex min-w-[152px] items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                  >
                    {attaching ? "Podpinanie…" : "Podłącz"}
                  </button>
                </form>
              )}
              {!attachState.ok && attachState.error && attachOpen && (
                <p className="text-sm text-red-600">{attachState.error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {hasPlaylist ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm text-muted">
              Wspólna playlista — każdy dodaje do {playlist.myLimit}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-medium text-muted">
                {visibleTracks.length}{" "}
                {plural(visibleTracks.length, [
                  "piosenka",
                  "piosenki",
                  "piosenek",
                ])}
                {hasDuration ? ` • ${formatDuration(totalDurationMs)}` : ""}
              </span>
              <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-accent dark:bg-sage-300 dark:text-[#e6f6ec]">
                {effectiveMyCount}/{playlist.myLimit}
              </span>
            </div>
          </div>

          <div ref={searchBoxRef} className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden
            >
              <SearchIcon />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (results && results.length > 0) setDropdownOpen(true);
              }}
              placeholder="Szukaj piosenki… albo wklej link z Spotify"
              aria-label="Szukaj piosenki"
              autoComplete="off"
              className="w-full rounded-xl border border-input-line bg-surface py-2.5 pl-10 pr-3.5 text-sm text-ink placeholder:text-placeholder"
            />
            {dropdownOpen && (
              <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-[10px] border border-line bg-surface shadow-lg">
                {searching && (
                  <p className="px-3 py-2.5 text-sm text-muted">Szukanie…</p>
                )}
                {!searching && searchError && (
                  <p className="px-3 py-2.5 text-sm text-red-600">
                    {searchError}
                  </p>
                )}
                {!searching && !searchError && results && (
                  <>
                    {results.length === 0 && (
                      <p className="px-3 py-2.5 text-sm text-muted">
                        Brak wyników.
                      </p>
                    )}
                    <ul>
                      {results.map((t) => {
                        const onList =
                          playlist.tracks.some((x) => x.trackId === t.id) ||
                          pendingAdd?.trackId === t.id;
                        const similarTitle =
                          !onList &&
                          playlist.tracks.some(
                            (x) =>
                              artistMatches(x.artists, t.artists) &&
                              titleSimilarity(x.name, t.name) >=
                                SIMILAR_TITLE_THRESHOLD
                          );
                        return (
                          <li key={t.id} className="flex items-center pr-1.5">
                            <button
                              type="button"
                              onClick={() => handlePick(t)}
                              disabled={
                                onList ||
                                adding ||
                                effectiveMyCount >= playlist.myLimit
                              }
                              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-mist disabled:opacity-50"
                            >
                              {t.image ? (
                                <img
                                  src={t.image}
                                  alt=""
                                  aria-hidden
                                  width={36}
                                  height={36}
                                  className="shrink-0 rounded-md object-cover"
                                />
                              ) : (
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-sage-150 text-accent">
                                  <MusicNoteIcon />
                                </span>
                              )}
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate text-sm font-medium text-ink">
                                    {t.name}
                                  </span>
                                  {onList && (
                                    <span className="shrink-0 rounded bg-mist px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                                      na liście
                                    </span>
                                  )}
                                </span>
                                <span className="block truncate text-xs text-muted">
                                  {t.artists}
                                </span>
                                {similarTitle && (
                                  <span className="block truncate text-[11px] text-amber-600">
                                    podobny tytuł już na liście
                                  </span>
                                )}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handlePreview(t)}
                              disabled={previewLoadingId === t.id}
                              aria-label={
                                previewingId === t.id
                                  ? `Zatrzymaj podgląd: ${t.name}`
                                  : `Odtwórz podgląd: ${t.name}`
                              }
                              title={
                                previewingId === t.id
                                  ? "Zatrzymaj podgląd"
                                  : "Podgląd (30 s)"
                              }
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg disabled:opacity-50 ${
                                previewingId === t.id
                                  ? "bg-sage-100 text-accent-deep dark:bg-sage-300 dark:text-[#e6f6ec]"
                                  : "text-muted hover:bg-mist"
                              }`}
                            >
                              {previewingId === t.id ? (
                                <PauseIcon />
                              ) : previewLoadingId === t.id ? (
                                <span className="text-xs">…</span>
                              ) : (
                                <PlayIcon />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>

          {previewError && (
            <p className="text-sm text-red-600">{previewError}</p>
          )}
          {!addState.ok && addState.error && (
            <p className="text-sm text-red-600">{addState.error}</p>
          )}
          {addState.ok && (
            <p className="text-sm text-accent-deep dark:text-[#7fd4a8]">
              Dodano do playlisty.
            </p>
          )}
          {retryState.error && (
            <p className="text-sm text-red-600">{retryState.error}</p>
          )}
          {removeState.error && (
            <p className="text-sm text-red-600">{removeState.error}</p>
          )}

          {visibleTracks.length === 0 && !pendingAdd ? (
            <div className="rounded-[10px] border border-dashed border-line bg-mist p-4 text-sm text-muted">
              Nikt jeszcze nie dodał piosenki. Bądź pierwszy!
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {visibleTracks.map((track) => (
                <li
                  key={track.id}
                  className="flex items-center gap-3 rounded-[10px] bg-mist px-3 py-2"
                >
                  {track.coverUrl ? (
                    <img
                      src={track.coverUrl}
                      alt=""
                      aria-hidden
                      width={32}
                      height={32}
                      className="shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sage-150 text-accent">
                      <MusicNoteIcon />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {track.name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {track.artists} ·{" "}
                      {track.isMine ? "Ty" : track.addedByName}
                    </p>
                  </div>
                  {track.status === "error" && (
                    <span
                      title="Nie udało się dodać na Spotify"
                      className="shrink-0 rounded bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-danger"
                    >
                      błąd
                    </span>
                  )}
                  {track.status === "error" && track.isMine && (
                    <button
                      type="button"
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("id", String(track.id));
                        retryAction(fd);
                      }}
                      disabled={retrying}
                      className="shrink-0 rounded-lg border border-input-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist disabled:opacity-50"
                    >
                      {retrying ? "…" : "Ponów"}
                    </button>
                  )}
                  {(track.isMine || playlist.isOrganizer) && (
                    <button
                      type="button"
                      onClick={() => handleRemove(track)}
                      disabled={removing}
                      aria-label={`Usuń ${track.name}`}
                      title="Usuń"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-danger disabled:opacity-50"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </li>
              ))}
              {pendingAdd && (
                <li className="flex items-center gap-3 rounded-[10px] bg-mist px-3 py-2">
                  {pendingAdd.image ? (
                    <img
                      src={pendingAdd.image}
                      alt=""
                      aria-hidden
                      width={32}
                      height={32}
                      className="shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sage-150 text-accent">
                      <MusicNoteIcon />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {pendingAdd.name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {pendingAdd.artists} · Ty
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-sage-100 px-1.5 py-0.5 text-[10px] font-semibold text-accent dark:bg-sage-300 dark:text-[#e6f6ec]">
                    Synchronizuję…
                  </span>
                </li>
              )}
            </ul>
          )}
        </div>
      ) : (
        !playlist.isOrganizer && (
          <div className="rounded-[10px] border border-dashed border-line bg-mist p-4 text-sm text-muted">
            Organizator nie utworzył jeszcze wspólnej playlisty.
          </div>
        )
      )}

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function SpotifyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M7.5 9.5c3.5-1 7-.7 10 .8" />
      <path d="M8 12.5c3-.8 5.8-.5 8.3.7" />
      <path d="M8.5 15.3c2.4-.6 4.6-.4 6.6.6" />
    </svg>
  );
}

function MusicNoteIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}
