// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { signIn, signOut } from "@/lib/session";
import { router } from "@/test/router";
import { AuthGuard } from "./AuthGuard";

const renderGuarded = () => render(<AuthGuard>secret page</AuthGuard>);

describe("AuthGuard", () => {
  it("shows the page to signed-in users", () => {
    signIn("ada@acme.test");
    renderGuarded();
    expect(screen.getByText("secret page")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends signed-out visitors to the sign-in page without showing the page", async () => {
    renderGuarded();
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("hides the page and redirects as soon as the user signs out", async () => {
    signIn("ada@acme.test");
    renderGuarded();
    act(() => signOut());
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });
});
