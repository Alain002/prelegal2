// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { sentBody, setSession, stubApi } from "@/test/api";
import { route, router } from "@/test/router";
import { AuthForm } from "./AuthForm";

const signedIn = (email: string) => ({ body: { user: { email } } });

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  return user;
}

describe("AuthForm", () => {
  it("signs in and goes to the drafting page", async () => {
    await setSession(null);
    render(<AuthForm mode="signIn" />);
    const fetch = stubApi({ "POST /api/auth/signin": signedIn("ada@acme.test"), "GET /api/auth/me": signedIn("ada@acme.test") });

    const user = await fill("ada@acme.test", "secret pass");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/draft/"));
    expect(sentBody(fetch, fetch.mock.calls.findIndex(([path]) => path === "/api/auth/signin"))).toEqual({
      email: "ada@acme.test",
      password: "secret pass",
    });
  });

  it("shows why signing in failed, and lets the user try again", async () => {
    await setSession(null);
    render(<AuthForm mode="signIn" />);
    stubApi({ "POST /api/auth/signin": { status: 401, body: { detail: "Incorrect email or password." } } });

    const user = await fill("ada@acme.test", "wrong pass");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("creates an account and goes to the drafting page", async () => {
    await setSession(null);
    render(<AuthForm mode="signUp" />);
    const fetch = stubApi({ "POST /api/auth/signup": { status: 201, ...signedIn("ada@acme.test") } });

    const user = await fill("ada@acme.test", "secret pass");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/draft/"));
    expect(sentBody(fetch)).toEqual({ email: "ada@acme.test", password: "secret pass" });
  });

  it("shows when the email already has an account", async () => {
    await setSession(null);
    render(<AuthForm mode="signUp" />);
    stubApi({ "POST /api/auth/signup": { status: 409, body: { detail: "An account with this email already exists. Sign in instead." } } });

    const user = await fill("ada@acme.test", "secret pass");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists.");
  });

  it("disables the button while waiting for the backend", async () => {
    await setSession(null);
    render(<AuthForm mode="signIn" />);
    stubApi({ "POST /api/auth/signin": () => new Promise<never>(() => {}) });
    const user = await fill("ada@acme.test", "secret pass");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  });

  it("asks the browser to check the fields first", () => {
    render(<AuthForm mode="signUp" />);
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    const password = screen.getByLabelText("Password");
    expect(password).toBeRequired();
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("minLength", "8");
    expect(password).toHaveAttribute("autoComplete", "new-password");
    expect(password).toHaveAccessibleDescription("At least 8 characters.");
  });

  it("links between signing in and creating an account", () => {
    const { unmount } = render(<AuthForm mode="signIn" />);
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", route("/signup/"));
    expect(screen.getByLabelText("Password")).toHaveAttribute("autoComplete", "current-password");
    unmount();
    render(<AuthForm mode="signUp" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/");
  });

  it("skips the form when already signed in", async () => {
    await setSession("ada@acme.test");
    render(<AuthForm mode="signIn" />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/draft/"));
  });
});
