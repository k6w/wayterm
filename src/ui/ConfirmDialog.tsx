import { useRef, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./Button";
import { Dialog, DialogContent } from "./Dialog";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  /** Header tile icon; defaults to a warning triangle (danger) or a question mark. */
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Yes/no question on the kit Dialog. A danger confirmation starts with focus
 * on Cancel, so pressing Enter right away never deletes anything; a default
 * one starts on the confirm button. Escape, the close button and a click
 * outside all cancel.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  icon,
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
        descriptionPlacement="body"
        icon={icon ?? (variant === "danger" ? <Icon name="warning" size="md" /> : <Icon name="help" size="md" />)}
        tone={variant === "danger" ? "danger" : "accent"}
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
              variant={variant === "danger" ? "destructive" : "primary"}
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
