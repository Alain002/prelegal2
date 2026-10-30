import { expect, vi } from "vitest";

/** A stand-in for Next's app router. `setup.ts` makes `useRouter()` return it in every test. */
export const router = { replace: vi.fn() };

/** The current address as `usePathname()` and `useSearchParams()` report it. Tests may change it. */
export const location = { pathname: "/", search: "" };

/**
 * Matches a link's href to `path` (e.g. "/draft/" or "/draft/?id=2"). Vitest doesn't load
 * next.config, so links may lose the trailing slash the built site gives them; the end-to-end tests
 * check the real links.
 */
export function route(path: string) {
  const [pathname, query] = path.split("?");
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = `^${escape(pathname.replace(/\/$/, ""))}/?${query === undefined ? "" : `\\?${escape(query)}`}$`;
  return expect.stringMatching(new RegExp(pattern));
}
