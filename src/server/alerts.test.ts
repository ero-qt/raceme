import { describe, expect, test } from "bun:test";
import { SpikeAlerts } from "./alerts.ts";

describe("SpikeAlerts", () => {
  test("posts once when a count reaches 5, 10, 25 and 50", () => {
    const sent: string[] = [];
    const alerts = new SpikeAlerts((text) => sent.push(text));

    for (const count of [1, 4, 5, 6, 9, 10, 11, 10, 24, 25, 49, 50]) {
      alerts.update("rooms", count);
    }

    expect(sent).toEqual([
      "raceme: 5 rooms open",
      "raceme: 10 rooms open",
      "raceme: 25 rooms open",
      "raceme: 50 rooms open",
    ]);
  });

  test("posts again after the count fell below the level, and keeps rooms and people apart", () => {
    const sent: string[] = [];
    const alerts = new SpikeAlerts((text) => sent.push(text));

    for (const count of [10, 9, 10]) {
      alerts.update("people", count);
    }
    alerts.update("rooms", 10);

    expect(sent).toEqual([
      "raceme: 10 people online",
      "raceme: 10 people online",
      "raceme: 10 rooms open",
    ]);
  });

  test("posts only the highest level when a count jumps past several at once", () => {
    const sent: string[] = [];
    const alerts = new SpikeAlerts((text) => sent.push(text));

    alerts.update("people", 60);

    expect(sent).toEqual(["raceme: 50 people online"]);
  });
});
