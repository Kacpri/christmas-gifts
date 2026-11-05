"use client";

import Image from "next/image";
import { useTransition, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function signInWithGoogle() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) setError(authError.message);
    });
  }

  function sendMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !fullName.trim()) {
      setError("Podaj adres e-mail i imię z nazwiskiem.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) setError(authError.message);
      else
        setInfo(
          "Wysłaliśmy link logujący na Twój adres e-mail. Kliknij go, aby wejść."
        );
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl text-red-800">Świąteczne Losowanie</h1>
        <p className="mt-2 text-stone-600">
          Zaloguj się, aby wpisać życzenia i wziąć udział w losowaniu.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-6">
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
        >
          <Image src="/g-logo.png" alt="Google" width={20} height={20} />
          Zaloguj się przez Google
        </button>

        <div className="flex items-center gap-3 text-xs text-stone-400">
          <hr className="flex-1 border-amber-200" />
          lub
          <hr className="flex-1 border-amber-200" />
        </div>

        <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Imię i nazwisko"
            required
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Adres e-mail"
            required
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            {pending ? "Wysyłanie…" : "Wyślij link logujący"}
          </button>
        </form>

        {info && <p className="text-sm text-green-700">{info}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
