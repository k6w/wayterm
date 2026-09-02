import type { ReactNode } from "react";

interface PaneFrameProps {
  /** This pane has focus. */
  active: boolean;
  /** The tab has more than one pane (a single pane is never dimmed). */
  split: boolean;
  children: ReactNode;
}

/**
 * Wraps one pane of a split. Unfocused panes are dimmed by a non-interactive
 * scrim, so the focused pane stands out without a border. The fade is 150ms
 * and is disabled under prefers-reduced-motion (global rule in styles.css).
 */
export default function PaneFrame({ active, split, children }: PaneFrameProps) {
  const dimmed = split && !active;
  return (
    <div data-pane-frame data-active={active || undefined} className="group/pane relative h-full w-full">
      {children}
      <div
        aria-hidden
        data-testid="pane-dim"
        className={`pointer-events-none absolute inset-0 z-[5] bg-canvas transition-opacity duration-150 ease-out ${
          dimmed ? "opacity-30" : "opacity-0"
        }`}
      />
    </div>
  );
}
