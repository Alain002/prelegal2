import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Components that navigate get the stand-in router; tests assert on it via `@/test/router`.
vi.mock("next/navigation", async () => {
  const { router } = await import("./router");
  return { useRouter: () => router };
});

afterEach(() => {
  // Only component tests render into a DOM.
  if (typeof document !== "undefined") cleanup();
  if (typeof localStorage !== "undefined") localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
