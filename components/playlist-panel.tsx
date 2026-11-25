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
  removePlaylistTrack,
  retryPlaylistTrack,
  type PlaylistActionResult,
} from "@/app/playlist-actions";
import { Avatar } from "@/components/avatar";
import { ConfirmDialog, type ConfirmState } from "@/components/confirm-dialog";

export type PlaylistTrackItem = {
  id: number;
  name: string;
  artists: string;
  trackUrl: string | null;
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
};

type SearchTrack = {
  id: string;
  name: string;
  artists: string;
  url: string | null;
  image: string | null;
};

const empty: PlaylistActionResult = { ok: false };
const DEFAULT_PLAYLIST_NAME = "Świąteczna Tablica – Playlista";

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
        removeAction(fd);
      },
    });
  }

  const hasPlaylist = playlist.playlistId != null;

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
                className="shrink-0 rounded-lg border border-input-line bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-mist disabled:opacity-50"
              >
                {disconnecting ? "Rozłączanie…" : "Rozłącz"}
              </button>
            </div>
          )}
          {!disconnectState.ok && disconnectState.error && (
            <p className="text-sm text-red-600">{disconnectState.error}</p>
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
            <p className="text-sm text-muted">
              Wspólna playlista — każdy dodaje do {playlist.myLimit}{" "}
              {playlist.myLimit === 5 ? "piosenek" : "piosenek"}.
            </p>
            <span className="shrink-0 rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-accent dark:bg-sage-300 dark:text-[#e6f6ec]">
              {playlist.myCount}/{playlist.myLimit}
            </span>
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
                      {results.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => handlePick(t)}
                            disabled={adding || playlist.myCount >= playlist.myLimit}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-mist disabled:opacity-50"
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
                              <span className="block truncate text-sm font-medium text-ink">
                                {t.name}
                              </span>
                              <span className="block truncate text-xs text-muted">
                                {t.artists}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>

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

          {playlist.tracks.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-line bg-mist p-4 text-sm text-muted">
              Nikt jeszcze nie dodał piosenki. Bądź pierwszy!
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {playlist.tracks.map((track) => (
                <li
                  key={track.id}
                  className="flex items-center gap-3 rounded-[10px] bg-mist px-3 py-2"
                >
                  <Avatar
                    name={track.addedByName}
                    src={track.addedByAvatarUrl}
                    size={32}
                  />
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
