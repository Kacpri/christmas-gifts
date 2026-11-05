"use client";

import { signOut } from "@/app/actions";

export function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-lg border border-amber-200/40 px-3 py-1.5 text-sm text-amber-100 hover:bg-white/10"
      >
        Wyloguj
      </button>
    </form>
  );
}
