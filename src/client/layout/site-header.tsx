import { Monitor, Moon, Sun } from "lucide-solid";
import { type JSX, createSignal } from "solid-js";
import { homePath } from "../page-path.ts";
import * as styles from "./site-header.css.ts";
import { type ThemeChoice, applyTheme, loadTheme } from "./theme-preference.ts";

export const headerStatusId = "header-status";

const nextTheme: Record<ThemeChoice, ThemeChoice> = {
  system: "dark",
  dark: "light",
  light: "system",
};

/** Shows the name linking home and a button that cycles the theme. */
export function SiteHeader(props: { onHome: () => void }): JSX.Element {
  const [theme, setTheme] = createSignal(loadTheme());
  applyTheme(theme());

  const cycle = () => {
    const next = nextTheme[theme()];
    setTheme(next);
    applyTheme(next);
  };

  return (
    <header class={styles.header}>
      <a
        class={styles.home}
        href={homePath(import.meta.env.BASE_URL)}
        onClick={(event) => {
          event.preventDefault();
          props.onHome();
        }}
      >
        raceme
      </a>
      {/* Pages put their own status next to the name here, like the room timer. */}
      <span id={headerStatusId} class={styles.status} />
      <button
        type="button"
        class={styles.theme}
        aria-label={`Theme: ${theme()}`}
        title={`Theme: ${theme()}`}
        onClick={cycle}
      >
        {theme() === "dark" ? (
          <Moon class={styles.themeIcon} aria-hidden="true" />
        ) : theme() === "light" ? (
          <Sun class={styles.themeIcon} aria-hidden="true" />
        ) : (
          <Monitor class={styles.themeIcon} aria-hidden="true" />
        )}
      </button>
    </header>
  );
}
