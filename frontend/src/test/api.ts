import { act } from "@testing-library/react";
import { vi } from "vitest";
import { refreshSession } from "@/lib/session";

/** What a faked endpoint answers: a status and JSON body, or a network failure. */
export type Reply = { status?: number; body?: unknown } | Error;

type Route = Reply | ((body: unknown) => Reply | Promise<Reply>);

/**
 * Replaces `fetch` with a fake backend. Routes are keyed "METHOD /path"; a route can be a function
 * of the JSON request body, and may return a promise (one that never settles fakes a slow backend).
 * Any other request fails the call loudly. Returns the fetch mock.
 */
export function stubApi(routes: Record<string, Route>) {
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${path}`;
    const route = routes[key];
    if (!route) throw new Error(`Unexpected request: ${key}`);
    const reply = typeof route === "function" ? await route(init?.body ? JSON.parse(String(init.body)) : undefined) : route;
    if (reply instanceof Error) throw reply;
    const status = reply.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(reply.body ?? null), { status });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

/** The JSON body `fetch` was called with on its `n`th call. */
export const sentBody = (fetch: ReturnType<typeof stubApi>, n = 0) => JSON.parse(String(fetch.mock.calls[n][1]?.body));

/** Puts the session store in a known state: signed in as `email`, or signed out (null). */
export async function setSession(email: string | null) {
  stubApi({ "GET /api/auth/me": { body: { user: email && { email } } } });
  await act(() => refreshSession());
}
