"use client";

import { signOut } from "@/app/actions";

export function LogoutButton({
  variant = "icon",
}: {
  variant?: "icon" | "row";
}) {
  if (variant === "row") {
    return (
      <form action={signOut} className="w-full">
        <button
          type="submit"
          aria-label="Wyloguj się"
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#e0685c] hover:bg-[#e0685c]/15"
        >
          <LogoutIcon />
          Wyloguj
        </button>
      </form>
    );
  }

  return (
    <form action={signOut}>
      <button
        type="submit"
        aria-label="Wyloguj się"
        className="flex h-11 min-w-11 items-center gap-1.5 rounded-[10px] px-2.5 text-sm font-medium text-cream hover:underline"
      >
        <LogoutIcon />
        Wyloguj
      </button>
    </form>
  );
}

function LogoutIcon() {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
