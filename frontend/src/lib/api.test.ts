import { describe, expect, it, vi } from "vitest";
import { stubApi } from "@/test/api";
import { api, ApiError, GENERIC_ERROR, OFFLINE_ERROR, SESSION_EXPIRED, setUnauthorizedHandler } from "./api";

describe("api", () => {
  it("sends JSON and returns the parsed answer", async () => {
    const fetch = stubApi({ "POST /api/things": { status: 201, body: { id: 1 } } });
    await expect(api("/api/things", { method: "POST", body: { name: "x" } })).resolves.toEqual({ id: 1 });
    expect(fetch).toHaveBeenCalledWith("/api/things", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"x"}',
    });
  });

  it("sends no body or content type for a plain GET", async () => {
    const fetch = stubApi({ "GET /api/things": { body: [] } });
    await api("/api/things");
    expect(fetch).toHaveBeenCalledWith("/api/things", { method: "GET" });
  });

  it("returns nothing for 204 No Content", async () => {
    stubApi({ "DELETE /api/things/1": { status: 204 } });
    await expect(api("/api/things/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("shows the backend's message when it wrote one", async () => {
    stubApi({ "POST /api/things": { status: 409, body: { detail: "Already exists." } } });
    const error = await api("/api/things", { method: "POST" }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: "Already exists." });
  });

  it("shows a generic message otherwise", async () => {
    stubApi({ "GET /api/a": { status: 422, body: { detail: [{ msg: "field required" }] } }, "GET /api/b": { status: 500 } });
    await expect(api("/api/a")).rejects.toThrow(GENERIC_ERROR);
    await expect(api("/api/b")).rejects.toThrow(GENERIC_ERROR);
  });

  it("says when the backend can't be reached", async () => {
    stubApi({ "GET /api/things": new TypeError("Failed to fetch") });
    await expect(api("/api/things")).rejects.toMatchObject({ status: 0, message: OFFLINE_ERROR });
  });

  it("reports an ended session, except from the sign-in endpoints themselves", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    stubApi({
      "GET /api/documents": { status: 401, body: { detail: "Please sign in." } },
      "POST /api/auth/signin": { status: 401, body: { detail: "Incorrect email or password." } },
    });

    await expect(api("/api/documents")).rejects.toThrow(SESSION_EXPIRED);
    expect(handler).toHaveBeenCalledTimes(1);
    await expect(api("/api/auth/signin", { method: "POST" })).rejects.toThrow("Incorrect email or password.");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
