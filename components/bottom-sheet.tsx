"use client";

import type { ReactNode } from "react";

import { Presence } from "./presence";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Presence
      open={open}
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
      backdrop
      sheetClassName="relative w-full"
      sheetOnClick={(e) => e.stopPropagation()}
    >
      <div className="flex max-h-[60vh] flex-col rounded-t-2xl bg-surface shadow-lg">
        <div className="flex shrink-0 justify-center pb-2 pt-3" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>
        {title && (
          <div className="shrink-0 px-4 pb-2 text-sm font-semibold text-ink">
            {title}
          </div>
        )}
        <div className="min-h-0 overflow-y-auto px-4 pb-4 pt-1">
          {children}
        </div>
      </div>
    </Presence>
  );
}
