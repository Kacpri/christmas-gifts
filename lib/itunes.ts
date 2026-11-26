import { artistMatches, normalize } from "./title-match";

type ItunesResult = {
  trackName: string;
  artistName: string;
  previewUrl: string | null;
};

function titleScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const wa = new Set(a.split(" "));
  const wb = new Set(b.split(" "));
  let inter = 0;
  wa.forEach((w) => {
    if (wb.has(w)) inter++;
  });
  const union = wa.size + wb.size - inter;
  return union === 0 ? 0 : Math.round((inter / union) * 60);
}

// iTunes Search API (darmowy, bez klucza) — 30-sekundowe podglądy.
// Spotify nie zwraca już preview_url dla nowych aplikacji, więc
// podgląd dobieramy po nazwie/artyście (preferowana dokładna nazwa,
// wymagany zbieżny artysta). Zwraca URL podglądu lub null.
export async function findItunesPreview(
  name: string,
  artists: string
): Promise<string | null> {
  const params = new URLSearchParams({
    term: `${artists} ${name}`,
    media: "music",
    limit: "10",
  });
  const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { results?: ItunesResult[] };
  const normName = normalize(name);
  let best: { url: string; score: number } | null = null;
  for (const r of body.results ?? []) {
    if (!r.previewUrl) continue;
    if (!artistMatches(artists, r.artistName)) continue;
    const score = titleScore(normName, normalize(r.trackName));
    if (score >= 50 && (!best || score > best.score)) {
      best = { url: r.previewUrl, score };
    }
  }
  return best?.url ?? null;
}
