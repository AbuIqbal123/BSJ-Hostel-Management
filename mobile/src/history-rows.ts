/** Keeps the first copy of each history id. A later page must not repeat a row already shown. */
export function mergeHistoryRows<T extends { id: string }>(current: T[], more: T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  const added = more.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
  return added.length === 0 ? current : [...current, ...added];
}
