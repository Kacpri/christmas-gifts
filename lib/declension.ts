export type Gender = "m" | "f";
export type Case = "gen" | "acc";

type Entry = { g: Gender; gen: string; acc: string };

const DICT: Record<string, Entry> = {
  antoni: { g: "m", gen: "Antoniego", acc: "Antoniego" },
  cezary: { g: "m", gen: "Cezarego", acc: "Cezarego" },
  irek: { g: "m", gen: "Iryka", acc: "Iryka" },
  iwo: { g: "m", gen: "Iwa", acc: "Iwa" },
  jerzy: { g: "m", gen: "Jerzego", acc: "Jerzego" },
  paweł: { g: "m", gen: "Pawła", acc: "Pawła" },
  aga: { g: "f", gen: "Agi", acc: "Agę" },
  asia: { g: "f", gen: "Asi", acc: "Asię" },
  basia: { g: "f", gen: "Basi", acc: "Basię" },
  gosia: { g: "f", gen: "Gosi", acc: "Gosię" },
  hania: { g: "f", gen: "Hani", acc: "Hanię" },
  iga: { g: "f", gen: "Igi", acc: "Igę" },
  kaja: { g: "f", gen: "Kai", acc: "Kają" },
  kasia: { g: "f", gen: "Kasi", acc: "Kasię" },
  lila: { g: "f", gen: "Lili", acc: "Lilę" },
  maja: { g: "f", gen: "Maji", acc: "Maję" },
  marysia: { g: "f", gen: "Marysi", acc: "Marysię" },
  ola: { g: "f", gen: "Oli", acc: "Olę" },
  olga: { g: "f", gen: "Olgi", acc: "Olgię" },
  romana: { g: "f", gen: "Romy", acc: "Romę" },
  zosia: { g: "f", gen: "Zosi", acc: "Zosię" },
  zuzia: { g: "f", gen: "Zuzi", acc: "Zuzię" },
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function nameGender(name: string): Gender {
  const key = firstWord(name).toLowerCase();
  const hit = DICT[key];
  if (hit) return hit.g;
  return /a$/i.test(firstWord(name)) ? "f" : "m";
}

function declineMasculine(word: string, c: Case): string {
  const hit = DICT[word.toLowerCase()];
  if (hit) return c === "gen" ? hit.gen : hit.acc;
  const lower = word.toLowerCase();
  if (lower.endsWith("y")) {
    return capitalize(word.slice(0, -1) + "ego");
  }
  if (lower.endsWith("ek")) {
    return capitalize(word.slice(0, -2) + "ka");
  }
  if (lower.endsWith("k")) {
    return capitalize(word + "a");
  }
  if (lower.endsWith("er")) {
    return capitalize(word.slice(0, -2) + "ra");
  }
  return capitalize(word + "a");
}

function declineFeminine(word: string, c: Case): string {
  const hit = DICT[word.toLowerCase()];
  if (hit) return c === "gen" ? hit.gen : hit.acc;
  const lower = word.toLowerCase();
  if (!lower.endsWith("a")) return word;
  if (lower.endsWith("sia") || lower.endsWith("zia")) {
    const stem = word.slice(0, -1);
    return c === "gen" ? stem : stem + "ę";
  }
  if (lower.endsWith("ia")) {
    const stem = word.slice(0, -2);
    return c === "gen" ? stem + "ii" : stem + "ię";
  }
  if (lower.endsWith("cja")) {
    const stem = word.slice(0, -2);
    return c === "gen" ? stem + "ji" : stem + "ję";
  }
  const stem = word.slice(0, -1);
  if (lower.endsWith("la") || lower.endsWith("ga") || lower.endsWith("ka")) {
    return c === "gen" ? stem + "i" : stem + "ę";
  }
  return c === "gen" ? stem + "y" : stem + "ę";
}

function declineFirstName(word: string, gender: Gender, c: Case): string {
  return gender === "f" ? declineFeminine(word, c) : declineMasculine(word, c);
}

function declineSurname(word: string, gender: Gender, c: Case): string {
  if (c === "acc") return word;
  const lower = word.toLowerCase();
  if (gender === "m") {
    if (lower.endsWith("ski") || lower.endsWith("cki")) {
      return word + "ego";
    }
    return declineMasculine(word, "gen");
  }
  if (lower.endsWith("ska") || lower.endsWith("cka")) {
    return word.slice(0, -1) + "iej";
  }
  if (lower.endsWith("a")) {
    return declineFeminine(word, "gen");
  }
  return word;
}

export function declineName(name: string, c: Case): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name;
  const gender = nameGender(name);
  const first = declineFirstName(parts[0], gender, c);
  if (parts.length === 1) return first;
  const surname = parts[parts.length - 1];
  const mid = parts.slice(1, -1);
  const declinedSurname = declineSurname(surname, gender, c);
  return [first, ...mid, declinedSurname].join(" ");
}

export function possessive(name: string): "jego" | "jej" {
  return nameGender(name) === "f" ? "jej" : "jego";
}
