"use client";

import {
  useEffect,
  useRef,
  useState,
  useActionState,
  type ChangeEvent,
} from "react";

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
  addChild,
  addChildParent,
  addChildWish,
  cancelChildWishReservation,
  deleteChild,
  editChild,
  editChildWish,
  markChildWishPurchased,
  removeChildParent,
  removeChildWish,
  reserveChildWish,
  unmarkChildWishPurchased,
  type ActionResult,
} from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { useCollapse } from "@/lib/use-collapse";
import { AvatarCropDialog } from "@/components/avatar-crop-dialog";
import { BottomSheet } from "@/components/bottom-sheet";
import { ConfirmDialog, type ConfirmState } from "@/components/confirm-dialog";
import { LinkPasteField } from "@/components/link-paste-field";
import { Presence } from "@/components/presence";
import { Select } from "@/components/select";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/format";
import { useMediaQuery } from "@/lib/use-media-query";

export type ChildReservation = {
  state: "reserved" | "purchased";
  isMine: boolean;
  reserverName: string | null;
};

export type ChildWish = {
  id: number;
  text: string;
  link: string | null;
  price: number | null;
  reservation: ChildReservation | null;
};

export type ChildItem = {
  id: number;
  name: string;
  avatarUrl: string | null;
  isMyChild: boolean;
  parents: { id: string; name: string; isCreator: boolean }[];
  wishes: ChildWish[];
};

export type ChildrenData = {
  me: string;
  kids: ChildItem[];
  users: { id: string; fullName: string }[];
};

const empty: ActionResult = { ok: false };

export function ChildrenPanel({
  me,
  kids,
  users,
  onAnimState,
}: ChildrenData & { onAnimState?: (on: boolean) => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(
    kids[0]?.id ?? null
  );
  const [addOpen, setAddOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { mounted: addFormMounted, shown: addFormShown } = useCollapse(
    addOpen && isDesktop
  );
  useEffect(() => {
    if (!isDesktop || !onAnimState) return;
    onAnimState(true);
    const t = setTimeout(() => onAnimState(false), 250);
    return () => clearTimeout(t);
  }, [addFormShown, isDesktop, onAnimState]);
  const [childName, setChildName] = useState("");
  const [childPhoto, setChildPhoto] = useState<File | null>(null);
  const [childPhotoUrl, setChildPhotoUrl] = useState<string | null>(null);
  const [childClearConfirm, setChildClearConfirm] = useState<ConfirmState | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (childPhotoUrl) URL.revokeObjectURL(childPhotoUrl);
    };
  }, [childPhotoUrl]);

  useEffect(() => {
    if (selectedId != null && !kids.some((k) => k.id === selectedId)) {
      setSelectedId(kids[0]?.id ?? null);
    }
  }, [kids, selectedId]);

  const selected = kids.find((k) => k.id === selectedId) ?? null;

  const childForm = (
    <AddChildForm
      onDone={() => setAddOpen(false)}
      name={childName}
      setName={setChildName}
      photo={childPhoto}
      setPhoto={setChildPhoto}
      photoUrl={childPhotoUrl}
      setPhotoUrl={setChildPhotoUrl}
      canClear={!!(childName || childPhoto)}
      onClearRequest={() =>
        setChildClearConfirm({
          message: "Wyczyścić wprowadzone dane?",
          confirmLabel: "Wyczyść",
          onConfirm: () => {
            setChildName("");
            setChildPhoto(null);
            setChildPhotoUrl(null);
          },
        })
      }
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Zarezerwuj prezent z listy życzeń dziecka, a gdy go kupisz, oznacz go
        jako kupiony.
      </p>
      {kids.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {kids.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setSelectedId(k.id)}
              aria-pressed={selectedId === k.id}
              className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm font-semibold transition-colors ${
                selectedId === k.id
                  ? "border-accent bg-accent text-white"
                  : "border-input-line bg-surface text-ink hover:bg-mist"
              }`}
            >
              <Avatar name={k.name} src={k.avatarUrl} size={26} />
              {k.name}
            </button>
          ))}
          {(!addOpen || !isDesktop) && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-input-line bg-surface py-1.5 pl-3.5 pr-4 text-sm font-semibold text-ink hover:bg-mist"
            >
              <PlusCircleIcon />
              Dodaj dziecko
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-dashed border-line bg-mist p-4 text-sm text-muted">
          Nikt nie dodał jeszcze żadnego dziecka.
          {(!addOpen || !isDesktop) && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-mist"
            >
              <PlusCircleIcon />
              Dodaj dziecko
            </button>
          )}
        </div>
      )}
      {addFormMounted && (
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
            addFormShown
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden" inert={!addFormShown}>
            {childForm}
          </div>
        </div>
      )}
      {!isDesktop && (
        <BottomSheet open={addOpen} onClose={() => setAddOpen(false)}>
          {childForm}
        </BottomSheet>
      )}
      {selected && (
        <ChildDetail key={selected.id} me={me} child={selected} users={users} />
      )}
      <ConfirmDialog
        state={childClearConfirm}
        onClose={() => setChildClearConfirm(null)}
      />
    </div>
  );
}

function AddChildForm({
  onDone,
  name,
  setName,
  photo,
  setPhoto,
  photoUrl,
  setPhotoUrl,
  canClear,
  onClearRequest,
}: {
  onDone: () => void;
  name: string;
  setName: (v: string) => void;
  photo: File | null;
  setPhoto: (f: File | null) => void;
  photoUrl: string | null;
  setPhotoUrl: (u: string | null) => void;
  canClear: boolean;
  onClearRequest: () => void;
}) {
  const [state, action, pending] = useActionState(addChild, empty);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (state.ok) {
      setName("");
      setPhoto(null);
      setPhotoUrl(null);
      onDone();
    }
  }, [state, onDone, setName, setPhoto, setPhotoUrl]);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCropFile(file);
  }

  function handleCropSave(cropped: File) {
    setPhoto(cropped);
    setPhotoUrl(URL.createObjectURL(cropped));
    setCropFile(null);
  }

  function removePhoto() {
    setPhoto(null);
    setPhotoUrl(null);
  }

  return (
    <form
      action={(formData) => {
        if (photo) formData.append("photo", photo);
        action(formData);
      }}
      className="flex flex-col gap-3 rounded-[10px] border border-line bg-mist p-3.5"
    >
      <h4 className="text-sm font-semibold text-ink">Nowe dziecko</h4>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="child-add-name"
          className="text-[13px] font-medium text-faint"
        >
          Imię
        </label>
        <input
          id="child-add-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          placeholder="Imię dziecka"
          autoComplete="off"
          className="rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-faint">
          Zdjęcie (opcjonalnie)
        </span>
        <div className="flex items-center gap-3">
          <Avatar name={name || "?"} src={photoUrl} size={48} />
        <div className="flex flex-col items-start gap-0.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="text-sm font-medium text-accent-deep hover:underline disabled:opacity-50"
          >
            {photo ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
          </button>
          {photo && (
            <button
              type="button"
              onClick={removePhoto}
              disabled={pending}
              className="text-sm text-danger hover:underline disabled:opacity-50"
            >
              Usuń zdjęcie
            </button>
          )}
        </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFile}
            />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep"
        >
          {pending ? <SpinnerIcon /> : <PlusCircleIcon />}
          {pending ? "Dodawanie…" : "Dodaj dziecko"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium hover:bg-surface/60 disabled:opacity-50"
        >
          Anuluj
        </button>
        {!isDesktop && (
          <button
            type="button"
            onClick={onClearRequest}
            disabled={pending || !canClear}
            className="rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium hover:bg-surface/60 disabled:opacity-50"
          >
            Wyczyść
          </button>
        )}
      </div>
      {!state.ok && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {cropFile && (
        <AvatarCropDialog
          file={cropFile}
          busy={false}
          onClose={() => setCropFile(null)}
          onSave={handleCropSave}
        />
      )}
    </form>
  );
}

function EditChildForm({
  child,
  onDone,
}: {
  child: ChildItem;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(editChild, empty);
  const [name, setName] = useState(child.name);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCropFile(file);
  }

  function handleCropSave(cropped: File) {
    setPhoto(cropped);
    setPhotoUrl(URL.createObjectURL(cropped));
    setRemovePhoto(false);
    setCropFile(null);
  }

  const previewUrl = photoUrl ?? (removePhoto ? null : child.avatarUrl);

  return (
    <form
      action={(formData) => {
        formData.set("child_id", String(child.id));
        if (photo) formData.append("photo", photo);
        if (removePhoto) formData.set("remove_photo", "1");
        action(formData);
      }}
      className="flex flex-col gap-3 rounded-[10px] border border-line bg-mist p-3.5"
    >
      <h4 className="text-sm font-semibold text-ink">Edytuj dziecko</h4>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="child-edit-name"
          className="text-[13px] font-medium text-faint"
        >
          Imię
        </label>
        <input
          id="child-edit-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          placeholder="Imię dziecka"
          autoComplete="off"
          className="rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-faint">
          Zdjęcie (opcjonalnie)
        </span>
        <div className="flex items-center gap-3">
          <Avatar name={name || child.name || "?"} src={previewUrl} size={48} />
          <div className="flex flex-col items-start gap-0.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className="text-sm font-medium text-accent-deep hover:underline disabled:opacity-50"
            >
              {photo ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
            </button>
            {photo && (
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  setPhotoUrl(null);
                }}
                disabled={pending}
                className="text-sm text-danger hover:underline disabled:opacity-50"
              >
                Cofnij zmianę zdjęcia
              </button>
            )}
            {!photo && child.avatarUrl && !removePhoto && (
              <button
                type="button"
                onClick={() => setRemovePhoto(true)}
                disabled={pending}
                className="text-sm text-danger hover:underline disabled:opacity-50"
              >
                Usuń zdjęcie
              </button>
            )}
            {removePhoto && (
              <button
                type="button"
                onClick={() => setRemovePhoto(false)}
                disabled={pending}
                className="text-sm text-danger hover:underline disabled:opacity-50"
              >
                Przywróć zdjęcie
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep"
        >
          {pending ? <SpinnerIcon /> : <CheckIcon />}
          {pending ? "Zapisywanie…" : "Zapisz zmiany"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium hover:bg-surface/60 disabled:opacity-50"
        >
          Anuluj
        </button>
      </div>
      {!state.ok && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {cropFile && (
        <AvatarCropDialog
          file={cropFile}
          busy={false}
          onClose={() => setCropFile(null)}
          onSave={handleCropSave}
        />
      )}
    </form>
  );
}

function ChildDetail({
  me,
  child,
  users,
}: {
  me: string;
  child: ChildItem;
  users: { id: string; fullName: string }[];
}) {
  const isParent = child.isMyChild;
  const [localWishes, setLocalWishes] = useState<ChildWish[]>(child.wishes);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [menuWish, setMenuWish] = useState<ChildWish | null>(null);
  const [menuChild, setMenuChild] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [parentPick, setParentPick] = useState("");
  const [wishAddOpen, setWishAddOpen] = useState(false);
  const [parentAddOpen, setParentAddOpen] = useState(false);
  const [wishAddText, setWishAddText] = useState("");
  const [wishAddLink, setWishAddLink] = useState("");
  const [wishAddPrice, setWishAddPrice] = useState("");
  const [clearConfirm, setClearConfirm] = useState<ConfirmState | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [deleteState, deleteAction] = useActionState(deleteChild, empty);
  const [detachState, detachAction, detachPending] = useActionState(
    removeChildParent,
    empty
  );
  const [addParentState, addParentAction, addParentPending] = useActionState(
    addChildParent,
    empty
  );
  const [deleteConfirm, setDeleteConfirm] = useState<ConfirmState | null>(
    null
  );
  const [detachConfirm, setDetachConfirm] = useState<ConfirmState | null>(
    null
  );

  useEffect(() => {
    setLocalWishes(child.wishes);
  }, [child.wishes]);

  useEffect(() => {
    if (addParentState.ok) {
      setParentPick("");
      setParentAddOpen(false);
    }
  }, [addParentState]);

  const editingWish =
    editingId != null
      ? localWishes.find((w) => w.id === editingId) ?? null
      : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function applyOrder(next: ChildWish[]) {
    const prev = localWishes;
    setReorderError(null);
    setLocalWishes(next);
    createClient()
      .rpc("reorder_child_wishes", { p_ids: next.map((w) => w.id) })
      .then(({ error }) => {
        if (error) {
          setLocalWishes(prev);
          setReorderError("Nie udało się zapisać kolejności życzeń.");
        }
      });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = localWishes.findIndex((w) => w.id === active.id);
    const newIndex = localWishes.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    applyOrder(arrayMove(localWishes, oldIndex, newIndex));
  }

  function handleMoveTo(wish: ChildWish, target: number) {
    const index = localWishes.findIndex((w) => w.id === wish.id);
    if (index === -1 || index === target) return;
    if (target < 0 || target >= localWishes.length) return;
    applyOrder(arrayMove(localWishes, index, target));
  }

  function handleMove(wish: ChildWish, dir: -1 | 1) {
    const index = localWishes.findIndex((w) => w.id === wish.id);
    const target = index + dir;
    if (index === -1 || target < 0 || target >= localWishes.length) return;
    applyOrder(arrayMove(localWishes, index, target));
  }

  function applyOptimistic(wishId: number, reservation: ChildReservation | null) {
    setLocalWishes((prev) => {
      const target = prev.find((w) => w.id === wishId);
      if (!target) return prev;
      const cur = target.reservation;
      if (
        cur === reservation ||
        (cur != null &&
          reservation != null &&
          cur.state === reservation.state &&
          cur.isMine === reservation.isMine &&
          cur.reserverName === reservation.reserverName)
      ) {
        return prev;
      }
      return prev.map((w) => (w.id === wishId ? { ...w, reservation } : w));
    });
  }

  function detachParent(userId: string, userName: string) {
    setDetachConfirm({
      message: `Odłączyć ${userName} od tego dziecka? Jego rezerwacje na tym dziecku zostaną anulowane.`,
      confirmLabel: "Odłącz",
      tone: "danger",
      onConfirm: () => {
        const fd = new FormData();
        fd.set("child_id", String(child.id));
        fd.set("user_id", userId);
        detachAction(fd);
      },
    });
  }

  function handleDelete() {
    setDeleteConfirm({
      message: `Usunąć dziecko ${child.name} wraz z listą życzeń? Tej operacji nie można cofnąć.`,
      confirmLabel: "Usuń dziecko",
      tone: "danger",
      onConfirm: () => {
        const fd = new FormData();
        fd.set("child_id", String(child.id));
        deleteAction(fd);
      },
    });
  }

  const availableUsers = users.filter(
    (u) => u.id !== me && !child.parents.some((p) => p.id === u.id)
  );
  const menuIndex = menuWish
    ? localWishes.findIndex((w) => w.id === menuWish.id)
    : -1;

  const childMenuActions = (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          setMenuChild(false);
          setEditOpen(true);
        }}
        aria-label={`Edytuj dziecko: ${child.name}`}
        className="flex items-center gap-2 rounded-xl border border-input-line bg-mist px-4 py-2.5 text-sm font-medium text-ink hover:bg-icon-hover"
      >
        <PencilIcon />
        Edytuj
      </button>
      <button
        type="button"
        onClick={() => {
          setMenuChild(false);
          handleDelete();
        }}
        aria-label={`Usuń dziecko: ${child.name}`}
        className="flex items-center gap-2 rounded-xl border border-danger-soft bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger hover:opacity-80"
      >
        <TrashIcon />
        Usuń dziecko
      </button>
      <button
        type="button"
        onClick={() => setMenuChild(false)}
        className="rounded-xl px-4 py-2 text-sm font-medium text-muted hover:bg-mist"
      >
        Anuluj
      </button>
    </div>
  );

  const wishAddButton = (
    <button
      type="button"
      onClick={() => setWishAddOpen(true)}
      className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-input-line bg-surface px-3 py-2.5 text-sm font-medium text-ink hover:bg-mist"
    >
      <PlusCircleIcon />
      Dodaj życzenie
    </button>
  );

  const wishAddEmpty = !wishAddText && !wishAddLink && !wishAddPrice;

  const wishAddForm = (
    <AddChildWishForm
      childId={child.id}
      text={wishAddText}
      link={wishAddLink}
      price={wishAddPrice}
      setText={setWishAddText}
      setLink={setWishAddLink}
      setPrice={setWishAddPrice}
      canClear={!wishAddEmpty}
      onClearRequest={() =>
        setClearConfirm({
          message: "Wyczyścić wprowadzone dane?",
          confirmLabel: "Wyczyść",
          onConfirm: () => {
            setWishAddText("");
            setWishAddLink("");
            setWishAddPrice("");
          },
        })
      }
      onClose={() => setWishAddOpen(false)}
    />
  );

  const parentForm = (
    <form
      action={(formData) => {
        formData.set("child_id", String(child.id));
        formData.set("user_id", parentPick);
        addParentAction(formData);
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label
          htmlFor="parent-add-select"
          className="text-[13px] font-medium text-faint"
        >
          Osoba
        </label>
        <Select
          id="parent-add-select"
          value={parentPick}
          onChange={(v) => setParentPick(v)}
          options={availableUsers.map((u) => ({
            value: u.id,
            label: u.fullName,
          }))}
          direction="up"
          scrollable={false}
          placeholder="Wybierz osobę…"
          className="min-w-0"
        />
      </div>
      <button
        type="submit"
        disabled={!parentPick || addParentPending}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep"
      >
        {addParentPending ? <SpinnerIcon /> : null}
        {addParentPending ? "Dodawanie…" : "Dodaj rodzica"}
      </button>
      {!isDesktop && (
        <button
          type="button"
          onClick={() =>
            setClearConfirm({
              message: "Wyczyścić wprowadzone dane?",
              confirmLabel: "Wyczyść",
              onConfirm: () => setParentPick(""),
            })
          }
          disabled={addParentPending || !parentPick}
          className="rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium hover:bg-mist disabled:opacity-50"
        >
          Wyczyść
        </button>
      )}
    </form>
  );

  const parentAddButton = (
    <button
      type="button"
      onClick={() => setParentAddOpen(true)}
      className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-input-line bg-surface px-3 py-2.5 text-sm font-medium text-ink hover:bg-mist"
    >
      <PlusCircleIcon />
      Dodaj rodzica
    </button>
  );

  const menuActions = menuWish ? (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          handleMoveTo(menuWish, 0);
          setMenuWish(null);
        }}
        disabled={menuIndex === 0}
        aria-label={`Na samą górę: ${menuWish.text}`}
        className="flex items-center gap-2 rounded-xl border border-input-line bg-mist px-4 py-2.5 text-sm font-medium text-ink hover:bg-icon-hover disabled:opacity-50"
      >
        <ArrowToTopIcon />
        Na samą górę
      </button>
      <button
        type="button"
        onClick={() => {
          handleMove(menuWish, -1);
          setMenuWish(null);
        }}
        disabled={menuIndex === 0}
        aria-label={`Przenieś wyżej: ${menuWish.text}`}
        className="flex items-center gap-2 rounded-xl border border-input-line bg-mist px-4 py-2.5 text-sm font-medium text-ink hover:bg-icon-hover disabled:opacity-50"
      >
        <ArrowUpIcon />
        Przenieś wyżej
      </button>
      <button
        type="button"
        onClick={() => {
          handleMove(menuWish, 1);
          setMenuWish(null);
        }}
        disabled={menuIndex === localWishes.length - 1}
        aria-label={`Przenieś niżej: ${menuWish.text}`}
        className="flex items-center gap-2 rounded-xl border border-input-line bg-mist px-4 py-2.5 text-sm font-medium text-ink hover:bg-icon-hover disabled:opacity-50"
      >
        <ArrowDownIcon />
        Przenieś niżej
      </button>
      <button
        type="button"
        onClick={() => {
          handleMoveTo(menuWish, localWishes.length - 1);
          setMenuWish(null);
        }}
        disabled={menuIndex === localWishes.length - 1}
        aria-label={`Na sam dół: ${menuWish.text}`}
        className="flex items-center gap-2 rounded-xl border border-input-line bg-mist px-4 py-2.5 text-sm font-medium text-ink hover:bg-icon-hover disabled:opacity-50"
      >
        <ArrowToBottomIcon />
        Na sam dół
      </button>
      <button
        type="button"
        onClick={() => {
          setEditingId(menuWish.id);
          setMenuWish(null);
        }}
        aria-label={`Edytuj życzenie: ${menuWish.text}`}
        className="flex items-center gap-2 rounded-xl border border-input-line bg-mist px-4 py-2.5 text-sm font-medium text-ink hover:bg-icon-hover"
      >
        <PencilIcon />
        Edytuj
      </button>
      <button
        type="button"
        onClick={() => {
          const fd = new FormData();
          fd.set("id", String(menuWish.id));
          removeChildWish(fd);
          setMenuWish(null);
        }}
        aria-label={`Usuń życzenie: ${menuWish.text}`}
        className="flex items-center gap-2 rounded-xl border border-danger-soft bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger hover:opacity-80"
      >
        <TrashIcon />
        Usuń
      </button>
      <button
        type="button"
        onClick={() => setMenuWish(null)}
        className="rounded-xl px-4 py-2 text-sm font-medium text-muted hover:bg-mist"
      >
        Anuluj
      </button>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <article className="flex flex-col gap-2.5 rounded-[14px] bg-mist p-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-sage-200 px-2.5 text-xs font-bold text-list-ink">
            <ListIcon />
            Lista życzeń
          </span>
          {isParent && (
            <span className="inline-flex h-[26px] items-center rounded-full bg-honey-200 px-2.5 text-xs font-bold text-honey-800">
              Twoje dziecko
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <p className="flex min-w-0 items-center gap-2.5 text-[28px] font-bold leading-tight text-[#0f3d24] dark:text-[#7cc99a]">
            <Avatar name={child.name} src={child.avatarUrl} size={36} />
            <span className="truncate">{child.name}</span>
          </p>
          {isParent && (
            <button
              type="button"
              onClick={() => setMenuChild(true)}
              aria-label={`Opcje: ${child.name}`}
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-icon-hover"
            >
              <MoreIcon />
            </button>
          )}
        </div>
        <p className="text-sm text-[#4a5c50] dark:text-muted">
          Ułożone od najbardziej wymarzonego.
        </p>
        {isParent && editOpen && isDesktop && (
          <EditChildForm child={child} onDone={() => setEditOpen(false)} />
        )}
        {!deleteState.ok && deleteState.error && (
          <p className="text-sm text-red-600">{deleteState.error}</p>
        )}
        {localWishes.length > 0 ? (
          isParent ? (
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
                    <SortableChildWishRow
                      key={wish.id}
                      wish={wish}
                      index={index}
                      isEditing={editingId === wish.id && isDesktop}
                      onMenu={setMenuWish}
                      onOptimistic={(r) => applyOptimistic(wish.id, r)}
                      onCancelEdit={() => setEditingId(null)}
                    />
                  ))}
                  {!wishAddOpen && <li>{wishAddButton}</li>}
                  {wishAddOpen && isDesktop && <li>{wishAddForm}</li>}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
            <ul className="flex flex-col gap-2">
              {localWishes.map((wish, index) => (
                <ChildWishRow
                  key={wish.id}
                  wish={wish}
                  index={index}
                  onOptimistic={(r) => applyOptimistic(wish.id, r)}
                />
              ))}
            </ul>
          )
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[#4a5c50] dark:text-muted">
              Brak życzeń na liście.
            </p>
            {isParent && !wishAddOpen && wishAddButton}
            {isParent && wishAddOpen && isDesktop && wishAddForm}
          </div>
        )}
        {reorderError && <p className="text-sm text-red-600">{reorderError}</p>}
      </article>

      {isParent && !isDesktop && wishAddOpen && (
        <BottomSheet open onClose={() => setWishAddOpen(false)}>
          {wishAddForm}
        </BottomSheet>
      )}

      {isParent && (
        <div className="flex flex-col gap-2.5 rounded-[10px] border border-line bg-mist p-3.5">
          <h4 className="text-sm font-semibold text-ink">Rodzice</h4>
          {child.parents.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-2 text-sm text-ink"
            >
              <span className="font-medium">{p.name}</span>
              {p.isCreator && (
                <span className="rounded-full bg-sage-150 px-2 py-0.5 text-xs font-semibold text-accent dark:bg-sage-300 dark:text-[#e6f6ec]">
                  twórca
                </span>
              )}
              {!p.isCreator && (
                <button
                  type="button"
                  onClick={() => detachParent(p.id, p.name)}
                  disabled={detachPending}
                  className="ml-auto rounded-lg border border-input-line bg-surface px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
                >
                  Odłącz
                </button>
              )}
            </div>
          ))}
          {child.parents.length < 2 && isDesktop && parentForm}
          {child.parents.length < 2 && !isDesktop && !parentAddOpen && (
            parentAddButton
          )}
          {(!addParentState.ok && addParentState.error) ||
          (!detachState.ok && detachState.error) ? (
            <p className="text-sm text-red-600">
              {addParentState.error ?? detachState.error}
            </p>
          ) : null}
        </div>
      )}

      {!isDesktop && parentAddOpen && (
        <BottomSheet open onClose={() => setParentAddOpen(false)}>
          {parentForm}
        </BottomSheet>
      )}
      {!isDesktop && editingWish && (
        <BottomSheet open onClose={() => setEditingId(null)}>
          <EditChildWishForm
            wish={editingWish}
            onCancel={() => setEditingId(null)}
          />
        </BottomSheet>
      )}
      {!isDesktop && (
        <BottomSheet
          open={!!menuWish}
          onClose={() => setMenuWish(null)}
          title={menuWish?.text}
          closeOnBackdrop
        >
          {menuActions}
        </BottomSheet>
      )}
      {isDesktop && (
        <Presence
          open={!!menuWish}
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          onClick={() => setMenuWish(null)}
          backdrop
          sheetClassName="relative w-full max-w-xs"
          sheetOnClick={(e) => e.stopPropagation()}
        >
          {menuWish && (
            <div className="rounded-2xl bg-surface p-4 shadow-lg">
              <p className="mb-3 truncate text-sm font-semibold text-ink">
                {menuWish.text}
              </p>
              {menuActions}
            </div>
          )}
        </Presence>
      )}
      {!isDesktop && (
        <BottomSheet
          open={menuChild}
          onClose={() => setMenuChild(false)}
          title={child.name}
          closeOnBackdrop
        >
          {childMenuActions}
        </BottomSheet>
      )}
      {isDesktop && (
        <Presence
          open={menuChild}
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          onClick={() => setMenuChild(false)}
          backdrop
          sheetClassName="relative w-full max-w-xs"
          sheetOnClick={(e) => e.stopPropagation()}
        >
          {menuChild && (
            <div className="rounded-2xl bg-surface p-4 shadow-lg">
              <p className="mb-3 truncate text-sm font-semibold text-ink">
                {child.name}
              </p>
              {childMenuActions}
            </div>
          )}
        </Presence>
      )}
      {!isDesktop && editOpen && (
        <BottomSheet open onClose={() => setEditOpen(false)}>
          <EditChildForm child={child} onDone={() => setEditOpen(false)} />
        </BottomSheet>
      )}
      <ConfirmDialog
        state={deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
      />
      <ConfirmDialog state={clearConfirm} onClose={() => setClearConfirm(null)} />
      <ConfirmDialog
        state={detachConfirm}
        onClose={() => setDetachConfirm(null)}
      />
    </div>
  );
}

function ChildWishRow({
  wish,
  index,
  onOptimistic,
}: {
  wish: ChildWish;
  index: number;
  onOptimistic: (r: ChildReservation | null) => void;
}) {
  const purchased = wish.reservation?.state === "purchased";
  return (
    <li className="flex flex-col gap-2 rounded-[10px] bg-surface px-3.5 py-3">
      <div className="flex min-h-[36px] items-center justify-between gap-3">
        <span className="min-w-0 text-[15px] leading-snug">
          <span className="select-none font-medium text-[#4a5c50] dark:text-muted">
            {index + 1}.
          </span>{" "}
          <span
            className={`font-semibold ${
              purchased ? "text-muted line-through" : "text-ink"
            }`}
          >
            {wish.text}
          </span>
        </span>
        <WishPrice price={wish.price} purchased={purchased} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {wish.link && (
          <a
            href={wish.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[13px] font-semibold text-[#14532d] dark:text-list-ink"
          >
            Zobacz w sklepie
            <ExternalLinkIcon />
          </a>
        )}
        <ReservationControls wish={wish} onOptimistic={onOptimistic} />
      </div>
    </li>
  );
}

function SortableChildWishRow({
  wish,
  index,
  isEditing,
  onMenu,
  onOptimistic,
  onCancelEdit,
}: {
  wish: ChildWish;
  index: number;
  isEditing: boolean;
  onMenu: (wish: ChildWish) => void;
  onOptimistic: (r: ChildReservation | null) => void;
  onCancelEdit: () => void;
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
      <li ref={setNodeRef} style={style}>
        <EditChildWishForm wish={wish} onCancel={onCancelEdit} />
      </li>
    );
  }

  const purchased = wish.reservation?.state === "purchased";
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-2 rounded-[10px] bg-surface px-3.5 py-3 ${
        isDragging ? "relative z-10 opacity-50" : ""
      }`}
    >
      <div className="flex min-h-[36px] items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Przesuń życzenie: ${wish.text}`}
          title="Przesuń"
          className="flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted hover:bg-icon-hover active:cursor-grabbing"
        >
          <GripIcon />
        </button>
        <span className="min-w-0 flex-1 text-[15px] leading-snug">
          <span className="select-none font-medium text-[#4a5c50] dark:text-muted">
            {index + 1}.
          </span>{" "}
          <span
            className={`font-semibold ${
              purchased ? "text-muted line-through" : "text-ink"
            }`}
          >
            {wish.text}
          </span>
        </span>
        <WishPrice price={wish.price} purchased={purchased} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMenu(wish);
          }}
          aria-label={`Opcje życzenia: ${wish.text}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-icon-hover"
        >
          <MoreIcon />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-12">
        {wish.link && (
          <a
            href={wish.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[13px] font-semibold text-[#14532d] dark:text-list-ink"
          >
            Zobacz w sklepie
            <ExternalLinkIcon />
          </a>
        )}
        <ReservationControls wish={wish} onOptimistic={onOptimistic} />
      </div>
    </li>
  );
}

function WishPrice({
  price,
  purchased,
}: {
  price: number | null;
  purchased?: boolean;
}) {
  return price != null ? (
    <span
      className={`shrink-0 whitespace-nowrap text-base font-semibold tabular-nums ${
        purchased ? "text-muted line-through" : "text-[#15251b] dark:text-ink"
      }`}
    >
      {formatPrice(price)}
    </span>
  ) : (
    <span className="shrink-0 whitespace-nowrap text-[13px] text-[#4a5c50] dark:text-muted">
      Brak ceny
    </span>
  );
}

function ReservationControls({
  wish,
  onOptimistic,
}: {
  wish: ChildWish;
  onOptimistic: (r: ChildReservation | null) => void;
}) {
  const [reserveState, reserveAction, reservePending] = useActionState(
    reserveChildWish,
    empty
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelChildWishReservation,
    empty
  );
  const [buyState, buyAction, buyPending] = useActionState(
    markChildWishPurchased,
    empty
  );
  const [unbuyState, unbuyAction, unbuyPending] = useActionState(
    unmarkChildWishPurchased,
    empty
  );

  const r = wish.reservation;
  const prevRef = useRef<ChildReservation | null>(null);

  useEffect(() => {
    if (
      reserveState.error ||
      cancelState.error ||
      buyState.error ||
      unbuyState.error
    ) {
      onOptimistic(prevRef.current);
    }
  }, [reserveState, cancelState, buyState, unbuyState, onOptimistic]);

  const fd = () => {
    const f = new FormData();
    f.set("wish_id", String(wish.id));
    return f;
  };

  if (!r) {
    return (
      <span
        className="flex flex-wrap items-center gap-2 md:ml-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            prevRef.current = r;
            onOptimistic({ state: "reserved", isMine: true, reserverName: null });
            reserveAction(fd());
          }}
          disabled={reservePending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep"
        >
          {reservePending && <SpinnerIcon />}
          Zarezerwuj
        </button>
        {!reserveState.ok && reserveState.error && (
          <span className="text-[13px] text-red-600">{reserveState.error}</span>
        )}
      </span>
    );
  }

  if (r.isMine && r.state === "reserved") {
    return (
      <span
        className="flex flex-wrap items-center gap-2 md:ml-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            prevRef.current = r;
            onOptimistic({ ...r, state: "purchased" });
            buyAction(fd());
          }}
          disabled={buyPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep"
        >
          {buyPending ? <SpinnerIcon /> : <CheckIcon />}
          Oznacz jako kupiony
        </button>
        <button
          type="button"
          onClick={() => {
            prevRef.current = r;
            onOptimistic(null);
            cancelAction(fd());
          }}
          disabled={cancelPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-mist disabled:opacity-50"
        >
          {cancelPending && <SpinnerIcon />}
          Anuluj rezerwację
        </button>
        {(!buyState.ok && buyState.error) ||
        (!cancelState.ok && cancelState.error) ? (
          <span className="text-[13px] text-red-600">
            {buyState.error ?? cancelState.error}
          </span>
        ) : null}
      </span>
    );
  }

  if (r.isMine && r.state === "purchased") {
    return (
      <span
        className="flex flex-wrap items-center gap-2 md:ml-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-200 px-2.5 py-1 text-xs font-bold text-list-ink">
          <CheckIcon />
          Kupiony
        </span>
        <button
          type="button"
          onClick={() => {
            prevRef.current = r;
            onOptimistic({ ...r, state: "reserved" });
            unbuyAction(fd());
          }}
          disabled={unbuyPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-mist disabled:opacity-50"
        >
          {unbuyPending && <SpinnerIcon />}
          Cofnij
        </button>
        {!unbuyState.ok && unbuyState.error && (
          <span className="text-[13px] text-red-600">{unbuyState.error}</span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold md:ml-auto ${
        r.state === "purchased"
          ? "bg-sage-200 text-list-ink"
          : "bg-honey-200 text-honey-800"
      }`}
    >
      {r.state === "purchased" ? <CheckIcon /> : <LockIcon />}
      {r.state === "purchased" ? "Kupiony" : "Zarezerwowany"}
      {r.reserverName ? ` przez ${r.reserverName}` : ""}
    </span>
  );
}

function AddChildWishForm({
  childId,
  text,
  link,
  price,
  setText,
  setLink,
  setPrice,
  canClear,
  onClearRequest,
  onClose,
}: {
  childId: number;
  text: string;
  link: string;
  price: string;
  setText: (v: string) => void;
  setLink: (v: string) => void;
  setPrice: (v: string) => void;
  canClear: boolean;
  onClearRequest: () => void;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(addChildWish, empty);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (state.ok) {
      setText("");
      setLink("");
      setPrice("");
      onClose();
    }
  }, [state, onClose, setText, setLink, setPrice]);

  return (
    <form
      action={(formData) => {
        formData.set("child_id", String(childId));
        action(formData);
      }}
      className="flex flex-col gap-3 rounded-[10px] border border-line bg-mist p-3.5"
    >
      <h4 className="text-sm font-semibold text-ink">Dodaj życzenie</h4>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="child-wish-add-text"
          className="text-[13px] font-medium text-faint"
        >
          Życzenie
        </label>
        <input
          id="child-wish-add-text"
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          maxLength={500}
          placeholder="Czego dziecko sobie życzy?"
          autoComplete="off"
          className="rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <label
            htmlFor="child-wish-add-link"
            className="text-[13px] font-medium text-faint"
          >
            Link (opcjonalnie)
          </label>
          <LinkPasteField
            id="child-wish-add-link"
            name="link"
            value={link}
            onChange={setLink}
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-[140px]">
          <label
            htmlFor="child-wish-add-price"
            className="text-[13px] font-medium text-faint"
          >
            Cena (zł)
          </label>
          <input
            id="child-wish-add-price"
            name="price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="text"
            inputMode="decimal"
            placeholder="np. 49,99"
            autoComplete="off"
            className="w-full rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-w-[152px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep"
        >
          {pending ? <SpinnerIcon /> : <PlusCircleIcon />}
          {pending ? "Dodawanie…" : "Dodaj życzenie"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium hover:bg-mist disabled:opacity-50"
        >
          Anuluj
        </button>
        {!isDesktop && (
          <button
            type="button"
            onClick={onClearRequest}
            disabled={pending || !canClear}
            className="rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium hover:bg-mist disabled:opacity-50"
          >
            Wyczyść
          </button>
        )}
      </div>
      {!state.ok && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}

function EditChildWishForm({
  wish,
  onCancel,
}: {
  wish: ChildWish;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(editChildWish, empty);
  const [text, setText] = useState(wish.text);
  const [link, setLink] = useState(wish.link ?? "");
  const [price, setPrice] = useState(
    wish.price != null ? String(wish.price) : ""
  );

  useEffect(() => {
    if (state.ok) onCancel();
  }, [state, onCancel]);

  return (
    <form
      action={(formData) => {
        formData.set("id", String(wish.id));
        action(formData);
      }}
      className="flex flex-col gap-3 rounded-[10px] bg-mist p-3"
    >
      <h4 className="text-sm font-semibold text-ink">Edytuj życzenie</h4>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`child-wish-edit-text-${wish.id}`}
          className="text-[13px] font-medium text-faint"
        >
          Życzenie
        </label>
        <input
          id={`child-wish-edit-text-${wish.id}`}
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          maxLength={500}
          autoComplete="off"
          className="rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <label
            htmlFor={`child-wish-edit-link-${wish.id}`}
            className="text-[13px] font-medium text-faint"
          >
            Link (opcjonalnie)
          </label>
          <LinkPasteField
            id={`child-wish-edit-link-${wish.id}`}
            name="link"
            value={link}
            onChange={setLink}
          />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-[140px]">
          <label
            htmlFor={`child-wish-edit-price-${wish.id}`}
            className="text-[13px] font-medium text-faint"
          >
            Cena (zł)
          </label>
          <input
            id={`child-wish-edit-price-${wish.id}`}
            name="price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="text"
            inputMode="decimal"
            placeholder="np. 49,99"
            autoComplete="off"
            className="w-full rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-w-[152px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep"
        >
          {pending ? <SpinnerIcon /> : "Zapisz zmiany"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium hover:bg-mist disabled:opacity-50"
        >
          Anuluj
        </button>
      </div>
      {!state.ok && state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}

function ListIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="6" r="2" fill="currentColor" />
      <circle cx="9" cy="12" r="2" fill="currentColor" />
      <circle cx="9" cy="18" r="2" fill="currentColor" />
      <circle cx="15" cy="6" r="2" fill="currentColor" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <circle cx="15" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
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

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
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

function SpinnerIcon() {
  return (
    <svg
      width="13"
      height="13"
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

function ArrowUpIcon() {
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
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

function ArrowDownIcon() {
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
      <path d="M12 5v14" />
      <path d="M19 12l-7 7-7-7" />
    </svg>
  );
}

function ArrowToTopIcon() {
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
      <path d="M5 4h14" />
      <path d="M12 20V9" />
      <path d="M8 13l4-4 4 4" />
    </svg>
  );
}

function ArrowToBottomIcon() {
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
      <path d="M5 20h14" />
      <path d="M12 4v11" />
      <path d="M8 11l4 4 4-4" />
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
