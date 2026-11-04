"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function AuthCodeExchanger() {
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!cancelled) {
        router.replace(error ? "/login" : "/");
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
