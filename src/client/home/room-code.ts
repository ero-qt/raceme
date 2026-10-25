const roomCode = /^[a-z2-7]{10}$/;
// Only the last part of a link's path counts, so a 10-letter word before it isn't taken as the code.
const linkedCode = /\/([a-z2-7]{10})\/?(?=$|[?#\s.,!;:)\]])/;
// Chat apps and sentences often leave a dot or bracket right after a pasted code.
const trailingPunctuation = /[.,!?;:)\]]+$/;

/** Reads a room code from what someone typed or pasted, a bare code or a whole invite link. */
export function parseRoomCode(input: string): string | null {
  const text = input.trim().toLowerCase();
  const linked = linkedCode.exec(text)?.[1];
  if (linked) {
    return linked;
  }

  const bare = text.replace(trailingPunctuation, "");
  return roomCode.test(bare) ? bare : null;
}
