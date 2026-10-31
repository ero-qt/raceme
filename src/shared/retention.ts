// The privacy notice quotes these, so the server and the notice can't drift apart.

/** Keeps the session cookie this many days. */
export const sessionCookieDays = 30;

/** Keeps a room open this many days at most. The host cookie lives as long. */
export const roomLifetimeDays = 2;

/** Keeps speedrun.com's category lists in memory this many hours, the longest of any answer. */
export const catalogCacheHours = 24;

/** Keeps this many of a room's newest log lines, on the server and for a browser's own notices. */
export const feedCapacity = 200;
