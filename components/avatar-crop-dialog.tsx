"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";

const FRAME = 240;
const MAX_ZOOM = 4;

type View = { x: number; y: number; zoom: number };

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
  const [view, setView] = useState<View | null>(null);
  const [saving, setSaving] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; mx: number; my: number } | null>(null);

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

  const baseK = dims ? FRAME / Math.min(dims.w, dims.h) : 1;

  useEffect(() => {
    if (!dims || view) return;
    setView({
      x: (FRAME - dims.w * baseK) / 2,
      y: (FRAME - dims.h * baseK) / 2,
      zoom: 1,
    });
  }, [dims, view, baseK]);

  function clampView(v: View): View {
    if (!dims) return v;
    const k = baseK * v.zoom;
    return {
      ...v,
      x: clamp(v.x, FRAME - dims.w * k, 0),
      y: clamp(v.y, FRAME - dims.h * k, 0),
    };
  }

  const zoomAt = useCallback(
    (v: View, factor: number, ax: number, ay: number): View => {
      if (!dims) return v;
      const zoom = clamp(v.zoom * factor, 1, MAX_ZOOM);
      const k = baseK * v.zoom;
      const ix = (ax - v.x) / k;
      const iy = (ay - v.y) / k;
      const k2 = baseK * zoom;
      return {
        x: clamp(ax - ix * k2, FRAME - dims.w * k2, 0),
        y: clamp(ay - iy * k2, FRAME - dims.h * k2, 0),
        zoom,
      };
    },
    [dims, baseK]
  );

  useEffect(() => {
    const el = frameRef.current;
    if (!el || !dims) return;
    const frame = el;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = frame.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) =>
        v ? zoomAt(v, factor, e.clientX - rect.left, e.clientY - rect.top) : v
      );
    }
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, [dims, zoomAt]);

  function framePoint(clientX: number, clientY: number) {
    const rect = frameRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!view) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const pts = pointersRef.current;
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pts.set(e.pointerId, cur);
    if (pts.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      setView((v) => (v ? clampView({ ...v, x: v.x + dx, y: v.y + dy }) : v));
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = framePoint((a.x + b.x) / 2, (a.y + b.y) / 2);
      const last = pinchRef.current;
      pinchRef.current = { dist, mx: mid.x, my: mid.y };
      if (!last) return;
      const dx = mid.x - last.mx;
      const dy = mid.y - last.my;
      setView((v) => {
        if (!v) return v;
        return zoomAt(
          clampView({ ...v, x: v.x + dx, y: v.y + dy }),
          dist / last.dist,
          mid.x,
          mid.y
        );
      });
    }
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
  }

  async function handleSave() {
    if (saving || busy || !dims || !view) return;
    setSaving(true);
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const k = baseK * view.zoom;
        const side = FRAME / k;
        const out = Math.min(512, Math.round(side));
        const canvas = document.createElement("canvas");
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, out, out);
        ctx.drawImage(
          bitmap,
          -view.x / k,
          -view.y / k,
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

  const k = view ? baseK * view.zoom : 1;
  const W = dims && view ? dims.w * k : 0;
  const H = dims && view ? dims.h * k : 0;

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
          Przesuń zdjęcie, aby wyśrodkować. Przybliżaj kołem myszy lub
          szczypnięciem.
        </p>
        <div className="mt-4 flex justify-center">
          <div
            ref={frameRef}
            className="relative overflow-hidden rounded-full bg-mist"
            style={{
              width: FRAME,
              height: FRAME,
              touchAction: "none",
              cursor: view ? "grab" : "default",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            {url && view && (
              <img
                src={url}
                alt=""
                draggable={false}
                className="absolute max-w-none select-none"
                style={{ width: W, height: H, left: view.x, top: view.y }}
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
            disabled={busy || saving || !view}
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
