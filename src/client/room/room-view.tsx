import { TriangleAlert, Volume2, VolumeOff } from "lucide-solid";
import {
  type Accessor,
  Index,
  type JSX,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";
import type { FeedEntry } from "../../shared/feed-entry.ts";
import type { ClientAction, ClosesFor, Me } from "../../shared/protocol.ts";
import {
  type RaceState,
  type Standing,
  beforeStart,
  earliestResultMs,
  standings,
} from "../../shared/race/race.ts";
import type { GoalCatalog } from "../goal/goal-picker.tsx";
import { Button } from "../primitives/button.tsx";
import { icon, visuallyHidden, warningIcon } from "../styles/controls.css.ts";
import { actionLabel, refusalText } from "./action-labels.ts";
import { type ActionType, availableActions } from "./available-actions.ts";
import { chatCommand } from "./chat-command.ts";
import { EntrantTable } from "./entrant-table.tsx";
import { EntrantsHeader } from "./entrants-header.tsx";
import { FeedLog, type NoticeLine } from "./feed-log.tsx";
import { useFractionDigits } from "./fraction-preference.ts";
import { GoalTitle } from "./goal-title.tsx";
import { InviteLink } from "./invite-link.tsx";
import { RaceClock } from "./race-clock.tsx";
import { ResultsExport } from "./results-export.tsx";
import * as styles from "./room.css.ts";
import { ChatForm, JoinForm } from "./room-forms.tsx";
import { RoomStatus } from "./room-status.tsx";
import { HeaderStatus, RoomTimer } from "./room-timer.tsx";
import { type RoomTab, loadTab, saveTab } from "./tab-preference.ts";

// Shows the actions that take you out of the race in your own row.
const rowActionTypes = new Set<ActionType>(["forfeit", "leave"]);
const dangerActions = new Set<ActionType>(["forfeit"]);
const neutralActions = new Set<ActionType>(["unready", "undone", "unforfeit", "leave"]);
const accentActions = new Set<ActionType>(["rematch"]);

export interface RoomViewProps {
  slug: string;
  race: RaceState;
  me: Me;
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
  /** Counts the people with the room open who haven't entered. */
  watchers?: number;
  /** Gives the server time the room closes, for the room timer. */
  closesAt?: number;
  closesFor?: ClosesFor;
  /** Shows the room as it was when the server closed it, with nothing left to do in it. */
  closed?: boolean;
}

/** Tracks whether the screen is a phone's, where the room shows one card at a time. */
function usePhoneScreen(): () => boolean {
  const query = globalThis.matchMedia?.("(max-width: 47.99rem)");
  const [phone, setPhone] = createSignal(query?.matches ?? false);
  const onChange = (event: MediaQueryListEvent) => setPhone(event.matches);
  query?.addEventListener("change", onChange);
  onCleanup(() => query?.removeEventListener("change", onChange));
  return phone;
}

/** Shows one race room: goal, clock, invite link, entrants and the chat with the race buttons. */
export function RoomView(props: RoomViewProps): JSX.Element {
  const actions = () => availableActions(props.race, props.me.entrantId, props.me.isHost);
  const over = () => props.race.phase === "finished" || props.race.phase === "terminated";
  const entryRefusal = () => (props.race.entryLocked ? "entry is closed" : "race is full");
  const entered = () => props.race.entrants.some((e) => e.id === props.me.entrantId);
  const elapsed = () => {
    const { startsAt, endedAt, settings } = props.race;
    // Before the countdown the clock waits at its start, like -00:00:10.
    return startsAt === null ? -settings.countdownMs : (endedAt ?? props.now) - startsAt;
  };

  // A pressed button often makes way for its opposite, like .ready for .unready. Keeping the
  // button in its slot keeps focus on it, and focus that falls off a removed one comes back below.
  let pressed: Element | null = null;
  let pressedCard: Element | null | undefined = null;
  const press = (event: MouseEvent, action: ClientAction) => {
    pressed = event.currentTarget as Element;
    // Leaving the race takes focus to the chat, where the join form is, unless a phone has
    // the chat hidden. A hidden control can't take focus.
    const leavesRow = rowActionTypes.has(action.type as ActionType);
    const ownCard = race?.contains(pressed) ? race : chat;
    pressedCard = leavesRow && !(phoneScreen() && tab() === "race") ? chat : ownCard;
    props.send(action);
  };

  // Leaving or unreadying during the countdown calls the race off, so those turn red then.
  const stopsCountdown = (action: ActionType) =>
    props.race.phase === "countdown" && (action === "unready" || action === "leave");
  const tooEarly = (action: ActionType) =>
    (action === "done" || action === "forfeit") && elapsed() < earliestResultMs;
  const sideActions = () => actions().filter((a) => rowActionTypes.has(a));
  const mainActions = () => actions().filter((a) => !rowActionTypes.has(a) && a !== "join");
  const actionButton = (action: Accessor<ActionType>) => (
    <Button
      variant={
        dangerActions.has(action()) || stopsCountdown(action())
          ? "danger"
          : neutralActions.has(action())
            ? "ghost"
            : accentActions.has(action())
              ? "accent"
              : "go"
      }
      disabled={tooEarly(action())}
      onClick={(event) => press(event, { type: action() } as ClientAction)}
    >
      {actionLabel[action()]}
    </Button>
  );
  const rowActions = (row: Standing) =>
    props.closed ? null : row.id === props.me.entrantId ? (
      <Index each={sideActions()}>{actionButton}</Index>
    ) : (
      <Show when={props.me.isHost && beforeStart(props.race)}>
        <Button
          variant="danger"
          aria-label={`${actionLabel.remove} ${row.name}`}
          onClick={(event) => press(event, { type: "remove", entrantId: row.id })}
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
          variant="plain"
          class={styles.muteButton}
          data-muted={muted()}
          aria-label={`${actionLabel[type()]} ${row.name}`}
          onClick={(event) => press(event, { type: type(), entrantId: row.id })}
        >
          <Show when={muted()} fallback={<Volume2 class={icon} aria-hidden="true" />}>
            <VolumeOff class={icon} aria-hidden="true" />
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

  // Every notice becomes a red line in the log that only this browser sees, dated when it came.
  const [notices, setNotices] = createSignal<NoticeLine[]>([]);
  // A name stays filled in after .unenter, so entering again is one click.
  const [lastName, setLastName] = createSignal("");
  const addNotice = (text: string) =>
    setNotices((lines) => [...lines, { at: props.now, kind: "notice", text }]);
  createEffect(
    on(
      () => props.notice,
      (text) => {
        if (text !== null) {
          addNotice(text);
        }
      },
    ),
  );
  const logLines = () =>
    [...props.feed, ...notices()].sort((a, b) => a.at - b.at || Number(a.kind === "notice"));
  const latestLine = () => {
    const line = logLines().at(-1);
    return line?.kind === "chat" ? `${line.name}: ${line.text}` : (line?.text ?? "");
  };

  let messageBox: HTMLInputElement | undefined;
  let race: HTMLElement | undefined;
  let chat: HTMLElement | undefined;
  const phoneScreen = usePhoneScreen();
  // The clock line sits in the chat. A phone shows the room details or the chat, so the room
  // details get their own copy. Only one of the 2 is ever on screen.
  const clockLine = () => (
    <div class={styles.clockLine}>
      <div class={styles.clockBlock}>
        <RaceClock elapsed={elapsed()} digits={precision.digits()} onPick={precision.pick} />
        <span class={styles.clockStatus}>
          <RoomStatus race={props.race} />
        </span>
      </div>
      <Show when={props.me.isHost && !over() && !props.closed}>
        <Button variant="danger" onClick={() => props.send({ type: "end" })}>
          {actionLabel.end}
        </Button>
      </Show>
    </div>
  );
  // Phones show the room details or the chat, picked in the bar at the bottom. The join form is
  // in the chat, so that's where someone who hasn't entered starts. A pick is kept for the room,
  // so a reload or a return opens the same tab.
  const [tab, setTab] = createSignal<RoomTab>(loadTab(props.slug) ?? (entered() ? "race" : "chat"));
  const pickTab = (picked: RoomTab) => {
    saveTab(props.slug, picked);
    setTab(picked);
  };
  // A closed room has its results in the room details, so a phone shows those. The chat's
  // controls are gone then, so the notice takes the focus they held.
  let closedNotice: HTMLDivElement | undefined;
  createEffect(() => {
    if (props.closed) {
      setTab("race");
      closedNotice?.focus();
    }
  });

  // Enter on the page goes to the chat box, where commands like `.done` work, so a stray key
  // press never runs an action by itself.
  const jumpToChat = (event: KeyboardEvent) => {
    const onPage = document.activeElement === null || document.activeElement === document.body;
    if (event.key === "Enter" && onPage && messageBox && !messageBox.disabled) {
      event.preventDefault();
      setTab("chat");
      messageBox.focus();
    }
  };
  document.addEventListener("keydown", jumpToChat);
  onCleanup(() => document.removeEventListener("keydown", jumpToChat));
  // The stuck phone tab bar covers the screen's bottom. Browsers don't scroll for a focused
  // control that is on screen but under it, so this scrolls it up into view.
  let tabBar: HTMLElement | undefined;
  const keepAboveTabBar = (event: FocusEvent) => {
    const bar = tabBar?.getBoundingClientRect();
    const control = (event.target as Element).getBoundingClientRect();
    const hidden = bar && bar.height > 0 ? control.bottom - bar.top : 0;
    if (hidden > 0) {
      window.scrollBy({ top: hidden + 8 });
    }
  };
  document.addEventListener("focusin", keepAboveTabBar);
  onCleanup(() => document.removeEventListener("focusin", keepAboveTabBar));
  // The page opens on the field the viewer needs next, the name field or the message box.
  // A phone is left alone, since focus in a field would pop the keyboard up on every open.
  onMount(() => {
    if (!props.closed && !phoneScreen()) {
      (entered() ? messageBox : chat?.querySelector<HTMLInputElement>("input"))?.focus();
    }
  });
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
        if (pressed && !pressed.isConnected && lost) {
          // Focus stays in the card the press came from, on a control that can't end the race
          // and isn't the goal field, where focus selects the goal for typing over.
          pressedCard
            ?.querySelector<HTMLElement>(
              'input:not([aria-label="goal"]), button:not([data-variant="danger"])',
            )
            ?.focus();
        }
        pressed = null;
        pressedCard = null;
      },
      { defer: true },
    ),
  );

  return (
    <main class={styles.page} data-closed={props.closed === true}>
      <section class={styles.raceCard} data-active={tab() === "race"} aria-label="room" ref={race}>
        {/* A phone hides the chat and its live log on the room tab, so the newest line is
            read from here instead. */}
        <Show when={phoneScreen()}>
          <p class={visuallyHidden} role="status" aria-label="latest chat line">
            {latestLine()}
          </p>
        </Show>
        <Show when={props.closed}>
          <div class={styles.closedNotice} role="status" tabIndex={-1} ref={closedNotice}>
            <p class={styles.closedReason}>{props.notice}</p>
            <p class={styles.closedBox}>
              <TriangleAlert class={warningIcon} aria-hidden="true" />
              <span>
                this page is only kept in this tab.
                <br />
                save the results now, they're gone once you close it.
              </span>
            </p>
          </div>
          <hr class={styles.rule} />
        </Show>
        <GoalTitle
          goal={props.race.goal}
          editable={props.me.isHost && beforeStart(props.race) && !props.closed}
          onSubmit={(goal) => props.send({ type: "setGoal", goal })}
          catalog={props.catalog}
        />
        <Show when={phoneScreen()}>{clockLine()}</Show>
        <Show when={!props.closed && props.closesAt !== undefined}>
          <HeaderStatus>
            <RoomTimer
              closesAt={props.closesAt ?? 0}
              closesFor={props.closesFor ?? "lifetime"}
              now={props.now}
            />
          </HeaderStatus>
        </Show>
        <Show when={!props.closed}>
          <InviteLink url={props.inviteUrl} />
        </Show>
        <section class={styles.entrants}>
          <EntrantsHeader
            race={props.race}
            isHost={props.me.isHost && !props.closed}
            watchers={props.closed ? null : (props.watchers ?? 0)}
            send={props.send}
          />
          <EntrantTable
            rows={standings(props.race)}
            started={!beforeStart(props.race) && props.race.startsAt !== null}
            digits={precision.digits()}
            rowActions={rowActions}
            muteButton={props.me.isHost && !props.closed ? muteButton : undefined}
          />
          <Show when={(over() || props.closed) && props.race.entrants.length > 0}>
            <hr class={styles.rule} />
            <h2 class={styles.entrantsTitle}>save results</h2>
            <ResultsExport race={props.race} />
          </Show>
        </section>
      </section>
      <section class={styles.chatCard} data-active={tab() === "chat"} aria-label="chat" ref={chat}>
        {clockLine()}
        <Show when={!props.closed}>
          <FeedLog entries={logLines()} />
          <Show
            when={entered()}
            fallback={
              <Show
                when={beforeStart(props.race)}
                fallback={
                  <div class={styles.row}>
                    <Index each={mainActions()}>{actionButton}</Index>
                  </div>
                }
              >
                <JoinForm
                  initialName={lastName()}
                  onSubmit={(name) => {
                    setLastName(name);
                    props.send({ type: "join", name });
                  }}
                  closedBecause={actions().includes("join") ? null : entryRefusal()}
                  onLimit={() => addNotice(refusalText.badName)}
                />
              </Show>
            }
          >
            <ChatForm
              inputRef={(input) => {
                messageBox = input;
              }}
              onSay={(text) => props.send({ type: "say", text })}
              onCommand={(text) => {
                const command = chatCommand(text, props.race, props.me.entrantId);
                if (command) {
                  props.send(command);
                }
                return command !== null;
              }}
              waitMs={props.chatEveryMs ?? 0}
              muted={props.race.muted.includes(props.me.entrantId)}
            >
              <Index each={mainActions()}>{actionButton}</Index>
            </ChatForm>
          </Show>
        </Show>
      </section>
      <Show when={!props.closed}>
        <nav class={styles.tabBar} aria-label="room cards" ref={tabBar}>
          <button
            type="button"
            class={styles.tabButton}
            aria-pressed={tab() === "race"}
            onClick={() => pickTab("race")}
          >
            room
          </button>
          <button
            type="button"
            class={styles.tabButton}
            aria-pressed={tab() === "chat"}
            onClick={() => pickTab("chat")}
          >
            chat
          </button>
        </nav>
      </Show>
    </main>
  );
}
