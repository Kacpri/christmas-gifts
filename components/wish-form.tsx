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
  const [justSaved, setJustSaved] = useState(false);
  const [undoWish, setUndoWish] = useState<Wish | null>(null);

  useEffect(() => {
    if (editState.ok) setEditingId(null);
  }, [editState]);

  useEffect(() => {
    if (!savingTheme && themeState.ok) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [savingTheme, themeState]);

  useEffect(() => {
    if (!undoWish) return;
    const t = setTimeout(() => setUndoWish(null), 5000);
    return () => clearTimeout(t);
  }, [undoWish]);

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

  function handleRemove(wish: Wish) {
    setUndoWish(wish);
    const fd = new FormData();
    fd.set("id", String(wish.id));
    removeWish(fd);
  }

  function handleUndo() {
    if (!undoWish) return;
    const fd = new FormData();
    fd.set("text", undoWish.text);
    fd.set("link", undoWish.link ?? "");
    fd.set("price", undoWish.price != null ? String(undoWish.price) : "");
    addWishAction(fd);
    setUndoWish(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-stone-500">
          {wishesLocked
            ? "Po losowaniu możesz tylko dodawać nowe życzenia."
            : "Widzi je tylko osoba, która Cię wylosuje."}
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
                    className="rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      name="link"
                      type="url"
                      value={editLink}
                      onChange={(e) => setEditLink(e.target.value)}
                      placeholder="Link (opcjonalnie)"
                      className="flex-1 rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
                    />
                    <input
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="Cena (zł)"
                    className="w-full rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder sm:w-[140px]"
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
                className="flex min-h-16 items-center justify-between gap-3 rounded-[10px] bg-mist p-3"
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
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(wish)}
                      className="min-h-10 rounded-lg border border-line bg-white px-3 text-xs font-medium text-muted hover:bg-sage-50"
                    >
                      edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(wish)}
                      className="min-h-10 rounded-lg border border-line bg-white px-3 text-xs font-medium text-[#a3201a] hover:bg-sage-50"
                    >
                      usuń
                    </button>
                  </div>
                )}
              </li>
            )
          )}
        </ul>
      )}

      {wishes.length >= 5 ? (
        <p className="text-sm text-muted">
          Osiągnięto limit — usuń któreś życzenie, aby dodać nowe
        </p>
      ) : (
        <form action={addWishAction} className="flex flex-col gap-3">
          <input
            name="text"
            required
            maxLength={500}
            placeholder="Czego sobie życzysz? (np. kubek, książka, voucher)"
            className="rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              name="link"
              type="url"
              placeholder="Link (opcjonalnie)"
              className="flex-1 rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
            />
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="Cena (zł)"
              className="w-full rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder sm:w-[140px]"
            />
          </div>
          <button
            type="submit"
            disabled={addingWish}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {addingWish ? "Dodawanie…" : "Dodaj życzenie"}
          </button>
          {!wishState.ok && wishState.error && (
            <p className="text-sm text-red-600">{wishState.error}</p>
          )}
        </form>
      )}

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
          className="rounded-xl border border-input-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder disabled:bg-mist disabled:text-faint"
        />
        {!themeLocked && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={savingTheme || themeValue.trim() === (theme ?? "")}
              className="w-fit rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {savingTheme ? "Zapisywanie…" : "Zapisz temat"}
            </button>
            <button
              type="button"
              onClick={drawTheme}
              disabled={savingTheme}
              className="w-fit inline-flex items-center gap-2 rounded-xl border border-input-line bg-white px-4 py-2 text-sm font-medium hover:bg-mist disabled:opacity-50"
            >
              <DiceIcon />
              Podpowiedz temat
            </button>
            <span aria-live="polite" className="text-sm text-accent">
              {justSaved && (
                <span className="inline-flex items-center gap-1">
                  <CheckIcon />
                  Zapisano
                </span>
              )}
            </span>
          </div>
        )}
        {!themeState.ok && themeState.error && (
          <p className="text-sm text-red-600">{themeState.error}</p>
        )}
      </form>

      <div
        aria-live="polite"
        className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
      >
        {undoWish && (
          <div className="flex items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm text-white shadow-lg">
            Usunięto
            <button
              type="button"
              onClick={handleUndo}
              className="font-semibold underline underline-offset-2 hover:text-cream"
            >
              Cofnij
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function DiceIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
