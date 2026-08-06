/** Normalise scanner input to a canonical EAN, or null if it is not an EAN. */
export function canonicalEan(raw: string): string | null {
  const s = raw.trim();
  if (!/^\d{8,14}$/.test(s)) return null;
  const stripped = s.replace(/^0+/, '');
  return stripped.length >= 1 ? stripped : null;
}
