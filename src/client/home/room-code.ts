const roomCode = /^[a-z2-7]{10}$/;

/** Reads a room code from what someone typed or pasted, a bare code or a whole invite link. */
export function parseRoomCode(input: string): string | null {
  const last = input.trim().toLowerCase().split("/").at(-1) ?? "";
  return roomCode.test(last) ? last : null;
}
