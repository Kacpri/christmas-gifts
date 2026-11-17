"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

const FRAME = 240;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function AvatarCropDialog({
  file,
  busy,
  onClose,
  onSave,
}: {
  file: File;
  busy: boolean;
  onClose: () => void;
  onSave: (cropped: File) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(
    null
  );

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    let cancelled = false;
    createImageBitmap(file)
      .then((b) => {
        if (!cancelled) setDims({ w: b.width, h: b.height });
        b.close();
      })
      .catch(() => {
        if (!cancelled) onClose();
      });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(u);
    };
  }, [file, onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  useEffect(() => {
    if (!dims || offset) return;
    const k = FRAME / Math.min(dims.w, dims.h);
    setOffset({
      x: (FRAME - dims.w * k) / 2,
      y: (FRAME - dims.h * k) / 2,
    });
  }, [dims, offset]);

  const k = dims ? FRAME / Math.min(dims.w, dims.h) : 1;
  const W = dims ? dims.w * k : 0;
  const H = dims ? dims.h * k : 0;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!offset) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    setOffset({
      x: clamp(d.ox + e.clientX - d.px, FRAME - W, 0),
      y: clamp(d.oy + e.clientY - d.py, FRAME - H, 0),
    });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  async function handleSave() {
    if (saving || busy || !dims || !offset) return;
    setSaving(true);
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const side = Math.min(dims.w, dims.h);
        const out = Math.min(512, side);
        const canvas = document.createElement("canvas");
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, out, out);
        ctx.drawImage(
          bitmap,
          -offset.x / k,
          -offset.y / k,
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
        onSave(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      } finally {
        bitmap.close();
      }
    } catch {
      // crop nie powiódł się — użytkownik może spróbować ponownie
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={busy ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Wyśrodkowanie zdjęcia"
        className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      >
        <p className="text-sm leading-relaxed text-ink">
          Przesuń zdjęcie, aby wyśrodkować, a następnie zapisz.
        </p>
        <div className="mt-4 flex justify-center">
          <div
            className="relative overflow-hidden rounded-full bg-mist"
            style={{
              width: FRAME,
              height: FRAME,
              touchAction: "none",
              cursor: offset ? "grab" : "default",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {url && offset && (
              <img
                src={url}
                alt=""
                draggable={false}
                className="absolute max-w-none select-none"
                style={{ width: W, height: H, left: offset.x, top: offset.y }}
              />
            )}
            <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-black/10" />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-input-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-mist disabled:opacity-50"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || saving || !offset}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {busy || saving ? (
              <>
                <SpinnerIcon />
                Zapisywanie…
              </>
            ) : (
              "Zapisz"
            )}
          </button>
        </div>
      </div>
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
