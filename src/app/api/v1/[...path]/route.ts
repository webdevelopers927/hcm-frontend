import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { PASS_THROUGH_HEADERS, TOKEN_COOKIE, apiUrl } from "@/lib/api/server";

/*
 * Thin authenticated proxy: /api/v1/<path> on this app → API_URL/<path>,
 * with the Bearer token read from the httpOnly cookie. Bodies (JSON or file
 * streams such as exports) are passed through untouched.
 */
async function forward(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = path.join("/");

  // Login must go through /api/auth/login so the token never reaches the browser.
  if (target === "auth/login") {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });

  const headers: Record<string, string> = { Accept: "application/json", Authorization: `Bearer ${token}` };
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const hasBody = !["GET", "HEAD"].includes(request.method);
  let upstream: Response;
  try {
    upstream = await fetch(`${apiUrl(target)}${request.nextUrl.search}`, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ message: "Can't reach the server. Please try again in a moment." }, { status: 502 });
  }

  const out = new Headers({ "Cache-Control": "no-store" });
  for (const h of PASS_THROUGH_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  const res = new NextResponse(upstream.body, { status: upstream.status, headers: out });
  // Expired or revoked token: drop the cookie so the next page load goes to login.
  if (upstream.status === 401) res.cookies.delete(TOKEN_COOKIE);
  return res;
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
