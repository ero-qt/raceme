export type ThemeChoice = "system" | "dark" | "light";

const key = "raceme.theme";

/** Reads the viewer's theme pick. Without one the page follows the system setting. */
export function loadTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(key);
    return stored === "dark" || stored === "light" ? stored : "system";
  } catch {
    return "system";
  }
}

/** Applies a theme pick to the page and remembers it in this browser. */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = choice;
  }

  try {
    if (choice === "system") {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, choice);
    }
  } catch {
    // Private windows may refuse storage. The pick then lasts for this page only.
  }
}
