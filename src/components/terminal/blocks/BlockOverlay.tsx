import { useRef, type ReactNode } from "react";
import type { Terminal } from "@xterm/xterm";
import type { Block, BlockTracker } from "../../../lib/blocks/block-tracker";
import { inlineDurationFits, visibleBlocks } from "../../../lib/blocks/layout";
import { formatDuration } from "../../../lib/format";
import { Spinner, Tooltip, cn } from "../../../ui";
import { measureScreen, useBlockFrame, type ScreenGeometry } from "./use-block-frame";

/** Gutter width left of the screen; matches the pane's `pl-5` padding. */
const GUTTER = 20;
/** Room between the selection's left border and the text. */
const SELECTION_INSET = 8;

export interface BlockOverlayProps {
  term: Terminal;
  tracker: BlockTracker;
  showGutter: boolean;
  showDurations: boolean;
  /**
   * Toolbar for the hovered block, positioned by the overlay. `duration` is the block's duration
   * label when the prompt line has no room to show it, else null.
   */
  renderToolbar?: (block: Block, duration: string | null) => ReactNode;
  /** Block under the mouse (the pane tracks it from mouse moves over the terminal). */
  hoveredId?: string | null;
  /** Called after a gutter click changed the selection, to hand focus back to the terminal. */
  onGutterClick?: () => void;
  /** Tests: where the screen sits. */
  measure?: (root: HTMLElement, term: Terminal) => ScreenGeometry | null;
}

/** Whether the block's prompt line has room for its duration label at the right. */
function durationFitsInline(term: Terminal, block: Block, label: string): boolean {
  const buf = term.buffer.active;
  const line = buf.getLine(block.promptStart.line);
  if (!line) return false;
  const wrapped = !!buf.getLine(block.promptStart.line + 1)?.isWrapped;
  return inlineDurationFits(line.translateToString(true).length, wrapped, term.cols, label);
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
          const durationLabel = showDurations && duration !== null ? formatDuration(duration) : null;
          const inlineDuration =
            durationLabel !== null && promptVisible && durationFitsInline(term, block, durationLabel);
          return (
            <div key={block.id}>
              {selected.has(block.id) && (
                <div
                  data-testid="block-selection"
                  className="absolute border-l-2 border-accent bg-accent-subtle/60"
                  style={{ top: y, height, left: g.left - SELECTION_INSET, width: g.width + SELECTION_INSET }}
                />
              )}
              {showGutter && showMark && (
                <Tooltip
                  content={durationLabel ? `${statusLabel(block)} in ${durationLabel}` : statusLabel(block)}
                  side="right"
                >
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
              {inlineDuration && (
                <span
                  className="absolute text-right font-mono text-2xs text-fg-muted"
                  style={{ top: y, height: g.cellHeight, left: g.left, width: g.width - 4 }}
                >
                  {durationLabel}
                </span>
              )}
              {renderToolbar && hoveredId === block.id && (
                <div
                  className="pointer-events-auto absolute flex justify-end"
                  style={{ top: Math.max(y - 2, g.top), left: g.left, width: g.width - 4 }}
                >
                  {renderToolbar(block, inlineDuration ? null : durationLabel)}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
