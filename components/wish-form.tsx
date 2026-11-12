"use client";

import { useEffect, useRef, useState, useActionState } from "react";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  addWish,
  editWish,
  removeWish,
  reorderWishes,
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
  themeLocked,
  onCountChange,
}: {
  wishes: Wish[];
  theme: string | null;
  themeLocked: boolean;
  onCountChange?: (count: number) => void;
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
  const [reorderState, reorderWishAction] = useActionState(
    reorderWishes,
    empty
  );
  const [themeValue, setThemeValue] = useState(theme ?? "");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [undoWish, setUndoWish] = useState<Wish | null>(null);
  const [localWishes, setLocalWishes] = useState<Wish[]>(wishes);
  const [justDrew, setJustDrew] = useState(false);
  const [mobileMenuWish, setMobileMenuWish] = useState<Wish | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setLocalWishes(wishes);
  }, [wishes]);

  useEffect(() => {
    onCountChange?.(localWishes.length);
  }, [localWishes.length, onCountChange]);

  useEffect(() => {
    if (editState.ok) setEditingId(null);
  }, [editState]);

  useEffect(() => {
    if (!undoWish) return;
    const t = setTimeout(() => setUndoWish(null), 5000);
    return () => clearTimeout(t);
  }, [undoWish]);

  useEffect(() => {
    if (justDrew && themeValue.trim() === theme) setJustDrew(false);
  }, [justDrew, themeValue, theme]);

  function startEdit(wish: Wish) {
    setEditingId(wish.id);
    setEditText(wish.text);
    setEditLink(wish.link ?? "");
    setEditPrice(wish.price != null ? String(wish.price) : "");
  }

  function drawTheme() {
    const idea = THEME_IDEAS[Math.floor(Math.random() * THEME_IDEAS.length)];
    setThemeValue(idea);
    setJustDrew(true);
    const fd = new FormData();
    fd.set("theme", idea);
    saveThemeAction(fd);
  }

  function handleRemove(wish: Wish) {
    setLocalWishes((prev) => prev.filter((w) => w.id !== wish.id));
    setUndoWish(wish);
    const fd = new FormData();
    fd.set("id", String(wish.id));
    removeWish(fd);
  }

  function handleUndo() {
    if (!undoWish) return;
    setLocalWishes((prev) => [...prev, undoWish]);
    const fd = new FormData();
    fd.set("text", undoWish.text);
    fd.set("link", undoWish.link ?? "");
    fd.set("price", undoWish.price != null ? String(undoWish.price) : "");
    addWishAction(fd);
    setUndoWish(null);
  }

  function startLongPress(wish: Wish) {
    longPressFired.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setMobileMenuWish(wish);
      window.setTimeout(() => {
        longPressFired.current = false;
      }, 400);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = localWishes.findIndex((w) => w.id === active.id);
    const newIndex = localWishes.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(localWishes, oldIndex, newIndex);
    setLocalWishes(next);
    const fd = new FormData();
    next.forEach((w) => fd.append("ids", String(w.id)));
    reorderWishAction(fd);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted">
          {themeLocked
            ? "Temat prezentu pozostaje zablokowany."
            : "Widzi je tylko osoba, która Cię wylosuje."}
        </p>
      </div>

      {localWishes.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localWishes.map((w) => w.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-2">
              {localWishes.map((wish, index) => (
                <SortableWishItem
                  key={wish.id}
                  wish={wish}
                  index={index}
                  isEditing={editingId === wish.id}
                  editText={editText}
                  editLink={editLink}
                  editPrice={editPrice}
                  setEditText={setEditText}
                  setEditLink={setEditLink}
                  setEditPrice={setEditPrice}
                  editWishAction={editWishAction}
                  editingWish={editingWish}
                  editState={editState}
                  cancelEdit={() => setEditingId(null)}
                  startEdit={startEdit}
                  handleRemove={handleRemove}
                  startLongPress={startLongPress}
                  cancelLongPress={cancelLongPress}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {reorderState.error && (
        <p className="text-sm text-red-600">{reorderState.error}</p>
      )}

      {localWishes.length >= 5 ? (
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
            className="rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              name="link"
              type="url"
              placeholder="Link (opcjonalnie)"
              className="flex-1 rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
            />
            <input
              name="price"
              type="text"
              inputMode="decimal"
              placeholder="Cena (zł)"
              className="w-full rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder sm:w-[140px]"
            />
          </div>
          <button
            type="submit"
            disabled={addingWish}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
          >
            {addingWish ? (
              <>
                <SpinnerIcon />
                Dodawanie…
              </>
            ) : (
              <>
                <PlusCircleIcon />
                Dodaj życzenie
              </>
            )}
          </button>
          {!wishState.ok && wishState.error && (
            <p className="text-sm text-red-600">{wishState.error}</p>
          )}
        </form>
      )}

      <hr className="border-line" />

      <div>
        <h3 className="text-base font-semibold">Temat Twojego prezentu</h3>
        <p className="mt-1 text-sm text-muted">
          Osoba, która Cię wylosuje do prezentu tematycznego, kupi prezent
          zgodnie z tym tematem.
        </p>
      </div>

      <form action={saveThemeAction} className="flex flex-col gap-3">
        <div className="relative">
          <input
            name="theme"
            value={themeValue}
            onChange={(e) => setThemeValue(e.target.value)}
            required
            maxLength={300}
            readOnly={themeLocked}
            onKeyDown={(e) => {
              if (themeLocked && e.key === "Enter") e.preventDefault();
            }}
            placeholder={
              themeLocked
                ? "Temat zablokowany"
                : "np. coś ciepłego na zimowe wieczory"
            }
            className={`w-full rounded-xl border border-input-line px-3.5 py-2.5 text-sm placeholder:text-placeholder ${
              themeLocked ? "bg-mist pr-10 text-faint" : "bg-surface text-ink"
            }`}
          />
          {themeLocked && (
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-faint">
              <LockIcon />
            </span>
          )}
        </div>
        {!themeLocked && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={savingTheme || justDrew || themeValue.trim() === (theme ?? "")}
              aria-live="polite"
              className="w-fit inline-flex min-w-[136px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
            >
              {savingTheme ? (
                <>
                  <SpinnerIcon />
                  Zapisuję…
                </>
              ) : justDrew || (themeValue.trim() === theme && theme != null) ? (
                <>
                  <CheckIcon />
                  Zapisano
                </>
              ) : (
                "Zapisz temat"
              )}
            </button>
            <button
              type="button"
              onClick={drawTheme}
              disabled={savingTheme}
              className="w-fit inline-flex min-w-[184px] items-center justify-center gap-2 rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium hover:bg-mist disabled:opacity-50"
            >
              <DiceIcon />
              Podpowiedz temat
            </button>
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

      {mobileMenuWish && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={() => setMobileMenuWish(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-surface p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 truncate text-sm font-semibold text-ink">
              {mobileMenuWish.text}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  startEdit(mobileMenuWish);
                  setMobileMenuWish(null);
                }}
                className="flex items-center gap-2 rounded-xl border border-input-line bg-mist px-4 py-2.5 text-sm font-medium text-ink hover:bg-icon-hover"
              >
                <PencilIcon />
                Edytuj
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRemove(mobileMenuWish);
                  setMobileMenuWish(null);
                }}
                className="flex items-center gap-2 rounded-xl border border-danger-soft bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger hover:opacity-80"
              >
                <TrashIcon />
                Usuń
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuWish(null)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-muted hover:bg-mist"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableWishItem({
  wish,
  index,
  isEditing,
  editText,
  editLink,
  editPrice,
  setEditText,
  setEditLink,
  setEditPrice,
  editWishAction,
  editingWish,
  editState,
  cancelEdit,
  startEdit,
  handleRemove,
  startLongPress,
  cancelLongPress,
}: {
  wish: Wish;
  index: number;
  isEditing: boolean;
  editText: string;
  editLink: string;
  editPrice: string;
  setEditText: (v: string) => void;
  setEditLink: (v: string) => void;
  setEditPrice: (v: string) => void;
  editWishAction: (formData: FormData) => void;
  editingWish: boolean;
  editState: ActionResult;
  cancelEdit: () => void;
  startEdit: (wish: Wish) => void;
  handleRemove: (wish: Wish) => void;
  startLongPress: (wish: Wish) => void;
  cancelLongPress: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: wish.id, disabled: isEditing });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isEditing) {
    return (
      <li
        ref={setNodeRef}
        style={style}
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
            className="rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              name="link"
              type="url"
              value={editLink}
              onChange={(e) => setEditLink(e.target.value)}
              placeholder="Link (opcjonalnie)"
              className="flex-1 rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
            />
            <input
              name="price"
              type="text"
              inputMode="decimal"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              placeholder="Cena (zł)"
              className="w-full rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder sm:w-[140px]"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={editingWish}
              className="inline-flex min-w-[152px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
            >
              {editingWish ? (
                <>
                  <SpinnerIcon />
                  Zapisywanie…
                </>
              ) : (
                "Zapisz zmiany"
              )}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={editingWish}
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
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex min-h-16 items-center gap-2 rounded-[10px] bg-mist p-3 transition-colors hover:bg-sage-100 ${
        isDragging ? "relative z-10 opacity-50" : ""
      }`}
      onTouchStart={() => startLongPress(wish)}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onTouchCancel={cancelLongPress}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Przesuń życzenie"
        title="Przesuń"
        className="flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-faint hover:bg-icon-hover active:cursor-grabbing"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchCancel={(e) => e.stopPropagation()}
      >
        <GripIcon />
      </button>
      <div className="min-w-0 flex-1 text-sm">
        <p>
          <span className="select-none text-muted">{index + 1}.</span>{" "}
          {wish.text}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
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
      <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
        <button
          type="button"
          onClick={() => startEdit(wish)}
          aria-label="Edytuj życzenie"
          title="Edytuj"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-icon-hover"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={() => handleRemove(wish)}
          aria-label="Usuń życzenie"
          title="Usuń"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

function GripIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="9" cy="6" r="1.5" fill="currentColor" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
      <circle cx="9" cy="18" r="1.5" fill="currentColor" />
      <circle cx="15" cy="6" r="1.5" fill="currentColor" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" />
      <circle cx="15" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
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
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
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
