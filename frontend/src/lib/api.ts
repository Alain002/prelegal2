/** Calls to the Prelegal backend's JSON API, which shares the page's origin (and its session cookie). */

export const GENERIC_ERROR = "Something went wrong. Please try again.";
export const OFFLINE_ERROR = "Could not reach Prelegal. Check your connection and try again.";
export const SESSION_EXPIRED = "Your session has ended. Please sign in again.";

/** A failed call. `message` is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** What to tell the user about a caught error. */
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : GENERIC_ERROR);

// Set by the session store, which then signs the user out (lib/session.ts). Kept as a hook so this
// module doesn't depend on the session, which itself calls the API.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

/**
 * Sends a request and returns the parsed JSON (undefined for 204 No Content). Errors carry the
 * backend's message when it wrote one for users (a string `detail`), otherwise a generic one.
 */
export async function api<T>(path: string, { method = "GET", body }: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, OFFLINE_ERROR);
  }
  if (response.status === 204) return undefined as T;

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // Outside sign-in itself, a 401 means the session ended (e.g. the server restarted).
    if (response.status === 401 && !path.startsWith("/api/auth/")) {
      onUnauthorized();
      throw new ApiError(401, SESSION_EXPIRED);
    }
    const detail = json && typeof json === "object" && "detail" in json ? json.detail : null;
    throw new ApiError(response.status, typeof detail === "string" ? detail : GENERIC_ERROR);
  }
  return json as T;
}
