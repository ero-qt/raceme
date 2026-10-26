// Posts once at each of these, so a busy evening sends a handful of messages and not hundreds.
const levels = [5, 10, 25, 50, 100, 250, 500, 1000];

const labels = { rooms: "rooms open", people: "people online" } as const;

export type AlertKind = keyof typeof labels;

/** Tells the owner when the number of open rooms or people online climbs past a level. */
export class SpikeAlerts {
  readonly #reached: Record<AlertKind, number> = { rooms: 0, people: 0 };

  constructor(readonly send: (text: string) => void) {}

  update(kind: AlertKind, count: number): void {
    const level = levels.findLast((candidate) => candidate <= count) ?? 0;
    if (level > this.#reached[kind]) {
      this.send(`raceme: ${level} ${labels[kind]}`);
    }
    this.#reached[kind] = level;
  }
}
