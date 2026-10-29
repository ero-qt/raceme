import type { JSX } from "solid-js";
import * as styles from "./home-page.css.ts";

/** Tells a first-time visitor what raceme is, beside the start form. */
export function HomeIntro(): JSX.Element {
  return (
    <aside class={styles.intro}>
      <h2 class={styles.introHeading}>welcome</h2>
      <p>
        raceme is an online race room host like{" "}
        <a href="https://speedrunslive.com" rel="noopener">
          SRL
        </a>
        , without accounts and without moderation. create a room, invite people, race.
      </p>
      <p class={styles.introNote}>a room is deleted from the server once it closes.</p>
    </aside>
  );
}
