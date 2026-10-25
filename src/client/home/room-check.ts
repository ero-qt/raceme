import { type Accessor, createEffect, createSignal, on, onCleanup } from "solid-js";
import { parseRoomCode } from "./room-code.ts";

const defaultCheckDelayMs = 300;

/** Asks the server whether a room with this code is live. */
async function askServer(slug: string): Promise<boolean> {
  const response = await fetch(`${import.meta.env.BASE_URL}api/rooms/${slug}`);
  if (!response.ok) {
    throw new Error(`Room check failed with ${response.status}.`);
  }

  return ((await response.json()) as { exists: boolean }).exists;
}

export interface RoomCheck {
  /** Gives the room code from the text once the server confirmed the room is live. */
  confirmed: Accessor<string | null>;
  /** Checks a code right away, giving `null` when the check itself failed. */
  checkNow: (slug: string) => Promise<boolean | null>;
}

/**
 * Checks text shaped like a room code with the server once typing pauses, since a goal like
 * `glitchless` has the same shape as a code.
 */
export function useRoomCheck(
  text: Accessor<string>,
  options: { roomExists?: (slug: string) => Promise<boolean>; delayMs?: number },
): RoomCheck {
  const [confirmed, setConfirmed] = createSignal<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const checkNow = async (slug: string): Promise<boolean | null> => {
    clearTimeout(timer);
    try {
      const exists = await (options.roomExists ?? askServer)(slug);
      if (parseRoomCode(text()) === slug) {
        setConfirmed(exists ? slug : null);
      }
      return exists;
    } catch {
      return null;
    }
  };

  createEffect(
    on(text, (value) => {
      clearTimeout(timer);
      const slug = parseRoomCode(value);
      if (!slug) {
        setConfirmed(null);
        return;
      }

      timer = setTimeout(() => void checkNow(slug), options.delayMs ?? defaultCheckDelayMs);
    }),
  );

  return { confirmed, checkNow };
}
