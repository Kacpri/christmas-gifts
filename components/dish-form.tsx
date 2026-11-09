"use client";

import { useMemo, useState, useActionState } from "react";

import {
  addDish,
  editDish,
  removeDish,
  type ActionResult,
} from "@/app/actions";
import {
  DISH_CATEGORIES,
  type DishCategory,
} from "@/lib/dishes";

export type Dish = {
  id: number;
  name: string;
  category: DishCategory;
  author: string;
  isMine: boolean;
};

const empty: ActionResult = { ok: false };
const PER_PAGE = 10;

const categoryLabel = (value: DishCategory) =>
  DISH_CATEGORIES.find((c) => c.value === value)?.label ?? value;

const plural = (n: number, forms: [string, string, string]) => {
  if (n === 1) return forms[0];
  const d = n % 10;
  const h = n % 100;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return forms[1];
  return forms[2];
};

export function DishForm({ dishes }: { dishes: Dish[] }) {
  const [addState, addAction, adding] = useActionState(addDish, empty);
  const [editState, editAction, editing] = useActionState(editDish, empty);
  const [query, setQuery] = useState("");
  const [personFilter, setPersonFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<DishCategory>("glowne");

  const authors = useMemo(
    () =>
      Array.from(new Set(dishes.map((d) => d.author))).sort((a, b) =>
        a.localeCompare(b, "pl")
      ),
    [dishes]
  );

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
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Szukaj potrawy…"
            className="flex-1 rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
          />
          <select
            value={personFilter}
            onChange={(e) => {
              setPersonFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-input-line bg-white px-3 py-2.5 text-sm text-ink"
          >
            <option value="all">Wszyscy</option>
            {authors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-input-line bg-white px-3 py-2.5 text-sm text-ink"
          >
            <option value="all">Wszystkie kategorie</option>
            {DISH_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
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
                      <select
                        name="category"
                        value={editCategory}
                        onChange={(e) =>
                          setEditCategory(e.target.value as DishCategory)
                        }
                        className="rounded-xl border border-input-line bg-white px-3 py-2 text-sm text-ink"
                      >
                        {DISH_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={editing}
                        className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
                      >
                        {editing ? "Zapisywanie…" : "Zapisz"}
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
                    <span className="shrink-0 rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-accent">
                      {categoryLabel(dish.category)}
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
                Strona {currentPage} z {totalPages} ·{" "}
                {filtered.length} {plural(filtered.length, ["potrawa", "potrawy", "potraw"])}
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
          <select
            name="category"
            defaultValue="glowne"
            className="rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink"
          >
            {DISH_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={adding}
          className="w-fit rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
        >
          {adding ? "Dodawanie…" : "Dodaj potrawę"}
        </button>
        {!addState.ok && addState.error && (
          <p className="text-sm text-red-600">{addState.error}</p>
        )}
      </form>
    </div>
  );
}
