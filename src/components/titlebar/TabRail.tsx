import { useSettingsStore } from "../../stores/settings";
import { cn } from "../../ui";
import TabStrip from "./TabStrip";

const BORDER = { left: "border-r", right: "border-l", bottom: "border-t" } as const;

/**
 * Hosts the tab strip when tabs are placed left, right or bottom (the title
 * bar hosts it for "top"). Vertical rails are 200px wide; the bottom rail is
 * 36px tall like the title bar.
 */
export default function TabRail() {
  const tabPosition = useSettingsStore((s) => s.settings.appearance.tabPosition);
  if (tabPosition === "top") return null;
  const vertical = tabPosition !== "bottom";

  return (
    <div
      data-tauri-drag-region
      data-testid="tab-rail"
      className={cn(
        "nx-blur flex shrink-0 border-border bg-tabbar-glass",
        BORDER[tabPosition],
        vertical ? "h-full w-50 flex-col py-1" : "h-9 w-full items-center px-1"
      )}
    >
      <TabStrip />
    </div>
  );
}
