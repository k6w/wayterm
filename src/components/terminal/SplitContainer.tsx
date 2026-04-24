import { useState, useCallback, useRef, useEffect } from "react";
import type { SplitNode } from "../../types/terminal";
import { useTerminalStore, countPaneNodes } from "../../stores/terminal";
import TerminalPane from "./TerminalPane";
import SftpPane from "../sftp/SftpPane";
import SerialPane from "./SerialPane";

interface SplitContainerProps {
  node: SplitNode;
  depth?: number;
  totalPaneCount?: number;
}

export { SplitContainer };


const GAP = 8;

function findPaneNode(node: SplitNode, paneId: string): SplitNode | null {
  if (node.type === "pane" && node.paneId === paneId) return node;
  if (node.type === "split" && node.children) {
    for (const child of node.children) {
      const found = findPaneNode(child, paneId);
      if (found) return found;
    }
  }
  return null;
}

export default function SplitContainer({
  node,
  depth = 0,
  totalPaneCount,
}: SplitContainerProps) {
  const activePaneId = useTerminalStore((s) => s.activePaneId);
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const zoomedPaneId = useTerminalStore((s) => s.zoomedPaneId);
  const tabs = useTerminalStore((s) => s.tabs);

  const paneCount =
    totalPaneCount ??
    (() => {
      const tab = tabs.find((t) => t.id === activeTabId);
      return tab ? countPaneNodes(tab.panes) : 1;
    })();

  // If a pane is zoomed, render only that pane at full size
  if (zoomedPaneId && depth === 0) {
    const zoomedNode = findPaneNode(node, zoomedPaneId);
    if (zoomedNode && zoomedNode.paneId) {
      const pane = useTerminalStore.getState().panes[zoomedNode.paneId];
      if (pane?.shellType === "sftp") {
        return <SftpPane paneId={zoomedNode.paneId} isActive={true} paneCount={1} />;
      }
      if (pane?.shellType === "serial") {
        return <SerialPane paneId={zoomedNode.paneId} isActive={true} paneCount={1} />;
      }
      return <TerminalPane paneId={zoomedNode.paneId} isActive={true} paneCount={1} />;
    }
  }

  if (node.type === "pane" && node.paneId) {
    const pane = useTerminalStore.getState().panes[node.paneId];
    if (pane?.shellType === "sftp") {
      return (
        <SftpPane
          paneId={node.paneId}
          isActive={activePaneId === node.paneId}
          paneCount={paneCount}
        />
      );
    }
    if (pane?.shellType === "serial") {
      return (
        <SerialPane
          paneId={node.paneId}
          isActive={activePaneId === node.paneId}
          paneCount={paneCount}
        />
      );
    }
    return (
      <TerminalPane
        paneId={node.paneId}
        isActive={activePaneId === node.paneId}
        paneCount={paneCount}
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
        totalPaneCount={paneCount}
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
  totalPaneCount: number;
}

function SplitView({
  direction,
  initialRatio,
  first,
  second,
  depth,
  totalPaneCount,
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

  
  const firstSize = `calc(${ratio * 100}% - ${GAP / 2}px)`;
  const secondSize = `calc(${(1 - ratio) * 100}% - ${GAP / 2}px)`;

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full ${isHorizontal ? "flex-row" : "flex-col"}`}
    >
      <div
        className="overflow-hidden rounded-lg"
        style={{
          flexBasis: firstSize,
          flexGrow: 0,
          flexShrink: 0,
        }}
      >
        <SplitContainer node={first} depth={depth + 1} totalPaneCount={totalPaneCount} />
      </div>

      {}
      <div
        onMouseDown={handleMouseDown}
        className={`group shrink-0 flex items-center justify-center ${
          isHorizontal ? "cursor-col-resize" : "cursor-row-resize"
        }`}
        style={{
          [isHorizontal ? "width" : "height"]: `${GAP}px`,
        }}
      >
        {}
        <div
          className={`rounded-full bg-transparent transition-colors duration-150 group-hover:bg-accent/50 ${
            isHorizontal ? "h-8 w-[2px]" : "w-8 h-[2px]"
          }`}
        />
      </div>

      <div
        className="overflow-hidden rounded-lg"
        style={{
          flexBasis: secondSize,
          flexGrow: 0,
          flexShrink: 0,
        }}
      >
        <SplitContainer node={second} depth={depth + 1} totalPaneCount={totalPaneCount} />
      </div>
    </div>
  );
}
