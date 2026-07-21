import type { ComponentPropsWithRef, ReactNode } from "react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import { Check, ChevronRight } from "lucide-react";
import { Kbd } from "./Kbd";
import { menuContentClass, menuItemClass, menuLabelClass, menuSeparatorClass } from "./menu-styles";
import { cn, ICON_SM } from "./utils";

export const ContextMenu = ContextMenuPrimitive.Root;
/** Wrap the right-clickable element: <ContextMenuTrigger asChild><div>...</div></ContextMenuTrigger>. */
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuGroup = ContextMenuPrimitive.Group;
export const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;
export const ContextMenuSub = ContextMenuPrimitive.Sub;

/** Right-click menu surface, opened at the pointer. Same keyboard model as Menu. */
export function ContextMenuContent({
  className,
  ...rest
}: ComponentPropsWithRef<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content collisionPadding={8} className={cn(menuContentClass, className)} {...rest} />
    </ContextMenuPrimitive.Portal>
  );
}

export interface ContextMenuItemProps extends ComponentPropsWithRef<typeof ContextMenuPrimitive.Item> {
  icon?: ReactNode;
  /** Keybindings-format shortcut rendered as a Kbd hint. */
  shortcut?: string;
  danger?: boolean;
}

export function ContextMenuItem({
  icon,
  shortcut,
  danger = false,
  className,
  children,
  ...rest
}: ContextMenuItemProps) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(menuItemClass, danger && "text-danger data-[highlighted]:bg-danger-subtle", className)}
      {...rest}
    >
      {icon && (
        <span aria-hidden className="inline-flex shrink-0 text-fg-muted">
          {icon}
        </span>
      )}
      <span className="flex flex-1 items-center gap-2 truncate">{children}</span>
      {shortcut && <Kbd shortcut={shortcut} className="ml-4" />}
    </ContextMenuPrimitive.Item>
  );
}

export function ContextMenuRadioItem({
  className,
  children,
  ...rest
}: ComponentPropsWithRef<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem className={cn(menuItemClass, "pr-7", className)} {...rest}>
      <span className="flex flex-1 items-center gap-2 truncate">{children}</span>
      <ContextMenuPrimitive.ItemIndicator className="absolute right-2 inline-flex text-accent-fg">
        <Check {...ICON_SM} aria-hidden />
      </ContextMenuPrimitive.ItemIndicator>
    </ContextMenuPrimitive.RadioItem>
  );
}

export function ContextMenuLabel({
  className,
  ...rest
}: ComponentPropsWithRef<typeof ContextMenuPrimitive.Label>) {
  return <ContextMenuPrimitive.Label className={cn(menuLabelClass, className)} {...rest} />;
}

export function ContextMenuSeparator({
  className,
  ...rest
}: ComponentPropsWithRef<typeof ContextMenuPrimitive.Separator>) {
  return <ContextMenuPrimitive.Separator className={cn(menuSeparatorClass, className)} {...rest} />;
}

export interface ContextMenuSubTriggerProps
  extends ComponentPropsWithRef<typeof ContextMenuPrimitive.SubTrigger> {
  icon?: ReactNode;
}

export function ContextMenuSubTrigger({ icon, className, children, ...rest }: ContextMenuSubTriggerProps) {
  return (
    <ContextMenuPrimitive.SubTrigger
      className={cn(menuItemClass, "data-[state=open]:bg-hover", className)}
      {...rest}
    >
      {icon && (
        <span aria-hidden className="inline-flex shrink-0 text-fg-muted">
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      <ChevronRight {...ICON_SM} aria-hidden className="text-fg-muted" />
    </ContextMenuPrimitive.SubTrigger>
  );
}

export function ContextMenuSubContent({
  className,
  ...rest
}: ComponentPropsWithRef<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.SubContent
        sideOffset={4}
        collisionPadding={8}
        className={cn(menuContentClass, className)}
        {...rest}
      />
    </ContextMenuPrimitive.Portal>
  );
}
