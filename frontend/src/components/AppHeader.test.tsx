// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getSession, signIn } from "@/lib/session";
import { router } from "@/test/router";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("shows the product name and who is signed in", () => {
    signIn("ada@acme.test");
    render(<AppHeader />);
    expect(screen.getByText("Prelegal")).toBeInTheDocument();
    expect(screen.getByText("ada@acme.test")).toBeInTheDocument();
  });

  it("signs out and returns to the sign-in page", async () => {
    signIn("ada@acme.test");
    render(<AppHeader />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    expect(getSession()).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
