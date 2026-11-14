import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route protection. The demo auth adapter mirrors its session into
 * the `dn_session` cookie; a real provider would verify a signed session here.
 * The full check still happens client-side in <RequireAuth>.
 */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("dn_session")?.value);
  if (!hasSession) {
    const url = request.nextUrl.clone();
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/workspace/:path*", "/dashboards/:path*"],
};
