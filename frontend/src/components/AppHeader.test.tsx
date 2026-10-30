// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getSession } from "@/lib/session";
import { setSession, stubApi } from "@/test/api";
import { location, route, router } from "@/test/router";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("shows the product name and who is signed in", async () => {
    await setSession("ada@acme.test");
    render(<AppHeader />);
    expect(screen.getByRole("link", { name: "Prelegal" })).toHaveAttribute("href", route("/draft/"));
    expect(screen.getByText("ada@acme.test")).toBeInTheDocument();
  });

  it("links to a new document and to My documents, marking the current page", async () => {
    await setSession("ada@acme.test");
    location.pathname = "/documents/";
    render(<AppHeader />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toContainElement(screen.getByRole("link", { name: "New document" }));
    expect(screen.getByRole("link", { name: "New document" })).toHaveAttribute("href", route("/draft/"));
    expect(screen.getByRole("link", { name: "New document" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "My documents" })).toHaveAttribute("href", route("/documents/"));
    expect(screen.getByRole("link", { name: "My documents" })).toHaveAttribute("aria-current", "page");
  });

  it("signs out and returns to the sign-in page", async () => {
    await setSession("ada@acme.test");
    render(<AppHeader />);
    const fetch = stubApi({ "POST /api/auth/signout": { status: 204 }, "GET /api/auth/me": { body: { user: null } } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(fetch).toHaveBeenCalledWith("/api/auth/signout", { method: "POST" });
    expect(getSession()).toBeNull();
  });
});
