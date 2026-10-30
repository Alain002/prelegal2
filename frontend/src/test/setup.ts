import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Components that navigate get the stand-in router and address; tests use them via `@/test/router`.
vi.mock("next/navigation", async () => {
  const { router, location } = await import("./router");
  return {
    useRouter: () => router,
    usePathname: () => location.pathname,
    useSearchParams: () => new URLSearchParams(location.search),
  };
});

afterEach(async () => {
  // Only component tests render into a DOM.
  if (typeof document !== "undefined") cleanup();
  const { location } = await import("./router");
  Object.assign(location, { pathname: "/", search: "" });
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
