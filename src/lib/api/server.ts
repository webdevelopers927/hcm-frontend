import "server-only";

/*
 * Server-side bits of the API bridge. The Bearer token lives only in an
 * httpOnly cookie; browser code never sees it.
 */

export const TOKEN_COOKIE = "hcm_token";
/** Matches the API's token lifetime (7 days). */
export const TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

export function apiUrl(path: string) {
  const base = process.env.API_URL;
  if (!base) throw new Error("API_URL is not set. Add it to .env.local (see .env.example).");
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export const tokenCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: TOKEN_MAX_AGE,
};

/** Headers worth passing back to the browser from the API. */
export const PASS_THROUGH_HEADERS = ["content-type", "content-disposition", "retry-after", "content-length"];
