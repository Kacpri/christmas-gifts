"use client";

import { signOut } from "@/app/actions";

export function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100"
      >
        Wyloguj
      </button>
    </form>
  );
}
