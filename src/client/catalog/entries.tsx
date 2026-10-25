import type { JSX } from "solid-js";
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
    title: "Button",
    render: () => (
      <>
        <Button>.ready</Button>
        <Button variant="ghost">Copy</Button>
        <Button variant="danger">.quit</Button>
        <Button disabled>.done</Button>
      </>
    ),
  },
  {
    title: "Text field",
    render: () => <TextField label="Your name" maxLength={24} />,
  },
  {
    title: "Status badge",
    render: () => statuses.map((status) => <StatusBadge status={status} />),
  },
];
