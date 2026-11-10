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

  function signInWithFacebook() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
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

      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-input-line bg-surface px-4 py-2.5 text-sm font-medium hover:bg-mist disabled:opacity-50"
        >
          <Image src="/g-logo.png" alt="Google" width={20} height={20} />
          Zaloguj się przez Google
        </button>

        <button
          type="button"
          onClick={signInWithFacebook}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-input-line bg-surface px-4 py-2.5 text-sm font-medium hover:bg-mist disabled:opacity-50"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#1877F2"
            aria-hidden
          >
            <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.627 3.874 10.35 9.101 11.647Z" />
          </svg>
          Zaloguj się przez Facebooka
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
