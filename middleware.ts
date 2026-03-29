import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Supabaseからのauth codeをcallbackルートに転送
  const code = request.nextUrl.searchParams.get("code");
  if (code && request.nextUrl.pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/review/:path*", "/study/:path*", "/settings", "/onboarding", "/login", "/auth/:path*"],
};
