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
        <h1 className="text-[38px] text-cream">Świąteczne Losowanie</h1>
        <p className="mt-2 text-cream/80">
          Zaloguj się, aby wpisać życzenia i wziąć udział w losowaniu.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-mist disabled:opacity-50"
        >
          <Image src="/g-logo.png" alt="Google" width={20} height={20} />
          Zaloguj się przez Google
        </button>

        <div className="flex items-center gap-3 text-xs text-faint">
          <hr className="flex-1 border-line" />
          lub
          <hr className="flex-1 border-line" />
        </div>

        <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Imię i nazwisko"
            required
            className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Adres e-mail"
            required
            className="rounded-xl border border-input-line bg-input-bg px-3.5 py-2.5 text-sm text-ink"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-sage-150 disabled:text-accent-deep disabled:hover:bg-sage-150"
          >
            {pending ? "Wysyłanie…" : "Wyślij link logujący"}
          </button>
        </form>

        {info && <p className="text-sm text-accent">{info}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
