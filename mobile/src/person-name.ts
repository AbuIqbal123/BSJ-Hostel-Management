/**
 * First given name for home greetings.
 * Keeps "Welcome, …" on one line instead of orphaning a surname.
 */
export function welcomeName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return trimmed;
  }
  const first = trimmed.split(/\s+/)[0];
  return first ?? trimmed;
}
