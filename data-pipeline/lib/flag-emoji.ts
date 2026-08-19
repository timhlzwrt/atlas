/** Converts an ISO 3166-1 alpha-2 code to its regional-indicator flag emoji. */
export function flagEmoji(iso2: string): string {
  if (iso2.length !== 2) return '\u{1F3F3}️'; // white flag fallback for pseudo-codes
  const codePoints = [...iso2.toUpperCase()].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}
