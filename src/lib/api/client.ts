/*
 * Browser-side API client. All calls go to this app's /api/v1 proxy, which
 * attaches the Bearer token from the httpOnly cookie.
 */

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly errors: FieldErrors = {},
    /** Seconds until a 429 can be retried. */
    readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** First message for a field, also matching nested keys like `status.0`. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0] ?? Object.entries(this.errors).find(([k]) => k.startsWith(`${name}.`))?.[1][0];
  }
}

type Query = Record<string, string | number | boolean | (string | number)[] | null | undefined>;

export function toSearchParams(query: Query = {}) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => sp.append(`${key}[]`, String(v)));
    else sp.set(key, String(value));
  }
  return sp;
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
};

function redirectToLogin() {
  if (typeof window === "undefined" || window.location.pathname === "/login") return;
  const next = window.location.pathname + window.location.search;
  // Full reload on purpose: the session is gone, so no cached data should survive.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

async function request(path: string, { method = "GET", query, body, signal }: Options) {
  const qs = toSearchParams(query).toString();
  const isForm = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`/api/v1/${path.replace(/^\//, "")}${qs ? `?${qs}` : ""}`, {
      method,
      signal,
      cache: "no-store",
      // FormData: let the browser set the multipart boundary itself.
      headers: { Accept: "application/json", ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}) },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "You appear to be offline. Check your connection and try again.");
  }

  if (res.ok) return res;

  const data = (await res.json().catch(() => ({}))) as { message?: string; errors?: FieldErrors };
  if (res.status === 401) redirectToLogin();
  const retry = res.headers.get("retry-after");
  throw new ApiError(
    res.status,
    data.message ?? (res.status >= 500 ? "Something went wrong on our side. Please try again." : "Request failed."),
    data.errors ?? {},
    retry ? Number(retry) : null,
  );
}

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const res = await request(path, options);
  return (await res.json()) as T;
}

/** Fetches a file response and saves it using the server's filename. */
export async function apiDownload(path: string, options: Options = {}, fallbackName = "download") {
  const res = await request(path, options);
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]!) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}

/** Human message for any thrown value. */
export function errorMessage(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 429) return e.retryAfter ? `Too many attempts. Try again in ${e.retryAfter} seconds.` : e.message;
    return e.message;
  }
  return "Something went wrong. Please try again.";
}
