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
};

const empty: ActionResult = { ok: false };
const PER_PAGE = 10;

const CATEGORY_OPTIONS = DISH_CATEGORIES.map((c) => ({
  value: c.value,
  label: c.label,
}));

export function DishForm({ dishes }: { dishes: Dish[] }) {
  const [addState, addAction, adding] = useActionState(addDish, empty);
  const [editState, editAction, editing] = useActionState(editDish, empty);
  const [query, setQuery] = useState("");
  const [personFilter, setPersonFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [addCategory, setAddCategory] = useState<DishCategory>("glowne");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
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
    .sort((a, b) => b.id - a.id);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  function startEdit(dish: Dish) {
    setEditingId(dish.id);
    setEditName(dish.name);
    setEditCategory(dish.category);
  }

  function handleRemove(dish: Dish) {
    const fd = new FormData();
    fd.set("id", String(dish.id));
    removeDish(fd);
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
                      <Select
                        name="category"
                        value={editCategory}
                        onChange={(v) => setEditCategory(v as DishCategory)}
                        options={CATEGORY_OPTIONS}
                        className="sm:w-[160px]"
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
                  className="flex min-h-12 items-center justify-between gap-3 rounded-[10px] bg-mist px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${dishCategoryBadge(dish.category)}`}
                    >
                      {dishCategoryLabel(dish.category)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {dish.name}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {dish.author}
                      </p>
                    </div>
                  </div>
                  {dish.isMine && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(dish)}
                        className="min-h-10 rounded-xl px-3 text-xs font-medium text-muted hover:bg-[#e0e6e1]"
                      >
                        edytuj
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(dish)}
                        className="min-h-10 rounded-xl px-3 text-xs font-medium text-[#a3201a] hover:bg-[#f1d7d4]"
                      >
                        usuń
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
          <Select
            name="category"
            value={addCategory}
            onChange={(v) => setAddCategory(v as DishCategory)}
            options={CATEGORY_OPTIONS}
            direction="up"
            className="sm:w-[160px]"
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
