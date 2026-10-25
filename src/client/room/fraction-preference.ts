import { type Accessor, createSignal } from "solid-js";
import type { FractionDigits } from "../../shared/format-time.ts";

const key = "raceme.fractionDigits";

/** Reads the viewer's own time precision. `null` means the room default applies. */
export function loadFractionDigits(): FractionDigits | null {
  try {
    const stored = Number(localStorage.getItem(key) ?? Number.NaN);
    return stored === 0 || stored === 1 || stored === 2 || stored === 3 ? stored : null;
  } catch {
    return null;
  }
}

/** Forgets the viewer's own pick so the room default applies again. */
export function clearFractionDigits(): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage that refuses access has no pick to forget.
  }
}

export function saveFractionDigits(digits: FractionDigits): void {
  try {
    localStorage.setItem(key, String(digits));
  } catch {
    // Private windows may refuse storage. The pick then lasts for this page only.
  }
}

/**
 * Picks the clock's precision: the viewer's own pick when there is one, else the room default.
 * The host's pick sets the room default and drops their own older pick.
 */
export function useFractionDigits(room: {
  roomDefault: Accessor<FractionDigits>;
  isHost: Accessor<boolean>;
  setRoomDefault: (digits: FractionDigits) => void;
}): { digits: Accessor<FractionDigits>; pick: (digits: FractionDigits) => void } {
  const [own, setOwn] = createSignal(loadFractionDigits());
  const digits = () => own() ?? room.roomDefault();

  const pick = (picked: FractionDigits) => {
    if (room.isHost()) {
      room.setRoomDefault(picked);
      clearFractionDigits();
      setOwn(null);
      return;
    }

    saveFractionDigits(picked);
    setOwn(picked);
  };

  return { digits, pick };
}
