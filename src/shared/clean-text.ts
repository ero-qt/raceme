// Control, invisible format and line separator characters can fake log lines, flip text
// direction or hide inside a name that looks like someone else's. The zero width joiner stays
// between 2 emoji because it glues sequences like a family into one picture.
const hiddenCharacters =
  /[\p{Cc}\p{Zl}\p{Zp}]|(?!\u200d)\p{Cf}|(?<!\p{Extended_Pictographic}[\u{FE0F}\u{1F3FB}-\u{1F3FF}]?)\u200d|\u200d(?!\p{Extended_Pictographic})/gu;

/** Strips characters that can disguise text and trims the rest. */
export function cleanText(text: string): string {
  return text.replace(hiddenCharacters, "").trim();
}
