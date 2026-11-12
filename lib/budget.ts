export const DEFAULT_LIST_BUDGET = 150;
export const DEFAULT_THEME_BUDGET = 100;
export const BUDGET_MIN = 1;
export const BUDGET_MAX = 10000;

export type ParsedPrice =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "value"; grosze: number };

export function parsePrice(raw: string): ParsedPrice {
  const s = raw.trim().replace(",", ".");
  if (!s) return { kind: "empty" };
  const value = Number(s);
  if (Number.isNaN(value) || value < 0) return { kind: "invalid" };
  return { kind: "value", grosze: Math.round(value * 100) };
}

export function effectiveListBudget(listBudget: number | null): number {
  return listBudget ?? DEFAULT_LIST_BUDGET;
}

export function effectiveThemeBudget(themeBudget: number | null): number {
  return themeBudget ?? DEFAULT_THEME_BUDGET;
}

export function budgetError(budget: number): string {
  return `Cena przekracza budżet (do ${budget} zł)`;
}
