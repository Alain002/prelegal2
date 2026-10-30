import { describe, expect, it, vi } from "vitest";
import { sentBody, stubApi, type Reply } from "@/test/api";
import { api, SESSION_EXPIRED } from "./api";
import { getSession, refreshSession, signIn, signOut, signUp, subscribe } from "./session";

const me = (email: string | null) => ({ body: { user: email && { email } } });

describe("session", () => {
  // Must run first: the store lives for the whole file.
  it("is unknown until the backend has answered", async () => {
    expect(getSession()).toBeUndefined();
    stubApi({ "GET /api/auth/me": me(null) });
    await refreshSession();
    expect(getSession()).toBeNull();
  });

  it("asks the backend who is signed in, sharing a request already in flight", async () => {
    const fetch = stubApi({ "GET /api/auth/me": me("ada@acme.test") });
    await Promise.all([refreshSession(), refreshSession()]);
    expect(getSession()).toEqual({ email: "ada@acme.test" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps what it knew when the backend can't be reached", async () => {
    stubApi({ "GET /api/auth/me": me("ada@acme.test") });
    await refreshSession();
    stubApi({ "GET /api/auth/me": new TypeError("offline") });
    await refreshSession();
    expect(getSession()).toEqual({ email: "ada@acme.test" });
  });

  it("signs in with the email and password", async () => {
    await signOutQuietly();
    const fetch = stubApi({ "POST /api/auth/signin": me("ada@acme.test") });
    await expect(signIn("ada@acme.test", "secret pass")).resolves.toEqual({ email: "ada@acme.test" });
    expect(sentBody(fetch)).toEqual({ email: "ada@acme.test", password: "secret pass" });
    expect(getSession()).toEqual({ email: "ada@acme.test" });
  });

  it("reports why signing in failed and stays signed out", async () => {
    await signOutQuietly();
    stubApi({ "POST /api/auth/signin": { status: 401, body: { detail: "Incorrect email or password." } } });
    await expect(signIn("ada@acme.test", "wrong")).rejects.toThrow("Incorrect email or password.");
    expect(getSession()).toBeNull();
  });

  it("signs up, which signs in", async () => {
    await signOutQuietly();
    const fetch = stubApi({ "POST /api/auth/signup": { status: 201, body: { user: { email: "ada@acme.test" } } } });
    await signUp("ada@acme.test", "secret pass");
    expect(sentBody(fetch)).toEqual({ email: "ada@acme.test", password: "secret pass" });
    expect(getSession()).toEqual({ email: "ada@acme.test" });
  });

  it("signs out, even when the backend can't be reached", async () => {
    stubApi({ "GET /api/auth/me": me("ada@acme.test") });
    await refreshSession();
    stubApi({ "POST /api/auth/signout": new TypeError("offline") });
    await signOut();
    expect(getSession()).toBeNull();
  });

  it("signs out when another API call says the session has ended", async () => {
    stubApi({ "GET /api/auth/me": me("ada@acme.test") });
    await refreshSession();
    stubApi({ "GET /api/documents": { status: 401, body: { detail: "Please sign in." } } });
    await expect(api("/api/documents")).rejects.toThrow(SESSION_EXPIRED);
    expect(getSession()).toBeNull();
  });

  it("notifies subscribers of every change", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    stubApi({ "GET /api/auth/me": me("ada@acme.test"), "POST /api/auth/signout": { status: 204 } });
    await refreshSession();
    await signOut();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    await refreshSession();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

async function signOutQuietly() {
  stubApi({ "POST /api/auth/signout": { status: 204 } });
  await signOut();
}

describe("session races", () => {
  it("ignores a check that was asked before signing out", async () => {
    let answer!: (reply: Reply) => void;
    stubApi({
      "GET /api/auth/me": () => new Promise<Reply>((resolve) => (answer = resolve)),
      "POST /api/auth/signout": { status: 204 },
    });
    const refreshed = refreshSession();
    await signOut();
    answer(me("ada@acme.test"));
    await refreshed;
    expect(getSession()).toBeNull();
  });
});
