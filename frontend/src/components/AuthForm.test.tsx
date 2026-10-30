// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getSession, signIn } from "@/lib/session";
import { router } from "@/test/router";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("signs in with any email and password and goes to the drafting page", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "ada@acme.test");
    await user.type(screen.getByLabelText("Password"), "whatever");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(getSession()).toEqual({ email: "ada@acme.test" });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/draft/"));
  });

  it("does not sign in until both fields are filled", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.type(screen.getByLabelText("Email"), "ada@acme.test");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(getSession()).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("marks both fields as required and the email as an email address", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toBeRequired();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("skips the form when already signed in", async () => {
    signIn("ada@acme.test");
    render(<LoginForm />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/draft/"));
  });
});
