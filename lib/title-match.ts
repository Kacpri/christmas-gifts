function stripParensAndDiacritics(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, " ");
}

function toAlnum(s: string): string {
  return s.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function normalize(s: string): string {
  return toAlnum(stripParensAndDiacritics(s));
}

export function normalizeTitle(s: string): string {
  const withoutSuffix = stripParensAndDiacritics(s).replace(
    /\s+[-–—]\s+.*$/,
    " "
  );
  return toAlnum(withoutSuffix);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  let curr: number[] = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[b.length];
}

export const SIMILAR_TITLE_THRESHOLD = 0.8;

export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
}

export function artistMatches(a: string, b: string): boolean {
  const pa = a.split(",").map(normalize).filter(Boolean);
  const pb = b.split(",").map(normalize).filter(Boolean);
  if (pa.length === 0 || pb.length === 0) return false;
  return pa.some((x) => pb.some((y) => x.includes(y) || y.includes(x)));
}
