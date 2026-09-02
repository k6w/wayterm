import { useRef } from "react";
import { Copy, FileWarning, Replace } from "lucide-react";
import { Button, Dialog, DialogContent, ICON_MD, ICON_SM } from "../../ui";
import { joinRemote } from "./sftp-paths";

interface FileConflictDialogProps {
  open: boolean;
  fileName: string;
  onReplace: () => void;
  /** Keep both: upload under the next free name ("a (1).txt"); receives the full remote path. */
  onRename: (newPath: string) => void;
  onSkip: () => void;
  /** Names already in the remote folder. */
  remoteNames: Set<string>;
  /** The remote folder the file goes to. */
  remoteDir: string;
}

/** "report (1).pdf", "report (2).pdf", ... the first name not in `existing`. */
export function nextAvailableName(fileName: string, existing: ReadonlySet<string>): string {
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : "";
  for (let n = 1; ; n++) {
    const candidate = `${base} (${n})${ext}`;
    if (!existing.has(candidate)) return candidate;
  }
}

/** Asks what to do when an upload would overwrite a remote file. Focus starts on Skip, the safe choice. */
export default function FileConflictDialog({
  open,
  fileName,
  onReplace,
  onRename,
  onSkip,
  remoteNames,
  remoteDir,
}: FileConflictDialogProps) {
  const skipRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onSkip();
      }}
    >
      <DialogContent
        size="sm"
        title="File already exists"
        icon={<FileWarning {...ICON_MD} />}
        tone="warning"
        hints={[{ shortcut: "Escape", label: "Skip" }]}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          skipRef.current?.focus();
        }}
        footer={
          <>
            <Button ref={skipRef} variant="ghost" onClick={onSkip}>
              Skip
            </Button>
            <Button
              leadingIcon={<Copy {...ICON_SM} />}
              onClick={() => onRename(joinRemote(remoteDir, nextAvailableName(fileName, remoteNames)))}
            >
              Keep both
            </Button>
            <Button variant="primary" leadingIcon={<Replace {...ICON_SM} />} onClick={onReplace}>
              Replace
            </Button>
          </>
        }
      >
        <p className="text-body text-fg-secondary">
          <span className="font-medium text-fg">{fileName}</span> already exists in{" "}
          <span className="font-mono text-fg">{remoteDir}</span>. Replace it, keep both, or skip this file?
        </p>
      </DialogContent>
    </Dialog>
  );
}
