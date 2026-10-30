import { afterEach, describe, expect, test } from "bun:test";
import { forgetGoal, loadGoalHistory, rememberGoal } from "./goal-history.ts";

afterEach(() => localStorage.clear());

describe("goal history", () => {
  test("starts empty", () => {
    expect(loadGoalHistory()).toEqual([]);
  });

  test("keeps the newest goal first and moves a repeated goal to the top", () => {
    rememberGoal("any%");
    rememberGoal("16 star");
    rememberGoal("any%");

    expect(loadGoalHistory()).toEqual(["any%", "16 star"]);
  });

  test("keeps the last 20 goals", () => {
    for (let i = 0; i < 25; i++) {
      rememberGoal(`goal ${i}`);
    }

    expect(loadGoalHistory()).toHaveLength(20);
    expect(loadGoalHistory()[0]).toBe("goal 24");
  });

  test("forgets one goal", () => {
    rememberGoal("any%");
    rememberGoal("16 star");

    forgetGoal("any%");

    expect(loadGoalHistory()).toEqual(["16 star"]);
  });

  test("ignores stored data it didn't write", () => {
    localStorage.setItem("raceme.goalHistory", '{"not":"a list"}');

    expect(loadGoalHistory()).toEqual([]);
  });

  test("works without storage, like in a private window that refuses it", () => {
    const realSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("refused", "SecurityError");
    };

    expect(() => rememberGoal("any%")).not.toThrow();

    Storage.prototype.setItem = realSetItem;
  });
});
