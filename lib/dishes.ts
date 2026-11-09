export const DISH_CATEGORIES = [
  { value: "zupa", label: "Zupy", badge: "bg-[#f3ecdd] text-[#8a7042]" },
  {
    value: "przystawka",
    label: "Przystawki",
    badge: "bg-[#eef0dd] text-[#6f7a40]",
  },
  {
    value: "glowne",
    label: "Dania główne",
    badge: "bg-[#f4e5e3] text-[#8a5049]",
  },
  {
    value: "dodatek",
    label: "Dodatki",
    badge: "bg-[#e4edf1] text-[#4f6d7a]",
  },
  {
    value: "deser",
    label: "Desery",
    badge: "bg-[#f0e5ee] text-[#7a507a]",
  },
  {
    value: "napoj",
    label: "Napoje",
    badge: "bg-[#e1eef0] text-[#3f6d7a]",
  },
  {
    value: "inne",
    label: "Inne",
    badge: "bg-[#ececec] text-[#6b6b6b]",
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
