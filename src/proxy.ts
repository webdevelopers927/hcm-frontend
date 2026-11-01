import { NextResponse, type NextRequest } from "next/server";

const TOKEN_COOKIE = "hcm_token";

/**
 * Sends signed-out visitors to /login, keeping where they were headed.
 * This only checks that a token cookie exists; the API still validates it
 * and a 401 clears the cookie (see app/api/v1/[...path]/route.ts).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(TOKEN_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/employees/:path*"],
};
