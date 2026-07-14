import {
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowDownToLine,
} from "lucide-react";
import type { DropZone } from "../../stores/terminal";

interface DropZoneOverlayProps {
  activeZone: DropZone;
}

const zones = [
  {
    key: "left" as const,
    label: "Split Left",
    Icon: ArrowLeftToLine,
    position: "top-0 left-0 w-[30%] h-full",
  },
  {
    key: "right" as const,
    label: "Split Right",
    Icon: ArrowRightToLine,
    position: "top-0 right-0 w-[30%] h-full",
  },
  {
    key: "top" as const,
    label: "Split Up",
    Icon: ArrowUpToLine,
    position: "top-0 left-[30%] w-[40%] h-[30%]",
  },
  {
    key: "bottom" as const,
    label: "Split Down",
    Icon: ArrowDownToLine,
    position: "bottom-0 left-[30%] w-[40%] h-[30%]",
  },
] as const;

export default function DropZoneOverlay({ activeZone }: DropZoneOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {zones.map(({ key, label, Icon, position }) => {
        const isActive = activeZone === key;

        return (
          <div
            key={key}
            className={`absolute flex flex-col items-center justify-center gap-1.5 transition-all duration-150 ${position} ${
              isActive
                ? "bg-accent/20 border-2 border-dashed border-accent/60"
                : "bg-overlay/[0.02] border-2 border-dashed border-transparent"
            }`}
          >
            <Icon
              size={20}
              className={`transition-colors duration-150 ${
                isActive ? "text-accent" : "text-text-muted/30"
              }`}
            />
            <span
              className={`text-[11px] font-medium select-none transition-colors duration-150 ${
                isActive ? "text-accent" : "text-text-muted/20"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
