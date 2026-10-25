// Control, invisible format and line separator characters can fake log lines, flip text
// direction or hide inside a name that looks like someone else's.
const hiddenCharacters = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

/** Strips characters that can disguise text and trims the rest. */
export function cleanText(text: string): string {
  return text.replace(hiddenCharacters, "").trim();
}
