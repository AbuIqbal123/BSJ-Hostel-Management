import { useEffect, useState } from "react";

/** Commit `value` after `ms` of quiet. Used for list search fields. */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [committed, setCommitted] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setCommitted(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return committed;
}
