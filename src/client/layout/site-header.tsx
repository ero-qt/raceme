import type { JSX } from "solid-js";
import { homePath } from "../page-path.ts";
import * as styles from "./site-header.css.ts";

export const headerStatusId = "header-status";

/** Shows the name linking home. */
export function SiteHeader(props: { onHome: () => void }): JSX.Element {
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
    </header>
  );
}
