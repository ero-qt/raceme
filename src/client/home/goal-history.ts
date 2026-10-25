const key = "raceme.goalHistory";
const maxGoals = 20;

/** Reads the goals this browser opened rooms with, newest first. Only this browser keeps them. */
export function loadGoalHistory(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(stored) ? stored.filter((goal) => typeof goal === "string") : [];
  } catch {
    return [];
  }
}

/** Puts a goal at the top of the history. */
export function rememberGoal(goal: string): void {
  save([goal, ...loadGoalHistory().filter((known) => known !== goal)].slice(0, maxGoals));
}

export function forgetGoal(goal: string): void {
  save(loadGoalHistory().filter((known) => known !== goal));
}

function save(goals: string[]): void {
  try {
    if (goals.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(goals));
    }
  } catch {
    // Private windows may refuse storage. The history then lasts for this page only.
  }
}
