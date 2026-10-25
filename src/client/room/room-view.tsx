import { TriangleAlert, Volume2, VolumeOff } from "lucide-solid";
import { type Accessor, Index, type JSX, Show, createEffect, on } from "solid-js";
import type { FeedEntry } from "../../shared/feed-entry.ts";
import type { ClientAction } from "../../shared/protocol.ts";
import { type RaceState, type Standing, standings } from "../../shared/race/race.ts";
import type { GoalCatalog } from "../home/goal-picker.tsx";
import { Button } from "../primitives/button.tsx";
import { type Status, StatusBadge } from "../primitives/status-badge.tsx";
import { actionLabel } from "./action-labels.ts";
import { type ActionType, availableActions } from "./available-actions.ts";
import { EntrantTable } from "./entrant-table.tsx";
import { FeedLog } from "./feed-log.tsx";
import { useFractionDigits } from "./fraction-preference.ts";
import { GoalTitle } from "./goal-title.tsx";
import { InviteLink } from "./invite-link.tsx";
import { RaceClock } from "./race-clock.tsx";
import { ResultsExport } from "./results-export.tsx";
import * as styles from "./room.css.ts";
import { ChatForm, JoinForm } from "./room-forms.tsx";

const dangerActions = new Set<ActionType>(["forfeit", "leave"]);
const neutralActions = new Set<ActionType>(["unready", "undone", "unforfeit"]);
const accentActions = new Set<ActionType>(["rematch"]);

export interface RoomViewProps {
  race: RaceState;
  me: { entrantId: string; isHost: boolean };
  /** Current time on the server's clock, in ms. */
  now: number;
  inviteUrl: string;
  notice: string | null;
  feed: FeedEntry[];
  send: (action: ClientAction) => void;
  /** Swaps the speedrun.com lookups of the host's goal picker, for tests. */
  catalog?: GoalCatalog | undefined;
  /** Keeps `send` off this long after each chat line, matching the server's slow mode. */
  chatEveryMs?: number;
  /** Shows the room as it was when the server closed it, with nothing left to do in it. */
  closed?: boolean;
}

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

/** Shows one race room: goal, clock, invite link, entrants and the chat with the race buttons. */
export function RoomView(props: RoomViewProps): JSX.Element {
  const actions = () => availableActions(props.race, props.me.entrantId, props.me.isHost);
  const beforeStart = () => props.race.phase === "open" || props.race.phase === "countdown";
  const over = () => props.race.phase === "finished" || props.race.phase === "terminated";
  const entered = () => props.race.entrants.some((e) => e.id === props.me.entrantId);
  const elapsed = () => {
    const { startsAt, endedAt } = props.race;
    return startsAt === null ? 0 : (endedAt ?? props.now) - startsAt;
  };

  // A pressed button often makes way for its opposite, like .ready for .unready. Keeping the
  // button in its slot keeps focus on it, and focus that falls off a removed one comes back below.
  let pressed = false;
  const press = (action: ClientAction) => {
    pressed = true;
    props.send(action);
  };

  const sideActions = () => actions().filter((a) => dangerActions.has(a));
  const mainActions = () => actions().filter((a) => !dangerActions.has(a) && a !== "join");
  const actionButton = (action: Accessor<ActionType>) => (
    <Button
      variant={
        dangerActions.has(action())
          ? "danger"
          : neutralActions.has(action())
            ? "ghost"
            : accentActions.has(action())
              ? "accent"
              : "go"
      }
      onClick={() => press({ type: action() } as ClientAction)}
    >
      {actionLabel[action()]}
    </Button>
  );
  const rowActions = (row: Standing) =>
    props.closed ? null : row.id === props.me.entrantId ? (
      <Index each={sideActions()}>{actionButton}</Index>
    ) : (
      <Show when={props.me.isHost && beforeStart()}>
        <Button
          variant="ghost"
          aria-label={`${actionLabel.remove} ${row.name}`}
          onClick={() => press({ type: "remove", entrantId: row.id })}
        >
          {actionLabel.remove}
        </Button>
      </Show>
    );
  // Shows the entrant's current state, so a speaker means they can chat right now.
  const muteButton = (row: Standing) => {
    const muted = () => props.race.muted.includes(row.id);
    const type = () => (muted() ? "unmute" : "mute");
    return (
      <Show when={row.id !== props.me.entrantId}>
        <Button
          variant="ghost"
          class={styles.muteButton}
          data-muted={muted()}
          aria-label={`${actionLabel[type()]} ${row.name}`}
          onClick={() => press({ type: type(), entrantId: row.id })}
        >
          <Show when={muted()} fallback={<Volume2 class={styles.rowIcon} aria-hidden="true" />}>
            <VolumeOff class={styles.rowIcon} aria-hidden="true" />
          </Show>
        </Button>
      </Show>
    );
  };

  const precision = useFractionDigits({
    roomDefault: () => props.race.settings.fractionDigits,
    isHost: () => props.me.isHost,
    setRoomDefault: (digits) => props.send({ type: "setFractionDigits", digits }),
  });

  let messageBox: HTMLInputElement | undefined;
  let chat: HTMLElement | undefined;
  createEffect(
    on(entered, (isIn, wasIn) => {
      if (isIn && wasIn === false) {
        messageBox?.focus();
      }
    }),
  );
  createEffect(
    on(
      () => props.race,
      () => {
        const lost = document.activeElement === null || document.activeElement === document.body;
        if (pressed && lost) {
          chat?.querySelector<HTMLElement>("input, button")?.focus();
        }
        pressed = false;
      },
      { defer: true },
    ),
  );

  return (
    <main class={styles.page}>
      <Show when={props.closed}>
        <div class={styles.closedNotice} role="status">
          <p class={styles.closedReason}>{props.notice}</p>
          <p class={styles.closedBox}>
            <TriangleAlert class={styles.closedIcon} aria-hidden="true" />
            <span>
              This page is only kept in this tab.
              <br />
              Save the results now, they're gone once you close it.
            </span>
          </p>
        </div>
        <hr class={styles.closedRule} />
      </Show>
      <GoalTitle
        goal={props.race.goal}
        editable={props.me.isHost && beforeStart() && !props.closed}
        onSubmit={(goal) => props.send({ type: "setGoal", goal })}
        catalog={props.catalog}
      />
      <div class={styles.clockLine}>
        <RaceClock elapsed={elapsed()} digits={precision.digits()} onPick={precision.pick} />
        <Show when={props.me.isHost && !over() && !props.closed}>
          <Button variant="danger" onClick={() => props.send({ type: "end" })}>
            {actionLabel.end}
          </Button>
        </Show>
      </div>
      <Show when={!props.closed}>
        <InviteLink url={props.inviteUrl} />
      </Show>
      <Show when={!props.closed}>
        <p class={styles.notice} role="status">
          {props.notice}
        </p>
      </Show>
      <Show when={!props.closed}>
        <section class={styles.chat} aria-label="Chat" ref={chat}>
          <FeedLog entries={props.feed} />
          <Show
            when={entered()}
            fallback={
              <Show
                when={actions().includes("join")}
                fallback={
                  <div class={styles.row}>
                    <Index each={mainActions()}>{actionButton}</Index>
                  </div>
                }
              >
                <JoinForm onSubmit={(name) => props.send({ type: "join", name })} />
              </Show>
            }
          >
            <ChatForm
              inputRef={(input) => {
                messageBox = input;
              }}
              onSay={(text) => props.send({ type: "say", text })}
              waitMs={props.chatEveryMs ?? 0}
              muted={props.race.muted.includes(props.me.entrantId)}
            >
              <Index each={mainActions()}>{actionButton}</Index>
            </ChatForm>
          </Show>
        </section>
      </Show>
      <section class={styles.entrants}>
        <div class={styles.entrantsHeader}>
          <h2 class={styles.entrantsTitle}>Entrants</h2>
          <StatusBadge
            status={roomStatus[props.race.phase]}
            {...(roomStatusLabel[props.race.phase]
              ? { label: roomStatusLabel[props.race.phase] }
              : {})}
          />
        </div>
        <Show
          when={props.race.entrants.length > 0}
          fallback={<p class={styles.empty}>Nobody has entered yet.</p>}
        >
          <EntrantTable
            rows={standings(props.race)}
            started={!beforeStart()}
            digits={precision.digits()}
            rowActions={rowActions}
            muteButton={props.me.isHost && !props.closed ? muteButton : undefined}
          />
        </Show>
        <Show when={(over() || props.closed) && props.race.entrants.length > 0}>
          <ResultsExport race={props.race} />
        </Show>
      </section>
    </main>
  );
}
