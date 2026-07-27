import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn, focusRing } from "./utils";

export interface SplitPaneProps {
  /** "horizontal" places the panes side by side. */
  direction?: "horizontal" | "vertical";
  /**
   * Size of the first pane. With unit "ratio" (default) a fraction 0..1 of the
   * container; with unit "px" a width (or height) in CSS pixels.
   */
  ratio: number;
  onRatioChange: (ratio: number) => void;
  /** How `ratio`, `min`, `max` and `step` are measured. */
  unit?: "ratio" | "px";
  min?: number;
  max?: number;
  /** Keyboard step. */
  step?: number;
  /**
   * Hides the first pane and the divider. The second pane stays mounted in the
   * same place in the tree, so toggling never remounts it.
   */
  collapsed?: boolean;
  first: ReactNode;
  second: ReactNode;
  /** Accessible name of the resize handle. */
  separatorLabel?: string;
  className?: string;
}

export function clampRatio(ratio: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, ratio));
}

const DEFAULTS = {
  ratio: { min: 0.1, max: 0.9, step: 0.05 },
  px: { min: 0, max: Number.POSITIVE_INFINITY, step: 16 },
} as const;

/**
 * Two panes with a draggable, keyboard-operable divider (WAI-ARIA window
 * splitter): arrows resize by `step`, Home/End jump to min/max.
 */
export function SplitPane({
  direction = "horizontal",
  ratio,
  onRatioChange,
  unit = "ratio",
  min = DEFAULTS[unit].min,
  max = DEFAULTS[unit].max,
  step = DEFAULTS[unit].step,
  collapsed = false,
  first,
  second,
  separatorLabel = "Resize panes",
  className,
}: SplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Accent only while hovered or dragging. Tracked in state (not CSS :hover)
  // because pointer capture can leave :hover stuck after the drag ends.
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const horizontal = direction === "horizontal";
  const px = unit === "px";
  const value = clampRatio(ratio, min, max);

  const commit = (next: number) => {
    const clamped = clampRatio(next, min, max);
    onRatioChange(px ? Math.round(clamped) : Math.round(clamped * 1000) / 1000);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const decrease = horizontal ? "ArrowLeft" : "ArrowUp";
    const increase = horizontal ? "ArrowRight" : "ArrowDown";
    let next: number | null = null;
    if (event.key === decrease) next = value - step;
    else if (event.key === increase) next = value + step;
    else if (event.key === "Home") next = min;
    else if (event.key === "End" && Number.isFinite(max)) next = max;
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
    setDragging(true);
    const onMove = (move: globalThis.PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const offset = horizontal ? move.clientX - rect.left : move.clientY - rect.top;
      const position = px ? offset : offset / (horizontal ? rect.width : rect.height);
      if (Number.isFinite(position)) commit(position);
    };
    const onUp = (up: globalThis.PointerEvent) => {
      handle.releasePointerCapture(up.pointerId);
      setDragging(false);
      // The browser re-fires pointerenter if the pointer is still over us.
      setHovered(false);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  const toAria = (n: number) => (px ? Math.round(n) : Math.round(n * 100));

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full min-h-0 w-full min-w-0", horizontal ? "flex-row" : "flex-col", className)}
    >
      {!collapsed && (
        <div
          className="min-h-0 min-w-0 overflow-hidden"
          style={{ flexBasis: px ? `${value}px` : `${value * 100}%`, flexGrow: 0, flexShrink: 0 }}
        >
          {first}
        </div>
      )}
      {!collapsed && (
        <div
          role="separator"
          tabIndex={0}
          aria-label={separatorLabel}
          aria-orientation={horizontal ? "vertical" : "horizontal"}
          aria-valuenow={toAria(value)}
          aria-valuemin={toAria(min)}
          aria-valuemax={Number.isFinite(max) ? toAria(max) : undefined}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          className={cn(
            // z-index keeps the 8px hit area (::before, centred on the 1px
            // line) above the adjacent panes.
            "relative z-[var(--z-divider)] shrink-0 transition-colors duration-150 ease-out focus-visible:bg-accent",
            hovered || dragging ? "bg-accent" : "bg-border",
            horizontal
              ? "w-px cursor-col-resize before:absolute before:inset-y-0 before:-inset-x-[3.5px] before:content-['']"
              : "h-px cursor-row-resize before:absolute before:inset-x-0 before:-inset-y-[3.5px] before:content-['']",
            focusRing
          )}
        />
      )}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>
    </div>
  );
}
