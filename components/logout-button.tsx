"use client";

import { signOut } from "@/app/actions";

export function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-lg px-3 py-1.5 text-sm text-amber-100/70 transition-colors hover:bg-white/10 hover:text-amber-50"
      >
        Wyloguj
      </button>
    </form>
  );
}
