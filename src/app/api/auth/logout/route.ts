import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TOKEN_COOKIE, apiUrl } from "@/lib/api/server";

/** Revokes the current token on the API (best effort) and clears the cookie. */
export async function POST() {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  if (token) {
    await fetch(apiUrl("auth/logout"), {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }
  const res = NextResponse.json({ message: "Logged out." });
  res.cookies.delete(TOKEN_COOKIE);
  return res;
}
