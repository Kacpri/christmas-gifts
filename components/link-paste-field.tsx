"use client";

import { useState } from "react";

export function LinkPasteField({
  id,
  name,
  value,
  onChange,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [pasteError, setPasteError] = useState(false);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onChange(text);
        setPasteError(false);
      } else {
        setPasteError(true);
      }
    } catch {
      setPasteError(true);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          id={id}
          name={name}
          type="url"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setPasteError(false);
          }}
          autoComplete="off"
          className="w-full min-w-0 flex-1 rounded-xl border border-input-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-placeholder"
        />
        <button
          type="button"
          onClick={handlePaste}
          className="shrink-0 rounded-xl border border-input-line bg-surface px-3 py-2.5 text-sm font-medium text-ink hover:bg-mist"
        >
          Wklej
        </button>
      </div>
      {pasteError && (
        <p role="alert" className="text-xs font-medium text-danger">
          Nie udało się odczytać schowka
        </p>
      )}
    </div>
  );
}
