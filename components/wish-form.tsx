"use client";

import { useEffect, useState, useActionState } from "react";

import {
  addWish,
  editWish,
  removeWish,
  saveTheme,
  type ActionResult,
} from "@/app/actions";
import { formatPrice } from "@/lib/format";
import { THEME_IDEAS } from "@/lib/theme-ideas";

export type Wish = {
  id: number;
  text: string;
  link: string | null;
  price: number | null;
};

const empty: ActionResult = { ok: false };

export function WishForm({
  wishes,
  theme,
  wishesLocked,
  themeLocked,
}: {
  wishes: Wish[];
  theme: string | null;
  wishesLocked: boolean;
  themeLocked: boolean;
}) {
  const [wishState, addWishAction, addingWish] = useActionState(addWish, empty);
  const [themeState, saveThemeAction, savingTheme] = useActionState(
    saveTheme,
    empty
  );
  const [editState, editWishAction, editingWish] = useActionState(
    editWish,
    empty
  );
  const [themeValue, setThemeValue] = useState(theme ?? "");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editPrice, setEditPrice] = useState("");

  useEffect(() => {
    if (editState.ok) setEditingId(null);
  }, [editState]);

  function startEdit(wish: Wish) {
    setEditingId(wish.id);
    setEditText(wish.text);
    setEditLink(wish.link ?? "");
    setEditPrice(wish.price != null ? String(wish.price) : "");
  }

  function drawTheme() {
    const idea = THEME_IDEAS[Math.floor(Math.random() * THEME_IDEAS.length)];
    setThemeValue(idea);
    const fd = new FormData();
    fd.set("theme", idea);
    saveThemeAction(fd);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-stone-500">
          {wishesLocked
            ? "Po losowaniu możesz tylko dodawać nowe życzenia."
            : "Maksymalnie 5 pozycji. Widzi je tylko osoba, która Cię wylosuje."}
        </p>
      </div>

      {wishes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {wishes.map((wish) =>
            editingId === wish.id ? (
              <li
                key={wish.id}
                className="flex flex-col gap-3 rounded-[10px] bg-mist p-3"
              >
                <form
                  action={(formData) => {
                    formData.set("id", String(wish.id));
                    editWishAction(formData);
                  }}
                  className="flex flex-col gap-3"
                >
                  <input
                    name="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    required
                    maxLength={500}
                    className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      name="link"
                      type="url"
                      value={editLink}
                      onChange={(e) => setEditLink(e.target.value)}
                      placeholder="Link (opcjonalnie)"
                      className="flex-1 rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink"
                    />
                    <input
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      placeholder="Cena (zł, opcjonalnie)"
                      className="w-full rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink sm:w-44"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={editingWish}
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                    >
                      {editingWish ? "Zapisywanie…" : "Zapisz zmiany"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      disabled={editingWish}
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
                key={wish.id}
                className="flex items-center justify-between gap-3 rounded-[10px] bg-mist p-3"
              >
                <div className="text-sm">
                  <p>{wish.text}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-stone-500">
                    {wish.price != null && (
                      <span>{formatPrice(wish.price)}</span>
                    )}
                    {wish.link && (
                      <a
                        href={wish.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        link
                      </a>
                    )}
                  </p>
                </div>
                {!wishesLocked && (
                  <div className="flex shrink-0 overflow-hidden rounded-lg border border-line bg-white text-xs">
                    <button
                      type="button"
                      onClick={() => startEdit(wish)}
                      className="w-14 py-1 text-center text-muted hover:bg-mist"
                    >
                      edytuj
                    </button>
                    <form
                      action={(formData) => {
                        removeWish(formData);
                      }}
                      className="border-l border-line"
                    >
                      <input type="hidden" name="id" value={wish.id} />
                      <button
                        type="submit"
                        className="w-14 py-1 text-center text-red-600 hover:bg-mist"
                      >
                        usuń
                      </button>
                    </form>
                  </div>
                )}
              </li>
            )
          )}
        </ul>
      )}

      <form action={addWishAction} className="flex flex-col gap-3">
        <input
          name="text"
          required
          maxLength={500}
          placeholder="Czego sobie życzysz? (np. kubek, książka, voucher)"
          className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            name="link"
            type="url"
            placeholder="Link (opcjonalnie)"
            className="flex-1 rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink"
          />
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Cena (zł, opcjonalnie)"
            className="w-full rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink sm:w-44"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={addingWish || wishes.length >= 5}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {addingWish ? "Dodawanie…" : "Dodaj życzenie"}
          </button>
          {wishes.length >= 5 && (
            <span className="text-xs text-stone-500">
              Limit 5 życzeń osiągnięty
            </span>
          )}
        </div>
        {!wishState.ok && wishState.error && (
          <p className="text-sm text-red-600">{wishState.error}</p>
        )}
      </form>

      <hr className="border-line" />

      <div>
        <h3 className="text-base font-semibold">Temat Twojego prezentu</h3>
        <p className="mt-1 text-sm text-stone-500">
          Osoba, która Cię wylosuje do prezentu tematycznego, kupi prezent
          zgodnie z tym tematem.
        </p>
      </div>

      <form action={saveThemeAction} className="flex flex-col gap-3">
        <input
          name="theme"
          value={themeValue}
          onChange={(e) => setThemeValue(e.target.value)}
          required
          maxLength={300}
          disabled={themeLocked}
          placeholder={
            themeLocked
              ? "Temat zablokowany"
              : "np. coś ciepłego na zimowe wieczory"
          }
          className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink disabled:bg-mist disabled:text-faint"
        />
        {!themeLocked && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={savingTheme}
              className="w-fit rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {savingTheme ? "Zapisywanie…" : "Zapisz temat"}
            </button>
            <button
              type="button"
              onClick={drawTheme}
              disabled={savingTheme}
              className="w-fit rounded-xl border border-input-line bg-white px-4 py-2 text-sm font-medium hover:bg-mist disabled:opacity-50"
            >
              Losuj temat dla mnie
            </button>
            {theme != null && themeValue.trim() === theme && (
              <span className="text-sm text-accent">Zapisano ✓</span>
            )}
          </div>
        )}
        {!themeState.ok && themeState.error && (
          <p className="text-sm text-red-600">{themeState.error}</p>
        )}
      </form>
    </div>
  );
}
