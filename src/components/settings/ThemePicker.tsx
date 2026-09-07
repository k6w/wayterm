import type { CSSProperties } from "react";
import { RadioGroup } from "radix-ui";
import { Icon } from "../../ui/icons";
import type { ThemeDefinition } from "../../types/theme";
import { cn, focusRing } from "../../ui";

export interface ThemePickerProps {
  themes: readonly ThemeDefinition[];
  /** The active theme id. No card is checked when it is not in `themes` (a custom theme). */
  value: string;
  onValueChange: (id: string) => void;
  /** Hover preview: called with an id on pointer enter and null on leave. */
  onPreview?: (id: string | null) => void;
  "aria-label": string;
  className?: string;
}

/**
 * Visual theme cards. A radio group: Tab enters at the checked card and the
 * arrow keys move between cards and pick them.
 */
export function ThemePicker({ themes, value, onValueChange, onPreview, className, "aria-label": ariaLabel }: ThemePickerProps) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={ariaLabel}
      orientation="horizontal"
      loop
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}
    >
      {themes.map((theme) => (
        <RadioGroup.Item
          key={theme.id}
          value={theme.id}
          onPointerEnter={() => onPreview?.(theme.id)}
          onPointerLeave={() => onPreview?.(null)}
          className={cn(
            "group flex flex-col overflow-hidden rounded-lg border border-border bg-panel text-left",
            "transition-colors duration-150 ease-out hover:border-border-strong data-[state=checked]:border-accent",
            focusRing
          )}
        >
          {/* The theme's own colors reach the swatch through --nx-dyn-* properties (no literals in code). */}
          <span
            aria-hidden
            style={
              {
                "--nx-dyn-panel": theme.chrome.panel,
                "--nx-dyn-border": theme.chrome.border,
                "--nx-dyn-accent": theme.chrome.accent,
                "--nx-dyn-term-bg": theme.terminal.background,
                "--nx-dyn-term-fg": theme.terminal.foreground,
                "--nx-dyn-green": theme.terminal.ansi[2],
                "--nx-dyn-blue": theme.terminal.ansi[4],
              } as CSSProperties
            }
            className="flex h-16 w-full flex-col bg-(--nx-dyn-term-bg)"
          >
            <span className="flex h-3.5 items-center gap-1 border-b border-(--nx-dyn-border) bg-(--nx-dyn-panel) px-1.5">
              <span className="size-1.5 rounded-full bg-(--nx-dyn-accent)" />
            </span>
            <span className="flex flex-col gap-1 px-2 pt-2">
              <span className="h-1 w-10 rounded-full bg-(--nx-dyn-green)" />
              <span className="h-1 w-14 rounded-full bg-(--nx-dyn-term-fg) opacity-60" />
              <span className="h-1 w-8 rounded-full bg-(--nx-dyn-blue)" />
            </span>
          </span>
          <span className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
            <span className="min-w-0">
              <span className="block truncate text-label font-medium text-fg">{theme.name}</span>
              <span className="block text-caption capitalize text-fg-muted">{theme.variant}</span>
            </span>
            <RadioGroup.Indicator className="inline-flex shrink-0 text-accent-fg">
              <Icon name="selected" size="sm" aria-hidden />
            </RadioGroup.Indicator>
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
