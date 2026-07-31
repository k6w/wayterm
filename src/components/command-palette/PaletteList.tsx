import { useId, type ReactNode } from "react";
import { ListRow, menuLabelClass } from "../../ui";

export interface PaletteItem {
  key: string;
  label: string;
  icon: ReactNode;
  /** Keybindings-format shortcut shown as a Kbd. */
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

/**
 * The palette's result list: a listbox of kit ListRows grouped under small
 * section labels. Focus stays in the search input; the active row is announced
 * through aria-activedescendant.
 */
export function PaletteList({ id, label, sections, activeIndex, optionId, onHover, onChoose }: PaletteListProps) {
  const baseId = useId();
  let index = -1;
  return (
    <div id={id} role="listbox" aria-label={label} className="min-h-0 flex-1 overflow-y-auto p-1.5">
      {sections.map((section, sectionIndex) => {
        const headingId = `${baseId}-${sectionIndex}`;
        return (
          <div key={section.heading} role="group" aria-labelledby={headingId}>
            <div id={headingId} className={menuLabelClass}>
              {section.heading}
            </div>
            {section.items.map((item) => {
              index += 1;
              const itemIndex = index;
              const active = itemIndex === activeIndex;
              return (
                <ListRow
                  key={item.key}
                  id={optionId(itemIndex)}
                  role="option"
                  aria-selected={active}
                  tabIndex={-1}
                  selected={active}
                  icon={item.icon}
                  label={item.label}
                  shortcut={item.shortcut}
                  trailing={item.trailing}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => {
                    if (!active) onHover(itemIndex);
                  }}
                  onSelect={() => onChoose(itemIndex)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
