import type { ComponentPropsWithRef, ReactNode } from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { Icon, Icons } from "./icons";
import { useToastStore } from "../stores/toast";
import { IconButton } from "./IconButton";
import { cn, ICON_SM } from "./utils";

export const ToastProvider = ToastPrimitive.Provider;

export function ToastViewport({ className, ...rest }: ComponentPropsWithRef<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      className={cn(
        "fixed bottom-4 right-4 z-[var(--z-toast)] m-0 flex w-[360px] max-w-[calc(100vw-32px)] list-none flex-col gap-2 p-0 outline-none",
        className
      )}
      {...rest}
    />
  );
}

export type ToastTone = "info" | "success" | "error";

const ICON = { info: Icons.info, success: Icons.success, error: Icons.error } as const;
const TONE = { info: "text-info", success: "text-success", error: "text-danger" } as const;

export interface ToastProps extends Omit<ComponentPropsWithRef<typeof ToastPrimitive.Root>, "title"> {
  tone?: ToastTone;
  title?: ReactNode;
  message: ReactNode;
}

/** One notification. Render inside ToastProvider with a ToastViewport. */
export function Toast({ tone = "info", title, message, className, ...rest }: ToastProps) {
  const Glyph = ICON[tone];
  return (
    <ToastPrimitive.Root
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border bg-raised px-3 py-2 shadow-popover animate-wt-fade-in",
        className
      )}
      {...rest}
    >
      <Glyph {...ICON_SM} aria-hidden className={cn("mt-0.5 shrink-0", TONE[tone])} />
      <div className="min-w-0 flex-1">
        {title && <ToastPrimitive.Title className="text-label font-medium text-fg">{title}</ToastPrimitive.Title>}
        <ToastPrimitive.Description className="break-words text-label text-fg-secondary">
          {message}
        </ToastPrimitive.Description>
      </div>
      <ToastPrimitive.Close asChild>
        <IconButton label="Dismiss" icon={<Icon name="close" size="sm" />} size="xs" tooltip={false} />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

/**
 * Renders the app toast store (src/stores/toast.ts) with the kit. The store
 * owns the timers, so Radix's own auto-dismiss is disabled. Mounted once by App.tsx.
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <ToastProvider swipeDirection="right" duration={Infinity}>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          tone={t.variant}
          message={t.message}
          open
          onOpenChange={(open) => {
            if (!open) dismiss(t.id);
          }}
        />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
