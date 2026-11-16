"use client";

import {
  useRef,
  useState,
  useActionState,
  useTransition,
  type ChangeEvent,
} from "react";

import {
  deleteAvatar,
  saveName,
  uploadAvatar,
  type ActionResult,
} from "@/app/actions";
import { Avatar } from "@/components/avatar";

const empty: ActionResult = { ok: false };

async function cropToSquare(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const out = Math.min(side, 512);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("brak kontekstu canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out, out);
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      out,
      out
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("kodowanie"))),
        "image/jpeg",
        0.85
      )
    );
    return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export function NameForm({
  fullName,
  avatarUrl,
  hasUpload,
}: {
  fullName: string;
  avatarUrl: string | null;
  hasUpload: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveName, empty);
  const [nameValue, setNameValue] = useState(fullName);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, startBusy] = useTransition();
  const [avatarError, setAvatarError] = useState<string | null>(null);

  function handleAvatarFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    startBusy(async () => {
      let cropped: File;
      try {
        cropped = await cropToSquare(file);
      } catch {
        setAvatarError("Nie udało się przetworzyć zdjęcia.");
        return;
      }
      const fd = new FormData();
      fd.append("avatar", cropped);
      const res = await uploadAvatar(empty, fd);
      if (!res.ok) setAvatarError(res.error ?? "Nie udało się zapisać zdjęcia.");
    });
  }

  function handleDeleteAvatar() {
    setAvatarError(null);
    startBusy(async () => {
      const res = await deleteAvatar(empty, new FormData());
      if (!res.ok) setAvatarError(res.error ?? "Nie udało się usunąć zdjęcia.");
    });
  }

  return (
    <>
      <p className="text-sm text-muted">Tak zobaczą Cię inni uczestnicy.</p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={fullName} src={avatarUrl} size={48} />
        <div className="flex flex-col items-start gap-0.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy || pending}
            className="text-sm font-medium text-accent-deep hover:underline disabled:opacity-50"
          >
            {busy ? "Zapisywanie…" : "Zmień zdjęcie"}
          </button>
          {hasUpload && (
            <button
              type="button"
              onClick={handleDeleteAvatar}
              disabled={busy || pending}
              className="text-sm text-danger hover:underline disabled:opacity-50"
            >
              Usuń awatar
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAvatarFile}
        />
      </div>
      {avatarError && <p className="mt-2 text-sm text-red-600">{avatarError}</p>}
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <input
          name="full_name"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          required
          maxLength={100}
          className="w-full rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || busy || nameValue.trim() === fullName}
            aria-live="polite"
            className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
          >
            {pending ? (
              <>
                <SpinnerIcon />
                Zapisuję…
              </>
            ) : nameValue.trim() === fullName && fullName.trim() !== "" ? (
              <>
                <CheckIcon />
                Zapisano
              </>
            ) : (
              "Zapisz"
            )}
          </button>
        </div>
        {!state.ok && state.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
      </form>
    </>
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
