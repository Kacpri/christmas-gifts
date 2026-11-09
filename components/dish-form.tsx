"use client";

import {
  useEffect,
  useMemo,
  useState,
  useActionState,
  type ReactNode,
} from "react";

import {
  addDish,
  editDish,
  removeDish,
  toggleDishLike,
  type ActionResult,
} from "@/app/actions";
import { Select } from "@/components/select";
import { ConfirmDialog, type ConfirmState } from "@/components/confirm-dialog";
import {
  DISH_CATEGORIES,
  dishCategoryBadge,
  dishCategoryLabel,
  type DishCategory,
} from "@/lib/dishes";
import { plural } from "@/lib/format";

export type Dish = {
  id: number;
  name: string;
  category: DishCategory;
  author: string;
  isMine: boolean;
  quantity: string | null;
  likeCount: number;
  likedByMe: boolean;
};

type SortField = "time" | "name" | "person" | "category" | "likes";
type SortDir = "asc" | "desc";

const empty: ActionResult = { ok: false };
const PER_PAGE = 10;

const CATEGORY_OPTIONS = DISH_CATEGORIES.map((c) => ({
  value: c.value,
  label: c.label,
  icon: <DishCategoryIcon category={c.value} />,
}));

const SORT_OPTIONS: { value: SortField; label: string; icon: ReactNode }[] = [
  { value: "time", label: "Czas dodania", icon: <ClockIcon /> },
  { value: "name", label: "Nazwa", icon: <TypeIcon /> },
  { value: "person", label: "Osoba", icon: <UserIcon /> },
  { value: "category", label: "Kategoria", icon: <TagIcon /> },
  { value: "likes", label: "Polubienia", icon: <HeartIcon /> },
];

const DEFAULT_DIR: Record<SortField, SortDir> = {
  time: "desc",
  name: "asc",
  person: "asc",
  category: "asc",
  likes: "desc",
};

const CATEGORY_ORDER: Record<string, number> = Object.fromEntries(
  DISH_CATEGORIES.map((c, i) => [c.value, i])
);

function compareDishes(a: Dish, b: Dish, field: SortField): number {
  switch (field) {
    case "time":
      return a.id - b.id;
    case "name":
      return a.name.localeCompare(b.name, "pl");
    case "person":
      return a.author.localeCompare(b.author, "pl");
    case "category":
      return CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    case "likes":
      return a.likeCount - b.likeCount;
  }
}

export function DishForm({ dishes }: { dishes: Dish[] }) {
  const [addState, addAction, adding] = useActionState(addDish, empty);
  const [editState, editAction, editing] = useActionState(editDish, empty);
  const [query, setQuery] = useState("");
  const [personFilter, setPersonFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [addCategory, setAddCategory] = useState<DishCategory>("glowne");
  const [sortField, setSortField] = useState<SortField>("time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editCategory, setEditCategory] = useState<DishCategory>("glowne");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (editState.ok) setEditingId(null);
  }, [editState]);

  const authors = useMemo(
    () =>
      Array.from(new Set(dishes.map((d) => d.author))).sort((a, b) =>
        a.localeCompare(b, "pl")
      ),
    [dishes]
  );

  const personOptions = [
    { value: "all", label: "Wszyscy" },
    ...authors.map((a) => ({ value: a, label: a, icon: <UserIcon /> })),
  ];
  const categoryFilterOptions = [
    { value: "all", label: "Wszystkie kategorie" },
    ...CATEGORY_OPTIONS,
  ];

  const q = query.trim().toLowerCase();
  const filtered = dishes
    .filter((d) => {
      if (q && !d.name.toLowerCase().includes(q)) return false;
      if (personFilter !== "all" && d.author !== personFilter) return false;
      if (categoryFilter !== "all" && d.category !== categoryFilter)
        return false;
      return true;
    })
    .sort((a, b) => {
      const base = compareDishes(a, b, sortField);
      return sortDir === "asc" ? base : -base;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  function startEdit(dish: Dish) {
    setEditingId(dish.id);
    setEditName(dish.name);
    setEditQuantity(dish.quantity ?? "");
    setEditCategory(dish.category);
  }

  function handleRemove(dish: Dish) {
    setConfirm({
      message: `Usunąć potrawę „${dish.name}"? Tej operacji nie można cofnąć.`,
      confirmLabel: "Usuń",
      tone: "danger",
      onConfirm: () => {
        const fd = new FormData();
        fd.set("id", String(dish.id));
        removeDish(fd);
      },
    });
  }

  function handleSortField(v: string) {
    const f = v as SortField;
    setSortField(f);
    setSortDir(DEFAULT_DIR[f]);
    setPage(1);
  }

  function toggleSortDir() {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted">
          Wspólna lista potraw — każdy dodaje to, co przynosi.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden
              >
                <SearchIcon />
              </span>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Szukaj potrawy…"
                className="w-full rounded-xl border border-input-line bg-surface py-2.5 pl-10 pr-3.5 text-sm text-ink placeholder:text-placeholder"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-label={filtersOpen ? "Ukryj filtry" : "Pokaż filtry"}
              className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-input-line bg-surface text-muted hover:bg-mist"
            >
              <FunnelIcon />
              {(personFilter !== "all" || categoryFilter !== "all") && (
                <span
                  className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent"
                  aria-hidden
                />
              )}
            </button>
          </div>
          {filtersOpen && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                leadingIcon={<UserIcon />}
                value={personFilter}
                onChange={(v) => {
                  setPersonFilter(v);
                  setPage(1);
                }}
                options={personOptions}
                className="flex-1"
              />
              <Select
                leadingIcon={<TagIcon />}
                value={categoryFilter}
                onChange={(v) => {
                  setCategoryFilter(v);
                  setPage(1);
                }}
                options={categoryFilterOptions}
                scrollable={false}
                className="flex-1"
              />
              <div className="flex flex-1 items-center gap-1.5">
                <Select
                  leadingIcon={<SortFieldIcon field={sortField} />}
                  value={sortField}
                  onChange={handleSortField}
                  options={SORT_OPTIONS}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={toggleSortDir}
                  aria-label="Odwróć kierunek sortowania"
                  title={sortDir === "asc" ? "Rosnąco" : "Malejąco"}
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-input-line bg-surface text-muted hover:bg-mist"
                >
                  <SortDirIcon dir={sortDir} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {pageItems.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-line bg-mist p-4 text-sm text-muted">
          {dishes.length === 0
            ? "Nikt jeszcze nie dodał potraw."
            : "Brak potraw pasujących do filtrów."}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {pageItems.map((dish) =>
              editingId === dish.id ? (
                <li
                  key={dish.id}
                  className="flex flex-col gap-2 rounded-[10px] bg-mist p-3"
                >
                  <form
                    action={(formData) => {
                      formData.set("id", String(dish.id));
                      editAction(formData);
                    }}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        name="name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        maxLength={120}
                        className="flex-1 rounded-xl border border-input-line bg-surface px-3 py-2 text-sm text-ink"
                      />
                      <input
                        name="quantity"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        maxLength={50}
                        placeholder="Ilość (np. 2 kg)"
                        className="w-full rounded-xl border border-input-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-placeholder sm:w-[150px]"
                      />
                      <Select
                        name="category"
                        value={editCategory}
                        onChange={(v) => setEditCategory(v as DishCategory)}
                        options={CATEGORY_OPTIONS}
                        scrollable={false}
                        className="sm:w-[180px]"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={editing}
                        className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
                      >
                        {editing ? (
                          <>
                            <SpinnerIcon />
                            Zapisywanie…
                          </>
                        ) : (
                          "Zapisz"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={editing}
                        className="rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium hover:bg-mist disabled:opacity-50"
                      >
                        Anuluj
                      </button>
                    </div>
                    {!editState.ok && editState.error && (
                      <p className="text-sm text-red-600">{editState.error}</p>
                    )}
                  </form>
                </li>
              ) : (
              <li
                key={dish.id}
                className="flex min-h-12 items-center gap-3 rounded-[10px] bg-mist px-3 py-2 transition-colors hover:bg-sage-100"
              >
                <span
                  title={dishCategoryLabel(dish.category)}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${dishCategoryBadge(dish.category)}`}
                >
                  <DishCategoryIcon category={dish.category} />
                </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {dish.name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {dish.author}
                      {dish.isMine && " · Ty"}
                    </p>
                  </div>
                  <span className="w-[72px] shrink-0 text-right text-sm text-muted">
                    {dish.quantity ?? ""}
                  </span>
                  <div className="flex w-[74px] shrink-0 items-center justify-end gap-0.5">
                    {dish.isMine ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(dish)}
                          aria-label="Edytuj potrawę"
                          title="Edytuj"
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-icon-hover"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(dish)}
                          aria-label="Usuń potrawę"
                          title="Usuń"
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
                        >
                          <TrashIcon />
                        </button>
                      </>
                    ) : (
                      <form action={toggleDishLike} className="flex w-full justify-end">
                        <input type="hidden" name="id" value={dish.id} />
                        <button
                          type="submit"
                          aria-label={dish.likedByMe ? "Odpolub potrawę" : "Polub potrawę"}
                          title={dish.likedByMe ? "Odpolub" : "Polub"}
                          className={`flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors ${
                            dish.likedByMe
                              ? "text-danger"
                              : "text-muted hover:bg-icon-hover"
                          }`}
                        >
                          <HeartIcon filled={dish.likedByMe} />
                          <span className="tabular-nums text-xs">
                            {dish.likeCount}
                          </span>
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              )
            )}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-input-line bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-mist disabled:opacity-50"
              >
                ← Poprzednia
              </button>
              <span className="text-xs text-muted">
                Strona {currentPage} z {totalPages} · {filtered.length}{" "}
                {plural(filtered.length, ["potrawa", "potrawy", "potraw"])}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-input-line bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-mist disabled:opacity-50"
              >
                Następna →
              </button>
            </div>
          )}
        </>
      )}

      <hr className="border-line" />

      <form action={addAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select
            name="category"
            value={addCategory}
            onChange={(v) => setAddCategory(v as DishCategory)}
            options={CATEGORY_OPTIONS}
            direction="up"
            scrollable={false}
            leadingIcon={<TagIcon />}
            className="sm:w-[180px]"
          />
          <input
            name="name"
            required
            maxLength={120}
            placeholder="Co przynosisz? (np. szarlotka)"
            className="flex-1 rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
          />
          <input
            name="quantity"
            maxLength={50}
            placeholder="Ilość (np. 2 kg)"
            className="w-full rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder sm:w-[150px]"
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="inline-flex min-w-[144px] w-fit items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
        >
          {adding ? (
            <>
              <SpinnerIcon />
              Dodawanie…
            </>
          ) : (
            <>
              <PlusCircleIcon />
              Dodaj potrawę
            </>
          )}
        </button>
        {!addState.ok && addState.error && (
          <p className="text-sm text-red-600">{addState.error}</p>
        )}
      </form>

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function SortDirIcon({ dir }: { dir: SortDir }) {
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
      className={dir === "asc" ? "" : "rotate-180"}
      aria-hidden
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

function PencilIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
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

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
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

function UserIcon() {
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
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function TagIcon() {
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
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <path d="M7.5 7.5h.01" />
    </svg>
  );
}

function ClockIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function TypeIcon() {
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
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" x2="15" y1="20" y2="20" />
      <line x1="12" x2="12" y1="4" y2="20" />
    </svg>
  );
}

function FunnelIcon() {
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
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function PlusCircleIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function SortFieldIcon({ field }: { field: SortField }) {
  if (field === "time") return <ClockIcon />;
  if (field === "name") return <TypeIcon />;
  if (field === "person") return <UserIcon />;
  return <TagIcon />;
}

function DishCategoryIcon({ category }: { category: DishCategory }) {
  let paths: ReactNode;
  switch (category) {
    case "zupa":
      paths = (
        <>
          <path d="M11.248 3c.273.1.808.53.747 1.36-.05.83-.938 1.2-.989 2.02-.06.78.333 1.24.727 1.62" />
          <path d="M16.252 3c.268.1.794.53.745 1.36-.06.83-.923 1.2-.993 2.02-.05.78.338 1.24.725 1.62" />
          <path d="M19.5 12 22 6" />
          <path d="M4 12a1 1 0 00-.99 1.133A9 9 0 0012 21a9 9 0 008.99-7.867A1 1 0 0020 12z" />
          <path d="M6.252 3c.268.1.794.53.745 1.36-.06.83-.923 1.2-.993 2.02-.05.78.338 1.24.735 1.62" />
          <path d="M7 21h10" />
        </>
      );
      break;
    case "przystawka":
      paths = (
        <>
          <path d="m2.37 11.223 8.372-6.777a2 2 0 0 1 2.516 0l8.371 6.777" />
          <path d="M21 15a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5.25" />
          <path d="M3 15a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h9" />
          <path d="m6.67 15 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2" />
          <rect width="20" height="4" x="2" y="11" rx="1" />
        </>
      );
      break;
    case "glowne":
      paths = (
        <>
          <path d="M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 3.43 135 0 0-6.23 6.23" />
          <path d="m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59" />
        </>
      );
      break;
    case "dodatek":
      paths = (
        <>
          <path d="M19.496 12a2.5 2.5 0 00.399-2.214A2 2 0 0020.32 6.5 2 2 0 0019 3a2 2 0 00-1.5.68 2 2 0 00-3.287.424 2.5 2.5 0 00-3.189 2.06A3 3 0 0012 12l4-4" />
          <path d="M4 12a1 1 0 00-.99 1.133A9 9 0 0012 21a9 9 0 008.99-7.867A1 1 0 0020 12z" />
          <path d="M7 21h10" />
          <path d="M9.85 6.907A3.5 3.5 0 005.05 12" />
        </>
      );
      break;
    case "deser":
      paths = (
        <>
          <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11" />
          <path d="M17 7A5 5 0 0 0 7 7" />
          <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4" />
        </>
      );
      break;
    case "napoj":
      paths = (
        <>
          <path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z" />
          <path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0" />
        </>
      );
      break;
    default:
      paths = (
        <>
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </>
      );
  }
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
      {paths}
    </svg>
  );
}
