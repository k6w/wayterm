import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useThemeStore } from "../../stores/theme";
import { useSettingsStore } from "../../stores/settings";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder,
  className = "",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropUp, setDropUp] = useState(false);
  const theme = useThemeStore((s) => s.active);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const windowOpacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const dropBg = vibrancy
    ? hexToRgba(theme.ui.bgSecondary, vibrancyAlpha(windowOpacity) * 0.85)
    : theme.ui.bgSecondary;

  const selected = options.find((o) => o.value === value);

  const handleToggle = useCallback(() => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 200);
    }
    setOpen((prev) => !prev);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-bg-tertiary px-3 py-1.5 text-sm transition-colors outline-none ${
          open
            ? "border-accent text-text-primary"
            : "border-border text-text-primary hover:border-border-focus"
        }`}
      >
        <span className="truncate">
          {selected ? selected.label : (placeholder ?? "Select...")}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-text-muted transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className={`absolute z-50 w-full min-w-[140px] rounded-lg border border-border shadow-lg overflow-hidden ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
          style={{
            backgroundColor: dropBg,
            backdropFilter: vibrancy ? "blur(20px) saturate(1.3)" : undefined,
            WebkitBackdropFilter: vibrancy ? "blur(20px) saturate(1.3)" : undefined,
          }}
        >
          <div className="max-h-[200px] overflow-y-auto py-1">
            {options.map((option) => {
              const isActive = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors text-left ${
                    isActive
                      ? "bg-accent/15 text-accent"
                      : "text-text-secondary hover:bg-overlay/[0.06] hover:text-text-primary"
                  }`}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {isActive && (
                    <Check size={12} className="shrink-0 text-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
