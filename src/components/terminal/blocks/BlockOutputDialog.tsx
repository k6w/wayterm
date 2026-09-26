import { create } from "zustand";
import { Button, Dialog, DialogContent } from "../../../ui";
import { Icon } from "../../../ui/icons";
import { copyText } from "../../../lib/blocks/block-actions";

interface ViewerState {
  /** The pane whose block output is shown, with a snapshot of it. */
  view: { paneId: string; command: string; output: string } | null;
  show: (paneId: string, command: string, output: string) => void;
  close: () => void;
}

/** Which block output the viewer shows; one at a time across the window. */
export const useBlockViewer = create<ViewerState>((set) => ({
  view: null,
  show: (paneId, command, output) => set({ view: { paneId, command, output } }),
  close: () => set({ view: null }),
}));

/** Read-only view of one block's output (the substitute for folding blocks). */
export function BlockOutputDialog({ paneId, onClosed }: { paneId: string; onClosed?: () => void }) {
  const view = useBlockViewer((s) => (s.view?.paneId === paneId ? s.view : null));
  const close = useBlockViewer((s) => s.close);
  return (
    <Dialog
      open={view !== null}
      onOpenChange={(open) => {
        if (open) return;
        close();
        onClosed?.();
      }}
    >
      {view && (
        <DialogContent
          title="Command output"
          description={view.command || undefined}
          icon={<Icon name="viewOutput" />}
          size="lg"
          surface="solid"
          flush
          footer={
            <>
              <Button variant="ghost" onClick={() => copyText(view.output)} disabled={!view.output}>
                <Icon name="copy" size="sm" />
                Copy output
              </Button>
              <Button variant="primary" onClick={close}>
                Close
              </Button>
            </>
          }
        >
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre px-4 py-3 font-mono text-label text-fg select-text">
            {view.output || "No output"}
          </pre>
        </DialogContent>
      )}
    </Dialog>
  );
}
