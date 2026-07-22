import { useRef, type ReactElement, type ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { Kbd } from "./Kbd";

export interface TooltipProps {
  /** Tooltip body. When null/false/undefined the child renders without a tooltip. */
  content: ReactNode;
  /** Optional keybindings-format shortcut shown as a Kbd chip. */
  shortcut?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Hover delay in ms. Keyboard focus opens immediately. */
  delayDuration?: number;
  disabled?: boolean;
  /** Exactly one element that accepts a ref and event handlers (a button). */
  children: ReactElement;
}

/** Hover/focus label for a control. Self-contained: no app-level provider needed. */
export function Tooltip({
  content,
  shortcut,
  side = "top",
  align = "center",
  delayDuration = 400,
  disabled = false,
  children,
}: TooltipProps) {
  // True from a pointer press until the trigger blurs. Focus that arrives from
  // a pointer click must not (re)open the tooltip; keyboard focus still does.
  const pointerFocusRef = useRef(false);
  if (disabled || content === null || content === undefined || content === false) return children;
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={300}>
      <TooltipPrimitive.Root disableHoverableContent>
        <TooltipPrimitive.Trigger
          asChild
          onPointerDown={() => {
            pointerFocusRef.current = true;
          }}
          onFocus={(event) => {
            if (pointerFocusRef.current) event.preventDefault();
          }}
          onBlur={() => {
            pointerFocusRef.current = false;
          }}
        >{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={6}
            collisionPadding={8}
            className="z-[var(--z-tooltip)] flex max-w-72 animate-nx-fade-in items-center gap-2 rounded-md border border-border bg-tooltip px-2 py-1 text-label text-tooltip-fg shadow-popover"
          >
            <span>{content}</span>
            {shortcut && <Kbd shortcut={shortcut} />}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
