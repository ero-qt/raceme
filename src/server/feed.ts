import type { FeedEntry, NewFeedEntry } from "../shared/feed-entry.ts";

/** Keeps the newest `capacity` lines of a room's chat log in memory. */
export class Feed {
  #entries: FeedEntry[] = [];
  #nextId = 1;

  constructor(readonly capacity: number) {}

  get entries(): readonly FeedEntry[] {
    return this.#entries;
  }

  /** Gives the lines after `id`, so a reconnecting client only gets what it missed. */
  after(id: number): FeedEntry[] {
    return this.#entries.filter((entry) => entry.id > id);
  }

  /** Adds lines and returns them with their ids. */
  add(lines: NewFeedEntry[]): FeedEntry[] {
    const added = lines.map((line) => ({ ...line, id: this.#nextId++ }) as FeedEntry);
    this.#entries = [...this.#entries, ...added].slice(-this.capacity);
    return added;
  }
}
