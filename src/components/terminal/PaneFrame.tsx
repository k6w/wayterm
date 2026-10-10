import type { CSSProperties, ReactNode } from "react";
import { useSettingsStore } from "../../stores/settings";

interface PaneFrameProps {
  /** This pane has focus. */
  active: boolean;
  /** The tab has more than one pane (a single pane is never dimmed). */
  split: boolean;
  children: ReactNode;
}

/**
 * Wraps every pane (terminal, SSH, SFTP, serial) in the same glass backing as
 * the sidebar, so panes look identical whatever their type or focus. In a
 * split, unfocused panes are dimmed. Unfocused panes are dimmed by a non-interactive
 * scrim (strength from the Appearance settings), so the focused pane stands
 * out without a border. The fade is 150ms and is disabled under
 * prefers-reduced-motion (global rule in styles.css). With dimming off no
 * scrim is rendered.
 */
export default function PaneFrame({ active, split, children }: PaneFrameProps) {
  const enabled = useSettingsStore((s) => s.settings.appearance.dimInactivePanes);
  const strength = useSettingsStore((s) => s.settings.appearance.inactivePaneDim);
  const dimmed = split && !active;
  return (
    <div data-pane-frame data-active={active || undefined} className="group/pane wt-blur relative h-full w-full bg-panel-glass">
      {children}
      {enabled && (
        <div
          aria-hidden
          data-testid="pane-dim"
          style={{ "--wt-dyn-pane-dim": dimmed ? strength : 0 } as CSSProperties}
          className="pointer-events-none absolute inset-0 z-[5] bg-canvas opacity-(--wt-dyn-pane-dim) transition-opacity duration-150 ease-out"
        />
      )}
    </div>
  );
}
