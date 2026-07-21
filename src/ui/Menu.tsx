import type { ComponentPropsWithRef, ReactNode } from "react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import { Check, ChevronRight } from "lucide-react";
import { Kbd } from "./Kbd";
import { menuContentClass, menuItemClass, menuLabelClass, menuSeparatorClass } from "./menu-styles";
import { cn, ICON_SM } from "./utils";

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;
export const MenuGroup = MenuPrimitive.Group;
export const MenuRadioGroup = MenuPrimitive.RadioGroup;
export const MenuSub = MenuPrimitive.Sub;

/** Dropdown menu surface. Keyboard: arrows move, Enter selects, Escape closes, typeahead jumps. */
export function MenuContent({
  className,
  sideOffset = 4,
  ...rest
}: ComponentPropsWithRef<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content sideOffset={sideOffset} collisionPadding={8} className={cn(menuContentClass, className)} {...rest} />
    </MenuPrimitive.Portal>
  );
}

export interface MenuItemProps extends ComponentPropsWithRef<typeof MenuPrimitive.Item> {
  icon?: ReactNode;
  /** Keybindings-format shortcut rendered as a Kbd hint. */
  shortcut?: string;
  danger?: boolean;
}

export function MenuItem({ icon, shortcut, danger = false, className, children, ...rest }: MenuItemProps) {
  return (
    <MenuPrimitive.Item
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
    </MenuPrimitive.Item>
  );
}

export function MenuRadioItem({
  className,
  children,
  ...rest
}: ComponentPropsWithRef<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem className={cn(menuItemClass, "pr-7", className)} {...rest}>
      <span className="flex flex-1 items-center gap-2 truncate">{children}</span>
      <MenuPrimitive.ItemIndicator className="absolute right-2 inline-flex text-accent-fg">
        <Check {...ICON_SM} aria-hidden />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

export function MenuLabel({ className, ...rest }: ComponentPropsWithRef<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn(menuLabelClass, className)} {...rest} />;
}

export function MenuSeparator({ className, ...rest }: ComponentPropsWithRef<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn(menuSeparatorClass, className)} {...rest} />;
}

export interface MenuSubTriggerProps extends ComponentPropsWithRef<typeof MenuPrimitive.SubTrigger> {
  icon?: ReactNode;
}

export function MenuSubTrigger({ icon, className, children, ...rest }: MenuSubTriggerProps) {
  return (
    <MenuPrimitive.SubTrigger className={cn(menuItemClass, "data-[state=open]:bg-hover", className)} {...rest}>
      {icon && (
        <span aria-hidden className="inline-flex shrink-0 text-fg-muted">
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      <ChevronRight {...ICON_SM} aria-hidden className="text-fg-muted" />
    </MenuPrimitive.SubTrigger>
  );
}

export function MenuSubContent({ className, ...rest }: ComponentPropsWithRef<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.SubContent sideOffset={4} collisionPadding={8} className={cn(menuContentClass, className)} {...rest} />
    </MenuPrimitive.Portal>
  );
}
