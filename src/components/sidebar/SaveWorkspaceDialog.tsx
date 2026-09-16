import { useEffect, useState } from "react";
import { InputDialog } from "../../ui";
import { toast } from "../../stores/toast";
import { useTerminalStore } from "../../stores/terminal";
import { useWorkspaceStore } from "../../stores/workspace";
import { OPEN_SAVE_WORKSPACE } from "./save-workspace";

/** Asks for a name and saves the open layout as a workspace. Opened by the `nexterm:save-workspace` event. */
export default function SaveWorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const count = useWorkspaceStore((s) => s.workspaces.filter((w) => w.id !== "__session__").length);

  useEffect(() => {
    const handler = () => {
      if (useTerminalStore.getState().tabs.length === 0) {
        toast.info("Open a tab first: there is no layout to save.");
        return;
      }
      setOpen(true);
    };
    window.addEventListener(OPEN_SAVE_WORKSPACE, handler);
    return () => window.removeEventListener(OPEN_SAVE_WORKSPACE, handler);
  }, []);

  return (
    <InputDialog
      open={open}
      title="Save current layout"
      label="Name"
      defaultValue={`Workspace ${count + 1}`}
      confirmLabel="Save"
      onConfirm={(name) => {
        setOpen(false);
        void useWorkspaceStore
          .getState()
          .save(name)
          .then((id) => {
            if (id) toast.success(`Saved workspace "${name}".`);
          })
          .catch((e: unknown) => toast.error(`Could not save the workspace: ${String(e)}`));
      }}
      onCancel={() => setOpen(false)}
    />
  );
}
