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
  palette: "top-[18vh] max-h-[72vh]",
} as const;

const SURFACE = {
  solid: "animate-nx-fade-in rounded-lg bg-panel shadow-popover",
  glass: "animate-nx-palette-in rounded-xl bg-panel-glass nx-blur shadow-palette",
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
  /** "glass" is the translucent, blurred, larger-radius surface of the command palette. */
  surface?: keyof typeof SURFACE;
}

/**
 * Programmatic focus does not match :focus-visible after a mouse or shortcut
 * open, so a dialog's initially focused control would show no ring. Flag it;
 * focusRing styles `data-initial-focus` like :focus-visible.
 */
function markInitialFocus(event: Event) {
  if (!event.defaultPrevented) return;
  const target = document.activeElement;
  if (!(target instanceof HTMLElement) || target === document.body) return;
  target.setAttribute("data-initial-focus", "");
  target.addEventListener("blur", () => target.removeAttribute("data-initial-focus"), { once: true });
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
  surface = "solid",
  className,
  children,
  onOpenAutoFocus,
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
          "overflow-hidden border border-border outline-none",
          SURFACE[surface],
          PLACEMENT[placement],
          SIZE[size],
          className
        )}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          markInitialFocus(event);
        }}
        {...rest}
      >
        {hideHeader ? (
          <>
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            {description && <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>}
          </>
        ) : (
          <div className={cn("border-b border-border px-4 py-3", !hideClose && "pr-12")}>
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-title font-semibold text-fg">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-label text-fg-muted">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
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
        {/* Last in the DOM so Tab reaches the footer buttons first; placed in the header's corner. */}
        {!hideClose && !hideHeader && (
          <DialogPrimitive.Close asChild>
            <IconButton
              label="Close"
              icon={<X {...ICON_SM} />}
              tooltip={false}
              className="absolute right-3 top-3"
            />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
