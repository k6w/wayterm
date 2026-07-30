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

const PLACEMENT = {
  center: "top-1/2 max-h-[85vh] -translate-y-1/2",
  top: "top-[16vh] max-h-[68vh]",
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
  /** Keep the title for screen readers but render no header row (command palette). */
  hideHeader?: boolean;
  /** "top" pins the dialog 16vh from the top so it does not jump while its content changes height. */
  placement?: keyof typeof PLACEMENT;
  /** Body without padding or its own scrolling; the children lay themselves out. */
  flush?: boolean;
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
  hideHeader = false,
  placement = "center",
  flush = false,
  className,
  children,
  ...rest
}: DialogContentProps) {
  const hasBody = children !== undefined && children !== null && children !== false;
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-modal)] animate-nx-fade-in bg-scrim" />
      <DialogPrimitive.Content
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed left-1/2 z-[var(--z-modal)] flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col",
          "animate-nx-fade-in overflow-hidden rounded-lg border border-border bg-panel shadow-popover outline-none",
          PLACEMENT[placement],
          SIZE[size],
          className
        )}
        {...rest}
      >
        {hideHeader ? (
          <>
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            {description && <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>}
          </>
        ) : (
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
        )}
        {hasBody && (
          <div
            className={cn(
              "min-h-0 flex-1 text-body text-fg",
              flush ? "flex flex-col overflow-hidden" : "overflow-y-auto px-4 py-3"
            )}
          >
            {children}
          </div>
        )}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">{footer}</div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
