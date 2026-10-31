import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { ChatForm } from "./room-forms.tsx";

afterEach(cleanup);

describe("chatForm", () => {
  test("turns send off after a line until the slow mode wait is over", async () => {
    const said: string[] = [];
    const view = render(() => <ChatForm onSay={(text) => said.push(text)} waitMs={50} />);
    const input = view.getByLabelText("message") as HTMLInputElement;
    const send = view.getByRole("button", { name: "send" }) as HTMLButtonElement;

    fireEvent.input(input, { target: { value: "gl" } });
    fireEvent.submit(input.form as HTMLFormElement);
    fireEvent.input(input, { target: { value: "again" } });
    fireEvent.submit(input.form as HTMLFormElement);

    expect(said).toEqual(["gl"]);
    expect(send.disabled).toBe(true);
    expect(input.value).toBe("again");

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(send.disabled).toBe(false);
  });

  test("send's tooltip gives the slow mode wait or the mute as the reason it is off", async () => {
    const view = render(() => <ChatForm onSay={() => {}} waitMs={50} />);
    const send = view.getByRole("button", { name: "send" }) as HTMLButtonElement;
    fireEvent.input(view.getByLabelText("message"), { target: { value: "hi" } });
    fireEvent.submit(send.closest("form") as HTMLFormElement);
    expect(send.title).toBe("slow mode is on, wait a moment before your next message.");
    await waitFor(() => expect(send.disabled).toBe(false));
    expect(send.hasAttribute("title")).toBe(false);
    cleanup();

    const muted = render(() => <ChatForm onSay={() => {}} muted />);
    expect(muted.getByRole("button", { name: "send" }).title).toBe("you are muted.");
  });

  test("send is a square button with the enter arrow and keeps its name for screen readers", () => {
    const view = render(() => <ChatForm onSay={() => {}} />);
    const send = view.getByRole("button", { name: "send" });

    expect(send.querySelector("svg.lucide-corner-down-left")).not.toBeNull();
    expect(send.textContent?.trim()).toBe("");
  });

  test("send hands focus back to the message box", () => {
    const view = render(() => <ChatForm onSay={() => {}} waitMs={50} />);
    const input = view.getByLabelText("message") as HTMLInputElement;
    const send = view.getByRole("button", { name: "send" });
    send.focus();

    fireEvent.input(input, { target: { value: "gl" } });
    fireEvent.submit(input.form as HTMLFormElement);

    expect(document.activeElement).toBe(input);
  });

  test("runs a command during the slow mode wait", () => {
    const said: string[] = [];
    const commands: string[] = [];
    const view = render(() => (
      <ChatForm
        onSay={(text) => said.push(text)}
        onCommand={(text) => text === ".done" && commands.push(text) > 0}
        waitMs={10_000}
      />
    ));
    const input = view.getByLabelText("message") as HTMLInputElement;

    fireEvent.input(input, { target: { value: "gl" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.input(input, { target: { value: ".done" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(said).toEqual(["gl"]);
    expect(commands).toEqual([".done"]);
  });
});
