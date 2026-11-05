"use client";

import { useState, useActionState } from "react";

import { addWish, removeWish, saveTheme, type ActionResult } from "@/app/actions";
import { formatPrice } from "@/lib/format";

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
  locked,
}: {
  wishes: Wish[];
  theme: string | null;
  locked: boolean;
}) {
  const [wishState, addWishAction, addingWish] = useActionState(addWish, empty);
  const [themeState, saveThemeAction, savingTheme] = useActionState(
    saveTheme,
    empty
  );
  const [themeValue, setThemeValue] = useState(theme ?? "");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-stone-500">
          {locked
            ? "Możesz teraz tylko dodawać nowe życzenia."
            : "Maksymalnie 5 pozycji. Widzi je tylko osoba, która Cię wylosuje."}
        </p>
      </div>

      {wishes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {wishes.map((wish) => (
            <li
              key={wish.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-stone-50 p-3"
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
              {!locked && (
                <form
                  action={(formData) => {
                    removeWish(formData);
                  }}
                >
                  <input type="hidden" name="id" value={wish.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:underline"
                  >
                    usuń
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={addWishAction} className="flex flex-col gap-3">
        <input
          name="text"
          required
          maxLength={500}
          placeholder="Czego sobie życzysz? (np. kubek, książka, voucher)"
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            name="link"
            type="url"
            placeholder="Link (opcjonalnie)"
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
          />
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Cena (zł, opcjonalnie)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none sm:w-44"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={addingWish || wishes.length >= 5}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
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

      <hr className="border-amber-200" />

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
          disabled={locked}
          placeholder={
            locked
              ? "Temat zablokowany"
              : "np. coś ciepłego na zimowe wieczory"
          }
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500"
        />
        {!locked && (
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingTheme}
              className="w-fit rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {savingTheme ? "Zapisywanie…" : "Zapisz temat"}
            </button>
            {theme != null && themeValue.trim() === theme && (
              <span className="text-sm text-green-700">Zapisano ✓</span>
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
