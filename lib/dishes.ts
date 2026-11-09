export const DISH_CATEGORIES = [
  { value: "zupa", label: "Zupa" },
  { value: "przystawka", label: "Przystawka" },
  { value: "glowne", label: "Główne" },
  { value: "dodatek", label: "Dodatek" },
  { value: "deser", label: "Deser" },
  { value: "napoj", label: "Napój" },
  { value: "inne", label: "Inne" },
] as const;

export type DishCategory = (typeof DISH_CATEGORIES)[number]["value"];

export const DISH_CATEGORY_VALUES: DishCategory[] = DISH_CATEGORIES.map(
  (c) => c.value
);
