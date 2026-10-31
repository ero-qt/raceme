export type RoomTab = "race" | "chat";

function tabKey(slug: string): string {
  return `raceme.tab.${slug}`;
}

/** Reads the tab a phone showed last for this room. `null` means the room decides. */
export function loadTab(slug: string): RoomTab | null {
  try {
    const stored = sessionStorage.getItem(tabKey(slug));
    return stored === "race" || stored === "chat" ? stored : null;
  } catch {
    return null;
  }
}

export function saveTab(slug: string, tab: RoomTab): void {
  try {
    sessionStorage.setItem(tabKey(slug), tab);
  } catch {
    // Private windows may refuse storage. The pick then lasts for this page only.
  }
}
