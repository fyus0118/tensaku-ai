"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthListener() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.push("/auth/reset-password");
      }
    });

    // URLハッシュに type=recovery が含まれていたら即リダイレクト
    // ただし既にreset-passwordページにいる場合はページ側に任せる（ハッシュを消さないため）
    if (window.location.hash.includes("type=recovery") && pathname !== "/auth/reset-password") {
      router.push("/auth/reset-password" + window.location.hash);
    }

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  return null;
}
