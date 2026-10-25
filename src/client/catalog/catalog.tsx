import { For, type JSX } from "solid-js";
import * as styles from "./catalog.css.ts";
import { catalogEntries } from "./entries.tsx";

/** Shows every primitive in every variant on one page. */
export function Catalog(): JSX.Element {
  return (
    <main class={styles.page}>
      <h1>Catalog</h1>
      <For each={catalogEntries}>
        {(entry) => (
          <section class={styles.section}>
            <h2>{entry.title}</h2>
            <div class={styles.row}>{entry.render()}</div>
          </section>
        )}
      </For>
    </main>
  );
}
