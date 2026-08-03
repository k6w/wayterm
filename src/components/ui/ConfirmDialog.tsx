import { useRef } from "react";
import { Button, Dialog, DialogContent } from "../../ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Yes/no question on the kit Dialog. A danger confirmation starts with focus
 * on Cancel, so pressing Enter right away never deletes anything; a default
 * one starts on the confirm button. Escape, the close button and a click
 * outside all cancel.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        size="sm"
        title={title}
        description={message}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (variant === "danger" ? cancelRef : confirmRef).current?.focus();
        }}
        footer={
          <>
            <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              ref={confirmRef}
              variant={variant === "danger" ? "danger" : "primary"}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
