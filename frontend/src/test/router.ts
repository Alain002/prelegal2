import { vi } from "vitest";

/** A stand-in for Next's app router. `setup.ts` makes `useRouter()` return it in every test. */
export const router = { replace: vi.fn() };
