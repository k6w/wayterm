import { Suspense, useState } from "react";
import type { SplitNode } from "../../types/terminal";
import { useTerminalStore, countPaneNodes } from "../../stores/terminal";
import { SplitPane } from "../../ui";
import TerminalPane from "./TerminalPane";
import { lazyWithPreload } from "../../lib/lazy";
import { PanelFallback } from "../PanelFallback";
import PaneFrame from "./PaneFrame";

const SftpPane = lazyWithPreload(() => import("../sftp/SftpPane"));
const SerialPane = lazyWithPreload(() => import("./SerialPane"));

interface SplitContainerProps {
  node: SplitNode;
  depth?: number;
  totalPaneCount?: number;
}

export { SplitContainer };

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

function PaneView({ paneId, isActive, paneCount }: { paneId: string; isActive: boolean; paneCount: number }) {
  const shellType = useTerminalStore.getState().panes[paneId]?.shellType;
  if (shellType === "sftp" || shellType === "serial") {
    const Pane = shellType === "sftp" ? SftpPane : SerialPane;
    return (
      <Suspense fallback={<PanelFallback />}>
        <Pane paneId={paneId} isActive={isActive} paneCount={paneCount} />
      </Suspense>
    );
  }
  return <TerminalPane paneId={paneId} isActive={isActive} paneCount={paneCount} />;
}

export default function SplitContainer({ node, depth = 0, totalPaneCount }: SplitContainerProps) {
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

  // A zoomed pane renders alone at full size.
  if (zoomedPaneId && depth === 0) {
    const zoomedNode = findPaneNode(node, zoomedPaneId);
    if (zoomedNode?.paneId) {
      return <PaneView paneId={zoomedNode.paneId} isActive paneCount={1} />;
    }
  }

  if (node.type === "pane" && node.paneId) {
    const isActive = activePaneId === node.paneId;
    return (
      <PaneFrame active={isActive} split={paneCount > 1}>
        <PaneView paneId={node.paneId} isActive={isActive} paneCount={paneCount} />
      </PaneFrame>
    );
  }

  if (node.type === "split" && node.children && node.direction && node.ratio !== undefined) {
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

/** One split: two subtrees with a 1px hairline divider (drag or arrow keys). */
function SplitView({ direction, initialRatio, first, second, depth, totalPaneCount }: SplitViewProps) {
  // The ratio stays local, as before: dragging resizes the live layout only.
  const [ratio, setRatio] = useState(initialRatio);
  return (
    <SplitPane
      direction={direction}
      ratio={ratio}
      onRatioChange={setRatio}
      min={0.1}
      max={0.9}
      separatorLabel={direction === "horizontal" ? "Resize panes left and right" : "Resize panes up and down"}
      first={<SplitContainer node={first} depth={depth + 1} totalPaneCount={totalPaneCount} />}
      second={<SplitContainer node={second} depth={depth + 1} totalPaneCount={totalPaneCount} />}
    />
  );
}
