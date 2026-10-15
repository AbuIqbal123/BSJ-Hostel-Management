const listeners = new Set<() => void>();

/** Home, the staff bell, and the notification list subscribe. A foreground push calls this once. */
export function onHallRefresh(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function hallRefresh(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}
