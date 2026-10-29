import { Eye, Lock, LockOpen } from "lucide-solid";
import { type JSX, Show } from "solid-js";
import type { ClientAction } from "../../shared/protocol.ts";
import { type RaceState, maxEntrants, minEntrantCap } from "../../shared/race/race.ts";
import { Button } from "../primitives/button.tsx";
import * as styles from "./room.css.ts";

/**
 * Shows the Entrants heading, the count against the cap and whether entry is closed. Before the
 * start the host edits the cap in place and opens or closes entry here.
 */
export function EntrantsHeader(props: {
  race: RaceState;
  isHost: boolean;
  /** Counts the people with the room open who haven't entered, `null` once the room is gone. */
  watchers: number | null;
  send: (action: ClientAction) => void;
}): JSX.Element {
  const beforeStart = () => props.race.phase === "open" || props.race.phase === "countdown";
  const cap = () => props.race.settings.entrantCap ?? maxEntrants;
  // Entry is closed once the race starts, so the lock shows that too.
  const locked = () => props.race.entryLocked || !beforeStart();
  const editable = () => props.isHost && beforeStart();
  const lockIcon = () => (
    <Show when={locked()} fallback={<LockOpen class={styles.headerIcon} aria-hidden="true" />}>
      <Lock class={styles.headerIcon} aria-hidden="true" />
    </Show>
  );

  return (
    <div class={styles.entrantsHeader}>
      <h2 class={styles.entrantsTitle}>entrants</h2>
      <span class={styles.entrantCount}>
        <span class={styles.countDigits}>{props.race.entrants.length}</span>/
        <Show when={editable()} fallback={<span class={styles.capDigits}>{cap()}</span>}>
          <input
            class={styles.capField}
            type="number"
            aria-label="entrant limit"
            min={minEntrantCap}
            max={maxEntrants}
            value={cap()}
            // Only digits and the keys that move or delete, so letters never empty the field.
            onKeyDown={(event) => {
              if (event.key.length === 1 && !/\d/.test(event.key) && !event.ctrlKey) {
                event.preventDefault();
              }
            }}
            onChange={(event) => {
              const field = event.currentTarget;
              const value = Number(field.value);
              if (!Number.isInteger(value) || value < minEntrantCap || value > maxEntrants) {
                field.value = String(cap());
                return;
              }
              props.send({ type: "setEntrantCap", cap: value === maxEntrants ? null : value });
            }}
          />
        </Show>
      </span>
      <Show when={props.watchers !== null}>
        <span class={styles.watcherCount} title={`${props.watchers} watching`}>
          <Eye class={styles.headerIcon} aria-hidden="true" />
          <span class={styles.countDigits}>{props.watchers}</span>
          <span class={styles.visuallyHidden}> watching</span>
        </span>
      </Show>
      <span class={styles.headerSpacer} />
      {/* One button for everyone, so the same state always looks the same. */}
      <Button
        variant="plain"
        disabled={!editable()}
        aria-label={locked() ? "open entry" : "close entry"}
        onClick={() => props.send({ type: locked() ? "unlock" : "lock" })}
      >
        {lockIcon()}
      </Button>
    </div>
  );
}
