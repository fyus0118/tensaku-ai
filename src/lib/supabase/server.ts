import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { createClient as createRawClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

/**
 * Supabase サーバークライアント
 * Cookie認証(Web) と Bearer認証(モバイル) の両方に対応
 */
export async function createClient(): Promise<SupabaseClient> {
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");

  // モバイル: Bearer token → auth.getUser(token) をラップ
  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7);
    const client = createRawClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    // auth.getUser() が引数なしで呼ばれてもトークンを使うようにラップ
    const originalGetUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = async (token?: string) => originalGetUser(token || jwt);

    return client;
  }

  // Web: Cookie認証
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptionsWithName }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  );
}
