import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { ChatForm } from "./room-forms.tsx";

afterEach(cleanup);

describe("ChatForm", () => {
  test("turns send off after a line until the slow mode wait is over", async () => {
    const said: string[] = [];
    const view = render(() => <ChatForm onSay={(text) => said.push(text)} waitMs={50} />);
    const input = view.getByLabelText("Message") as HTMLInputElement;
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
    const input = view.getByLabelText("Message") as HTMLInputElement;

    fireEvent.input(input, { target: { value: "gl" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.input(input, { target: { value: ".done" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(said).toEqual(["gl"]);
    expect(commands).toEqual([".done"]);
  });
});
