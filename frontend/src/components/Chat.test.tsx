// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, ChatTurn } from "@/lib/chat/api";
import { GREETING, MAX_HISTORY } from "@/lib/chat/useChat";
import { defaultNdaValues } from "@/lib/nda/defaults";
import type { NdaValues } from "@/lib/nda/types";
import { filledValues } from "@/test/fixtures";
import { Chat } from "./Chat";

const sendChat = vi.hoisted(() => vi.fn<(messages: ChatMessage[], values: NdaValues) => Promise<ChatTurn>>());
vi.mock("@/lib/chat/api", () => ({ sendChat }));

beforeEach(() => sendChat.mockReset());

function setup(values: NdaValues = defaultNdaValues) {
  const onValues = vi.fn();
  render(
    <StrictMode>
      <Chat values={values} onValues={onValues} />
    </StrictMode>,
  );
  return { user: userEvent.setup(), onValues, input: screen.getByLabelText("Your message") };
}

const log = () => within(screen.getByRole("log", { name: "Conversation" }));

/** A reply that arrives only when the test says so. */
function deferredTurn() {
  let resolve!: (turn: ChatTurn) => void;
  let reject!: (error: Error) => void;
  sendChat.mockReturnValueOnce(new Promise((res, rej) => ((resolve = res), (reject = rej))));
  return { resolve, reject };
}

describe("Chat", () => {
  it("opens with the assistant's greeting", () => {
    setup();
    expect(log().getByText(GREETING)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends the message with the conversation so far and shows the reply", async () => {
    sendChat.mockResolvedValueOnce({ reply: "Who signs for Acme?", values: filledValues });
    const { user, input, onValues } = setup();

    await user.type(input, "Acme and Globex.");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await log().findByText("Who signs for Acme?")).toBeInTheDocument();
    expect(log().getByText("Acme and Globex.")).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(sendChat).toHaveBeenCalledOnce();
    expect(sendChat).toHaveBeenCalledWith(
      [
        { role: "assistant", content: GREETING },
        { role: "user", content: "Acme and Globex." },
      ],
      defaultNdaValues,
    );
    expect(onValues).toHaveBeenCalledWith(filledValues);
  });

  it("labels who said what for screen readers", async () => {
    sendChat.mockResolvedValueOnce({ reply: "Thanks!", values: filledValues });
    const { user, input } = setup();
    await user.type(input, "Hello{Enter}");
    await log().findByText("Thanks!");

    const said = log().getAllByRole("paragraph").map((p) => p.textContent);
    expect(said).toEqual([`Assistant: ${GREETING}`, "You: Hello", "Assistant: Thanks!"]);
  });

  it("sends with Enter and adds a new line with Shift+Enter", async () => {
    sendChat.mockResolvedValueOnce({ reply: "Noted.", values: filledValues });
    const { user, input } = setup();

    await user.type(input, "Line one{Shift>}{Enter}{/Shift}Line two");
    expect(input).toHaveValue("Line one\nLine two");
    expect(sendChat).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(sendChat.mock.calls[0][0].at(-1)).toEqual({ role: "user", content: "Line one\nLine two" });
  });

  it("does not send blank messages", async () => {
    const { user, input } = setup();
    await user.type(input, "   {Enter}");
    expect(sendChat).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("shows that the assistant is typing and blocks sending until it replies", async () => {
    const turn = deferredTurn();
    const { user, input } = setup();

    await user.type(input, "First{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Assistant is typing");

    // The user can keep typing, but can't send until the reply arrives.
    await user.type(input, "Second{Enter}");
    expect(input).toHaveValue("Second");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(sendChat).toHaveBeenCalledOnce();

    await act(async () => turn.resolve({ reply: "Got it.", values: filledValues }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("shows an error, and Try again resends without repeating the message", async () => {
    sendChat.mockRejectedValueOnce(new Error("The AI assistant is unavailable right now. Please try again."));
    const { user, input, onValues } = setup();

    await user.type(input, "Acme and Globex.{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("The AI assistant is unavailable right now.");
    expect(onValues).not.toHaveBeenCalled();

    sendChat.mockResolvedValueOnce({ reply: "Who signs for Acme?", values: filledValues });
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await log().findByText("Who signs for Acme?")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(log().getAllByText("Acme and Globex.")).toHaveLength(1);
    expect(sendChat.mock.calls[1][0]).toEqual(sendChat.mock.calls[0][0]);
    expect(onValues).toHaveBeenCalledWith(filledValues);
  });

  it("sends only the latest messages in a long conversation", async () => {
    let turn = 0;
    sendChat.mockImplementation(async () => ({ reply: `Reply ${++turn}`, values: filledValues }));
    const { user, input } = setup();

    for (let n = 1; n <= MAX_HISTORY / 2 + 5; n++) {
      // Pasting is much faster than typing each character.
      await user.click(input);
      await user.paste(`Message ${n}`);
      await user.keyboard("{Enter}");
      await log().findByText(`Reply ${n}`);
    }

    const sent = sendChat.mock.lastCall![0];
    expect(sent).toHaveLength(MAX_HISTORY);
    expect(sent.at(-1)).toEqual({ role: "user", content: `Message ${MAX_HISTORY / 2 + 5}` });
    // Everything stays on screen, including the greeting.
    expect(log().getByText(GREETING)).toBeInTheDocument();
  });

  it("sends the values it is given", async () => {
    sendChat.mockResolvedValueOnce({ reply: "Thanks.", values: filledValues });
    const { user, input } = setup(filledValues);
    await user.type(input, "Change the law to Texas{Enter}");
    expect(sendChat.mock.calls[0][1]).toBe(filledValues);
  });
});
