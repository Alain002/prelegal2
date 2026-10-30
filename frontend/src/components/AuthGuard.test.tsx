// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { signOut } from "@/lib/session";
import { setSession, stubApi, type Reply } from "@/test/api";
import { router } from "@/test/router";
import { AuthGuard } from "./AuthGuard";

const renderGuarded = () => render(<AuthGuard>secret page</AuthGuard>);

describe("AuthGuard", () => {
  // Must run first: the session store lives for the whole file.
  it("shows a loading state while it checks who is signed in", async () => {
    let answer!: (reply: Reply) => void;
    stubApi({ "GET /api/auth/me": () => new Promise<Reply>((resolve) => (answer = resolve)) });
    renderGuarded();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();

    await act(async () => answer({ body: { user: { email: "ada@acme.test" } } }));
    expect(await screen.findByText("secret page")).toBeInTheDocument();
  });

  it("shows the page to signed-in users", async () => {
    await setSession("ada@acme.test");
    renderGuarded();
    expect(screen.getByText("secret page")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends signed-out visitors to the sign-in page without showing the page", async () => {
    await setSession(null);
    renderGuarded();
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("hides the page and redirects as soon as the user signs out", async () => {
    await setSession("ada@acme.test");
    renderGuarded();
    stubApi({ "POST /api/auth/signout": { status: 204 } });
    await act(() => signOut());
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });
});
