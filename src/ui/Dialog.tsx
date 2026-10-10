import type { ComponentPropsWithRef, ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Icon } from "./icons";
import { IconButton } from "./IconButton";
import { Kbd } from "./Kbd";
import { cn } from "./utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const SIZE = {
  sm: "w-[400px]",
  md: "w-[520px]",
  lg: "w-[640px]",
} as const;

const PLACEMENT = {
  center: "top-1/2 max-h-[80vh] -translate-y-1/2",
  top: "top-[16vh] max-h-[68vh]",
  palette: "top-[18vh] max-h-[72vh]",
} as const;

const SURFACE = {
  solid: "animate-wt-fade-in rounded-lg bg-panel shadow-popover",
  glass: "animate-wt-palette-in rounded-xl bg-dialog-glass wt-blur shadow-palette",
} as const;

/** Tint of the header icon tile: the dialog's purpose. */
const TONE = {
  accent: "bg-accent-subtle text-accent-fg",
  neutral: "bg-raised text-fg-secondary",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
} as const;

export interface DialogHint {
  /** Keybindings-format shortcut, e.g. "Escape" or "Mod+Enter". */
  shortcut: string;
  label: string;
}

const DEFAULT_HINTS: readonly DialogHint[] = [{ shortcut: "Escape", label: "Cancel" }];

export interface DialogContentProps
  extends Omit<ComponentPropsWithRef<typeof DialogPrimitive.Content>, "title"> {
  /** Required: names the dialog for screen readers. */
  title: ReactNode;
  description?: ReactNode;
  /** Leading 32px tile in the header, tinted by `tone`. */
  icon?: ReactNode;
  tone?: keyof typeof TONE;
  /** "body" shows a long description as the first lines of the body instead of the one-line header subtitle. */
  descriptionPlacement?: "header" | "body";
  /** Keyboard hints at the left of the footer. Defaults to "esc Cancel"; pass [] for none. */
  hints?: readonly DialogHint[];
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
  icon,
  tone = "accent",
  descriptionPlacement = "header",
  hints = DEFAULT_HINTS,
  footer,
  size = "md",
  hideClose = false,
  hideHeader = false,
  placement = "center",
  flush = false,
  surface = "glass",
  className,
  children,
  onOpenAutoFocus,
  ...rest
}: DialogContentProps) {
  const hasBody = children !== undefined && children !== null && children !== false;
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-modal)] animate-wt-fade-in bg-scrim" />
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
          <div className={cn("flex h-14 shrink-0 items-center gap-3 border-b border-border px-4", !hideClose && "pr-12")}>
            {icon && (
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle",
                  TONE[tone]
                )}
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-title font-semibold text-fg">{title}</DialogPrimitive.Title>
              {description && descriptionPlacement === "header" && (
                <DialogPrimitive.Description className="truncate text-label text-fg-muted">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
          </div>
        )}
        {hasBody || (description && descriptionPlacement === "body" && !hideHeader) ? (
          <div
            className={cn(
              "min-h-0 flex-1 text-body text-fg",
              flush ? "flex flex-col overflow-hidden" : "overflow-y-auto px-4 py-4"
            )}
          >
            {description && descriptionPlacement === "body" && !hideHeader && (
              <DialogPrimitive.Description className={cn("text-body text-fg-secondary", hasBody && "mb-4")}>
                {description}
              </DialogPrimitive.Description>
            )}
            {children}
          </div>
        ) : null}
        {footer && (
          <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-t border-border px-4">
            <div className="flex min-w-0 items-center gap-3 text-caption text-fg-muted">
              {hints.map((hint) => (
                <span key={hint.shortcut} className="inline-flex items-center gap-1 whitespace-nowrap">
                  <Kbd shortcut={hint.shortcut} variant="ghost" />
                  {hint.label}
                </span>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">{footer}</div>
          </div>
        )}
        {/* Last in the DOM so Tab reaches the footer buttons first; placed in the header's corner. */}
        {!hideClose && !hideHeader && (
          <DialogPrimitive.Close asChild>
            <IconButton
              label="Close"
              icon={<Icon name="close" size="sm" />}
              tooltip={false}
              className="absolute right-4 top-4"
            />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
