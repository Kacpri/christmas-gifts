"use client";

import { useEffect, useMemo, useState, useActionState } from "react";

import {
  addDish,
  editDish,
  removeDish,
  type ActionResult,
} from "@/app/actions";
import { Select } from "@/components/select";
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
};

type SortField = "time" | "name" | "person" | "category";
type SortDir = "asc" | "desc";

const empty: ActionResult = { ok: false };
const PER_PAGE = 10;

const CATEGORY_OPTIONS = DISH_CATEGORIES.map((c) => ({
  value: c.value,
  label: c.label,
}));

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "time", label: "Czas dodania" },
  { value: "name", label: "Nazwa" },
  { value: "person", label: "Osoba" },
  { value: "category", label: "Kategoria" },
];

const DEFAULT_DIR: Record<SortField, SortDir> = {
  time: "desc",
  name: "asc",
  person: "asc",
  category: "asc",
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
    ...authors.map((a) => ({ value: a, label: a })),
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
    const ok = window.confirm(
      `Usunąć potrawę „${dish.name}"? Tej operacji nie można cofnąć.`
    );
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", String(dish.id));
    removeDish(fd);
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
        <p className="text-sm text-stone-500">
          Wspólna lista potraw — każdy dodaje to, co przynosi.
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Szukaj potrawy…"
            className="w-full rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
          />
          <div className="flex gap-2">
            <Select
              value={personFilter}
              onChange={(v) => {
                setPersonFilter(v);
                setPage(1);
              }}
              options={personOptions}
              className="flex-1"
            />
            <Select
              value={categoryFilter}
              onChange={(v) => {
                setCategoryFilter(v);
                setPage(1);
              }}
              options={categoryFilterOptions}
              className="flex-1"
            />
            <div className="flex flex-1 items-center gap-1.5">
              <Select
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
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-input-line bg-white text-muted hover:bg-mist"
              >
                <SortDirIcon dir={sortDir} />
              </button>
            </div>
          </div>
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
                        className="flex-1 rounded-xl border border-input-line bg-white px-3 py-2 text-sm text-ink"
                      />
                      <input
                        name="quantity"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        maxLength={50}
                        placeholder="Ilość (np. 2 blachy)"
                        className="w-full rounded-xl border border-input-line bg-white px-3 py-2 text-sm text-ink placeholder:text-placeholder sm:w-[150px]"
                      />
                      <Select
                        name="category"
                        value={editCategory}
                        onChange={(v) => setEditCategory(v as DishCategory)}
                        options={CATEGORY_OPTIONS}
                        className="sm:w-[150px]"
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
                        className="rounded-xl border border-input-line bg-white px-4 py-2 text-sm font-medium hover:bg-mist disabled:opacity-50"
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
                  className="flex min-h-12 items-center gap-3 rounded-[10px] bg-mist px-3 py-2"
                >
                  <span
                    className={`w-[110px] shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-semibold ${dishCategoryBadge(dish.category)}`}
                  >
                    {dishCategoryLabel(dish.category)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {dish.name}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {dish.author}
                    </p>
                  </div>
                  {dish.quantity && (
                    <span className="shrink-0 text-sm text-muted">
                      {dish.quantity}
                    </span>
                  )}
                  {dish.isMine && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(dish)}
                        aria-label="Edytuj potrawę"
                        title="Edytuj"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-[#e0e6e1]"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(dish)}
                        aria-label="Usuń potrawę"
                        title="Usuń"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#a3201a] hover:bg-[#f1d7d4]"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
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
                className="rounded-lg border border-input-line bg-white px-3 py-1.5 text-xs font-medium text-muted hover:bg-mist disabled:opacity-50"
              >
                ← Poprzednia
              </button>
              <span className="text-xs text-stone-500">
                Strona {currentPage} z {totalPages} · {filtered.length}{" "}
                {plural(filtered.length, ["potrawa", "potrawy", "potraw"])}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-input-line bg-white px-3 py-1.5 text-xs font-medium text-muted hover:bg-mist disabled:opacity-50"
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
          <input
            name="name"
            required
            maxLength={120}
            placeholder="Co przynosisz? (np. szarlotka)"
            className="flex-1 rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
          />
          <input
            name="quantity"
            maxLength={50}
            placeholder="Ilość (np. 2 blachy)"
            className="w-full rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder sm:w-[150px]"
          />
          <Select
            name="category"
            value={addCategory}
            onChange={(v) => setAddCategory(v as DishCategory)}
            options={CATEGORY_OPTIONS}
            direction="up"
            className="sm:w-[150px]"
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
            "Dodaj potrawę"
          )}
        </button>
        {!addState.ok && addState.error && (
          <p className="text-sm text-red-600">{addState.error}</p>
        )}
      </form>
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
