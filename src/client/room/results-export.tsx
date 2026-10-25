import { type JSX, createMemo, onCleanup } from "solid-js";
import type { RaceState } from "../../shared/race/race.ts";
import { exportFileName, resultsCsv, resultsJson } from "../../shared/results.ts";
import * as styles from "./room.css.ts";

/** Offers the finished race's results as plain download links, built in the browser. */
export function ResultsExport(props: { race: RaceState }): JSX.Element {
  const link = (text: () => string, type: string) => {
    const url = createMemo<string>((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }

      return URL.createObjectURL(new Blob([text()], { type }));
    });
    onCleanup(() => URL.revokeObjectURL(url()));
    return url;
  };

  const csv = link(() => resultsCsv(props.race), "text/csv");
  const json = link(() => resultsJson(props.race), "application/json");

  return (
    <div class={styles.row}>
      <a class={styles.download} href={csv()} download={exportFileName(props.race, "csv")}>
        download .csv
      </a>
      <a class={styles.download} href={json()} download={exportFileName(props.race, "json")}>
        download .json
      </a>
    </div>
  );
}
