import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// ブログ以外の公開ページをブロック（サービス未公開期間）
const PUBLIC_PATHS = ["/blog", "/api/og"];
const BLOCKED_PATHS = ["/", "/login", "/dashboard", "/review", "/study", "/settings", "/onboarding", "/terms", "/privacy", "/legal"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ブログとOG画像APIは通す
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ブロック対象のパスはブログにリダイレクト
  if (BLOCKED_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.redirect(new URL("/blog", request.url));
  }

  // Supabaseからのauth codeをcallbackルートに転送
  const code = request.nextUrl.searchParams.get("code");
  if (code && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon-|manifest).*)"],
};
