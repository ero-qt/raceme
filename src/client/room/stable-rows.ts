import type { Standing } from "../../shared/race/race.ts";

function sameRow(a: Standing, b: Standing): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.ready === b.ready &&
    a.place === b.place &&
    a.result?.kind === b.result?.kind &&
    (a.result?.kind !== "done" || b.result?.kind !== "done" || a.result.timeMs === b.result.timeMs)
  );
}

/**
 * Keeps the previous row object for every entrant whose row reads the same, so a keyed list
 * rebuilds only the rows that changed and the rest keep their DOM and focus.
 */
export function stableRows(previous: Standing[], next: Standing[]): Standing[] {
  const before = new Map(previous.map((row) => [row.id, row]));
  const rows = next.map((row) => {
    const old = before.get(row.id);
    return old && sameRow(old, row) ? old : row;
  });
  return rows.every((row, index) => row === previous[index]) && rows.length === previous.length
    ? previous
    : rows;
}
