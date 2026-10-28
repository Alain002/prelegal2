import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  // Only component tests render into a DOM.
  if (typeof document !== "undefined") cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
