import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn, focusRing } from "./utils";

export interface SplitPaneProps {
  /** "horizontal" places the panes side by side. */
  direction?: "horizontal" | "vertical";
  /** Size of the first pane, 0..1. */
  ratio: number;
  onRatioChange: (ratio: number) => void;
  min?: number;
  max?: number;
  /** Keyboard step. */
  step?: number;
  first: ReactNode;
  second: ReactNode;
  /** Accessible name of the resize handle. */
  separatorLabel?: string;
  className?: string;
}

export function clampRatio(ratio: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, ratio));
}

/**
 * Two panes with a draggable, keyboard-operable divider (WAI-ARIA window
 * splitter): arrows resize by `step`, Home/End jump to min/max.
 */
export function SplitPane({
  direction = "horizontal",
  ratio,
  onRatioChange,
  min = 0.1,
  max = 0.9,
  step = 0.05,
  first,
  second,
  separatorLabel = "Resize panes",
  className,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const horizontal = direction === "horizontal";
  const value = clampRatio(ratio, min, max);

  const commit = (next: number) => {
    onRatioChange(Math.round(clampRatio(next, min, max) * 1000) / 1000);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const decrease = horizontal ? "ArrowLeft" : "ArrowUp";
    const increase = horizontal ? "ArrowRight" : "ArrowDown";
    let next: number | null = null;
    if (event.key === decrease) next = value - step;
    else if (event.key === increase) next = value + step;
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    if (next === null) return;
    event.preventDefault();
    commit(next);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const onMove = (move: globalThis.PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const position = horizontal
        ? (move.clientX - rect.left) / rect.width
        : (move.clientY - rect.top) / rect.height;
      if (Number.isFinite(position)) commit(position);
    };
    const onUp = (up: globalThis.PointerEvent) => {
      handle.releasePointerCapture(up.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full min-h-0 w-full min-w-0", horizontal ? "flex-row" : "flex-col", className)}
    >
      <div
        className="min-h-0 min-w-0 overflow-hidden"
        style={{ flexBasis: `${value * 100}%`, flexGrow: 0, flexShrink: 0 }}
      >
        {first}
      </div>
      <div
        role="separator"
        tabIndex={0}
        aria-label={separatorLabel}
        aria-orientation={horizontal ? "vertical" : "horizontal"}
        aria-valuenow={Math.round(value * 100)}
        aria-valuemin={Math.round(min * 100)}
        aria-valuemax={Math.round(max * 100)}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        className={cn(
          "relative shrink-0 bg-border transition-colors duration-150 ease-out hover:bg-accent focus-visible:bg-accent",
          horizontal
            ? "w-px cursor-col-resize before:absolute before:inset-y-0 before:-left-1 before:-right-1"
            : "h-px cursor-row-resize before:absolute before:inset-x-0 before:-top-1 before:-bottom-1",
          focusRing
        )}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>
    </div>
  );
}
