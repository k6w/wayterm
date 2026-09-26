import { useEffect, useState, type RefObject } from "react";
import type { Terminal } from "@xterm/xterm";
import type { BlockTracker } from "../../../lib/blocks/block-tracker";

/** Where the xterm screen sits inside the overlay, in CSS pixels. */
export interface ScreenGeometry {
  left: number;
  top: number;
  width: number;
  cellHeight: number;
}

export interface BlockFrame {
  viewportY: number;
  rows: number;
  cursorLine: number;
  alternate: boolean;
  version: number;
  geometry: ScreenGeometry | null;
}

/** Measures `.xterm-screen` relative to `root`; null while it is not laid out. */
export function measureScreen(root: HTMLElement, term: Terminal): ScreenGeometry | null {
  const screen = term.element?.querySelector(".xterm-screen");
  if (!screen || term.rows === 0) return null;
  const s = screen.getBoundingClientRect();
  const r = root.getBoundingClientRect();
  if (s.height === 0) return null;
  return { left: s.left - r.left, top: s.top - r.top, width: s.width, cellHeight: s.height / term.rows };
}

/** Buffer line under a viewport y coordinate, or null outside the screen. */
export function lineAtClientY(term: Terminal, clientY: number): number | null {
  const screen = term.element?.querySelector(".xterm-screen");
  if (!screen || term.rows === 0) return null;
  const s = screen.getBoundingClientRect();
  if (s.height === 0 || clientY < s.top || clientY >= s.bottom) return null;
  const row = Math.floor((clientY - s.top) / (s.height / term.rows));
  return term.buffer.active.viewportY + row;
}

function readFrame(
  term: Terminal,
  tracker: BlockTracker,
  root: HTMLElement | null,
  measure: (root: HTMLElement, term: Terminal) => ScreenGeometry | null,
): BlockFrame {
  const buf = term.buffer.active;
  return {
    viewportY: buf.viewportY,
    rows: term.rows,
    cursorLine: buf.baseY + buf.cursorY,
    alternate: buf.type === "alternate",
    version: tracker.version,
    geometry: root ? measure(root, term) : null,
  };
}

function sameFrame(a: BlockFrame, b: BlockFrame): boolean {
  const ga = a.geometry;
  const gb = b.geometry;
  const sameGeometry =
    ga === gb ||
    (!!ga && !!gb && ga.left === gb.left && ga.top === gb.top && ga.width === gb.width && ga.cellHeight === gb.cellHeight);
  return (
    sameGeometry &&
    a.viewportY === b.viewportY &&
    a.rows === b.rows &&
    a.cursorLine === b.cursorLine &&
    a.alternate === b.alternate &&
    a.version === b.version
  );
}

/**
 * Viewport, cursor and screen position for the block overlay, re-read at most once per animation
 * frame after the terminal scrolls, renders, resizes or the blocks change. Re-renders only on change.
 */
export function useBlockFrame(
  term: Terminal,
  tracker: BlockTracker,
  rootRef: RefObject<HTMLElement | null>,
  measure: (root: HTMLElement, term: Terminal) => ScreenGeometry | null = measureScreen,
): BlockFrame {
  const [frame, setFrame] = useState(() => readFrame(term, tracker, rootRef.current, measure));

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const next = readFrame(term, tracker, rootRef.current, measure);
      setFrame((prev) => (sameFrame(prev, next) ? prev : next));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const disposables = [
      term.onScroll(schedule),
      term.onRender(schedule),
      term.onResize(schedule),
      term.buffer.onBufferChange(schedule),
    ];
    const unsubscribe = tracker.subscribe(schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (observer && rootRef.current) observer.observe(rootRef.current);
    schedule();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      for (const d of disposables) d.dispose();
      unsubscribe();
      observer?.disconnect();
    };
  }, [term, tracker, rootRef, measure]);

  return frame;
}
