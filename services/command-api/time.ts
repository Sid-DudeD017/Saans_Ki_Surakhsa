// Every timestamp Saans sends is ISO 8601 in India time with the +05:30 offset (CONVENTIONS.md).
const IST_MS = (5 * 60 + 30) * 60 * 1000;

export function indiaTime(at: Date): string {
  return new Date(at.getTime() + IST_MS).toISOString().replace(/\.\d{3}Z$/, "+05:30");
}
