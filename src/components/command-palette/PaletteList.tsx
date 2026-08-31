import { useId, type ReactNode } from "react";
import { Kbd, cn, focusRing } from "../../ui";
import type { MatchRange } from "./filter";

export interface PaletteItem {
  key: string;
  label: string;
  /** Matched character ranges in `label`, rendered emphasised. */
  ranges?: readonly MatchRange[];
  /** Leading 16px icon (or a swatch) shown in a 28px tile. */
  icon: ReactNode;
  /** Muted text after the title (category, theme variant). */
  subtitle?: string;
  /** Keybindings-format shortcut shown as compact Kbd glyphs. */
  shortcut?: string;
  /** Right-aligned, non-interactive marker (chevron for a nested list, check for the current theme). */
  trailing?: ReactNode;
}

export interface PaletteSection {
  heading: string;
  items: PaletteItem[];
}

export interface PaletteListProps {
  /** id of the listbox; the input points at it with aria-controls. */
  id: string;
  label: string;
  sections: PaletteSection[];
  /** Index into the flattened items, in display order. */
  activeIndex: number;
  /** id of option `index`, shared with the input's aria-activedescendant. */
  optionId: (index: number) => string;
  onHover: (index: number) => void;
  onChoose: (index: number) => void;
}

/** Title with the matched ranges set in semibold, brighter text. */
function Highlighted({ text, ranges }: { text: string; ranges: readonly MatchRange[] }) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <span key={i} data-match className="font-semibold text-fg-strong">
        {text.slice(start, end)}
      </span>
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * The palette's result list: a listbox of 36px rows grouped under small
 * section labels. Focus stays in the search input; the active row is announced
 * through aria-activedescendant.
 */
export function PaletteList({ id, label, sections, activeIndex, optionId, onHover, onChoose }: PaletteListProps) {
  const baseId = useId();
  let index = -1;
  return (
    <div id={id} role="listbox" aria-label={label} className="max-h-[440px] min-h-0 flex-1 overflow-y-auto p-2">
      {sections.map((section, sectionIndex) => {
        const headingId = `${baseId}-${sectionIndex}`;
        return (
          <div key={section.heading} role="group" aria-labelledby={headingId} className="pb-1">
            <div id={headingId} className="px-2 pb-1 pt-2 text-caption font-medium uppercase tracking-wider text-fg-muted">
              {section.heading}
            </div>
            {section.items.map((item) => {
              index += 1;
              const itemIndex = index;
              const active = itemIndex === activeIndex;
              return (
                <button
                  key={item.key}
                  id={optionId(itemIndex)}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-selected={active || undefined}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => {
                    if (!active) onHover(itemIndex);
                  }}
                  onClick={() => onChoose(itemIndex)}
                  className={cn(
                    "relative flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors duration-100 ease-out",
                    active ? "bg-hover" : "bg-transparent",
                    focusRing
                  )}
                >
                  {active && (
                    <span aria-hidden data-accent-bar className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />
                  )}
                  <span
                    aria-hidden
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-raised",
                      active ? "text-fg" : "text-fg-muted"
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className={cn("truncate text-body", active ? "text-fg" : "text-fg-secondary")}>
                      <Highlighted text={item.label} ranges={item.ranges ?? []} />
                    </span>
                    {item.subtitle && <span className="shrink-0 truncate text-label text-fg-muted">{item.subtitle}</span>}
                  </span>
                  {item.trailing}
                  {item.shortcut && <Kbd shortcut={item.shortcut} variant="ghost" />}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
