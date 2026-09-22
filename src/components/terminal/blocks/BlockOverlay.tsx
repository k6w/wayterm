import { useRef, type ReactNode } from "react";
import type { Terminal } from "@xterm/xterm";
import type { Block, BlockTracker } from "../../../lib/blocks/block-tracker";
import { visibleBlocks } from "../../../lib/blocks/layout";
import { formatDuration } from "../../../lib/format";
import { Spinner, Tooltip, cn } from "../../../ui";
import { measureScreen, useBlockFrame, type ScreenGeometry } from "./use-block-frame";

/** Gutter width left of the screen; matches the pane's `pl-5` padding. */
const GUTTER = 20;

export interface BlockOverlayProps {
  term: Terminal;
  tracker: BlockTracker;
  showGutter: boolean;
  showDurations: boolean;
  /** Toolbar for the hovered block, positioned by the overlay. */
  renderToolbar?: (block: Block) => ReactNode;
  /** Block under the mouse (the pane tracks it from mouse moves over the terminal). */
  hoveredId?: string | null;
  /** Called after a gutter click changed the selection, to hand focus back to the terminal. */
  onGutterClick?: () => void;
  /** Tests: where the screen sits. */
  measure?: (root: HTMLElement, term: Terminal) => ScreenGeometry | null;
}

function statusLabel(block: Block): string {
  if (block.state === "running") return "Running";
  if (block.exitCode === undefined) return "Finished";
  return block.exitCode === 0 ? "Succeeded" : `Failed with exit code ${block.exitCode}`;
}

/**
 * Command blocks drawn over a terminal pane: status marks in the gutter, durations, the
 * selection and the hovered block's toolbar. Markers are the source of truth; only
 * visible blocks are rendered. Hidden on the alternate screen (vim, less).
 */
export function BlockOverlay({
  term,
  tracker,
  showGutter,
  showDurations,
  renderToolbar,
  hoveredId = null,
  onGutterClick,
  measure = measureScreen,
}: BlockOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frame = useBlockFrame(term, tracker, rootRef, measure);
  const g = frame.geometry;
  const items = g && !frame.alternate ? visibleBlocks(tracker.blocks, frame.viewportY, frame.rows, frame.cursorLine) : [];
  const selected = new Set(tracker.selection.map((b) => b.id));

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" data-testid="block-overlay">
      {g &&
        items.map(({ block, top, rows }) => {
          const y = g.top + Math.max(top, 0) * g.cellHeight;
          const height = (rows + Math.min(top, 0)) * g.cellHeight;
          const promptVisible = top >= 0;
          const done = block.state === "done";
          const failed = done && block.exitCode !== undefined && block.exitCode !== 0;
          const duration =
            done && block.startedAt !== undefined && block.endedAt !== undefined ? block.endedAt - block.startedAt : null;
          const showMark = block.state === "running" || done;
          return (
            <div key={block.id}>
              {selected.has(block.id) && (
                <div
                  data-testid="block-selection"
                  className="absolute border-l-2 border-accent bg-accent-subtle/60"
                  style={{ top: y, height, left: g.left - 4, width: g.width + 4 }}
                />
              )}
              {showGutter && showMark && (
                <Tooltip content={statusLabel(block)} side="right">
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Command block: ${statusLabel(block)}`}
                    className="pointer-events-auto absolute flex justify-center"
                    style={{ top: y, height, left: g.left - GUTTER + 2, width: GUTTER - 6 }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      tracker.select(block, event.shiftKey);
                      onGutterClick?.();
                    }}
                  >
                    {block.state === "running" ? (
                      promptVisible && <Spinner size={14} label="Running" className="mt-px" />
                    ) : (
                      <span
                        className={cn(
                          "my-0.5 w-0.5 rounded-full",
                          failed ? "bg-danger" : block.exitCode === 0 ? "bg-success" : "bg-fg-muted",
                        )}
                      />
                    )}
                  </button>
                </Tooltip>
              )}
              {showDurations && duration !== null && promptVisible && (
                <span
                  className="absolute text-right font-mono text-2xs text-fg-muted"
                  style={{ top: y, height: g.cellHeight, left: g.left, width: g.width - 4 }}
                >
                  {formatDuration(duration)}
                </span>
              )}
              {renderToolbar && hoveredId === block.id && (
                <div
                  className="pointer-events-auto absolute flex justify-end"
                  style={{ top: Math.max(y - 2, g.top), left: g.left, width: g.width - 4 }}
                >
                  {renderToolbar(block)}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
