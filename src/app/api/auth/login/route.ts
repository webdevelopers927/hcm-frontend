import { NextResponse } from "next/server";
import { TOKEN_COOKIE, apiUrl, tokenCookieOptions } from "@/lib/api/server";

/**
 * Proxies login to the API, stores the token in an httpOnly cookie and
 * returns only the user to the browser.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };

  let upstream: Response;
  try {
    upstream = await fetch(apiUrl("auth/login"), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password, device_name: "web" }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ message: "Can't reach the server. Please try again in a moment." }, { status: 502 });
  }

  const data = (await upstream.json().catch(() => ({ message: "Unexpected response from the server." }))) as {
    token?: string;
    user?: unknown;
    message?: string;
  };

  if (!upstream.ok || !data.token) {
    const res = NextResponse.json(data, { status: upstream.ok ? 502 : upstream.status });
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) res.headers.set("retry-after", retryAfter);
    return res;
  }

  const res = NextResponse.json({ user: data.user });
  res.cookies.set(TOKEN_COOKIE, data.token, tokenCookieOptions);
  return res;
}
