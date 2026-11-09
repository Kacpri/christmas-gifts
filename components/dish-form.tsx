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

export function DishForm({ dishes }: { dishes: Dish[] }) {
  const [addState, addAction, adding] = useActionState(addDish, empty);
  const [editState, editAction, editing] = useActionState(editDish, empty);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<DishCategory>("glowne");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? dishes.filter((d) => d.name.toLowerCase().includes(q))
    : dishes;

  const sections = useMemo(
    () =>
      DISH_CATEGORIES.map((c) => ({
        ...c,
        items: filtered.filter((d) => d.category === c.value),
      })).filter((s) => s.items.length > 0),
    [filtered]
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
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj potrawy…"
          className="mt-2 w-full rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
        />
      </div>

      {sections.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-line bg-mist p-4 text-sm text-muted">
          {q
            ? "Brak potraw pasujących do wyszukiwania."
            : "Nikt jeszcze nie dodał potraw."}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <div key={section.value}>
              <h3 className="text-sm font-semibold text-stone-600">
                {section.label}
              </h3>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {section.items.map((dish) =>
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
                          <p className="text-sm text-red-600">
                            {editState.error}
                          </p>
                        )}
                      </form>
                    </li>
                  ) : (
                    <li
                      key={dish.id}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-[10px] bg-mist px-3 py-2"
                    >
                      <div className="text-sm">
                        <p className="font-medium text-ink">{dish.name}</p>
                        <p className="text-xs text-stone-500">{dish.author}</p>
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
            </div>
          ))}
        </div>
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
