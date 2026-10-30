import type { JSX } from "solid-js";
import { maxNameLength } from "../../shared/race/race.ts";
import { Button } from "../primitives/button.tsx";
import { type Status, StatusBadge } from "../primitives/status-badge.tsx";
import { TextField } from "../primitives/text-field.tsx";

export interface CatalogEntry {
  title: string;
  render: () => JSX.Element;
}

const statuses: Status[] = ["open", "countdown", "running", "done", "forfeit"];

export const catalogEntries: CatalogEntry[] = [
  {
    title: "button",
    render: () => (
      <>
        <Button>.ready</Button>
        <Button variant="ghost">copy</Button>
        <Button variant="danger">.quit</Button>
        <Button disabled>.done</Button>
      </>
    ),
  },
  {
    title: "text field",
    render: () => <TextField label="your name" maxLength={maxNameLength} />,
  },
  {
    title: "status badge",
    render: () => statuses.map((status) => <StatusBadge status={status} />),
  },
];
