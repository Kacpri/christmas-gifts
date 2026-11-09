export const DISH_CATEGORIES = [
  { value: "zupa", label: "Zupa", badge: "bg-amber-100 text-amber-800" },
  {
    value: "przystawka",
    label: "Przystawka",
    badge: "bg-lime-100 text-lime-800",
  },
  { value: "glowne", label: "Główne", badge: "bg-rose-100 text-rose-800" },
  {
    value: "dodatek",
    label: "Dodatek",
    badge: "bg-sky-100 text-sky-800",
  },
  {
    value: "deser",
    label: "Deser",
    badge: "bg-fuchsia-100 text-fuchsia-800",
  },
  { value: "napoj", label: "Napój", badge: "bg-cyan-100 text-cyan-800" },
  {
    value: "inne",
    label: "Inne",
    badge: "bg-stone-200 text-stone-700",
  },
] as const;

export type DishCategory = (typeof DISH_CATEGORIES)[number]["value"];

export const DISH_CATEGORY_VALUES: DishCategory[] = DISH_CATEGORIES.map(
  (c) => c.value
);

export const dishCategoryLabel = (value: DishCategory) =>
  DISH_CATEGORIES.find((c) => c.value === value)?.label ?? value;

export const dishCategoryBadge = (value: DishCategory) =>
  DISH_CATEGORIES.find((c) => c.value === value)?.badge ??
  "bg-stone-200 text-stone-700";
