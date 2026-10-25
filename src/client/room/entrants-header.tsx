import { Eye, Lock, LockOpen } from "lucide-solid";
import { type JSX, Show } from "solid-js";
import type { ClientAction } from "../../shared/protocol.ts";
import { type RaceState, maxEntrants, minEntrantCap } from "../../shared/race/race.ts";
import { Button } from "../primitives/button.tsx";
import { type Status, StatusBadge } from "../primitives/status-badge.tsx";
import * as styles from "./room.css.ts";

const roomStatus: Record<RaceState["phase"], Status> = {
  open: "open",
  countdown: "countdown",
  running: "running",
  finished: "done",
  terminated: "forfeit",
};

const roomStatusLabel: Partial<Record<RaceState["phase"], string>> = {
  finished: "Complete",
  terminated: "Terminated",
};

/**
 * Shows the Entrants heading, the count against the cap, the room status and whether entry is
 * closed. Before the start the host edits the cap in place and opens or closes entry here.
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
      <h2 class={styles.entrantsTitle}>Entrants</h2>
      <span class={styles.entrantCount}>
        <span class={styles.countDigits}>{props.race.entrants.length}</span>/
        <Show when={editable()} fallback={<span class={styles.capDigits}>{cap()}</span>}>
          <input
            class={styles.capField}
            type="number"
            aria-label="Entrant limit"
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
      <span class={styles.headerStatus}>
        <Show when={props.race.entryLocked && beforeStart()} fallback={statusBadge(props.race)}>
          <StatusBadge status="forfeit" label="Entry closed" />
        </Show>
      </span>
      {/* One button for everyone, so the same state always looks the same. */}
      <Button
        variant="plain"
        disabled={!editable()}
        aria-label={locked() ? "Open entry" : "Close entry"}
        onClick={() => props.send({ type: locked() ? "unlock" : "lock" })}
      >
        {lockIcon()}
      </Button>
    </div>
  );
}

function statusBadge(race: RaceState): JSX.Element {
  const label = roomStatusLabel[race.phase];
  return <StatusBadge status={roomStatus[race.phase]} {...(label ? { label } : {})} />;
}
