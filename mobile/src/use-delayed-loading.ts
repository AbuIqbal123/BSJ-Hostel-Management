import { useEffect, useRef, useState } from "react";

type DelayedLoadingOptions = {
  delayMs?: number;
  minVisibleMs?: number;
};

/**
 * A list skeleton waits `delayMs` before it appears. A load that finishes
 * sooner leaves the previous content on screen. Once the skeleton is up it
 * stays for `minVisibleMs`, so it does not flash. Callers show an error
 * themselves, ahead of this flag.
 */
export function useDelayedLoading(isLoading: boolean, options: DelayedLoadingOptions = {}): boolean {
  const delayMs = options.delayMs ?? 200;
  const minVisibleMs = options.minVisibleMs ?? 400;
  const [visible, setVisible] = useState(false);
  const shownAt = useRef<number | null>(null);
  const visibleRef = useRef(false);

  useEffect(() => {
    if (isLoading) {
      if (visibleRef.current) {
        return;
      }
      const show = setTimeout(() => {
        shownAt.current = Date.now();
        visibleRef.current = true;
        setVisible(true);
      }, delayMs);
      return () => clearTimeout(show);
    }
    if (!visibleRef.current) {
      return;
    }
    const elapsed = shownAt.current === null ? minVisibleMs : Date.now() - shownAt.current;
    const hide = setTimeout(() => {
      shownAt.current = null;
      visibleRef.current = false;
      setVisible(false);
    }, Math.max(0, minVisibleMs - elapsed));
    return () => clearTimeout(hide);
  }, [isLoading, delayMs, minVisibleMs]);

  return visible;
}
