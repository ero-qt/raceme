/** Represents one line of a room's chat log, posted by RaceBot or by an entrant. */
export type FeedEntry =
  | { id: number; at: number; kind: "bot"; text: string }
  | { id: number; at: number; kind: "chat"; name: string; text: string };

export type NewFeedEntry = FeedEntry extends infer E
  ? E extends FeedEntry
    ? Omit<E, "id">
    : never
  : never;
