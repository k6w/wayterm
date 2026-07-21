import type { ComponentPropsWithRef, ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { cn, ICON_SM } from "./utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const SIZE = {
  sm: "w-[360px]",
  md: "w-[480px]",
  lg: "w-[640px]",
} as const;

export interface DialogContentProps
  extends Omit<ComponentPropsWithRef<typeof DialogPrimitive.Content>, "title"> {
  /** Required: names the dialog for screen readers. */
  title: ReactNode;
  description?: ReactNode;
  /** Usually the action buttons, right-aligned. */
  footer?: ReactNode;
  size?: keyof typeof SIZE;
  hideClose?: boolean;
}

/**
 * Modal dialog. Focus moves inside and is trapped, Escape closes, and focus
 * returns to the trigger.
 */
export function DialogContent({
  title,
  description,
  footer,
  size = "md",
  hideClose = false,
  className,
  children,
  ...rest
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-modal)] animate-nx-fade-in bg-scrim" />
      <DialogPrimitive.Content
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed left-1/2 top-1/2 z-[var(--z-modal)] flex max-h-[85vh] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col",
          "animate-nx-fade-in overflow-hidden rounded-lg border border-border bg-panel shadow-popover outline-none",
          SIZE[size],
          className
        )}
        {...rest}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-title font-semibold text-fg">{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-0.5 text-label text-fg-muted">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          {!hideClose && (
            <DialogPrimitive.Close asChild>
              <IconButton label="Close" icon={<X {...ICON_SM} />} tooltip={false} />
            </DialogPrimitive.Close>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-body text-fg">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">{footer}</div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
