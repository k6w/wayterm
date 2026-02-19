import { useState, useCallback, useRef, useEffect } from "react";
import type { SplitNode } from "../../types/terminal";
import { useTerminalStore } from "../../stores/terminal";
import TerminalPane from "./TerminalPane";

interface SplitContainerProps {
  node: SplitNode;
  depth?: number;
}

export { SplitContainer };

export default function SplitContainer({
  node,
  depth = 0,
}: SplitContainerProps) {
  const activePaneId = useTerminalStore((s) => s.activePaneId);

  if (node.type === "pane" && node.paneId) {
    return (
      <TerminalPane
        paneId={node.paneId}
        isActive={activePaneId === node.paneId}
      />
    );
  }

  if (
    node.type === "split" &&
    node.children &&
    node.direction &&
    node.ratio !== undefined
  ) {
    return (
      <SplitView
        direction={node.direction}
        initialRatio={node.ratio}
        first={node.children[0]}
        second={node.children[1]}
        depth={depth}
      />
    );
  }

  return null;
}

interface SplitViewProps {
  direction: "horizontal" | "vertical";
  initialRatio: number;
  first: SplitNode;
  second: SplitNode;
  depth: number;
}

function SplitView({
  direction,
  initialRatio,
  first,
  second,
  depth,
}: SplitViewProps) {
  const [ratio, setRatio] = useState(initialRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const isHorizontal = direction === "horizontal";

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!draggingRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let newRatio: number;
        if (isHorizontal) {
          newRatio = (moveEvent.clientX - rect.left) / rect.width;
        } else {
          newRatio = (moveEvent.clientY - rect.top) / rect.height;
        }
        setRatio(Math.min(Math.max(newRatio, 0.1), 0.9));
      };

      const onMouseUp = () => {
        draggingRef.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = isHorizontal
        ? "col-resize"
        : "row-resize";
      document.body.style.userSelect = "none";
    },
    [isHorizontal]
  );

  useEffect(() => {
    return () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  const firstPercent = `${ratio * 100}%`;
  const secondPercent = `${(1 - ratio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full ${isHorizontal ? "flex-row" : "flex-col"}`}
    >
      <div
        className="overflow-hidden"
        style={{
          flexBasis: firstPercent,
          flexGrow: 0,
          flexShrink: 0,
        }}
      >
        <SplitContainer node={first} depth={depth + 1} />
      </div>
      <div
        onMouseDown={handleMouseDown}
        className={`shrink-0 bg-transparent transition-all duration-150 hover:bg-accent/50 hover:shadow-[0_0_8px_rgba(82,139,255,0.3)] ${
          isHorizontal
            ? "w-1 hover:w-1.5 cursor-col-resize"
            : "h-1 hover:h-1.5 cursor-row-resize"
        }`}
      />
      <div
        className="overflow-hidden"
        style={{
          flexBasis: secondPercent,
          flexGrow: 0,
          flexShrink: 0,
        }}
      >
        <SplitContainer node={second} depth={depth + 1} />
      </div>
    </div>
  );
}
