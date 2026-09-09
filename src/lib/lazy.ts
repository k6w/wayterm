import { lazy, useRef, type ComponentType, type LazyExoticComponent } from "react";

export type PreloadableLazy<P> = LazyExoticComponent<ComponentType<P>> & {
  /** Start fetching the chunk without rendering. Safe to call repeatedly. */
  preload: () => Promise<unknown>;
};

/** React.lazy plus a preload() so hover and idle handlers can warm the chunk. */
export function lazyWithPreload<P extends object>(
  factory: () => Promise<{ default: ComponentType<P> }>
): PreloadableLazy<P> {
  let pending: Promise<{ default: ComponentType<P> }> | null = null;
  const load = () => (pending ??= factory());
  const Component = lazy(load) as PreloadableLazy<P>;
  Component.preload = () =>
    load().catch(() => {
      pending = null;
    });
  return Component;
}

/** Run `task` once the main thread is idle (falls back to a short timeout). */
export function whenIdle(task: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  if (ric) ric(task, { timeout: 4000 });
  else setTimeout(task, 1500);
}

/** True from the first render where `value` is true onward, so a lazy dialog mounts on first open and stays mounted. */
export function useEverTrue(value: boolean): boolean {
  const seen = useRef(false);
  if (value) seen.current = true;
  return seen.current;
}
