// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { getSession, SESSION_KEY, signIn, signOut, subscribe } from "./session";

describe("fake session", () => {
  it("is signed out by default", () => {
    expect(getSession()).toBeNull();
  });

  it("signs in with the trimmed email and remembers it", () => {
    expect(signIn("  ada@acme.test ")).toEqual({ email: "ada@acme.test" });
    expect(getSession()).toEqual({ email: "ada@acme.test" });
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!)).toEqual({ email: "ada@acme.test" });
  });

  it("signs out", () => {
    signIn("ada@acme.test");
    signOut();
    expect(getSession()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("returns the same object until the session changes", () => {
    signIn("ada@acme.test");
    const first = getSession();
    expect(getSession()).toBe(first);
    signIn("alan@globex.test");
    expect(getSession()).not.toBe(first);
  });

  it.each(["not json", "{}", '{"email":""}', '{"email":42}', "null"])("treats a corrupt value %s as signed out", (raw) => {
    localStorage.setItem(SESSION_KEY, raw);
    expect(getSession()).toBeNull();
  });

  it("treats blocked storage as signed out", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => signIn("ada@acme.test")).not.toThrow();
    expect(getSession()).toBeNull();
  });

  it("notifies subscribers on sign in, sign out and changes from other tabs", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    signIn("ada@acme.test");
    signOut();
    window.dispatchEvent(new StorageEvent("storage", { key: SESSION_KEY }));
    window.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    signIn("ada@acme.test");
    window.dispatchEvent(new StorageEvent("storage", { key: SESSION_KEY }));
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
