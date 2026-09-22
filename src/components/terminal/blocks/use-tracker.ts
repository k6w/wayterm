import { useCallback, useSyncExternalStore } from "react";
import type { BlockTracker } from "../../../lib/blocks/block-tracker";

const noop = () => () => {};

/** Re-renders whenever `tracker` changes; returns its version (0 without a tracker). */
export function useTrackerVersion(tracker: BlockTracker | null): number {
  const subscribe = useCallback((fn: () => void) => (tracker ? tracker.subscribe(fn) : noop()), [tracker]);
  return useSyncExternalStore(subscribe, () => tracker?.version ?? 0);
}
